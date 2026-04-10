import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const { action } = payload;
    let result = null;

    // ─────────────────────────────────────────────
    // 1. STRATEGIC PLANNING & INTELLIGENCE
    // ─────────────────────────────────────────────

    if (action === 'market_competitor_analysis') {
      const { competitors, industry, focus_areas } = payload;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a senior marketing strategist. Conduct a deep competitive analysis for a business in the ${industry} industry.
Competitors to analyse: ${competitors || 'top 3 industry competitors'}
Focus areas: ${focus_areas || 'messaging, channels, pricing, content strategy, gaps'}

Deliver:
1. Competitor Profiles: positioning, key messages, channels, content strategy, ad spend estimation
2. Competitive Gaps: what they're NOT doing that we can own
3. Keyword & Messaging Opportunities
4. Channel Weaknesses (where competitors are underperforming)
5. Our Recommended Differentiation Strategy
6. 3 Immediate Action Items to outcompete them this month`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            competitor_profiles: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, positioning: { type: 'string' }, key_channels: { type: 'array', items: { type: 'string' } }, strengths: { type: 'array', items: { type: 'string' } }, weaknesses: { type: 'array', items: { type: 'string' } } } } },
            competitive_gaps: { type: 'array', items: { type: 'string' } },
            messaging_opportunities: { type: 'array', items: { type: 'string' } },
            differentiation_strategy: { type: 'string' },
            immediate_actions: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    if (action === 'trend_forecast') {
      const { industry, timeframe, regions } = payload;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a trend intelligence analyst. Identify and forecast emerging marketing trends for the ${industry} industry.
Timeframe: ${timeframe || 'next 30-90 days'}
Regions: ${regions || 'Australia, Global'}

Deliver:
1. Top 5 Emerging Trends (with momentum score 1-10, evidence, and projected peak)
2. Hashtag & Keyword Trends to capitalize on now
3. Content Format Trends (e.g., short video, interactive, UGC)
4. Consumer Sentiment Shifts
5. Platform Algorithm Changes affecting reach
6. Campaign Ideas for each top trend
7. Risks of NOT adapting`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            emerging_trends: { type: 'array', items: { type: 'object', properties: { trend: { type: 'string' }, momentum_score: { type: 'number' }, description: { type: 'string' }, campaign_idea: { type: 'string' }, projected_peak: { type: 'string' } } } },
            trending_hashtags: { type: 'array', items: { type: 'string' } },
            content_format_trends: { type: 'array', items: { type: 'string' } },
            sentiment_shifts: { type: 'string' },
            risks_of_inaction: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    if (action === 'audience_segmentation') {
      const { business_type, current_customers, goals } = payload;
      const leads = await base44.asServiceRole.entities.Lead.list('-created_date', 50).catch(() => []);
      const clients = await base44.asServiceRole.entities.Client.list('-created_date', 50).catch(() => []);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a customer intelligence specialist. Build detailed audience segments and buyer personas.
Business: ${business_type || 'service business'}
Goals: ${goals || 'lead gen and retention'}
CRM data snapshot: ${JSON.stringify({ lead_count: leads.length, client_count: clients.length })}

Deliver:
1. 4-6 Audience Segments (name, size estimate, demographics, psychographics, pain points, motivators)
2. Detailed Buyer Persona for top 2 segments (day in their life, buying triggers, objections, preferred channels)
3. Messaging Matrix (what message resonates with each segment)
4. Channel Preference Map (where each segment lives online)
5. Content Format Preferences per segment
6. Budget Priority (which segment to invest in most, why)`,
        response_json_schema: {
          type: 'object',
          properties: {
            segments: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, description: { type: 'string' }, demographics: { type: 'string' }, psychographics: { type: 'string' }, pain_points: { type: 'array', items: { type: 'string' } }, preferred_channels: { type: 'array', items: { type: 'string' } }, priority_score: { type: 'number' } } } },
            buyer_personas: { type: 'array', items: { type: 'object' } },
            messaging_matrix: { type: 'object' },
            budget_priority_recommendation: { type: 'string' }
          }
        }
      });
    }

    if (action === 'budget_allocation') {
      const { total_budget, objective, channels, industry } = payload;
      const campaigns = await base44.asServiceRole.entities.Campaign.list('-created_date', 20).catch(() => []);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a media planning expert. Optimize marketing budget allocation for maximum ROI.
Total Budget: $${total_budget || '5000'} per month
Primary Objective: ${objective || 'lead generation and brand awareness'}
Available Channels: ${channels || 'Facebook Ads, Google Ads, Email, LinkedIn, SEO, Content'}
Industry: ${industry || 'general'}
Existing campaigns: ${campaigns.length} running

Deliver:
1. Recommended Channel Split (% and $ per channel with rationale)
2. Expected ROI per channel (leads, impressions, conversions)
3. Phased Budget Plan (Month 1: test, Month 2-3: scale winners)
4. Budget Guardrails (never spend more than X on Y without this metric)
5. Reallocation Triggers (when to shift budget based on performance signals)
6. Cost Benchmarks per channel (CPL, CPC, CPM estimates)
7. Total projected outcomes (leads, revenue) at this budget level`,
        response_json_schema: {
          type: 'object',
          properties: {
            channel_allocation: { type: 'array', items: { type: 'object', properties: { channel: { type: 'string' }, percentage: { type: 'number' }, monthly_budget: { type: 'number' }, expected_leads: { type: 'number' }, rationale: { type: 'string' } } } },
            phased_plan: { type: 'object' },
            reallocation_triggers: { type: 'array', items: { type: 'string' } },
            projected_total_leads: { type: 'number' },
            projected_revenue: { type: 'number' }
          }
        }
      });
    }

    if (action === 'goal_setting') {
      const { business_goals, timeframe, current_metrics } = payload;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a marketing strategist. Set SMART marketing KPIs aligned with business goals.
Business Goals: ${business_goals || 'grow revenue by 30%'}
Timeframe: ${timeframe || '90 days'}
Current Metrics: ${current_metrics || 'unknown - set baseline benchmarks'}

Deliver:
1. North Star KPI (the one metric that matters most)
2. Full KPI Framework (5-8 SMART KPIs with targets, owners, measurement cadence)
3. Leading Indicators (early signals before KPIs move)
4. Lagging Indicators (confirmation KPIs)
5. Weekly/Monthly Review Checklist
6. Warning Triggers (what signals mean strategy needs changing)
7. 30/60/90 Day Milestone Plan`,
        response_json_schema: {
          type: 'object',
          properties: {
            north_star_kpi: { type: 'object', properties: { metric: { type: 'string' }, target: { type: 'string' }, measurement: { type: 'string' } } },
            kpi_framework: { type: 'array', items: { type: 'object', properties: { kpi: { type: 'string' }, target: { type: 'string' }, owner: { type: 'string' }, frequency: { type: 'string' } } } },
            milestone_30: { type: 'string' },
            milestone_60: { type: 'string' },
            milestone_90: { type: 'string' },
            warning_triggers: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─────────────────────────────────────────────
    // 2. CONTENT CREATION & GENERATIVE AI
    // ─────────────────────────────────────────────

    if (action === 'generate_copy') {
      const { copy_type, topic, audience, tone, brand_voice, word_count, variations } = payload;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a world-class copywriter. Generate high-converting ${copy_type || 'marketing copy'}.
Topic/Product: ${topic}
Audience: ${audience || 'general'}
Tone: ${tone || 'professional and engaging'}
Brand Voice Notes: ${brand_voice || 'none specified'}
Length: ${word_count || 'appropriate for format'}
Variations: ${variations || 3}

Generate:
1. ${variations || 3} variations of the ${copy_type}
2. For each: headline/subject, body copy, CTA, emotional hook
3. A/B test rationale (what each variation tests)
4. SEO keywords naturally included (if applicable)
5. Compliance note (any claims to verify)
Format for immediate use.`,
        response_json_schema: {
          type: 'object',
          properties: {
            variations: { type: 'array', items: { type: 'object', properties: { version: { type: 'string' }, headline: { type: 'string' }, body: { type: 'string' }, cta: { type: 'string' }, hook: { type: 'string' }, ab_test_rationale: { type: 'string' } } } },
            best_bet: { type: 'string' },
            compliance_note: { type: 'string' }
          }
        }
      });
    }

    if (action === 'content_repurpose') {
      const { source_content, source_type, target_formats } = payload;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a content repurposing specialist. Transform this ${source_type || 'content'} into multiple high-performing formats.

SOURCE CONTENT:
${source_content}

TARGET FORMATS: ${target_formats || 'LinkedIn post, Twitter thread, Instagram caption, Email newsletter intro, TikTok script, YouTube description, Blog intro, SMS message'}

For each format, produce ready-to-publish content that is natively optimized for that platform (length, tone, hooks, hashtags, CTAs).
Also include: image/visual direction brief for each.`,
        response_json_schema: {
          type: 'object',
          properties: {
            repurposed: { type: 'array', items: { type: 'object', properties: { format: { type: 'string' }, content: { type: 'string' }, visual_brief: { type: 'string' }, optimal_post_time: { type: 'string' } } } },
            content_calendar_suggestion: { type: 'string' }
          }
        }
      });
    }

    if (action === 'video_script') {
      const { topic, platform, duration_seconds, style, cta } = payload;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a viral video scriptwriter. Write a high-retention script for ${platform || 'TikTok/Instagram Reels'}.
Topic: ${topic}
Duration: ${duration_seconds || 30} seconds
Style: ${style || 'engaging, fast-paced, educational-entertainment'}
CTA: ${cta || 'follow for more'}

Deliver:
1. Hook (first 3 seconds - must stop the scroll)
2. Full script with scene-by-scene breakdown
3. On-screen text / captions at key moments
4. B-roll directions
5. Music mood suggestion
6. Trending audio recommendations
7. Thumbnail concept
8. Caption + hashtags for posting`,
        response_json_schema: {
          type: 'object',
          properties: {
            hook: { type: 'string' },
            script: { type: 'array', items: { type: 'object', properties: { timestamp: { type: 'string' }, speaker: { type: 'string' }, dialogue: { type: 'string' }, on_screen_text: { type: 'string' }, visual: { type: 'string' } } } },
            thumbnail_concept: { type: 'string' },
            caption: { type: 'string' },
            hashtags: { type: 'array', items: { type: 'string' } },
            music_mood: { type: 'string' }
          }
        }
      });
    }

    if (action === 'generate_image_brief') {
      const { campaign_name, visual_style, platforms, brand_colors, message } = payload;
      const imageResult = await base44.integrations.Core.GenerateImage({
        prompt: `Professional marketing visual: ${message || campaign_name}. Style: ${visual_style || 'modern, clean, corporate'}. Colors: ${brand_colors || 'blue and white'}. Platform: ${platforms || 'social media'}. High quality, advertising ready.`
      });
      result = {
        generated_image_url: imageResult.url,
        visual_briefs: await base44.integrations.Core.InvokeLLM({
          prompt: `Generate detailed visual briefs for a marketing campaign: "${campaign_name}". Message: ${message}. Style: ${visual_style}. Platforms: ${platforms}.
For each platform (Instagram Post, Instagram Story, LinkedIn, Facebook, Twitter/X), specify: composition, color palette, typography style, imagery direction, mood, CTA placement.`,
          response_json_schema: {
            type: 'object',
            properties: {
              briefs: { type: 'array', items: { type: 'object', properties: { platform: { type: 'string' }, dimensions: { type: 'string' }, composition: { type: 'string' }, color_palette: { type: 'string' }, typography: { type: 'string' }, imagery: { type: 'string' }, mood: { type: 'string' } } } }
            }
          }
        })
      };
    }

    // ─────────────────────────────────────────────
    // 3. MULTI-CHANNEL CAMPAIGN ORCHESTRATION
    // ─────────────────────────────────────────────

    if (action === 'create_campaign') {
      const { campaign_brief, industry, target_audience, budget, objective, channels, duration_weeks } = payload;
      const strategy = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Maestro, a senior marketing strategist. Design a comprehensive multi-channel campaign.
Brief: ${campaign_brief}
Industry: ${industry || 'general'}
Target Audience: ${target_audience || 'adults 25-45'}
Budget: $${budget || '2000'}
Objective: ${objective || 'lead generation'}
Channels: ${channels || 'email, social media, paid ads'}
Duration: ${duration_weeks || 4} weeks

Deliver a complete campaign plan:
1. Campaign Name & Concept (big creative idea)
2. Channel Strategy (what to do on each channel, with budget split)
3. Week-by-Week Timeline & Content Calendar
4. Email Sequence (3-5 emails with subject lines and key messages)
5. Social Post Schedule (5-7 posts with captions, hashtags, visual direction)
6. Paid Ad Strategy (ad types, targeting, daily budget, bid strategy)
7. Landing Page Copy (headline, subheadline, bullet points, CTA)
8. KPIs & Success Metrics
9. A/B Tests to run from day 1`,
        response_json_schema: {
          type: 'object',
          properties: {
            campaign_name: { type: 'string' },
            concept: { type: 'string' },
            channel_strategy: { type: 'object' },
            timeline: { type: 'array', items: { type: 'object' } },
            email_sequence: { type: 'array', items: { type: 'object' } },
            social_posts: { type: 'array', items: { type: 'object' } },
            paid_ad_strategy: { type: 'object' },
            landing_page: { type: 'object' },
            kpis: { type: 'array', items: { type: 'string' } },
            ab_tests: { type: 'array', items: { type: 'string' } }
          }
        }
      });
      const campaign = await base44.asServiceRole.entities.Campaign.create({
        name: strategy.campaign_name || campaign_brief,
        objective: objective || 'lead_generation',
        status: 'draft',
        channels: (channels || 'email,social,paid_ads').split(',').map(s => s.trim()),
        budget: parseFloat(budget) || 2000,
        start_date: new Date().toISOString().split('T')[0],
        notes: JSON.stringify(strategy)
      }).catch(() => null);
      result = { campaign_id: campaign?.id, strategy };
    }

    if (action === 'generate_email_flow') {
      const { email_goal, target_audience, industry, trigger, num_emails } = payload;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an email marketing specialist. Design a high-converting email automation sequence.
Goal: ${email_goal || 'nurture leads to conversion'}
Audience: ${target_audience || 'prospects'}
Industry: ${industry || 'general'}
Trigger: ${trigger || 'new subscriber/lead'}
Number of emails: ${num_emails || 7}

For each email produce:
- Subject line (primary + A/B variant)
- Preview text
- Full body copy (personalization tokens, power words, storytelling)
- CTA (button text + URL placeholder)
- Send delay from trigger
- Segment/personalization rules
- Expected open rate benchmark

Also include: automation flow diagram description, re-engagement branch if no open by email 4.`,
        response_json_schema: {
          type: 'object',
          properties: {
            sequence_name: { type: 'string' },
            emails: { type: 'array', items: { type: 'object', properties: { email_number: { type: 'number' }, subject_primary: { type: 'string' }, subject_ab_variant: { type: 'string' }, preview_text: { type: 'string' }, body: { type: 'string' }, cta_text: { type: 'string' }, send_delay_hours: { type: 'number' }, personalization_rules: { type: 'string' } } } },
            re_engagement_branch: { type: 'string' },
            automation_notes: { type: 'string' }
          }
        }
      });
    }

    if (action === 'social_content_suite') {
      const { topic, platforms, tone, brand_voice, posting_frequency } = payload;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a social media expert. Create a complete social content suite.
Topic/Campaign: ${topic}
Platforms: ${platforms || 'Instagram, TikTok, LinkedIn, Facebook, Twitter/X'}
Tone: ${tone || 'professional but engaging'}
Brand Voice: ${brand_voice || 'authentic, helpful, expert'}
Posting Frequency: ${posting_frequency || 'daily for 2 weeks'}

For each platform, generate:
- 5 post variations (mix of educational, entertaining, promotional, social proof, engagement bait)
- Platform-native format (carousel idea, reel concept, poll, story, etc.)
- Caption (full text with emojis)
- Hashtag sets (niche + broad, 15-30 tags for Instagram, 3-5 for LinkedIn)
- Best posting times
- Engagement prompt (question or CTA to boost comments)
- Visual direction brief`,
        response_json_schema: {
          type: 'object',
          properties: {
            instagram: { type: 'array', items: { type: 'object' } },
            tiktok: { type: 'array', items: { type: 'object' } },
            linkedin: { type: 'array', items: { type: 'object' } },
            facebook: { type: 'array', items: { type: 'object' } },
            twitter: { type: 'array', items: { type: 'object' } },
            posting_schedule: { type: 'string' }
          }
        }
      });
    }

    if (action === 'paid_ads_strategy') {
      const { platform, objective, budget_daily, audience, product, creative_direction } = payload;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a paid advertising expert (ex-Google/Meta). Create a full paid ads strategy.
Platform(s): ${platform || 'Facebook/Instagram Ads, Google Ads'}
Objective: ${objective || 'conversions / lead gen'}
Daily Budget: $${budget_daily || '50'}
Audience: ${audience || 'lookalike + interest targeting'}
Product/Service: ${product}
Creative Direction: ${creative_direction || 'to be determined'}

Deliver:
1. Campaign Structure (campaigns > ad sets > ads hierarchy)
2. Audience Targeting (cold, warm, hot — layered approach)
3. Ad Formats to use (and why)
4. Ad Copy Variations (3 headlines, 3 primary texts, 3 CTAs each)
5. Creative Brief for design team (image and video)
6. Bidding Strategy (manual vs automated, target CPA/ROAS)
7. Tracking & Pixel Setup Requirements
8. A/B Test Plan (what to test in phase 1 vs phase 2)
9. Scale Triggers (at what ROAS/CPL to increase budget)
10. Estimated Performance (CTR, CPC, CPL, ROAS benchmarks)`,
        response_json_schema: {
          type: 'object',
          properties: {
            campaign_structure: { type: 'object' },
            audiences: { type: 'array', items: { type: 'object', properties: { type: { type: 'string' }, description: { type: 'string' }, budget_percent: { type: 'number' } } } },
            ad_copies: { type: 'array', items: { type: 'object' } },
            creative_brief: { type: 'string' },
            bidding_strategy: { type: 'string' },
            scale_triggers: { type: 'array', items: { type: 'string' } },
            benchmarks: { type: 'object' }
          }
        }
      });
    }

    if (action === 'seo_strategy') {
      const { website_topic, target_keywords, competitors, industry } = payload;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an SEO strategist. Build a comprehensive SEO content and optimization strategy.
Website Topic: ${website_topic}
Industry: ${industry || 'general'}
Target Keywords: ${target_keywords || 'to be researched'}
Competitors: ${competitors || 'top 3 in industry'}

Deliver:
1. Keyword Cluster Map (primary, secondary, long-tail, local)
2. Content Gap Analysis (what they rank for that we don't)
3. 12-Month Content Calendar (monthly blog topics tied to keyword clusters)
4. On-Page SEO Checklist for each key page
5. Technical SEO Priority Fixes
6. Link Building Strategy (5 tactics specific to this industry)
7. Local SEO Actions (if applicable)
8. Quick Win Keywords (low competition, decent volume to target now)
9. Content Briefs for top 3 priority articles`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            keyword_clusters: { type: 'array', items: { type: 'object' } },
            content_calendar: { type: 'array', items: { type: 'object', properties: { month: { type: 'string' }, topic: { type: 'string' }, keyword: { type: 'string' }, intent: { type: 'string' } } } },
            quick_win_keywords: { type: 'array', items: { type: 'string' } },
            link_building_tactics: { type: 'array', items: { type: 'string' } },
            technical_fixes: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    if (action === 'influencer_strategy') {
      const { industry, budget, audience, campaign_goal, niche } = payload;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an influencer marketing strategist. Build a full influencer campaign strategy.
Industry: ${industry || 'general'}
Niche: ${niche || industry}
Budget: $${budget || '3000'}
Target Audience: ${audience || 'millennials and gen z'}
Campaign Goal: ${campaign_goal || 'brand awareness and lead gen'}

Deliver:
1. Influencer Tier Strategy (nano/micro/macro/mega with budget split and rationale)
2. Ideal Influencer Profile (follower count, engagement rate, content style, audience match)
3. Discovery Method (where/how to find them on each platform)
4. Outreach Template (DM + email scripts for initial contact)
5. Partnership Terms Template (deliverables, rates, usage rights, disclosure)
6. Content Brief Template for influencers
7. Performance KPIs (per influencer and campaign-level)
8. Platform-Specific Recommendations (Instagram vs TikTok vs YouTube priorities)
9. 5 Specific Influencer Profile Examples to search for`,
        response_json_schema: {
          type: 'object',
          properties: {
            tier_strategy: { type: 'object' },
            ideal_profile: { type: 'object' },
            outreach_dm_template: { type: 'string' },
            outreach_email_template: { type: 'string' },
            partnership_terms: { type: 'string' },
            content_brief_template: { type: 'string' },
            kpis: { type: 'array', items: { type: 'string' } },
            example_profiles: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─────────────────────────────────────────────
    // 4. PERSONALIZATION & CUSTOMER JOURNEY
    // ─────────────────────────────────────────────

    if (action === 'customer_journey_map') {
      const { business_type, customer_type, product_service } = payload;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a customer experience strategist. Map the complete customer journey.
Business: ${business_type || 'service business'}
Customer: ${customer_type || 'B2C adult consumer'}
Product/Service: ${product_service || 'professional services'}

Build a detailed journey map with:
1. Awareness Stage: how they discover us, touch points, emotional state, marketing actions
2. Consideration Stage: research behaviour, comparison, objections, content needed
3. Decision Stage: final triggers, conversion optimisers, friction removers
4. Onboarding Stage: first experience, success milestones, drop-off risks
5. Retention Stage: engagement cadence, loyalty drivers, upsell opportunities
6. Advocacy Stage: referral triggers, review prompts, ambassador program

For each stage: customer emotion, key message, channel mix, content type, automation trigger, success metric.`,
        response_json_schema: {
          type: 'object',
          properties: {
            journey_stages: { type: 'array', items: { type: 'object', properties: { stage: { type: 'string' }, emotion: { type: 'string' }, customer_actions: { type: 'array', items: { type: 'string' } }, our_actions: { type: 'array', items: { type: 'string' } }, channels: { type: 'array', items: { type: 'string' } }, automation_trigger: { type: 'string' }, kpi: { type: 'string' } } } },
            critical_moments: { type: 'array', items: { type: 'string' } },
            automation_flows: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    if (action === 'lifecycle_automation') {
      const { business_type, channels, crm } = payload;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a marketing automation architect. Design a complete lifecycle automation system.
Business: ${business_type || 'service/product business'}
Channels available: ${channels || 'email, SMS, push, retargeting ads'}
CRM: ${crm || 'generic CRM'}

Design complete automation workflows for:
1. Welcome Series (new lead/subscriber) — 7 touchpoints
2. Lead Nurture (cold to warm) — 14-day sequence
3. Trial/Demo to Paid Conversion — urgency and value sequence
4. Onboarding (new customer) — success milestones
5. Re-engagement (inactive 30+ days) — win-back sequence
6. Upsell/Cross-sell (post purchase) — expansion sequence
7. Churn Prevention (at-risk signals detected) — retention sequence
8. Loyalty & Referral — advocate activation

For each workflow: trigger, steps, timing, channel, message, exit conditions, success metric.`,
        response_json_schema: {
          type: 'object',
          properties: {
            workflows: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, trigger: { type: 'string' }, steps: { type: 'array', items: { type: 'object' } }, exit_condition: { type: 'string' }, success_metric: { type: 'string' } } } },
            implementation_priority: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    if (action === 'churn_prevention_campaign') {
      const { at_risk_signals, product_type, segment } = payload;
      const clients = await base44.asServiceRole.entities.Client.list('-updated_date', 30).catch(() => []);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a retention marketing specialist. Design a churn prevention campaign.
At-risk signals: ${at_risk_signals || 'no login 14 days, reduced usage, support tickets, late payments'}
Product: ${product_type || 'service subscription'}
Segment: ${segment || 'all paying customers'}
Current client count context: ${clients.length}

Deliver:
1. Churn Risk Scoring Model (variables and weights)
2. Early Warning Triggers (automated alerts)
3. Intervention Playbooks by risk tier (low/medium/high/critical)
4. Retention Offer Sequence (escalating offers)
5. Win-back Campaign (post-churn)
6. Personalized Message Templates for each intervention
7. Success Metrics to track
8. Estimated churn reduction if implemented`,
        response_json_schema: {
          type: 'object',
          properties: {
            risk_scoring: { type: 'object' },
            intervention_playbooks: { type: 'array', items: { type: 'object' } },
            retention_offers: { type: 'array', items: { type: 'object', properties: { tier: { type: 'string' }, offer: { type: 'string' }, message_template: { type: 'string' } } } },
            winback_sequence: { type: 'string' },
            estimated_reduction_percent: { type: 'number' }
          }
        }
      });
    }

    // ─────────────────────────────────────────────
    // 5. ADVERTISING INTELLIGENCE & AUTOMATION
    // ─────────────────────────────────────────────

    if (action === 'optimize_roas') {
      const campaigns = await base44.asServiceRole.entities.Campaign.list('-updated_date', 10).catch(() => []);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a performance marketing expert. Optimize ROAS across all campaigns.
Active campaigns: ${JSON.stringify(campaigns.map(c => ({ name: c.name, status: c.status, budget: c.budget, channels: c.channels })))}

Deliver:
1. Channel ROAS Rankings (best to worst)
2. Budget Reallocation Recommendations (specific $ moves)
3. Audience Refinement (who to add/exclude)
4. Creative Fatigue Detection (what to refresh)
5. Bid Strategy Adjustments
6. New A/B Tests to run
7. Quick Wins (actions to implement today for immediate improvement)
8. 30-day Projected ROAS improvement with these changes`,
        response_json_schema: {
          type: 'object',
          properties: {
            channel_rankings: { type: 'array', items: { type: 'object' } },
            budget_reallocation: { type: 'array', items: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' }, amount: { type: 'number' }, rationale: { type: 'string' } } } },
            quick_wins: { type: 'array', items: { type: 'string' } },
            ab_tests: { type: 'array', items: { type: 'string' } },
            projected_roas_improvement_percent: { type: 'number' }
          }
        }
      });
    }

    if (action === 'creative_testing_plan') {
      const { campaign_name, product, current_ctr, audience } = payload;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a conversion rate optimization expert. Design a systematic creative A/B testing plan.
Campaign: ${campaign_name || 'main campaign'}
Product/Offer: ${product}
Current CTR benchmark: ${current_ctr || 'unknown'}
Audience: ${audience || 'cold traffic'}

Build a 90-day creative testing roadmap:
1. Testing Hypothesis for each test
2. Variables to test (ranked by expected impact): headlines, images, CTAs, offers, social proof, urgency
3. Week-by-week testing schedule (1 variable at a time)
4. Sample sizes needed for statistical significance
5. Success thresholds (when to call a winner)
6. Creative brief for each variation
7. Expected CTR/CVR improvements per test
8. Scaling protocol for winners`,
        response_json_schema: {
          type: 'object',
          properties: {
            testing_roadmap: { type: 'array', items: { type: 'object', properties: { week: { type: 'number' }, test_name: { type: 'string' }, hypothesis: { type: 'string' }, variable: { type: 'string' }, control: { type: 'string' }, variant: { type: 'string' }, sample_size: { type: 'number' }, expected_lift: { type: 'string' } } } },
            scaling_protocol: { type: 'string' }
          }
        }
      });
    }

    if (action === 'cross_channel_attribution') {
      const { channels, conversion_goal, avg_sales_cycle_days } = payload;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a marketing analytics expert specializing in attribution modelling.
Channels: ${channels || 'Google Ads, Facebook Ads, Email, Organic Social, SEO, Referral'}
Conversion Goal: ${conversion_goal || 'purchase / lead form submission'}
Average Sales Cycle: ${avg_sales_cycle_days || 14} days

Deliver:
1. Attribution Model Comparison (first-click, last-click, linear, time-decay, data-driven)
2. Recommended Model for this business and why
3. Customer Journey Path Analysis (top 5 common paths to conversion)
4. Channel Assist Credit (which channels assist vs close)
5. True ROI per channel (accounting for assisted conversions)
6. Budget Implication (how does this change where we should spend?)
7. Implementation Plan (how to set up proper attribution tracking)
8. Reporting cadence and metrics`,
        response_json_schema: {
          type: 'object',
          properties: {
            recommended_model: { type: 'string' },
            rationale: { type: 'string' },
            channel_true_roi: { type: 'array', items: { type: 'object', properties: { channel: { type: 'string' }, last_click_credit: { type: 'string' }, true_credit: { type: 'string' }, recommendation: { type: 'string' } } } },
            top_conversion_paths: { type: 'array', items: { type: 'string' } },
            budget_implication: { type: 'string' }
          }
        }
      });
    }

    // ─────────────────────────────────────────────
    // 6. ANALYTICS, REPORTING & INSIGHTS
    // ─────────────────────────────────────────────

    if (action === 'performance_report') {
      const { period, focus } = payload;
      const [campaigns, leads, activities] = await Promise.all([
        base44.asServiceRole.entities.Campaign.list('-updated_date', 20).catch(() => []),
        base44.asServiceRole.entities.Lead.list('-created_date', 50).catch(() => []),
        base44.asServiceRole.entities.Activity.list('-created_date', 30).catch(() => [])
      ]);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a marketing analytics director. Generate a comprehensive performance report.
Period: ${period || 'last 30 days'}
Focus: ${focus || 'all channels'}
Data available:
- Campaigns: ${campaigns.length} total, ${campaigns.filter(c => c.status === 'active').length} active
- Leads: ${leads.length} in period
- Activities: ${activities.length} logged
- Campaign statuses: ${JSON.stringify(campaigns.slice(0, 5).map(c => ({ name: c.name, status: c.status, channels: c.channels })))}

Generate executive marketing report with:
1. Performance Summary (what worked, what didn't)
2. Channel Performance Scorecard
3. Lead Generation Analysis (volume, quality, source breakdown)
4. Content Performance (top performing content types)
5. Funnel Analysis (awareness > consideration > conversion)
6. Key Insights (3 non-obvious observations from the data)
7. Recommendations (top 5 actions for next period)
8. Next Period Forecast`,
        response_json_schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            channel_scorecard: { type: 'array', items: { type: 'object', properties: { channel: { type: 'string' }, performance: { type: 'string' }, grade: { type: 'string' }, recommendation: { type: 'string' } } } },
            key_insights: { type: 'array', items: { type: 'string' } },
            recommendations: { type: 'array', items: { type: 'string' } },
            forecast: { type: 'string' }
          }
        }
      });
    }

    if (action === 'sentiment_analysis') {
      const { brand_name, industry, keywords } = payload;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a brand intelligence analyst. Conduct a sentiment and brand health analysis.
Brand: ${brand_name || 'our brand'}
Industry: ${industry || 'general'}
Keywords to monitor: ${keywords || brand_name + ', competitors, industry terms'}

Deliver:
1. Overall Brand Sentiment Score (0-100) with trend direction
2. Sentiment Breakdown by platform/source
3. Top Positive Themes (what people love)
4. Top Negative Themes (what people complain about)
5. Emerging Issues to watch
6. Competitor Sentiment Comparison
7. Response Strategy (how to address negative sentiment)
8. Content Opportunities from positive sentiment
9. Crisis Risk Assessment`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            overall_score: { type: 'number' },
            trend: { type: 'string' },
            positive_themes: { type: 'array', items: { type: 'string' } },
            negative_themes: { type: 'array', items: { type: 'string' } },
            emerging_issues: { type: 'array', items: { type: 'string' } },
            response_strategy: { type: 'string' },
            content_opportunities: { type: 'array', items: { type: 'string' } },
            crisis_risk: { type: 'string' }
          }
        }
      });
    }

    if (action === 'cro_analysis') {
      const { page_type, current_cvr, traffic_source, offer } = payload;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a conversion rate optimization (CRO) expert. Analyze and optimize conversion performance.
Page/Funnel: ${page_type || 'landing page and checkout'}
Current CVR: ${current_cvr || 'unknown — assume industry average'}
Traffic Source: ${traffic_source || 'mixed'}
Offer: ${offer || 'service/product'}

Deliver:
1. CRO Audit (top 10 conversion killers to check/fix)
2. A/B Test Prioritization Matrix (impact vs effort for 15 tests)
3. Landing Page Optimization Checklist
4. Form Optimization (field reduction, social proof, trust signals)
5. Social Proof Strategy (testimonials, case studies, reviews, numbers)
6. Urgency & Scarcity Tactics (ethical and effective)
7. Mobile CRO Specific Fixes
8. Page Speed Impact
9. Heat Map Areas to Monitor
10. Projected CVR improvement with recommendations`,
        response_json_schema: {
          type: 'object',
          properties: {
            conversion_killers: { type: 'array', items: { type: 'string' } },
            ab_test_priorities: { type: 'array', items: { type: 'object', properties: { test: { type: 'string' }, impact: { type: 'string' }, effort: { type: 'string' }, expected_lift: { type: 'string' } } } },
            quick_wins: { type: 'array', items: { type: 'string' } },
            projected_cvr_improvement: { type: 'string' }
          }
        }
      });
    }

    if (action === 'marketing_mix_model') {
      const { channels, timeframe, revenue_goal } = payload;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a marketing mix modelling (MMM) expert. Build a strategic marketing mix analysis.
Channels: ${channels || 'paid social, paid search, email, content/SEO, events, referral'}
Timeframe: ${timeframe || '12 months'}
Revenue Goal: ${revenue_goal || 'maximize growth'}

Deliver:
1. Optimal Marketing Mix (channel weighting for maximum revenue contribution)
2. Diminishing Returns Analysis (at what spend level each channel plateaus)
3. Synergy Effects (channels that amplify each other)
4. Seasonal Budget Allocation (when to invest more/less per channel)
5. Incremental Revenue Model (what each $1 spent on each channel returns)
6. Scenario Planning (Conservative / Base / Aggressive)
7. Implementation Roadmap
8. Data Collection Requirements for future MMM refinement`,
        response_json_schema: {
          type: 'object',
          properties: {
            optimal_mix: { type: 'array', items: { type: 'object', properties: { channel: { type: 'string' }, allocation_percent: { type: 'number' }, revenue_contribution_percent: { type: 'number' }, rationale: { type: 'string' } } } },
            scenarios: { type: 'object' },
            synergy_pairs: { type: 'array', items: { type: 'string' } },
            implementation_roadmap: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─────────────────────────────────────────────
    // 7. COMPLIANCE, ETHICS & BRAND SAFETY
    // ─────────────────────────────────────────────

    if (action === 'compliance_check') {
      const { content, content_type, industry, regions } = payload;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a marketing compliance expert. Review this content for regulatory and ethical compliance.
Content Type: ${content_type || 'marketing copy'}
Industry: ${industry || 'general'}
Regions: ${regions || 'Australia, USA'}

CONTENT TO REVIEW:
${content}

Check against:
1. GDPR / Australian Privacy Act compliance
2. SPAM Act / CAN-SPAM (for email)
3. ACCC / FTC disclosure rules (for paid ads and influencer posts)
4. Industry-specific rules (finance, health, NDIS, aged care if relevant)
5. Misleading or deceptive claims (consumer protection)
6. Accessibility (WCAG 2.1)
7. Brand safety flags
8. Sensitive topics / potentially offensive content

Output:
- Overall compliance status (PASS / CONDITIONAL / FAIL)
- Issues found (severity: critical/major/minor)
- Suggested fixes for each issue
- Required disclaimers or disclosures to add`,
        response_json_schema: {
          type: 'object',
          properties: {
            status: { type: 'string', enum: ['PASS', 'CONDITIONAL', 'FAIL'] },
            overall_assessment: { type: 'string' },
            issues: { type: 'array', items: { type: 'object', properties: { issue: { type: 'string' }, severity: { type: 'string' }, fix: { type: 'string' } } } },
            required_disclosures: { type: 'array', items: { type: 'string' } },
            approved_version: { type: 'string' }
          }
        }
      });
    }

    if (action === 'brand_voice_analysis') {
      const { content_samples, brand_description, target_voice } = payload;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are a brand strategist. Analyse and define brand voice guidelines.
Brand Description: ${brand_description || 'professional service business'}
Target Voice: ${target_voice || 'expert, trustworthy, approachable'}
Content Samples: ${content_samples || 'none provided — create guidelines from scratch'}

Deliver:
1. Brand Voice Profile (4-5 voice attributes with "we are / we are not" definitions)
2. Tone of Voice Scale (formal–casual, serious–playful, etc.)
3. Vocabulary Guide (words to use / avoid)
4. Writing Style Rules (sentence length, punctuation, formatting)
5. Platform-Specific Tone Adjustments (LinkedIn vs Instagram vs email vs ads)
6. 10 Content Examples (showing the voice in action)
7. Common Mistakes to Avoid
8. Brand Voice Scorecard (checklist for reviewing content)`,
        response_json_schema: {
          type: 'object',
          properties: {
            voice_attributes: { type: 'array', items: { type: 'object', properties: { attribute: { type: 'string' }, we_are: { type: 'string' }, we_are_not: { type: 'string' } } } },
            vocabulary: { type: 'object', properties: { use: { type: 'array', items: { type: 'string' } }, avoid: { type: 'array', items: { type: 'string' } } } },
            platform_tones: { type: 'object' },
            content_examples: { type: 'array', items: { type: 'string' } },
            scorecard: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─────────────────────────────────────────────
    // 8. CROSS-AGENT COLLABORATION
    // ─────────────────────────────────────────────

    if (action === 'cross_agent_brief') {
      const { objective, agents_needed } = payload;
      const [leads, campaigns, financials] = await Promise.all([
        base44.asServiceRole.entities.Lead.list('-created_date', 20).catch(() => []),
        base44.asServiceRole.entities.Campaign.list('-updated_date', 10).catch(() => []),
        base44.asServiceRole.entities.FinancialSnapshot.list('-created_date', 1).catch(() => [])
      ]);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Maestro coordinating with other Nexus AI agents. Prepare a cross-agent work brief.
Objective: ${objective}
Agents needed: ${agents_needed || 'Prospect, Centsible, Canvas, Compass, Scribe, Support Sage'}

Current context:
- Open leads: ${leads.length}
- Active campaigns: ${campaigns.filter(c => c.status === 'active').length}
- Revenue snapshot available: ${financials.length > 0}

Generate:
1. Maestro's Action Plan (what Maestro will own)
2. For each agent: specific request/brief and expected output
3. Dependencies and sequencing (who needs to deliver first)
4. Integration points (how outputs connect back to Maestro)
5. Success criteria for the full cross-agent initiative
6. Timeline and check-in schedule`,
        response_json_schema: {
          type: 'object',
          properties: {
            maestro_actions: { type: 'array', items: { type: 'string' } },
            agent_briefs: { type: 'array', items: { type: 'object', properties: { agent: { type: 'string' }, request: { type: 'string' }, expected_output: { type: 'string' }, deadline: { type: 'string' } } } },
            success_criteria: { type: 'array', items: { type: 'string' } },
            timeline: { type: 'string' }
          }
        }
      });
    }

    if (action === 'full_marketing_briefing') {
      const [campaigns, leads, activities] = await Promise.all([
        base44.asServiceRole.entities.Campaign.list('-updated_date', 20).catch(() => []),
        base44.asServiceRole.entities.Lead.list('-created_date', 100).catch(() => []),
        base44.asServiceRole.entities.Activity.list('-created_date', 50).catch(() => [])
      ]);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Maestro, the autonomous marketing brain. Generate a full executive marketing briefing.

Live data:
- ${campaigns.length} total campaigns (${campaigns.filter(c => c.status === 'active').length} active, ${campaigns.filter(c => c.status === 'draft').length} drafts)
- ${leads.length} leads in system
- ${activities.length} recent activities
- Campaign breakdown: ${JSON.stringify(campaigns.slice(0, 10).map(c => ({ name: c.name, status: c.status, channels: c.channels })))}

Generate a comprehensive briefing:
1. 🎯 Marketing Health Score (0-100) with breakdown
2. 📊 Channel Performance Rankings
3. 🚀 Active Campaign Status
4. 📈 Lead Generation Pipeline Health
5. 🔥 Top 3 Immediate Opportunities
6. ⚠️ Top 3 Risks or Issues
7. 💡 Maestro's 5 Strategic Recommendations
8. 📅 This Week's Priority Actions`,
        response_json_schema: {
          type: 'object',
          properties: {
            health_score: { type: 'number' },
            health_breakdown: { type: 'object' },
            channel_rankings: { type: 'array', items: { type: 'object' } },
            opportunities: { type: 'array', items: { type: 'string' } },
            risks: { type: 'array', items: { type: 'string' } },
            recommendations: { type: 'array', items: { type: 'string' } },
            this_week_priorities: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    return Response.json({ status: 'maestro_complete', action, result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});