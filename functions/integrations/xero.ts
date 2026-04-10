import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, data } = await req.json();
    const xeroApiKey = Deno.env.get('XERO_API_KEY');
    
    if (!xeroApiKey) {
      return Response.json({ error: 'Xero API key not configured' }, { status: 400 });
    }

    const baseUrl = 'https://api.xero.com/api.xro/2.0';
    const headers = {
      'Authorization': `Bearer ${xeroApiKey}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    };

    let response;

    switch (action) {
      case 'get_invoices':
        response = await fetch(`${baseUrl}/Invoices`, { headers });
        break;
        
      case 'get_contacts':
        response = await fetch(`${baseUrl}/Contacts`, { headers });
        break;
        
      case 'create_invoice':
        response = await fetch(`${baseUrl}/Invoices`, {
          method: 'POST',
          headers,
          body: JSON.stringify(data)
        });
        break;
        
      case 'get_reports':
        response = await fetch(`${baseUrl}/Reports/ProfitAndLoss`, { headers });
        break;
        
      case 'sync_financial_data':
        // Sync to FinancialSnapshot entity
        const invoicesRes = await fetch(`${baseUrl}/Invoices`, { headers });
        const invoices = await invoicesRes.json();
        
        const revenue = invoices.Invoices
          ?.filter(i => i.Status === 'PAID')
          .reduce((sum, i) => sum + (i.Total || 0), 0) || 0;

        await base44.entities.FinancialSnapshot.create({
          date: new Date().toISOString().split('T')[0],
          revenue,
          cash_balance: revenue * 0.8, // Simplified
          health_score: revenue > 10000 ? 85 : 60
        });

        return Response.json({ success: true, revenue, synced: true });
        
      default:
        return Response.json({ error: 'Unknown action' }, { status: 400 });
    }

    const result = await response.json();

    return Response.json({ 
      success: response.ok,
      data: result
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});