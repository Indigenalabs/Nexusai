import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * E-commerce Optimizer — Advanced autonomous optimization function.
 * 
 * Actions:
 * - run_ab_test_analysis    → Analyze A/B test results, declare winner, notify Canvas/Maestro
 * - analyze_conversion_funnel → Review funnel drop-off, prioritize tests
 * - monitor_carrier_performance → Score carriers, update Atlas routing recommendations
 * - flag_high_return_products  → Detect return rate patterns, alert Merchant/Sage
 * - customer_retention_scan   → Identify at-risk customers, trigger Maestro win-back
 * - post_purchase_trigger     → Trigger post-purchase sequence for a delivered order
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action, data } = body;

    if (!action) return Response.json({ error: 'action is required' }, { status: 400 });

    // === RUN A/B TEST ANALYSIS ===
    if (action === 'run_ab_test_analysis') {
      const { testName, variantA, variantB, metric, sampleSizeA, sampleSizeB, conversionsA, conversionsB } = data || {};

      const rateA = conversionsA / sampleSizeA;
      const rateB = conversionsB / sampleSizeB;
      const lift = ((rateB - rateA) / rateA * 100).toFixed(1);

      // Simple z-test approximation
      const pooledRate = (conversionsA + conversionsB) / (sampleSizeA + sampleSizeB);
      const se = Math.sqrt(pooledRate * (1 - pooledRate) * (1/sampleSizeA + 1/sampleSizeB));
      const zScore = Math.abs((rateB - rateA) / se);
      const confidence = zScore > 2.576 ? 99 : zScore > 1.96 ? 95 : zScore > 1.645 ? 90 : Math.round(zScore * 30);

      const winner = rateB > rateA ? 'B' : 'A';
      const isSignificant = confidence >= 95 && Math.abs(parseFloat(lift)) >= 5;
      const decision = isSignificant ? `SHIP VARIANT ${winner}` : sampleSizeA < 500 ? 'RUN LONGER — insufficient sample' : 'INCONCLUSIVE — difference too small';

      // Store result
      await base44.entities.LearningLog.create({
        action_taken: `A/B Test: ${testName}`,
        outcome: isSignificant ? 'success' : 'neutral',
        feedback: `${decision}. Lift: ${lift}%. Confidence: ${confidence}%. Winner: Variant ${winner}. Metric: ${metric}.`,
        module: 'inspect',
        confidence_before: Math.round(rateA * 100),
        confidence_after: Math.round(rateB * 100),
        learned_pattern: `${testName}: Variant ${winner} outperformed by ${Math.abs(lift)}% on ${metric}`,
      }).catch(() => {});

      // Alert Maestro and Canvas with winner
      if (isSignificant) {
        await base44.entities.Notification.create({
          title: `🧪 A/B Test Winner: ${testName}`,
          message: `Variant ${winner} wins. ${Math.abs(lift)}% ${lift > 0 ? 'improvement' : 'decline'} on ${metric}. Confidence: ${confidence}%. Decision: ${decision}. Canvas: create 3 new variants using the winning approach. Maestro: ship variant ${winner} immediately.`,
          type: 'info',
          is_read: false,
        }).catch(() => {});
      }

      await base44.entities.Metric.create({
        name: `AB_Test_${testName.replace(/\s/g, '_')}`,
        value: parseFloat(lift),
        period: 'test',
        description: `A/B test: ${testName}. Variant A: ${(rateA*100).toFixed(2)}%, Variant B: ${(rateB*100).toFixed(2)}%. Confidence: ${confidence}%`,
      }).catch(() => {});

      return Response.json({ testName, rateA: (rateA*100).toFixed(2)+'%', rateB: (rateB*100).toFixed(2)+'%', lift: lift+'%', confidence: confidence+'%', decision, winner: isSignificant ? winner : null });
    }

    // === ANALYZE CONVERSION FUNNEL ===
    if (action === 'analyze_conversion_funnel') {
      const { visits, productViews, addToCarts, checkoutStarts, orders } = data || {};

      const benchmarks = { visitToView: 0.40, viewToCart: 0.08, cartToCheckout: 0.50, checkoutToOrder: 0.70 };

      const metrics = {
        visitToView: productViews / visits,
        viewToCart: addToCarts / productViews,
        cartToCheckout: checkoutStarts / addToCarts,
        checkoutToOrder: orders / checkoutStarts,
        overall: orders / visits,
      };

      const gaps = Object.entries(metrics).map(([stage, rate]) => {
        const bench = benchmarks[stage];
        if (!bench) return null;
        const delta = rate - bench;
        const pctDelta = (delta / bench * 100).toFixed(1);
        return { stage, rate: (rate * 100).toFixed(2) + '%', benchmark: (bench * 100).toFixed(0) + '%', delta: pctDelta + '%', isUnderperforming: rate < bench };
      }).filter(Boolean);

      const biggestGap = gaps.filter(g => g.isUnderperforming).sort((a, b) => parseFloat(a.delta) - parseFloat(b.delta))[0];

      const recommendations = {
        visitToView: 'Improve homepage and category page relevance, test hero banner content (Canvas)',
        viewToCart: 'A/B test CTA button, add urgency signals, improve product images (Canvas + Inspect)',
        cartToCheckout: 'Simplify cart page, add trust signals, test guest checkout prominence',
        checkoutToOrder: 'Reduce checkout steps, add payment options, improve mobile checkout UX',
      };

      if (biggestGap) {
        await base44.entities.Notification.create({
          title: `🔍 Biggest Funnel Gap: ${biggestGap.stage}`,
          message: `${biggestGap.stage} is at ${biggestGap.rate} vs ${biggestGap.benchmark} benchmark (${biggestGap.delta} gap). Recommendation: ${recommendations[biggestGap.stage]}`,
          type: 'warning',
          is_read: false,
        }).catch(() => {});
      }

      await base44.entities.Insight.create({
        title: 'Conversion Funnel Analysis',
        description: JSON.stringify({ metrics, biggestOpportunity: biggestGap?.stage, recommendation: biggestGap ? recommendations[biggestGap.stage] : 'Funnel is healthy' }),
      }).catch(() => {});

      return Response.json({ metrics, gaps, biggestOpportunity: biggestGap, recommendations });
    }

    // === MONITOR CARRIER PERFORMANCE ===
    if (action === 'monitor_carrier_performance') {
      const { carriers } = data || {};
      // carriers = [{ name, onTimeRate, damageRate, wismoRate, avgDays }]

      const thresholds = { onTimeRate: 0.95, damageRate: 0.005, wismoRate: 0.02 };
      const results = [];

      for (const carrier of (carriers || [])) {
        const issues = [];
        if (carrier.onTimeRate < thresholds.onTimeRate) issues.push(`On-time rate ${(carrier.onTimeRate*100).toFixed(1)}% below ${(thresholds.onTimeRate*100).toFixed(0)}% threshold`);
        if (carrier.damageRate > thresholds.damageRate) issues.push(`Damage rate ${(carrier.damageRate*100).toFixed(2)}% above ${(thresholds.damageRate*100).toFixed(2)}% threshold`);
        if (carrier.wismoRate > thresholds.wismoRate) issues.push(`WISMO rate ${(carrier.wismoRate*100).toFixed(1)}% above ${(thresholds.wismoRate*100).toFixed(0)}% threshold`);

        const score = Math.round(((carrier.onTimeRate / thresholds.onTimeRate) * 50) + ((1 - carrier.damageRate / thresholds.damageRate) * 25) + ((1 - carrier.wismoRate / thresholds.wismoRate) * 25));
        const recommendation = score >= 90 ? 'INCREASE routing share' : score >= 70 ? 'MAINTAIN current routing' : 'REDUCE routing — performance below threshold';

        results.push({ carrier: carrier.name, score, issues, recommendation });

        if (issues.length > 0) {
          await base44.entities.Notification.create({
            title: `🚚 Carrier Alert: ${carrier.name}`,
            message: `Performance issues detected. Score: ${score}/100. Issues: ${issues.join('; ')}. Atlas: adjust routing rules. Recommendation: ${recommendation}`,
            type: issues.length > 1 ? 'warning' : 'info',
            is_read: false,
          }).catch(() => {});
        }

        await base44.entities.Metric.create({
          name: `Carrier_${carrier.name}_Score`,
          value: score,
          period: 'monthly',
          description: `${carrier.name} performance: on-time ${(carrier.onTimeRate*100).toFixed(1)}%, damage ${(carrier.damageRate*100).toFixed(2)}%, WISMO ${(carrier.wismoRate*100).toFixed(1)}%`,
        }).catch(() => {});
      }

      return Response.json({ carriers: results, summary: `${results.filter(r => r.score >= 90).length} carriers healthy, ${results.filter(r => r.score < 70).length} carriers need attention` });
    }

    // === FLAG HIGH RETURN PRODUCTS ===
    if (action === 'flag_high_return_products') {
      const { products } = data || {};
      // products = [{ name, productId, unitsSold, returns, topReturnReason }]

      const flagged = [];
      for (const product of (products || [])) {
        const returnRate = product.returns / product.unitsSold;
        if (returnRate > 0.08) {
          const severity = returnRate > 0.20 ? 'critical' : returnRate > 0.15 ? 'high' : 'medium';
          flagged.push({ ...product, returnRate: (returnRate*100).toFixed(1)+'%', severity });

          const remediation = {
            'sizing': 'Add size guide, size chart overlay, "True to size?" tooltip',
            'quality': 'QA hold review via Inspect/Sentinel, supplier conversation',
            'description_mismatch': 'Improve product copy and images via Canvas/Merchant',
            'shipping_damage': 'Review packaging and carrier — alert Atlas',
            'changed_mind': 'Review return window, add 360° images/video to reduce uncertainty',
          };

          const fix = remediation[product.topReturnReason?.toLowerCase().replace(' ', '_')] || 'Review product page, images, and description';

          await base44.entities.Notification.create({
            title: `↩️ High Return Rate: ${product.name} — ${(returnRate*100).toFixed(1)}%`,
            message: `${product.name} has ${(returnRate*100).toFixed(1)}% return rate (${product.returns}/${product.unitsSold} units). Reason: "${product.topReturnReason}". Fix: ${fix}. Merchant: update product page. Inspect: monitor next 30 days.`,
            type: severity === 'critical' ? 'warning' : 'info',
            is_read: false,
          }).catch(() => {});

          await base44.entities.Insight.create({
            title: `High Return Rate: ${product.name}`,
            description: `Return rate: ${(returnRate*100).toFixed(1)}%. Top reason: ${product.topReturnReason}. Recommended fix: ${fix}`,
          }).catch(() => {});
        }
      }

      return Response.json({ flaggedProducts: flagged, count: flagged.length, totalProducts: products?.length });
    }

    // === CUSTOMER RETENTION SCAN ===
    if (action === 'customer_retention_scan') {
      const { customers } = data || {};
      // customers = [{ id, email, name, lastPurchaseDays, totalOrders, ltv, lastProduct }]

      const atRisk = [];
      const winBack = [];
      const lost = [];

      for (const customer of (customers || [])) {
        if (customer.lastPurchaseDays > 180) {
          lost.push(customer);
        } else if (customer.lastPurchaseDays > 90) {
          atRisk.push(customer);
        }
      }

      const notifications = [];

      if (atRisk.length > 0) {
        notifications.push(base44.entities.Notification.create({
          title: `⚠️ ${atRisk.length} At-Risk Customers (90+ days inactive)`,
          message: `Maestro: Launch win-back campaign for ${atRisk.length} customers inactive 90-180 days. Suggested: personalized email with new products since their last purchase + 15% loyalty discount. Top LTV customers: ${atRisk.sort((a,b) => b.ltv - a.ltv).slice(0,3).map(c => c.name).join(', ')}`,
          type: 'warning',
          is_read: false,
        }).catch(() => {}));
      }

      if (lost.length > 0) {
        notifications.push(base44.entities.Notification.create({
          title: `💔 ${lost.length} Lost Customers (180+ days inactive)`,
          message: `Maestro: Launch aggressive win-back campaign for ${lost.length} customers inactive 180+ days. Suggested: 25% offer + 'We've changed' messaging. If no response after 2 emails, move to annual re-engagement only.`,
          type: 'info',
          is_read: false,
        }).catch(() => {}));
      }

      await Promise.all(notifications);

      return Response.json({ atRisk: atRisk.length, lost: lost.length, healthy: customers?.length - atRisk.length - lost.length, winBackTriggered: atRisk.length + lost.length > 0 });
    }

    // === POST-PURCHASE TRIGGER ===
    if (action === 'post_purchase_trigger') {
      const { orderId, customerEmail, customerName, productName, deliveryDate, productCategory } = data || {};

      const delivery = deliveryDate ? new Date(deliveryDate) : new Date();
      const day1 = new Date(delivery.getTime() + 1 * 24 * 60 * 60 * 1000);
      const day7 = new Date(delivery.getTime() + 7 * 24 * 60 * 60 * 1000);
      const day14 = new Date(delivery.getTime() + 14 * 24 * 60 * 60 * 1000);
      const day30 = new Date(delivery.getTime() + 30 * 24 * 60 * 60 * 1000);

      const tasks = await Promise.all([
        base44.entities.Task.create({
          title: `Post-purchase D+1: How-to guide for ${customerEmail}`,
          description: `Send "${productName} — how to get the most out of it" email. Canvas: generate how-to visual for ${productCategory}. Include care instructions and pro tips.`,
          priority: 'medium', status: 'pending', due_date: day1.toISOString().split('T')[0],
          source: 'agent', tags: ['post-purchase', 'email', 'how-to'],
        }).catch(() => {}),
        base44.entities.Task.create({
          title: `Post-purchase D+7: Review request for ${customerEmail}`,
          description: `Ask ${customerName} to review ${productName}. If they click 4-5★: redirect to public review page. If 1-3★: flag to Support Sage for proactive resolution before negative review posts.`,
          priority: 'medium', status: 'pending', due_date: day7.toISOString().split('T')[0],
          source: 'agent', tags: ['post-purchase', 'review', 'csat'],
        }).catch(() => {}),
        base44.entities.Task.create({
          title: `Post-purchase D+14: Cross-sell for ${customerEmail}`,
          description: `Send cross-sell email for ${customerName} who bought ${productName}. Merchant: identify top 3 complementary products in ${productCategory}. Canvas: generate 'Complete the look' visual.`,
          priority: 'low', status: 'pending', due_date: day14.toISOString().split('T')[0],
          source: 'agent', tags: ['post-purchase', 'cross-sell', 'upsell'],
        }).catch(() => {}),
        base44.entities.Task.create({
          title: `Post-purchase D+30: Loyalty offer for ${customerEmail}`,
          description: `Send loyalty offer to ${customerName}. Check their tier (Bronze/Silver/Gold) and send tier-appropriate offer. If Gold: early access to new product. If Silver: free shipping code. If Bronze: 5% off next order.`,
          priority: 'low', status: 'pending', due_date: day30.toISOString().split('T')[0],
          source: 'agent', tags: ['post-purchase', 'loyalty', 'retention'],
        }).catch(() => {}),
      ]);

      await base44.entities.Activity.create({
        type: 'retention',
        title: `Post-purchase sequence triggered: ${customerEmail}`,
        description: `Order ${orderId} | Product: ${productName} | 4 touchpoints scheduled over 30 days`,
      }).catch(() => {});

      return Response.json({ success: true, orderId, tasksCreated: tasks.filter(Boolean).length, sequence: ['D+1: How-to', 'D+7: Review request', 'D+14: Cross-sell', 'D+30: Loyalty offer'] });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});