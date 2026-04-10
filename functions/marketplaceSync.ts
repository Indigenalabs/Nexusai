import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { product_id, marketplaces = ['amazon', 'ebay'] } = payload;

    const product = await base44.entities.Product.read(product_id);
    const syncResults = [];

    for (const marketplace of marketplaces) {
      // In production, would call actual marketplace APIs
      // For now, simulate sync

      const sync = await base44.asServiceRole.entities.MarketplaceSync.create({
        product_id,
        marketplace,
        marketplace_product_id: `${marketplace}_${product_id}`,
        your_price: product.price,
        marketplace_price: product.price,
        your_inventory: product.inventory_count,
        marketplace_inventory: product.inventory_count,
        status: 'active',
        sync_status: 'synced',
        last_sync_time: new Date().toISOString()
      });

      syncResults.push({
        marketplace,
        sync_id: sync.id,
        status: 'synced'
      });

      // Create Activity log
      await base44.asServiceRole.entities.Activity.create({
        type: 'marketplace_sync',
        title: `Synced to ${marketplace}`,
        description: `${product.name}: price $${product.price}, inventory ${product.inventory_count}`,
        entity_type: 'Product',
        entity_id: product_id
      });
    }

    return Response.json({
      status: 'sync_complete',
      product_id,
      product_name: product.name,
      synced_to: syncResults,
      price: product.price,
      inventory: product.inventory_count
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});