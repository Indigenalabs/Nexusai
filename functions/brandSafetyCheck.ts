import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { post_id, platform, comments_to_check } = payload;

    // comments_to_check: [{author_handle, content, comment_id}]

    if (!comments_to_check || comments_to_check.length === 0) {
      return Response.json({
        status: 'no_comments',
        message: 'No comments to check'
      });
    }

    const issuesFound = [];
    const safeComments = [];

    for (const comment of comments_to_check) {
      // Use LLM to detect brand safety issues
      const checkResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this social media comment for brand safety issues:

"${comment.content}"

Check for:
1. Hate speech, discrimination, profanity
2. Spam, fake engagement, self-promotion
3. Misinformation or conspiracy theories
4. Inappropriate/NSFW content
5. Competitor spam

Respond with:
- is_issue: boolean
- issue_type: (if yes, specify which type)
- severity: low/medium/high/critical
- confidence: 0-100`,
        response_json_schema: {
          type: 'object',
          properties: {
            is_issue: { type: 'boolean' },
            issue_type: { type: 'string' },
            severity: { type: 'string' },
            confidence: { type: 'number' }
          }
        }
      });

      if (checkResponse.is_issue) {
        // Create BrandSafetyAlert
        const alert = await base44.asServiceRole.entities.BrandSafetyAlert.create({
          platform,
          post_id,
          issue_type: checkResponse.issue_type,
          severity: checkResponse.severity,
          detected_content: comment.content,
          author_handle: comment.author_handle,
          detection_method: 'ai_moderation',
          auto_action_taken: checkResponse.severity === 'critical' ? 'flagged' : 'flagged',
          human_review_needed: true,
          status: 'pending_review'
        });

        issuesFound.push({
          alert_id: alert.id,
          issue_type: checkResponse.issue_type,
          severity: checkResponse.severity,
          author: comment.author_handle
        });

        // Create notification
        await base44.asServiceRole.entities.Notification.create({
          type: 'brand_safety_alert',
          title: `🚨 Brand Safety Alert: ${checkResponse.issue_type}`,
          message: `${checkResponse.severity.toUpperCase()} severity issue detected on ${platform}. "${comment.content.substring(0, 50)}..."`,
          priority: checkResponse.severity === 'critical' ? 'critical' : 'high',
          action_url: `/BrandSafetyAlert?id=${alert.id}`,
          recipient_role: 'admin'
        });
      } else {
        safeComments.push(comment.author_handle);
      }
    }

    // Log overall check
    await base44.asServiceRole.entities.Activity.create({
      type: 'brand_safety_check',
      title: `Brand Safety Check: ${platform}`,
      description: `${comments_to_check.length} comments reviewed. ${issuesFound.length} issues found.`,
      entity_type: 'BrandSafetyAlert'
    });

    return Response.json({
      status: 'check_complete',
      platform,
      total_comments_checked: comments_to_check.length,
      issues_found: issuesFound.length,
      safe_comments: safeComments.length,
      issues: issuesFound,
      critical_count: issuesFound.filter(i => i.severity === 'critical').length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});