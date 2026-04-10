import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Social Intelligence — Advanced social media automation function.
 *
 * Actions:
 * - analyze_trend_opportunity        → Score trend, brief Canvas + Maestro with visual aesthetic + content angle
 * - analyze_campaign_sentiment       → Per-campaign sentiment analysis, trigger Maestro/Canvas actions
 * - capture_interactive_content_lead → Capture and score leads from quiz/poll/video comment interactions
 * - generate_optimal_schedule        → Predict optimal posting schedule from historical data
 * - aggregate_cross_platform_metrics → Unify metrics across platforms for Sage analysis
 * - influencer_audience_analysis     → Score influencer audience quality for Prospect targeting
 * - repurpose_content                → Generate cross-platform repurposing plan for a piece of content
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action, data } = body;

    if (!action) return Response.json({ error: 'action is required' }, { status: 400 });

    // === ANALYZE TREND OPPORTUNITY ===
    if (action === 'analyze_trend_opportunity') {
      const { topic, platform, velocity, industryRelevance, brandVoice, audienceProfile } = data || {};

      // Score the trend
      const velocityScore = velocity === 'viral' ? 30 : velocity === 'fast' ? 20 : velocity === 'emerging' ? 10 : 5;
      const relevanceScore = (industryRelevance || 5) * 6; // 0-60
      const urgencyPenalty = velocity === 'viral' ? 0 : velocity === 'fast' ? -5 : -15; // slow trends lose points
      const totalScore = Math.min(100, velocityScore + relevanceScore + urgencyPenalty);

      const urgencyWindow = velocity === 'viral' ? '24 hours' : velocity === 'fast' ? '72 hours' : '7 days';
      const shouldAct = totalScore >= 65;

      // Generate content angle based on topic and brand voice
      const contentAngles = {
        professional: `Thought leadership take on "${topic}" — industry implications and what smart businesses should do`,
        playful: `Playful, brand-consistent spin on "${topic}" — participate in the cultural moment authentically`,
        educational: `Educational content about "${topic}" — what your audience needs to know and why it matters to them`,
        inspirational: `Aspirational content connecting "${topic}" to your brand values and customer journey`,
      };

      const recommendedAngle = contentAngles[brandVoice] || contentAngles.educational;

      // Visual aesthetic guidance for Canvas
      const visualGuides = {
        viral: 'Bold, high-contrast, meme-adjacent. Move fast — polish less. Authenticity wins over perfection for viral content.',
        fast: 'On-trend aesthetic matching the visual style currently dominating this trend. Check competitor implementations.',
        emerging: 'Set the visual standard — be the first to establish the aesthetic for this trend. More polish is OK since you have time.',
        slow: 'Take your time. Create a beautifully polished piece that will carry this trend forward.',
      };

      const visualBrief = visualGuides[velocity] || visualGuides.emerging;

      if (shouldAct) {
        // Create Trend record
        await base44.entities.Trend.create({
          name: topic,
          platform,
          status: 'active',
          relevance_score: Math.round(totalScore / 10),
          description: `Trend detected on ${platform}. Velocity: ${velocity}. Window: ${urgencyWindow}. Content angle: ${recommendedAngle}`,
        }).catch(() => {});

        // Alert Maestro + Canvas
        await base44.entities.Notification.create({
          title: `📡 ${totalScore >= 85 ? 'VIRAL' : 'TREND'} OPPORTUNITY: "${topic}" — ${urgencyWindow} window`,
          message: `Score: ${totalScore}/100 | Platform: ${platform} | Velocity: ${velocity}\n\nMaestro: ${recommendedAngle}\n\nCanvas: ${visualBrief}\n\nOptimal publish: ${velocity === 'viral' ? 'WITHIN 2 HOURS' : velocity === 'fast' ? 'Today, within 6 hours' : 'This week — schedule for peak engagement window'}`,
          type: totalScore >= 85 ? 'warning' : 'info',
          is_read: false,
        }).catch(() => {});

        // Create Insight
        await base44.entities.Insight.create({
          title: `Trend Opportunity: "${topic}"`,
          description: `Score: ${totalScore}/100. Window: ${urgencyWindow}. Recommended angle: ${recommendedAngle}. Visual brief for Canvas: ${visualBrief}`,
        }).catch(() => {});
      }

      return Response.json({ topic, platform, totalScore, urgencyWindow, shouldAct, recommendedContentAngle: recommendedAngle, canvasVisualBrief: visualBrief, recommendedPublishTiming: velocity === 'viral' ? 'Within 2 hours' : velocity === 'fast' ? 'Within 6 hours' : 'This week' });
    }

    // === ANALYZE CAMPAIGN SENTIMENT ===
    if (action === 'analyze_campaign_sentiment') {
      const { campaignId, campaignName, comments, platform } = data || {};
      // comments: [{ text, sentiment: 'positive'|'neutral'|'negative', timestamp }]

      const comments_ = comments || [];
      const total = comments_.length;
      if (total === 0) return Response.json({ error: 'No comments to analyze' }, { status: 400 });

      const positive = comments_.filter(c => c.sentiment === 'positive').length;
      const negative = comments_.filter(c => c.sentiment === 'negative').length;
      const neutral = total - positive - negative;

      const positivePct = Math.round((positive / total) * 100);
      const negativePct = Math.round((negative / total) * 100);

      // Extract negative themes
      const negativeComments = comments_.filter(c => c.sentiment === 'negative').map(c => c.text);

      let severity = 'ok';
      let actions = [];
      let canvasBrief = '';
      let maestroAction = '';

      if (negativePct >= 30) {
        severity = 'critical';
        maestroAction = 'PAUSE campaign immediately — negative sentiment critical threshold exceeded';
        canvasBrief = `Create alternative creative for "${campaignName}". Avoid the elements triggering backlash. Softer tone, more empathetic messaging.`;
        actions = ['Maestro: PAUSE campaign now', 'Canvas: generate alternative creative', 'Support Sage: active DM outreach to top negative commenters', 'Compass: broaden sentiment monitoring on this topic'];
      } else if (negativePct >= 20) {
        severity = 'warning';
        maestroAction = 'Reduce paid amplification — negative sentiment warning threshold exceeded';
        canvasBrief = `Prepare alternative creative for "${campaignName}" as contingency. Current creative may be triggering [review comments].`;
        actions = ['Maestro: reduce paid budget on this campaign', 'Canvas: prepare alternative creative', 'Support Sage: respond to negative comments proactively'];
      } else if (positivePct >= 70) {
        severity = 'boost';
        maestroAction = 'BOOST this content — exceptional positive sentiment. Increase paid amplification immediately.';
        actions = ['Maestro: increase paid budget by 2x', 'Maestro: extend campaign duration', 'Canvas: create additional content in same style'];
      }

      if (severity !== 'ok') {
        await base44.entities.Notification.create({
          title: `${severity === 'critical' ? '🚨' : severity === 'boost' ? '🚀' : '⚠️'} Campaign Sentiment: "${campaignName}" — ${negativePct}% negative`,
          message: `Platform: ${platform} | ${positivePct}% positive, ${negativePct}% negative, ${neutral} neutral out of ${total} comments\n\n${maestroAction}\n\nCanvas: ${canvasBrief || 'No creative action needed.'}\n\nActions: ${actions.join(' | ')}`,
          type: severity === 'critical' ? 'warning' : 'info',
          is_read: false,
        }).catch(() => {});
      }

      await base44.entities.Metric.create({
        name: `Campaign_Sentiment_${campaignName?.replace(/\s/g,'_')}`,
        value: positivePct - negativePct, // net sentiment score
        period: 'daily',
        description: `${campaignName} | ${positivePct}% pos, ${negativePct}% neg | ${total} comments analyzed`,
      }).catch(() => {});

      return Response.json({ campaignId, campaignName, platform, total, positive, negative, neutral, positivePct, negativePct, severity, maestroAction, canvasBrief, recommendedActions: actions });
    }

    // === CAPTURE INTERACTIVE CONTENT LEAD ===
    if (action === 'capture_interactive_content_lead') {
      const { handle, platform, interactionType, interactionData, profileData } = data || {};
      // interactionType: 'quiz_response' | 'poll_vote' | 'video_comment' | 'story_swipe'
      // interactionData: { question, answer } or { option } or { comment } etc.

      // Base score
      const baseScores = { quiz_response: 25, story_swipe: 30, video_comment: 20, poll_vote: 15 };
      let intentScore = baseScores[interactionType] || 15;

      // Analyze the content of the interaction for purchase intent
      const interactionText = JSON.stringify(interactionData || {}).toLowerCase();
      const highIntentKeywords = ['price', 'cost', 'how much', 'where can i', 'buy', 'purchase', 'order', 'get this', 'available', 'ship'];
      const intentBoost = highIntentKeywords.filter(kw => interactionText.includes(kw)).length * 5;
      intentScore = Math.min(30, intentScore + intentBoost);

      // Fit score from profile
      let fitScore = 30; // default medium fit
      if (profileData?.isDecisionMaker) fitScore += 10;
      if (profileData?.industryMatch) fitScore += 20;

      const totalScore = fitScore + intentScore + (profileData?.hasEmail ? 10 : 0);
      const grade = totalScore >= 80 ? 'HOT 🔥' : totalScore >= 60 ? 'WARM ⚡' : totalScore >= 40 ? 'COOL 🌤️' : 'COLD ❄️';

      // Generate hyper-personalized outreach
      const outreachMap = {
        quiz_response: `Saw you completed our quiz and answered "${interactionData?.answer}" for "${interactionData?.question}" — that tells me exactly what you need. Let me show you how we solve that.`,
        poll_vote: `You voted for "${interactionData?.option}" in our poll — you clearly know what matters. Here's how we help with exactly that.`,
        video_comment: `Your comment on our video — "${interactionData?.comment?.substring(0, 60)}..." — caught my attention. Happy to answer that directly.`,
        story_swipe: `You swiped up on our story about "${interactionData?.topic}" — here's the full story and how to get started.`,
      };

      const personalizedOutreach = outreachMap[interactionType] || `Noticed your engagement with our content on ${platform} — would love to connect.`;

      // Create Lead record
      const lead = await base44.entities.Lead.create({
        first_name: profileData?.firstName || handle,
        last_name: profileData?.lastName || '',
        email: profileData?.email || '',
        source: 'social',
        status: 'new',
        intent_score: intentScore,
        fit_score: fitScore,
        score: totalScore,
        intent_signals: [interactionType, ...(intentBoost > 0 ? ['purchase_intent_keywords'] : [])],
        notes: `Captured from ${platform} ${interactionType}. Interaction: ${JSON.stringify(interactionData)}. Personalized outreach: "${personalizedOutreach}"`,
        outreach_status: totalScore >= 70 ? 'scheduled' : 'none',
      }).catch(() => null);

      // Notify Prospect for high-score leads
      if (totalScore >= 60) {
        await base44.entities.Notification.create({
          title: `🎯 ${grade} Lead from ${interactionType}: ${handle} (${platform})`,
          message: `Score: ${totalScore}/100. Source: ${interactionType} on ${platform}.\nPersonalized outreach: "${personalizedOutreach}"\nProspect: prioritize for immediate follow-up.`,
          type: 'info',
          is_read: false,
        }).catch(() => {});
      }

      await base44.entities.Activity.create({
        type: 'lead_capture',
        title: `Interactive Lead Captured: ${handle} (${platform})`,
        description: `Type: ${interactionType} | Score: ${totalScore} | Grade: ${grade} | Interaction: ${JSON.stringify(interactionData)}`,
      }).catch(() => {});

      return Response.json({ handle, platform, interactionType, intentScore, fitScore, totalScore, grade, leadCreated: !!lead, personalizedOutreach });
    }

    // === GENERATE OPTIMAL POSTING SCHEDULE ===
    if (action === 'generate_optimal_schedule') {
      const { historicalPosts, targetPlatforms, audienceTimezone } = data || {};
      // historicalPosts: [{platform, publishedAt (ISO), engagementRate, format}]

      const platforms = targetPlatforms || ['instagram', 'tiktok', 'linkedin', 'twitter'];
      const posts = historicalPosts || [];

      // Industry benchmarks as fallback
      const benchmarkSchedules = {
        instagram: { bestDays: ['Tuesday', 'Wednesday', 'Friday'], bestTimes: ['07:00-09:00', '11:00-13:00', '17:00-19:00'], bestFormat: 'Carousel/Reels', expectedEngagement: '3-6%' },
        tiktok: { bestDays: ['Monday', 'Thursday', 'Saturday'], bestTimes: ['18:00-22:00', '12:00-14:00'], bestFormat: 'Video (15-30s)', expectedEngagement: '5-9%' },
        linkedin: { bestDays: ['Tuesday', 'Wednesday', 'Thursday'], bestTimes: ['08:00-10:00', '12:00-13:00'], bestFormat: 'Long-form text/Document post', expectedEngagement: '2-4%' },
        twitter: { bestDays: ['Wednesday', 'Thursday'], bestTimes: ['09:00-11:00', '15:00-17:00'], bestFormat: 'Short text/Thread', expectedEngagement: '0.5-1%' },
        facebook: { bestDays: ['Wednesday', 'Thursday', 'Friday'], bestTimes: ['09:00-11:00', '13:00-14:00'], bestFormat: 'Video/Link', expectedEngagement: '1-3%' },
        pinterest: { bestDays: ['Saturday', 'Sunday', 'Friday'], bestTimes: ['14:00-16:00', '20:00-23:00'], bestFormat: 'Vertical image/Infographic', expectedEngagement: '2-5%' },
      };

      // Analyze historical data if available
      const schedule = {};
      for (const platform of platforms) {
        const platformPosts = posts.filter(p => p.platform === platform);
        const benchmark = benchmarkSchedules[platform] || benchmarkSchedules.instagram;

        let confidence = 'low';
        let optimizedSchedule = benchmark;

        if (platformPosts.length >= 50) {
          confidence = 'high';
          // Group by day and hour, find highest avg engagement
          const byDay = {};
          const byHour = {};
          const byFormat = {};

          platformPosts.forEach(p => {
            const d = new Date(p.publishedAt);
            const day = d.toLocaleDateString('en-US', { weekday: 'long' });
            const hour = d.getHours();
            const hourGroup = `${Math.floor(hour/2)*2}:00-${Math.floor(hour/2)*2+2}:00`;

            byDay[day] = byDay[day] || []; byDay[day].push(p.engagementRate);
            byHour[hourGroup] = byHour[hourGroup] || []; byHour[hourGroup].push(p.engagementRate);
            if (p.format) { byFormat[p.format] = byFormat[p.format] || []; byFormat[p.format].push(p.engagementRate); }
          });

          const avgEngagement = arr => arr.reduce((s,v) => s+v, 0) / arr.length;
          const bestDays = Object.entries(byDay).sort((a,b) => avgEngagement(b[1]) - avgEngagement(a[1])).slice(0,3).map(e => e[0]);
          const bestTimes = Object.entries(byHour).sort((a,b) => avgEngagement(b[1]) - avgEngagement(a[1])).slice(0,2).map(e => e[0]);
          const bestFormat = Object.entries(byFormat).sort((a,b) => avgEngagement(b[1]) - avgEngagement(a[1]))[0]?.[0] || benchmark.bestFormat;
          const avgEng = avgEngagement(platformPosts.map(p => p.engagementRate));

          optimizedSchedule = { bestDays, bestTimes, bestFormat, expectedEngagement: `${(avgEng*0.9).toFixed(1)}-${(avgEng*1.2).toFixed(1)}%` };
        } else if (platformPosts.length >= 20) {
          confidence = 'medium';
        }

        schedule[platform] = { ...optimizedSchedule, confidence, dataPoints: platformPosts.length };
      }

      // Store as Metric for tracking
      await base44.entities.Metric.create({
        name: `Optimal_Schedule_${new Date().toISOString().split('T')[0]}`,
        value: Object.keys(schedule).length,
        period: 'weekly',
        description: `Optimal posting schedule generated for ${platforms.join(', ')}. Confidence: ${Object.values(schedule).map(s => s.confidence).join(', ')}`,
      }).catch(() => {});

      // Notify Maestro
      const scheduleSummary = Object.entries(schedule).map(([p, s]) => `${p}: ${s.bestDays.slice(0,2).join('/')} at ${s.bestTimes[0]} (${s.bestFormat}) — exp. ${s.expectedEngagement} [${s.confidence} confidence]`).join('\n');
      await base44.entities.Notification.create({
        title: '📅 Optimal Posting Schedule Generated',
        message: `Weekly posting schedule (${audienceTimezone || 'local time'}):\n${scheduleSummary}\n\nMaestro: apply this to the content calendar for next week. Inspect: track actual vs predicted engagement for model improvement.`,
        type: 'info',
        is_read: false,
      }).catch(() => {});

      return Response.json({ schedule, generatedAt: new Date().toISOString(), timezone: audienceTimezone, note: 'Share with Maestro to apply to content calendar. Inspect to track prediction accuracy.' });
    }

    // === AGGREGATE CROSS-PLATFORM METRICS ===
    if (action === 'aggregate_cross_platform_metrics') {
      const { platformData, dateRange } = data || {};
      // platformData: [{platform, reach, impressions, engagements, followerGrowth, clicks, videoCompletionRate, topFormat}]

      const platforms = platformData || [];
      if (platforms.length === 0) return Response.json({ error: 'platformData required' }, { status: 400 });

      const aggregated = platforms.map(p => ({
        platform: p.platform,
        reach: p.reach,
        engagementRate: p.engagements && p.reach ? ((p.engagements / p.reach) * 100).toFixed(2) + '%' : 'N/A',
        followerGrowth: p.followerGrowth,
        clicks: p.clicks,
        videoCompletionRate: p.videoCompletionRate ? p.videoCompletionRate.toFixed(1) + '%' : 'N/A',
        topFormat: p.topFormat,
        score: Math.round(((p.engagements || 0) / (p.reach || 1)) * 100 + (p.followerGrowth || 0) * 0.1 + (p.clicks || 0) * 0.5),
      }));

      const winner = aggregated.sort((a, b) => b.score - a.score)[0];
      const totalReach = aggregated.reduce((s, p) => s + (p.reach || 0), 0);
      const totalClicks = aggregated.reduce((s, p) => s + (p.clicks || 0), 0);

      // Cross-platform patterns
      const patterns = [];
      const videoFormats = aggregated.filter(p => p.topFormat?.toLowerCase().includes('video'));
      if (videoFormats.length >= 2) patterns.push('Video content is the top format across multiple platforms — Canvas should prioritize video production');

      const underperformers = aggregated.filter(p => p.score < 20);
      if (underperformers.length > 0) patterns.push(`${underperformers.map(p => p.platform).join(', ')} are underperforming — Sage: evaluate whether to deprioritize or change strategy`);

      await base44.entities.Insight.create({
        title: `Cross-Platform Analytics — ${dateRange || 'Latest'}`,
        description: `Total reach: ${totalReach.toLocaleString()} | Total clicks: ${totalClicks.toLocaleString()} | Winner: ${winner?.platform} (score: ${winner?.score}). Patterns: ${patterns.join('; ')}`,
      }).catch(() => {});

      await base44.entities.Notification.create({
        title: `📊 Cross-Platform Analytics Ready — Winner: ${winner?.platform}`,
        message: `${dateRange || 'This period'}: Total reach: ${totalReach.toLocaleString()} | Clicks: ${totalClicks.toLocaleString()}\nTop platform: ${winner?.platform} — ${winner?.engagementRate} engagement\nSage: ${patterns.join('. ')}\nMaestro: reallocate budget toward top performers.`,
        type: 'info',
        is_read: false,
      }).catch(() => {});

      return Response.json({ platforms: aggregated.sort((a,b) => b.score - a.score), winner: winner?.platform, totalReach, totalClicks, crossPlatformPatterns: patterns, dateRange });
    }

    // === INFLUENCER AUDIENCE ANALYSIS ===
    if (action === 'influencer_audience_analysis') {
      const { influencerHandle, platform, followerCount, audienceDemographics, engagementRate, icpProfile } = data || {};
      // icpProfile: { ageRange, interests, industries, geographies }
      // audienceDemographics: { ageRange, interests, industries, geographies }

      const aud = audienceDemographics || {};
      const icp = icpProfile || {};

      // Calculate audience ICP match
      let matchScore = 0;
      const matchReasons = [];
      const mismatches = [];

      if (aud.ageRange && icp.ageRange && aud.ageRange === icp.ageRange) { matchScore += 25; matchReasons.push('Age range alignment'); }
      else if (aud.ageRange && icp.ageRange) mismatches.push(`Age range mismatch: ${aud.ageRange} vs ICP ${icp.ageRange}`);

      const sharedInterests = (aud.interests || []).filter(i => (icp.interests || []).includes(i));
      matchScore += sharedInterests.length * 10;
      if (sharedInterests.length > 0) matchReasons.push(`Shared interests: ${sharedInterests.join(', ')}`);

      const sharedIndustries = (aud.industries || []).filter(i => (icp.industries || []).includes(i));
      matchScore += sharedIndustries.length * 15;
      if (sharedIndustries.length > 0) matchReasons.push(`Industry alignment: ${sharedIndustries.join(', ')}`);

      const sharedGeos = (aud.geographies || []).filter(g => (icp.geographies || []).includes(g));
      matchScore += sharedGeos.length * 10;
      if (sharedGeos.length > 0) matchReasons.push(`Geographic alignment: ${sharedGeos.join(', ')}`);

      matchScore = Math.min(100, matchScore);

      // Engagement quality score (comments/likes ratio matters)
      const engScore = Math.min(100, (engagementRate || 0) * 10);

      // Estimated leads potential
      const estimatedReach = followerCount * (engagementRate / 100);
      const estimatedLeads = Math.round(estimatedReach * (matchScore / 100) * 0.02); // 2% of aligned-audience-reached
      const estimatedCPL = estimatedLeads > 0 ? 'Requires campaign budget data' : 'N/A';

      const recommendation = matchScore >= 75 ? 'STRONG MATCH — Prioritize for campaign. Prospect: build lookalike audience from this follower base.' : matchScore >= 50 ? 'MODERATE MATCH — Test with one campaign. Monitor conversion quality.' : 'WEAK MATCH — Not recommended for lead generation. Evaluate for pure awareness value only.';

      await base44.entities.Insight.create({
        title: `Influencer Audience Analysis: ${influencerHandle}`,
        description: `${platform} | ${followerCount.toLocaleString()} followers | ${engagementRate}% engagement | ICP match: ${matchScore}% | Est. leads/campaign: ${estimatedLeads}. ${recommendation}`,
      }).catch(() => {});

      await base44.entities.Notification.create({
        title: `🌟 Influencer Analysis: ${influencerHandle} — ${matchScore}% ICP Match`,
        message: `${platform} | ${followerCount.toLocaleString()} followers | Engagement: ${engagementRate}%\nICP Match: ${matchScore}% | Est. leads/campaign: ${estimatedLeads}\n${recommendation}\n\nPart: update Partner record with this analysis. Prospect: if match >75%, build lookalike audience campaign with Maestro.`,
        type: 'info',
        is_read: false,
      }).catch(() => {});

      return Response.json({ influencerHandle, platform, followerCount, engagementRate, icpMatchScore: matchScore, matchReasons, mismatches, engagementQualityScore: engScore, estimatedReachPerPost: Math.round(estimatedReach), estimatedLeadsPerCampaign: estimatedLeads, recommendation });
    }

    // === REPURPOSE CONTENT ===
    if (action === 'repurpose_content') {
      const { sourceContent, sourceFormat, targetPlatforms, brandVoice, campaignId } = data || {};

      const platforms = targetPlatforms || ['instagram', 'linkedin', 'tiktok', 'twitter', 'email'];
      const repurposingMap = {
        blog_post: {
          instagram: 'Extract 5 key insights → Instagram carousel (1 insight per slide, bold headline + brief explanation)',
          linkedin: 'Adapt for long-form LinkedIn post — keep the narrative structure, add professional framing',
          tiktok: 'Pick the most surprising stat or insight → 30-second video script with text overlays',
          twitter: 'Extract 7 key points → Twitter thread (tweet 1 = hook, tweets 2-7 = insights, final = CTA)',
          email: 'Use the intro paragraph as teaser → "Read the full post" CTA → link to blog',
          pinterest: 'Create 3 infographic pins with the top stats and a branded quote graphic',
        },
        video: {
          instagram: 'Cut to 60s highlight reel (best moments) → Reels format',
          linkedin: 'Extract key quote from video → LinkedIn native post with the quote + context + link to full video',
          tiktok: 'Recut to 30s with captions + hook in first 3 seconds',
          twitter: 'Create a 45s Twitter video clip (most shareable moment) + companion thread',
          email: 'Use video thumbnail as email hero image → CTA button to watch',
        },
        carousel: {
          linkedin: 'Reformat as LinkedIn Document post (PDF carousel — native LinkedIn format performs better)',
          tiktok: 'Narrate each slide as a video — slides become text overlays in a 30-45s video',
          twitter: 'Pull top 3 stats/insights as individual tweet images in a thread',
          email: 'Use first slide as email header + tease remaining slides → CTA to social',
          pinterest: 'Each slide becomes an individual pin with brand watermark',
        },
        quote_graphic: {
          instagram: 'Multiple sizes: 1:1 for feed, 9:16 for stories, 4:5 for portrait feed',
          linkedin: 'With professional framing — attribution + company logo',
          twitter: 'As standalone tweet image',
          email: 'As pull quote within email body',
        },
      };

      const format = sourceFormat || 'blog_post';
      const map = repurposingMap[format] || repurposingMap.blog_post;
      const adaptations = {};
      for (const platform of platforms) {
        adaptations[platform] = map[platform] || `Adapt "${sourceContent?.substring(0, 50)}..." natively for ${platform} — match the platform's native format and tone.`;
      }

      // Create tasks for Canvas and Maestro
      const tasks = [];
      for (const [platform, adaptation] of Object.entries(adaptations)) {
        tasks.push(base44.entities.Task.create({
          title: `Repurpose for ${platform}: ${sourceContent?.substring(0, 40)}...`,
          description: `Canvas: ${adaptation}\nMaestro: schedule for optimal ${platform} posting time once Canvas delivers.`,
          priority: 'medium',
          status: 'pending',
          source: 'agent',
          tags: ['repurposing', 'content', platform],
          linked_client_id: campaignId,
        }).catch(() => null));
      }
      await Promise.all(tasks);

      await base44.entities.Notification.create({
        title: `♻️ Content Repurposing Plan Ready`,
        message: `Source: ${sourceFormat} | Target platforms: ${platforms.join(', ')}\nCanvas: ${platforms.length} adaptations queued as tasks.\nMaestro: schedule each adapted piece for optimal platform timing once Canvas delivers.`,
        type: 'info',
        is_read: false,
      }).catch(() => {});

      return Response.json({ sourceFormat, targetPlatforms: platforms, adaptations, tasksCreated: platforms.length, note: 'Tasks created for Canvas to produce each adaptation. Maestro to schedule upon delivery.' });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});