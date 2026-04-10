import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    const today = new Date().toISOString().split('T')[0];
    
    // Check if briefing already exists for today
    const existing = await base44.asServiceRole.entities.Briefing.filter({ date: today });
    
    if (existing.length > 0) {
      return Response.json({ 
        success: true,
        message: 'Briefing already generated for today',
        briefing: existing[0]
      });
    }
    
    // Gather data from last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    
    const recentInsights = await base44.asServiceRole.entities.Insight.filter({ 
      status: 'new'
    }, '-created_date', 10);
    
    const financialSnapshot = await base44.asServiceRole.entities.FinancialSnapshot.list('-date', 1);
    const latestFinances = financialSnapshot[0] || null;
    
    const overdueInvoices = await base44.asServiceRole.entities.Invoice.filter({ status: 'sent' });
    const actualOverdue = overdueInvoices.filter(inv => new Date(inv.due_date) < new Date());
    
    const unreadEmails = await base44.asServiceRole.entities.Email.filter({ status: 'unread' });
    const urgentEngagements = await base44.asServiceRole.entities.Engagement.filter({ 
      requires_attention: true 
    });
    
    // Use AI to generate briefing
    const briefingData = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate a concise daily business briefing for today (${today}).

Context:
- ${recentInsights.length} new insights detected
- ${actualOverdue.length} overdue invoices totaling $${actualOverdue.reduce((sum, i) => sum + i.amount, 0)}
- ${unreadEmails.length} unread emails
- ${urgentEngagements.length} urgent social engagements
- Financial health score: ${latestFinances?.health_score || 'N/A'}%
- Cash balance: $${latestFinances?.cash_balance || 0}
- Runway: ${latestFinances?.runway_days || 'N/A'} days

Create a brief, actionable daily briefing with:
1. Priority alerts (2-3 items requiring immediate attention)
2. Key metrics summary
3. Top 3 opportunities
4. Top 2 risks
5. Suggested focus for today (one sentence)

Be specific, use actual numbers, and prioritize by business impact.`,
      response_json_schema: {
        type: "object",
        properties: {
          priority_alerts: {
            type: "array",
            items: {
              type: "object",
              properties: {
                title: { type: "string" },
                message: { type: "string" },
                action: { type: "string" }
              }
            }
          },
          opportunities: {
            type: "array",
            items: { type: "string" }
          },
          risks: {
            type: "array",
            items: { type: "string" }
          },
          suggested_focus: { type: "string" }
        }
      }
    });
    
    // Create briefing entity
    const briefing = await base44.asServiceRole.entities.Briefing.create({
      date: today,
      type: 'daily',
      priority_alerts: briefingData.priority_alerts,
      key_metrics: {
        revenue: latestFinances?.revenue || 0,
        expenses: latestFinances?.expenses || 0,
        profit: latestFinances?.profit || 0,
        cash_flow: latestFinances?.cash_balance ? 'positive' : 'neutral'
      },
      opportunities: briefingData.opportunities,
      risks: briefingData.risks,
      suggested_focus: briefingData.suggested_focus,
      status: 'unread'
    });
    
    // Create notification
    await base44.asServiceRole.entities.Notification.create({
      title: 'Daily Briefing Ready',
      message: briefingData.suggested_focus,
      type: 'ai_insight',
      category: 'system',
      priority: 'normal',
      action_url: '/Briefing'
    });
    
    await base44.asServiceRole.entities.Activity.create({
      title: 'Daily Briefing Generated',
      description: `Briefing for ${today} ready with ${briefingData.priority_alerts?.length || 0} alerts`,
      type: 'ai_action',
      status: 'completed',
      module: 'analytics'
    });
    
    return Response.json({ 
      success: true,
      briefing,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});