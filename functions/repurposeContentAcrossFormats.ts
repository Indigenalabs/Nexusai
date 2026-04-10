import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { source_content_id, source_content_type, target_formats } = payload;

    // target_formats: ['short_video', 'carousel', 'email_series', etc.]

    // Fetch source content based on type
    let sourceContent;
    if (source_content_type === 'blog_post') {
      sourceContent = await base44.entities.Document.read(source_content_id);
    } else if (source_content_type === 'video') {
      sourceContent = await base44.entities.VideoAsset.read(source_content_id);
    } else {
      sourceContent = await base44.entities.SocialPost.read(source_content_id);
    }

    // Use LLM to generate repurposing strategy
    const strategyResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `Create a content repurposing strategy:

Source: ${source_content_type}
Content: ${sourceContent.title || sourceContent.caption}
${sourceContent.content ? `Content body: ${sourceContent.content.substring(0, 500)}` : ''}

Target formats: ${target_formats.join(', ')}

For each format, suggest:
1. Key angles/hooks to emphasize
2. Format-specific optimizations
3. Estimated engagement uplift
4. Platform recommendations

Maximize reach and engagement by adapting the core message for each format.`,
      response_json_schema: {
        type: 'object',
        properties: {
          repurposing_strategy: { type: 'string' },
          format_recommendations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                format: { type: 'string' },
                angle: { type: 'string' },
                platforms: { type: 'array', items: { type: 'string' } },
                estimated_uplift: { type: 'number' }
              }
            }
          }
        }
      }
    });

    // Create ContentRepurpose record
    const repurpose = await base44.asServiceRole.entities.ContentRepurpose.create({
      source_content_id,
      source_content_type,
      repurposing_strategy: strategyResponse.repurposing_strategy,
      status: 'in_progress'
    });

    // Generate repurposed variants
    const variants = [];
    for (const format of (target_formats || [])) {
      const recommendation = strategyResponse.format_recommendations.find(r => r.format === format);

      // Generate content for this format
      const formatResponse = await base44.integrations.Core.InvokeLLM({
        prompt: `Adapt this content to ${format} format:

Original: ${sourceContent.title || sourceContent.caption}
Angle: ${recommendation?.angle || 'core message'}
Platforms: ${recommendation?.platforms?.join(', ') || 'all'}

Create compelling ${format} content that:
1. Preserves core message
2. Optimizes for the format
3. Includes platform-specific elements`,
        response_json_schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            content: { type: 'string' }
          }
        }
      });

      // Create ContentAsset for this variant
      const asset = await base44.asServiceRole.entities.ContentAsset.create({
        title: `${sourceContent.title || 'Repurposed'} - ${format}`,
        type: format,
        content: formatResponse.content,
        status: 'draft',
        tags: ['repurposed', format, source_content_type],
        notes: `Repurposed from ${source_content_type}`
      });

      variants.push({
        format,
        content_id: asset.id,
        platforms: recommendation?.platforms || []
      });
    }

    // Update ContentRepurpose with variants
    await base44.asServiceRole.entities.ContentRepurpose.update(repurpose.id, {
      repurposed_variants: variants,
      total_variants_created: variants.length,
      time_saved_hours: target_formats.length * 2, // Estimate 2 hours per format saved
      status: 'completed'
    });

    // Create Notification
    await base44.asServiceRole.entities.Notification.create({
      type: 'content_repurposed',
      title: `♻️ Content Repurposed: ${variants.length} New Formats`,
      message: `${sourceContent.title || 'Content'} adapted to ${variants.length} formats. Estimated reach increase: ${variants.length * 30}%`,
      priority: 'medium',
      action_url: `/ContentRepurpose?id=${repurpose.id}`,
      recipient_role: 'admin'
    });

    // Create Insight
    await base44.asServiceRole.entities.Insight.create({
      type: 'content_efficiency',
      title: 'Content Repurposing Efficiency',
      description: `Repurposed 1 piece of content into ${variants.length} formats. Time saved: ~${variants.length * 2} hours`,
      data: { repurpose_id: repurpose.id, variants_created: variants.length },
      status: 'new'
    });

    return Response.json({
      status: 'success',
      repurpose_id: repurpose.id,
      source_content_type,
      variants_created: variants.length,
      formats: variants.map(v => v.format),
      time_saved_hours: variants.length * 2,
      repurposing_strategy: strategyResponse.repurposing_strategy.substring(0, 200) + '...'
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});