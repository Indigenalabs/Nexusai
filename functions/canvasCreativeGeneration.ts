import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const { action, params = {} } = payload;

    // Legacy field support
    const content_brief = payload.content_brief || params.content_brief || '';
    const brand_colors = payload.brand_colors || params.brand_colors || [];
    const platform = payload.platform || params.platform || 'general';

    let result = null;

    const loadAssets = async () =>
      base44.asServiceRole.entities.ContentAsset.list('-created_date', 50).catch(() => []);

    const loadCampaigns = async () =>
      base44.asServiceRole.entities.Campaign.list('-created_date', 20).catch(() => []);

    // ─── 1. GENERATE IMAGES ──────────────────────────────────────────────────
    if (action === 'generate_images') {
      const { style, mood, subject, num_variations = 1 } = params;

      const imagePrompt = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a detailed AI image generation prompt.

Brief: ${content_brief}
Platform: ${platform}
Style: ${style || 'photorealistic'}
Mood: ${mood || 'professional, engaging'}
Subject: ${subject || 'as described in brief'}
Brand colors: ${brand_colors?.join(', ') || 'not specified'}

Generate a detailed, specific image prompt that includes:
1. Subject description (who/what is in the frame)
2. Composition and framing (rule of thirds, close-up, wide shot, etc.)
3. Lighting style (natural, studio, golden hour, etc.)
4. Color palette and mood
5. Style (photography, illustration, 3D render)
6. Background and environment
7. Technical quality markers (8K, sharp, etc.)

Also generate ${num_variations} alternative prompt variations for A/B testing.`,
        response_json_schema: {
          type: 'object',
          properties: {
            primary_prompt: { type: 'string' },
            composition: { type: 'string' },
            style: { type: 'string' },
            mood: { type: 'string' },
            variations: { type: 'array', items: { type: 'string' } },
            platform_adaptations: { type: 'object', properties: {
              instagram_post: { type: 'string' },
              instagram_story: { type: 'string' },
              facebook: { type: 'string' },
              linkedin: { type: 'string' }
            }}
          }
        }
      });

      const image = await base44.integrations.Core.GenerateImage({
        prompt: imagePrompt.primary_prompt
      });

      await base44.asServiceRole.entities.ContentAsset.create({
        title: content_brief?.slice(0, 80) || 'Generated Image',
        asset_type: 'image',
        file_url: image.url,
        channel: platform,
        status: 'active'
      }).catch(() => null);

      result = { image_url: image.url, prompt_used: imagePrompt.primary_prompt, creative_direction: imagePrompt };
    }

    // ─── 2. BRAND IDENTITY ────────────────────────────────────────────────────
    if (action === 'brand_identity') {
      const { business_name, industry, target_audience, values, competitors, style_preference } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Design a complete brand identity system.

Business: ${business_name || 'the business'}
Industry: ${industry || 'general'}
Target audience: ${target_audience || 'not specified'}
Brand values: ${values || 'not specified'}
Competitors to differentiate from: ${competitors || 'not specified'}
Style preference: ${style_preference || 'modern and professional'}

Create a complete brand identity:
1. Brand positioning statement (what we are, for whom, why different)
2. Visual personality adjectives (5-7 words that describe how the brand should LOOK)
3. Primary color palette (3-5 colors with hex codes and rationale)
4. Secondary/accent color palette
5. Typography system: primary font (headings), secondary font (body), and accent font (if any)
6. Logo concept directions (2-3 distinct directions to explore)
7. Visual motifs and graphic elements
8. Photography style (subject matter, composition, color treatment, mood)
9. Illustration style (if applicable)
10. Do's and don'ts for visual identity
11. Competitive differentiation in visual terms`,
        response_json_schema: {
          type: 'object',
          properties: {
            positioning_statement: { type: 'string' },
            visual_personality: { type: 'array', items: { type: 'string' } },
            primary_palette: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, hex: { type: 'string' }, usage: { type: 'string' } } } },
            secondary_palette: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, hex: { type: 'string' }, usage: { type: 'string' } } } },
            typography: { type: 'object', properties: { heading: { type: 'string' }, body: { type: 'string' }, accent: { type: 'string' }, rationale: { type: 'string' } } },
            logo_directions: { type: 'array', items: { type: 'object', properties: { concept: { type: 'string' }, description: { type: 'string' }, rationale: { type: 'string' } } } },
            photography_style: { type: 'string' },
            visual_dos: { type: 'array', items: { type: 'string' } },
            visual_donts: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 3. BRAND GUIDELINES ──────────────────────────────────────────────────
    if (action === 'brand_guidelines') {
      const { brand_name, existing_assets } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Create comprehensive brand guidelines documentation.

Brand: ${brand_name || 'the business'}
Existing assets: ${existing_assets || 'to be determined'}
Brand colors mentioned: ${brand_colors?.join(', ') || 'not specified'}

Generate complete brand guidelines covering:
1. Brand overview and mission
2. Logo usage: clear space, minimum sizes, approved variations
3. Color system: primary, secondary, neutral, semantic colors with usage rules
4. Typography: hierarchy, usage by context, don'ts
5. Imagery guidelines: photography style, illustration rules, icon usage
6. Layout principles: grid, spacing, alignment
7. Voice and tone (connecting visual to verbal)
8. Channel-specific adaptations (social, web, print, email)
9. Co-branding rules (for partnerships)
10. Brand compliance checklist

Format as a living document that a designer or non-designer can follow.`,
        response_json_schema: {
          type: 'object',
          properties: {
            brand_overview: { type: 'string' },
            logo_usage_rules: { type: 'array', items: { type: 'string' } },
            color_system: { type: 'object', properties: { primary: { type: 'string' }, secondary: { type: 'string' }, usage_rules: { type: 'array', items: { type: 'string' } } } },
            typography_rules: { type: 'array', items: { type: 'string' } },
            imagery_guidelines: { type: 'string' },
            layout_principles: { type: 'array', items: { type: 'string' } },
            channel_adaptations: { type: 'object' },
            compliance_checklist: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      await base44.asServiceRole.entities.Document.create({
        title: `Brand Guidelines — ${brand_name || 'Master'}`,
        type: 'brand_guidelines',
        content: JSON.stringify(result)
      }).catch(() => null);
    }

    // ─── 4. BRAND CONSISTENCY ─────────────────────────────────────────────────
    if (action === 'brand_consistency') {
      const { asset_description, asset_type: assetType } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Review creative assets for brand consistency and provide feedback.

Asset being reviewed: ${asset_description || content_brief}
Asset type: ${assetType || 'social media post'}
Brand colors: ${brand_colors?.join(', ') || 'not specified'}
Platform: ${platform}

Evaluate:
1. Color usage — is it on-brand? Any deviations?
2. Typography — correct fonts, hierarchy, sizing?
3. Logo usage — correct placement, size, clear space?
4. Imagery style — consistent with brand photography/illustration guidelines?
5. Layout and composition — consistent with brand grid and spacing?
6. Tone alignment — does the visual feel match the brand personality?
7. Platform appropriateness — optimized for ${platform}?

For each issue found: describe the problem and the specific correction needed.
Provide an overall brand compliance score (0-100) and a verdict: Approved / Minor revisions / Major revisions.`,
        response_json_schema: {
          type: 'object',
          properties: {
            compliance_score: { type: 'number' },
            verdict: { type: 'string' },
            color_assessment: { type: 'string' },
            typography_assessment: { type: 'string' },
            layout_assessment: { type: 'string' },
            issues: { type: 'array', items: { type: 'object', properties: { area: { type: 'string' }, issue: { type: 'string' }, correction: { type: 'string' }, severity: { type: 'string' } } } },
            approved_elements: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 5. BRAND AUDIT ───────────────────────────────────────────────────────
    if (action === 'brand_audit') {
      const assets = await loadAssets();

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Perform a brand audit across the creative asset library.

Asset library (${assets.length} assets): ${JSON.stringify(assets.map(a => ({
  title: a.title, type: a.asset_type, channel: a.channel, status: a.status
})))}

Audit findings:
1. Overall brand consistency rating
2. Most common brand deviations observed
3. Channels with highest/lowest brand consistency
4. Asset types that are underperforming brand-wise
5. Missing asset types (gaps in the library)
6. Recommendations to improve brand cohesion
7. Assets that should be refreshed or retired
8. Suggested brand refresh areas`,
        response_json_schema: {
          type: 'object',
          properties: {
            overall_rating: { type: 'number' },
            consistency_summary: { type: 'string' },
            common_deviations: { type: 'array', items: { type: 'string' } },
            library_gaps: { type: 'array', items: { type: 'string' } },
            assets_to_refresh: { type: 'array', items: { type: 'string' } },
            recommendations: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 6. CREATE VIDEO ──────────────────────────────────────────────────────
    if (action === 'create_video' || action === 'video_script') {
      const { duration_seconds, tone, target_audience, video_type } = params;

      const videoScript = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a complete video production brief and script.

Topic/Brief: ${content_brief}
Duration: ${duration_seconds || 30} seconds
Platform: ${platform}
Tone: ${tone || 'engaging and authentic'}
Target audience: ${target_audience || 'general audience'}
Video type: ${video_type || 'social media content'}

Create:
1. Hook (first 3 seconds — must stop the scroll)
2. Full scene-by-scene breakdown with:
   - Visuals (what's on screen)
   - Voiceover/text overlay
   - Timing (seconds)
   - Camera/composition notes
3. Complete voiceover script
4. Text overlay suggestions (key words/phrases to animate)
5. Music/sound direction (genre, tempo, mood)
6. Transitions and effects
7. Call to action (last 5 seconds)
8. Platform-specific optimization notes (${platform})
9. B-roll requirements
10. Budget tier estimate: DIY / Mid / Professional`,
        response_json_schema: {
          type: 'object',
          properties: {
            hook: { type: 'string' },
            scenes: { type: 'array', items: { type: 'object', properties: {
              scene_number: { type: 'number' },
              timing: { type: 'string' },
              visuals: { type: 'string' },
              voiceover: { type: 'string' },
              text_overlays: { type: 'array', items: { type: 'string' } },
              composition_notes: { type: 'string' }
            }}},
            full_voiceover: { type: 'string' },
            music_direction: { type: 'string' },
            cta: { type: 'string' },
            broll_requirements: { type: 'array', items: { type: 'string' } },
            budget_tier: { type: 'string' },
            platform_notes: { type: 'string' }
          }
        }
      });

      await base44.asServiceRole.entities.VideoAsset.create({
        title: content_brief?.slice(0, 80) || 'Video Script',
        script: videoScript.full_voiceover,
        platform_optimized_for: [platform],
        status: 'draft'
      }).catch(() => null);

      result = { script: videoScript };
    }

    // ─── 7. CAMPAIGN CONCEPT ──────────────────────────────────────────────────
    if (action === 'campaign_concept') {
      const { objective, target_audience, budget_level, channels, seasonality } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate creative campaign concepts.

Campaign brief: ${content_brief}
Objective: ${objective || 'awareness and engagement'}
Target audience: ${target_audience || 'not specified'}
Channels: ${channels || 'social media, email, digital ads'}
Budget level: ${budget_level || 'mid-range'}
Seasonality: ${seasonality || 'evergreen'}
Brand colors: ${brand_colors?.join(', ') || 'not specified'}

Generate 3 distinct creative campaign concepts, each with:
1. Campaign name and tagline
2. Core creative idea (the concept in one sentence)
3. Why it works for this audience and objective
4. Hero visual concept (the key image/video)
5. Tone and messaging direction
6. Channel execution plan (how it adapts per channel)
7. Key assets required (what needs to be produced)
8. Estimated production complexity: low/medium/high
9. Risk level (safe vs. bold)
10. Expected performance strengths

Recommend which concept to pursue and why.`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            concepts: { type: 'array', items: { type: 'object', properties: {
              name: { type: 'string' },
              tagline: { type: 'string' },
              core_idea: { type: 'string' },
              why_it_works: { type: 'string' },
              hero_visual: { type: 'string' },
              tone: { type: 'string' },
              channel_execution: { type: 'object' },
              assets_required: { type: 'array', items: { type: 'string' } },
              production_complexity: { type: 'string' },
              risk_level: { type: 'string' }
            }}},
            recommended_concept: { type: 'string' },
            recommendation_rationale: { type: 'string' }
          }
        }
      });
    }

    // ─── 8. DESIGN TEMPLATE ────────────────────────────────────────────────────
    if (action === 'design_template') {
      const { template_type, use_case } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Design a comprehensive template system.

Template for: ${content_brief}
Type: ${template_type || 'social media'}
Use case: ${use_case || 'recurring content creation'}
Platform: ${platform}
Brand colors: ${brand_colors?.join(', ') || 'professional'}

Specify:
1. Template dimensions (platform-correct)
2. Layout grid (columns, margins, safe zones)
3. Fixed brand elements (what stays the same every time)
4. Variable/customizable zones (text, image, color swappable areas)
5. Typography specifications (font, size, weight, color per element)
6. Color variations (primary, secondary, seasonal variants)
7. Content slots (image placeholder sizes, text field limits)
8. Usage instructions for non-designers
9. Common mistakes to avoid
10. Variations: generate specs for 3 layout variations`,
        response_json_schema: {
          type: 'object',
          properties: {
            dimensions: { type: 'object', properties: { width: { type: 'string' }, height: { type: 'string' }, resolution: { type: 'string' } } },
            fixed_elements: { type: 'array', items: { type: 'string' } },
            variable_zones: { type: 'array', items: { type: 'object', properties: { zone_name: { type: 'string' }, type: { type: 'string' }, specs: { type: 'string' } } } },
            typography_specs: { type: 'array', items: { type: 'object', properties: { element: { type: 'string' }, font: { type: 'string' }, size: { type: 'string' }, weight: { type: 'string' } } } },
            color_variations: { type: 'array', items: { type: 'string' } },
            layout_variations: { type: 'array', items: { type: 'string' } },
            usage_instructions: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      await base44.asServiceRole.entities.ContentAsset.create({
        title: `Template: ${content_brief?.slice(0, 60)}`,
        asset_type: 'template',
        channel: platform,
        status: 'active'
      }).catch(() => null);
    }

    // ─── 9. SOCIAL GRAPHICS ────────────────────────────────────────────────────
    if (action === 'social_graphics') {
      const { platforms: targetPlatforms, content_theme, post_type } = params;

      const graphicBrief = await base44.integrations.Core.InvokeLLM({
        prompt: `Design a complete social media graphic brief.

Content: ${content_brief}
Platforms: ${targetPlatforms || 'Instagram, LinkedIn, Facebook, TikTok'}
Theme: ${content_theme || 'promotional/editorial'}
Post type: ${post_type || 'standard post'}
Brand colors: ${brand_colors?.join(', ') || 'to be determined'}

For each platform, specify:
1. Dimensions and format (post, story, reel cover, carousel)
2. Composition approach
3. Text usage (minimal text rule for ads)
4. Visual hierarchy
5. Color usage
6. Typography
7. Image/illustration direction
8. Engagement-optimizing elements (faces, contrast, movement)

Also generate the image prompt for the primary visual.
And: 5 caption variants (from punchy to informative).`,
        response_json_schema: {
          type: 'object',
          properties: {
            platform_specs: { type: 'array', items: { type: 'object', properties: {
              platform: { type: 'string' },
              format: { type: 'string' },
              dimensions: { type: 'string' },
              composition: { type: 'string' },
              text_guidelines: { type: 'string' }
            }}},
            primary_image_prompt: { type: 'string' },
            caption_variants: { type: 'array', items: { type: 'string' } },
            hashtag_sets: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      const image = await base44.integrations.Core.GenerateImage({
        prompt: graphicBrief.primary_image_prompt || `${content_brief}, professional social media graphic, high quality`
      });

      await base44.asServiceRole.entities.ContentAsset.create({
        title: content_brief?.slice(0, 80) || 'Social Graphic',
        asset_type: 'social_graphic',
        file_url: image.url,
        channel: 'social',
        status: 'active'
      }).catch(() => null);

      result = { image_url: image.url, brief: graphicBrief };
    }

    // ─── 10. PRESENTATION DESIGN ──────────────────────────────────────────────
    if (action === 'presentation_design') {
      const { presentation_type, num_slides, audience } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Design a complete presentation structure and visual direction.

Topic: ${content_brief}
Type: ${presentation_type || 'business/pitch'}
Slides: ${num_slides || 15}
Audience: ${audience || 'business stakeholders'}
Brand colors: ${brand_colors?.join(', ') || 'professional'}

Create:
1. Slide-by-slide structure (title, purpose, content outline, visual approach)
2. Visual design direction: color scheme, typography, layout style
3. Opening slide concept (must make an impression)
4. Data visualization recommendations (for any stats/charts)
5. Section divider design concepts
6. Closing slide CTA
7. Speaker notes framework for key slides
8. Consistency guidelines (what stays the same slide to slide)
9. Animation/transition recommendations
10. Distribution format recommendations (PDF, live deck, video)`,
        response_json_schema: {
          type: 'object',
          properties: {
            slide_structure: { type: 'array', items: { type: 'object', properties: {
              slide_number: { type: 'number' },
              title: { type: 'string' },
              purpose: { type: 'string' },
              content_outline: { type: 'string' },
              visual_approach: { type: 'string' }
            }}},
            design_direction: { type: 'string' },
            color_scheme: { type: 'string' },
            typography: { type: 'string' },
            animation_recommendations: { type: 'string' },
            speaker_notes_framework: { type: 'string' }
          }
        }
      });
    }

    // ─── 11. INFOGRAPHIC ──────────────────────────────────────────────────────
    if (action === 'infographic') {
      const { data_story, infographic_type } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Design an infographic concept and layout.

Topic/Data: ${content_brief}
Story to tell: ${data_story || 'make complex simple'}
Type: ${infographic_type || 'statistical/process'}
Brand colors: ${brand_colors?.join(', ') || 'professional'}
Platform: ${platform}

Design:
1. Narrative structure (what's the story arc?)
2. Section breakdown (how to chunk the information)
3. Visual hierarchy (what draws the eye first, second, third)
4. Chart/visualization types for each data point
5. Icon and illustration direction
6. Color mapping (what colors communicate what data)
7. Typography system
8. Recommended dimensions
9. Key stats to call out prominently (the hero numbers)
10. Social media crop versions (how to slice it for posts)

Also: rewrite the key data points as short, punchy infographic copy.`,
        response_json_schema: {
          type: 'object',
          properties: {
            narrative_structure: { type: 'string' },
            sections: { type: 'array', items: { type: 'object', properties: { section: { type: 'string' }, content: { type: 'string' }, visual_type: { type: 'string' } } } },
            hero_stats: { type: 'array', items: { type: 'string' } },
            color_mapping: { type: 'string' },
            dimensions: { type: 'string' },
            punchy_copy: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 12. TREND FORECAST ────────────────────────────────────────────────────
    if (action === 'trend_forecast') {
      const { industry, creative_category } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Forecast visual design trends for strategic creative planning.

Industry: ${industry || 'general business'}
Creative category: ${creative_category || 'all: photography, illustration, motion, typography, color'}
Platform focus: ${platform}

Analyze and forecast:
1. Top 5 emerging visual trends RIGHT NOW (what's rising)
2. Trends at peak (adopt now before they saturate)
3. Trends to retire (past their prime)
4. Color of the moment (and why it's resonating)
5. Typography direction (what type styles are performing)
6. Photography style shifts (subjects, composition, processing)
7. Motion and animation trends
8. Platform-specific visual shifts (${platform})
9. Cultural context driving these trends
10. How to adopt these trends while staying on-brand
11. Timeline: which to adopt now vs. Q3 vs. next year`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            emerging_trends: { type: 'array', items: { type: 'object', properties: { trend: { type: 'string' }, description: { type: 'string' }, adoption_urgency: { type: 'string' } } } },
            peak_trends: { type: 'array', items: { type: 'string' } },
            retire_trends: { type: 'array', items: { type: 'string' } },
            color_direction: { type: 'string' },
            typography_direction: { type: 'string' },
            photography_shifts: { type: 'string' },
            platform_shifts: { type: 'string' },
            adoption_roadmap: { type: 'array', items: { type: 'object', properties: { timeline: { type: 'string' }, trend: { type: 'string' }, action: { type: 'string' } } } }
          }
        }
      });
    }

    // ─── 13. MOOD BOARD ────────────────────────────────────────────────────────
    if (action === 'mood_board') {
      const { creative_direction, references } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a detailed mood board specification.

Project: ${content_brief}
Creative direction: ${creative_direction || 'to be developed'}
References mentioned: ${references || 'none'}
Brand colors: ${brand_colors?.join(', ') || 'not specified'}

Specify a complete mood board including:
1. Overall creative territory name (the single phrase that captures the vibe)
2. Color story: exact palette with mood rationale
3. Photography direction (5 specific image types to include)
4. Typography personality (describe the font character, not just names)
5. Texture and material references
6. Lighting and shadow character
7. Composition and white space philosophy
8. Emotional response this mood board should evoke
9. What this mood board says NO to (anti-moodboard)
10. 3 reference campaigns or brands that partially capture this territory

Generate image prompts for 4 mood board images.`,
        response_json_schema: {
          type: 'object',
          properties: {
            creative_territory: { type: 'string' },
            color_story: { type: 'array', items: { type: 'object', properties: { color: { type: 'string' }, hex: { type: 'string' }, mood: { type: 'string' } } } },
            photography_direction: { type: 'array', items: { type: 'string' } },
            typography_personality: { type: 'string' },
            emotional_response: { type: 'string' },
            anti_moodboard: { type: 'array', items: { type: 'string' } },
            reference_brands: { type: 'array', items: { type: 'string' } },
            image_prompts: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 14. AB TEST PLAN ─────────────────────────────────────────────────────
    if (action === 'ab_test_plan') {
      const { asset_type: assetType, hypothesis, objective } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Design a creative A/B test plan.

What we're testing: ${content_brief}
Asset type: ${assetType || 'social media ad'}
Hypothesis: ${hypothesis || 'to be determined'}
Objective: ${objective || 'maximize engagement/conversion'}
Platform: ${platform}

Design a rigorous A/B test:
1. Primary hypothesis (what we believe and why)
2. Control (A): describe exactly
3. Variant (B): describe exactly — what single variable changed?
4. Why this single variable? (rationale)
5. Success metrics: primary KPI, secondary KPIs
6. Sample size recommendation and test duration
7. What to do with the results
8. Variant C if testing multiple elements
9. Common mistakes to avoid in this type of test
10. Generate asset briefs for both A and B creatives`,
        response_json_schema: {
          type: 'object',
          properties: {
            hypothesis: { type: 'string' },
            control_a: { type: 'object', properties: { description: { type: 'string' }, brief: { type: 'string' } } },
            variant_b: { type: 'object', properties: { description: { type: 'string' }, brief: { type: 'string' }, variable_changed: { type: 'string' } } },
            success_metrics: { type: 'object', properties: { primary: { type: 'string' }, secondary: { type: 'array', items: { type: 'string' } } } },
            test_duration: { type: 'string' },
            sample_size: { type: 'string' },
            decision_framework: { type: 'string' },
            common_mistakes: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 15. CREATIVE PERFORMANCE ─────────────────────────────────────────────
    if (action === 'creative_performance') {
      const assets = await loadAssets();
      const campaigns = await loadCampaigns();

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze creative asset performance and identify optimization opportunities.

Asset library (${assets.length} assets): ${JSON.stringify(assets.slice(0, 20).map(a => ({
  title: a.title, type: a.asset_type, channel: a.channel, status: a.status
})))}
Active campaigns: ${campaigns.length}

Analyze:
1. Asset type breakdown and what's missing
2. Channel coverage (are all channels well-served?)
3. Content freshness (age of assets, refresh opportunities)
4. Performance patterns by creative type (images vs copy vs video)
5. Which creative styles typically perform best in this industry
6. Recommendations for new asset creation (what to make next)
7. Assets to retire or refresh
8. Creative diversity score (avoiding creative fatigue)
9. Suggested creative experiments for next 30 days`,
        response_json_schema: {
          type: 'object',
          properties: {
            asset_breakdown: { type: 'object' },
            channel_coverage: { type: 'string' },
            freshness_assessment: { type: 'string' },
            top_performing_types: { type: 'array', items: { type: 'string' } },
            next_assets_to_create: { type: 'array', items: { type: 'object', properties: { asset: { type: 'string' }, reason: { type: 'string' }, priority: { type: 'string' } } } },
            assets_to_retire: { type: 'array', items: { type: 'string' } },
            creative_experiments: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 16. PRODUCT VISUALIZATION ────────────────────────────────────────────
    if (action === 'product_visualization') {
      const { product_name, product_description, use_case } = params;

      const vizPrompt = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate product visualization concepts and image prompts.

Product: ${product_name || content_brief}
Description: ${product_description || 'as described'}
Use case: ${use_case || 'e-commerce and marketing'}
Platform: ${platform}

Create:
1. Primary hero shot concept (lifestyle, in-use, or studio)
2. Detailed image prompt for AI generation
3. Shot list (5 angles/contexts to capture)
4. Styling direction (props, background, lighting)
5. Color mood for each shot
6. Key feature callout visual concepts
7. Lifestyle context suggestions (who's using it, where, when)`,
        response_json_schema: {
          type: 'object',
          properties: {
            hero_shot_concept: { type: 'string' },
            image_prompt: { type: 'string' },
            shot_list: { type: 'array', items: { type: 'object', properties: { shot: { type: 'string' }, angle: { type: 'string' }, mood: { type: 'string' } } } },
            styling_direction: { type: 'string' },
            lifestyle_contexts: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      const image = await base44.integrations.Core.GenerateImage({
        prompt: vizPrompt.image_prompt || `Product photography of ${product_name || content_brief}, professional studio lighting, white background, high detail`
      });

      result = { image_url: image.url, visualization_brief: vizPrompt };
    }

    // ─── 17. EMAIL DESIGN ─────────────────────────────────────────────────────
    if (action === 'email_design') {
      const { email_type, cta_goal } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Design a complete email template brief.

Email purpose: ${content_brief}
Type: ${email_type || 'marketing/promotional'}
CTA goal: ${cta_goal || 'drive clicks to website'}
Brand colors: ${brand_colors?.join(', ') || 'professional'}

Specify:
1. Email width and layout structure
2. Header design (logo placement, hero image, hero text)
3. Body layout (single column vs. multi-column sections)
4. Typography hierarchy (heading, subheading, body, CTA button)
5. Color system within the email
6. CTA button design (color, size, text, placement)
7. Footer design
8. Mobile responsiveness rules
9. Preview text (90 chars) and subject line options
10. Dark mode considerations
11. Image-to-text ratio recommendation
12. Accessibility requirements (alt text, contrast, font sizes)`,
        response_json_schema: {
          type: 'object',
          properties: {
            layout_structure: { type: 'string' },
            header_design: { type: 'string' },
            body_layout: { type: 'string' },
            typography_hierarchy: { type: 'object' },
            cta_design: { type: 'string' },
            subject_line_options: { type: 'array', items: { type: 'string' } },
            preview_text_options: { type: 'array', items: { type: 'string' } },
            accessibility_checklist: { type: 'array', items: { type: 'string' } },
            mobile_rules: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 18. COLOR ANALYSIS ────────────────────────────────────────────────────
    if (action === 'color_analysis') {
      const { colors, context } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze color choices for psychology, cultural appropriateness, and performance.

Colors to analyze: ${colors || brand_colors?.join(', ') || content_brief}
Context: ${context || 'brand identity and marketing'}
Platform: ${platform}

Analyze:
1. Psychological associations for each color (emotions, connotations)
2. Cultural considerations (does the color carry different meaning in key markets?)
3. Industry appropriateness (does this palette signal the right category?)
4. Contrast and accessibility (WCAG AA compliance check)
5. Color harmony assessment (complementary, analogous, triadic?)
6. Competitive differentiation (do competitors use similar palettes?)
7. Conversion psychology (which colors drive action, trust, urgency)
8. Recommended tweaks to improve the palette
9. What the palette currently communicates and what it should communicate
10. Alternative palette suggestions if needed`,
        response_json_schema: {
          type: 'object',
          properties: {
            color_psychology: { type: 'array', items: { type: 'object', properties: { color: { type: 'string' }, associations: { type: 'array', items: { type: 'string' } }, cultural_notes: { type: 'string' } } } },
            accessibility_assessment: { type: 'string' },
            harmony_type: { type: 'string' },
            current_message: { type: 'string' },
            intended_message: { type: 'string' },
            recommendations: { type: 'array', items: { type: 'string' } },
            alternative_palette: { type: 'string' }
          }
        }
      });
    }

    // ─── 19. BRIEF EXPANSION ──────────────────────────────────────────────────
    if (action === 'brief_expansion') {
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Expand a high-level creative brief into a comprehensive creative direction document.

High-level brief: ${content_brief}
Platform: ${platform}
Brand colors: ${brand_colors?.join(', ') || 'not specified'}

Expand into full creative brief covering:
1. Creative objective (what does this need to ACHIEVE?)
2. Target audience (who specifically, what do they care about?)
3. Key message (the single most important thing to communicate)
4. Tone and voice (how should it feel?)
5. Visual direction (what should it look like?)
6. What it must NOT be (creative guardrails)
7. Reference and inspiration (visual territory)
8. Required deliverables (exact asset list with specs)
9. Messaging hierarchy (primary, secondary, tertiary)
10. Success definition (how will we know this worked?)
11. Timeline and production considerations`,
        response_json_schema: {
          type: 'object',
          properties: {
            creative_objective: { type: 'string' },
            target_audience: { type: 'string' },
            key_message: { type: 'string' },
            tone_and_voice: { type: 'string' },
            visual_direction: { type: 'string' },
            creative_guardrails: { type: 'array', items: { type: 'string' } },
            deliverables: { type: 'array', items: { type: 'object', properties: { asset: { type: 'string' }, specs: { type: 'string' } } } },
            messaging_hierarchy: { type: 'object', properties: { primary: { type: 'string' }, secondary: { type: 'string' }, tertiary: { type: 'string' } } },
            success_definition: { type: 'string' }
          }
        }
      });
    }

    // Canvas 2.0 extensions
    if (action === 'creative_ops_command_center') {
      const assets = await loadAssets();
      const campaigns = await loadCampaigns();
      const channels = ['instagram', 'linkedin', 'facebook', 'tiktok', 'youtube', 'email', 'web'];
      const byChannel = channels.map((ch) => ({
        channel: ch,
        assets: assets.filter((a) => (a.channel || a.platform || '').toLowerCase() === ch).length,
      }));
      const staleAssets = assets.filter((a) => {
        if (!a.created_date) return false;
        const ageDays = (Date.now() - new Date(a.created_date).getTime()) / (1000 * 60 * 60 * 24);
        return ageDays > 45;
      }).length;
      const activeCampaigns = campaigns.filter((c) => c.status === 'active').length;
      const campaignsWithoutAssets = campaigns.filter((c) => !assets.some((a) => a.campaign_id === c.id)).length;

      result = {
        command_center: {
          active_campaigns: activeCampaigns,
          campaigns_without_assets: campaignsWithoutAssets,
          total_assets: assets.length,
          stale_assets_45d: staleAssets,
          channel_coverage: byChannel,
          production_queue: [
            'Refresh stale hero creatives for top channels',
            'Close campaign asset gaps for active launches',
            'Generate 3x platform-native variants for winning concepts',
          ],
        },
        next_actions: [
          'Run brand_guardian_monitor before next deployment',
          'Run multi_format_production_engine for current campaign',
          'Schedule creative_performance review every 7 days',
        ],
      };
    }

    if (action === 'brand_guardian_monitor') {
      const assets = await loadAssets();
      const sampleSize = Number(params.sample_size || 25);
      const sample = assets.slice(0, sampleSize);
      const missingChannel = sample.filter((a) => !(a.channel || a.platform)).length;
      const missingType = sample.filter((a) => !(a.asset_type || a.type)).length;
      const missingTitle = sample.filter((a) => !(a.title || a.name)).length;
      const violations = missingChannel + missingType + missingTitle;
      const maxIssues = Math.max(sample.length * 3, 1);
      const complianceScore = Math.max(0, Math.round(((maxIssues - violations) / maxIssues) * 100));

      result = {
        compliance_score: complianceScore,
        sample_size: sample.length,
        checks: {
          metadata_channel: missingChannel === 0,
          metadata_asset_type: missingType === 0,
          naming_consistency: missingTitle === 0,
        },
        violations: [
          ...(missingChannel ? [`${missingChannel} assets missing channel/platform metadata`] : []),
          ...(missingType ? [`${missingType} assets missing asset type`] : []),
          ...(missingTitle ? [`${missingTitle} assets missing title/name`] : []),
        ],
        recommendations: [
          'Enforce required metadata at asset creation time',
          'Run nightly brand metadata normalization',
          'Set pre-publish approval for missing brand fields',
        ],
      };
    }

    if (action === 'multi_format_production_engine') {
      const campaign_name = String(params.campaign_name || 'Untitled Campaign');
      const channelsRaw = String(params.channels || 'instagram,linkedin,email,web');
      const channels = channelsRaw.split(',').map((x) => x.trim()).filter(Boolean);
      const deliverables = [
        { format: 'instagram_post', size: '1080x1080' },
        { format: 'instagram_story', size: '1080x1920' },
        { format: 'linkedin_post', size: '1200x627' },
        { format: 'email_hero', size: '1200x600' },
        { format: 'web_hero', size: '1920x1080' },
      ];
      result = {
        campaign_name,
        channels,
        production_plan: channels.map((channel) => ({
          channel,
          deliverables: deliverables.filter((d) => d.format.includes(channel) || channel === 'email' || channel === 'web'),
        })),
        workflow: ['Brief intake', 'Concept board', 'Primary asset', 'Channel adaptations', 'QA + approval', 'Publish handoff'],
      };
    }

    if (action === 'cinematic_video_command') {
      const topic = String(params.topic || content_brief || 'brand story');
      const duration = Number(params.duration_seconds || 45);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a cinematic video command brief.

Topic: ${topic}
Duration seconds: ${duration}
Platform: ${platform}
Tone: ${params.tone || 'confident and modern'}

Return:
1) Hook concept
2) 6-8 shot storyboard (shot + camera + movement + on-screen text)
3) Audio direction (music + SFX)
4) Editing rhythm guidance
5) CTA ending options`,
        response_json_schema: {
          type: 'object',
          properties: {
            hook: { type: 'string' },
            storyboard: { type: 'array', items: { type: 'object', properties: { shot: { type: 'string' }, camera: { type: 'string' }, movement: { type: 'string' }, overlay: { type: 'string' } } } },
            audio_direction: { type: 'string' },
            editing_rhythm: { type: 'string' },
            cta_options: { type: 'array', items: { type: 'string' } },
          }
        }
      });
    }

    if (action === 'immersive_3d_ar_brief') {
      const product_name = String(params.product_name || 'Product');
      const use_case = String(params.use_case || 'ecommerce preview');
      result = {
        product_name,
        use_case,
        pipeline: ['3D model generation', 'Texture/material setup', 'Lighting pass', 'AR preview scene', 'Performance optimization'],
        outputs: ['glb master', 'USDZ iOS variant', 'WebAR embed package', '4 marketing renders'],
        quality_checks: ['Scale accuracy', 'Material realism', 'Mobile frame rate', 'Color consistency with brand'],
      };
    }

    if (action === 'cross_agent_creative_brief') {
      result = {
        collaboration_map: [
          { agent: 'Maestro', input: 'campaign objective + channels', output: 'creative asset suite + test variants' },
          { agent: 'Merchant', input: 'product feed + promo windows', output: 'commerce visuals + PDP creative refresh' },
          { agent: 'Part', input: 'co-brand partner requirements', output: 'co-branded templates + usage kits' },
          { agent: 'Compass', input: 'trend/competitor signals', output: 'creative territory recommendations' },
          { agent: 'Inspect', input: 'quality/accessibility checks', output: 'publish-ready approved assets' },
          { agent: 'Veritas', input: 'legal/compliance constraints', output: 'safe-claim creative adaptations' },
        ],
        event_bus_events: ['asset.created', 'design.approved', 'campaign.visuals.ready', 'brand.violation.flagged'],
      };
    }

    if (action === 'creative_roi_attribution') {
      const spend = Number(params.creative_spend || 12000);
      const influencedRevenue = Number(params.influenced_revenue || 54000);
      const roas = spend > 0 ? Number((influencedRevenue / spend).toFixed(2)) : 0;
      result = {
        creative_spend: spend,
        influenced_revenue: influencedRevenue,
        creative_roas: roas,
        top_winners: ['UGC-style product demo', 'Minimal headline + bold CTA static', 'Story format testimonials'],
        optimization_queue: ['Retire low-attention variants', 'Scale winning visual style to 3 channels', 'Increase test velocity for hooks'],
      };
    }

    if (action === 'style_learning_loop') {
      result = {
        style_clusters: [
          { style: 'clean editorial', win_rate: 'high' },
          { style: 'high-contrast product focus', win_rate: 'medium-high' },
          { style: 'busy collage', win_rate: 'low' },
        ],
        learning_updates: [
          'Prioritize restrained layouts with one clear focal object',
          'Use concise headline overlays (<7 words)',
          'Shift palette toward higher contrast for mobile feeds',
        ],
      };
    }

    if (action === 'canvas_full_self_test') {
      const [assets, campaigns] = await Promise.all([loadAssets(), loadCampaigns()]);
      const activeCampaigns = campaigns.filter((c) => c.status === 'active');
      const campaignsWithAssets = activeCampaigns.filter((c) => assets.some((a) => a.campaign_id === c.id));
      const images = assets.filter((a) => !!a.file_url);
      const templates = assets.filter((a) => (a.asset_type || a.type) === 'template');
      const hasCoverage = ['instagram', 'linkedin', 'email'].every((ch) =>
        assets.some((a) => ((a.channel || a.platform || '') as string).toLowerCase().includes(ch))
      );
      const checks = {
        asset_library_non_empty: assets.length > 0,
        active_campaign_coverage: activeCampaigns.length === 0 || campaignsWithAssets.length / activeCampaigns.length >= 0.7,
        image_pipeline_ready: images.length >= 3,
        template_system_ready: templates.length >= 1,
        core_channel_coverage: hasCoverage,
      };

      result = {
        checks,
        operations: {
          total_assets: assets.length,
          active_campaigns: activeCampaigns.length,
          covered_campaigns: campaignsWithAssets.length,
          image_assets: images.length,
          template_assets: templates.length,
        },
        strategy: {
          next_7_day_priorities: [
            'Ship 1 hero creative per active campaign',
            'Refresh top 3 underperforming visuals',
            'Launch one controlled creative A/B test per primary channel',
          ],
        },
        governance: {
          brand_guardrail_status: checks.core_channel_coverage ? 'stable' : 'attention_required',
          recommended_audit_frequency: 'weekly',
        },
      };
    }
    if (!result) {
      result = {
        message: `Action '${action}' received. Available: generate_images, brand_identity, brand_guidelines, brand_consistency, brand_audit, create_video, video_script, campaign_concept, design_template, social_graphics, presentation_design, infographic, trend_forecast, mood_board, ab_test_plan, creative_performance, product_visualization, email_design, color_analysis, brief_expansion, creative_ops_command_center, brand_guardian_monitor, multi_format_production_engine, cinematic_video_command, immersive_3d_ar_brief, cross_agent_creative_brief, creative_roi_attribution, style_learning_loop, canvas_full_self_test`
      };
    }

    return Response.json({ status: 'canvas_complete', action, result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
