import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const { action, params = {} } = payload;

    // Legacy field support
    const industry = payload.industry || params.industry || 'general business';
    const partner_type = payload.partner_type || params.partner_type || 'strategic';

    let result = null;

    const loadPartners = async (filter = {}) => {
      const all = await base44.asServiceRole.entities.Partner.list('-created_date', 200).catch(() => []);
      if (Object.keys(filter).length === 0) return all;
      return all.filter(p => Object.entries(filter).every(([k, v]) => p[k] === v));
    };

    // ─── 1. DISCOVER PARTNERS ─────────────────────────────────────────────────
    if (action === 'discover_partners') {
      const { category, geography, focus_keywords } = params;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Discover high-potential business partners for ${industry}.

Partner category: ${category || partner_type}
Geography: ${geography || 'national/global'}
Focus areas: ${focus_keywords || 'general'}

For each potential partner type, identify:
1. Where to find them (specific platforms, directories, events, communities)
2. Ideal partner profile (size, stage, audience, capabilities)
3. Strategic fit criteria (what makes them a great partner)
4. Estimated partnership value and type (referral, reseller, integration, co-marketing, influencer)
5. Red flags to avoid
6. First-contact strategy

Also: suggest 5-8 specific company names or types that would be ideal partners right now.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            partner_opportunities: { type: 'array', items: { type: 'object', properties: {
              category: { type: 'string' },
              ideal_profile: { type: 'string' },
              discovery_sources: { type: 'array', items: { type: 'string' } },
              strategic_fit: { type: 'string' },
              estimated_value: { type: 'string' },
              red_flags: { type: 'array', items: { type: 'string' } },
              first_contact_strategy: { type: 'string' }
            }}},
            specific_targets: { type: 'array', items: { type: 'object', properties: {
              name: { type: 'string' },
              type: { type: 'string' },
              why: { type: 'string' },
              opportunity_score: { type: 'number' }
            }}},
            recommended_first_move: { type: 'string' }
          }
        }
      });
    }

    // ─── 2. SCOUT INFLUENCERS ─────────────────────────────────────────────────
    if (action === 'scout_influencers') {
      const { niche, platform, audience_size, icp_description } = params;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Scout relevant influencers and content creators for a partnership program.

Industry: ${industry}
Niche focus: ${niche || industry}
Target platform(s): ${platform || 'all platforms (LinkedIn, Instagram, TikTok, YouTube, Twitter)'}
Audience size preference: ${audience_size || 'micro (10k-200k) — higher engagement priority'}
Ideal customer profile: ${icp_description || 'general business audience'}

For each influencer opportunity:
1. Creator profile: handle, platform, follower range, engagement rate
2. Audience demographic match and ICP alignment (%)
3. Content niche and style fit
4. Signal type: organic brand mention / industry authority / adjacent content
5. Authenticity signals (engagement quality, not just volume)
6. Partnership approach: organic collaboration / paid / ambassador program
7. Estimated reach value and lead potential
8. Outreach angle — what's in it for them?

Prioritize: micro-influencers with high engagement over mega-influencers with low engagement.
Flag any who have mentioned our industry recently.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            influencers: { type: 'array', items: { type: 'object', properties: {
              name: { type: 'string' },
              handle: { type: 'string' },
              platform: { type: 'string' },
              follower_range: { type: 'string' },
              engagement_rate_estimate: { type: 'string' },
              niche_alignment_score: { type: 'number' },
              icp_match_percent: { type: 'number' },
              partnership_approach: { type: 'string' },
              outreach_angle: { type: 'string' },
              leads_potential: { type: 'string' },
              priority: { type: 'string' }
            }}},
            recommended_program_structure: { type: 'string' },
            budget_estimate: { type: 'string' }
          }
        }
      });
    }

    // ─── 3. COMPETITOR PARTNER MAP ────────────────────────────────────────────
    if (action === 'competitor_partner_map') {
      const { competitors } = params;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Map the partner ecosystems of competitors in ${industry}.

Competitors to analyze: ${competitors || 'main players in the sector'}

For each competitor:
1. Known integration partners (technology, API, platform)
2. Channel and reseller partners
3. Influencer and ambassador relationships
4. Co-marketing partnerships and joint campaigns
5. Strategic alliances and certifications

Then identify:
- Partners shared with multiple competitors (high-value to win over)
- Partners exclusive to one competitor (potential to poach or counter)
- Partnership gaps — categories no competitor has claimed
- Our best counter-partnership moves

Output: prioritized list of partnership opportunities based on competitor gaps.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            competitor_ecosystems: { type: 'array', items: { type: 'object', properties: {
              competitor: { type: 'string' },
              integration_partners: { type: 'array', items: { type: 'string' } },
              channel_partners: { type: 'array', items: { type: 'string' } },
              influencer_partners: { type: 'array', items: { type: 'string' } },
              strategic_alliances: { type: 'array', items: { type: 'string' } }
            }}},
            shared_partners: { type: 'array', items: { type: 'string' } },
            exclusive_competitor_partners: { type: 'array', items: { type: 'string' } },
            unclaimed_opportunities: { type: 'array', items: { type: 'string' } },
            recommended_counter_moves: { type: 'array', items: { type: 'object', properties: {
              move: { type: 'string' },
              target_partner: { type: 'string' },
              urgency: { type: 'string' }
            }}}
          }
        }
      });
    }

    // ─── 4. DRAFT OUTREACH ────────────────────────────────────────────────────
    if (action === 'draft_outreach') {
      const { partner_name, partner_type: ptype, partner_description, channel, our_business } = params;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Write a highly personalized partnership outreach message.

Target: ${partner_name || 'potential partner'}
Partner type: ${ptype || partner_type}
What we know about them: ${partner_description || 'leader in their space'}
Outreach channel: ${channel || 'email'}
Our business: ${our_business || industry}

Requirements:
1. Lead with THEIR value — what's in it for them specifically
2. Reference something specific about their business (recent news, product, content)
3. Propose a specific, low-friction first step (not a generic "let's chat")
4. Make the mutual benefit concrete — avoid vague "synergies"
5. Keep it brief — no more than 150 words
6. Include subject line for email

Also generate: a LinkedIn connection request message (300 chars) and a follow-up sequence (2 follow-ups, 7 and 14 days later).`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            email_subject: { type: 'string' },
            email_body: { type: 'string' },
            linkedin_message: { type: 'string' },
            followup_1: { type: 'object', properties: { day: { type: 'number' }, message: { type: 'string' } } },
            followup_2: { type: 'object', properties: { day: { type: 'number' }, message: { type: 'string' } } },
            key_value_proposition: { type: 'string' }
          }
        }
      });
    }

    // ─── 5. RELATIONSHIP SCORE / HEALTH AUDIT ────────────────────────────────
    if (action === 'relationship_score' || action === 'health_audit') {
      const partners = await loadPartners();
      const now = new Date();

      const partnerData = partners.map(p => {
        const daysSinceContact = p.last_contact
          ? Math.floor((now - new Date(p.last_contact)) / (1000 * 60 * 60 * 24))
          : 999;
        const daysOverdue = p.next_contact
          ? Math.floor((now - new Date(p.next_contact)) / (1000 * 60 * 60 * 24))
          : 0;
        return {
          id: p.id, name: p.company_name, status: p.status, type: p.type,
          days_since_contact: daysSinceContact, days_overdue: daysOverdue,
          revenue: p.revenue_attributed || 0, leads: p.leads_generated || 0,
          opportunity_score: p.opportunity_score || 0
        };
      });

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Perform a partnership health audit for ${partners.length} partners.

Partner data: ${JSON.stringify(partnerData)}

For each partner, score:
1. Relationship health (0-100): based on recency of contact, engagement, overdue follow-ups
2. Revenue contribution (0-100): based on revenue and leads attributed
3. Growth potential (0-100): based on opportunity score and partner type
4. Churn risk (0-100): higher = more at risk
5. Overall health score (0-100)
6. Status: healthy / needs attention / at risk / critical
7. Recommended next action with specific timing

Then: overall portfolio health summary, top 3 at-risk relationships, top 3 highest-potential relationships.`,
        response_json_schema: {
          type: 'object',
          properties: {
            partner_health: { type: 'array', items: { type: 'object', properties: {
              name: { type: 'string' },
              relationship_health: { type: 'number' },
              revenue_score: { type: 'number' },
              growth_potential: { type: 'number' },
              churn_risk: { type: 'number' },
              overall_score: { type: 'number' },
              status: { type: 'string' },
              next_action: { type: 'string' },
              action_timeline: { type: 'string' }
            }}},
            portfolio_health_score: { type: 'number' },
            at_risk: { type: 'array', items: { type: 'string' } },
            highest_potential: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' }
          }
        }
      });

      // Create notifications for at-risk partners
      for (const ph of (result.partner_health || []).filter(p => p.churn_risk > 70)) {
        await base44.asServiceRole.entities.Notification.create({
          type: 'partner_at_risk',
          title: `Partner at risk: ${ph.name}`,
          message: `Health score: ${ph.overall_score}/100. ${ph.next_action}`,
          priority: ph.churn_risk > 85 ? 'critical' : 'high'
        }).catch(() => null);
      }
    }

    // ─── 6. PREPARE QBR ───────────────────────────────────────────────────────
    if (action === 'prepare_qbr') {
      const { partner_name, partner_id } = params;
      const partners = await loadPartners();
      const partner = partners.find(p => p.id === partner_id || p.company_name?.toLowerCase().includes((partner_name || '').toLowerCase())) || {};

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Prepare a quarterly business review (QBR) for partner: ${partner.company_name || partner_name}.

Partner data: ${JSON.stringify({
  type: partner.type, status: partner.status,
  revenue: partner.revenue_attributed, leads: partner.leads_generated,
  last_contact: partner.last_contact, notes: partner.notes
})}

Generate a complete QBR package:
1. Executive summary (achievements this quarter)
2. Performance scorecard (vs. last quarter if data available)
3. Joint wins to celebrate
4. Challenges and how we addressed them
5. Proposed goals and commitments for next quarter
6. Joint opportunities to explore
7. Relationship investment we're making in them
8. Agenda for the QBR meeting (with timings)
9. Action items and owners coming out of the QBR`,
        response_json_schema: {
          type: 'object',
          properties: {
            executive_summary: { type: 'string' },
            performance_highlights: { type: 'array', items: { type: 'string' } },
            joint_wins: { type: 'array', items: { type: 'string' } },
            challenges_addressed: { type: 'array', items: { type: 'string' } },
            next_quarter_goals: { type: 'array', items: { type: 'string' } },
            joint_opportunities: { type: 'array', items: { type: 'string' } },
            meeting_agenda: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, duration_mins: { type: 'number' } } } },
            action_items: { type: 'array', items: { type: 'object', properties: { action: { type: 'string' }, owner: { type: 'string' }, due: { type: 'string' } } } }
          }
        }
      });
    }

    // ─── 7. CO-MARKETING PLAN ─────────────────────────────────────────────────
    if (action === 'co_marketing_plan') {
      const { partner_name, campaign_type, budget, timeline } = params;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a joint co-marketing campaign plan with partner: ${partner_name}.

Campaign type: ${campaign_type || 'webinar, content, social'}
Budget: ${budget || 'to be determined'}
Timeline: ${timeline || 'next 60-90 days'}
Industry: ${industry}

Deliver:
1. Campaign concept and joint value proposition
2. Target audience (which segments from each side benefit)
3. Content plan: types, formats, platforms, and schedule
4. Resource allocation: what each party contributes
5. Budget breakdown if provided
6. Lead attribution model (how leads are split)
7. KPIs and success metrics
8. Launch timeline with milestones
9. Approval process for co-branded content
10. Expected ROI estimate`,
        response_json_schema: {
          type: 'object',
          properties: {
            campaign_concept: { type: 'string' },
            joint_value_prop: { type: 'string' },
            target_audience: { type: 'string' },
            content_plan: { type: 'array', items: { type: 'object', properties: {
              content_type: { type: 'string' }, platform: { type: 'string' },
              timeline: { type: 'string' }, owner: { type: 'string' }
            }}},
            resource_allocation: { type: 'object', properties: { our_contribution: { type: 'array', items: { type: 'string' } }, partner_contribution: { type: 'array', items: { type: 'string' } } } },
            lead_attribution: { type: 'string' },
            kpis: { type: 'array', items: { type: 'string' } },
            milestones: { type: 'array', items: { type: 'object', properties: { milestone: { type: 'string' }, date: { type: 'string' } } } },
            expected_leads: { type: 'number' },
            expected_roi: { type: 'string' }
          }
        }
      });
    }

    // ─── 8. CO-BRANDED CONTENT ────────────────────────────────────────────────
    if (action === 'co_branded_content') {
      const { partner_name, content_type, topic, audience } = params;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate co-branded content for a partnership with ${partner_name}.

Content type: ${content_type || 'blog post / whitepaper'}
Topic: ${topic || 'joint value proposition and industry insights'}
Target audience: ${audience || industry + ' professionals'}

Create:
1. Full content outline with sections
2. Key messages that highlight both brands
3. Joint value proposition woven throughout
4. Data points and statistics to include
5. Call to action (what do we want readers to do?)
6. SEO considerations (key phrases, title options)
7. Social media teaser copy for both parties to share
8. Distribution strategy (how each party promotes)

Tone: professional, insightful, genuinely valuable — not a sales piece.`,
        response_json_schema: {
          type: 'object',
          properties: {
            title_options: { type: 'array', items: { type: 'string' } },
            outline: { type: 'array', items: { type: 'object', properties: { section: { type: 'string' }, key_points: { type: 'array', items: { type: 'string' } } } } },
            key_messages: { type: 'array', items: { type: 'string' } },
            data_to_include: { type: 'array', items: { type: 'string' } },
            call_to_action: { type: 'string' },
            social_teaser: { type: 'string' },
            distribution_strategy: { type: 'string' }
          }
        }
      });
    }

    // ─── 9. INFLUENCER VETTING ────────────────────────────────────────────────
    if (action === 'influencer_vetting') {
      const { influencer_name, platform, handle } = params;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Vet influencer/creator for a brand partnership: ${influencer_name} ${handle ? `(@${handle})` : ''} on ${platform || 'social media'}.

Perform a comprehensive vetting analysis:
1. Audience authenticity indicators (engagement quality vs. quantity)
2. Fake follower risk assessment
3. Audience demographic analysis (age, location, interests)
4. Past brand collaborations — quality and alignment
5. Content quality and consistency
6. Controversy or brand safety risks
7. Alignment with our brand values
8. Estimated reach and impact (adjusted for engagement quality)
9. Partnership structure recommendation (organic, paid, ambassador)
10. Verdict: recommend / conditional / do not recommend

Confidence level in assessment and data sources used.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            authenticity_score: { type: 'number' },
            fake_follower_risk: { type: 'string' },
            audience_demographics: { type: 'string' },
            past_collaborations: { type: 'array', items: { type: 'string' } },
            brand_safety_risks: { type: 'array', items: { type: 'string' } },
            brand_alignment_score: { type: 'number' },
            effective_reach_estimate: { type: 'string' },
            recommended_partnership: { type: 'string' },
            verdict: { type: 'string' },
            verdict_reasoning: { type: 'string' },
            confidence: { type: 'string' }
          }
        }
      });
    }

    // ─── 10. CAMPAIGN BRIEF ───────────────────────────────────────────────────
    if (action === 'campaign_brief') {
      const { influencer_name, campaign_goal, key_messages, platforms, budget, timeline } = params;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a detailed influencer campaign brief for ${influencer_name}.

Goal: ${campaign_goal || 'brand awareness and lead generation'}
Key messages: ${key_messages || 'to be defined based on product value prop'}
Platforms: ${platforms || 'their primary platform'}
Budget: ${budget || 'to be negotiated'}
Timeline: ${timeline || '30 days'}
Industry: ${industry}

Generate a complete campaign brief including:
1. Campaign overview and objectives
2. Target audience description
3. Key messages (mandatory vs. suggested)
4. Content requirements (formats, quantity, schedule)
5. Brand guidelines and dos/don'ts
6. Disclosure requirements (FTC/regulatory compliance)
7. Approval process and timeline
8. Performance metrics and reporting requirements
9. Payment structure and milestones
10. Content usage rights`,
        response_json_schema: {
          type: 'object',
          properties: {
            campaign_overview: { type: 'string' },
            objectives: { type: 'array', items: { type: 'string' } },
            target_audience: { type: 'string' },
            mandatory_messages: { type: 'array', items: { type: 'string' } },
            suggested_angles: { type: 'array', items: { type: 'string' } },
            content_requirements: { type: 'array', items: { type: 'object', properties: { format: { type: 'string' }, quantity: { type: 'number' }, deadline: { type: 'string' } } } },
            dos_and_donts: { type: 'object', properties: { dos: { type: 'array', items: { type: 'string' } }, donts: { type: 'array', items: { type: 'string' } } } },
            disclosure_requirements: { type: 'string' },
            kpis: { type: 'array', items: { type: 'string' } },
            payment_structure: { type: 'string' },
            content_rights: { type: 'string' }
          }
        }
      });
    }

    // ─── 11. PARTNER ANALYTICS ────────────────────────────────────────────────
    if (action === 'partner_analytics') {
      const partners = await loadPartners();
      const active = partners.filter(p => p.status === 'active');
      const totalRevenue = partners.reduce((s, p) => s + (p.revenue_attributed || 0), 0);
      const totalLeads = partners.reduce((s, p) => s + (p.leads_generated || 0), 0);

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a comprehensive partner performance analytics report.

Portfolio overview:
- Total partners: ${partners.length}
- Active: ${active.length}
- Total attributed revenue: $${totalRevenue}
- Total leads generated: ${totalLeads}

Partner breakdown: ${JSON.stringify(partners.map(p => ({
  name: p.company_name, type: p.type, status: p.status,
  revenue: p.revenue_attributed || 0, leads: p.leads_generated || 0,
  opportunity_score: p.opportunity_score || 0
})))}

Analyze and report:
1. Top performers by revenue, leads, and ROI
2. Underperformers with specific improvement recommendations
3. Performance by partner type (which categories deliver most value)
4. Portfolio concentration risk (over-reliance on any single partner)
5. Growth trajectory: which partners are improving vs. declining
6. Recommended portfolio optimization moves
7. Tier assignment recommendations
8. 90-day growth forecast based on current trajectory`,
        response_json_schema: {
          type: 'object',
          properties: {
            total_revenue: { type: 'number' },
            total_leads: { type: 'number' },
            top_performers: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, revenue: { type: 'number' }, leads: { type: 'number' }, rank_reason: { type: 'string' } } } },
            underperformers: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, issue: { type: 'string' }, recommendation: { type: 'string' } } } },
            performance_by_type: { type: 'array', items: { type: 'object', properties: { type: { type: 'string' }, avg_revenue: { type: 'number' }, count: { type: 'number' }, verdict: { type: 'string' } } } },
            concentration_risk: { type: 'string' },
            optimization_moves: { type: 'array', items: { type: 'string' } },
            ninety_day_forecast: { type: 'string' }
          }
        }
      });
    }

    // ─── 12. PARTNER LTV ──────────────────────────────────────────────────────
    if (action === 'partner_ltv') {
      const partners = await loadPartners({ status: 'active' });
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Model lifetime value (LTV) for each active partner.

Active partners: ${JSON.stringify(partners.map(p => ({
  name: p.company_name, type: p.type,
  revenue_to_date: p.revenue_attributed || 0,
  leads_to_date: p.leads_generated || 0,
  months_active: Math.floor((new Date() - new Date(p.created_date || new Date())) / (1000 * 60 * 60 * 24 * 30)),
  opportunity_score: p.opportunity_score || 50
})))}

For each partner, model:
1. Current monthly value (revenue + lead value)
2. 12-month projected LTV
3. 36-month projected LTV
4. Key growth assumptions
5. Investment recommendation (invest more / maintain / reduce)
6. Risk factors that could affect LTV

Also: rank by 36-month LTV to inform partnership investment priorities.`,
        response_json_schema: {
          type: 'object',
          properties: {
            partner_ltv: { type: 'array', items: { type: 'object', properties: {
              name: { type: 'string' },
              monthly_value: { type: 'number' },
              ltv_12m: { type: 'number' },
              ltv_36m: { type: 'number' },
              investment_recommendation: { type: 'string' },
              risk_factors: { type: 'array', items: { type: 'string' } }
            }}},
            total_portfolio_ltv_12m: { type: 'number' },
            total_portfolio_ltv_36m: { type: 'number' },
            top_investment_priority: { type: 'string' }
          }
        }
      });
    }

    // ─── 13. GENERATE AGREEMENT ───────────────────────────────────────────────
    if (action === 'generate_agreement') {
      const { agreement_type, partner_name, key_terms } = params;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a partnership agreement template for ${partner_name}.

Agreement type: ${agreement_type || 'referral partnership'}
Key terms provided: ${key_terms || 'standard terms'}
Industry: ${industry}

Generate a comprehensive agreement structure including:
1. Parties and recitals
2. Scope of partnership
3. Obligations of each party
4. Commercial terms (commissions, revenue share, payment terms)
5. Exclusivity provisions (if any)
6. IP and data ownership
7. Confidentiality provisions
8. Term and termination conditions
9. Dispute resolution
10. Key definitions

Note: this is a starting template — flag areas requiring legal review.`,
        response_json_schema: {
          type: 'object',
          properties: {
            agreement_type: { type: 'string' },
            parties: { type: 'string' },
            scope: { type: 'string' },
            our_obligations: { type: 'array', items: { type: 'string' } },
            partner_obligations: { type: 'array', items: { type: 'string' } },
            commercial_terms: { type: 'string' },
            exclusivity: { type: 'string' },
            ip_ownership: { type: 'string' },
            confidentiality: { type: 'string' },
            term_and_termination: { type: 'string' },
            legal_review_flags: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 14. CROSS-SELL OPPORTUNITIES ─────────────────────────────────────────
    if (action === 'cross_sell_opportunities') {
      const partners = await loadPartners({ status: 'active' });
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Identify cross-selling and upsell opportunities across our partner ecosystem.

Active partners: ${JSON.stringify(partners.map(p => ({ name: p.company_name, type: p.type, notes: p.notes })))}
Industry: ${industry}

Identify:
1. Which partner solutions would our customers benefit from? (partner → our customers)
2. Which of our solutions would their customers benefit from? (us → partner customers)
3. Bundle opportunities: what joint solutions would be more valuable together?
4. White-label opportunities: could either side white-label the other's offering?
5. Referral fee structure recommendations for each opportunity
6. Priority cross-sell conversations to initiate this month

Expected outcome: incremental revenue and stronger partner relationships.`,
        response_json_schema: {
          type: 'object',
          properties: {
            sell_to_partner_customers: { type: 'array', items: { type: 'object', properties: {
              partner: { type: 'string' }, opportunity: { type: 'string' }, revenue_potential: { type: 'string' }
            }}},
            sell_partner_to_our_customers: { type: 'array', items: { type: 'object', properties: {
              partner: { type: 'string' }, their_solution: { type: 'string' }, value_to_our_customers: { type: 'string' }
            }}},
            bundle_opportunities: { type: 'array', items: { type: 'string' } },
            referral_fee_recommendations: { type: 'array', items: { type: 'object', properties: { partner: { type: 'string' }, recommended_fee: { type: 'string' } } } },
            priority_conversations: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 15. MANAGE PARTNERSHIPS (legacy + expanded) ──────────────────────────
    if (action === 'manage_partnerships') {
      const partners = await loadPartners();
      const now = new Date();
      const overdue = partners.filter(p => p.next_contact && new Date(p.next_contact) < now);
      const atRisk = partners.filter(p =>
        p.status === 'active' && p.last_contact &&
        Math.floor((now - new Date(p.last_contact)) / (1000 * 60 * 60 * 24)) > 60
      );

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a partnership management action plan.

Portfolio: ${partners.length} total, ${partners.filter(p => p.status === 'active').length} active
Overdue follow-ups: ${overdue.length}
At-risk (no contact >60 days): ${atRisk.length}

Partners needing attention: ${JSON.stringify([...overdue, ...atRisk].slice(0, 10).map(p => ({
  name: p.company_name, status: p.status,
  days_overdue: p.next_contact ? Math.floor((now - new Date(p.next_contact)) / (1000 * 60 * 60 * 24)) : 0
})))}

Create:
1. This week's priority actions (ranked)
2. Templates for re-engagement messages
3. QBR schedule for active partners
4. Communication cadence recommendations by partner tier
5. Escalation triggers — what signals should prompt urgent outreach`,
        response_json_schema: {
          type: 'object',
          properties: {
            priority_actions: { type: 'array', items: { type: 'object', properties: { action: { type: 'string' }, partner: { type: 'string' }, urgency: { type: 'string' } } } },
            re_engagement_templates: { type: 'array', items: { type: 'object', properties: { scenario: { type: 'string' }, message: { type: 'string' } } } },
            qbr_schedule: { type: 'array', items: { type: 'object', properties: { partner: { type: 'string' }, suggested_date: { type: 'string' } } } },
            cadence_recommendations: { type: 'string' },
            escalation_triggers: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 16. EVENT STRATEGY ───────────────────────────────────────────────────
    if (action === 'event_strategy') {
      const { event_name, event_type, partner_name, goal } = params;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Develop an event strategy for ${event_name || 'upcoming industry event'}.

Event type: ${event_type || 'conference / trade show'}
Partner involvement: ${partner_name || 'solo or with partners'}
Goal: ${goal || 'brand awareness, lead generation, partner networking'}
Industry: ${industry}

Deliver:
1. Pre-event strategy (what to prepare, who to target, meetings to book)
2. Partner coordination plan (if applicable)
3. At-event tactics (booth strategy, speaking opportunities, networking targets)
4. Lead capture and follow-up plan
5. Post-event nurture sequence
6. ROI measurement framework
7. Specific partnership meetings to schedule at this event`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            pre_event_actions: { type: 'array', items: { type: 'string' } },
            partner_coordination: { type: 'string' },
            at_event_tactics: { type: 'array', items: { type: 'string' } },
            lead_capture_plan: { type: 'string' },
            post_event_sequence: { type: 'array', items: { type: 'object', properties: { day: { type: 'number' }, action: { type: 'string' } } } },
            roi_metrics: { type: 'array', items: { type: 'string' } },
            partnership_meetings_to_book: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 17. COMMISSION CALCULATION ───────────────────────────────────────────
    if (action === 'commission_calculation') {
      const { partner_name, deal_value, partner_type: ptype, commission_rate, deal_type } = params;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Calculate and structure commission/incentive for partnership deal.

Partner: ${partner_name}
Partner type: ${ptype || partner_type}
Deal value: ${deal_value || 'to be defined'}
Commission rate: ${commission_rate || 'to be recommended'}
Deal type: ${deal_type || 'referral / reseller'}
Industry: ${industry}

Calculate:
1. Recommended commission structure (% or flat fee)
2. Payment schedule and timing
3. Clawback provisions (if customer churns early)
4. Bonus tiers for high-performing partners
5. Tax and compliance considerations
6. Total commission payout estimate
7. ROI: does this commission structure make business sense?

Also recommend: incentive program structure for top-tier partners.`,
        response_json_schema: {
          type: 'object',
          properties: {
            recommended_rate_percent: { type: 'number' },
            commission_structure: { type: 'string' },
            payment_schedule: { type: 'string' },
            clawback_terms: { type: 'string' },
            bonus_tiers: { type: 'array', items: { type: 'object', properties: { threshold: { type: 'string' }, bonus: { type: 'string' } } } },
            estimated_payout: { type: 'number' },
            roi_assessment: { type: 'string' },
            compliance_notes: { type: 'string' },
            incentive_program: { type: 'string' }
          }
        }
      });
    }

    // ─── 18. CROSS-PARTNER OPPORTUNITIES ─────────────────────────────────────
    if (action === 'cross_partner_opportunities') {
      const partners = await loadPartners({ status: 'active' });
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Identify opportunities for partners to collaborate with each other (not just with us).

Active partners: ${JSON.stringify(partners.map(p => ({ name: p.company_name, type: p.type, notes: p.notes })))}

Find:
1. Partner pairs with complementary offerings (neither competes with the other)
2. Introductions we could facilitate for mutual benefit
3. Three-way co-marketing opportunities (us + two partners)
4. Partners who could serve each other's customers
5. Ecosystem plays: where building a mini-ecosystem of our partners creates lock-in and collective value

For each opportunity: expected outcome, how to facilitate, and our role.
Goal: make our network more valuable by connecting the nodes.`,
        response_json_schema: {
          type: 'object',
          properties: {
            partner_pairs: { type: 'array', items: { type: 'object', properties: {
              partner_a: { type: 'string' }, partner_b: { type: 'string' },
              opportunity: { type: 'string' }, our_role: { type: 'string' }, expected_outcome: { type: 'string' }
            }}},
            three_way_opportunities: { type: 'array', items: { type: 'string' } },
            ecosystem_plays: { type: 'array', items: { type: 'string' } },
            recommended_introductions: { type: 'array', items: { type: 'object', properties: {
              introduce: { type: 'string' }, to: { type: 'string' }, why: { type: 'string' }
            }}}
          }
        }
      });
    }


    // 19. STRATEGIC FIT SCORING
    if (action === 'strategic_fit_scoring') {
      const { candidate_name, candidate_profile } = params;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Score a partner candidate for strategic fit.

Candidate: ${candidate_name || 'unknown'}
Industry: ${industry}
Partner type: ${partner_type}
Candidate profile: ${candidate_profile || 'not provided'}

Score across:
1) audience overlap
2) product complementarity
3) channel leverage
4) brand/reputation alignment
5) execution capability
6) risk/compliance profile

Return weighted score (0-100), rationale, and next-step recommendation.`,
        response_json_schema: {
          type: 'object',
          properties: {
            weighted_fit_score: { type: 'number' },
            category_scores: { type: 'array', items: { type: 'object', properties: { category: { type: 'string' }, score: { type: 'number' }, rationale: { type: 'string' } } } },
            top_strengths: { type: 'array', items: { type: 'string' } },
            top_risks: { type: 'array', items: { type: 'string' } },
            recommendation: { type: 'string' },
          }
        }
      });
    }

    // 20. INTENT DISCOVERY
    if (action === 'intent_discovery') {
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Detect partner intent signals in ${industry}.

Signals to look for:
- hiring partnership roles
- integration marketplace announcements
- alliance press releases
- event sponsorships and ecosystem expansions

Return likely partner-seeking entities, intent confidence, and outreach angle.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            entities: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, intent_signal: { type: 'string' }, confidence: { type: 'string' }, suggested_outreach_angle: { type: 'string' } } } },
            top_targets_this_week: { type: 'array', items: { type: 'string' } },
          }
        }
      });
    }

    // 21. CHANNEL CONFLICT DETECTION
    if (action === 'channel_conflict_detection') {
      const partners = await loadPartners({ status: 'active' });
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Detect channel conflicts in our active partner ecosystem.

Active partners: ${JSON.stringify(partners.map(p => ({ name: p.company_name, type: p.type, notes: p.notes })))}

Identify:
1) overlap conflicts
2) direct-vs-partner conflicts
3) referral ownership disputes
4) risk severity and resolution playbooks`,
        response_json_schema: {
          type: 'object',
          properties: {
            conflicts: { type: 'array', items: { type: 'object', properties: { conflict: { type: 'string' }, severity: { type: 'string' }, affected_partners: { type: 'array', items: { type: 'string' } }, resolution: { type: 'string' } } } },
            prevention_policies: { type: 'array', items: { type: 'string' } },
          }
        }
      });
    }

    // 22. PARTNER TIERING ENGINE
    if (action === 'partner_tiering_engine') {
      const partners = await loadPartners();
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Tier our partner portfolio and recommend treatment model.

Partners: ${JSON.stringify(partners.map(p => ({ name: p.company_name, type: p.type, status: p.status, revenue: p.revenue_attributed || 0, leads: p.leads_generated || 0, opportunity_score: p.opportunity_score || 0 })))}

Define tiering:
- Strategic
- Growth
- Maintain
- Reassess

For each partner: tier, why, and operating cadence.`,
        response_json_schema: {
          type: 'object',
          properties: {
            tiered_partners: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, tier: { type: 'string' }, rationale: { type: 'string' }, cadence: { type: 'string' } } } },
            tier_rules: { type: 'array', items: { type: 'string' } },
            resource_allocation: { type: 'array', items: { type: 'string' } },
          }
        }
      });
    }

    // 23. ECOSYSTEM POSITIONING
    if (action === 'ecosystem_positioning') {
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Assess our ecosystem positioning in ${industry}.

Map:
1) platform ecosystems we should deepen (e.g., cloud/marketplace/app ecosystems)
2) partnership moats we can build
3) ecosystem white spaces for us to lead
4) 90-day ecosystem moves`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            ecosystem_map: { type: 'array', items: { type: 'string' } },
            moat_moves: { type: 'array', items: { type: 'string' } },
            white_spaces: { type: 'array', items: { type: 'string' } },
            ninety_day_moves: { type: 'array', items: { type: 'string' } },
          }
        }
      });
    }

    // 24. PART FULL SELF TEST
    if (action === 'part_full_self_test') {
      const [analytics, health, discovery, conflict, tiering, ecosystem] = await Promise.all([
        base44.functions.invoke('partPartnershipEngine', { action: 'partner_analytics' }).then((r: any) => r.data?.result).catch(() => null),
        base44.functions.invoke('partPartnershipEngine', { action: 'health_audit' }).then((r: any) => r.data?.result).catch(() => null),
        base44.functions.invoke('partPartnershipEngine', { action: 'discover_partners' }).then((r: any) => r.data?.result).catch(() => null),
        base44.functions.invoke('partPartnershipEngine', { action: 'channel_conflict_detection' }).then((r: any) => r.data?.result).catch(() => null),
        base44.functions.invoke('partPartnershipEngine', { action: 'partner_tiering_engine' }).then((r: any) => r.data?.result).catch(() => null),
        base44.functions.invoke('partPartnershipEngine', { action: 'ecosystem_positioning' }).then((r: any) => r.data?.result).catch(() => null),
      ]);

      result = {
        analytics,
        health,
        discovery,
        conflict,
        tiering,
        ecosystem,
        checks: {
          analytics_ok: Boolean(analytics),
          health_ok: Boolean(health),
          discovery_ok: Boolean(discovery),
          conflict_ok: Boolean(conflict),
          tiering_ok: Boolean(tiering),
          ecosystem_ok: Boolean(ecosystem),
        },
      };
    }
    if (!result) {
      result = {
        message: `Action '${action}' received. Available actions: discover_partners, scout_influencers, competitor_partner_map, draft_outreach, relationship_score, health_audit, prepare_qbr, co_marketing_plan, co_branded_content, influencer_vetting, campaign_brief, partner_analytics, partner_ltv, generate_agreement, cross_sell_opportunities, manage_partnerships, event_strategy, commission_calculation, cross_partner_opportunities, strategic_fit_scoring, intent_discovery, channel_conflict_detection, partner_tiering_engine, ecosystem_positioning, part_full_self_test`
      };
    }

    return Response.json({ status: 'part_complete', action, result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});


