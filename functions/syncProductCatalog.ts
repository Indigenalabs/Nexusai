import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { merchant_platform, products_data } = payload;

    // products_data format: [{name, price, sku, description, images, inventory_count, product_url}]

    if (!products_data || products_data.length === 0) {
      return Response.json({
        status: 'error',
        message: 'No products provided for sync'
      }, { status: 400 });
    }

    const syncedProducts = [];
    const errors = [];

    for (const productData of products_data) {
      try {
        // Check if product already exists by SKU
        let existingProducts = [];
        if (productData.sku) {
          existingProducts = await base44.asServiceRole.entities.Product.filter({
            sku: productData.sku
          });
        }

        if (existingProducts.length > 0) {
          // Update existing product
          const updated = await base44.asServiceRole.entities.Product.update(existingProducts[0].id, {
            name: productData.name,
            price: productData.price,
            description: productData.description,
            images: productData.images || [],
            inventory_count: productData.inventory_count || 0,
            product_url: productData.product_url,
            status: productData.inventory_count > 0 ? 'active' : 'out_of_stock',
            merchant_platform
          });
          syncedProducts.push({ id: updated.id, action: 'updated', name: productData.name });
        } else {
          // Create new product
          const created = await base44.asServiceRole.entities.Product.create({
            name: productData.name,
            sku: productData.sku || `AUTO_${Date.now()}`,
            price: productData.price,
            description: productData.description || '',
            category: productData.category || 'General',
            images: productData.images || [],
            inventory_count: productData.inventory_count || 0,
            product_url: productData.product_url,
            status: productData.inventory_count > 0 ? 'active' : 'out_of_stock',
            merchant_platform,
            shoppable_enabled: true // Enable for social commerce by default
          });
          syncedProducts.push({ id: created.id, action: 'created', name: productData.name });
        }
      } catch (error) {
        errors.push({ product: productData.name, error: error.message });
      }
    }

    // Create Notification
    await base44.asServiceRole.entities.Notification.create({
      type: 'product_sync_complete',
      title: `📦 Product Catalog Synced: ${merchant_platform}`,
      message: `${syncedProducts.length} products synced. ${errors.length} errors.`,
      priority: errors.length > 0 ? 'high' : 'low',
      action_url: '/Products',
      recipient_role: 'admin'
    });

    // Create Activity log
    await base44.asServiceRole.entities.Activity.create({
      type: 'product_sync',
      title: `Product catalog sync: ${merchant_platform}`,
      description: `Synced ${syncedProducts.length} products`,
      entity_type: 'Product',
      entity_id: syncedProducts[0]?.id || ''
    });

    return Response.json({
      status: 'success',
      merchant_platform,
      products_synced: syncedProducts.length,
      synced_products: syncedProducts,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});