import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { ab_test_id, variant_a_metrics, variant_b_metrics } = payload;

    // Fetch ABTest
    const abTest = await base44.entities.ABTest.read(ab_test_id);

    // Calculate winner
    const a_engagement = (variant_a_metrics.engagement_rate || 0) * (variant_a_metrics.conversions || 1);
    const b_engagement = (variant_b_metrics.engagement_rate || 0) * (variant_b_metrics.conversions || 1);

    let winner = 'tie';
    let margin = 0;

    if (a_engagement > b_engagement * 1.1) { // 10% threshold
      winner = 'a';
      margin = ((a_engagement - b_engagement) / b_engagement) * 100;
    } else if (b_engagement > a_engagement * 1.1) {
      winner = 'b';
      margin = ((b_engagement - a_engagement) / a_engagement) * 100;
    }

    // Update ABTest with results
    await base44.asServiceRole.entities.ABTest.update(ab_test_id, {
      status: 'completed',
      winner,
      winner_margin_percent: margin,
      variant_a: {
        ...abTest.variant_a,
        ...variant_a_metrics
      },
      variant_b: {
        ...abTest.variant_b,
        ...variant_b_metrics
      }
    });

    if (winner === 'tie') {
      await base44.asServiceRole.entities.Notification.create({
        type: 'ab_test_completed',
        title: `🧪 A/B Test Complete: Tie`,
        message: `${abTest.test_name} - Both variants performed similarly. Use brand preference to decide.`,
        priority: 'low',
        action_url: `/ABTest?id=${ab_test_id}`,
        recipient_role: 'admin'
      });

      return Response.json({
        status: 'test_complete',
        result: 'tie',
        message: 'Both variants performed equally'
      });
    }

    // Determine winning content
    const winningContent = winner === 'a' ? abTest.variant_a.content : abTest.variant_b.content;

    // Create notification to apply winner
    await base44.asServiceRole.entities.Notification.create({
      type: 'apply_winning_variant',
      title: `🎯 A/B Test Winner: Variant ${winner.toUpperCase()}`,
      message: `${winningContent.substring(0, 80)}... outperformed by ${margin.toFixed(1)}%. Apply to future posts?`,
      priority: 'high',
      action_url: `/ABTest?id=${ab_test_id}`,
      recipient_role: 'admin'
    });

    // Log the result
    await base44.asServiceRole.entities.Activity.create({
      type: 'ab_test_completed',
      title: `A/B Test Winner: Variant ${winner.toUpperCase()}`,
      description: `${abTest.variable_being_tested} - ${margin.toFixed(1)}% margin`,
      entity_type: 'ABTest',
      entity_id: ab_test_id
    });

    // Create Insight
    await base44.asServiceRole.entities.Insight.create({
      type: 'ab_test_insight',
      title: `${abTest.test_name} - Winner: Variant ${winner.toUpperCase()}`,
      description: `${abTest.variable_being_tested} variant ${winner} won with ${margin.toFixed(1)}% improvement in engagement`,
      data: { test_id: ab_test_id, winner, margin, platform: abTest.platform },
      status: 'new'
    });

    return Response.json({
      status: 'winner_determined',
      winner,
      margin_percent: margin.toFixed(1),
      winning_variant: winningContent.substring(0, 100) + '...',
      recommendation: `Apply Variant ${winner.toUpperCase()} to future ${abTest.platform} posts`
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});