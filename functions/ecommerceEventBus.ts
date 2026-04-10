import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * E-commerce Event Bus
 * Handles cross-agent coordination for the online shop.
 *
 * Events:
 * - order.placed       → Atlas (fulfillment task), Centsible (revenue), Support Sage (customer)
 * - order.shipped      → Merchant (status update), Support Sage (notify customer)
 * - order.returned     → Atlas (inventory task), Sage (quality log), Merchant (refund)
 * - inventory.low      → Atlas (reorder task), Notification alert
 * - price.changed      → Maestro (update ad copy), Compass (log for trends)
 * - review.posted      → Support Sage (respond), Sage (sentiment), Sentinel (attack detection)
 * - order.fraud_flagged → Sentinel (analyze), Atlas (hold order)
 * - flash_sale.started → Atlas (warehouse alert), Support Sage (prep canned responses)
 * - product.launched   → Atlas (task checklist), Canvas (image request), Maestro (campaign)
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { event, data } = body;

    if (!event) return Response.json({ error: 'event is required' }, { status: 400 });

    const notifications = [];
    const tasks = [];
    const activities = [];

    // === ORDER PLACED ===
    if (event === 'order.placed') {
      const { orderId, productName, quantity, revenue, customerId, shipBy } = data || {};

      // Atlas: create fulfillment task
      tasks.push(base44.entities.Task.create({
        title: `Fulfill Order ${orderId} — ${productName} × ${quantity}`,
        description: `Ship by: ${shipBy || 'within 24 hours'}. Order value: $${revenue}. Customer: ${customerId}`,
        priority: 'high',
        status: 'pending',
        due_date: shipBy || new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        source: 'agent',
        tags: ['fulfillment', 'order'],
      }));

      // Centsible: revenue transaction
      activities.push(base44.entities.Transaction.create({
        date: new Date().toISOString().split('T')[0],
        description: `Order ${orderId} — ${productName} × ${quantity}`,
        amount: parseFloat(revenue) || 0,
        type: 'income',
        category: 'revenue',
        status: 'posted',
      }).catch(() => {}));

      // Activity log
      activities.push(base44.entities.Activity.create({
        type: 'sale',
        title: `Order Placed: ${productName} × ${quantity}`,
        description: `Order ${orderId} | Revenue: $${revenue} | Ship by: ${shipBy}`,
      }));

      await Promise.all([...tasks, ...notifications, ...activities]);
      return Response.json({ success: true, event, fulfillment_task_created: true });
    }

    // === ORDER SHIPPED ===
    if (event === 'order.shipped') {
      const { orderId, productName, trackingNumber, carrier, estimatedDelivery, customerEmail } = data || {};

      // Support Sage: notify customer
      notifications.push(base44.entities.Notification.create({
        title: `📦 Order ${orderId} Shipped`,
        message: `Support Sage: Notify customer ${customerEmail} — Order shipped via ${carrier}. Tracking: ${trackingNumber}. Est. delivery: ${estimatedDelivery}. Schedule satisfaction survey for delivery date.`,
        type: 'info',
        is_read: false,
      }));

      // Schedule post-delivery task
      tasks.push(base44.entities.Task.create({
        title: `Post-delivery: Send satisfaction survey for Order ${orderId}`,
        description: `Customer: ${customerEmail}. Order: ${productName}. Send CSAT survey on delivery date: ${estimatedDelivery}. If high rating → ask for review. If low → flag for follow-up.`,
        priority: 'low',
        status: 'pending',
        due_date: estimatedDelivery || new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        source: 'agent',
        tags: ['post-delivery', 'csat', 'support'],
      }));

      activities.push(base44.entities.Activity.create({
        type: 'fulfillment',
        title: `Order Shipped: ${orderId}`,
        description: `${productName} | ${carrier} | Tracking: ${trackingNumber} | ETA: ${estimatedDelivery}`,
      }));

      await Promise.all([...notifications, ...tasks, ...activities]);
      return Response.json({ success: true, event });
    }

    // === ORDER RETURNED ===
    if (event === 'order.returned') {
      const { orderId, productName, returnReason, refundAmount, customerId } = data || {};

      // Atlas: inventory task
      tasks.push(base44.entities.Task.create({
        title: `Return received: Inspect and restock ${productName} — Order ${orderId}`,
        description: `Return reason: ${returnReason}. Inspect item for resale eligibility. If good condition: add back to inventory. Refund amount: $${refundAmount}`,
        priority: 'medium',
        status: 'pending',
        due_date: new Date().toISOString().split('T')[0],
        source: 'agent',
        tags: ['return', 'inventory', 'quality'],
      }));

      // Centsible: refund transaction
      activities.push(base44.entities.Transaction.create({
        date: new Date().toISOString().split('T')[0],
        description: `Refund — Order ${orderId} — ${productName} — Reason: ${returnReason}`,
        amount: -(parseFloat(refundAmount) || 0),
        type: 'expense',
        category: 'refund',
        status: 'posted',
      }).catch(() => {}));

      // Sage: log return reason for quality analysis
      notifications.push(base44.entities.Notification.create({
        title: `↩️ Return: ${productName} — "${returnReason}"`,
        message: `Sage: Log return reason "${returnReason}" for product quality analysis. If this is the 3rd+ return for this reason, alert Inspect for QA hold. Merchant: process refund of $${refundAmount}.`,
        type: 'info',
        is_read: false,
      }));

      // Create insight for quality tracking
      activities.push(base44.entities.Insight.create({
        title: `Return: ${productName}`,
        description: `Return reason: "${returnReason}". Order: ${orderId}. Refund: $${refundAmount}. Track for quality pattern.`,
        type: 'quality',
      }).catch(() => {}));

      activities.push(base44.entities.Activity.create({
        type: 'return',
        title: `Order Returned: ${orderId}`,
        description: `${productName} | Reason: ${returnReason} | Refund: $${refundAmount}`,
      }));

      await Promise.all([...notifications, ...tasks, ...activities]);
      return Response.json({ success: true, event });
    }

    // === INVENTORY LOW ===
    if (event === 'inventory.low') {
      const { productName, currentStock, reorderPoint, reorderQuantity, supplierId, supplierName } = data || {};

      // Atlas: reorder task
      tasks.push(base44.entities.Task.create({
        title: `REORDER: ${productName} — ${reorderQuantity} units`,
        description: `Current stock: ${currentStock} units (below reorder point: ${reorderPoint}). Reorder ${reorderQuantity} units from ${supplierName || 'primary supplier'}${supplierId ? ` (ID: ${supplierId})` : ''}.`,
        priority: 'high',
        status: 'pending',
        due_date: new Date().toISOString().split('T')[0],
        source: 'agent',
        tags: ['reorder', 'inventory', 'urgent'],
      }));

      notifications.push(base44.entities.Notification.create({
        title: `⚠️ Low Stock: ${productName}`,
        message: `Only ${currentStock} units remaining (reorder point: ${reorderPoint}). Reorder task created for ${reorderQuantity} units from ${supplierName}. Atlas will coordinate with supplier.`,
        type: 'warning',
        is_read: false,
      }));

      activities.push(base44.entities.Activity.create({
        type: 'inventory',
        title: `Low Stock Alert: ${productName}`,
        description: `${currentStock} units remaining. Reorder ${reorderQuantity} from ${supplierName}.`,
      }));

      await Promise.all([...notifications, ...tasks, ...activities]);
      return Response.json({ success: true, event, reorder_task_created: true });
    }

    // === PRICE CHANGED ===
    if (event === 'price.changed') {
      const { productName, oldPrice, newPrice, reason, marginPercent } = data || {};
      const change = ((newPrice - oldPrice) / oldPrice * 100).toFixed(1);
      const direction = newPrice > oldPrice ? '↑' : '↓';

      // Maestro: update ad copy
      notifications.push(base44.entities.Notification.create({
        title: `💰 Price Change: ${productName} ${direction} ${Math.abs(change)}%`,
        message: `Maestro: Update all ad creatives and copy for ${productName}. New price: $${newPrice} (was $${oldPrice}). Reason: ${reason}. Ensure all active ads reflect new pricing immediately.`,
        type: 'info',
        is_read: false,
      }));

      activities.push(base44.entities.Activity.create({
        type: 'pricing',
        title: `Price Changed: ${productName}`,
        description: `$${oldPrice} → $${newPrice} (${change}%). Margin: ${marginPercent}%. Reason: ${reason}`,
      }));

      await Promise.all([...notifications, ...activities]);
      return Response.json({ success: true, event });
    }

    // === REVIEW POSTED ===
    if (event === 'review.posted') {
      const { productName, rating, reviewText, reviewerName, reviewerFollowers, platform } = data || {};
      const isNegative = rating <= 2;
      const isPositive = rating >= 4;

      // Support Sage: respond to review
      notifications.push(base44.entities.Notification.create({
        title: `${isNegative ? '🚨' : '⭐'} New Review: ${productName} — ${rating}/5 stars`,
        message: `Support Sage: ${isNegative
          ? `URGENT — Negative review (${rating}★) on ${platform}: "${reviewText?.slice(0, 100)}". Draft apologetic response and offer resolution.`
          : `Positive review (${rating}★) on ${platform}: "${reviewText?.slice(0, 100)}". Thank ${reviewerName} warmly. Ask for testimonial permission if 5★.`
        }`,
        type: isNegative ? 'warning' : 'info',
        is_read: false,
      }));

      // If influencer reviewer, alert Part
      if (reviewerFollowers > 5000) {
        notifications.push(base44.entities.Notification.create({
          title: `🌟 Reviewer has ${reviewerFollowers?.toLocaleString()} followers: ${reviewerName}`,
          message: `Part: ${reviewerName} (${reviewerFollowers?.toLocaleString()} followers) just reviewed ${productName} with ${rating}★. Evaluate for influencer partnership opportunity.`,
          type: 'info',
          is_read: false,
        }));
      }

      // If positive: share with Maestro as testimonial
      if (isPositive) {
        notifications.push(base44.entities.Notification.create({
          title: `✨ Testimonial opportunity: ${reviewerName}`,
          message: `Maestro: ${reviewerName} left a ${rating}★ review for ${productName}: "${reviewText?.slice(0, 150)}". Use as testimonial in marketing content if permission granted.`,
          type: 'info',
          is_read: false,
        }));
      }

      activities.push(base44.entities.Activity.create({
        type: 'review',
        title: `Review: ${productName} — ${rating}★`,
        description: `By ${reviewerName} on ${platform}: "${reviewText?.slice(0, 100)}"`,
      }));

      await Promise.all([...notifications, ...activities]);
      return Response.json({ success: true, event, negative: isNegative, positive: isPositive });
    }

    // === ORDER FRAUD FLAGGED ===
    if (event === 'order.fraud_flagged') {
      const { orderId, productName, orderValue, signals, riskScore, customerEmail } = data || {};

      // Create ThreatLog
      activities.push(base44.entities.ThreatLog.create({
        event: `Suspected fraud — Order ${orderId}`,
        source: 'financial',
        severity: riskScore >= 60 ? 'high' : 'medium',
        raw_data: JSON.stringify({ orderId, productName, orderValue, signals, customerEmail }),
        threat_score: riskScore,
        status: 'logged',
      }).catch(() => {}));

      // Hold order via Atlas
      tasks.push(base44.entities.Task.create({
        title: `FRAUD HOLD — Order ${orderId} — DO NOT FULFILL`,
        description: `Risk score: ${riskScore}/100. Signals: ${signals?.join(', ')}. Order value: $${orderValue}. Awaiting Sentinel clearance before fulfillment.`,
        priority: 'critical',
        status: 'pending',
        due_date: new Date().toISOString().split('T')[0],
        source: 'agent',
        tags: ['fraud', 'hold', 'sentinel'],
      }));

      notifications.push(base44.entities.Notification.create({
        title: `🚨 FRAUD ALERT — Order ${orderId} HELD`,
        message: `Risk score: ${riskScore}/100. Signals: ${signals?.join(', ')}. Order value: $${orderValue}. Sentinel: please analyze and clear or cancel. Atlas task created to hold fulfillment.`,
        type: 'warning',
        is_read: false,
      }));

      await Promise.all([...notifications, ...tasks, ...activities]);
      return Response.json({ success: true, event, order_held: true });
    }

    // === FLASH SALE STARTED ===
    if (event === 'flash_sale.started') {
      const { productName, originalPrice, salePrice, discountPercent, duration, channels } = data || {};

      // Atlas: warehouse volume alert
      notifications.push(base44.entities.Notification.create({
        title: `⚡ Flash Sale Live: ${productName}`,
        message: `Atlas: Flash sale started — ${discountPercent}% off ${productName} ($${salePrice} from $${originalPrice}). ${duration} duration on ${channels?.join(', ')}. Expect volume spike — prioritize fulfillment SLA.`,
        type: 'info',
        is_read: false,
      }));

      // Support Sage: prepare canned responses
      tasks.push(base44.entities.Task.create({
        title: `Flash sale support prep: ${productName}`,
        description: `Support Sage: Prepare canned responses for: (1) "Is the sale still on?" (2) "Can I get the sale price on my existing order?" (3) "When does the sale end?" (4) "Is [product] in stock?" Sale: ${discountPercent}% off ${productName} for ${duration}.`,
        priority: 'high',
        status: 'pending',
        due_date: new Date().toISOString().split('T')[0],
        source: 'agent',
        tags: ['flash-sale', 'support', 'prep'],
      }));

      activities.push(base44.entities.Activity.create({
        type: 'promotion',
        title: `Flash Sale Started: ${productName}`,
        description: `${discountPercent}% off | $${originalPrice} → $${salePrice} | ${duration} | ${channels?.join(', ')}`,
      }));

      await Promise.all([...notifications, ...tasks, ...activities]);
      return Response.json({ success: true, event });
    }

    // === PRODUCT LAUNCHED ===
    if (event === 'product.launched') {
      const { productName, productId, category, price, targetAudience, launchDate } = data || {};
      const launch = launchDate ? new Date(launchDate) : new Date();
      const minus3 = new Date(launch.getTime() - 3 * 24 * 60 * 60 * 1000);
      const minus1 = new Date(launch.getTime() - 1 * 24 * 60 * 60 * 1000);
      const plus7 = new Date(launch.getTime() + 7 * 24 * 60 * 60 * 1000);

      const launchTasks = [
        { title: `Canvas: Generate product images for ${productName}`, desc: `Create: lifestyle shot, packaging mockup, social media templates, email header, ad creative. Product: ${productName} (${category}), price: $${price}`, due: minus3, priority: 'high' },
        { title: `Maestro: Create launch campaign for ${productName}`, desc: `Build launch campaign. Target: ${targetAudience}. Channels: email, social, paid ads. Launch date: ${launchDate}. Include: teaser posts, launch day content, follow-up sequence.`, due: minus3, priority: 'high' },
        { title: `Support Sage: Brief on ${productName} FAQs`, desc: `Prepare support responses for: product specs, sizing/variants, delivery times, return policy, pricing questions for ${productName} at $${price}.`, due: minus1, priority: 'medium' },
        { title: `Veritas: Product compliance check for ${productName}`, desc: `Review: safety certifications needed, product liability exposure, listing compliance, labeling requirements for ${category} category.`, due: minus3, priority: 'medium' },
        { title: `Day 7 post-launch: Sage performance analysis for ${productName}`, desc: `Review: units sold, revenue, conversion rate, top traffic source, vs. launch KPIs. Recommend optimizations.`, due: plus7, priority: 'medium' },
      ];

      for (const t of launchTasks) {
        tasks.push(base44.entities.Task.create({
          title: t.title,
          description: t.desc,
          priority: t.priority,
          status: 'pending',
          due_date: t.due.toISOString().split('T')[0],
          project: `Launch: ${productName}`,
          source: 'agent',
          tags: ['product-launch', 'ecommerce'],
        }));
      }

      notifications.push(base44.entities.Notification.create({
        title: `🚀 Product Launch Initiated: ${productName}`,
        message: `${productName} launch checklist created. Tasks assigned to: Canvas (images), Maestro (campaign), Support Sage (FAQ prep), Veritas (compliance). Launch date: ${launchDate}.`,
        type: 'info',
        is_read: false,
      }));

      activities.push(base44.entities.Activity.create({
        type: 'product',
        title: `Product Launch: ${productName}`,
        description: `Category: ${category} | Price: $${price} | Target: ${targetAudience} | Launch: ${launchDate}`,
      }));

      await Promise.all([...notifications, ...tasks, ...activities]);
      return Response.json({ success: true, event, tasks_created: launchTasks.length });
    }

    return Response.json({ error: `Unknown event: ${event}` }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});