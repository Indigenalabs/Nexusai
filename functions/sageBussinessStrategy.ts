import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const { action, params = {} } = payload;

    // Shared data loaders
    const loadCoreData = async () => {
      const [financials, strategies, leads, campaigns, tasks, clients, transactions] = await Promise.all([
        base44.asServiceRole.entities.FinancialSnapshot.list('-date', 12).catch(() => []),
        base44.asServiceRole.entities.GrowthStrategy.list('-created_date', 50).catch(() => []),
        base44.asServiceRole.entities.Lead.list('-created_date', 200).catch(() => []),
        base44.asServiceRole.entities.Campaign.list('-created_date', 20).catch(() => []),
        base44.asServiceRole.entities.Task.list('-created_date', 100).catch(() => []),
        base44.asServiceRole.entities.Client.list('-created_date', 100).catch(() => []),
        base44.asServiceRole.entities.Transaction.list('-created_date', 200).catch(() => []),
      ]);
      return { financials, strategies, leads, campaigns, tasks, clients, transactions };
    };

    let result = null;

    // ─── 1. BUSINESS HEALTH ─────────────────────────────────────────────────

    if (action === 'health_analysis') {
      const { financials, leads, campaigns, tasks, clients } = await loadCoreData();
      const latest = financials[0] || {};
      const prev = financials[1] || {};

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Perform a comprehensive business health analysis. Data:

FINANCIALS (last ${financials.length} periods):
${financials.map(f => `Revenue: $${f.revenue || 0}, Profit: $${f.profit || 0}, Cash: $${f.cash_balance || 0}, Date: ${f.date}`).join('\n')}

PIPELINE:
- Leads: ${leads.length} total. Hot: ${leads.filter(l => l.status === 'hot').length}. Converted: ${leads.filter(l => l.status === 'converted').length}
- Clients: ${clients.length}
- Active Campaigns: ${campaigns.filter(c => c.status === 'active').length}
- Tasks: ${tasks.length} total. Overdue: ${tasks.filter(t => t.status !== 'completed' && t.due_date && new Date(t.due_date) < new Date()).length}

LATEST SNAPSHOT: Revenue $${latest.revenue || 0}, vs prior $${prev.revenue || 0}

Calculate overall health score (0-100) across 5 dimensions: Financial Health, Growth Momentum, Operational Efficiency, Market Position, Pipeline Health. Give exact scores, key strengths, critical weaknesses, and the single most important action to take this week.`,
        response_json_schema: {
          type: 'object',
          properties: {
            overall_score: { type: 'number' },
            status: { type: 'string' },
            dimensions: {
              type: 'object',
              properties: {
                financial: { type: 'number' },
                growth: { type: 'number' },
                operations: { type: 'number' },
                market: { type: 'number' },
                pipeline: { type: 'number' }
              }
            },
            strengths: { type: 'array', items: { type: 'string' } },
            weaknesses: { type: 'array', items: { type: 'string' } },
            top_action: { type: 'string' },
            summary: { type: 'string' }
          }
        }
      });
    }

    if (action === 'trend_analysis') {
      const { financials, leads } = await loadCoreData();
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze business trends and detect anomalies. Financial data: ${JSON.stringify(financials.map(f => ({ date: f.date, revenue: f.revenue, profit: f.profit })))}. Lead volume by period context. Identify: 1) Revenue trend (growing/declining/stable + rate), 2) Any anomalies (positive or negative), 3) Seasonal patterns, 4) Key inflection points, 5) 3-month forecast. Flag opportunities and risks.`,
        response_json_schema: {
          type: 'object',
          properties: {
            revenue_trend: { type: 'string' },
            growth_rate_mom: { type: 'number' },
            anomalies: { type: 'array', items: { type: 'object', properties: { type: { type: 'string' }, description: { type: 'string' }, impact: { type: 'string' } } } },
            forecast_3m: { type: 'object', properties: { low: { type: 'number' }, mid: { type: 'number' }, high: { type: 'number' } } },
            key_insight: { type: 'string' }
          }
        }
      });
    }

    if (action === 'health_scorecard') {
      const { financials, leads, clients } = await loadCoreData();
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Build a balanced scorecard for this business. Financial data: ${JSON.stringify(financials.slice(0, 3))}. Leads: ${leads.length}, Clients: ${clients.length}. Score each of the 4 BSC perspectives (Financial, Customer, Internal Process, Learning & Growth) 0-100. Identify which metrics are in green/amber/red zones. Generate alerts for anything in red.`,
        response_json_schema: {
          type: 'object',
          properties: {
            financial_score: { type: 'number' },
            customer_score: { type: 'number' },
            process_score: { type: 'number' },
            growth_score: { type: 'number' },
            red_alerts: { type: 'array', items: { type: 'string' } },
            amber_warnings: { type: 'array', items: { type: 'string' } },
            green_wins: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    if (action === 'benchmark_analysis') {
      const { financials } = await loadCoreData();
      const industry = params.industry || 'professional services / NDIS';
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Compare this business against ${industry} industry benchmarks. Revenue: $${financials[0]?.revenue || 0}, Profit margin: ${financials[0]?.revenue ? ((financials[0].profit / financials[0].revenue) * 100).toFixed(1) : 0}%. Research and apply real industry benchmarks for: CAC, LTV, margin, growth rate, NPS. Score us above/at/below benchmark for each. Identify the biggest gaps and opportunities.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            benchmarks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  metric: { type: 'string' },
                  our_value: { type: 'string' },
                  industry_benchmark: { type: 'string' },
                  rating: { type: 'string' },
                  gap_opportunity: { type: 'string' }
                }
              }
            },
            overall_benchmark_position: { type: 'string' },
            biggest_opportunity: { type: 'string' }
          }
        }
      });
    }

    // ─── 2. GROWTH OPPORTUNITIES ─────────────────────────────────────────────

    if (action === 'generate_strategies') {
      const { financials, leads, clients, campaigns } = await loadCoreData();
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate the top 3 growth strategies for this business right now. Context: Revenue $${financials[0]?.revenue || 0}, Lead pipeline: ${leads.length}, Clients: ${clients.length}, Active campaigns: ${campaigns.filter(c => c.status === 'active').length}. For each strategy: name it, describe the logic, quantify the upside (revenue impact), estimate effort (1-10), confidence (High/Medium/Low), timeframe, owner, and top 3 execution steps. Prioritize by risk-adjusted impact.`,
        response_json_schema: {
          type: 'object',
          properties: {
            strategies: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  rationale: { type: 'string' },
                  revenue_upside: { type: 'string' },
                  effort_score: { type: 'number' },
                  impact_score: { type: 'number' },
                  confidence: { type: 'string' },
                  timeframe: { type: 'string' },
                  owner: { type: 'string' },
                  steps: { type: 'array', items: { type: 'string' } }
                }
              }
            },
            top_recommendation: { type: 'string' }
          }
        }
      });
    }

    if (action === 'market_gap_analysis') {
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Perform a market gap analysis for an NDIS/Aged Care/disability services business in Australia. Research: 1) What customer segments are underserved? 2) What service types have unmet demand? 3) What geographic areas are supply-constrained? 4) What competitor weaknesses create opportunities? 5) What emerging needs aren't being addressed? Provide 5 specific gaps with estimated market size and our ability to fill them.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            gaps: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  gap_name: { type: 'string' },
                  description: { type: 'string' },
                  market_size: { type: 'string' },
                  ease_of_entry: { type: 'string' },
                  urgency: { type: 'string' },
                  recommended_action: { type: 'string' }
                }
              }
            },
            biggest_gap: { type: 'string' }
          }
        }
      });
    }

    if (action === 'upsell_analysis') {
      const { clients, transactions } = await loadCoreData();
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze upsell and cross-sell opportunities. Client count: ${clients.length}. Transaction data: ${JSON.stringify(transactions.slice(0, 50).map(t => ({ amount: t.amount, category: t.category, date: t.date })))}. Identify: 1) Which client segments have highest upsell potential, 2) Top 3 cross-sell product/service combinations, 3) Expansion revenue estimate, 4) Triggers to identify upsell-ready clients, 5) Recommended outreach sequence.`,
        response_json_schema: {
          type: 'object',
          properties: {
            high_potential_segments: { type: 'array', items: { type: 'string' } },
            top_crosssell_opportunities: { type: 'array', items: { type: 'object', properties: { combination: { type: 'string' }, revenue_potential: { type: 'string' }, trigger: { type: 'string' } } } },
            expansion_revenue_estimate: { type: 'string' },
            upsell_triggers: { type: 'array', items: { type: 'string' } },
            recommended_action: { type: 'string' }
          }
        }
      });
    }

    if (action === 'product_ideation') {
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate new product and service ideas for an NDIS/Aged Care provider in Australia. Research current market trends, participant needs, NDIS policy direction, and technology opportunities. Generate 5 ideas with: concept name, description, target segment, estimated demand, revenue model, development effort, and first validation step. Focus on ideas that leverage existing capabilities.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            ideas: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  concept: { type: 'string' },
                  target_segment: { type: 'string' },
                  revenue_model: { type: 'string' },
                  effort: { type: 'string' },
                  validation_step: { type: 'string' }
                }
              }
            },
            best_idea: { type: 'string' }
          }
        }
      });
    }

    // ─── 3. SCENARIO PLANNING ────────────────────────────────────────────────

    if (action === 'scenario_modeling') {
      const { financials } = await loadCoreData();
      const baseRevenue = financials[0]?.revenue || 0;
      const scenario = params.scenario || 'general growth planning';
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Model 3 strategic scenarios for: "${scenario}". Current monthly revenue: $${baseRevenue}. 

Scenario A (Conservative): minimal changes, organic growth only
Scenario B (Growth Bet): meaningful investment in primary growth lever, moderate risk
Scenario C (Aggressive/Pivot): major strategic shift or heavy investment

For each: 12-month revenue projection, required investment, key assumptions, top 3 risks, success probability (%), and the decision criteria that would make you choose this path.`,
        response_json_schema: {
          type: 'object',
          properties: {
            scenarios: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  label: { type: 'string' },
                  revenue_12m: { type: 'number' },
                  growth_percent: { type: 'number' },
                  investment_required: { type: 'string' },
                  success_probability: { type: 'number' },
                  key_assumptions: { type: 'array', items: { type: 'string' } },
                  risks: { type: 'array', items: { type: 'string' } },
                  choose_if: { type: 'string' }
                }
              }
            },
            recommended_scenario: { type: 'string' },
            key_decision_factor: { type: 'string' }
          }
        }
      });
    }

    if (action === 'growth_forecast') {
      const { financials, leads, clients } = await loadCoreData();
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Forecast growth trajectory over the next 12 months. Historical revenue: ${financials.map(f => `${f.date}: $${f.revenue}`).join(', ')}. Lead pipeline: ${leads.length}. Current clients: ${clients.length}. Model: conservative (current trajectory), optimistic (top-quartile execution), and breakthrough (all growth levers firing). Give monthly projections for each path. Identify the key inflection points and the levers that would move us from conservative to optimistic.`,
        response_json_schema: {
          type: 'object',
          properties: {
            conservative_12m: { type: 'number' },
            optimistic_12m: { type: 'number' },
            breakthrough_12m: { type: 'number' },
            key_growth_levers: { type: 'array', items: { type: 'string' } },
            monthly_forecast: { type: 'array', items: { type: 'object', properties: { month: { type: 'string' }, conservative: { type: 'number' }, optimistic: { type: 'number' } } } },
            inflection_point: { type: 'string' }
          }
        }
      });
    }

    if (action === 'risk_adjusted_roi') {
      const initiative = params.initiative || 'strategic growth initiative';
      const investment = params.investment || 0;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Calculate risk-adjusted ROI for: "${initiative}" with investment of $${investment}. Assess: 1) Best case ROI, 2) Expected (probability-weighted) ROI, 3) Worst case, 4) Break-even timeline, 5) Key risk factors and their probability/impact, 6) Mitigation strategies, 7) Decision recommendation. Be quantitative. Use realistic multipliers.`,
        response_json_schema: {
          type: 'object',
          properties: {
            best_case_roi: { type: 'number' },
            expected_roi: { type: 'number' },
            worst_case_roi: { type: 'number' },
            breakeven_months: { type: 'number' },
            risk_factors: { type: 'array', items: { type: 'object', properties: { risk: { type: 'string' }, probability: { type: 'string' }, impact: { type: 'string' } } } },
            recommendation: { type: 'string' }
          }
        }
      });
    }

    // ─── 4. STRATEGY FORMULATION ─────────────────────────────────────────────

    if (action === 'okr_planning') {
      const { financials, strategies } = await loadCoreData();
      const quarter = params.quarter || 'Q2 2026';
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Design OKRs for ${quarter}. Context: Revenue $${financials[0]?.revenue || 0}, Active strategies: ${strategies.filter(s => s.status === 'in_progress').length}. Create 3 company-level Objectives, each with 3 measurable Key Results. Then propose department OKRs for: Sales/Growth, Operations, Finance. Make KRs specific, measurable, and achievable but ambitious. Include a confidence rating for each KR.`,
        response_json_schema: {
          type: 'object',
          properties: {
            company_okrs: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  objective: { type: 'string' },
                  key_results: { type: 'array', items: { type: 'object', properties: { kr: { type: 'string' }, target: { type: 'string' }, confidence: { type: 'string' } } } }
                }
              }
            },
            department_okrs: { type: 'array', items: { type: 'object', properties: { department: { type: 'string' }, objective: { type: 'string' }, key_results: { type: 'array', items: { type: 'string' } } } } }
          }
        }
      });
    }

    if (action === 'strategic_roadmap') {
      const { strategies } = await loadCoreData();
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a strategic roadmap for the next 4 quarters. Existing strategies: ${JSON.stringify(strategies.slice(0, 10).map(s => ({ name: s.name, status: s.status, timeframe: s.timeframe })))}. Build a quarter-by-quarter roadmap with: key initiatives per quarter, milestones, dependencies, resource requirements, and expected outcomes. Flag risks and dependencies between initiatives. Identify the critical path.`,
        response_json_schema: {
          type: 'object',
          properties: {
            quarters: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  quarter: { type: 'string' },
                  theme: { type: 'string' },
                  initiatives: { type: 'array', items: { type: 'string' } },
                  milestones: { type: 'array', items: { type: 'string' } },
                  dependencies: { type: 'array', items: { type: 'string' } },
                  expected_outcome: { type: 'string' }
                }
              }
            },
            critical_path: { type: 'array', items: { type: 'string' } },
            biggest_risk: { type: 'string' }
          }
        }
      });
    }

    if (action === 'investment_prioritization') {
      const { strategies, financials } = await loadCoreData();
      const budget = params.budget || financials[0]?.cash_balance || 0;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Prioritize strategic investment allocation with available budget $${budget}. Strategies to evaluate: ${JSON.stringify(strategies.slice(0, 15).map(s => ({ name: s.name, status: s.status })))}. Score each on: strategic alignment (1-10), expected ROI, time to value, resource requirement, risk level. Build an optimal portfolio allocation. Identify what NOT to invest in and why.`,
        response_json_schema: {
          type: 'object',
          properties: {
            prioritized_investments: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  initiative: { type: 'string' },
                  recommended_budget: { type: 'string' },
                  strategic_score: { type: 'number' },
                  rationale: { type: 'string' }
                }
              }
            },
            do_not_invest: { type: 'array', items: { type: 'object', properties: { initiative: { type: 'string' }, reason: { type: 'string' } } } },
            portfolio_summary: { type: 'string' }
          }
        }
      });
    }

    if (action === 'pivot_analysis') {
      const { financials, strategies } = await loadCoreData();
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Assess whether the current business strategy needs a pivot. Revenue trend: ${financials.map(f => f.revenue).join(', ')}. Current strategies: ${strategies.filter(s => s.status === 'in_progress').map(s => s.name).join(', ')}. Analyze: 1) Is current strategy working? 2) What signals suggest a pivot may be needed? 3) If pivot: what direction? 4) Cost of pivoting vs. staying the course, 5) Pivot types to consider (audience, product, channel, business model), 6) Recommendation with confidence level.`,
        response_json_schema: {
          type: 'object',
          properties: {
            pivot_warranted: { type: 'boolean' },
            current_strategy_assessment: { type: 'string' },
            pivot_signals: { type: 'array', items: { type: 'string' } },
            pivot_options: { type: 'array', items: { type: 'object', properties: { type: { type: 'string' }, description: { type: 'string' }, upside: { type: 'string' }, cost: { type: 'string' } } } },
            recommendation: { type: 'string' }
          }
        }
      });
    }

    // ─── 5. COMPETITIVE INTELLIGENCE ─────────────────────────────────────────

    if (action === 'competitive_positioning') {
      const { clients } = await loadCoreData();
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze our competitive positioning in the NDIS/Aged Care market in Australia. Research the competitive landscape. Map our position vs. top competitors on: price, service quality, specialisation, geographic reach, tech/innovation, brand strength, participant experience. Identify our 3 sustainable competitive advantages and 3 competitive vulnerabilities. Recommend how to defend advantages and address vulnerabilities.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            competitive_advantages: { type: 'array', items: { type: 'object', properties: { advantage: { type: 'string' }, sustainability: { type: 'string' }, how_to_leverage: { type: 'string' } } } },
            vulnerabilities: { type: 'array', items: { type: 'object', properties: { vulnerability: { type: 'string' }, risk_level: { type: 'string' }, mitigation: { type: 'string' } } } },
            positioning_statement: { type: 'string' },
            differentiation_strategy: { type: 'string' }
          }
        }
      });
    }

    if (action === 'blue_ocean_analysis') {
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Identify blue ocean opportunities for an NDIS/Aged Care provider. Using the Blue Ocean Strategy framework (eliminate-reduce-raise-create), analyze: 1) What factors the industry competes on that should be eliminated? 2) What should be reduced below industry standard? 3) What should be raised above? 4) What should be created that the industry has never offered? Identify 2-3 genuine blue ocean moves with their market creation potential.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            eliminate: { type: 'array', items: { type: 'string' } },
            reduce: { type: 'array', items: { type: 'string' } },
            raise: { type: 'array', items: { type: 'string' } },
            create: { type: 'array', items: { type: 'string' } },
            blue_ocean_moves: { type: 'array', items: { type: 'object', properties: { move: { type: 'string' }, description: { type: 'string' }, market_potential: { type: 'string' } } } }
          }
        }
      });
    }

    if (action === 'disruption_risk') {
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Assess disruption risks for an NDIS/Aged Care services business in Australia. Research: 1) Emerging technologies (AI, telehealth, automation) that could reshape service delivery, 2) New business models threatening incumbent providers, 3) Regulatory changes on the horizon, 4) Startups or new entrants to watch, 5) Participant/family expectation shifts. For each risk: probability (3yr), impact, and our defensive or offensive response.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            disruption_risks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  risk_name: { type: 'string' },
                  description: { type: 'string' },
                  probability_3yr: { type: 'string' },
                  impact: { type: 'string' },
                  response_strategy: { type: 'string' }
                }
              }
            },
            overall_disruption_risk: { type: 'string' },
            recommended_defensive_move: { type: 'string' }
          }
        }
      });
    }

    if (action === 'war_gaming') {
      const move = params.strategic_move || 'launching a new service line';
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Run a war game simulation. Our planned strategic move: "${move}". Simulate how key competitors in the NDIS/Aged Care space would respond. For each likely competitor response: probability, timeline, our counter-move, and the net outcome. Also simulate the scenario where we DON'T make this move and a competitor does it first. Give a final recommendation on whether and how to proceed.`,
        response_json_schema: {
          type: 'object',
          properties: {
            competitor_responses: { type: 'array', items: { type: 'object', properties: { competitor_type: { type: 'string' }, likely_response: { type: 'string' }, probability: { type: 'string' }, our_counter: { type: 'string' } } } },
            first_mover_advantage: { type: 'string' },
            cost_of_inaction: { type: 'string' },
            recommendation: { type: 'string' }
          }
        }
      });
    }

    // ─── 6. LTV & CUSTOMER ECONOMICS ─────────────────────────────────────────

    if (action === 'ltv_analysis') {
      const { clients, transactions } = await loadCoreData();
      const totalRevenue = transactions.reduce((s, t) => s + (t.amount || 0), 0);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze customer lifetime value economics. Clients: ${clients.length}, Total transaction revenue: $${totalRevenue}, Avg transaction: $${clients.length ? (totalRevenue / transactions.length).toFixed(0) : 0}. Calculate: avg LTV, LTV by client segment, estimated CAC (ask me if unknown), LTV:CAC ratio, payback period, churn rate estimate, repeat engagement rate. Identify the highest-LTV segment and recommend 3 ways to improve LTV across the portfolio.`,
        response_json_schema: {
          type: 'object',
          properties: {
            avg_ltv: { type: 'number' },
            ltv_cac_ratio: { type: 'number' },
            payback_period_months: { type: 'number' },
            churn_rate_estimate: { type: 'number' },
            highest_ltv_segment: { type: 'string' },
            ltv_improvement_strategies: { type: 'array', items: { type: 'string' } },
            revenue_at_risk: { type: 'string' }
          }
        }
      });
    }

    if (action === 'churn_analysis') {
      const { clients, transactions } = await loadCoreData();
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze churn risk and retention strategy. Clients: ${clients.length}. Transaction activity: ${JSON.stringify(transactions.slice(0, 30).map(t => ({ amount: t.amount, date: t.date })))}. Identify: 1) Estimated current churn rate, 2) Leading indicators of churn risk, 3) High-risk segments, 4) Revenue at risk, 5) Top 5 retention interventions ranked by impact/cost, 6) Early warning system to detect churn before it happens.`,
        response_json_schema: {
          type: 'object',
          properties: {
            estimated_churn_rate: { type: 'number' },
            revenue_at_risk: { type: 'string' },
            churn_indicators: { type: 'array', items: { type: 'string' } },
            high_risk_segments: { type: 'array', items: { type: 'string' } },
            retention_interventions: { type: 'array', items: { type: 'object', properties: { action: { type: 'string' }, impact: { type: 'string' }, cost: { type: 'string' } } } }
          }
        }
      });
    }

    // ─── 7. INVESTOR & BOARD COMMS ───────────────────────────────────────────

    if (action === 'investor_pitch') {
      const { financials, clients } = await loadCoreData();
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a compelling investor pitch narrative. Business: NDIS/Aged Care services provider, Australia. Revenue: $${financials[0]?.revenue || 0}/mo, Clients: ${clients.length}. Structure: 1) The problem (market pain), 2) Our solution, 3) Market size (TAM/SAM/SOM), 4) Traction and proof points, 5) Business model, 6) Growth strategy, 7) Team/operational edge, 8) The ask and use of funds. Make it compelling, data-rich, and honest about risks.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            problem_statement: { type: 'string' },
            solution: { type: 'string' },
            market_size: { type: 'object', properties: { tam: { type: 'string' }, sam: { type: 'string' }, som: { type: 'string' } } },
            traction_points: { type: 'array', items: { type: 'string' } },
            business_model: { type: 'string' },
            growth_strategy_summary: { type: 'string' },
            key_risks: { type: 'array', items: { type: 'string' } },
            elevator_pitch: { type: 'string' }
          }
        }
      });
    }

    if (action === 'long_range_plan') {
      const { financials } = await loadCoreData();
      const years = params.years || 3;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a ${years}-year strategic plan. Current monthly revenue: $${financials[0]?.revenue || 0}. Research NDIS/Aged Care market outlook in Australia. Include: year-by-year revenue targets, key strategic priorities per year, major milestones, workforce growth needed, technology investments, market expansion phases, financial projections (revenue, profit, cash), key assumptions, and critical success factors.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            vision_statement: { type: 'string' },
            year_plans: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  year: { type: 'string' },
                  theme: { type: 'string' },
                  revenue_target: { type: 'string' },
                  strategic_priorities: { type: 'array', items: { type: 'string' } },
                  key_milestones: { type: 'array', items: { type: 'string' } },
                  headcount_target: { type: 'string' }
                }
              }
            },
            key_assumptions: { type: 'array', items: { type: 'string' } },
            critical_success_factors: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 8. SELF-LEARNING ────────────────────────────────────────────────────

    if (action === 'strategy_retrospective') {
      const { strategies } = await loadCoreData();
      const completed = strategies.filter(s => s.status === 'completed');
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Run a strategy retrospective on ${completed.length} completed strategies: ${JSON.stringify(completed.map(s => ({ name: s.name, outcome: s.outcome || 'unknown', impact: s.impact })))}. Analyze: 1) Which strategies delivered vs. fell short, 2) Common patterns in successes, 3) Common failure modes, 4) What we should do more of, 5) What we should stop doing, 6) How to improve future strategy quality. Apply causal reasoning, not just correlation.`,
        response_json_schema: {
          type: 'object',
          properties: {
            success_patterns: { type: 'array', items: { type: 'string' } },
            failure_patterns: { type: 'array', items: { type: 'string' } },
            do_more: { type: 'array', items: { type: 'string' } },
            stop_doing: { type: 'array', items: { type: 'string' } },
            strategy_quality_improvements: { type: 'array', items: { type: 'string' } },
            overall_effectiveness_score: { type: 'number' }
          }
        }
      });
    }

    if (action === 'hypothesis_generation') {
      const { financials, leads } = await loadCoreData();
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate 5 testable strategic hypotheses for this business. Revenue: $${financials[0]?.revenue || 0}, Leads: ${leads.length}. Each hypothesis should: have a clear "if-then" structure, be testable within 30-60 days, have a measurable success criteria, estimate impact if true, and suggest the simplest experiment to test it. Frame these as Maestro campaign or operational tests.`,
        response_json_schema: {
          type: 'object',
          properties: {
            hypotheses: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  hypothesis: { type: 'string' },
                  if_true_impact: { type: 'string' },
                  test_method: { type: 'string' },
                  success_criteria: { type: 'string' },
                  timeline_days: { type: 'number' }
                }
              }
            }
          }
        }
      });
    }


    // 9. NEXT-LEVEL SAGE 2.0 OPERATIONS
    if (action === 'macro_monitor') {
      const focus_geographies = params.focus_geographies || ['AU', 'US', 'EU'];
      const horizon = params.horizon || '12 months';
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Build a macro strategic monitoring brief for a growth-stage business.

Focus geographies: ${JSON.stringify(focus_geographies)}
Horizon: ${horizon}

Analyze macro signals:
1) GDP growth direction
2) inflation and interest-rate path
3) consumer and business confidence
4) labor market pressure
5) strategic implication for demand, margins, and risk posture

Return a concise executive brief with explicit recommendations for strategic stance (defensive, balanced, offensive).`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            macro_outlook: { type: 'string' },
            strategic_stance: { type: 'string' },
            opportunities: { type: 'array', items: { type: 'string' } },
            threats: { type: 'array', items: { type: 'string' } },
            recommended_moves: { type: 'array', items: { type: 'string' } },
          },
        },
      });
    }

    if (action === 'regulatory_radar') {
      const region = params.region || 'Australia';
      const sectors = params.sectors || ['NDIS', 'Aged Care'];
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Run a regulatory radar for region ${region} and sectors ${JSON.stringify(sectors)}.

Identify:
1) likely policy/regulatory changes in next 6-18 months
2) estimated impact on operations, margins, and compliance burden
3) preparatory actions to reduce downside and capture upside
4) top legal questions for Veritas

Return as an execution-ready policy watchlist.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            policy_watchlist: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  policy: { type: 'string' },
                  likelihood: { type: 'string' },
                  timing: { type: 'string' },
                  impact: { type: 'string' },
                  recommended_action: { type: 'string' },
                },
              },
            },
            top_legal_questions: { type: 'array', items: { type: 'string' } },
          },
        },
      });
    }

    if (action === 'mna_target_scan') {
      const thesis = params.thesis || 'capability expansion + geographic scale';
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Act as Sage M&A advisor.

Strategic thesis: ${thesis}

Produce:
1) acquisition target archetypes
2) strategic fit criteria
3) synergy model (revenue, cost, capability)
4) integration risk checklist
5) first-pass target scoring rubric

Return practical output suitable for Nexus/Commander review.`,
        response_json_schema: {
          type: 'object',
          properties: {
            target_archetypes: { type: 'array', items: { type: 'string' } },
            fit_criteria: { type: 'array', items: { type: 'string' } },
            synergy_model: { type: 'array', items: { type: 'string' } },
            integration_risks: { type: 'array', items: { type: 'string' } },
            scoring_rubric: { type: 'array', items: { type: 'string' } },
            recommendation: { type: 'string' },
          },
        },
      });
    }

    if (action === 'real_options_model') {
      const initiative = params.initiative || 'new growth initiative';
      const investment = Number(params.investment || 0);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Build a real-options style decision model for initiative "${initiative}" with initial investment $${investment}.

Return:
1) stage-gate option design (pilot, scale, pause, abandon)
2) value of flexibility vs one-shot commitment
3) trigger metrics for each gate
4) recommended go/no-go rules`,
        response_json_schema: {
          type: 'object',
          properties: {
            stage_gates: { type: 'array', items: { type: 'string' } },
            flexibility_value_summary: { type: 'string' },
            trigger_metrics: { type: 'array', items: { type: 'string' } },
            decision_rules: { type: 'array', items: { type: 'string' } },
            recommendation: { type: 'string' },
          },
        },
      });
    }

    if (action === 'strategic_risk_register') {
      const { financials, strategies, campaigns } = await loadCoreData();
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a strategic risk register using this context:
Revenue trend data points: ${financials.length}
Active strategies: ${strategies.filter(s => s.status === 'in_progress').length}
Active campaigns: ${campaigns.filter(c => c.status === 'active').length}

Produce 10 key strategic risks across market, competitive, execution, regulatory, and financial domains.
Each risk should include: likelihood, impact, velocity, early warning indicators, owner role, and mitigation playbook.`,
        response_json_schema: {
          type: 'object',
          properties: {
            risks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  risk: { type: 'string' },
                  domain: { type: 'string' },
                  likelihood: { type: 'string' },
                  impact: { type: 'string' },
                  velocity: { type: 'string' },
                  early_warning_indicators: { type: 'array', items: { type: 'string' } },
                  owner_role: { type: 'string' },
                  mitigation: { type: 'array', items: { type: 'string' } },
                },
              },
            },
            top_priority_risk: { type: 'string' },
          },
        },
      });
    }

    if (action === 'board_narrative_pack') {
      const { financials, strategies } = await loadCoreData();
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a board-ready strategy narrative pack.

Context:
- latest revenue: $${financials[0]?.revenue || 0}
- active strategies: ${strategies.filter(s => s.status === 'in_progress').length}

Include:
1) strategic headline
2) what changed since last review
3) progress vs plan
4) key risks and mitigations
5) decisions requested from board
6) appendix data requests`,
        response_json_schema: {
          type: 'object',
          properties: {
            strategic_headline: { type: 'string' },
            changes_since_last_review: { type: 'array', items: { type: 'string' } },
            progress_vs_plan: { type: 'array', items: { type: 'string' } },
            key_risks: { type: 'array', items: { type: 'string' } },
            board_decisions_requested: { type: 'array', items: { type: 'string' } },
            appendix_data_requests: { type: 'array', items: { type: 'string' } },
          },
        },
      });
    }

    if (action === 'cross_agent_strategy_sync') {
      const { financials, leads, campaigns, tasks } = await loadCoreData();
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a cross-agent strategic coordination directive.

Current signals:
- Revenue: $${financials[0]?.revenue || 0}
- Leads: ${leads.length}
- Active campaigns: ${campaigns.filter(c => c.status === 'active').length}
- Open tasks: ${tasks.filter(t => t.status !== 'completed').length}

Produce concrete instructions for:
Maestro, Prospect, Centsible, Support Sage, Atlas, Compass, Pulse, Merchant.
For each: objective, 2-3 actions, KPI, cadence, escalation trigger.`,
        response_json_schema: {
          type: 'object',
          properties: {
            directives: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  agent: { type: 'string' },
                  objective: { type: 'string' },
                  actions: { type: 'array', items: { type: 'string' } },
                  kpi: { type: 'string' },
                  cadence: { type: 'string' },
                  escalation_trigger: { type: 'string' },
                },
              },
            },
            commander_summary: { type: 'string' },
          },
        },
      });
    }

    if (action === 'sage_full_self_test') {
      const [health, forecast, roadmap, risk, comms] = await Promise.all([
        base44.functions.invoke('sageBussinessStrategy', { action: 'health_scorecard' }).then((r: any) => r.data?.result).catch(() => null),
        base44.functions.invoke('sageBussinessStrategy', { action: 'growth_forecast' }).then((r: any) => r.data?.result).catch(() => null),
        base44.functions.invoke('sageBussinessStrategy', { action: 'strategic_roadmap' }).then((r: any) => r.data?.result).catch(() => null),
        base44.functions.invoke('sageBussinessStrategy', { action: 'strategic_risk_register' }).then((r: any) => r.data?.result).catch(() => null),
        base44.functions.invoke('sageBussinessStrategy', { action: 'board_narrative_pack' }).then((r: any) => r.data?.result).catch(() => null),
      ]);

      result = {
        health,
        forecast,
        roadmap,
        risk,
        comms,
        checks: {
          health_ok: Boolean(health),
          forecast_ok: Boolean(forecast),
          roadmap_ok: Boolean(roadmap),
          risk_ok: Boolean(risk),
          comms_ok: Boolean(comms),
        },
      };
    }
    // Legacy action aliases
    if (action === 'scenario_planning') {
      return Response.json(await Response.json({ status: 'sage_action_complete', action: 'scenario_modeling', result }).json());
    }

    if (!result) {
      result = { message: `Action '${action}' not recognized. Available actions: health_analysis, generate_strategies, scenario_modeling, ltv_analysis, market_gap_analysis, competitive_positioning, growth_forecast, okr_planning, strategic_roadmap, investment_prioritization, blue_ocean_analysis, disruption_risk, war_gaming, pivot_analysis, trend_analysis, benchmark_analysis, upsell_analysis, product_ideation, risk_adjusted_roi, investor_pitch, long_range_plan, churn_analysis, strategy_retrospective, hypothesis_generation, macro_monitor, regulatory_radar, mna_target_scan, real_options_model, strategic_risk_register, board_narrative_pack, cross_agent_strategy_sync, sage_full_self_test` };
    }

    return Response.json({ status: 'sage_action_complete', action, result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

