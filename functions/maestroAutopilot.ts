import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Maestro Autopilot — Autonomous campaign scanning, content scheduling, trend exploitation, and performance analysis
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action, campaignId, brief, platforms, budget, audience } = body;

    if (action === 'morning_scan') {
      // Full autonomous morning intelligence scan
      const [campaigns, trends, posts, assets, financials] = await Promise.all([
        base44.entities.Campaign.list('-updated_date', 50),
        base44.entities.Trend.list('-created_date', 20),
        base44.entities.SocialPost.list('-created_date', 50),
        base44.entities.ContentAsset.list('-created_date', 30),
        base44.entities.FinancialSnapshot.list('-created_date', 1),
      ]);

      const activeCampaigns = campaigns.filter(c => c.status === 'active');
      const draftCampaigns = campaigns.filter(c => c.status === 'draft');
      const scheduledPosts = posts.filter(p => p.status === 'scheduled');
      const publishedPosts = posts.filter(p => p.status === 'published');
      const recentTrends = trends.filter(t => {
        const created = new Date(t.created_date);
        const daysDiff = (Date.now() - created.getTime()) / (1000 * 60 * 60 * 24);
        return daysDiff <= 7;
      });

      // Check for campaigns over budget or underperforming
      const alerts = [];
      for (const campaign of activeCampaigns) {
        if (campaign.budget && campaign.budget_spent) {
          const spendPercent = (campaign.budget_spent / campaign.budget) * 100;
          if (spendPercent > 85) {
            alerts.push({ type: 'budget_alert', campaign: campaign.name, percent: Math.round(spendPercent) });
          }
        }
      }

      // Create an Insight record with the scan results
      const scanSummary = {
        active_campaigns: activeCampaigns.length,
        draft_campaigns: draftCampaigns.length,
        scheduled_posts: scheduledPosts.length,
        published_posts: publishedPosts.length,
        trending_topics: recentTrends.length,
        alerts: alerts,
        assets_in_library: assets.length,
        scan_time: new Date().toISOString(),
      };

      await base44.entities.Insight.create({
        type: 'marketing',
        title: 'Maestro Morning Scan',
        content: JSON.stringify(scanSummary),
        status: 'active',
        source: 'maestro_agent',
      });

      // Create notification if there are alerts
      if (alerts.length > 0) {
        await base44.entities.Notification.create({
          title: '⚠️ Maestro Alert',
          message: `${alerts.length} campaign alert(s) detected. Check Maestro for details.`,
          type: 'warning',
          is_read: false,
        });
      }

      return Response.json({ success: true, scan: scanSummary });
    }

    if (action === 'auto_schedule_posts') {
      // Auto-schedule draft posts with optimal timing
      const draftPosts = await base44.entities.SocialPost.filter({ status: 'draft' }, '-created_date', 30);
      
      const optimalTimes = {
        instagram: ['09:00', '12:00', '18:00'],
        linkedin: ['08:00', '12:00', '17:00'],
        facebook: ['09:00', '13:00', '16:00'],
        twitter: ['08:00', '12:00', '17:00', '21:00'],
        tiktok: ['07:00', '19:00', '21:00'],
      };

      let scheduledCount = 0;
      const now = new Date();

      for (const post of draftPosts) {
        if (!post.scheduled_time && post.platform) {
          const times = optimalTimes[post.platform] || ['12:00'];
          const timeStr = times[scheduledCount % times.length];
          const [hours, mins] = timeStr.split(':').map(Number);
          
          // Schedule starting tomorrow, spread across days
          const scheduleDate = new Date(now);
          scheduleDate.setDate(scheduleDate.getDate() + 1 + Math.floor(scheduledCount / 3));
          scheduleDate.setHours(hours, mins, 0, 0);

          await base44.entities.SocialPost.update(post.id, {
            status: 'scheduled',
            scheduled_time: scheduleDate.toISOString(),
          });
          scheduledCount++;
        }
      }

      await base44.entities.Activity.create({
        type: 'automation',
        title: 'Maestro Auto-Scheduled Posts',
        description: `Maestro autonomously scheduled ${scheduledCount} posts at optimal times`,
      });

      return Response.json({ success: true, scheduled: scheduledCount });
    }

    if (action === 'generate_campaign_assets') {
      // Generate full content plan for a campaign
      if (!campaignId) return Response.json({ error: 'campaignId required' }, { status: 400 });
      
      const campaign = await base44.entities.Campaign.filter({ id: campaignId });
      if (!campaign.length) return Response.json({ error: 'Campaign not found' }, { status: 404 });
      
      const c = campaign[0];
      const channels = c.channels || ['instagram', 'linkedin', 'email'];
      const assets = [];

      // Generate content plan for each channel
      for (const channel of channels) {
        const contentTemplates = {
          instagram: [
            { type: 'full_post', content: `🎯 [${c.name}] Instagram post — hook + value + CTA. Write for visual-first audience. Include 20 relevant hashtags.` },
            { type: 'subject_line', content: `Story CTA for ${c.name} campaign. Swipe-up prompt.` },
          ],
          linkedin: [
            { type: 'full_post', content: `Professional LinkedIn post for ${c.name}. Thought leadership angle. 3-5 short paragraphs. 3-5 hashtags.` },
            { type: 'headline', content: `LinkedIn article headline for ${c.name} campaign topic.` },
          ],
          email: [
            { type: 'subject_line', content: `Email subject line for ${c.name}. 5 variants: curiosity, urgency, benefit, question, personalized.` },
            { type: 'copy', content: `Email body for ${c.name}. Problem → Solution → CTA structure.` },
          ],
          facebook: [
            { type: 'full_post', content: `Facebook post for ${c.name}. Community-friendly, shareable, includes a question to drive comments.` },
          ],
          tiktok: [
            { type: 'copy', content: `TikTok video script for ${c.name}. 30-60 seconds. Hook in first 3 seconds. Trending audio suggestion.` },
          ],
          twitter: [
            { type: 'full_post', content: `Twitter/X thread for ${c.name}. 5-tweet thread. First tweet is the hook. Thread tells a complete story.` },
          ],
        };

        const channelTemplates = contentTemplates[channel] || [];
        for (const template of channelTemplates) {
          const asset = await base44.entities.CampaignAsset.create({
            campaign_id: campaignId,
            channel,
            type: template.type,
            content: template.content,
            status: 'draft',
          });
          assets.push(asset);
        }
      }

      // Update campaign to active if it was draft
      if (c.status === 'draft') {
        await base44.entities.Campaign.update(campaignId, { status: 'active' });
      }

      await base44.entities.Activity.create({
        type: 'campaign',
        title: `Campaign Assets Generated: ${c.name}`,
        description: `Maestro generated ${assets.length} content assets across ${channels.length} channels`,
      });

      await base44.entities.Notification.create({
        title: '🎯 Campaign Assets Ready',
        message: `${assets.length} assets generated for "${c.name}" across ${channels.join(', ')}. Ready for Canvas to add visuals.`,
        type: 'info',
        is_read: false,
      });

      return Response.json({ success: true, assets_created: assets.length, campaign: c.name });
    }

    if (action === 'performance_analysis') {
      // Analyze all active campaign performance
      const [campaigns, posts] = await Promise.all([
        base44.entities.Campaign.filter({ status: 'active' }, '-updated_date', 20),
        base44.entities.SocialPost.filter({ status: 'published' }, '-created_date', 100),
      ]);

      const analysis = campaigns.map(campaign => {
        const campaignPosts = posts.filter(p => p.campaign_id === campaign.id);
        const avgScore = campaignPosts.filter(p => p.ai_score).length
          ? Math.round(campaignPosts.reduce((s, p) => s + (p.ai_score || 0), 0) / campaignPosts.filter(p => p.ai_score).length)
          : null;
        
        const budgetPercent = campaign.budget ? Math.round((campaign.budget_spent || 0) / campaign.budget * 100) : null;
        const status = budgetPercent > 90 ? 'critical' : budgetPercent > 70 ? 'warning' : 'healthy';

        return {
          id: campaign.id,
          name: campaign.name,
          status,
          posts_published: campaignPosts.length,
          avg_score: avgScore,
          budget_percent_used: budgetPercent,
          channels: campaign.channels,
        };
      });

      // Auto-pause campaigns over budget
      for (const a of analysis) {
        if (a.status === 'critical') {
          await base44.entities.Campaign.update(a.id, { status: 'paused' });
          await base44.entities.Notification.create({
            title: '⏸️ Campaign Auto-Paused',
            message: `"${a.name}" was auto-paused — budget ${a.budget_percent_used}% consumed. Review and resume when ready.`,
            type: 'warning',
            is_read: false,
          });
        }
      }

      return Response.json({ success: true, analysis });
    }

    if (action === 'exploit_trend') {
      // Create reactive content for a trending topic
      const { trendId, trendTopic } = body;
      
      const contentDrafts = [];
      const platforms = ['instagram', 'linkedin', 'twitter'];
      
      for (const platform of platforms) {
        const post = await base44.entities.SocialPost.create({
          platform,
          content: `[TREND REACTIVE CONTENT] Topic: ${trendTopic}. Write a ${platform}-native post that capitalizes on this trend while staying on-brand. Be timely and authentic.`,
          status: 'draft',
          type: 'trend_reactive',
        });
        contentDrafts.push(post);
      }

      await base44.entities.Notification.create({
        title: '📈 Trend Opportunity Captured',
        message: `Reactive content drafted for "${trendTopic}" across ${platforms.length} platforms. Review and approve to publish.`,
        type: 'info',
        is_read: false,
      });

      return Response.json({ success: true, drafts_created: contentDrafts.length, trend: trendTopic });
    }

    if (action === 'ab_test_report') {
      // Generate A/B test performance summary
      const assets = await base44.entities.CampaignAsset.filter({ status: 'published' }, '-created_date', 50);
      const variants = assets.filter(a => a.variant);
      
      const aVariants = variants.filter(v => v.variant === 'A');
      const bVariants = variants.filter(v => v.variant === 'B');

      const report = {
        total_tests: Math.min(aVariants.length, bVariants.length),
        a_variants: aVariants.length,
        b_variants: bVariants.length,
        recommendation: aVariants.length > 0 ? 'Review performance data and pause the lower-scoring variant within 7 days of launch.' : 'No A/B tests running. Maestro recommends creating variants for all hero assets.',
      };

      return Response.json({ success: true, report });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});