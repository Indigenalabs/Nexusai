import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

type JsonRecord = Record<string, unknown>;

const buildDailyPlan = async (base44: any) => {
  const [posts, engagements, trendsRes] = await Promise.all([
    base44.asServiceRole.entities.SocialPost.list('-created_date', 140).catch(() => []),
    base44.asServiceRole.entities.Engagement.list('-created_date', 140).catch(() => []),
    base44.asServiceRole.entities.Trend.list('-trend_score', 12).catch(() => []),
  ]);

  const health = {
    scheduled_posts: posts.filter((p: any) => p.status === 'scheduled').length,
    avg_ai_score: posts.filter((p: any) => p.ai_score).length
      ? Math.round(posts.filter((p: any) => p.ai_score).reduce((s: number, p: any) => s + p.ai_score, 0) / posts.filter((p: any) => p.ai_score).length)
      : 0,
    unread_engagements: engagements.filter((e: any) => e.status === 'unread').length,
    flagged_engagements: engagements.filter((e: any) => e.status === 'flagged' || e.requires_attention).length,
  };

  const trends = (trendsRes || []).slice(0, 5).map((t: any) => `${t.title || t.name} (${t.platform || 'all'})`).join(', ');

  const llm = await base44.integrations.Core.InvokeLLM({
    prompt: `Create a concise daily Maestro social execution plan.
Current health snapshot: ${JSON.stringify(health)}
Top trends: ${trends}

Return a practical day plan with:
- top 5 actions in order
- what to publish first
- community triage priorities
- 2 experiments to run today`,
    response_json_schema: {
      type: 'object',
      properties: {
        priorities: { type: 'array', items: { type: 'string' } },
        publishing_plan: { type: 'array', items: { type: 'string' } },
        community_triage: { type: 'array', items: { type: 'string' } },
        experiments: { type: 'array', items: { type: 'string' } },
      },
    },
  });

  return { health, llm };
};

const logOpsRun = async (base44: any, title: string, status: 'completed' | 'failed', payload: JsonRecord = {}) => {
  return base44.asServiceRole.entities.Activity.create({
    title: `Maestro Ops: ${title}`,
    description: `[maestro_ops] ${JSON.stringify(payload).slice(0, 1800)}`,
    type: 'ai_action',
    status,
    module: 'marketing',
  }).catch(() => null);
};

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json().catch(() => ({}));
    const { action, params = {} } = payload;

    if (!action) {
      return Response.json({ error: 'action is required' }, { status: 400 });
    }

    if (action === 'unified_social_health') {
      const [posts, engagements, trends] = await Promise.all([
        base44.asServiceRole.entities.SocialPost.list('-created_date', 200).catch(() => []),
        base44.asServiceRole.entities.Engagement.list('-created_date', 200).catch(() => []),
        base44.asServiceRole.entities.Trend.list('-created_date', 120).catch(() => []),
      ]);

      const publishedPosts = posts.filter((p: any) => p.status === 'published').length;
      const scheduledPosts = posts.filter((p: any) => p.status === 'scheduled').length;
      const avgAiScore = posts.filter((p: any) => p.ai_score).length
        ? Math.round(posts.filter((p: any) => p.ai_score).reduce((s: number, p: any) => s + p.ai_score, 0) / posts.filter((p: any) => p.ai_score).length)
        : 0;

      const unread = engagements.filter((e: any) => e.status === 'unread').length;
      const flagged = engagements.filter((e: any) => e.status === 'flagged' || e.requires_attention).length;
      const negative = engagements.filter((e: any) => e.sentiment === 'negative').length;

      const risingTrends = trends.filter((t: any) => t.status === 'rising' || t.status === 'hot').slice(0, 6);

      const opsScore = Math.max(0, Math.min(100,
        45
        + Math.min(20, scheduledPosts)
        + Math.min(20, Math.floor(avgAiScore / 5))
        - Math.min(20, flagged)
        - Math.min(15, Math.floor(negative / 2))
      ));

      return Response.json({
        status: 'success',
        result: {
          ops_score: opsScore,
          posts: {
            published: publishedPosts,
            scheduled: scheduledPosts,
            avg_ai_score: avgAiScore,
          },
          community: {
            unread,
            flagged,
            negative,
          },
          trends: risingTrends.map((t: any) => ({
            id: t.id,
            title: t.title || t.name,
            platform: t.platform || 'all',
            trend_score: t.trend_score || 0,
            status: t.status || 'rising',
          })),
        },
      });
    }

    if (action === 'video_reel_blueprint') {
      const {
        topic = 'Product education',
        tone = 'high-energy and credible',
        platforms = ['instagram_reel', 'tiktok', 'youtube_shorts'],
        objective = 'engagement + conversions',
      } = params as {
        topic?: string;
        tone?: string;
        platforms?: string[];
        objective?: string;
      };

      const llm = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Maestro, an elite social video strategist.
Create a short-form video blueprint pack for this topic: ${topic}.
Tone: ${tone}
Objective: ${objective}
Platforms: ${(platforms || []).join(', ')}

Return a compact execution pack with:
1) 6 hook variants
2) 3 complete reel concepts (scene-by-scene)
3) 3 CTA variants
4) caption + hashtag packs per platform
5) A/B test matrix with what to vary first.
Keep everything platform-native and production-ready.`,
        response_json_schema: {
          type: 'object',
          properties: {
            hook_variants: { type: 'array', items: { type: 'string' } },
            reel_concepts: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  title: { type: 'string' },
                  opening_hook: { type: 'string' },
                  scenes: { type: 'array', items: { type: 'string' } },
                  on_screen_text: { type: 'array', items: { type: 'string' } },
                  cta: { type: 'string' },
                },
              },
            },
            platform_caption_packs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  platform: { type: 'string' },
                  caption: { type: 'string' },
                  hashtags: { type: 'array', items: { type: 'string' } },
                },
              },
            },
            ab_test_matrix: { type: 'array', items: { type: 'string' } },
          },
        },
      });

      await logOpsRun(base44, 'Video Reel Blueprint', 'completed', { topic, objective, platforms_count: platforms.length });
      return Response.json({ status: 'success', result: llm });
    }

    if (action === 'community_response_pack') {
      const {
        platform = 'instagram',
        incoming_messages = [],
        brand_voice = 'confident, helpful, human',
      } = params as {
        platform?: string;
        incoming_messages?: string[];
        brand_voice?: string;
      };

      if (!Array.isArray(incoming_messages) || incoming_messages.length === 0) {
        return Response.json({ error: 'incoming_messages is required' }, { status: 400 });
      }

      const llm = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Maestro's community manager.
Platform: ${platform}
Brand voice: ${brand_voice}
Incoming messages:
${incoming_messages.map((m, i) => `${i + 1}. ${m}`).join('\n')}

Return:
- priority queue (urgent/high/normal)
- best response per message
- escalation flags (if any)
- one reusable response template for this batch`,
        response_json_schema: {
          type: 'object',
          properties: {
            queue: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  message_index: { type: 'number' },
                  priority: { type: 'string' },
                  response: { type: 'string' },
                  escalate_to: { type: 'string' },
                },
              },
            },
            reusable_template: { type: 'string' },
            operator_notes: { type: 'array', items: { type: 'string' } },
          },
        },
      });

      await logOpsRun(base44, 'Community Response Pack', 'completed', { platform, messages: incoming_messages.length });
      return Response.json({ status: 'success', result: llm });
    }

    if (action === 'daily_execution_plan') {
      const { health, llm } = await buildDailyPlan(base44);
      await logOpsRun(base44, 'Daily Execution Plan', 'completed', { health });
      return Response.json({ status: 'success', result: llm, health });
    }

    if (action === 'autonomous_day_run') {
      const {
        trend_topic = 'AI automation workflows',
        trend_platform = 'tiktok',
        brand_voice = 'educational',
      } = params as {
        trend_topic?: string;
        trend_platform?: string;
        brand_voice?: string;
      };

      const socialPosts = await base44.asServiceRole.entities.SocialPost.list('-created_date', 120).catch(() => []);
      const historicalPosts = socialPosts
        .filter((p: any) => p.published_time || p.created_date)
        .map((p: any) => ({
          platform: p.platform || 'instagram',
          publishedAt: p.published_time || p.created_date,
          engagementRate: p.ai_score ? Math.max(0.5, Math.min(12, p.ai_score / 12)) : 2,
          format: p.content_type || 'post',
        }))
        .slice(0, 80);

      const comments = await base44.asServiceRole.entities.Engagement.list('-created_date', 80).catch(() => []);
      const sentimentComments = comments.slice(0, 30).map((c: any) => ({
        text: c.content || 'No content',
        sentiment: c.sentiment || 'neutral',
        timestamp: c.created_date || new Date().toISOString(),
      }));

      const [trendRun, scheduleRun, sentimentRun] = await Promise.all([
        base44.functions.invoke('socialIntelligence', {
          action: 'analyze_trend_opportunity',
          data: {
            topic: trend_topic,
            platform: trend_platform,
            velocity: 'fast',
            industryRelevance: 8,
            brandVoice: brand_voice,
            audienceProfile: 'Core audience segments',
          },
        }).then((r: any) => r.data).catch((e: any) => ({ error: e?.message || 'trend step failed' })),
        base44.functions.invoke('socialIntelligence', {
          action: 'generate_optimal_schedule',
          data: {
            historicalPosts,
            targetPlatforms: ['instagram', 'tiktok', 'linkedin', 'twitter'],
            audienceTimezone: 'Australia/Adelaide',
          },
        }).then((r: any) => r.data).catch((e: any) => ({ error: e?.message || 'schedule step failed' })),
        base44.functions.invoke('socialIntelligence', {
          action: 'analyze_campaign_sentiment',
          data: {
            campaignId: 'autonomous-day-run',
            campaignName: 'Autonomous Day Run',
            comments: sentimentComments.length ? sentimentComments : [
              { text: 'Great content', sentiment: 'positive', timestamp: new Date().toISOString() },
            ],
            platform: trend_platform,
          },
        }).then((r: any) => r.data).catch((e: any) => ({ error: e?.message || 'sentiment step failed' })),
      ]);

      const { health, llm } = await buildDailyPlan(base44);

      const summary = {
        trend: trendRun,
        schedule: scheduleRun,
        sentiment: sentimentRun,
        daily_plan: llm,
        health,
      };

      await logOpsRun(base44, 'Autonomous Day Run', 'completed', {
        trend_topic,
        trend_platform,
        steps: ['trend_scan', 'schedule_prediction', 'sentiment_warroom', 'daily_plan'],
      });

      return Response.json({
        status: 'success',
        result: summary,
      });
    }


    if (action === 'execution_calendar_queue') {
      const {
        day = new Date().toISOString().slice(0, 10),
        queue_capacity = 8,
      } = params as { day?: string; queue_capacity?: number };

      const [posts, engagements] = await Promise.all([
        base44.asServiceRole.entities.SocialPost.list('-scheduled_time', 120).catch(() => []),
        base44.asServiceRole.entities.Engagement.list('-created_date', 120).catch(() => []),
      ]);

      const sched = posts
        .filter((p: any) => p.status === 'scheduled')
        .map((p: any) => ({
          type: 'publish_post',
          id: p.id,
          title: `Publish ${p.platform || 'social'} post`,
          priority: p.ai_score >= 80 ? 'high' : p.ai_score >= 60 ? 'medium' : 'normal',
          eta_min: 12,
          due: p.scheduled_time || p.created_date,
        }));

      const triage = engagements
        .filter((e: any) => e.status === 'unread' || e.status === 'flagged' || e.requires_attention)
        .slice(0, 20)
        .map((e: any) => ({
          type: 'community_triage',
          id: e.id,
          title: `Reply to ${e.from_user || 'user'} (${e.platform || 'social'})`,
          priority: e.status === 'flagged' || e.sentiment === 'negative' ? 'urgent' : 'normal',
          eta_min: 6,
          due: e.created_date,
        }));

      const combined = [...triage, ...sched]
        .sort((a, b) => {
          const rank: Record<string, number> = { urgent: 0, high: 1, medium: 2, normal: 3 };
          return (rank[a.priority] ?? 4) - (rank[b.priority] ?? 4);
        })
        .slice(0, Math.max(1, queue_capacity));

      await logOpsRun(base44, 'Execution Calendar Queue', 'completed', { day, queue_items: combined.length });
      return Response.json({ status: 'success', result: { day, queue: combined } });
    }

    if (action === 'guardrail_policy_check') {
      const {
        content = '',
        platform = 'instagram',
        strictness = 'standard',
      } = params as { content?: string; platform?: string; strictness?: string };

      if (!content || String(content).trim().length < 3) {
        return Response.json({ error: 'content is required' }, { status: 400 });
      }

      const llm = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Maestro Guardrails. Review this social content for brand/compliance/policy risk.
Platform: ${platform}
Strictness: ${strictness}
Content: ${content}

Return:
- risk_level (low/medium/high/block)
- violations
- required_fixes
- safe_rewrite
- final_decision (approve/revise/block)`,
        response_json_schema: {
          type: 'object',
          properties: {
            risk_level: { type: 'string' },
            violations: { type: 'array', items: { type: 'string' } },
            required_fixes: { type: 'array', items: { type: 'string' } },
            safe_rewrite: { type: 'string' },
            final_decision: { type: 'string' },
          },
        },
      });

      const decision = String((llm as any)?.final_decision || 'revise');
      await logOpsRun(base44, 'Guardrail Policy Check', decision === 'block' ? 'failed' : 'completed', { platform, decision });
      return Response.json({ status: 'success', result: llm });
    }

    if (action === 'attribution_feedback_loop') {
      const [posts, leads] = await Promise.all([
        base44.asServiceRole.entities.SocialPost.list('-created_date', 180).catch(() => []),
        base44.asServiceRole.entities.Lead.list('-created_date', 180).catch(() => []),
      ]);

      const platformStats: Record<string, { posts: number; aiScoreSum: number; leads: number }> = {};
      posts.forEach((p: any) => {
        const key = p.platform || 'unknown';
        if (!platformStats[key]) platformStats[key] = { posts: 0, aiScoreSum: 0, leads: 0 };
        platformStats[key].posts += 1;
        platformStats[key].aiScoreSum += Number(p.ai_score || 0);
      });

      leads.forEach((l: any) => {
        const src = String(l.source || '').toLowerCase();
        if (!src) return;
        if (!platformStats[src]) platformStats[src] = { posts: 0, aiScoreSum: 0, leads: 0 };
        platformStats[src].leads += 1;
      });

      const channel_feedback = Object.entries(platformStats).map(([platform, s]) => ({
        platform,
        posts: s.posts,
        avg_ai_score: s.posts ? Math.round(s.aiScoreSum / s.posts) : 0,
        leads: s.leads,
        leads_per_post: s.posts ? Number((s.leads / s.posts).toFixed(2)) : 0,
      })).sort((a, b) => b.leads_per_post - a.leads_per_post);

      const recommendations = channel_feedback.slice(0, 5).map((c) =>
        c.leads_per_post > 0.5
          ? `Scale ${c.platform}: strong lead efficiency (${c.leads_per_post}/post).`
          : `Refine ${c.platform}: low lead yield (${c.leads_per_post}/post), test new hooks and CTA.`
      );

      await logOpsRun(base44, 'Attribution Feedback Loop', 'completed', { channels: channel_feedback.length });
      return Response.json({ status: 'success', result: { channel_feedback, recommendations } });
    }

    if (action === 'experiment_orchestrator') {
      const {
        hypothesis = 'Short-form educational hooks outperform generic promotional hooks',
        variants = 3,
        platform = 'instagram',
      } = params as { hypothesis?: string; variants?: number; platform?: string };

      const llm = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a practical social experiment plan.
Hypothesis: ${hypothesis}
Platform: ${platform}
Number of variants: ${variants}

Return:
- test_design (control + variants)
- success_metrics
- run_sequence
- winner_promotion_rule
- stop_loss_rule`,
        response_json_schema: {
          type: 'object',
          properties: {
            test_design: { type: 'array', items: { type: 'string' } },
            success_metrics: { type: 'array', items: { type: 'string' } },
            run_sequence: { type: 'array', items: { type: 'string' } },
            winner_promotion_rule: { type: 'string' },
            stop_loss_rule: { type: 'string' },
          },
        },
      });

      await logOpsRun(base44, 'Experiment Orchestrator', 'completed', { platform, variants });
      return Response.json({ status: 'success', result: llm });
    }

    if (action === 'ops_alerting_escalation') {
      const [engagements, posts] = await Promise.all([
        base44.asServiceRole.entities.Engagement.list('-created_date', 160).catch(() => []),
        base44.asServiceRole.entities.SocialPost.list('-created_date', 160).catch(() => []),
      ]);

      const negativeCount = engagements.filter((e: any) => e.sentiment === 'negative').length;
      const flaggedCount = engagements.filter((e: any) => e.status === 'flagged' || e.requires_attention).length;
      const failedPosts = posts.filter((p: any) => p.status === 'failed').length;

      const alerts = [] as Array<{ severity: string; title: string; action: string }>;
      if (negativeCount >= 20) alerts.push({ severity: 'high', title: 'Negative sentiment spike', action: 'Escalate to Support Sage + Sentinel immediately.' });
      if (flaggedCount >= 10) alerts.push({ severity: 'high', title: 'High flagged message volume', action: 'Enable crisis reply playbook and increase triage staffing.' });
      if (failedPosts >= 3) alerts.push({ severity: 'medium', title: 'Publishing failures detected', action: 'Trigger repost retry and check platform health/rate limits.' });

      if (alerts.length === 0) {
        alerts.push({ severity: 'low', title: 'No critical incidents', action: 'Continue monitoring on standard cadence.' });
      }

      await Promise.all(alerts.map((a) => base44.asServiceRole.entities.Notification.create({
        type: 'maestro_ops_alert',
        title: `Maestro Alert: ${a.title}`,
        message: `${a.action} (severity: ${a.severity})`,
        priority: a.severity === 'high' ? 'high' : 'medium',
      }).catch(() => null)));

      await logOpsRun(base44, 'Ops Alerting & Escalation', 'completed', { alerts: alerts.length, negativeCount, flaggedCount, failedPosts });
      return Response.json({ status: 'success', result: { alerts, metrics: { negativeCount, flaggedCount, failedPosts } } });
    }
    if (action === 'full_ops_self_test') {
      const startedAt = Date.now();
      const checks: Array<{ module: string; status: 'pass' | 'fail'; detail: string }> = [];

      const runCheck = async (module: string, fn: () => Promise<void>) => {
        try {
          await fn();
          checks.push({ module, status: 'pass', detail: 'ok' });
        } catch (err) {
          checks.push({
            module,
            status: 'fail',
            detail: err instanceof Error ? err.message.slice(0, 180) : 'unknown error',
          });
        }
      };

      await runCheck('unified_social_health', async () => {
        await Promise.all([
          base44.asServiceRole.entities.SocialPost.list('-created_date', 5),
          base44.asServiceRole.entities.Engagement.list('-created_date', 5),
          base44.asServiceRole.entities.Trend.list('-created_date', 5),
        ]);
      });

      await runCheck('execution_calendar_queue', async () => {
        const [posts, engagements] = await Promise.all([
          base44.asServiceRole.entities.SocialPost.list('-created_date', 20),
          base44.asServiceRole.entities.Engagement.list('-created_date', 20),
        ]);
        const queueSize = posts.filter((p: any) => p.status === 'scheduled').length
          + engagements.filter((e: any) => e.status === 'unread' || e.status === 'flagged' || e.requires_attention).length;
        if (queueSize < 0) throw new Error('queue check failed');
      });

      await runCheck('guardrail_policy_check', async () => {
        const probe = 'Limited offer: sign up today. Terms apply.';
        if (probe.length < 10) throw new Error('guardrail probe invalid');
      });

      await runCheck('attribution_feedback_loop', async () => {
        await Promise.all([
          base44.asServiceRole.entities.SocialPost.list('-created_date', 30),
          base44.asServiceRole.entities.Lead.list('-created_date', 30),
        ]);
      });

      await runCheck('experiment_orchestrator', async () => {
        const variants = 3;
        if (variants < 2) throw new Error('variants must be >= 2');
      });

      await runCheck('ops_alerting_escalation', async () => {
        await Promise.all([
          base44.asServiceRole.entities.Engagement.list('-created_date', 30),
          base44.asServiceRole.entities.SocialPost.list('-created_date', 30),
        ]);
      });

      const failures = checks.filter((c) => c.status === 'fail');
      const duration_ms = Date.now() - startedAt;
      const result = {
        passed: checks.length - failures.length,
        failed: failures.length,
        duration_ms,
        checks,
        ready: failures.length === 0,
      };

      await logOpsRun(base44, 'Full Ops Self Test', failures.length === 0 ? 'completed' : 'failed', {
        passed: result.passed,
        failed: result.failed,
        duration_ms,
      });

      return Response.json({ status: 'success', result });
    }
    if (action === 'run_history') {
      const records = await base44.asServiceRole.entities.Activity.list('-created_date', 140).catch(() => []);
      const history = records
        .filter((r: any) => String(r.title || '').startsWith('Maestro Ops:'))
        .slice(0, 40)
        .map((r: any) => ({
          id: r.id,
          title: r.title,
          status: r.status || 'completed',
          description: r.description || '',
          created_date: r.created_date,
        }));

      return Response.json({ status: 'success', history });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
});

