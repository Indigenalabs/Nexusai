import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { product_id } = payload;

    const product = await base44.entities.Product.read(product_id);
    const dynamicPrice = await base44.asServiceRole.entities.DynamicPrice.list().then(
      prices => prices.find(p => p.product_id === product_id)
    ) || {};

    // Fetch competitor prices, demand forecast, inventory
    const forecast = await base44.asServiceRole.entities.InventoryForecast.list().then(
      forecasts => forecasts.find(f => f.product_id === product_id)
    );

    // Use Sage to analyze and recommend price
    const pricingResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `Analyze pricing data and recommend optimal price:

Product: ${product.name}
Current Price: $${dynamicPrice.current_price || product.price}
Base/List Price: $${product.price}
Current Inventory: ${dynamicPrice.current_inventory || 'unknown'}
Forecast 7d Demand: ${forecast?.daily_demand_forecast?.[0]?.predicted_units || 'unknown'} units
Min Margin Threshold: ${dynamicPrice.min_price_threshold || product.price * 0.6}
Competitor Low: $${dynamicPrice.competitor_prices?.min || product.price * 0.9}
Competitor High: $${dynamicPrice.competitor_prices?.max || product.price * 1.1}

Factors to consider:
1. Margin must stay above minimum threshold
2. High inventory = lower price to move stock
3. High demand forecast = can increase price
4. If competitors out of stock = premium pricing opportunity
5. Demand spike from social trends = increase price temporarily

Provide:
- Recommended price
- Reasoning
- Expected impact on margin and velocity`,
      response_json_schema: {
        type: 'object',
        properties: {
          recommended_price: { type: 'number' },
          reasoning: { type: 'string' },
          expected_margin_impact: { type: 'number' },
          velocity_impact_percent: { type: 'number' }
        }
      }
    });

    const { recommended_price, reasoning, expected_margin_impact, velocity_impact_percent } = pricingResponse;

    // Check if recommendation meets constraints
    const isValidPrice = recommended_price >= (dynamicPrice.min_price_threshold || product.price * 0.6) &&
                        recommended_price <= (dynamicPrice.max_price_threshold || product.price * 1.5);

    if (!isValidPrice) {
      return Response.json({
        status: 'price_out_of_bounds',
        recommended: recommended_price,
        valid_range: [dynamicPrice.min_price_threshold, dynamicPrice.max_price_threshold]
      });
    }

    // If significant change, create notification for approval
    const percentChange = Math.abs((recommended_price - (dynamicPrice.current_price || product.price)) / (dynamicPrice.current_price || product.price)) * 100;

    if (percentChange > 5) {
      // Notify for approval
      await base44.asServiceRole.entities.Notification.create({
        type: 'price_change_recommendation',
        title: `💰 Dynamic Pricing: ${product.name}`,
        message: `Recommend changing price from $${dynamicPrice.current_price || product.price} to $${recommended_price.toFixed(2)} (${percentChange > 0 ? '+' : ''}${percentChange.toFixed(1)}%). Reason: ${reasoning.substring(0, 100)}...`,
        priority: percentChange > 15 ? 'high' : 'medium',
        action_url: `/Product?id=${product_id}`,
        recipient_role: 'admin'
      });
    }

    // Update DynamicPrice record
    const priceRecord = await base44.asServiceRole.entities.DynamicPrice.create({
      product_id,
      current_price: dynamicPrice.current_price || product.price,
      base_price: product.price,
      recommended_price,
      pricing_strategy: 'dynamic',
      last_price_update: new Date().toISOString()
    });

    // Log activity
    await base44.asServiceRole.entities.Activity.create({
      type: 'dynamic_pricing_analysis',
      title: `Pricing analyzed: ${product.name}`,
      description: `Recommended $${recommended_price} (current: $${dynamicPrice.current_price || product.price})`,
      entity_type: 'Product',
      entity_id: product_id
    });

    return Response.json({
      status: 'success',
      product_name: product.name,
      current_price: dynamicPrice.current_price || product.price,
      recommended_price,
      change_percent: percentChange.toFixed(1),
      reasoning,
      expected_margin_impact: expected_margin_impact.toFixed(1),
      expected_velocity_impact: velocity_impact_percent.toFixed(1),
      approval_required: percentChange > 5
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});