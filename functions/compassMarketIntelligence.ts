import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const { action, params = {} } = payload;

    // Legacy field support
    const sector = payload.sector || params.sector || 'general business';
    const region = payload.region || params.region || 'national';
    const keywords = payload.keywords || params.keywords || [];

    let result = null;

    // ─── HELPERS ─────────────────────────────────────────────────────────────
    const loadCompetitors = async () =>
      base44.asServiceRole.entities.Competitor.list('-created_date', 50).catch(() => []);

    const loadTrends = async () =>
      base44.asServiceRole.entities.Trend.list('-created_date', 30).catch(() => []);

    // ─── 1. MONITOR TRENDS ───────────────────────────────────────────────────
    if (action === 'monitor_trends') {
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Identify the most important emerging trends in ${sector} (${region}).
Keywords to emphasize: ${keywords.join(', ') || 'general market signals'}.

For each trend:
1. What is happening (specific, factual)
2. Momentum stage: emerging / building / peak / declining
3. Is it an opportunity (yes/no) and why
4. Is it a threat (yes/no) and why
5. Urgency window: 24h / 72h / 7-30 days / 3-6 months
6. Recommended action and which agent to brief
7. Key data sources

Return top 6 trends with strategic relevance score (1-10).`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            trends: { type: 'array', items: { type: 'object', properties: {
              trend: { type: 'string' },
              description: { type: 'string' },
              momentum: { type: 'string' },
              relevance_score: { type: 'number' },
              opportunity: { type: 'boolean' },
              threat: { type: 'boolean' },
              urgency_window: { type: 'string' },
              recommended_action: { type: 'string' },
              agent_to_brief: { type: 'string' },
              data_sources: { type: 'array', items: { type: 'string' } }
            }}},
            summary: { type: 'string' }
          }
        }
      });

      for (const trend of (result.trends || [])) {
        await base44.asServiceRole.entities.Trend.create({
          topic: trend.trend,
          description: trend.description,
          momentum: trend.momentum,
          sector,
          status: 'active'
        }).catch(() => null);

        if (trend.urgency_window === '24h' || trend.urgency_window === '72h') {
          await base44.asServiceRole.entities.Notification.create({
            type: 'trend_alert',
            title: `Trend: ${trend.trend}`,
            message: `${trend.description} — Window: ${trend.urgency_window}. Action: ${trend.recommended_action}`,
            priority: trend.urgency_window === '24h' ? 'critical' : 'high'
          }).catch(() => null);
        }
      }
    }

    // ─── 2. ANALYZE COMPETITORS ──────────────────────────────────────────────
    if (action === 'analyze_competitors') {
      const competitors = await loadCompetitors();
      const { focus_competitor } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Comprehensive competitive intelligence analysis.

Sector: ${sector} | Region: ${region}
Tracked competitors: ${competitors.map(c => `${c.name}${c.domain ? ` (${c.domain})` : ''}`).join(', ')}
${focus_competitor ? `Focus on: ${focus_competitor}` : 'Full landscape overview'}

For each competitor (or the focused one), analyze:
1. Recent moves (last 60 days): product launches, pricing, hiring, funding, partnerships
2. Strengths and weaknesses vs our position
3. Market positioning and messaging strategy
4. Growth trajectory (accelerating/steady/slowing)
5. Threat level: low/medium/high/critical — with reasoning
6. Their likely next move (prediction)
7. Opportunities they're leaving open for us
8. Recommended defensive or offensive actions for this week

Return: competitor-by-competitor analysis + overall landscape summary + top 3 recommended actions.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            landscape_summary: { type: 'string' },
            overall_threat_level: { type: 'string' },
            competitor_analyses: { type: 'array', items: { type: 'object', properties: {
              name: { type: 'string' },
              recent_moves: { type: 'array', items: { type: 'string' } },
              strengths: { type: 'array', items: { type: 'string' } },
              weaknesses: { type: 'array', items: { type: 'string' } },
              threat_level: { type: 'string' },
              likely_next_move: { type: 'string' },
              opportunities_left_open: { type: 'array', items: { type: 'string' } }
            }}},
            top_opportunities: { type: 'array', items: { type: 'string' } },
            recommended_actions: { type: 'array', items: { type: 'object', properties: {
              action: { type: 'string' },
              urgency: { type: 'string' },
              owner_agent: { type: 'string' }
            }}}
          }
        }
      });

      // Update competitor records with latest intel
      for (const ca of (result.competitor_analyses || [])) {
        const match = competitors.find(c => c.name.toLowerCase().includes(ca.name.toLowerCase()));
        if (match) {
          await base44.asServiceRole.entities.Competitor.update(match.id, {
            threat_level: ca.threat_level,
            recent_moves: ca.recent_moves,
            strengths: ca.strengths,
            weaknesses: ca.weaknesses,
            last_analyzed: new Date().toISOString()
          }).catch(() => null);
        }
      }
    }

    // ─── 3. SECTOR ANALYSIS ──────────────────────────────────────────────────
    if (action === 'sector_analysis') {
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Deep sector analysis for ${sector} in ${region}.

Analyze:
1. Current market size estimate and growth rate (CAGR)
2. Market segmentation — major sub-segments and their size
3. Competitive intensity (fragmented/consolidating/oligopoly)
4. Entry barriers (regulatory, capital, technical)
5. Key value drivers for customers
6. Pricing trends and pressure
7. Technology adoption rate — where is the sector on the digital curve?
8. Labor/talent dynamics
9. Geographic demand variation within ${region}
10. 3-year outlook: where is this sector heading?

Include: key growth drivers, structural risks, and the single biggest opportunity right now.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            market_size_estimate: { type: 'string' },
            growth_rate_cagr: { type: 'number' },
            competitive_intensity: { type: 'string' },
            major_segments: { type: 'array', items: { type: 'object', properties: { segment: { type: 'string' }, size_estimate: { type: 'string' }, growth: { type: 'string' } } } },
            entry_barriers: { type: 'array', items: { type: 'string' } },
            key_value_drivers: { type: 'array', items: { type: 'string' } },
            pricing_trends: { type: 'string' },
            technology_adoption: { type: 'string' },
            three_year_outlook: { type: 'string' },
            biggest_opportunity: { type: 'string' },
            structural_risks: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 4. POLICY WATCH ─────────────────────────────────────────────────────
    if (action === 'policy_watch') {
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Monitor regulatory and policy landscape for ${sector} in ${region}.

Track and report:
1. Recent regulatory changes (last 90 days) — what changed and when
2. Upcoming regulatory changes (proposed, in consultation, or imminent)
3. Enforcement actions and their implications
4. International best practices being adopted locally
5. Compliance cost implications
6. Timeline and certainty of upcoming changes
7. Which regulatory body is driving each change
8. Impact assessment for each change: opportunity/threat/neutral
9. Recommended preparation actions`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            recent_changes: { type: 'array', items: { type: 'object', properties: {
              change: { type: 'string' },
              effective_date: { type: 'string' },
              regulator: { type: 'string' },
              impact: { type: 'string' }
            }}},
            upcoming_changes: { type: 'array', items: { type: 'object', properties: {
              change: { type: 'string' },
              expected_date: { type: 'string' },
              certainty: { type: 'string' },
              impact: { type: 'string' },
              preparation_action: { type: 'string' }
            }}},
            overall_regulatory_risk: { type: 'string' },
            recommended_actions: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      for (const change of (result.upcoming_changes || [])) {
        await base44.asServiceRole.entities.MarketTrendAlert.create({
          trend_keyword: change.change,
          trend_category: 'regulatory',
          sector,
          trend_description: change.change,
          data_sources: ['government'],
          momentum: 'peak',
          urgency: change.certainty === 'high' ? 'high' : 'medium',
          threat_assessment: change.impact,
          recommended_action: change.preparation_action,
          status: 'monitoring'
        }).catch(() => null);
      }
    }

    // ─── 5. SENTIMENT ANALYSIS ────────────────────────────────────────────────
    if (action === 'sentiment_analysis') {
      const { target, sources } = params;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze market and customer sentiment for ${target || sector} in ${region}.

Sentiment sources to analyze: ${sources || 'reviews, social media, forums, news, Reddit, LinkedIn'}.

Measure sentiment (0-100, higher=positive) across:
1. Customer/participant sentiment — what do they love/hate?
2. Staff/workforce sentiment — employer reputation
3. Industry/provider sentiment — how do operators feel about the sector?
4. Community and media perception
5. Online review sentiment (compare us vs competitors if possible)

Identify:
- Top 5 praise themes
- Top 5 complaint themes
- Emerging negative signals to watch
- Specific language customers use (valuable for marketing)
- Net sentiment trajectory: improving/stable/declining`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            customer_sentiment_score: { type: 'number' },
            staff_sentiment_score: { type: 'number' },
            industry_sentiment_score: { type: 'number' },
            media_sentiment_score: { type: 'number' },
            overall_score: { type: 'number' },
            trajectory: { type: 'string' },
            top_praise: { type: 'array', items: { type: 'string' } },
            top_complaints: { type: 'array', items: { type: 'string' } },
            emerging_concerns: { type: 'array', items: { type: 'string' } },
            customer_language: { type: 'array', items: { type: 'string' } },
            recommended_actions: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 6. BATTLE CARD ──────────────────────────────────────────────────────
    if (action === 'battle_card') {
      const { competitor_name } = params;
      const competitors = await loadCompetitors();
      const comp = competitors.find(c => c.name.toLowerCase().includes((competitor_name || '').toLowerCase())) || {};

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a sales battle card for competing against: ${competitor_name || 'primary competitor'}.

Known about them: ${JSON.stringify({ name: comp.name, domain: comp.domain, strengths: comp.strengths, weaknesses: comp.weaknesses, recent_moves: comp.recent_moves })}

Create a complete battle card including:
1. Their elevator pitch (what they claim)
2. Their actual strengths (be honest — what they genuinely do well)
3. Their weaknesses (specific and exploitable)
4. Common objections they raise about us — and our killer responses
5. Where we win (our genuine advantages in head-to-head)
6. Where we're vulnerable (be honest — coach around these)
7. Messaging that resonates when competing against them
8. Landmine questions to ask prospects that reveal their gaps
9. Proof points to use against them (stats, testimonials)
10. Summary: when to compete aggressively vs walk away`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            competitor: { type: 'string' },
            their_pitch: { type: 'string' },
            their_strengths: { type: 'array', items: { type: 'string' } },
            their_weaknesses: { type: 'array', items: { type: 'string' } },
            objections_and_responses: { type: 'array', items: { type: 'object', properties: { objection: { type: 'string' }, response: { type: 'string' } } } },
            where_we_win: { type: 'array', items: { type: 'string' } },
            where_we_are_vulnerable: { type: 'array', items: { type: 'string' } },
            winning_messages: { type: 'array', items: { type: 'string' } },
            landmine_questions: { type: 'array', items: { type: 'string' } },
            compete_vs_walk_away: { type: 'string' }
          }
        }
      });
    }

    // ─── 7. MARKET BRIEFING ───────────────────────────────────────────────────
    if (action === 'market_briefing') {
      const { period } = params;
      const [competitors, trends] = await Promise.all([loadCompetitors(), loadTrends()]);

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a comprehensive market intelligence briefing for ${period || 'this week'}.

Current state:
- Sector: ${sector} | Region: ${region}
- Tracked competitors (${competitors.length}): ${competitors.map(c => c.name).join(', ')}
- Recent trends logged: ${trends.map(t => t.topic || t.title).slice(0, 10).join(', ')}

Generate a briefing covering:
🔴 CRITICAL: Things requiring action in the next 48 hours
🟡 WATCH: Important developments to track this week
🟢 OPPORTUNITIES: Market gaps and growth plays to capitalize on
📊 COMPETITOR LANDSCAPE: Most significant moves and threat assessment
📈 TREND HORIZON: What's emerging, building, and peaking
🎯 TOP 3 STRATEGIC ACTIONS: Ranked by urgency and impact, with agent assignments

Format as an executive briefing — clear, scannable, action-oriented.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            critical_alerts: { type: 'array', items: { type: 'object', properties: { alert: { type: 'string' }, action_required: { type: 'string' }, deadline: { type: 'string' } } } },
            watch_items: { type: 'array', items: { type: 'string' } },
            opportunities: { type: 'array', items: { type: 'object', properties: { opportunity: { type: 'string' }, potential: { type: 'string' }, recommended_action: { type: 'string' } } } },
            competitor_landscape: { type: 'string' },
            trend_horizon: { type: 'object', properties: { emerging: { type: 'array', items: { type: 'string' } }, building: { type: 'array', items: { type: 'string' } }, peaking: { type: 'array', items: { type: 'string' } } } },
            top_3_actions: { type: 'array', items: { type: 'object', properties: { action: { type: 'string' }, urgency: { type: 'string' }, owner_agent: { type: 'string' }, expected_impact: { type: 'string' } } } }
          }
        }
      });
    }

    // ─── 8. NICHE DISCOVERY ───────────────────────────────────────────────────
    if (action === 'niche_discovery') {
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Identify underserved niches and market gaps in ${sector} (${region}).

Analyze:
1. High-demand, low-supply segments — where is demand outpacing supply?
2. Geographic gaps — where is the sector underpenetrated geographically?
3. Demographic/customer segments being ignored by incumbents
4. Content and thought leadership gaps — topics no one is covering well
5. Service delivery model gaps — ways customers prefer to be served that aren't available
6. Price point gaps — segments priced out of existing solutions

For each niche identified:
- Market size estimate (searches/month or population)
- Current competition count and quality
- Our competitive advantage in this niche
- Time-to-dominate estimate (months to become the go-to player)
- First 3 actions to claim this niche

Rank by: (demand × unmet need) / competition. Top 5 opportunities.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            niches: { type: 'array', items: { type: 'object', properties: {
              niche_name: { type: 'string' },
              description: { type: 'string' },
              demand_signal: { type: 'string' },
              competition_count: { type: 'number' },
              competition_quality: { type: 'string' },
              our_advantage: { type: 'string' },
              months_to_dominate: { type: 'number' },
              first_3_actions: { type: 'array', items: { type: 'string' } },
              opportunity_score: { type: 'number' }
            }}},
            top_recommendation: { type: 'string' }
          }
        }
      });

      // Create growth strategies for top niches
      for (const niche of (result.niches || []).slice(0, 3)) {
        await base44.asServiceRole.entities.GrowthStrategy.create({
          title: `Niche Dominance: ${niche.niche_name}`,
          description: `${niche.description}. Our advantage: ${niche.our_advantage}. First actions: ${niche.first_3_actions?.join('; ')}`,
          status: 'proposed'
        }).catch(() => null);
      }
    }

    // ─── 9. REVIEW MINING ─────────────────────────────────────────────────────
    if (action === 'review_mining') {
      const { competitor_names } = params;
      const competitors = await loadCompetitors();
      const names = competitor_names || competitors.map(c => c.name);

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Mine negative reviews of competitors to identify warm leads and intelligence.

Competitors to analyze: ${names.join(', ')}
Sector: ${sector} | Region: ${region}

Search for patterns in 1-3 star reviews, complaints, and forum discussions. Identify:
1. Most common complaints about each competitor (with frequency)
2. Specific pain points that customers say drove them to look elsewhere
3. Switching triggers: what events make customers finally leave?
4. Language patterns: exact phrases frustrated customers use (for ad targeting)
5. Geographic clusters: are complaints concentrated in specific areas?
6. What customers are specifically looking for that competitors aren't delivering
7. Estimated volume of dissatisfied customers per competitor per month

Generate: lead acquisition strategy based on this intelligence.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            competitor_complaints: { type: 'array', items: { type: 'object', properties: {
              competitor: { type: 'string' },
              top_complaints: { type: 'array', items: { type: 'string' } },
              switching_triggers: { type: 'array', items: { type: 'string' } },
              customer_language: { type: 'array', items: { type: 'string' } },
              monthly_dissatisfied_estimate: { type: 'number' }
            }}},
            lead_acquisition_strategy: { type: 'string' },
            ad_targeting_phrases: { type: 'array', items: { type: 'string' } },
            total_addressable_warm_leads_monthly: { type: 'number' }
          }
        }
      });
    }

    // ─── 10. COMMUNITY MAP ────────────────────────────────────────────────────
    if (action === 'community_map') {
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Map all relevant online communities where our target customers gather in ${sector} (${region}).

Search across: Reddit, Facebook Groups, LinkedIn Groups, Slack/Discord communities, industry forums, Whirlpool, specialized communities.

For each community found:
1. Platform and community name/URL
2. Active member count
3. Daily activity level (posts/day estimate)
4. ICP alignment (% of members matching our ideal customer)
5. Current sentiment toward existing solutions (frustrated/satisfied/neutral)
6. Presence of competitors or vendors already (heavy/light/none)
7. Opportunity level (how open are they to helpful resources?)
8. Recommended engagement approach

Prioritize: communities with high frustration + low vendor presence + high ICP alignment.
Output: top 10 communities with engagement playbook for each.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            communities: { type: 'array', items: { type: 'object', properties: {
              platform: { type: 'string' },
              name: { type: 'string' },
              url: { type: 'string' },
              member_count: { type: 'number' },
              daily_posts: { type: 'number' },
              icp_alignment_percent: { type: 'number' },
              sentiment_toward_solutions: { type: 'string' },
              competitor_presence: { type: 'string' },
              opportunity_level: { type: 'string' },
              engagement_approach: { type: 'string' },
              estimated_leads_per_month: { type: 'number' }
            }}},
            total_addressable_audience: { type: 'number' },
            top_3_to_prioritize: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 11. COMPETITOR PREDICTION ────────────────────────────────────────────
    if (action === 'competitor_prediction') {
      const competitors = await loadCompetitors();

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Predict competitors' next strategic moves using pattern analysis and current signals.

Tracked competitors: ${JSON.stringify(competitors.slice(0, 10).map(c => ({
  name: c.name, threat_level: c.threat_level, recent_moves: c.recent_moves, strengths: c.strengths
})))}

Sector: ${sector} | Region: ${region}

For each competitor, predict:
1. Most likely next move (with confidence %)
2. Timeline: when will this happen (weeks/months)?
3. What signals led you to this prediction?
4. Impact on us if prediction is correct
5. Pre-emptive actions we should take now

Also predict:
- Most likely new market entrant in next 6 months
- Most likely acquisition or partnership deal
- Most likely pricing disruption

Confidence levels: high (>70%) / medium (40-70%) / low (<40%)`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            competitor_predictions: { type: 'array', items: { type: 'object', properties: {
              competitor: { type: 'string' },
              predicted_move: { type: 'string' },
              confidence_percent: { type: 'number' },
              timeline: { type: 'string' },
              signals: { type: 'array', items: { type: 'string' } },
              impact_on_us: { type: 'string' },
              preemptive_actions: { type: 'array', items: { type: 'string' } }
            }}},
            new_entrant_prediction: { type: 'string' },
            acquisition_prediction: { type: 'string' },
            pricing_disruption_prediction: { type: 'string' }
          }
        }
      });
    }

    // ─── 12. LANDSCAPE REPORT ─────────────────────────────────────────────────
    if (action === 'landscape_report') {
      const { focus_area } = params;
      const competitors = await loadCompetitors();

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a comprehensive competitive landscape report for ${focus_area || sector} in ${region}.

Competitors tracked: ${competitors.map(c => c.name).join(', ')}

Report structure:
1. Executive Summary (5 key takeaways)
2. Market Overview (size, growth, dynamics)
3. Competitive Positioning Map (who is where on price/quality axes)
4. Player-by-player SWOT (our main competitors)
5. Our Competitive Position (honest assessment of strengths and gaps)
6. White Space Analysis (what's unclaimed)
7. Strategic Recommendations (3 offensive moves, 3 defensive moves)
8. 12-month outlook

Format as a professional intelligence report.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            executive_summary: { type: 'array', items: { type: 'string' } },
            market_overview: { type: 'string' },
            positioning_insights: { type: 'string' },
            competitor_swots: { type: 'array', items: { type: 'object', properties: {
              competitor: { type: 'string' },
              strengths: { type: 'array', items: { type: 'string' } },
              weaknesses: { type: 'array', items: { type: 'string' } },
              opportunities: { type: 'array', items: { type: 'string' } },
              threats: { type: 'array', items: { type: 'string' } }
            }}},
            our_position: { type: 'string' },
            white_space: { type: 'array', items: { type: 'string' } },
            offensive_moves: { type: 'array', items: { type: 'string' } },
            defensive_moves: { type: 'array', items: { type: 'string' } },
            twelve_month_outlook: { type: 'string' }
          }
        }
      });

      // Archive as report
      await base44.asServiceRole.entities.Report.create({
        title: `Competitive Landscape Report — ${focus_area || sector}`,
        type: 'competitive_intelligence',
        content: JSON.stringify(result),
        status: 'published'
      }).catch(() => null);
    }

    // ─── 13. SOCIAL TRENDS ────────────────────────────────────────────────────
    if (action === 'social_trends') {
      const { platforms } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Detect real-time social media trends relevant to ${sector} in ${region}.

Platforms: ${platforms || 'LinkedIn, Twitter/X, Reddit, Instagram, TikTok, Facebook'}

For each trending topic/hashtag detected:
1. Topic and primary hashtag
2. Where it's trending (platform + geography)
3. Growth velocity (viral/fast-growing/emerging/early)
4. Relevance score 1-10
5. Urgency window: 24h / 72h / 7-30 days
6. Best content angle to take
7. Visual aesthetic trending alongside it
8. Optimal publish time
9. Specific brief for Maestro and Canvas

Classify by urgency: 🔴 Act Now | 🟡 Act Soon | 🟢 Build Toward`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            trends: { type: 'array', items: { type: 'object', properties: {
              topic: { type: 'string' },
              hashtag: { type: 'string' },
              platform: { type: 'string' },
              velocity: { type: 'string' },
              relevance_score: { type: 'number' },
              urgency: { type: 'string' },
              content_angle: { type: 'string' },
              visual_aesthetic: { type: 'string' },
              optimal_publish_time: { type: 'string' },
              maestro_brief: { type: 'string' },
              canvas_brief: { type: 'string' }
            }}},
            top_opportunity: { type: 'string' }
          }
        }
      });
    }

    // ─── 14. INFLUENCER RADAR ─────────────────────────────────────────────────
    if (action === 'influencer_radar') {
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Scan for influencer opportunities in ${sector} (${region}).

Identify thought leaders, micro-influencers, and community voices relevant to our sector.

For each influencer found:
1. Name/handle and primary platform
2. Follower count and engagement rate
3. Niche alignment score (1-10)
4. Audience ICP match (%)
5. Content style and topics
6. Signal type: organic mention / industry commentary / brand-adjacent
7. Outreach approach recommendation
8. Estimated audience value (leads potential)
9. Priority: high/medium/low

Prioritize: micro-influencers (10k-200k) with high engagement over mega-influencers with low engagement.
Flag any who have organically mentioned us or our sector recently.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            influencers: { type: 'array', items: { type: 'object', properties: {
              name: { type: 'string' },
              handle: { type: 'string' },
              platform: { type: 'string' },
              follower_count: { type: 'number' },
              engagement_rate: { type: 'number' },
              niche_alignment: { type: 'number' },
              icp_match_percent: { type: 'number' },
              signal_type: { type: 'string' },
              outreach_approach: { type: 'string' },
              leads_potential: { type: 'string' },
              priority: { type: 'string' }
            }}},
            top_priority: { type: 'string' }
          }
        }
      });
    }

    // ─── 15. MARKET ENTRY ─────────────────────────────────────────────────────
    if (action === 'market_entry') {
      const { target_segment, target_geography } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Market entry analysis for ${target_segment || 'new segment'} in ${target_geography || region}.

Analyze:
1. Market size and addressable opportunity
2. Competitive intensity and key players already there
3. Regulatory requirements and compliance burden
4. Customer acquisition approach for this segment
5. Required capabilities we may not have
6. Estimated time to profitability
7. Go-to-market strategy recommendation (step-by-step)
8. Risk assessment (3 biggest risks and mitigation)
9. Investment required (rough estimate)
10. Verdict: strong opportunity / proceed with caution / avoid`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            market_size: { type: 'string' },
            addressable_opportunity: { type: 'string' },
            competitive_intensity: { type: 'string' },
            key_competitors: { type: 'array', items: { type: 'string' } },
            regulatory_requirements: { type: 'array', items: { type: 'string' } },
            customer_acquisition_approach: { type: 'string' },
            capability_gaps: { type: 'array', items: { type: 'string' } },
            time_to_profitability: { type: 'string' },
            gtm_steps: { type: 'array', items: { type: 'string' } },
            top_risks: { type: 'array', items: { type: 'object', properties: { risk: { type: 'string' }, mitigation: { type: 'string' } } } },
            verdict: { type: 'string' },
            verdict_reasoning: { type: 'string' }
          }
        }
      });
    }

    // ─── 16. MACRO INTELLIGENCE ───────────────────────────────────────────────
    if (action === 'macro_intelligence') {
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze macroeconomic factors affecting ${sector} in ${region}.

Assess:
1. Current economic conditions (GDP, inflation, interest rates, employment)
2. How these conditions specifically affect our sector and customers
3. Consumer/business spending trends — are customers tightening or loosening budgets?
4. Government spending and policy tailwinds/headwinds for our sector
5. Currency and international trade impacts (if relevant)
6. 6-12 month economic outlook and implications
7. Specific risks: recession risk, inflation impact on margins, interest rate sensitivity
8. Recommendations: what should we do given current macro conditions?`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            economic_conditions: { type: 'string' },
            sector_impact: { type: 'string' },
            spending_trends: { type: 'string' },
            government_policy_impact: { type: 'string' },
            six_month_outlook: { type: 'string' },
            key_risks: { type: 'array', items: { type: 'object', properties: { risk: { type: 'string' }, likelihood: { type: 'string' }, impact: { type: 'string' } } } },
            recommendations: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 17. DISRUPTION RISK ──────────────────────────────────────────────────
    if (action === 'disruption_risk') {
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Assess disruption risk for ${sector} in ${region}.

Identify technologies, business models, or external forces that could disrupt this sector.

For each disruption risk:
1. What is the disrupting force?
2. Which part of the value chain does it attack?
3. Time to impact estimate (years)
4. Likelihood (high/medium/low)
5. Who is currently building this (startups, big tech, incumbents)?
6. Can we adapt or must we defend?
7. Recommended strategic response

Overall: disruption timeline for the sector, and where we sit on the vulnerability curve.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            disruption_risks: { type: 'array', items: { type: 'object', properties: {
              force: { type: 'string' },
              description: { type: 'string' },
              value_chain_target: { type: 'string' },
              years_to_impact: { type: 'number' },
              likelihood: { type: 'string' },
              current_builders: { type: 'array', items: { type: 'string' } },
              strategic_response: { type: 'string' }
            }}},
            overall_disruption_timeline: { type: 'string' },
            our_vulnerability: { type: 'string' },
            recommended_posture: { type: 'string' }
          }
        }
      });
    }


    // 18. SIGNAL INTAKE HUB
    if (action === 'signal_intake_hub') {
      const [competitors, trends] = await Promise.all([loadCompetitors(), loadTrends()]);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Build an omnidirectional signal intake brief for Compass.

Tracked competitors: ${competitors.length}
Tracked trends: ${trends.length}
Sector: ${sector}, Region: ${region}

Return:
1) source coverage quality
2) blind spots in intake
3) signal-to-noise improvements
4) top new source categories to add`,
        response_json_schema: {
          type: 'object',
          properties: {
            source_coverage: { type: 'array', items: { type: 'object', properties: { source_type: { type: 'string' }, status: { type: 'string' }, confidence: { type: 'string' } } } },
            blind_spots: { type: 'array', items: { type: 'string' } },
            noise_reduction_moves: { type: 'array', items: { type: 'string' } },
            source_expansion_plan: { type: 'array', items: { type: 'string' } },
          },
        },
      });
    }

    // 19. COMPETITOR DNA PROFILE
    if (action === 'competitor_dna_profile') {
      const competitors = await loadCompetitors();
      const competitor_name = params.competitor_name || '';
      const target = competitors.find(c => c.name?.toLowerCase().includes(String(competitor_name).toLowerCase())) || competitors[0] || {};
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a competitor DNA profile.

Competitor: ${target.name || competitor_name || 'primary competitor'}
Known data: ${JSON.stringify(target)}

Return:
1) business model DNA
2) positioning DNA
3) go-to-market DNA
4) talent and execution DNA
5) strategic intent and likely expansion vectors`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            competitor: { type: 'string' },
            business_model_dna: { type: 'array', items: { type: 'string' } },
            positioning_dna: { type: 'array', items: { type: 'string' } },
            gtm_dna: { type: 'array', items: { type: 'string' } },
            talent_execution_dna: { type: 'array', items: { type: 'string' } },
            strategic_intent: { type: 'string' },
            expansion_vectors: { type: 'array', items: { type: 'string' } },
          },
        },
      });
    }

    // 20. WAR GAME SIMULATION
    if (action === 'war_game_simulation') {
      const move = params.our_move || 'entering a new segment with aggressive offer';
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Run competitive war game simulation.

Our move: ${move}
Sector: ${sector}, Region: ${region}

Simulate likely competitor responses in 3 rounds and give counter-moves, risk levels, and expected outcome distribution.`,
        response_json_schema: {
          type: 'object',
          properties: {
            rounds: { type: 'array', items: { type: 'object', properties: { round: { type: 'number' }, competitor_response: { type: 'string' }, our_counter: { type: 'string' }, risk: { type: 'string' } } } },
            outcome_distribution: { type: 'array', items: { type: 'string' } },
            recommended_path: { type: 'string' },
          },
        },
      });
    }

    // 21. EARLY WARNING RADAR
    if (action === 'early_warning_radar') {
      const [competitors, trends] = await Promise.all([loadCompetitors(), loadTrends()]);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Create strategic early warning radar.

Competitors: ${competitors.length}, trends: ${trends.length}

Return:
1) critical alerts in next 30 days
2) early warning indicators to monitor weekly
3) trigger thresholds and escalation routes
4) specific owner agent mapping`,
        response_json_schema: {
          type: 'object',
          properties: {
            critical_alerts: { type: 'array', items: { type: 'object', properties: { alert: { type: 'string' }, horizon: { type: 'string' }, trigger: { type: 'string' }, owner_agent: { type: 'string' } } } },
            warning_indicators: { type: 'array', items: { type: 'string' } },
            escalation_routes: { type: 'array', items: { type: 'string' } },
            response_playbooks: { type: 'array', items: { type: 'string' } },
          },
        },
      });
    }

    // 22. INTELLIGENCE FUSION GRAPH
    if (action === 'intelligence_fusion_graph') {
      const [competitors, trends] = await Promise.all([loadCompetitors(), loadTrends()]);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Build an intelligence fusion graph brief.

Competitors: ${JSON.stringify(competitors.slice(0, 20).map(c => ({ name: c.name, threat: c.threat_level })))}
Trends: ${JSON.stringify(trends.slice(0, 20).map(t => ({ topic: t.topic || t.title, momentum: t.momentum })))}

Return core entities, links, hidden relationships, and priority intelligence hypotheses to test.`,
        response_json_schema: {
          type: 'object',
          properties: {
            entities: { type: 'array', items: { type: 'string' } },
            key_links: { type: 'array', items: { type: 'string' } },
            hidden_relationships: { type: 'array', items: { type: 'string' } },
            hypotheses_to_test: { type: 'array', items: { type: 'string' } },
          },
        },
      });
    }

    // 23. SOURCE QUALITY CALIBRATION
    if (action === 'source_quality_calibration') {
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Design source quality calibration model for Compass.

Need scoring dimensions for reliability, timeliness, predictive power, and noise.
Return scoring model, reweighting logic, and weekly calibration loop.`,
        response_json_schema: {
          type: 'object',
          properties: {
            scoring_dimensions: { type: 'array', items: { type: 'string' } },
            weighting_model: { type: 'array', items: { type: 'string' } },
            reweighting_logic: { type: 'array', items: { type: 'string' } },
            calibration_loop: { type: 'array', items: { type: 'string' } },
          },
        },
      });
    }

    // 24. COMPASS FULL SELF TEST
    if (action === 'compass_full_self_test') {
      const [briefing, competitor, trendsScan, warning, fusion] = await Promise.all([
        base44.functions.invoke('compassMarketIntelligence', { action: 'market_briefing' }).then((r: any) => r.data?.result).catch(() => null),
        base44.functions.invoke('compassMarketIntelligence', { action: 'analyze_competitors' }).then((r: any) => r.data?.result).catch(() => null),
        base44.functions.invoke('compassMarketIntelligence', { action: 'monitor_trends' }).then((r: any) => r.data?.result).catch(() => null),
        base44.functions.invoke('compassMarketIntelligence', { action: 'early_warning_radar' }).then((r: any) => r.data?.result).catch(() => null),
        base44.functions.invoke('compassMarketIntelligence', { action: 'intelligence_fusion_graph' }).then((r: any) => r.data?.result).catch(() => null),
      ]);

      result = {
        briefing,
        competitor,
        trendsScan,
        warning,
        fusion,
        checks: {
          briefing_ok: Boolean(briefing),
          competitor_ok: Boolean(competitor),
          trends_ok: Boolean(trendsScan),
          warning_ok: Boolean(warning),
          fusion_ok: Boolean(fusion),
        },
      };
    }
    if (!result) {
      result = {
        message: `Action '${action}' received. Available: monitor_trends, analyze_competitors, sector_analysis, policy_watch, sentiment_analysis, battle_card, market_briefing, niche_discovery, review_mining, community_map, competitor_prediction, landscape_report, social_trends, influencer_radar, market_entry, macro_intelligence, disruption_risk, signal_intake_hub, competitor_dna_profile, war_game_simulation, early_warning_radar, intelligence_fusion_graph, source_quality_calibration, compass_full_self_test`
      };
    }

    return Response.json({ status: 'compass_complete', action, sector, result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
