import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { campaign_id, current_sentiment_score, previous_sentiment_score, topic, platforms_affected } = payload;

    // Define sentiment thresholds
    const CRITICAL_THRESHOLD = 40; // Below this = critical alert
    const HIGH_THRESHOLD = 50;     // Below this = high alert
    const DROP_THRESHOLD = 20;     // Point drop triggers action

    const sentiment_drop = previous_sentiment_score - current_sentiment_score;
    const shift_severity = current_sentiment_score < CRITICAL_THRESHOLD ? 'critical' 
                          : current_sentiment_score < HIGH_THRESHOLD ? 'high' 
                          : 'medium';

    // If sentiment drop is significant, take action
    if (sentiment_drop >= DROP_THRESHOLD || current_sentiment_score < HIGH_THRESHOLD) {
      
      // Step 1: Fetch the campaign
      const campaign = await base44.entities.Campaign.read(campaign_id);

      // Step 2: Create CampaignSentimentAlert
      const alert = await base44.entities.CampaignSentimentAlert.create({
        campaign_id,
        topic,
        sentiment_shift: current_sentiment_score < previous_sentiment_score ? 'positive_to_negative' : 'neutral_to_negative',
        sentiment_before: previous_sentiment_score,
        sentiment_after: current_sentiment_score,
        platforms_affected: platforms_affected || [],
        root_cause: 'Detected negative sentiment shift',
        urgency: shift_severity,
        status: 'active'
      });

      // Step 3: Auto-pause campaign if critical
      if (shift_severity === 'critical') {
        await base44.asServiceRole.entities.Campaign.update(campaign_id, {
          status: 'paused',
          paused_reason: `Sentiment dropped to ${current_sentiment_score} on ${topic}`
        });
      }

      // Step 4: Create Notification for Support Sage + Maestro
      await base44.asServiceRole.entities.Notification.create({
        type: 'campaign_sentiment_alert',
        title: `⚠️ Sentiment Alert: Campaign "${campaign.name}"`,
        message: `Sentiment dropped from ${previous_sentiment_score} to ${current_sentiment_score} on topic: ${topic}. ${shift_severity === 'critical' ? 'Campaign paused.' : 'Monitoring.'}`,
        priority: shift_severity === 'critical' ? 'critical' : 'high',
        action_url: `/Campaigns?id=${campaign_id}`,
        recipient_role: 'admin'
      });

      // Step 5: Recommend alternative creative (trigger Canvas)
      if (shift_severity === 'critical' || shift_severity === 'high') {
        const alternativeResponse = await base44.asServiceRole.functions.invoke('generateAlternativeCreative', {
          campaign_id,
          topic,
          feedback: 'Negative sentiment detected - generate alternative creative avoiding triggering elements'
        });

        if (alternativeResponse.data?.asset_ids) {
          await base44.asServiceRole.entities.CampaignSentimentAlert.update(alert.id, {
            alternative_creative_ids: alternativeResponse.data.asset_ids,
            action_taken: 'creative_swapped'
          });
        }
      }

      // Step 6: Create Activity log
      await base44.asServiceRole.entities.Activity.create({
        type: 'campaign_alert',
        title: `Sentiment Alert: ${topic}`,
        description: `Campaign ${campaign.name} sentiment dropped ${sentiment_drop} points`,
        entity_type: 'Campaign',
        entity_id: campaign_id
      });

      return Response.json({
        status: 'alert_triggered',
        severity: shift_severity,
        alert_id: alert.id,
        action_taken: shift_severity === 'critical' ? 'campaign_paused' : 'alert_created',
        sentiment_drop,
        platforms: platforms_affected
      });
    }

    return Response.json({
      status: 'sentiment_stable',
      current_score: current_sentiment_score,
      trend: sentiment_drop > 0 ? 'improving' : 'stable'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});