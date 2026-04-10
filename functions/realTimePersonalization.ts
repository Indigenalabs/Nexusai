import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();
    const { customer_email, browsing_event } = payload;

    // Don't require auth for this—it's called from frontend
    // browsing_event: {product_id, time_spent, action: 'view' | 'add_to_cart' | 'remove_from_cart'}

    let profile = await base44.asServiceRole.entities.PersonalizationProfile.list().then(
      profiles => profiles.find(p => p.customer_id === customer_email)
    );

    if (!profile) {
      // Create new profile
      profile = await base44.asServiceRole.entities.PersonalizationProfile.create({
        customer_id: customer_email,
        session_count: 1,
        browsing_behavior: {
          last_viewed_products: [
            {
              product_id: browsing_event.product_id,
              timestamp: new Date().toISOString(),
              time_spent_seconds: browsing_event.time_spent || 0
            }
          ]
        }
      });
    } else {
      // Update existing profile
      const updated_products = profile.browsing_behavior?.last_viewed_products || [];
      updated_products.push({
        product_id: browsing_event.product_id,
        timestamp: new Date().toISOString(),
        time_spent_seconds: browsing_event.time_spent || 0
      });

      // Keep only last 20 views
      if (updated_products.length > 20) {
        updated_products.shift();
      }

      await base44.asServiceRole.entities.PersonalizationProfile.update(profile.id, {
        session_count: (profile.session_count || 0) + 1,
        browsing_behavior: {
          ...profile.browsing_behavior,
          last_viewed_products: updated_products
        }
      });
    }

    // Generate personalized recommendations
    const product = await base44.entities.Product.read(browsing_event.product_id);
    const recsResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `Recommend complementary products for a customer viewing:

Product: ${product.name}
Category: ${product.category}
Customer browsing history: ${profile.browsing_behavior?.last_viewed_products?.map(p => p.product_id).join(', ') || 'none'}

Suggest 3-5 complementary product types (not specific IDs).
Consider what customers typically buy together.`,
      response_json_schema: {
        type: 'object',
        properties: {
          recommendations: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                product_type: { type: 'string' },
                reason: { type: 'string' }
              }
            }
          },
          personalization_insight: { type: 'string' }
        }
      }
    });

    // Calculate purchase intent
    const purchaseIntentResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `Estimate purchase likelihood based on browsing:

Session events: ${profile.session_count} sessions
Time spent on current product: ${browsing_event.time_spent || 0} seconds
Recent views: ${profile.browsing_behavior?.last_viewed_products?.length || 0} products
Last purchase: ${profile.purchase_history?.[0]?.date || 'never'}

Rate likelihood to purchase in next 24h: 0-100`,
      response_json_schema: {
        type: 'object',
        properties: {
          purchase_intent_score: { type: 'number' }
        }
      }
    });

    const personalization = {
      profile_id: profile.id,
      customer_email,
      purchase_intent: purchaseIntentResponse.purchase_intent_score,
      recommendations: recsResponse.recommendations,
      personalization_insight: recsResponse.personalization_insight,
      session_count: profile.session_count,
      should_show_discount: purchaseIntentResponse.purchase_intent_score > 60,
      discount_type: profile.preferred_discount_type || 'percent_off'
    };

    return Response.json(personalization);
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});