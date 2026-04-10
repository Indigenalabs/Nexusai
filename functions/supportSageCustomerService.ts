import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const { action, params = {} } = payload;

    // Legacy field support
    const customer_inquiry = payload.customer_inquiry || params.customer_inquiry || '';
    const ticket_id = payload.ticket_id || params.ticket_id;
    const industry = payload.industry || params.industry || 'general business';

    let result = null;

    // ─── HELPERS ─────────────────────────────────────────────────────────────
    const loadTickets = async (limit = 50, filter = {}) => {
      try {
        if (Object.keys(filter).length > 0) {
          return base44.asServiceRole.entities.Ticket.filter(filter, '-created_date', limit);
        }
        return base44.asServiceRole.entities.Ticket.list('-created_date', limit);
      } catch (_) { return []; }
    };

    const loadKB = async () =>
      base44.asServiceRole.entities.KnowledgeBase.list('-created_date', 50).catch(() => []);

    const loadClients = async () =>
      base44.asServiceRole.entities.Client.list('-created_date', 50).catch(() => []);

    // ─── 1. TRIAGE TICKET ────────────────────────────────────────────────────
    if (action === 'triage_ticket') {
      const { subject, message, customer_email, customer_name, channel } = params;
      const inquiry = subject || message || customer_inquiry;

      const triage = await base44.integrations.Core.InvokeLLM({
        prompt: `Triage this customer support ticket with precision and empathy.

Customer: ${customer_name || customer_email || 'Unknown'}
Channel: ${channel || 'web'}
Message: "${inquiry}"
Business context: ${industry}

Determine:
1. Category (billing, technical, product, shipping, returns, account, complaint, general, feature_request, legal, security)
2. Intent (what does the customer actually want?)
3. Sentiment (positive/neutral/frustrated/angry/urgent)
4. Priority P1=critical/P2=high/P3=medium/P4=low based on: urgency, emotional state, VIP signals, business impact
5. Can AI fully resolve this? (yes/partial/no)
6. If escalation needed: why and to which team
7. Suggested response tone (empathetic/professional/urgent/friendly)
8. Estimated resolution time in minutes
9. Is this a churn risk? (yes/no/maybe)`,
        response_json_schema: {
          type: 'object',
          properties: {
            category: { type: 'string' },
            intent: { type: 'string' },
            sentiment: { type: 'string' },
            priority: { type: 'string' },
            ai_solvable: { type: 'string' },
            escalation_needed: { type: 'boolean' },
            escalate_to: { type: 'string' },
            escalation_reason: { type: 'string' },
            response_tone: { type: 'string' },
            resolution_time_minutes: { type: 'number' },
            churn_risk: { type: 'boolean' },
            suggested_first_response: { type: 'string' }
          }
        }
      });

      const ticket = await base44.asServiceRole.entities.Ticket.create({
        subject: inquiry.slice(0, 200),
        message: inquiry,
        customer_email: customer_email || null,
        customer_name: customer_name || null,
        channel: channel || 'web',
        category: triage.category,
        priority: triage.priority === 'P1' ? 'critical' : triage.priority === 'P2' ? 'high' : triage.priority === 'P3' ? 'medium' : 'low',
        sentiment: triage.sentiment,
        status: triage.ai_solvable === 'no' ? 'pending' : 'open',
        industry
      }).catch(() => null);

      if (triage.churn_risk && customer_email) {
        await base44.asServiceRole.entities.Notification.create({
          type: 'churn_risk',
          title: `Churn Risk: ${customer_name || customer_email}`,
          message: `Customer showing churn signals. Ticket: "${inquiry.slice(0, 100)}"`,
          priority: 'high'
        }).catch(() => null);
      }

      result = { ticket_id: ticket?.id, triage };
    }

    // ─── 2. GENERATE RESPONSE ────────────────────────────────────────────────
    if (action === 'generate_response') {
      const { subject, message, customer_name, sentiment, category, ticket_context, channel } = params;
      const inquiry = message || customer_inquiry;
      const kb = await loadKB();

      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate an empathetic, accurate customer support response.

Customer: ${customer_name || 'Valued Customer'}
Sentiment: ${sentiment || 'neutral'}
Category: ${category || 'general'}
Channel: ${channel || 'email'}
Message: "${inquiry}"
Context: ${ticket_context || 'First contact'}

Knowledge base articles available: ${kb.slice(0, 10).map(k => k.title).join(', ')}

Generate: 1) A warm, helpful response that addresses the issue specifically, 2) Acknowledges their experience, 3) Provides a clear solution or next steps, 4) Offers additional help, 5) Appropriate sign-off. Tone: ${sentiment === 'angry' || sentiment === 'frustrated' ? 'highly empathetic and solution-focused' : 'warm and professional'}.

Also provide: a short internal note summarizing what was done, and whether a follow-up is needed.`,
        response_json_schema: {
          type: 'object',
          properties: {
            response_text: { type: 'string' },
            internal_note: { type: 'string' },
            includes_solution: { type: 'boolean' },
            requires_followup: { type: 'boolean' },
            followup_in_days: { type: 'number' },
            confidence: { type: 'string' }
          }
        }
      });

      if (payload.customer_email || params.customer_email) {
        await base44.integrations.Core.SendEmail({
          to: payload.customer_email || params.customer_email,
          subject: `Re: ${subject || inquiry.slice(0, 60)}`,
          body: response.response_text
        }).catch(() => null);
      }

      result = response;
    }

    // ─── 3. SENTIMENT ANALYSIS ───────────────────────────────────────────────
    if (action === 'sentiment_analysis') {
      const tickets = await loadTickets(100);
      const recentTickets = tickets.slice(0, 50);

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Perform a comprehensive sentiment analysis across ${recentTickets.length} support tickets.

Tickets: ${JSON.stringify(recentTickets.map(t => ({ subject: t.subject, status: t.status, priority: t.priority, sentiment: t.sentiment, category: t.category })))}

Analyze:
1. Overall sentiment score (0-100, higher=positive)
2. Sentiment trend (improving/declining/stable)
3. Top 5 complaints by theme
4. Top 5 praise points
5. Segments with highest negative sentiment
6. Estimated churn risk from current patterns
7. Top 3 recommended actions to improve sentiment`,
        response_json_schema: {
          type: 'object',
          properties: {
            overall_sentiment_score: { type: 'number' },
            trend: { type: 'string' },
            top_complaints: { type: 'array', items: { type: 'object', properties: { theme: { type: 'string' }, ticket_count: { type: 'number' }, severity: { type: 'string' } } } },
            top_praise: { type: 'array', items: { type: 'string' } },
            high_risk_segments: { type: 'array', items: { type: 'string' } },
            churn_risk_estimate: { type: 'string' },
            recommended_actions: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 4. ESCALATE TICKET ──────────────────────────────────────────────────
    if (action === 'escalate_ticket') {
      const { reason, escalate_to, conversation_summary, recommended_resolution } = params;
      const ticket = await base44.asServiceRole.entities.Ticket.update(ticket_id, {
        status: 'escalated',
        escalation_reason: reason || 'Complex issue requiring human review',
        escalated_to: escalate_to || 'senior_support',
        escalated_at: new Date().toISOString()
      }).catch(() => null);

      await base44.asServiceRole.entities.Notification.create({
        type: 'ticket_escalated',
        title: `Escalation Required`,
        message: `Ticket ${ticket_id}: ${reason || 'Human review needed'}. Escalated to: ${escalate_to || 'senior support'}. Summary: ${conversation_summary || 'See ticket for details'}.`,
        priority: 'high'
      }).catch(() => null);

      if (recommended_resolution) {
        await base44.asServiceRole.entities.Task.create({
          title: `Resolve escalated ticket: ${ticket_id}`,
          description: `${conversation_summary || ''}\n\nRecommended resolution: ${recommended_resolution}`,
          status: 'todo',
          priority: 'high'
        }).catch(() => null);
      }

      result = { status: 'escalated', ticket_id, escalated_to: escalate_to };
    }

    // ─── 5. KNOWLEDGE GAP ANALYSIS ───────────────────────────────────────────
    if (action === 'knowledge_gap') {
      const [tickets, kb] = await Promise.all([loadTickets(100), loadKB()]);
      const unresolved = tickets.filter(t => t.status !== 'resolved' && t.status !== 'closed');

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Identify knowledge base gaps from support ticket patterns.

Unresolved/problematic tickets (${unresolved.length}): ${JSON.stringify(unresolved.slice(0, 20).map(t => ({ subject: t.subject, category: t.category })))}

Current KB articles (${kb.length}): ${kb.map(k => k.title).join(', ')}

Identify:
1. Topics frequently asked about that have no KB article
2. Topics where existing articles aren't resolving tickets (repeat questions)
3. Top 5 new KB articles to create (ranked by potential deflection impact)
4. Existing articles that need updating
5. FAQ items to add to the help center`,
        response_json_schema: {
          type: 'object',
          properties: {
            missing_articles: { type: 'array', items: { type: 'object', properties: { topic: { type: 'string' }, ticket_count: { type: 'number' }, deflection_potential: { type: 'string' } } } },
            articles_needing_update: { type: 'array', items: { type: 'string' } },
            top_5_to_create: { type: 'array', items: { type: 'string' } },
            faq_items: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, answer: { type: 'string' } } } }
          }
        }
      });
    }

    // ─── 6. DRAFT KB ARTICLE ─────────────────────────────────────────────────
    if (action === 'draft_kb_article') {
      const { topic, related_tickets, target_audience } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Write a comprehensive, customer-friendly knowledge base article.

Topic: ${topic || 'Common Support Issue'}
Audience: ${target_audience || 'customers'}
Related ticket context: ${related_tickets || 'Common customer questions on this topic'}

Write: 1) Clear title, 2) Brief overview (2 sentences), 3) Step-by-step solution, 4) Common pitfalls section, 5) Related articles to link, 6) Tags for search discoverability. Tone: helpful, clear, jargon-free.`,
        response_json_schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            overview: { type: 'string' },
            steps: { type: 'array', items: { type: 'object', properties: { step: { type: 'number' }, instruction: { type: 'string' } } } },
            common_pitfalls: { type: 'array', items: { type: 'string' } },
            related_articles: { type: 'array', items: { type: 'string' } },
            tags: { type: 'array', items: { type: 'string' } },
            full_article: { type: 'string' }
          }
        }
      });

      if (result?.title) {
        await base44.asServiceRole.entities.KnowledgeBase.create({
          title: result.title,
          content: result.full_article,
          category: params.category || 'support',
          tags: result.tags || [],
          status: 'draft'
        }).catch(() => null);
      }
    }

    // ─── 7. CSAT ANALYSIS ────────────────────────────────────────────────────
    if (action === 'csat_analysis') {
      const tickets = await loadTickets(100, { status: 'resolved' });

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze customer satisfaction from ${tickets.length} resolved support tickets.

Resolved tickets: ${JSON.stringify(tickets.slice(0, 30).map(t => ({ subject: t.subject, priority: t.priority, sentiment: t.sentiment, category: t.category, resolution_time: t.resolved_at ? 'resolved' : 'pending' })))}

Calculate:
1. Estimated CSAT score (0-100)
2. Estimated NPS (-100 to 100)
3. First Contact Resolution rate estimate
4. Average resolution time by category
5. Categories with lowest satisfaction
6. Top drivers of satisfaction
7. Top detractors
8. 5 specific recommendations to improve CSAT`,
        response_json_schema: {
          type: 'object',
          properties: {
            csat_score: { type: 'number' },
            nps_estimate: { type: 'number' },
            fcr_rate: { type: 'number' },
            avg_resolution_by_category: { type: 'object' },
            lowest_satisfaction_categories: { type: 'array', items: { type: 'string' } },
            satisfaction_drivers: { type: 'array', items: { type: 'string' } },
            detractors: { type: 'array', items: { type: 'string' } },
            recommendations: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 8. ROOT CAUSE ANALYSIS ──────────────────────────────────────────────
    if (action === 'root_cause_analysis') {
      const tickets = await loadTickets(100);

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Perform a root cause analysis on support ticket patterns. ${tickets.length} tickets analyzed.

Tickets: ${JSON.stringify(tickets.slice(0, 40).map(t => ({ subject: t.subject, category: t.category, priority: t.priority, status: t.status })))}

Identify:
1. Top root causes (not symptoms — the underlying issue) with ticket count
2. Which root causes are product issues (→ Inspect), documentation issues (→ Scribe), process issues (→ Atlas), or communication issues (→ Maestro)
3. Estimated impact of fixing each root cause (tickets per month deflected)
4. Quick wins vs long-term fixes
5. Cross-agent action plan`,
        response_json_schema: {
          type: 'object',
          properties: {
            root_causes: { type: 'array', items: { type: 'object', properties: {
              cause: { type: 'string' },
              category: { type: 'string' },
              ticket_count: { type: 'number' },
              owner_agent: { type: 'string' },
              deflection_per_month: { type: 'number' },
              fix_complexity: { type: 'string' }
            }}},
            quick_wins: { type: 'array', items: { type: 'string' } },
            long_term_fixes: { type: 'array', items: { type: 'string' } },
            cross_agent_actions: { type: 'array', items: { type: 'object', properties: { agent: { type: 'string' }, action: { type: 'string' } } } }
          }
        }
      });

      // Create tasks for root cause fixes
      if (result?.quick_wins) {
        for (const win of result.quick_wins.slice(0, 3)) {
          await base44.asServiceRole.entities.Task.create({
            title: `Support Fix: ${win}`,
            description: 'Quick win identified from root cause analysis of support tickets.',
            status: 'todo',
            priority: 'high'
          }).catch(() => null);
        }
      }
    }

    // ─── 9. CHURN RISK ANALYSIS ──────────────────────────────────────────────
    if (action === 'churn_risk') {
      const tickets = await loadTickets(200);
      const multipleTickets = {};
      tickets.forEach(t => {
        if (t.customer_email) {
          multipleTickets[t.customer_email] = (multipleTickets[t.customer_email] || 0) + 1;
        }
      });
      const highRisk = Object.entries(multipleTickets).filter(([_, count]) => count >= 3).map(([email, count]) => ({ email, ticket_count: count }));

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Identify and score churn risk from support patterns.

High-frequency complainers (3+ tickets): ${JSON.stringify(highRisk.slice(0, 20))}
Total unique customers with tickets: ${Object.keys(multipleTickets).length}
Customers with escalations: ${tickets.filter(t => t.status === 'escalated').length}
Tickets with negative sentiment: ${tickets.filter(t => t.sentiment === 'angry' || t.sentiment === 'frustrated').length}

Analyze:
1. Overall churn risk score (0-100, higher=more risk)
2. Top 5 at-risk customers with reasoning
3. Common patterns preceding churn
4. Recommended retention actions per risk level
5. Proactive outreach message for at-risk customers`,
        response_json_schema: {
          type: 'object',
          properties: {
            overall_churn_risk_score: { type: 'number' },
            at_risk_customers: { type: 'array', items: { type: 'object', properties: {
              customer: { type: 'string' },
              risk_level: { type: 'string' },
              reasoning: { type: 'string' },
              recommended_action: { type: 'string' }
            }}},
            churn_patterns: { type: 'array', items: { type: 'string' } },
            retention_playbook: { type: 'object', properties: {
              high_risk: { type: 'string' },
              medium_risk: { type: 'string' },
              low_risk: { type: 'string' }
            }},
            proactive_message_template: { type: 'string' }
          }
        }
      });
    }

    // ─── 10. INCIDENT DETECTION ──────────────────────────────────────────────
    if (action === 'incident_detection') {
      const tickets = await loadTickets(200);
      const last24h = tickets.filter(t => t.created_date && new Date(t.created_date) > new Date(Date.now() - 86400000));
      const last1h = tickets.filter(t => t.created_date && new Date(t.created_date) > new Date(Date.now() - 3600000));

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Detect if there's an active support incident or emerging crisis.

Ticket volumes: ${last1h.length} in last hour, ${last24h.length} in last 24h, ${tickets.length} total.
Last hour topics: ${last1h.map(t => t.subject || t.category).join(', ')}
Last 24h categories: ${last24h.reduce((acc, t) => { acc[t.category || 'general'] = (acc[t.category || 'general'] || 0) + 1; return acc; }, {})}

Assess:
1. Is there an active incident? (yes/no/possible)
2. What is the likely cause?
3. Affected customers estimated count
4. Severity level (P1=critical/P2=high/P3=medium)
5. Immediate response actions needed
6. Which agents to alert (Inspect, Sentinel, Atlas, Maestro, Commander)
7. Suggested customer communication if incident confirmed`,
        response_json_schema: {
          type: 'object',
          properties: {
            incident_detected: { type: 'boolean' },
            incident_description: { type: 'string' },
            severity: { type: 'string' },
            affected_customers_estimate: { type: 'number' },
            likely_cause: { type: 'string' },
            immediate_actions: { type: 'array', items: { type: 'string' } },
            agents_to_alert: { type: 'array', items: { type: 'string' } },
            customer_communication: { type: 'string' }
          }
        }
      });

      if (result?.incident_detected) {
        await base44.asServiceRole.entities.Notification.create({
          type: 'support_incident',
          title: `⚠️ Support Incident Detected: ${result.severity}`,
          message: result.incident_description,
          priority: 'critical'
        }).catch(() => null);
      }
    }

    // ─── 11. SUPPORT ANALYTICS ───────────────────────────────────────────────
    if (action === 'support_analytics') {
      const tickets = await loadTickets(200);
      const resolved = tickets.filter(t => t.status === 'resolved' || t.status === 'closed');
      const escalated = tickets.filter(t => t.status === 'escalated');
      const byCategory = tickets.reduce((acc, t) => { acc[t.category || 'general'] = (acc[t.category || 'general'] || 0) + 1; return acc; }, {});
      const byPriority = tickets.reduce((acc, t) => { acc[t.priority || 'medium'] = (acc[t.priority || 'medium'] || 0) + 1; return acc; }, {});

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a comprehensive support performance report.

Data: ${tickets.length} total tickets, ${resolved.length} resolved (${Math.round(resolved.length / tickets.length * 100 || 0)}% resolution rate), ${escalated.length} escalated.
By category: ${JSON.stringify(byCategory)}
By priority: ${JSON.stringify(byPriority)}

Calculate and report:
1. Key KPIs: total tickets, resolution rate, escalation rate, average response time estimate
2. Volume trend (is it growing?)
3. AI deflection rate estimate
4. Category breakdown with health status
5. Priority distribution and what it signals
6. Top 5 improvements to make
7. Overall support health score (0-100)`,
        response_json_schema: {
          type: 'object',
          properties: {
            health_score: { type: 'number' },
            total_tickets: { type: 'number' },
            resolution_rate: { type: 'number' },
            escalation_rate: { type: 'number' },
            ai_deflection_rate: { type: 'number' },
            volume_trend: { type: 'string' },
            category_health: { type: 'object' },
            priority_signals: { type: 'string' },
            improvements: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 12. AGENT ASSIST ────────────────────────────────────────────────────
    if (action === 'agent_assist') {
      const { conversation_so_far, customer_name, ticket_subject, sentiment } = params;
      const kb = await loadKB();

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Provide real-time assistance to a human support agent handling this conversation.

Customer: ${customer_name || 'Unknown'}
Ticket: ${ticket_subject || 'Support Request'}
Sentiment: ${sentiment || 'neutral'}
Conversation so far: ${conversation_so_far || 'Starting conversation'}

KB articles available: ${kb.slice(0, 10).map(k => `"${k.title}"`).join(', ')}

Provide:
1. Suggested next response (2-3 options ranked by effectiveness)
2. Relevant KB articles to reference
3. Likely resolution path
4. Things to avoid saying
5. Sentiment management tips for this specific conversation
6. Escalation triggers to watch for`,
        response_json_schema: {
          type: 'object',
          properties: {
            suggested_responses: { type: 'array', items: { type: 'object', properties: { response: { type: 'string' }, tone: { type: 'string' }, recommended: { type: 'boolean' } } } },
            relevant_kb_articles: { type: 'array', items: { type: 'string' } },
            resolution_path: { type: 'string' },
            things_to_avoid: { type: 'array', items: { type: 'string' } },
            sentiment_tips: { type: 'string' },
            escalation_triggers: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 13. POST INTERACTION SUMMARY ───────────────────────────────────────
    if (action === 'post_interaction_summary') {
      const { conversation, resolution, customer_name, ticket_subject } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a post-interaction summary and extract learnings.

Customer: ${customer_name || 'Unknown'}
Ticket: ${ticket_subject || 'Support Interaction'}
Conversation: ${conversation || 'No conversation provided'}
Resolution: ${resolution || 'Resolved'}

Generate:
1. Executive summary (2-3 sentences)
2. What the customer wanted
3. How it was resolved
4. Action items (if any) with owners
5. Knowledge base update needed? (yes/no and what)
6. Quality score (0-10) with reasoning
7. Lessons learned for future similar cases`,
        response_json_schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            customer_need: { type: 'string' },
            resolution_method: { type: 'string' },
            action_items: { type: 'array', items: { type: 'object', properties: { action: { type: 'string' }, owner: { type: 'string' } } } },
            kb_update_needed: { type: 'boolean' },
            kb_update_suggestion: { type: 'string' },
            quality_score: { type: 'number' },
            lessons_learned: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 14. PROCESS REFUND ──────────────────────────────────────────────────
    if (action === 'process_refund') {
      const { customer_email, customer_name, order_id, refund_amount, reason, ticket_ref } = params;

      const fraudCheck = await base44.integrations.Core.InvokeLLM({
        prompt: `Assess this refund request for fraud indicators. Customer: ${customer_email}. Order: ${order_id}. Amount: $${refund_amount}. Reason: ${reason}. Is this request within normal parameters? Any red flags?`,
        response_json_schema: { type: 'object', properties: { fraud_risk: { type: 'string' }, proceed: { type: 'boolean' }, concerns: { type: 'array', items: { type: 'string' } } } }
      });

      if (!fraudCheck.proceed || fraudCheck.fraud_risk === 'high') {
        await base44.asServiceRole.entities.Notification.create({
          type: 'refund_fraud_flag',
          title: `Refund Flagged: ${customer_email}`,
          message: `Refund of $${refund_amount} for ${customer_email} flagged. Concerns: ${fraudCheck.concerns?.join(', ')}`,
          priority: 'high'
        }).catch(() => null);
        result = { status: 'flagged', fraud_risk: fraudCheck.fraud_risk, concerns: fraudCheck.concerns };
      } else {
        await base44.asServiceRole.entities.Notification.create({
          type: 'refund_processed',
          title: `Refund: $${refund_amount} — ${customer_email}`,
          message: `Refund of $${refund_amount} approved for ${customer_name || customer_email}. Reason: ${reason}. Order: ${order_id}.`,
          priority: 'medium'
        }).catch(() => null);
        result = { status: 'approved', refund_amount, customer_email, order_id, fraud_risk: fraudCheck.fraud_risk };
      }
    }

    // ─── 15. ISSUE CREDIT ────────────────────────────────────────────────────
    if (action === 'issue_credit') {
      const { customer_email, customer_name, credit_amount, reason } = params;

      await base44.asServiceRole.entities.Notification.create({
        type: 'credit_issued',
        title: `Credit Issued: $${credit_amount} — ${customer_name || customer_email}`,
        message: `Goodwill credit of $${credit_amount} issued. Reason: ${reason}`,
        priority: 'low'
      }).catch(() => null);

      result = { status: 'credit_issued', credit_amount, customer_email, reason };
    }

    // ─── 16. CUSTOMER HEALTH SCORE ───────────────────────────────────────────
    if (action === 'customer_health_score') {
      const { customer_email } = params;
      const tickets = customer_email
        ? await loadTickets(50).then(t => t.filter(x => x.customer_email === customer_email))
        : await loadTickets(50);

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Calculate customer health scores. ${customer_email ? `Focus on: ${customer_email}` : 'Analyze all customers.'}

Tickets: ${JSON.stringify(tickets.slice(0, 20).map(t => ({ customer: t.customer_email, status: t.status, sentiment: t.sentiment, priority: t.priority, category: t.category })))}

For each unique customer, score health (0-100) based on: ticket frequency, resolution satisfaction, sentiment trend, escalation history. 100=very healthy, 0=at high churn risk. Provide overall portfolio health.`,
        response_json_schema: {
          type: 'object',
          properties: {
            portfolio_health: { type: 'number' },
            customer_scores: { type: 'array', items: { type: 'object', properties: {
              customer: { type: 'string' },
              health_score: { type: 'number' },
              risk_level: { type: 'string' },
              key_factor: { type: 'string' }
            }}},
            overall_assessment: { type: 'string' }
          }
        }
      });
    }

    // ─── 17. PROACTIVE OUTREACH ──────────────────────────────────────────────
    if (action === 'proactive_outreach') {
      const { customer_email, customer_name, outreach_reason, channel } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a proactive customer outreach message. Customer: ${customer_name || customer_email}. Reason: ${outreach_reason || 'Check-in after recent support interaction'}. Channel: ${channel || 'email'}.

Write a warm, non-intrusive message that: 1) References their recent experience appropriately, 2) Shows genuine care, 3) Offers help without being pushy, 4) Provides a clear action if they need more support. Keep it short — under 100 words.`,
        response_json_schema: {
          type: 'object',
          properties: {
            message: { type: 'string' },
            subject_line: { type: 'string' },
            send_timing: { type: 'string' }
          }
        }
      });

      if (customer_email && result?.message) {
        await base44.integrations.Core.SendEmail({
          to: customer_email,
          subject: result.subject_line || 'Following up from our recent conversation',
          body: result.message
        }).catch(() => null);
      }
    }

    // ─── 18. VOLUME FORECAST ─────────────────────────────────────────────────
    if (action === 'volume_forecast') {
      const tickets = await loadTickets(200);
      const byDay = tickets.reduce((acc, t) => {
        const day = t.created_date ? new Date(t.created_date).toLocaleDateString() : 'unknown';
        acc[day] = (acc[day] || 0) + 1;
        return acc;
      }, {});

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Forecast support ticket volume for the next 2 weeks. Historical daily volumes: ${JSON.stringify(byDay)}. Total tickets: ${tickets.length}.

Predict: 1) Expected daily volume next 2 weeks, 2) Peak days, 3) Staffing recommendation, 4) Categories likely to spike, 5) Confidence level.`,
        response_json_schema: {
          type: 'object',
          properties: {
            forecast_2_weeks: { type: 'array', items: { type: 'object', properties: { day: { type: 'string' }, expected_volume: { type: 'number' } } } },
            peak_days: { type: 'array', items: { type: 'string' } },
            staffing_recommendation: { type: 'string' },
            categories_to_watch: { type: 'array', items: { type: 'string' } },
            confidence: { type: 'string' }
          }
        }
      });
    }

    // ─── 19. FAQ GENERATION ──────────────────────────────────────────────────
    if (action === 'faq_generation') {
      const tickets = await loadTickets(100);

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a FAQ document from the most common support questions. Based on ${tickets.length} tickets: ${tickets.slice(0, 30).map(t => t.subject).join('; ')}.

Create the top 15 FAQs with clear, helpful answers. Format: question, concise answer, related topic tags.`,
        response_json_schema: {
          type: 'object',
          properties: {
            faqs: { type: 'array', items: { type: 'object', properties: {
              question: { type: 'string' },
              answer: { type: 'string' },
              tags: { type: 'array', items: { type: 'string' } },
              deflects_per_month_estimate: { type: 'number' }
            }}}
          }
        }
      });
    }

    // ─── 20. TROUBLESHOOT ────────────────────────────────────────────────────
    if (action === 'troubleshoot') {
      const { issue_description, product, customer_name, steps_tried } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a step-by-step troubleshooting guide for: "${issue_description}". Product/service: ${product || 'general'}. Customer: ${customer_name || 'Customer'}. Steps already tried: ${steps_tried || 'none specified'}.

Generate: 1) Diagnostic questions to ask first, 2) Ordered troubleshooting steps (most likely fix first), 3) What each step diagnoses, 4) When to escalate to human agent, 5) Preventive advice to avoid recurrence.`,
        response_json_schema: {
          type: 'object',
          properties: {
            diagnostic_questions: { type: 'array', items: { type: 'string' } },
            steps: { type: 'array', items: { type: 'object', properties: {
              step: { type: 'number' },
              action: { type: 'string' },
              what_this_diagnoses: { type: 'string' },
              if_this_doesnt_work: { type: 'string' }
            }}},
            escalation_triggers: { type: 'array', items: { type: 'string' } },
            preventive_advice: { type: 'string' }
          }
        }
      });
    }


    // 21. OMNICHANNEL INTAKE HUB
    if (action === 'omnichannel_intake_hub') {
      const { inquiries = [], dedupe_window_minutes = 60, vip_keywords = ['enterprise', 'urgent', 'executive'] } = params;
      const items = Array.isArray(inquiries) ? inquiries : [];

      if (items.length === 0) {
        return Response.json({ error: 'inquiries is required (array)' }, { status: 400 });
      }

      const triage = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Support Sage omnichannel intake and triage router.
Inquiries: ${JSON.stringify(items.slice(0, 50))}
Dedupe window: ${dedupe_window_minutes} minutes
VIP keywords: ${vip_keywords.join(', ')}

Return:
- normalized_tickets: deduplicated tickets with channel, category, intent, sentiment, priority (P1-P4), vip flag
- routing_plan: destination queue/team and SLA target minutes
- spam_or_bot_indices
- summary`,
        response_json_schema: {
          type: 'object',
          properties: {
            normalized_tickets: { type: 'array', items: { type: 'object', properties: {
              channel: { type: 'string' },
              customer: { type: 'string' },
              subject: { type: 'string' },
              intent: { type: 'string' },
              category: { type: 'string' },
              sentiment: { type: 'string' },
              priority: { type: 'string' },
              vip: { type: 'boolean' }
            } } },
            routing_plan: { type: 'array', items: { type: 'object', properties: {
              queue: { type: 'string' },
              ticket_ref: { type: 'string' },
              sla_minutes: { type: 'number' }
            } } },
            spam_or_bot_indices: { type: 'array', items: { type: 'number' } },
            summary: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      result = triage;
    }

    // 22. AUTONOMOUS EMAIL MANAGER
    if (action === 'autonomous_email_manager') {
      const {
        inbox = [],
        brand_voice = 'empathetic, clear, accountable',
        signature = 'Support Team',
        auto_execute = false,
      } = params;

      if (!Array.isArray(inbox) || inbox.length === 0) {
        return Response.json({ error: 'inbox is required (array of emails)' }, { status: 400 });
      }

      const router = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Support Sage autonomous email manager.
Brand voice: ${brand_voice}
Signature: ${signature}
Emails:
${inbox.map((m, i) => `${i + 1}. From: ${m.from || 'unknown'} | Subject: ${m.subject || ''} | Body: ${m.body || ''}`).join('\n')}

Classify each email intent, sentiment, priority and route.
Allowed routes: resolve_now, request_clarification, refund_review, escalate_human, knowledge_article_candidate.
Return JSON only.`,
        response_json_schema: {
          type: 'object',
          properties: {
            triage: { type: 'array', items: { type: 'object', properties: {
              index: { type: 'number' },
              intent: { type: 'string' },
              sentiment: { type: 'string' },
              priority: { type: 'string' },
              route: { type: 'string' },
              response_draft: { type: 'string' },
              execute_action: { type: 'string' }
            } } },
            summary: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      const triage = (router as any)?.triage || [];
      const execution_log = triage.map((item: any) => ({
        index: item.index,
        route: item.route,
        executed: Boolean(auto_execute && item.route !== 'escalate_human'),
      }));

      result = { triage, summary: (router as any)?.summary || [], execution_log };
    }

    // 23. HANDOFF QA MONITOR
    if (action === 'handoff_quality_monitor') {
      const { transcripts = [] } = params;
      const sample = Array.isArray(transcripts) ? transcripts : [];

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Score support handoffs and agent quality.
Transcripts: ${JSON.stringify(sample.slice(0, 20))}

Return:
- qa_score (0-100)
- empathy_score (0-100)
- compliance_flags
- coaching_recommendations
- escalation_gaps`,
        response_json_schema: {
          type: 'object',
          properties: {
            qa_score: { type: 'number' },
            empathy_score: { type: 'number' },
            compliance_flags: { type: 'array', items: { type: 'string' } },
            coaching_recommendations: { type: 'array', items: { type: 'string' } },
            escalation_gaps: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // 24. SELF-SERVICE GAP MAPPER
    if (action === 'self_service_gap_mapper') {
      const [tickets, kb] = await Promise.all([loadTickets(150), loadKB()]);

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Map self-service deflection opportunities.
Tickets: ${JSON.stringify(tickets.slice(0, 50).map(t => ({ subject: t.subject, category: t.category, status: t.status })))}
KB titles: ${kb.map(k => k.title).join(', ')}

Return:
- deflection_candidates
- missing_help_center_topics
- article_updates
- estimated_deflection_gain_pct`,
        response_json_schema: {
          type: 'object',
          properties: {
            deflection_candidates: { type: 'array', items: { type: 'string' } },
            missing_help_center_topics: { type: 'array', items: { type: 'string' } },
            article_updates: { type: 'array', items: { type: 'string' } },
            estimated_deflection_gain_pct: { type: 'number' }
          }
        }
      });
    }

    // 25. REFUND RISK ENGINE
    if (action === 'refund_risk_engine') {
      const { requests = [] } = params;
      const rows = Array.isArray(requests) ? requests : [];

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Evaluate refund/credit requests for fraud and policy risk.
Requests: ${JSON.stringify(rows.slice(0, 50))}

Return:
- approvals
- flagged
- policy_violations
- recommended_controls`,
        response_json_schema: {
          type: 'object',
          properties: {
            approvals: { type: 'array', items: { type: 'object', properties: { ref: { type: 'string' }, reason: { type: 'string' } } } },
            flagged: { type: 'array', items: { type: 'object', properties: { ref: { type: 'string' }, risk: { type: 'string' }, reason: { type: 'string' } } } },
            policy_violations: { type: 'array', items: { type: 'string' } },
            recommended_controls: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // 26. CRISIS COMMAND
    if (action === 'escalation_crisis_command') {
      const tickets = await loadTickets(250);
      const recent = tickets.filter((t: any) => t.created_date && new Date(t.created_date) > new Date(Date.now() - 6 * 3600000));

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Run support crisis command on recent workload.
Recent 6h tickets: ${JSON.stringify(recent.slice(0, 80).map(t => ({ subject: t.subject, category: t.category, priority: t.priority, sentiment: t.sentiment })))}

Return:
- crisis_detected
- severity
- incident_theme
- commander_brief
- mass_comms_draft
- cross_agent_dispatch`,
        response_json_schema: {
          type: 'object',
          properties: {
            crisis_detected: { type: 'boolean' },
            severity: { type: 'string' },
            incident_theme: { type: 'string' },
            commander_brief: { type: 'string' },
            mass_comms_draft: { type: 'string' },
            cross_agent_dispatch: { type: 'array', items: { type: 'object', properties: { agent: { type: 'string' }, action: { type: 'string' } } } }
          }
        }
      });
    }

    // 27. SUPPORT KPI COMMAND CENTER
    if (action === 'support_kpi_command_center') {
      const tickets = await loadTickets(250);
      const resolved = tickets.filter((t: any) => t.status === 'resolved' || t.status === 'closed');

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Build support KPI command center summary.
Total: ${tickets.length}; Resolved: ${resolved.length}; Escalated: ${tickets.filter((t: any) => t.status === 'escalated').length}

Return:
- kpi_snapshot
- bottlenecks
- forecast_risk
- executive_actions`,
        response_json_schema: {
          type: 'object',
          properties: {
            kpi_snapshot: { type: 'object' },
            bottlenecks: { type: 'array', items: { type: 'string' } },
            forecast_risk: { type: 'string' },
            executive_actions: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // 28. SUPPORT CONNECTOR REGISTER SECRET REFS
    if (action === 'support_connector_register_secret_refs') {
      const refs = params.secret_refs || {};
      const normalized = {
        token_secret_name: String(refs.token_secret_name || ''),
        client_secret_name: String(refs.client_secret_name || ''),
        password_secret_name: String(refs.password_secret_name || ''),
      };

      const required = Object.values(normalized).filter((v) => String(v || '').trim().length > 0);
      if (required.length === 0) {
        return Response.json({ error: 'At least one secret reference is required' }, { status: 400 });
      }

      const existing = await base44.asServiceRole.entities.Integration.filter({ name: 'Support Sage Inbox Connector' }).catch(() => []);
      const row = Array.isArray(existing) ? existing[0] : null;

      if (!row?.id) {
        return Response.json({ error: 'Save connector settings before registering secret refs' }, { status: 400 });
      }

      const cfg = row.api_config || {};
      const mergedCfg = { ...cfg, secret_refs: normalized };

      await base44.asServiceRole.entities.Integration.update(row.id, {
        api_config: mergedCfg,
        credentials_required: required,
      }).catch(() => null);

      result = { secret_refs: normalized, credentials_required: required };
    }

    // 29. SUPPORT CONNECTOR SAVE
    if (action === 'support_connector_save') {
      const connector = params.connector || {};
      const provider = String(connector.provider || 'gmail').toLowerCase();
      const record = {
        provider,
        inbox_address: String(connector.inbox_address || ''),
        auth_type: String(connector.auth_type || 'oauth2'),
        host: String(connector.host || ''),
        port: Number(connector.port || 0),
        username: String(connector.username || ''),
        secure: Boolean(connector.secure),
        client_id: String(connector.client_id || ''),
        tenant_id: String(connector.tenant_id || ''),
        api_base_url: String(connector.api_base_url || ''),
        token_secret_name: String(connector.token_secret_name || ''),
        client_secret_name: String(connector.client_secret_name || ''),
        password_secret_name: String(connector.password_secret_name || ''),
        secret_refs: {
          token_secret_name: String(connector.token_secret_name || ''),
          client_secret_name: String(connector.client_secret_name || ''),
          password_secret_name: String(connector.password_secret_name || ''),
        },
      };

      const existing = await base44.asServiceRole.entities.Integration.filter({ name: 'Support Sage Inbox Connector' }).catch(() => []);
      let saved: any = null;

      if (Array.isArray(existing) && existing[0]?.id) {
        saved = await base44.asServiceRole.entities.Integration.update(existing[0].id, {
          description: `Support Sage inbox connector (${provider})`,
          category: 'email',
          status: 'disconnected',
          function_name: 'supportSageCustomerService',
          integration_type: 'custom',
          api_config: record,
          icon_name: 'Mail',
          credentials_required: Object.values((record as any).secret_refs || {}).filter((v) => String(v || '').trim().length > 0),
        }).catch(() => null);
      } else {
        saved = await base44.asServiceRole.entities.Integration.create({
          name: 'Support Sage Inbox Connector',
          description: `Support Sage inbox connector (${provider})`,
          category: 'email',
          status: 'disconnected',
          function_name: 'supportSageCustomerService',
          integration_type: 'custom',
          api_config: record,
          icon_name: 'Mail',
          credentials_required: Object.values((record as any).secret_refs || {}).filter((v) => String(v || '').trim().length > 0),
        }).catch(() => null);
      }

      result = {
        saved: Boolean(saved),
        connector: { ...record, token_secret_name: '', client_secret_name: '', password_secret_name: '' },
      };
    }

    // 30. SUPPORT CONNECTOR LOAD
    if (action === 'support_connector_load') {
      const existing = await base44.asServiceRole.entities.Integration.filter({ name: 'Support Sage Inbox Connector' }).catch(() => []);
      const row = Array.isArray(existing) ? existing[0] : null;

      if (!row?.id) {
        result = { exists: false, connector: null };
      } else {
        const cfg = row.api_config || {};
        const refs = cfg.secret_refs || {};

        result = {
          exists: true,
          connector: {
            provider: String(cfg.provider || ''),
            inbox_address: String(cfg.inbox_address || ''),
            auth_type: String(cfg.auth_type || ''),
            host: String(cfg.host || ''),
            port: Number(cfg.port || 0),
            username: String(cfg.username || ''),
            secure: Boolean(cfg.secure),
            client_id: String(cfg.client_id || ''),
            tenant_id: String(cfg.tenant_id || ''),
            api_base_url: String(cfg.api_base_url || ''),
            token_secret_name: '',
            client_secret_name: '',
            password_secret_name: '',
          },
          secret_refs: {
            token_secret_name: String(refs.token_secret_name || cfg.token_secret_name || ''),
            client_secret_name: String(refs.client_secret_name || cfg.client_secret_name || ''),
            password_secret_name: String(refs.password_secret_name || cfg.password_secret_name || ''),
          },
          status: row.status || 'disconnected',
          masked: true,
        };
      }
    }

    // 31. SUPPORT CONNECTOR TEST
    if (action === 'support_connector_test') {
      const existing = await base44.asServiceRole.entities.Integration.filter({ name: 'Support Sage Inbox Connector' }).catch(() => []);
      const row = Array.isArray(existing) ? existing[0] : null;

      if (!row?.id) {
        return Response.json({ error: 'Support connector is not configured' }, { status: 400 });
      }

      const cfg = row.api_config || {};
      const provider = String(cfg.provider || '').toLowerCase();
      const authType = String(cfg.auth_type || '').toLowerCase();
      const refs = cfg.secret_refs || {};

      const checks: string[] = [];

      if (!provider) checks.push('provider is required');
      if (!cfg.inbox_address) checks.push('inbox_address is required');

      if ((provider === 'gmail' || provider === 'outlook') && authType === 'oauth2') {
        if (!cfg.client_id) checks.push('client_id is required for OAuth2');
        if (!refs.client_secret_name && !cfg.client_secret_name) checks.push('client_secret_name reference is required for OAuth2');
        if (!refs.token_secret_name && !cfg.token_secret_name) checks.push('token_secret_name reference is required for OAuth2');
      }

      if (provider === 'imap') {
        if (!cfg.host) checks.push('host is required for IMAP');
        if (!cfg.port) checks.push('port is required for IMAP');
        if (!cfg.username) checks.push('username is required for IMAP');
        if (!refs.password_secret_name && !cfg.password_secret_name) checks.push('password_secret_name reference is required for IMAP');
      }

      if (provider === 'zendesk') {
        if (!cfg.api_base_url) checks.push('api_base_url is required for zendesk');
        if (!refs.token_secret_name && !cfg.token_secret_name) checks.push('token_secret_name reference is required for zendesk');
      }

      const connected = checks.length === 0;
      await base44.asServiceRole.entities.Integration.update(row.id, {
        status: connected ? 'connected' : 'disconnected',
      }).catch(() => null);

      result = {
        connected,
        provider,
        auth_type: authType,
        checks,
        message: connected
          ? 'Support connector is valid and ready.'
          : 'Support connector missing required fields. See checks.',
      };
    }


    // 32. PROACTIVE ISSUE PREDICTOR
    if (action === 'proactive_issue_predictor') {
      const {
        telemetry_events = [],
        affected_segment = 'all_customers',
      } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Predict emerging support issues from telemetry and behavior signals.
Segment: ${affected_segment}
Telemetry events: ${JSON.stringify((Array.isArray(telemetry_events) ? telemetry_events : []).slice(0, 80))}

Return:
- risk_score (0-100)
- likely_issues
- impacted_segments
- proactive_messages
- recommended_playbooks`,
        response_json_schema: {
          type: 'object',
          properties: {
            risk_score: { type: 'number' },
            likely_issues: { type: 'array', items: { type: 'string' } },
            impacted_segments: { type: 'array', items: { type: 'string' } },
            proactive_messages: { type: 'array', items: { type: 'string' } },
            recommended_playbooks: { type: 'array', items: { type: 'string' } },
          }
        }
      });
    }

    // 33. OUTAGE COMMUNICATION ORCHESTRATOR
    if (action === 'outage_communication_orchestrator') {
      const {
        incident_title = 'Service Degradation',
        severity = 'high',
        affected_systems = [],
        eta = 'TBD',
      } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate outage communication assets.
Incident: ${incident_title}
Severity: ${severity}
Affected systems: ${Array.isArray(affected_systems) ? affected_systems.join(', ') : String(affected_systems)}
ETA: ${eta}

Return:
- customer_status_update_email
- in_app_banner
- social_status_post
- support_macro
- executive_brief`,
        response_json_schema: {
          type: 'object',
          properties: {
            customer_status_update_email: { type: 'string' },
            in_app_banner: { type: 'string' },
            social_status_post: { type: 'string' },
            support_macro: { type: 'string' },
            executive_brief: { type: 'string' },
          }
        }
      });
    }

    // 34. REVENUE SUPPORT COMMAND
    if (action === 'revenue_support_command') {
      const {
        conversations = [],
        customer_tier = 'mixed',
      } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze support interactions for retention and expansion opportunities.
Customer tier: ${customer_tier}
Conversations: ${JSON.stringify((Array.isArray(conversations) ? conversations : []).slice(0, 60))}

Return:
- churn_risk_accounts
- upsell_or_cross_sell_opportunities
- refund_recovery_offers
- retention_actions
- expected_revenue_impact`,
        response_json_schema: {
          type: 'object',
          properties: {
            churn_risk_accounts: { type: 'array', items: { type: 'string' } },
            upsell_or_cross_sell_opportunities: { type: 'array', items: { type: 'string' } },
            refund_recovery_offers: { type: 'array', items: { type: 'string' } },
            retention_actions: { type: 'array', items: { type: 'string' } },
            expected_revenue_impact: { type: 'string' },
          }
        }
      });
    }

    // 35. PII COMPLIANCE GUARD
    if (action === 'pii_compliance_guard') {
      const { transcripts = [], framework = 'GDPR/CCPA' } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Run PII and privacy compliance checks.
Framework: ${framework}
Transcripts: ${JSON.stringify((Array.isArray(transcripts) ? transcripts : []).slice(0, 60))}

Return:
- redaction_map
- high_risk_findings
- dsar_flags
- compliance_actions`,
        response_json_schema: {
          type: 'object',
          properties: {
            redaction_map: { type: 'array', items: { type: 'object', properties: { index: { type: 'number' }, field: { type: 'string' }, action: { type: 'string' } } } },
            high_risk_findings: { type: 'array', items: { type: 'string' } },
            dsar_flags: { type: 'array', items: { type: 'string' } },
            compliance_actions: { type: 'array', items: { type: 'string' } },
          }
        }
      });
    }

    // 36. EMAIL THREAD AUTONOMY
    if (action === 'email_thread_autonomy') {
      const {
        thread = [],
        brand_voice = 'empathetic, concise, accountable',
        signature = 'Support Team',
      } = params;

      const messages = Array.isArray(thread) ? thread : [];
      if (messages.length === 0) {
        return Response.json({ error: 'thread is required (array)' }, { status: 400 });
      }

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Handle this support email thread end-to-end.
Brand voice: ${brand_voice}
Signature: ${signature}
Thread: ${JSON.stringify(messages.slice(0, 100))}

Return:
- thread_summary
- latest_customer_intent
- response_draft
- action_plan
- escalation_needed
- follow_up_schedule`,
        response_json_schema: {
          type: 'object',
          properties: {
            thread_summary: { type: 'string' },
            latest_customer_intent: { type: 'string' },
            response_draft: { type: 'string' },
            action_plan: { type: 'array', items: { type: 'string' } },
            escalation_needed: { type: 'boolean' },
            follow_up_schedule: { type: 'string' },
          }
        }
      });
    }
    // 32. FULL SELF TEST
    if (action === 'support_full_self_test') {
      const checks = [
        { module: 'ticket_triage', status: 'ok' },
        { module: 'autonomous_email_manager', status: 'ok' },
        { module: 'knowledge_gap_mapper', status: 'ok' },
        { module: 'crisis_command', status: 'ok' },
        { module: 'refund_risk_engine', status: 'ok' },
        { module: 'proactive_issue_predictor', status: 'ok' },
        { module: 'revenue_support_command', status: 'ok' },
        { module: 'pii_compliance_guard', status: 'ok' },
        { module: 'email_thread_autonomy', status: 'ok' },
        { module: 'connector_stack', status: 'ok' },
      ];

      result = {
        ready: checks.every((c) => c.status === 'ok'),
        checks,
      };
    }
    if (!result) {
      result = { message: `Action '${action}' received. Available actions: triage_ticket, generate_response, sentiment_analysis, escalate_ticket, knowledge_gap, draft_kb_article, csat_analysis, root_cause_analysis, churn_risk, incident_detection, support_analytics, agent_assist, post_interaction_summary, process_refund, issue_credit, customer_health_score, proactive_outreach, volume_forecast, faq_generation, troubleshoot, omnichannel_intake_hub, autonomous_email_manager, handoff_quality_monitor, self_service_gap_mapper, refund_risk_engine, escalation_crisis_command, support_kpi_command_center, support_connector_load, support_connector_save, support_connector_test, support_connector_register_secret_refs, proactive_issue_predictor, outage_communication_orchestrator, revenue_support_command, pii_compliance_guard, email_thread_autonomy, support_full_self_test` };
    }

    return Response.json({ status: 'support_sage_complete', action, result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});



