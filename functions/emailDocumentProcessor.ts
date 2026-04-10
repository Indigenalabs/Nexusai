import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { action, data } = await req.json();

    // Get user credentials stored on their profile
    const gmailToken = user.gmail_access_token;
    const driveToken = user.google_drive_token;
    const outlookToken = user.outlook_access_token;

    const gmailBase = 'https://gmail.googleapis.com/gmail/v1/users/me';
    const driveBase = 'https://www.googleapis.com/upload/drive/v3/files';
    const driveMetaBase = 'https://www.googleapis.com/drive/v3/files';
    const graphBase = 'https://graph.microsoft.com/v1.0/me';

    // ─── FETCH EMAILS (Gmail or Outlook) ───────────────────────────────────
    if (action === 'sync_emails') {
      const provider = data?.provider || 'gmail';
      let emails = [];

      if (provider === 'gmail' && gmailToken) {
        const listRes = await fetch(
          `${gmailBase}/messages?maxResults=20&q=is:unread`,
          { headers: { Authorization: `Bearer ${gmailToken}` } }
        );
        const listData = await listRes.json();
        if (listData.error) return Response.json({ error: listData.error.message }, { status: 400 });

        for (const msg of (listData.messages || []).slice(0, 10)) {
          const msgRes = await fetch(`${gmailBase}/messages/${msg.id}?format=full`, {
            headers: { Authorization: `Bearer ${gmailToken}` }
          });
          const msgData = await msgRes.json();

          const headers = msgData.payload?.headers || [];
          const subject = headers.find(h => h.name === 'Subject')?.value || '(no subject)';
          const from = headers.find(h => h.name === 'From')?.value || '';
          const bodyPart = msgData.payload?.parts?.find(p => p.mimeType === 'text/plain') || msgData.payload;
          const body = bodyPart?.body?.data
            ? atob(bodyPart.body.data.replace(/-/g, '+').replace(/_/g, '/'))
            : msgData.snippet || '';

          const attachments = (msgData.payload?.parts || [])
            .filter(p => p.filename && p.body?.attachmentId)
            .map(p => ({ filename: p.filename, attachmentId: p.body.attachmentId, mimeType: p.mimeType, messageId: msg.id }));

          const created = await base44.entities.Email.create({
            subject,
            from_email: from,
            to_email: user.email,
            body: body.slice(0, 2000),
            type: 'inbox',
            status: 'unread',
            priority: subject.toLowerCase().includes('urgent') || subject.toLowerCase().includes('invoice') ? 'high' : 'normal',
          });

          emails.push({ id: created.id, messageId: msg.id, subject, attachments });
        }
      } else if (provider === 'outlook' && outlookToken) {
        const res = await fetch(`${graphBase}/messages?$filter=isRead eq false&$top=20`, {
          headers: { Authorization: `Bearer ${outlookToken}` }
        });
        const outlookData = await res.json();
        for (const email of (outlookData.value || [])) {
          const attachRes = await fetch(`${graphBase}/messages/${email.id}/attachments`, {
            headers: { Authorization: `Bearer ${outlookToken}` }
          });
          const attachData = await attachRes.json();
          const attachments = (attachData.value || []).map(a => ({
            filename: a.name, contentBytes: a.contentBytes, mimeType: a.contentType
          }));

          const created = await base44.entities.Email.create({
            subject: email.subject,
            from_email: email.from?.emailAddress?.address || '',
            to_email: user.email,
            body: email.bodyPreview,
            type: 'inbox',
            status: 'unread',
            priority: 'normal',
          });
          emails.push({ id: created.id, messageId: email.id, subject: email.subject, attachments });
        }
      } else {
        return Response.json({ error: 'No valid credentials found. Please connect Gmail or Outlook in Settings.' }, { status: 400 });
      }

      return Response.json({ success: true, emails, synced: emails.length });
    }

    // ─── DOWNLOAD & UPLOAD ATTACHMENT TO DRIVE ──────────────────────────────
    if (action === 'save_attachment_to_drive') {
      const { messageId, attachmentId, filename, mimeType, folder, emailSubject } = data;

      if (!gmailToken) return Response.json({ error: 'Gmail not connected' }, { status: 400 });
      if (!driveToken) return Response.json({ error: 'Google Drive not connected' }, { status: 400 });

      // 1. Download attachment from Gmail
      const attachRes = await fetch(
        `${gmailBase}/messages/${messageId}/attachments/${attachmentId}`,
        { headers: { Authorization: `Bearer ${gmailToken}` } }
      );
      const attachData = await attachRes.json();
      const fileBytes = Uint8Array.from(atob(attachData.data.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));

      // 2. Determine Drive folder based on document type
      let driveFolder = folder || 'Nexus AI Documents';
      const lowerName = filename.toLowerCase();
      if (lowerName.includes('invoice') || lowerName.includes('receipt')) driveFolder = 'Invoices';
      else if (lowerName.includes('contract') || lowerName.includes('agreement')) driveFolder = 'Contracts';
      else if (lowerName.includes('report')) driveFolder = 'Reports';
      else if (lowerName.includes('proposal') || lowerName.includes('quote')) driveFolder = 'Proposals';

      // 3. Find or create folder in Drive
      let folderId = null;
      const folderSearchRes = await fetch(
        `${driveMetaBase}?q=name='${driveFolder}' and mimeType='application/vnd.google-apps.folder' and trashed=false&fields=files(id,name)`,
        { headers: { Authorization: `Bearer ${driveToken}` } }
      );
      const folderData = await folderSearchRes.json();
      if (folderData.files && folderData.files.length > 0) {
        folderId = folderData.files[0].id;
      } else {
        const createFolderRes = await fetch(`${driveMetaBase}`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${driveToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: driveFolder, mimeType: 'application/vnd.google-apps.folder' })
        });
        const newFolder = await createFolderRes.json();
        folderId = newFolder.id;
      }

      // 4. Upload file to Drive in correct folder
      const boundary = '-------314159265358979323846';
      const delimiter = `\r\n--${boundary}\r\n`;
      const closeDelimiter = `\r\n--${boundary}--`;
      const metadata = JSON.stringify({ name: filename, parents: folderId ? [folderId] : [] });

      const multipartBody = new TextEncoder().encode(
        delimiter +
        'Content-Type: application/json\r\n\r\n' +
        metadata +
        delimiter +
        `Content-Type: ${mimeType}\r\n\r\n`
      );

      const combined = new Uint8Array(multipartBody.length + fileBytes.length + new TextEncoder().encode(closeDelimiter).length);
      combined.set(multipartBody);
      combined.set(fileBytes, multipartBody.length);
      combined.set(new TextEncoder().encode(closeDelimiter), multipartBody.length + fileBytes.length);

      const uploadRes = await fetch(`${driveBase}?uploadType=multipart&fields=id,name,webViewLink`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${driveToken}`,
          'Content-Type': `multipart/related; boundary="${boundary}"`,
        },
        body: combined
      });

      const uploaded = await uploadRes.json();

      // 5. Log as activity
      await base44.entities.Activity.create({
        title: `Document saved to Drive: ${filename}`,
        description: `From email: "${emailSubject}" → saved to ${driveFolder}/`,
        type: 'ai_action',
        status: 'completed',
        module: 'operations'
      });

      return Response.json({ success: true, file: uploaded, folder: driveFolder });
    }

    // ─── SEND REPLY ──────────────────────────────────────────────────────────
    if (action === 'send_reply') {
      const { provider, messageId, to, subject, body, threadId } = data;

      if (provider === 'gmail' && gmailToken) {
        const rawEmail = [
          `To: ${to}`,
          `Subject: Re: ${subject}`,
          `In-Reply-To: ${messageId}`,
          `References: ${messageId}`,
          'Content-Type: text/plain; charset=utf-8',
          '',
          body
        ].join('\r\n');

        const encoded = btoa(rawEmail).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

        const res = await fetch(`${gmailBase}/messages/send`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${gmailToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ raw: encoded, threadId })
        });
        const result = await res.json();
        if (result.error) return Response.json({ error: result.error.message }, { status: 400 });
        return Response.json({ success: true, messageId: result.id });

      } else if (provider === 'outlook' && outlookToken) {
        const res = await fetch(`${graphBase}/messages/${messageId}/reply`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${outlookToken}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ comment: body })
        });
        return Response.json({ success: res.ok });
      }

      return Response.json({ error: 'No email provider connected' }, { status: 400 });
    }

    // ─── AI GENERATE REPLY ────────────────────────────────────────────────────
    if (action === 'generate_reply') {
      const { subject, body, from, businessContext } = data;

      const reply = await base44.integrations.Core.InvokeLLM({
        prompt: `You are an AI email assistant for a business. Generate a professional, concise reply to this email.
        
Business context: ${businessContext || 'Professional business'}
From: ${from}
Subject: ${subject}
Email body: ${body}

Write ONLY the reply body text, no subject line, no "Dear X", just the reply content. Keep it professional, helpful and concise.`
      });

      return Response.json({ success: true, reply });
    }

    // ─── CLASSIFY EMAIL ───────────────────────────────────────────────────────
    if (action === 'classify_and_summarise') {
      const { subject, body, from } = data;

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyse this email and return a JSON object.
From: ${from}
Subject: ${subject}
Body: ${body}

Return JSON with:
- summary: one sentence summary
- priority: "low" | "normal" | "high" | "urgent"
- type: "inbox" | "lead" | "client" | "invoice" | "contract"
- has_documents: boolean (are there likely attachments mentioned?)
- action_required: boolean
- suggested_folder: one of "Invoices" | "Contracts" | "Reports" | "Proposals" | "General"`,
        response_json_schema: {
          type: 'object',
          properties: {
            summary: { type: 'string' },
            priority: { type: 'string' },
            type: { type: 'string' },
            has_documents: { type: 'boolean' },
            action_required: { type: 'boolean' },
            suggested_folder: { type: 'string' }
          }
        }
      });

      return Response.json({ success: true, ...result });
    }

    return Response.json({ error: 'Unknown action' }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});