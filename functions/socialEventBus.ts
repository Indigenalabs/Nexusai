import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Social Media Event Bus
 * Handles cross-agent event coordination for the social media department.
 * 
 * Events:
 * - social.mention       → Alert Support Sage + Prospect + Part
 * - trend.detected       → Alert Maestro + Canvas + Atlas
 * - campaign.launched    → Alert Atlas (tasks) + Canvas (assets check) + Scribe (documentation)
 * - influencer.identified → Alert Part + Prospect
 * - sentiment.shift      → Alert Maestro (pause ads?) + Support Sage + Sentinel
 * - content.published    → Alert Scribe (repurpose trigger) + Compass (performance tracking)
 * - lead.social_captured → Alert Prospect + Maestro (nurture campaign)
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
    const activities = [];
    const tasks = [];

    // === EVENT: TREND DETECTED ===
    if (event === 'trend.detected') {
      const { topic, platform, relevanceScore, windowHours, contentAngle } = data || {};

      // Create Trend record
      await base44.entities.Trend.create({
        title: topic,
        platform: platform || 'multiple',
        relevance_score: relevanceScore,
        status: 'active',
        description: `Trending on ${platform}. Relevance: ${relevanceScore}/10. Window: ${windowHours}h`,
      }).catch(() => {});

      // Alert Maestro (create content NOW)
      notifications.push(base44.entities.Notification.create({
        title: `📡 TREND ALERT — ${topic}`,
        message: `Trending on ${platform}. Relevance: ${relevanceScore}/10. ⏰ ${windowHours}h window. Suggested angle: ${contentAngle || 'Capitalize on this trend immediately'}. Create content now!`,
        type: relevanceScore >= 8 ? 'warning' : 'info',
        is_read: false,
      }));

      // Create urgent tasks via Atlas
      if (relevanceScore >= 7) {
        const now = new Date();
        const in2Hours = new Date(now.getTime() + 2 * 60 * 60 * 1000);
        const in4Hours = new Date(now.getTime() + 4 * 60 * 60 * 1000);

        tasks.push(base44.entities.Task.create({
          title: `[TREND] Maestro: Create content for "${topic}"`,
          description: `URGENT: Trending on ${platform}. ${windowHours}h window. Angle: ${contentAngle}`,
          priority: 'critical',
          status: 'pending',
          due_date: in2Hours.toISOString().split('T')[0],
          source: 'agent',
          tags: ['trend', 'urgent', 'social'],
        }));

        tasks.push(base44.entities.Task.create({
          title: `[TREND] Canvas: Generate visual for "${topic}"`,
          description: `URGENT: Create on-brand visual for trend: ${topic}. Platform: ${platform}.`,
          priority: 'critical',
          status: 'pending',
          due_date: in2Hours.toISOString().split('T')[0],
          source: 'agent',
          tags: ['trend', 'urgent', 'visual'],
        }));

        tasks.push(base44.entities.Task.create({
          title: `[TREND] Schedule + publish trend post for "${topic}"`,
          description: `Schedule the trend post. Optimal time within ${windowHours}h window.`,
          priority: 'high',
          status: 'pending',
          due_date: in4Hours.toISOString().split('T')[0],
          source: 'agent',
          tags: ['trend', 'scheduling'],
        }));
      }

      activities.push(base44.entities.Activity.create({
        type: 'intelligence',
        title: `Trend Detected: ${topic}`,
        description: `Relevance: ${relevanceScore}/10 | Platform: ${platform} | Window: ${windowHours}h`,
      }));

      await Promise.all([...notifications, ...tasks, ...activities]);
      return Response.json({ success: true, event, alerts_sent: notifications.length, tasks_created: tasks.length });
    }

    // === EVENT: CAMPAIGN LAUNCHED ===
    if (event === 'campaign.launched') {
      const { campaignId, campaignName, channels, startDate } = data || {};
      const start = startDate ? new Date(startDate) : new Date();

      const day3 = new Date(start.getTime() + 3 * 24 * 60 * 60 * 1000);
      const day7 = new Date(start.getTime() + 7 * 24 * 60 * 60 * 1000);
      const day14 = new Date(start.getTime() + 14 * 24 * 60 * 60 * 1000);

      // Atlas: create campaign tracking tasks
      const campaignTasks = [
        { title: `[${campaignName}] Day 1: Confirm all posts are live`, priority: 'high', date: start },
        { title: `[${campaignName}] Day 3: Early metrics review — is engagement on track?`, priority: 'high', date: day3 },
        { title: `[${campaignName}] Day 7: Full performance review — optimize or adjust`, priority: 'high', date: day7 },
        { title: `[${campaignName}] Day 14: Final analysis + Scribe documentation`, priority: 'medium', date: day14 },
      ];

      for (const t of campaignTasks) {
        tasks.push(base44.entities.Task.create({
          title: t.title,
          description: `Campaign: ${campaignName} (ID: ${campaignId}). Review performance and take action.`,
          priority: t.priority,
          status: 'pending',
          due_date: t.date.toISOString().split('T')[0],
          project: campaignName,
          source: 'agent',
          linked_client_id: campaignId,
          tags: ['campaign', 'social', 'review'],
        }));
      }

      // Scribe: document the campaign launch
      notifications.push(base44.entities.Notification.create({
        title: `🚀 Campaign Launched: ${campaignName}`,
        message: `Campaign "${campaignName}" is now live on ${channels?.join(', ') || 'all channels'}. Scribe: please document the campaign brief. Atlas: tracking tasks created.`,
        type: 'info',
        is_read: false,
      }));

      // Canvas: check for missing visual assets
      notifications.push(base44.entities.Notification.create({
        title: `🎨 Canvas: Verify assets for ${campaignName}`,
        message: `Campaign "${campaignName}" just launched. Please verify all visual assets are ready and high-quality for ${channels?.join(', ')}.`,
        type: 'info',
        is_read: false,
      }));

      activities.push(base44.entities.Activity.create({
        type: 'campaign',
        title: `Campaign Launched: ${campaignName}`,
        description: `Channels: ${channels?.join(', ')}. Atlas tracking tasks created. Scribe documentation queued.`,
      }));

      await Promise.all([...notifications, ...tasks, ...activities]);
      return Response.json({ success: true, event, tasks_created: campaignTasks.length });
    }

    // === EVENT: INFLUENCER IDENTIFIED ===
    if (event === 'influencer.identified') {
      const { handle, platform, followerCount, engagementRate, contentAngle, source } = data || {};

      // Create Partner record
      let partner;
      try {
        partner = await base44.entities.Partner.create({
          company_name: handle,
          type: 'influencer',
          status: 'prospect',
          contact_name: handle,
          website: `https://${platform}.com/${handle?.replace('@', '')}`,
          audience_size: followerCount,
          relationship_strength: 10,
          notes: `Identified via: ${source}. Platform: ${platform}. Engagement: ${engagementRate}%. Angle: ${contentAngle}`,
          opportunity_score: Math.min(100, Math.round((followerCount / 10000) * 5 + (parseFloat(engagementRate) || 3) * 10)),
        });
      } catch (e) {}

      // Alert Part agent
      notifications.push(base44.entities.Notification.create({
        title: `🌟 Influencer Spotted: ${handle}`,
        message: `${handle} on ${platform} has ${followerCount?.toLocaleString()} followers (${engagementRate}% engagement). Source: ${source}. Added to partner pipeline. Part: draft outreach message.`,
        type: 'info',
        is_read: false,
      }));

      // Alert Prospect if followers represent our ICP
      if (followerCount > 10000) {
        notifications.push(base44.entities.Notification.create({
          title: `🎯 Prospect: Influencer audience opportunity`,
          message: `${handle} (${followerCount?.toLocaleString()} followers) identified as potential influencer partner. Their audience may contain ICP leads. Evaluate for targeted campaign.`,
          type: 'info',
          is_read: false,
        }));
      }

      activities.push(base44.entities.Activity.create({
        type: 'partnership',
        title: `Influencer Identified: ${handle}`,
        description: `Platform: ${platform} | Followers: ${followerCount} | Engagement: ${engagementRate}%`,
      }));

      await Promise.all([...notifications, ...activities]);
      return Response.json({ success: true, event, partner_created: !!partner });
    }

    // === EVENT: SENTIMENT SHIFT ===
    if (event === 'sentiment.shift') {
      const { platform, postRef, positivePercent, negativePercent, theme, severity } = data || {};

      // Create ThreatLog for serious negative sentiment
      if (negativePercent > 30 || severity === 'critical') {
        await base44.entities.ThreatLog.create({
          event: `Negative sentiment spike on ${platform}`,
          source: 'social',
          severity: severity || (negativePercent > 50 ? 'high' : 'medium'),
          raw_data: JSON.stringify({ platform, positivePercent, negativePercent, theme, postRef }),
          threat_score: negativePercent,
          status: 'logged',
        }).catch(() => {});
      }

      // Alert Maestro to pause related ads
      notifications.push(base44.entities.Notification.create({
        title: `⚠️ SENTIMENT ALERT — ${platform}`,
        message: `Negative sentiment: ${negativePercent}% on ${platform}. Theme: "${theme}". Maestro: consider pausing related ad content. Support Sage: monitor comments.`,
        type: 'warning',
        is_read: false,
      }));

      // Alert Support Sage
      if (negativePercent > 40 || severity === 'critical') {
        tasks.push(base44.entities.Task.create({
          title: `URGENT: Respond to negative sentiment on ${platform}`,
          description: `Sentiment spike detected. ${negativePercent}% negative on "${theme}". Draft response and monitor comments/DMs.`,
          priority: 'critical',
          status: 'pending',
          due_date: new Date().toISOString().split('T')[0],
          source: 'agent',
          tags: ['crisis', 'social', 'urgent'],
        }));
      }

      activities.push(base44.entities.Activity.create({
        type: 'monitoring',
        title: `Sentiment Shift Detected`,
        description: `Platform: ${platform} | Negative: ${negativePercent}% | Theme: ${theme}`,
      }));

      await Promise.all([...notifications, ...tasks, ...activities]);
      return Response.json({ success: true, event, severity: severity || 'medium' });
    }

    // === EVENT: SOCIAL MENTION ===
    if (event === 'social.mention') {
      const { handle, platform, mentionText, sentiment, followerCount } = data || {};

      // Create Ticket for Support Sage
      const ticket = await base44.entities.Ticket.create({
        channel: 'social',
        customer_email: `${handle}@${platform}`,
        customer_name: handle,
        subject: `Social mention on ${platform}`,
        message: mentionText,
        sentiment: sentiment || 'neutral',
        priority: sentiment === 'negative' ? 'high' : 'medium',
        status: 'open',
        category: 'other',
      }).catch(() => null);

      // If positive and follower count suggests influencer potential
      if (sentiment === 'positive' && followerCount > 5000) {
        notifications.push(base44.entities.Notification.create({
          title: `💚 Positive Mention + Potential Lead: ${handle}`,
          message: `${handle} (${followerCount?.toLocaleString()} followers) mentioned us positively on ${platform}. Prospect: evaluate as lead. Part: check if influencer fit.`,
          type: 'info',
          is_read: false,
        }));
      }

      // If negative — urgent alert
      if (sentiment === 'negative') {
        notifications.push(base44.entities.Notification.create({
          title: `🚨 Negative Mention: ${handle} on ${platform}`,
          message: `"${mentionText?.slice(0, 100)}..." — Support Sage: respond within 1 hour. Maestro: monitor for escalation.`,
          type: 'warning',
          is_read: false,
        }));
      }

      activities.push(base44.entities.Activity.create({
        type: 'social',
        title: `Social Mention: ${handle} on ${platform}`,
        description: `Sentiment: ${sentiment} | "${mentionText?.slice(0, 100)}"`,
      }));

      await Promise.all([...notifications, ...activities]);
      return Response.json({ success: true, event, ticket_created: !!ticket });
    }

    // === EVENT: CONTENT PUBLISHED ===
    if (event === 'content.published') {
      const { contentId, contentType, contentTitle, documentId } = data || {};

      // Trigger Scribe repurposing workflow
      notifications.push(base44.entities.Notification.create({
        title: `📢 Scribe: Repurpose "${contentTitle}"`,
        message: `New ${contentType} published: "${contentTitle}". Extract key insights and create repurposing brief for Maestro: LinkedIn post, Twitter thread, Instagram carousel, TikTok script, email section.`,
        type: 'info',
        is_read: false,
      }));

      // Alert Maestro
      notifications.push(base44.entities.Notification.create({
        title: `✍️ Maestro: Content ready for repurposing`,
        message: `New ${contentType} "${contentTitle}" is published. Scribe is extracting angles. Standby for repurposing brief.`,
        type: 'info',
        is_read: false,
      }));

      // Create repurposing task
      tasks.push(base44.entities.Task.create({
        title: `Repurpose "${contentTitle}" across social platforms`,
        description: `Create: LinkedIn post, Twitter thread, Instagram carousel, TikTok script from the ${contentType}: "${contentTitle}".`,
        priority: 'medium',
        status: 'pending',
        due_date: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        source: 'agent',
        tags: ['repurposing', 'content', 'social'],
      }));

      activities.push(base44.entities.Activity.create({
        type: 'content',
        title: `Content Published: ${contentTitle}`,
        description: `Type: ${contentType}. Repurposing workflow triggered.`,
      }));

      await Promise.all([...notifications, ...tasks, ...activities]);
      return Response.json({ success: true, event, repurposing_triggered: true });
    }

    return Response.json({ error: `Unknown event: ${event}` }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});