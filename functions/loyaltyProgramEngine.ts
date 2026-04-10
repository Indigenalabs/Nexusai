import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { action, customer_email, order_amount } = payload;

    // action: 'create_segment', 'assign_tier', 'trigger_retention'

    if (action === 'create_segment') {
      // Get all customers and segment by value/engagement
      const allOrders = await base44.asServiceRole.entities.Order.list();
      const customerStats = {};

      for (const order of allOrders) {
        if (!customerStats[order.customer_email]) {
          customerStats[order.customer_email] = {
            total_spent: 0,
            order_count: 0,
            last_order: order.created_date
          };
        }
        customerStats[order.customer_email].total_spent += order.total;
        customerStats[order.customer_email].order_count += 1;
      }

      // Create segments
      const vipSegment = await base44.asServiceRole.entities.CustomerSegment.create({
        segment_name: 'VIP Repeat Buyers',
        segment_type: 'value',
        criteria: {
          min_lifetime_value: 1000,
          purchase_frequency_min: 5
        },
        loyalty_program_tier: 'platinum',
        loyalty_benefits: [
          {
            benefit: 'Free shipping on all orders',
            free_shipping: true
          },
          {
            benefit: '20% discount',
            discount_percent: 20
          },
          {
            benefit: 'Early access to new products',
            exclusive_access: 'new_releases'
          }
        ],
        marketing_cadence: 'weekly'
      });

      const atRiskSegment = await base44.asServiceRole.entities.CustomerSegment.create({
        segment_name: 'At-Risk Churners',
        segment_type: 'lifecycle',
        criteria: {
          min_lifetime_value: 100,
          last_purchase_days_ago_max: 180
        },
        loyalty_program_tier: 'bronze',
        loyalty_benefits: [
          {
            benefit: 'Win-back discount',
            discount_percent: 25
          }
        ],
        marketing_cadence: 'monthly'
      });

      return Response.json({
        status: 'segments_created',
        segments: [
          { name: vipSegment.segment_name, id: vipSegment.id },
          { name: atRiskSegment.segment_name, id: atRiskSegment.id }
        ]
      });
    }

    if (action === 'assign_tier') {
      // Determine tier based on lifetime value
      const customerOrders = await base44.asServiceRole.entities.Order.list().then(
        orders => orders.filter(o => o.customer_email === customer_email)
      );

      const lifetimeValue = customerOrders.reduce((sum, o) => sum + o.total, 0);

      let tier = 'bronze';
      if (lifetimeValue >= 5000) tier = 'platinum';
      else if (lifetimeValue >= 2000) tier = 'gold';
      else if (lifetimeValue >= 500) tier = 'silver';

      // Assign benefits
      const benefits = {
        bronze: [{ benefit: '5% discount', discount_percent: 5 }],
        silver: [{ benefit: '10% discount', discount_percent: 10 }, { free_shipping: true }],
        gold: [{ benefit: '15% discount', discount_percent: 15 }, { free_shipping: true }, { exclusive_access: 'sales' }],
        platinum: [{ benefit: '20% discount', discount_percent: 20 }, { free_shipping: true }, { exclusive_access: 'new_releases' }]
      };

      await base44.asServiceRole.entities.Notification.create({
        type: 'loyalty_tier_assigned',
        title: `🏆 You're ${tier.charAt(0).toUpperCase() + tier.slice(1)} Tier!`,
        message: `Congratulations! You've reached ${tier} status. Enjoy ${benefits[tier][0].benefit}!`,
        priority: 'medium',
        recipient_role: 'admin'
      });

      return Response.json({
        status: 'tier_assigned',
        customer_email,
        tier,
        lifetime_value: lifetimeValue,
        benefits: benefits[tier]
      });
    }

    if (action === 'trigger_retention') {
      // Create win-back campaign for at-risk customers
      const atRiskSegment = await base44.asServiceRole.entities.CustomerSegment.list().then(
        segments => segments.find(s => s.segment_name === 'At-Risk Churners')
      );

      const campaign = await base44.asServiceRole.entities.Campaign.create({
        name: 'We Miss You - Win-Back Campaign',
        objective: 'Re-engage inactive customers',
        status: 'active',
        channels: ['email'],
        offer: '25% off your next purchase',
        target_segment: atRiskSegment?.id
      });

      return Response.json({
        status: 'retention_campaign_created',
        campaign_id: campaign.id,
        offer: '25% off',
        target_customers: 'inactive for 6+ months'
      });
    }

    return Response.json({ status: 'error', message: 'Unknown action' }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});