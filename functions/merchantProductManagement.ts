import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

type AnyObj = Record<string, unknown>;

const ACTIONS = [
  'store_health', 'sync_inventory', 'dynamic_pricing', 'cart_recovery', 'product_optimization', 'conversion_audit',
  'fraud_analysis', 'margin_analysis', 'slow_mover_analysis', 'returns_analysis', 'promotion_planning',
  'product_performance', 'demand_forecast', 'review_management', 'channel_analysis', 'profitability_analysis',
  'loyalty_program', 'product_ideation', 'product_content_orchestration', 'variant_bundle_optimizer',
  'multi_echelon_forecast', 'supplier_intelligence', 'marketplace_command_center', 'personalization_engine',
  'order_fulfillment_optimizer', 'returns_command_center', 'loyalty_clv_engine', 'commerce_kpi_command',
  'merchant_full_self_test'
];

const genericSchema = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    metrics: { type: 'object' },
    risks: { type: 'array', items: { type: 'string' } },
    opportunities: { type: 'array', items: { type: 'string' } },
    actions: { type: 'array', items: { type: 'string' } },
  }
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const { action, params = {} } = payload as { action?: string; params?: AnyObj };
    const industry = String((payload as AnyObj).industry || params.industry || 'retail/e-commerce');
    const productId = String((payload as AnyObj).product_id || params.product_id || '');

    const loadProducts = () => base44.asServiceRole.entities.Product.list('-created_date', 200).catch(() => []);
    const loadInvoices = () => base44.asServiceRole.entities.Invoice.list('-created_date', 120).catch(() => []);

    const [products, invoices] = await Promise.all([loadProducts(), loadInvoices()]);
    const paidRevenue = invoices.filter((i: AnyObj) => i.status === 'paid').reduce((s: number, i: AnyObj) => s + Number(i.amount || 0), 0);
    const outOfStock = products.filter((p: AnyObj) => Number(p.stock_quantity ?? p.inventory ?? 1) <= 0);
    const lowStock = products.filter((p: AnyObj) => {
      const q = Number(p.stock_quantity ?? p.inventory ?? 1);
      return q > 0 && q <= 10;
    });

    const productContext = products.slice(0, 40).map((p: AnyObj) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      price: p.price,
      cost: p.cost_price || p.cost,
      stock: p.stock_quantity ?? p.inventory,
    }));

    const orderContext = invoices.slice(0, 60).map((i: AnyObj) => ({
      id: i.id,
      client: i.client_name || i.title,
      amount: i.amount,
      status: i.status,
    }));

    const targetProduct = productId ? productContext.find((p: AnyObj) => p.id === productId) : null;

    const runLLM = async (prompt: string, schema: AnyObj = genericSchema, addInternet = false) => {
      return await base44.integrations.Core.InvokeLLM({
        prompt,
        response_json_schema: schema,
        ...(addInternet ? { add_context_from_internet: true } : {}),
      });
    };

    let result: AnyObj | null = null;

    if (action === 'store_health') {
      result = await runLLM(
        `Generate an executive store health report for ${industry}.
Products: ${products.length}, out_of_stock: ${outOfStock.length}, low_stock: ${lowStock.length}, paid_revenue: $${paidRevenue}.
Sample catalog: ${JSON.stringify(productContext.slice(0, 20))}.
Return a concise health summary with traffic-light scoring for revenue, inventory, pricing, and conversion, plus top 5 actions by impact.`,
        {
          type: 'object',
          properties: {
            overall_health: { type: 'string' },
            health_score: { type: 'number' },
            scorecard: { type: 'object' },
            critical_alerts: { type: 'array', items: { type: 'string' } },
            top_actions: { type: 'array', items: { type: 'string' } },
            thirty_day_outlook: { type: 'string' },
          },
        }
      );
    }

    if (action === 'sync_inventory') {
      result = await runLLM(
        `Analyze inventory synchronization and replenishment priorities.
Catalog: ${JSON.stringify(productContext)}.
Focus on stockouts, low-stock risk, reorder quantities, and estimated revenue leakage from stockouts.`,
        {
          type: 'object',
          properties: {
            synced_products: { type: 'number' },
            stockout_risk: { type: 'array', items: { type: 'string' } },
            reorder_priorities: { type: 'array', items: { type: 'string' } },
            total_daily_revenue_loss_estimate: { type: 'string' },
            actions: { type: 'array', items: { type: 'string' } },
          },
        }
      );
    }

    if (action === 'dynamic_pricing') {
      result = await runLLM(
        `Perform dynamic pricing recommendations for ${industry}.
Products: ${JSON.stringify(targetProduct ? [targetProduct] : productContext.slice(0, 20))}.
Include elasticity assumptions, revenue and margin impact, and where to raise vs reduce prices.`,
        {
          type: 'object',
          properties: {
            recommendations: { type: 'array', items: { type: 'object' } },
            price_increase_opportunities: { type: 'array', items: { type: 'string' } },
            risk_flags: { type: 'array', items: { type: 'string' } },
            projected_impact: { type: 'string' },
          },
        },
        true
      );
    }

    if (action === 'cart_recovery') {
      result = await runLLM(
        `Design a 3-step abandoned-cart recovery sequence.
Context: ${JSON.stringify(params)}.
Provide email sequence (subject/body/CTA), SMS version, timing, and expected recovery lift.`
      );
    }

    if (action === 'product_optimization') {
      result = await runLLM(
        `Optimize product listing quality for conversion.
Products: ${JSON.stringify(targetProduct ? [targetProduct] : productContext.slice(0, 10))}.
Return title/description/image/trust-signal recommendations and estimated lift.`
      );
    }

    if (action === 'conversion_audit') {
      result = await runLLM(
        `Audit the ecommerce conversion funnel.
Orders: ${JSON.stringify(orderContext)}.
Products: ${products.length}, paid_revenue: $${paidRevenue}.
Identify top funnel leaks and highest ROI fixes.`
      );
    }

    if (action === 'fraud_analysis') {
      result = await runLLM(
        `Analyze fraud risk in recent orders.
Orders: ${JSON.stringify(orderContext)}.
Return fraud risk score, flagged patterns, and prevention controls with low false-positive bias.`
      );
    }

    if (action === 'margin_analysis') {
      result = await runLLM(
        `Run margin analysis for catalog.
Products: ${JSON.stringify(productContext)}.
Identify below-target margins, pricing/cost actions, and discontinuation candidates.`
      );
    }

    if (action === 'slow_mover_analysis') {
      result = await runLLM(
        `Classify products into fast/normal/slow/dead stock.
Products: ${JSON.stringify(productContext)}.
Recommend markdown, bundle, liquidation, and phase-out strategy.`
      );
    }

    if (action === 'returns_analysis') {
      result = await runLLM(
        `Analyze return patterns and root causes for ${industry}.
Catalog: ${JSON.stringify(productContext.slice(0, 25))}.
Return reason clusters, policy optimizations, and CX-safe reduction strategy.
Additional return_data: ${JSON.stringify(params.return_data || {})}`
      );
    }

    if (action === 'promotion_planning') {
      result = await runLLM(
        `Design high-ROI promotion strategy.
Promotion context: ${JSON.stringify(params)}.
Catalog sample: ${JSON.stringify(productContext.slice(0, 20))}.
Include structure, discount tiers, channel rollout, and margin guardrails.`
      );
    }

    if (action === 'product_performance') {
      result = await runLLM(
        `Analyze product performance matrix (stars/workhorses/question marks/dogs).
Catalog: ${JSON.stringify(productContext)}.
Orders: ${JSON.stringify(orderContext)}.
Recommend portfolio actions.`
      );
    }

    if (action === 'demand_forecast') {
      result = await runLLM(
        `Generate demand forecast and reorder plan.
Horizon: ${String(params.horizon_days || 30)} days.
Catalog: ${JSON.stringify(productContext)}.
Return stockout windows and reorder priorities.`
      );
    }

    if (action === 'review_management') {
      result = await runLLM(
        `Generate review-management strategy.
Context: ${JSON.stringify(params)}.
Include response templates, sentiment controls, and quality feedback loop to product teams.`
      );
    }

    if (action === 'channel_analysis') {
      result = await runLLM(
        `Analyze channel performance and channel mix optimization.
Business context: ${industry}. Orders: ${JSON.stringify(orderContext)}.
Return profitability by channel assumptions and strategic reallocation guidance.`
      );
    }

    if (action === 'profitability_analysis') {
      result = await runLLM(
        `Compute true profitability view.
Paid revenue: $${paidRevenue}. Catalog sample: ${JSON.stringify(productContext.slice(0, 20))}.
Account for COGS, shipping, returns, fees, and promo costs assumptions.`
      );
    }

    if (action === 'loyalty_program') {
      result = await runLLM(
        `Design or optimize loyalty program.
Context: ${JSON.stringify(params)}.
Return structure, tier logic, reward economics, and KPI framework.`
      );
    }

    if (action === 'product_ideation') {
      result = await runLLM(
        `Generate product ideation opportunities for ${industry}.
Current catalog: ${JSON.stringify(productContext.slice(0, 30))}.
Return 5 ideas with demand signal, competition, margin potential, and validation plan.`
      , genericSchema, true);
    }

    if (action === 'product_content_orchestration') {
      result = await runLLM(
        `Create complete product content package for omnichannel syndication.
Input context: ${JSON.stringify(params)}.
Include SEO title variants, short/long descriptions, specs, compliance flags, and visual brief for Canvas.`
      );
    }

    if (action === 'variant_bundle_optimizer') {
      result = await runLLM(
        `Optimize variants and bundles for AOV and margin.
Catalog: ${JSON.stringify(productContext)}.
Return bundle candidates, recommended pricing, risk constraints, and launch sequencing.`
      );
    }

    if (action === 'multi_echelon_forecast') {
      result = await runLLM(
        `Generate multi-echelon demand forecast by SKU/channel/location.
Forecast context: ${JSON.stringify(params)}.
Catalog: ${JSON.stringify(productContext)}.
Return forecast bands, risk zones, and allocation guidance.`
      );
    }

    if (action === 'supplier_intelligence') {
      result = await runLLM(
        `Generate supplier intelligence and resilience plan.
Inputs: ${JSON.stringify(params)}.
Catalog dependency context: ${JSON.stringify(productContext.slice(0, 25))}.
Return supplier risk matrix and mitigation actions.`
      );
    }

    if (action === 'marketplace_command_center') {
      result = await runLLM(
        `Generate marketplace operating plan and control tower summary.
Inputs: ${JSON.stringify(params)}.
Catalog: ${JSON.stringify(productContext.slice(0, 30))}.
Return listing priorities, fee-aware margin warnings, and 14-day action queue.`
      );
    }

    if (action === 'personalization_engine') {
      result = await runLLM(
        `Design personalization engine strategy for ecommerce journey.
Inputs: ${JSON.stringify(params)}.
Return segments, triggers, recommendation logic, and KPI stack.`
      );
    }

    if (action === 'order_fulfillment_optimizer') {
      result = await runLLM(
        `Optimize fulfillment routing and shipping operations.
Orders: ${JSON.stringify(orderContext)}.
Catalog stock context: ${JSON.stringify(productContext.slice(0, 30))}.
Return bottlenecks, routing rules, SLA risks, and cost optimization moves.`
      );
    }

    if (action === 'returns_command_center') {
      result = await runLLM(
        `Run returns command-center optimization.
Input: ${JSON.stringify(params)}.
Return reason clusters, policy adjustments, reverse-logistics actions, and fraud-safe controls.`
      );
    }

    if (action === 'loyalty_clv_engine') {
      result = await runLLM(
        `Generate loyalty + CLV growth plan from order behavior.
Orders: ${JSON.stringify(orderContext)}.
Return CLV segments, win-back priorities, subscription opportunities, and expected uplift.`
      );
    }

    if (action === 'commerce_kpi_command') {
      result = await runLLM(
        `Generate unified commerce KPI command board.
Products: ${products.length}, orders: ${invoices.length}, paid revenue: $${paidRevenue}, stockouts: ${outOfStock.length}, low-stock: ${lowStock.length}.
Return KPI snapshot, top risks, top opportunities, and 30-day action queue.`
      );
    }

    if (action === 'merchant_full_self_test') {
      const health = await runLLM('Run store health mini-check and return summary, risks, opportunities, actions.');
      const inventory = await runLLM('Run inventory diagnostics and return stockout risks, reorder priorities, and actions.');
      const pricing = await runLLM('Run pricing diagnostics and return opportunities, risk flags, and actions.');
      const fulfillment = await runLLM('Run fulfillment diagnostics and return bottlenecks, exception queue, and actions.');
      const loyalty = await runLLM('Run loyalty/CLV diagnostics and return segments, win-back priorities, and actions.');

      result = {
        checks: {
          health_ok: !!health,
          inventory_ok: !!inventory,
          pricing_ok: !!pricing,
          fulfillment_ok: !!fulfillment,
          loyalty_ok: !!loyalty,
        },
        health,
        inventory,
        pricing,
        fulfillment,
        loyalty,
      };
    }

    if (!result) {
      result = {
        message: `Action '${action}' received. Available: ${ACTIONS.join(', ')}`,
      };
    }

    return Response.json({ status: 'merchant_complete', action, result });
  } catch (error) {
    return Response.json({ error: (error as Error).message }, { status: 500 });
  }
});
