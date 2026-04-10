import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { product_id, forecast_days = 30 } = payload;

    const product = await base44.entities.Product.read(product_id);

    // Fetch historical sales data
    const recentOrders = await base44.asServiceRole.entities.Order.list();
    const productOrders = recentOrders.filter(o => o.items?.some(i => i.product_id === product_id));

    const lastNinetyDays = productOrders.filter(o => {
      const daysAgo = (Date.now() - new Date(o.created_date).getTime()) / (1000 * 60 * 60 * 24);
      return daysAgo <= 90;
    });

    // Calculate daily average
    const avgDailyUnits = lastNinetyDays.length > 0
      ? lastNinetyDays.length / 90
      : 1;

    // Use LLM to generate forecast with factors
    const forecastResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate a 30-day demand forecast for a product:

Product: ${product.name}
Historical daily average (90d): ${avgDailyUnits.toFixed(2)} units
Current inventory: ${product.inventory_count || 'unknown'}
Price: $${product.price}
Category: ${product.category}
Seasonality: Q1 (analyze for trends)

Consider factors:
1. Day-of-week patterns (weekends vs weekdays)
2. Upcoming holidays/events
3. Seasonal demand (if applicable)
4. Potential viral trends for this category
5. Weather impact (if relevant)

Provide daily predictions for next 30 days with confidence levels.
Format: array of {date, predicted_units, confidence_percent}`,
      response_json_schema: {
        type: 'object',
        properties: {
          daily_forecasts: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                date: { type: 'string' },
                predicted_units: { type: 'number' },
                confidence_percent: { type: 'number' }
              }
            }
          },
          total_30d_units: { type: 'number' },
          seasonal_factors: { type: 'object' },
          recommendation: { type: 'string' }
        }
      }
    });

    const { daily_forecasts, total_30d_units, recommendation } = forecastResponse;

    // Calculate stockout date
    let cumulativeInventory = product.inventory_count || 0;
    let stockoutDate = null;

    for (const forecast of daily_forecasts) {
      cumulativeInventory -= forecast.predicted_units;
      if (cumulativeInventory <= 0 && !stockoutDate) {
        stockoutDate = forecast.date;
        break;
      }
    }

    // Calculate reorder point and quantity
    const supplier_lead_time = 14; // Default assumption
    const safety_stock = avgDailyUnits * 7; // 1 week safety stock
    const reorder_point = (avgDailyUnits * supplier_lead_time) + safety_stock;
    const reorder_quantity = avgDailyUnits * 30; // 30-day supply

    // Determine recommended reorder date
    const daysToReorderPoint = (product.inventory_count - reorder_point) / avgDailyUnits;
    const reorder_date = new Date();
    reorder_date.setDate(reorder_date.getDate() + Math.max(daysToReorderPoint, 1));

    // Create InventoryForecast record
    const forecast = await base44.asServiceRole.entities.InventoryForecast.create({
      product_id,
      sku: product.sku || product_id,
      forecast_start_date: new Date().toISOString().split('T')[0],
      forecast_end_date: new Date(Date.now() + forecast_days * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      current_stock: product.inventory_count || 0,
      daily_demand_forecast: daily_forecasts,
      projected_stockout_date: stockoutDate,
      reorder_point: Math.ceil(reorder_point),
      reorder_quantity: Math.ceil(reorder_quantity),
      supplier_lead_time_days: supplier_lead_time,
      recommended_reorder_date: reorder_date.toISOString().split('T')[0],
      safety_stock: Math.ceil(safety_stock)
    });

    // If stockout approaching, create reorder task
    if (stockoutDate) {
      const daysUntilStockout = (new Date(stockoutDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      if (daysUntilStockout < supplier_lead_time + 7) {
        // Need to reorder ASAP
        await base44.asServiceRole.entities.Task.create({
          title: `URGENT: Reorder ${product.name}`,
          description: `Product will stockout in ${daysUntilStockout.toFixed(0)} days. Recommend ${reorder_quantity.toFixed(0)} units.`,
          status: 'pending',
          priority: 'critical',
          project: 'inventory',
          source: 'system',
          source_id: product_id,
          tags: ['reorder', 'urgent']
        });

        await base44.asServiceRole.entities.Notification.create({
          type: 'stockout_warning',
          title: `⚠️ Reorder Needed: ${product.name}`,
          message: `Predicted stockout in ${daysUntilStockout.toFixed(0)} days. Recommend ${reorder_quantity.toFixed(0)} units.`,
          priority: 'critical',
          recipient_role: 'admin'
        });
      }
    }

    return Response.json({
      status: 'success',
      product_id,
      forecast_id: forecast.id,
      current_inventory: product.inventory_count,
      total_30d_forecast: Math.ceil(total_30d_units),
      projected_stockout_date: stockoutDate,
      reorder_point: Math.ceil(reorder_point),
      recommended_reorder_quantity: Math.ceil(reorder_quantity),
      recommended_reorder_date: reorder_date.toISOString().split('T')[0],
      recommendation
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});