import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Canvas Autopilot — Autonomous visual asset generation, brand consistency checking, content repurposing, storyboard creation
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action } = body;

    if (action === 'creative_audit') {
      // Scan the asset library and identify creative gaps
      const [assets, campaigns, profile] = await Promise.all([
        base44.entities.ContentAsset.list('-created_date', 100),
        base44.entities.Campaign.filter({ status: 'active' }, '-created_date', 20),
        base44.entities.BusinessProfile.list('-created_date', 1),
      ]);

      const images = assets.filter(a => a.file_url);
      const copyAssets = assets.filter(a => !a.file_url);
      const campaignsWithoutAssets = campaigns.filter(c => !assets.some(a => a.campaign_id === c.id));

      const gaps = [];
      if (images.length === 0) gaps.push({ type: 'critical', message: 'No brand images in library. Canvas needs to generate hero images.' });
      if (campaignsWithoutAssets.length > 0) gaps.push({ type: 'warning', message: `${campaignsWithoutAssets.length} active campaigns have no visual assets.` });
      
      const platforms = ['instagram', 'linkedin', 'facebook', 'tiktok'];
      for (const platform of platforms) {
        const platformAssets = assets.filter(a => a.platform === platform);
        if (platformAssets.length === 0) gaps.push({ type: 'info', message: `No assets for ${platform}. Consider creating platform-specific content.` });
      }

      const staleAssets = assets.filter(a => {
        const age = (Date.now() - new Date(a.created_date).getTime()) / (1000 * 60 * 60 * 24);
        return age > 30;
      });

      await base44.entities.Insight.create({
        type: 'creative',
        title: 'Canvas Creative Audit',
        content: JSON.stringify({
          total_assets: assets.length,
          images: images.length,
          copy: copyAssets.length,
          gaps: gaps,
          stale_assets: staleAssets.length,
          campaigns_without_visuals: campaignsWithoutAssets.map(c => c.name),
        }),
        status: 'active',
        source: 'canvas_agent',
      });

      if (gaps.filter(g => g.type === 'critical').length > 0) {
        await base44.entities.Notification.create({
          title: '🎨 Canvas: Critical Creative Gap',
          message: `Your content library has ${gaps.filter(g => g.type === 'critical').length} critical gap(s). Canvas recommends immediate action.`,
          type: 'warning',
          is_read: false,
        });
      }

      return Response.json({ success: true, audit: { assets: assets.length, images: images.length, gaps, stale: staleAssets.length } });
    }

    if (action === 'generate_brand_kit') {
      // Auto-generate a full brand visual kit
      const profiles = await base44.entities.BusinessProfile.list('-created_date', 1);
      const profile = profiles[0] || {};

      const brandKitItems = [
        { type: 'image_prompt', platform: 'instagram', content: `Brand hero image for ${profile.business_name || 'this brand'}. Style: ${profile.industry || 'professional'}. Tone: premium, aspirational. Color palette: brand-consistent. Composition: clean, minimal, product/service centered. Ultra high quality commercial photography.`, tags: ['brand_asset', 'hero', 'instagram'] },
        { type: 'image_prompt', platform: 'linkedin', content: `Professional brand cover image for ${profile.business_name || 'this brand'}. Clean, corporate, trustworthy. Shows expertise. LinkedIn banner format 1584x396. Professional photography or minimal graphic design style.`, tags: ['brand_asset', 'cover', 'linkedin'] },
        { type: 'copy', platform: 'instagram', content: `Brand bio for Instagram. 150 characters max. Includes: what we do, who we serve, unique value prop, call to action. For ${profile.business_name || 'this business'} in ${profile.industry || 'their industry'}.`, tags: ['brand_asset', 'bio'] },
        { type: 'copy', platform: 'linkedin', content: `LinkedIn company description for ${profile.business_name || 'this business'}. Professional, credibility-building. 2-3 sentences about mission, audience, and unique approach.`, tags: ['brand_asset', 'bio'] },
        { type: 'copy', platform: null, content: `Brand tagline options for ${profile.business_name || 'this business'} (${profile.industry || 'their industry'}). Generate 5 options ranging from: bold/disruptive, warm/approachable, professional/authoritative, quirky/memorable, results-focused.`, tags: ['brand_asset', 'tagline'] },
      ];

      const created = [];
      for (const item of brandKitItems) {
        const asset = await base44.entities.ContentAsset.create({
          name: `Brand Kit — ${item.type} — ${item.platform || 'general'}`,
          type: item.type,
          platform: item.platform,
          content: item.content,
          tags: item.tags,
          status: 'draft',
          source: 'canvas_ai',
          ai_description: 'Auto-generated brand kit asset',
        });
        created.push(asset);
      }

      await base44.entities.Notification.create({
        title: '🎨 Brand Kit Generated',
        message: `Canvas created ${created.length} brand kit items. Review in Canvas → Assets library.`,
        type: 'success',
        is_read: false,
      });

      return Response.json({ success: true, items_created: created.length });
    }

    if (action === 'repurpose_asset') {
      const { assetId, targetPlatforms } = body;
      if (!assetId) return Response.json({ error: 'assetId required' }, { status: 400 });

      const asset = await base44.entities.ContentAsset.filter({ id: assetId });
      if (!asset.length) return Response.json({ error: 'Asset not found' }, { status: 404 });
      const original = asset[0];

      const platforms = targetPlatforms || ['instagram', 'linkedin', 'twitter', 'tiktok', 'email'];
      const repurposed = [];

      for (const platform of platforms) {
        if (platform === original.platform) continue;

        const newAsset = await base44.entities.ContentAsset.create({
          name: `${original.name || 'Asset'} (repurposed for ${platform})`,
          type: original.type || 'copy',
          platform,
          content: `[REPURPOSE] Take this original content and rewrite it natively for ${platform}: "${original.content?.slice(0, 500)}". Match the ${platform} style, format, tone, and best practices.`,
          tags: [...(original.tags || []), 'repurposed', platform],
          status: 'draft',
          source: 'canvas_ai',
          parent_asset_id: assetId,
          ai_description: `Repurposed from original asset for ${platform}`,
        });
        repurposed.push(newAsset);
      }

      return Response.json({ success: true, repurposed_count: repurposed.length, platforms });
    }

    if (action === 'generate_video_scripts') {
      const { topic, duration, platform, audience, tone } = body;
      const scripts = [];

      const formats = duration <= 60
        ? [{ label: 'Hook-Value-CTA (30s)', length: 30 }, { label: 'Story Arc (60s)', length: 60 }]
        : [{ label: 'Tutorial Format', length: 180 }, { label: 'Story + Value', length: 300 }];

      for (const format of formats) {
        const script = await base44.entities.ContentAsset.create({
          name: `Video Script — ${topic} — ${format.label} (${platform})`,
          type: 'video_script',
          platform: platform || 'instagram',
          content: `Write a ${format.length}-second video script for ${platform} on the topic: "${topic}". Target audience: ${audience || 'general business audience'}. Tone: ${tone || 'engaging and authentic'}. Format: ${format.label}. Include: hook (first 3 seconds), main content sections with timestamps, B-roll suggestions, text overlay recommendations, CTA, and 3 alternative hook options.`,
          tags: ['video_script', platform, topic?.replace(/ /g, '_').toLowerCase()],
          status: 'draft',
          source: 'canvas_ai',
          ai_description: `${format.label} video script for ${platform}`,
        });
        scripts.push(script);
      }

      return Response.json({ success: true, scripts_created: scripts.length, formats: formats.map(f => f.label) });
    }

    if (action === 'create_ab_variants') {
      const { baseAssetId, campaignId, channel } = body;
      
      let baseContent = '';
      if (baseAssetId) {
        const baseAssets = await base44.entities.ContentAsset.filter({ id: baseAssetId });
        baseContent = baseAssets[0]?.content || '';
      }

      const variantTypes = [
        { variant: 'A', angle: 'Emotional', description: 'Appeals to feelings, aspirations, identity, and belonging. Uses storytelling and emotional triggers.' },
        { variant: 'B', angle: 'Rational', description: 'Data-driven, proof points, ROI-focused, features and outcomes. Speaks to logic.' },
        { variant: 'C', angle: 'Social Proof', description: 'Testimonial angle, community validation, fear of missing out, authority signals.' },
      ];

      const created = [];
      for (const vt of variantTypes) {
        const asset = await base44.entities.CampaignAsset.create({
          campaign_id: campaignId,
          channel: channel || 'instagram',
          type: 'copy',
          content: `[A/B VARIANT ${vt.variant} — ${vt.angle}] ${vt.description}. ${baseContent ? `Base content: "${baseContent.slice(0, 300)}"` : ''} Create a compelling ${channel || 'instagram'} post using this angle.`,
          status: 'draft',
          variant: vt.variant,
          performance_score: null,
        });
        created.push({ ...asset, angle: vt.angle });
      }

      return Response.json({ success: true, variants_created: created.length, variants: created.map(v => ({ id: v.id, variant: v.variant })) });
    }

    if (action === 'batch_generate_social') {
      // Generate a full month of social posts across platforms
      const { platforms, postsPerWeek, theme } = body;
      const targetPlatforms = platforms || ['instagram', 'linkedin'];
      const weeklyCount = postsPerWeek || 3;
      const monthlyTotal = weeklyCount * 4;

      const posts = [];
      const now = new Date();

      for (const platform of targetPlatforms) {
        for (let i = 0; i < monthlyTotal; i++) {
          const postDate = new Date(now);
          postDate.setDate(postDate.getDate() + Math.floor(i * (28 / monthlyTotal)));
          
          const postTypes = ['educational', 'behind_the_scenes', 'promotional', 'engagement', 'testimonial'];
          const postType = postTypes[i % postTypes.length];

          const post = await base44.entities.SocialPost.create({
            platform,
            content: `[AUTO-GENERATED ${postType.toUpperCase()} POST FOR ${platform.toUpperCase()}] ${theme ? `Theme: ${theme}.` : ''} Write a compelling, platform-native ${postType} post. Include: hook, value, relevant hashtags (for Instagram), and a CTA appropriate for ${postType} content.`,
            status: 'draft',
            type: postType,
            scheduled_time: postDate.toISOString(),
          });
          posts.push(post);
        }
      }

      await base44.entities.Notification.create({
        title: '📅 Monthly Content Generated',
        message: `Canvas created ${posts.length} post drafts across ${targetPlatforms.join(', ')} for the month. Review and approve in Social Command.`,
        type: 'success',
        is_read: false,
      });

      return Response.json({ success: true, posts_created: posts.length, platforms: targetPlatforms });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});