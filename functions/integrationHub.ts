import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Integration Hub — Handles calls to external platform integrations.
 * 
 * Actions (all simulate the integration layer described in the technical guide):
 * - track_customer_event      → Ingest frontend tracking events, update customer profile
 * - fetch_competitor_prices   → Pull competitor pricing intelligence (simulated), alert Sage/Merchant
 * - assess_shipping_options   → Get rate estimates for an order (EasyPost-style)
 * - create_shipment           → Generate a shipment + tracking number, trigger order.shipped
 * - sync_marketplace_product  → Sync product to Amazon/eBay format
 * - voice_query_handler       → Handle transcribed voice query, route to Support Sage
 * - demand_forecast           → Run demand forecast for a product SKU
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action, data } = body;

    if (!action) return Response.json({ error: 'action is required' }, { status: 400 });

    // === TRACK CUSTOMER EVENT (Sage real-time profiling) ===
    if (action === 'track_customer_event') {
      const { userId, userEmail, event, properties } = data || {};

      // Build intent signals from event type
      const intentSignals = [];
      let intentScore = 0;

      if (event === 'product_view') { intentScore += 10; intentSignals.push('product_interest'); }
      if (event === 'add_to_cart') { intentScore += 25; intentSignals.push('high_purchase_intent'); }
      if (event === 'checkout_start') { intentScore += 40; intentSignals.push('checkout_initiated'); }
      if (event === 'cart_abandon') { intentScore += 20; intentSignals.push('abandoned_cart'); }
      if (event === 'repeat_visit') { intentScore += 15; intentSignals.push('returning_visitor'); }
      if (event === 'video_watch') { intentScore += 12; intentSignals.push('content_engaged'); }

      // If user is known, update their Lead record with behavioral signals
      let leadUpdate = null;
      if (userEmail) {
        const leads = await base44.entities.Lead.filter({ email: userEmail }).catch(() => []);
        if (leads?.length > 0) {
          const lead = leads[0];
          const existingSignals = lead.intent_signals || [];
          const mergedSignals = [...new Set([...existingSignals, ...intentSignals])];
          const newScore = Math.min(100, (lead.intent_score || 0) + intentScore);

          leadUpdate = await base44.entities.Lead.update(lead.id, {
            intent_signals: mergedSignals,
            intent_score: newScore,
            engagement_score: Math.min(100, (lead.engagement_score || 0) + 5),
          }).catch(() => null);
        }
      }

      // High-intent events trigger Maestro
      if (event === 'cart_abandon' && userEmail) {
        await base44.entities.Notification.create({
          title: `🛒 Cart Abandoned: ${userEmail}`,
          message: `Maestro: ${userEmail} abandoned their cart on ${properties?.product_name || 'a product'}. Trigger 3-step cart recovery sequence immediately. Step 1: gentle reminder (no discount). Step 2 in 24h: social proof. Step 3 in 72h: 10% offer (check Centsible for margin floor).`,
          type: 'info',
          is_read: false,
        }).catch(() => {});
      }

      if (event === 'checkout_start' && userEmail) {
        await base44.entities.Notification.create({
          title: `⚡ High-Intent Visitor: ${userEmail}`,
          message: `${userEmail} has started checkout for ${properties?.product_name || 'a product'} ($${properties?.value || '?'}). Monitor for completion. If no order in 30 min, trigger immediate cart recovery.`,
          type: 'info',
          is_read: false,
        }).catch(() => {});
      }

      await base44.entities.Activity.create({
        type: 'tracking',
        title: `Customer Event: ${event}`,
        description: `User: ${userEmail || userId} | Event: ${event} | Intent signals: ${intentSignals.join(', ')} | Score delta: +${intentScore}`,
      }).catch(() => {});

      return Response.json({ success: true, event, intentScore, intentSignals, leadUpdated: !!leadUpdate });
    }

    // === FETCH COMPETITOR PRICES (Compass pricing intelligence) ===
    if (action === 'fetch_competitor_prices') {
      const { productSku, productName, ourPrice } = data || {};

      // Simulate competitor price data (in production: call Price2Spy/Prisync API)
      const variance = () => (Math.random() - 0.5) * 0.3;
      const competitors = [
        { name: 'Competitor A', price: parseFloat((ourPrice * (1 + variance())).toFixed(2)), inStock: true },
        { name: 'Competitor B', price: parseFloat((ourPrice * (1 + variance())).toFixed(2)), inStock: Math.random() > 0.3 },
        { name: 'Competitor C', price: parseFloat((ourPrice * (1 + variance())).toFixed(2)), inStock: Math.random() > 0.2 },
      ];

      const lowestCompetitorPrice = Math.min(...competitors.filter(c => c.inStock).map(c => c.price));
      const highestCompetitorPrice = Math.max(...competitors.filter(c => c.inStock).map(c => c.price));
      const outOfStockCompetitors = competitors.filter(c => !c.inStock).length;
      const marketAvg = competitors.filter(c => c.inStock).reduce((s, c) => s + c.price, 0) / competitors.filter(c => c.inStock).length;

      let pricingRecommendation = '';
      let alertType = 'info';

      if (outOfStockCompetitors >= 2) {
        pricingRecommendation = `${outOfStockCompetitors} competitors are out of stock. Consider increasing price by 5-8% to capture margin while demand is uncontested.`;
        alertType = 'info';
      } else if (lowestCompetitorPrice < ourPrice * 0.9) {
        pricingRecommendation = `Lowest competitor at $${lowestCompetitorPrice} (${Math.round((1 - lowestCompetitorPrice/ourPrice)*100)}% below us). Consider counter-strategy: bundle offer, emphasize quality/warranty, or minor price adjustment.`;
        alertType = 'warning';
      } else if (ourPrice < lowestCompetitorPrice) {
        pricingRecommendation = `We're the lowest priced. Opportunity to test a 5% price increase while remaining competitive.`;
        alertType = 'info';
      } else {
        pricingRecommendation = `Pricing is competitive. Market average: $${marketAvg.toFixed(2)}. Our price: $${ourPrice}. Hold or test small increase.`;
      }

      // Store as Trend/Insight for Sage
      await base44.entities.Insight.create({
        title: `Competitor Pricing: ${productName}`,
        description: `SKU: ${productSku} | Our price: $${ourPrice} | Market avg: $${marketAvg.toFixed(2)} | Range: $${lowestCompetitorPrice}-$${highestCompetitorPrice} | Out of stock competitors: ${outOfStockCompetitors}. ${pricingRecommendation}`,
      }).catch(() => {});

      await base44.entities.Notification.create({
        title: `💰 Competitor Price Update: ${productName}`,
        message: `Market avg: $${marketAvg.toFixed(2)} | Our price: $${ourPrice} | ${outOfStockCompetitors} competitors OOS. Sage + Merchant: ${pricingRecommendation}`,
        type: alertType,
        is_read: false,
      }).catch(() => {});

      return Response.json({ productSku, ourPrice, competitors, marketAvg: parseFloat(marketAvg.toFixed(2)), lowestCompetitorPrice, highestCompetitorPrice, outOfStockCompetitors, recommendation: pricingRecommendation });
    }

    // === ASSESS SHIPPING OPTIONS (EasyPost-style rate fetching) ===
    if (action === 'assess_shipping_options') {
      const { destinationZip, destinationCountry, weightLbs, orderValue } = data || {};

      // Simulated carrier rates (in production: call EasyPost API)
      const isInternational = destinationCountry && destinationCountry !== 'US';
      const baseRate = weightLbs * 0.8 + (isInternational ? 15 : 0);

      const rates = [
        { carrier: 'FedEx', service: isInternational ? 'FedEx International Priority' : 'FedEx Ground', price: parseFloat((baseRate * 1.4).toFixed(2)), estimatedDays: isInternational ? 5 : 3, onTimeRate: 0.97 },
        { carrier: 'UPS', service: isInternational ? 'UPS Worldwide Expedited' : 'UPS Ground', price: parseFloat((baseRate * 1.35).toFixed(2)), estimatedDays: isInternational ? 6 : 4, onTimeRate: 0.96 },
        { carrier: 'USPS', service: isInternational ? 'USPS First-Class International' : 'USPS Priority Mail', price: parseFloat((baseRate * 0.9).toFixed(2)), estimatedDays: isInternational ? 10 : 5, onTimeRate: 0.92 },
      ];

      // Recommended: best balance of cost, speed, and reliability
      const recommended = rates.sort((a, b) => (a.price / a.onTimeRate) - (b.price / b.onTimeRate))[0];

      // Flag if order is high-value — recommend signature required
      const requireSignature = orderValue > 500;

      return Response.json({ rates, recommended: { ...recommended, reason: `Best cost-reliability ratio for ${destinationCountry || 'domestic'} shipment` }, requireSignature, signatureReason: requireSignature ? `Order value $${orderValue} exceeds $500 — signature required to prevent fraud` : null });
    }

    // === CREATE SHIPMENT (generate tracking, trigger order.shipped) ===
    if (action === 'create_shipment') {
      const { orderId, productName, customerEmail, carrier, service, destinationAddress } = data || {};

      // Simulate shipment creation (in production: call EasyPost purchaseLabel)
      const trackingNumber = `${carrier?.substring(0,2).toUpperCase()}${Date.now().toString().slice(-10)}`;
      const labelUrl = `https://labels.example.com/${trackingNumber}.pdf`;
      const estimatedDelivery = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Update order activity
      await base44.entities.Activity.create({
        type: 'fulfillment',
        title: `Shipment Created: Order ${orderId}`,
        description: `Carrier: ${carrier} ${service} | Tracking: ${trackingNumber} | ETA: ${estimatedDelivery} | Customer: ${customerEmail}`,
      }).catch(() => {});

      // Trigger order.shipped notification (feeds into ecommerceEventBus flow)
      await base44.entities.Notification.create({
        title: `📦 Order ${orderId} Shipped`,
        message: `${productName} shipped via ${carrier}. Tracking: ${trackingNumber}. ETA: ${estimatedDelivery}. Support Sage: notify customer ${customerEmail}. Schedule CSAT survey for ${estimatedDelivery}.`,
        type: 'info',
        is_read: false,
      }).catch(() => {});

      return Response.json({ success: true, orderId, trackingNumber, carrier, service, labelUrl, estimatedDelivery, nextStep: 'ecommerceEventBus order.shipped event should be triggered with this tracking data' });
    }

    // === SYNC MARKETPLACE PRODUCT ===
    if (action === 'sync_marketplace_product') {
      const { productId, productName, price, description, sku, inventory, marketplace } = data || {};

      // Simulate marketplace sync (in production: call Amazon SP-API or eBay API)
      const marketplaceId = marketplace === 'amazon' ? `ASIN_${sku}_${Date.now().toString().slice(-6)}` : `EBAY_${sku}_${Date.now().toString().slice(-6)}`;

      // Log the sync
      await base44.entities.Activity.create({
        type: 'integration',
        title: `Marketplace Sync: ${productName} → ${marketplace}`,
        description: `Product: ${productName} (SKU: ${sku}) | Price: $${price} | Inventory: ${inventory} | Marketplace ID: ${marketplaceId}`,
      }).catch(() => {});

      await base44.entities.Notification.create({
        title: `✅ ${marketplace === 'amazon' ? 'Amazon' : 'eBay'} Sync: ${productName}`,
        message: `${productName} synced to ${marketplace}. ID: ${marketplaceId}. Inspect: monitor ${marketplace} listing performance — Buy Box win rate, ranking, review velocity. Veritas: confirm listing complies with ${marketplace} marketplace terms.`,
        type: 'info',
        is_read: false,
      }).catch(() => {});

      return Response.json({ success: true, productId, marketplace, marketplaceId, productName, price, sku, inventory, status: 'synced', note: 'In production, this calls Amazon SP-API CreateOrUpdateProductOffer or eBay Trading API AddItem' });
    }

    // === VOICE QUERY HANDLER (Twilio/VAPI voice support) ===
    if (action === 'voice_query_handler') {
      const { transcribedText, callerId, sessionId } = data || {};

      // Route to the right intent
      const text = (transcribedText || '').toLowerCase();
      let intent = 'general';
      let response = '';
      let agentAlert = '';

      if (text.includes('order') && (text.includes('status') || text.includes('where') || text.includes('track'))) {
        intent = 'order_status';
        response = 'I can check that for you right away. Could you confirm your order number or the email address you used when ordering?';
        agentAlert = `Support Sage: Voice call from ${callerId} asking about order status. Look up their order and prepare tracking update.`;
      } else if (text.includes('return') || text.includes('refund') || text.includes('exchange')) {
        intent = 'return_request';
        response = 'I can help you with a return or refund. I just need to verify your order details. What is your order number?';
        agentAlert = `Support Sage: Voice call from ${callerId} requesting a return/refund. Prepare return instructions and label.`;
      } else if (text.includes('cancel')) {
        intent = 'cancellation';
        response = 'I can help with your cancellation request. Please provide your order number and I will check if it can still be cancelled.';
        agentAlert = `Support Sage: URGENT — Voice call from ${callerId} wants to cancel an order. Check if the order has shipped yet.`;
      } else if (text.includes('complaint') || text.includes('unhappy') || text.includes('wrong') || text.includes('damaged')) {
        intent = 'complaint';
        response = 'I am so sorry to hear that. Your experience matters deeply to us. Let me connect you with a specialist who can resolve this right away.';
        agentAlert = `Support Sage: Voice call from ${callerId} — complaint/damage issue. Flag for priority human escalation.`;
      } else {
        intent = 'general';
        response = 'I am here to help with orders, returns, refunds, and product questions. What can I assist you with today?';
      }

      // Create ticket for the voice interaction
      const ticket = await base44.entities.Ticket.create({
        channel: 'phone',
        customer_email: `voice_${callerId}@phone.call`,
        customer_name: `Voice caller: ${callerId}`,
        subject: `Voice query: ${intent}`,
        message: transcribedText,
        intent: intent === 'return_request' ? 'refund' : intent === 'order_status' ? 'general' : intent === 'complaint' ? 'complaint' : 'general',
        priority: intent === 'complaint' || intent === 'cancellation' ? 'high' : 'medium',
        status: 'open',
        category: 'other',
        source_id: sessionId,
      }).catch(() => null);

      if (agentAlert) {
        await base44.entities.Notification.create({
          title: `📞 Voice Call: ${intent}`,
          message: agentAlert,
          type: intent === 'complaint' ? 'warning' : 'info',
          is_read: false,
        }).catch(() => {});
      }

      return Response.json({ intent, voiceResponse: response, ticketCreated: !!ticket, sessionId, escalateToHuman: intent === 'complaint' });
    }

    // === DEMAND FORECAST ===
    if (action === 'demand_forecast') {
      const { productId, productName, historicalSales, forecastDays, currentInventory, leadTimeDays } = data || {};
      // historicalSales: array of {date, units} for the last N days

      const sales = historicalSales || [];
      const avgDailySales = sales.length > 0 ? sales.reduce((s, d) => s + (d.units || 0), 0) / sales.length : 5;

      // Simple trend: compare last 7 days vs previous 7 days
      const recent = sales.slice(-7).reduce((s, d) => s + (d.units || 0), 0) / Math.min(7, sales.slice(-7).length);
      const prior = sales.slice(-14, -7).reduce((s, d) => s + (d.units || 0), 0) / Math.min(7, sales.slice(-14, -7).length);
      const trendMultiplier = prior > 0 ? recent / prior : 1;

      const forecastedDailyDemand = avgDailySales * trendMultiplier;
      const totalForecastedDemand = Math.round(forecastedDailyDemand * (forecastDays || 30));

      // Safety stock: 1.5× average daily × lead time
      const safetyStock = Math.round(avgDailySales * 1.5 * (leadTimeDays || 7));
      const reorderPoint = Math.round(forecastedDailyDemand * (leadTimeDays || 7) + safetyStock);
      const reorderQuantity = Math.round(totalForecastedDemand * 1.2); // 20% buffer

      const daysOfStockRemaining = currentInventory ? Math.floor(currentInventory / forecastedDailyDemand) : null;
      const stockoutRisk = daysOfStockRemaining !== null && daysOfStockRemaining < (leadTimeDays || 7) * 1.5;

      if (stockoutRisk) {
        await base44.entities.Notification.create({
          title: `⚠️ Stockout Risk: ${productName}`,
          message: `${productName} has ${daysOfStockRemaining} days of stock at forecasted demand of ${forecastedDailyDemand.toFixed(1)} units/day. Lead time: ${leadTimeDays} days. REORDER NOW: ${reorderQuantity} units. Atlas: create urgent reorder task.`,
          type: 'warning',
          is_read: false,
        }).catch(() => {});
      }

      await base44.entities.Insight.create({
        title: `Demand Forecast: ${productName}`,
        description: `Avg daily demand: ${avgDailySales.toFixed(1)} units | Trend: ${trendMultiplier > 1 ? '+' : ''}${((trendMultiplier-1)*100).toFixed(1)}% | ${forecastDays}-day forecast: ${totalForecastedDemand} units | Reorder point: ${reorderPoint} units | Safety stock: ${safetyStock} units`,
      }).catch(() => {});

      return Response.json({ productId, productName, avgDailySales: parseFloat(avgDailySales.toFixed(2)), forecastedDailyDemand: parseFloat(forecastedDailyDemand.toFixed(2)), trendMultiplier: parseFloat(trendMultiplier.toFixed(3)), totalForecastedDemand, reorderPoint, safetyStock, reorderQuantity, daysOfStockRemaining, stockoutRisk, forecastDays: forecastDays || 30 });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});