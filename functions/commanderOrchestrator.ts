import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { action, user_request, industry, context } = payload;

    // action: 'route_request', 'cross_agent_synthesis', 'maintain_memory', 'strategic_briefing'

    let result = null;

    if (action === 'route_request') {
      // Parse natural language request and route to appropriate agent(s)
      const routing = await base44.integrations.Core.InvokeLLM({
        prompt: `Route this user request to the appropriate agent(s):
Request: "${user_request}"
Industry: ${industry}
Context: ${JSON.stringify(context)}

Determine:
1. Primary agent to handle this
2. Secondary agents to involve (if any)
3. Required data/context
4. Expected output format
5. Priority level

Return agent name, action, parameters, and any cross-agent dependencies.`,
        response_json_schema: {
          type: 'object',
          properties: {
            primary_agent: { type: 'string' },
            secondary_agents: { type: 'array', items: { type: 'string' } },
            action: { type: 'string' },
            parameters: { type: 'object' },
            dependencies: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      // Log routing decision
      await base44.asServiceRole.entities.Activity.create({
        type: 'request_routed',
        title: `Request routed: ${routing.primary_agent}`,
        description: user_request,
        entity_type: 'Commander'
      });

      result = routing;
    }

    if (action === 'cross_agent_synthesis') {
      // Combine insights from multiple agents into unified report
      const activities = await base44.asServiceRole.entities.Activity.list().then(
        a => a.filter(x => x.created_date > new Date(Date.now() - 24 * 60 * 60 * 1000))
      );

      const synthesis = await base44.integrations.Core.InvokeLLM({
        prompt: `Synthesize insights from recent agent activities:
${JSON.stringify(activities.map(a => ({
  agent: a.type,
  action: a.title,
  result: a.description
})).slice(0, 20))}

Provide:
1. Key insights across agents
2. Conflicts or contradictions
3. Recommended strategic actions
4. Next steps for user
5. Risks or alerts`,
        response_json_schema: {
          type: 'object',
          properties: {
            key_insights: { type: 'array', items: { type: 'string' } },
            strategic_actions: { type: 'array', items: { type: 'string' } },
            risks: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      result = synthesis;
    }

    if (action === 'maintain_memory') {
      // Store conversation context and business goals
      const memory = {
        user_id: user.email,
        industry,
        context,
        timestamp: new Date().toISOString(),
        last_requests: context.recent_requests || []
      };

      // Store in user preferences or activity log
      await base44.auth.updateMe({
        business_context: memory
      });

      result = { status: 'memory_updated', memory };
    }

    if (action === 'strategic_briefing') {
      // Generate daily/weekly briefing synthesizing all agent insights
      const briefingResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate strategic briefing for ${industry} business:

Synthesize insights from:
- Marketing performance (Maestro)
- Customer feedback (Support Sage)
- Financial health (Centsible)
- Market trends (Compass)
- Team capacity (Pulse)
- Upcoming obligations (Chronos)

Provide:
1. Executive summary (2-3 sentences)
2. Key metrics this period
3. Top priorities for next 7 days
4. Risks to monitor
5. Opportunities to seize
6. Required decisions`,
        response_json_schema: {
          type: 'object',
          properties: {
            executive_summary: { type: 'string' },
            key_metrics: { type: 'object' },
            priorities: { type: 'array', items: { type: 'string' } },
            risks: { type: 'array', items: { type: 'string' } },
            opportunities: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      // Create briefing entity
      await base44.asServiceRole.entities.Briefing.create({
        title: `Strategic Briefing - ${new Date().toISOString().split('T')[0]}`,
        brief_type: 'executive',
        content: briefingResponse.executive_summary,
        status: 'published'
      });

      result = briefingResponse;
    }

    return Response.json({
      status: 'commander_action_complete',
      action,
      result
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});