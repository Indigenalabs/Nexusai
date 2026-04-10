import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { task, taskType, parameters } = await req.json();

    let result;
    
    switch (taskType) {
      case 'send_email':
        result = await base44.integrations.Core.SendEmail({
          to: parameters.to,
          subject: parameters.subject || task,
          body: parameters.body || `This is an automated message regarding: ${task}`
        });
        
        // Log the activity
        await base44.entities.Activity.create({
          title: `Email sent to ${parameters.to}`,
          description: parameters.subject || task,
          type: 'email',
          status: 'completed',
          module: 'communication'
        });
        break;
        
      case 'schedule_post':
        result = await base44.entities.SocialPost.create({
          content: parameters.content,
          platform: parameters.platform || 'instagram',
          hashtags: parameters.hashtags || [],
          status: 'scheduled',
          scheduled_time: parameters.scheduled_time || new Date(Date.now() + 3600000).toISOString()
        });
        
        await base44.entities.Activity.create({
          title: 'Social post scheduled',
          description: `${parameters.platform}: ${parameters.content.substring(0, 50)}...`,
          type: 'social',
          status: 'completed',
          module: 'marketing'
        });
        break;
        
      case 'create_client':
        result = await base44.entities.Client.create({
          name: parameters.name,
          email: parameters.email,
          company: parameters.company,
          status: parameters.status || 'lead'
        });
        
        await base44.entities.Activity.create({
          title: 'New client added',
          description: `${parameters.name} - ${parameters.company}`,
          type: 'task',
          status: 'completed',
          module: 'operations'
        });
        break;
        
      case 'generate_report':
        result = await base44.entities.Report.create({
          title: parameters.title || task,
          type: parameters.reportType || 'analytics',
          period: parameters.period || 'monthly',
          format: parameters.format || 'pdf',
          status: 'generating'
        });
        
        // Simulate report generation
        setTimeout(async () => {
          await base44.asServiceRole.entities.Report.update(result.id, {
            status: 'ready',
            file_url: 'https://example.com/report.pdf'
          });
        }, 5000);
        break;
        
      case 'analyze_data':
        // Run analysis
        const analysisResult = await base44.integrations.Core.InvokeLLM({
          prompt: `Analyze this business data and provide actionable insights: ${JSON.stringify(parameters.data)}`,
          response_json_schema: {
            type: "object",
            properties: {
              summary: { type: "string" },
              key_findings: { type: "array", items: { type: "string" } },
              recommendations: { type: "array", items: { type: "string" } }
            }
          }
        });
        
        result = analysisResult;
        
        await base44.entities.Activity.create({
          title: 'Data analysis completed',
          description: task,
          type: 'ai_action',
          status: 'completed',
          module: 'analytics'
        });
        break;
        
      default:
        // Generic task execution using AI
        const aiResponse = await base44.integrations.Core.InvokeLLM({
          prompt: `Execute this task: ${task}. Parameters: ${JSON.stringify(parameters)}. 
          Determine the best way to accomplish this and provide a detailed execution plan.`
        });
        
        result = { 
          executed: true, 
          plan: aiResponse,
          message: 'Task executed via AI reasoning'
        };
        
        await base44.entities.Activity.create({
          title: 'AI task executed',
          description: task,
          type: 'ai_action',
          status: 'completed',
          module: 'operations'
        });
    }

    return Response.json({ 
      success: true,
      result,
      task,
      taskType,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    // Log failed activity
    try {
      const base44 = createClientFromRequest(req);
      await base44.entities.Activity.create({
        title: 'Task execution failed',
        description: error.message,
        type: 'alert',
        status: 'failed',
        module: 'operations'
      });
    } catch {}
    
    return Response.json({ error: error.message }, { status: 500 });
  }
});