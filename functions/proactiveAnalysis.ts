import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Proactive Analysis — pulls real-time data, detects anomalies, generates insights with context-aware reasoning

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    const [emails, invoices, clients, socialPosts, trends, financials, workflows, activities] = await Promise.all([
      base44.asServiceRole.entities.Email.filter({ status: 'unread' }, '-created_date', 20),
      base44.asServiceRole.entities.Invoice.list('-created_date', 30),
      base44.asServiceRole.entities.Client.list('-updated_date', 30),
      base44.asServiceRole.entities.SocialPost.list('-created_date', 30),
      base44.asServiceRole.entities.Trend.list('-trend_score', 10),
      base44.asServiceRole.entities.FinancialSnapshot.list('-date', 3),
      base44.asServiceRole.entities.Workflow.filter({ status: 'active' }),
      base44.asServiceRole.entities.Activity.list('-created_date', 20),
    ]);

    const overdueInvoices = invoices.filter(inv =>
      (inv.status === 'sent' || inv.status === 'overdue') && inv.due_date && new Date(inv.due_date) < new Date()
    );
    const totalOverdue = overdueInvoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const dormantClients = clients.filter(c => c.status === 'active' && c.last_contact && new Date(c.last_contact) < thirtyDaysAgo);

    const latestFinancial = financials[0];
    const urgentEmails = emails.filter(e => e.priority === 'urgent' || e.priority === 'high');
    const upcomingPosts = socialPosts.filter(p => {
      if (p.status !== 'scheduled') return false;
      const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      return p.scheduled_time && new Date(p.scheduled_time) < nextWeek;
    });

    const contextSummary = await base44.asServiceRole.integrations.Core.InvokeLLM({
      prompt: `You are an AI business analyst. Analyse this business data and generate 3-5 high-value, specific, actionable insights.

Data snapshot:
- Unread emails: ${emails.length} (${urgentEmails.length} urgent)
- Overdue invoices: ${overdueInvoices.length} totaling $${totalOverdue.toLocaleString()}
- Dormant active clients: ${dormantClients.length} not contacted in 30+ days
- Upcoming scheduled posts: ${upcomingPosts.length} in next 7 days
- Financial health score: ${latestFinancial?.health_score || 'unknown'}%
- Cash runway: ${latestFinancial?.runway_days || 'unknown'} days
- Active workflows: ${workflows.length}
- Recent activity failures: ${activities.filter(a => a.status === 'failed').length}
- Rising trends: ${trends.filter(t => t.status === 'rising' || t.status === 'hot').slice(0,3).map(t => t.title).join(', ')}

Generate 3-5 specific insights with concrete metrics and clear actions.`,
      response_json_schema: {
        type: 'object',
        properties: {
          insights: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                title: { type: 'string' },
                description: { type: 'string' },
                category: { type: 'string' },
                priority: { type: 'string' },
                action_label: { type: 'string' },
                metric_value: { type: 'string' }
              }
            }
          }
        }
      }
    });

    const insightsToCreate = contextSummary.insights || [];
    for (const insight of insightsToCreate) {
      await base44.asServiceRole.entities.Insight.create({
        ...insight,
        module: 'analytics',
        status: 'new'
      });
    }

    await base44.asServiceRole.entities.Activity.create({
      title: 'Proactive Analysis Complete',
      description: `Generated ${insightsToCreate.length} AI insights from live business data analysis.`,
      type: 'ai_action',
      status: 'completed',
      module: 'analytics'
    });

    return Response.json({
      success: true,
      insights_generated: insightsToCreate.length,
      data_points_analysed: {
        emails: emails.length,
        invoices: invoices.length,
        clients: clients.length,
        overdue: overdueInvoices.length,
        dormant_clients: dormantClients.length,
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});