import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { spreadsheet_id, sheet_name, rows, create_new } = await req.json();

    const accessToken = await base44.asServiceRole.connectors.getAccessToken('googlesheets');

    let targetSpreadsheetId = spreadsheet_id;

    // Create a new spreadsheet if requested
    if (create_new) {
      const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          properties: { title: sheet_name || 'Nexus AI Export' },
        }),
      });
      const created = await createRes.json();
      targetSpreadsheetId = created.spreadsheetId;
    }

    if (!targetSpreadsheetId) {
      return Response.json({ error: 'spreadsheet_id required or set create_new: true' }, { status: 400 });
    }

    // Append rows
    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${targetSpreadsheetId}/values/A1:append?valueInputOption=RAW`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: rows }),
      }
    );

    if (!appendRes.ok) {
      const err = await appendRes.json();
      return Response.json({ error: err.error?.message }, { status: appendRes.status });
    }

    await base44.asServiceRole.entities.Activity.create({
      title: 'Data synced to Google Sheets',
      description: `${rows.length} rows exported`,
      type: 'ai_action',
      status: 'completed',
      module: 'analytics',
    });

    return Response.json({ success: true, spreadsheet_id: targetSpreadsheetId });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});