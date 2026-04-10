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

    // Fetch historical returns
    const allReturns = await base44.asServiceRole.entities.Order.list();
    const productReturns = allReturns.filter(o => 
      o.status === 'returned' && o.items?.some(i => i.product_id === product_id)
    );

    const totalOrders = allReturns.filter(o => o.items?.some(i => i.product_id === product_id)).length;
    const returnRate = totalOrders > 0 ? (productReturns.length / totalOrders) * 100 : 0;

    // Analyze return patterns
    const returnReasons = {};
    for (const returnOrder of productReturns) {
      const reason = returnOrder.return_reason || 'unknown';
      returnReasons[reason] = (returnReasons[reason] || 0) + 1;
    }

    // Use LLM to predict and recommend improvements
    const analysisResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `Analyze returns for a product and recommend improvements:

Product: ${product.name}
Category: ${product.category}
Return Rate: ${returnRate.toFixed(1)}%
Industry Average: 5-15% (varies by category)
Top Return Reasons: ${Object.entries(returnReasons).map(([reason, count]) => `${reason} (${count})`).join(', ')}

Provide:
1. Risk assessment (high/medium/low return risk)
2. Root causes
3. Prevention strategies
4. Expected impact % reduction`,
      response_json_schema: {
        type: 'object',
        properties: {
          risk_level: { type: 'string' },
          root_causes: { type: 'array', items: { type: 'string' } },
          prevention_strategies: { type: 'array', items: { type: 'string' } },
          predicted_improvement_percent: { type: 'number' }
        }
      }
    });

    const { risk_level, root_causes, prevention_strategies, predicted_improvement_percent } = analysisResponse;

    // Create ReturnPrediction record
    const returnPrediction = await base44.asServiceRole.entities.ReturnPrediction.create({
      product_id,
      return_rate_percent: returnRate,
      return_rate_industry_avg: 10, // Generic average
      return_probability_model: {
        high_risk_factors: root_causes,
        confidence_score: totalOrders > 50 ? 90 : 60 // Higher confidence with more data
      },
      top_return_reasons: Object.entries(returnReasons).map(([reason, count]) => ({
        reason,
        count,
        percent: (count / productReturns.length) * 100
      })),
      prevention_strategies,
      predicted_impact_percent: predicted_improvement_percent
    });

    // If high return rate, create notification
    if (returnRate > 15) {
      await base44.asServiceRole.entities.Notification.create({
        type: 'high_return_rate',
        title: `⚠️ High Return Rate: ${product.name}`,
        message: `${returnRate.toFixed(1)}% return rate. Top reason: ${Object.entries(returnReasons).sort((a, b) => b[1] - a[1])[0][0]}. Recommend: ${prevention_strategies[0]}`,
        priority: 'high',
        action_url: `/Product?id=${product_id}`,
        recipient_role: 'admin'
      });
    }

    return Response.json({
      status: 'analysis_complete',
      product_id,
      product_name: product.name,
      return_rate_percent: returnRate.toFixed(1),
      total_orders: totalOrders,
      total_returns: productReturns.length,
      risk_level,
      top_return_reasons: Object.entries(returnReasons)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([reason, count]) => `${reason} (${count})`),
      recommended_improvements: prevention_strategies,
      predicted_improvement: `${predicted_improvement_percent.toFixed(1)}% reduction possible`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});