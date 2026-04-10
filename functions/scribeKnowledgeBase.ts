import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const { action, params = {} } = payload;

    // Legacy support
    const document_type = payload.document_type || params.document_type;
    const search_query = payload.search_query || params.search_query;
    const document_content = payload.document_content || params.document_content;

    let result = null;

    // ─── HELPERS ─────────────────────────────────────────────────────────────
    const loadDocs = async (limit = 50) =>
      base44.asServiceRole.entities.Document.list('-created_date', limit).catch(() => []);

    const loadKB = async (limit = 30) =>
      base44.asServiceRole.entities.KnowledgeBase.list('-created_date', limit).catch(() => []);

    // ─── 1. STORE DOCUMENT ───────────────────────────────────────────────────
    if (action === 'store_document') {
      const { title, type, content, tags, summary, source, version, related_ids } = params;
      const doc = await base44.asServiceRole.entities.Document.create({
        title: title || payload.title || 'Untitled',
        type: type || document_type || 'note',
        content: content || document_content,
        summary: summary || null,
        tags: tags || payload.tags || [],
        source: source || 'manual',
        version: version || '1.0',
        related_ids: related_ids || [],
        status: 'indexed',
        created_by: user.email
      });
      result = { document_id: doc.id, status: 'stored', document: doc };
    }

    // ─── 2. INGEST FILE ──────────────────────────────────────────────────────
    if (action === 'ingest_file') {
      const { file_url, file_name } = params;
      const extracted = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: {
          type: 'object',
          properties: {
            title: { type: 'string' },
            document_type: { type: 'string' },
            summary: { type: 'string' },
            key_sections: { type: 'array', items: { type: 'string' } },
            action_items: { type: 'array', items: { type: 'string' } },
            decisions: { type: 'array', items: { type: 'string' } },
            tags: { type: 'array', items: { type: 'string' } },
            people_mentioned: { type: 'array', items: { type: 'string' } },
            dates_mentioned: { type: 'array', items: { type: 'string' } },
            full_content: { type: 'string' }
          }
        }
      });

      const data = extracted?.output || {};
      const doc = await base44.asServiceRole.entities.Document.create({
        title: data.title || file_name || 'Ingested Document',
        type: data.document_type || 'other',
        content: data.full_content || '',
        summary: data.summary || '',
        tags: data.tags || [],
        action_items: data.action_items || [],
        source: 'file_upload',
        file_url,
        status: 'indexed',
        created_by: user.email
      });

      // Push action items to Atlas
      if (data.action_items?.length) {
        for (const item of data.action_items) {
          await base44.asServiceRole.entities.Task.create({
            title: item,
            description: `Action item extracted from: ${data.title || file_name}`,
            status: 'todo',
            priority: 'medium'
          }).catch(() => null);
        }
      }

      result = { document_id: doc.id, extracted: data, action_items_created: data.action_items?.length || 0 };
    }

    // ─── 3. SEMANTIC SEARCH ──────────────────────────────────────────────────
    if (action === 'semantic_search') {
      const query = search_query || params.query;
      const [docs, kb] = await Promise.all([loadDocs(100), loadKB(50)]);

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Semantic knowledge search across the organization's document library.

Search query: "${query}"

Documents available (${docs.length}):
${docs.map(d => `- [${d.type || 'doc'}] "${d.title}" (${d.created_date ? new Date(d.created_date).toLocaleDateString() : 'undated'}) | Tags: ${(d.tags || []).join(', ')} | Summary: ${(d.summary || d.content || '').slice(0, 150)}`).join('\n')}

Knowledge base entries (${kb.length}):
${kb.map(k => `- [${k.category || 'general'}] "${k.title}" | ${(k.content || '').slice(0, 100)}`).join('\n')}

Return: 1) Top 5 most relevant documents with relevance score and explanation, 2) A direct answer to the query synthesized from the knowledge base, 3) Related topics to explore, 4) Any gaps in available knowledge.`,
        response_json_schema: {
          type: 'object',
          properties: {
            direct_answer: { type: 'string' },
            relevant_documents: { type: 'array', items: { type: 'object', properties: {
              title: { type: 'string' },
              relevance_score: { type: 'number' },
              excerpt: { type: 'string' },
              why_relevant: { type: 'string' }
            }}},
            related_topics: { type: 'array', items: { type: 'string' } },
            knowledge_gaps: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 4. QUESTION ANSWER (RAG) ─────────────────────────────────────────────
    if (action === 'question_answer') {
      const { question, context_topic } = params;
      const docs = await loadDocs(100);
      const relevant = docs.filter(d =>
        context_topic ? (d.tags || []).some(t => t.toLowerCase().includes(context_topic.toLowerCase())) ||
          (d.title || '').toLowerCase().includes(context_topic.toLowerCase()) : true
      ).slice(0, 20);

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Answer this question using only the organizational knowledge base. Question: "${question}"

Knowledge base context:
${relevant.map(d => `--- Document: "${d.title}" (${d.type}, ${d.created_date ? new Date(d.created_date).toLocaleDateString() : ''})\n${(d.content || d.summary || '').slice(0, 500)}`).join('\n\n')}

Provide: 1) A direct, comprehensive answer with citations, 2) Confidence level (high/medium/low), 3) The sources you drew from, 4) Any caveats or gaps in the available knowledge.`,
        response_json_schema: {
          type: 'object',
          properties: {
            answer: { type: 'string' },
            confidence: { type: 'string' },
            sources: { type: 'array', items: { type: 'string' } },
            caveats: { type: 'array', items: { type: 'string' } },
            follow_up_questions: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 5. GENERATE SUMMARY ─────────────────────────────────────────────────
    if (action === 'generate_summary') {
      const docs = await loadDocs(100);
      const target = document_type
        ? docs.filter(d => d.type === document_type).slice(0, 10)
        : docs.slice(0, 10);

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a comprehensive summary of these ${target.length} organizational documents (type: ${document_type || 'all'}).

Documents:
${target.map(d => `## ${d.title}\n${d.content || d.summary || 'No content'}`).join('\n\n')}

Provide: 1) Executive summary (3-4 sentences), 2) Key insights and patterns, 3) Important decisions or conclusions, 4) Action items and next steps, 5) Gaps or questions raised.`,
        response_json_schema: {
          type: 'object',
          properties: {
            executive_summary: { type: 'string' },
            key_insights: { type: 'array', items: { type: 'string' } },
            decisions_conclusions: { type: 'array', items: { type: 'string' } },
            action_items: { type: 'array', items: { type: 'string' } },
            gaps_questions: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 6. ORGANIZE KNOWLEDGE ────────────────────────────────────────────────
    if (action === 'organize_knowledge') {
      const docs = await loadDocs(200);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze and organize the organizational knowledge base. ${docs.length} documents available.

Documents: ${JSON.stringify(docs.map(d => ({ title: d.title, type: d.type, tags: d.tags, date: d.created_date })))}

Create: 1) Recommended category hierarchy, 2) Suggested taxonomy updates, 3) Documents needing re-tagging, 4) Knowledge coverage map (what's well-documented vs. sparse), 5) Top 5 cross-references to create, 6) Knowledge health score (0-100).`,
        response_json_schema: {
          type: 'object',
          properties: {
            health_score: { type: 'number' },
            category_hierarchy: { type: 'object' },
            taxonomy_updates: { type: 'array', items: { type: 'string' } },
            documents_needing_retagging: { type: 'array', items: { type: 'string' } },
            coverage_map: { type: 'object' },
            cross_references: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 7. LOG DECISION ──────────────────────────────────────────────────────
    if (action === 'log_decision') {
      const { decision_title, what_was_decided, why, alternatives_considered, decision_maker, context, tags } = params;

      const doc = await base44.asServiceRole.entities.Document.create({
        title: `Decision: ${decision_title || 'Untitled Decision'}`,
        type: 'decision_log',
        content: JSON.stringify({
          what: what_was_decided,
          why,
          alternatives: alternatives_considered,
          decision_maker,
          context,
          date: new Date().toISOString(),
          status: 'active'
        }),
        summary: what_was_decided,
        tags: [...(tags || []), 'decision', 'decision_log'],
        source: 'decision_logging',
        created_by: user.email,
        status: 'indexed'
      });

      result = { document_id: doc.id, status: 'decision_logged', decision: doc };
    }

    // ─── 8. GENERATE SOP ──────────────────────────────────────────────────────
    if (action === 'generate_sop') {
      const { process_name, process_description, role, steps_description, compliance_standard } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a comprehensive, professional Standard Operating Procedure (SOP).

Process: ${process_name || 'Unnamed Process'}
Description: ${process_description || ''}
Primary role: ${role || 'all staff'}
Process notes: ${steps_description || ''}
Compliance standard: ${compliance_standard || 'internal'}

Create a complete SOP with: 1) Purpose and scope, 2) Roles and responsibilities, 3) Step-by-step procedure (numbered, clear, actionable), 4) Decision points and conditions, 5) Common errors and how to avoid them, 6) Quality checks and sign-off, 7) Related documents and references, 8) Version and review schedule.`,
        response_json_schema: {
          type: 'object',
          properties: {
            sop_title: { type: 'string' },
            purpose: { type: 'string' },
            scope: { type: 'string' },
            roles: { type: 'array', items: { type: 'object', properties: { role: { type: 'string' }, responsibility: { type: 'string' } } } },
            steps: { type: 'array', items: { type: 'object', properties: { step: { type: 'number' }, title: { type: 'string' }, action: { type: 'string' }, decision_point: { type: 'string' } } } },
            common_errors: { type: 'array', items: { type: 'string' } },
            quality_checks: { type: 'array', items: { type: 'string' } },
            related_documents: { type: 'array', items: { type: 'string' } },
            review_frequency: { type: 'string' }
          }
        }
      });

      // Store as document
      if (result?.sop_title) {
        await base44.asServiceRole.entities.Document.create({
          title: result.sop_title,
          type: 'sop',
          content: JSON.stringify(result),
          summary: result.purpose,
          tags: ['sop', process_name?.toLowerCase().replace(/\s+/g, '_') || 'process', compliance_standard || 'internal'].filter(Boolean),
          status: 'indexed',
          created_by: user.email
        }).catch(() => null);
      }
    }

    // ─── 9. SUMMARIZE MEETING ─────────────────────────────────────────────────
    if (action === 'summarize_meeting') {
      const { meeting_title, raw_notes, attendees, duration_minutes, date } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Transform raw meeting notes into a structured, professional meeting summary.

Meeting: ${meeting_title || 'Team Meeting'}
Date: ${date || new Date().toLocaleDateString()}
Duration: ${duration_minutes || 'unknown'} minutes
Attendees: ${(attendees || []).join(', ') || 'unknown'}

Raw notes:
${raw_notes || '(No notes provided — generate a template structure)'}

Create: 1) One-paragraph executive summary, 2) Key decisions made (each with rationale), 3) Action items (owner, action, due date), 4) Open questions requiring follow-up, 5) Next meeting recommendation, 6) Meeting quality score (0-10) with reasoning.`,
        response_json_schema: {
          type: 'object',
          properties: {
            executive_summary: { type: 'string' },
            decisions: { type: 'array', items: { type: 'object', properties: { decision: { type: 'string' }, rationale: { type: 'string' } } } },
            action_items: { type: 'array', items: { type: 'object', properties: { owner: { type: 'string' }, action: { type: 'string' }, due_date: { type: 'string' } } } },
            open_questions: { type: 'array', items: { type: 'string' } },
            next_meeting: { type: 'string' },
            quality_score: { type: 'number' },
            quality_reasoning: { type: 'string' }
          }
        }
      });

      // Store as meeting document and push action items
      if (result) {
        const doc = await base44.asServiceRole.entities.Document.create({
          title: `Meeting: ${meeting_title || 'Meeting'} — ${new Date().toLocaleDateString()}`,
          type: 'meeting_notes',
          content: JSON.stringify(result),
          summary: result.executive_summary,
          tags: ['meeting', 'minutes', ...(attendees || []).map(a => a.split('@')[0])],
          action_items: result.action_items?.map(a => a.action) || [],
          status: 'indexed',
          created_by: user.email
        }).catch(() => null);

        if (result.action_items?.length) {
          for (const item of result.action_items) {
            await base44.asServiceRole.entities.Task.create({
              title: item.action,
              description: `From meeting: ${meeting_title}. Owner: ${item.owner}`,
              status: 'todo',
              priority: 'medium',
              due_date: item.due_date || null,
              assigned_to: item.owner
            }).catch(() => null);
          }
        }
      }
    }

    // ─── 10. KNOWLEDGE GAP ANALYSIS ──────────────────────────────────────────
    if (action === 'knowledge_gap_analysis') {
      const docs = await loadDocs(200);
      const types = docs.reduce((acc, d) => { acc[d.type || 'other'] = (acc[d.type || 'other'] || 0) + 1; return acc; }, {});

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Identify knowledge gaps in the organizational knowledge base. 

Current document inventory: ${JSON.stringify(types)}
Total documents: ${docs.length}
Most recent: ${docs[0]?.created_date ? new Date(docs[0].created_date).toLocaleDateString() : 'unknown'}
Oldest: ${docs[docs.length - 1]?.created_date ? new Date(docs[docs.length - 1].created_date).toLocaleDateString() : 'unknown'}

For a well-run organization, identify: 1) Critical documentation missing (SOPs, policies, guides), 2) Areas with outdated or sparse documentation, 3) Document types needed for compliance and governance, 4) Topics that should be documented based on business best practice, 5) Priority order for filling gaps. Score the knowledge completeness 0-100.`,
        response_json_schema: {
          type: 'object',
          properties: {
            completeness_score: { type: 'number' },
            critical_gaps: { type: 'array', items: { type: 'object', properties: { area: { type: 'string' }, priority: { type: 'string' }, why_critical: { type: 'string' } } } },
            outdated_areas: { type: 'array', items: { type: 'string' } },
            compliance_gaps: { type: 'array', items: { type: 'string' } },
            recommended_next_docs: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 11. COMPLIANCE PACKAGE ───────────────────────────────────────────────
    if (action === 'compliance_package') {
      const { standard, audit_scope } = params;
      const docs = await loadDocs(200);

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a compliance documentation package for: ${standard || 'NDIS Practice Standards'}.
Audit scope: ${audit_scope || 'full organization'}

Available documents: ${JSON.stringify(docs.map(d => ({ title: d.title, type: d.type, tags: d.tags })))}

Create: 1) Evidence mapping (which documents satisfy which standard requirements), 2) Compliance gap list (requirements not yet evidenced), 3) Document completeness percentage by section, 4) Audit preparation checklist, 5) Risk areas to address before audit.`,
        response_json_schema: {
          type: 'object',
          properties: {
            compliance_percent: { type: 'number' },
            evidence_mapping: { type: 'array', items: { type: 'object', properties: { requirement: { type: 'string' }, evidence_document: { type: 'string' }, status: { type: 'string' } } } },
            gaps: { type: 'array', items: { type: 'object', properties: { requirement: { type: 'string' }, action_needed: { type: 'string' }, priority: { type: 'string' } } } },
            audit_checklist: { type: 'array', items: { type: 'string' } },
            risk_areas: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 12. GENERATE DOCUMENT ────────────────────────────────────────────────
    if (action === 'generate_document') {
      const { document_title, document_type: docType, description, audience, template, tone } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a professional ${docType || 'business document'}: "${document_title || 'Document'}".

Audience: ${audience || 'internal team'}
Brief/description: ${description || ''}
Template/structure requested: ${template || 'standard'}
Tone: ${tone || 'professional'}

Generate: 1) Complete document content, 2) Executive summary, 3) Suggested tags, 4) Document metadata (type, audience, review frequency).`,
        response_json_schema: {
          type: 'object',
          properties: {
            document_title: { type: 'string' },
            executive_summary: { type: 'string' },
            full_content: { type: 'string' },
            sections: { type: 'array', items: { type: 'object', properties: { heading: { type: 'string' }, content: { type: 'string' } } } },
            suggested_tags: { type: 'array', items: { type: 'string' } },
            review_frequency: { type: 'string' }
          }
        }
      });

      // Auto-store
      if (result?.document_title) {
        await base44.asServiceRole.entities.Document.create({
          title: result.document_title,
          type: docType || 'other',
          content: result.full_content,
          summary: result.executive_summary,
          tags: result.suggested_tags || [],
          status: 'indexed',
          created_by: user.email
        }).catch(() => null);
      }
    }

    // ─── 13. EASY READ ────────────────────────────────────────────────────────
    if (action === 'easy_read') {
      const { source_content, source_title, reading_level } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Convert this document into an easy-read format. Target audience: people with cognitive disabilities, low literacy, or those who need plain language.

Source document: "${source_title || 'Document'}"
Reading level target: ${reading_level || 'Grade 6 / Easy Read'}

Content to convert:
${source_content || '(No content provided — create a template showing how to convert a complex policy into easy-read format)'}

Rules for easy-read:
- Short sentences (max 15 words)
- One idea per sentence
- Common words only (avoid jargon)
- Active voice
- Bullet points for lists
- Clear headings
- Suggest where images/icons could support understanding

Output: 1) Easy-read version, 2) Image suggestions (what illustrations would help), 3) Readability score of original vs. new version.`,
        response_json_schema: {
          type: 'object',
          properties: {
            easy_read_content: { type: 'string' },
            image_suggestions: { type: 'array', items: { type: 'object', properties: { location: { type: 'string' }, image_description: { type: 'string' } } } },
            original_reading_level: { type: 'string' },
            new_reading_level: { type: 'string' }
          }
        }
      });
    }

    // ─── 14. EXTRACT ACTION ITEMS ─────────────────────────────────────────────
    if (action === 'extract_action_items') {
      const { source_text, source_title } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract all action items, decisions, and follow-ups from this text. Source: "${source_title || 'Document'}".

Text:
${source_text || '(No text provided)'}

Extract: 1) Action items (who, what, by when), 2) Decisions made, 3) Open questions needing follow-up, 4) Risks identified, 5) Dependencies noted.`,
        response_json_schema: {
          type: 'object',
          properties: {
            action_items: { type: 'array', items: { type: 'object', properties: { owner: { type: 'string' }, action: { type: 'string' }, due_date: { type: 'string' }, priority: { type: 'string' } } } },
            decisions: { type: 'array', items: { type: 'string' } },
            open_questions: { type: 'array', items: { type: 'string' } },
            risks: { type: 'array', items: { type: 'string' } },
            dependencies: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      // Push to Atlas
      if (result?.action_items?.length) {
        for (const item of result.action_items) {
          await base44.asServiceRole.entities.Task.create({
            title: item.action,
            description: `Extracted from: ${source_title}. Owner: ${item.owner}`,
            status: 'todo',
            priority: item.priority || 'medium',
            due_date: item.due_date || null,
            assigned_to: item.owner
          }).catch(() => null);
        }
      }
    }

    // ─── 15. WEEKLY DIGEST ────────────────────────────────────────────────────
    if (action === 'weekly_digest') {
      const docs = await loadDocs(50);
      const recentDocs = docs.filter(d => {
        const created = new Date(d.created_date);
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        return created > weekAgo;
      });

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a weekly knowledge digest for the organization. 

This week: ${recentDocs.length} new documents added out of ${docs.length} total.
New documents: ${recentDocs.map(d => `"${d.title}" (${d.type})`).join(', ')}

Create: 1) This week's knowledge highlights (top 5 things documented), 2) Important decisions recorded, 3) New SOPs or guides created, 4) Knowledge gaps identified this week, 5) Recommended reading for each department, 6) Next week's documentation priorities.`,
        response_json_schema: {
          type: 'object',
          properties: {
            highlights: { type: 'array', items: { type: 'string' } },
            decisions_recorded: { type: 'array', items: { type: 'string' } },
            new_sops: { type: 'array', items: { type: 'string' } },
            gaps_identified: { type: 'array', items: { type: 'string' } },
            recommended_reading: { type: 'object' },
            next_week_priorities: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 16. KNOWLEDGE HEALTH ─────────────────────────────────────────────────
    if (action === 'knowledge_health') {
      const docs = await loadDocs(200);
      const types = docs.reduce((acc, d) => { acc[d.type || 'other'] = (acc[d.type || 'other'] || 0) + 1; return acc; }, {});
      const withContent = docs.filter(d => d.content || d.summary).length;
      const withTags = docs.filter(d => d.tags?.length > 0).length;
      const recentlyUpdated = docs.filter(d => d.updated_date && new Date(d.updated_date) > new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)).length;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Score and assess the health of the organizational knowledge base.

Stats: ${docs.length} total documents, ${withContent} with content (${Math.round(withContent/docs.length*100||0)}%), ${withTags} with tags (${Math.round(withTags/docs.length*100||0)}%), ${recentlyUpdated} updated in last 90 days.
Distribution: ${JSON.stringify(types)}

Assess: 1) Overall knowledge health score (0-100), 2) Strengths, 3) Critical weaknesses, 4) Staleness risk (documents not updated in >6 months), 5) Top 5 improvement recommendations, 6) Benchmark against best-practice knowledge management.`,
        response_json_schema: {
          type: 'object',
          properties: {
            health_score: { type: 'number' },
            grade: { type: 'string' },
            strengths: { type: 'array', items: { type: 'string' } },
            weaknesses: { type: 'array', items: { type: 'string' } },
            staleness_risk: { type: 'string' },
            improvements: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 17. LESSONS LEARNED ──────────────────────────────────────────────────
    if (action === 'lessons_learned') {
      const { project_context, topic } = params;
      const docs = await loadDocs(100);
      const relevant = docs.filter(d =>
        topic ? (d.tags || []).some(t => t.toLowerCase().includes(topic.toLowerCase())) ||
          (d.title || '').toLowerCase().includes(topic.toLowerCase()) : true
      ).slice(0, 15);

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Surface relevant lessons learned for: "${project_context || topic || 'new project'}".

Searching across ${relevant.length} relevant documents:
${relevant.map(d => `- "${d.title}" (${d.type}): ${(d.summary || d.content || '').slice(0, 200)}`).join('\n')}

Extract: 1) Key lessons from past similar work, 2) Common mistakes to avoid, 3) What worked well that should be repeated, 4) Processes or approaches that failed, 5) Recommendations for this new context.`,
        response_json_schema: {
          type: 'object',
          properties: {
            key_lessons: { type: 'array', items: { type: 'object', properties: { lesson: { type: 'string' }, source: { type: 'string' }, applicability: { type: 'string' } } } },
            mistakes_to_avoid: { type: 'array', items: { type: 'string' } },
            what_worked: { type: 'array', items: { type: 'string' } },
            what_failed: { type: 'array', items: { type: 'string' } },
            recommendations: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 18. AUDIT TRAIL ──────────────────────────────────────────────────────
    if (action === 'audit_trail') {
      const { entity_type, date_from, date_to } = params;
      const docs = await loadDocs(200);
      const auditDocs = docs.filter(d => {
        const typeMatch = entity_type ? (d.type || '').includes(entity_type) || (d.tags || []).includes(entity_type) : true;
        const dateMatch = date_from ? new Date(d.created_date) >= new Date(date_from) : true;
        return typeMatch && dateMatch;
      });

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate an audit trail report for: ${entity_type || 'all activities'}. Period: ${date_from || 'all time'} to ${date_to || 'now'}.

Documents in scope: ${auditDocs.length}
${auditDocs.slice(0, 30).map(d => `- [${new Date(d.created_date).toLocaleDateString()}] "${d.title}" by ${d.created_by || 'unknown'} | Type: ${d.type}`).join('\n')}

Generate: 1) Chronological activity log, 2) Key decisions made in period, 3) Document changes and versions, 4) Compliance-relevant actions, 5) Any anomalies or gaps in the record.`,
        response_json_schema: {
          type: 'object',
          properties: {
            period: { type: 'string' },
            total_activities: { type: 'number' },
            activity_log: { type: 'array', items: { type: 'object', properties: { date: { type: 'string' }, action: { type: 'string' }, actor: { type: 'string' }, document: { type: 'string' } } } },
            key_decisions: { type: 'array', items: { type: 'string' } },
            anomalies: { type: 'array', items: { type: 'string' } },
            compliance_summary: { type: 'string' }
          }
        }
      });
    }

    // ─── 19. SYNTHESIZE KNOWLEDGE ────────────────────────────────────────────
    if (action === 'synthesize_knowledge') {
      const { topic, question, depth } = params;
      const docs = await loadDocs(100);
      const relevant = docs.filter(d =>
        (d.tags || []).some(t => t.toLowerCase().includes((topic || '').toLowerCase())) ||
        (d.title || '').toLowerCase().includes((topic || '').toLowerCase()) ||
        (d.summary || '').toLowerCase().includes((topic || '').toLowerCase())
      ).slice(0, 20);

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Synthesize everything the organization knows about: "${topic}". ${question ? `Specific question: ${question}` : ''}

Drawing from ${relevant.length} relevant documents:
${relevant.map(d => `### ${d.title} (${d.type}, ${d.created_date ? new Date(d.created_date).toLocaleDateString() : ''})\n${(d.content || d.summary || '').slice(0, 400)}`).join('\n\n')}

Depth: ${depth || 'comprehensive'}

Produce: 1) Complete synthesis of organizational knowledge on this topic, 2) Timeline of how thinking/approach evolved, 3) Current state and consensus, 4) Unresolved tensions or open questions, 5) Key sources to review.`,
        response_json_schema: {
          type: 'object',
          properties: {
            synthesis: { type: 'string' },
            evolution_timeline: { type: 'array', items: { type: 'object', properties: { period: { type: 'string' }, state: { type: 'string' } } } },
            current_state: { type: 'string' },
            open_questions: { type: 'array', items: { type: 'string' } },
            key_sources: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 20. FORMAL MINUTES ───────────────────────────────────────────────────
    if (action === 'formal_minutes') {
      const { raw_notes, meeting_title, date, attendees, chair, secretary } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Convert raw meeting notes into formal board/committee meeting minutes.

Meeting: ${meeting_title || 'Board Meeting'}
Date: ${date || new Date().toLocaleDateString()}
Chair: ${chair || 'unknown'}
Secretary: ${secretary || user.full_name}
Attendees: ${(attendees || []).join(', ')}

Raw notes:
${raw_notes || '(No notes provided)'}

Create formal minutes in standard governance format: 1) Opening and quorum, 2) Agenda items (each with discussion summary and resolution), 3) Motions passed (with mover, seconder, vote), 4) Action items with owners and deadlines, 5) Next meeting details, 6) Closure statement.`,
        response_json_schema: {
          type: 'object',
          properties: {
            formal_minutes: { type: 'string' },
            motions_passed: { type: 'array', items: { type: 'object', properties: { motion: { type: 'string' }, mover: { type: 'string' }, seconder: { type: 'string' }, outcome: { type: 'string' } } } },
            action_items: { type: 'array', items: { type: 'object', properties: { owner: { type: 'string' }, action: { type: 'string' }, deadline: { type: 'string' } } } },
            next_meeting: { type: 'string' }
          }
        }
      });
    }


    // 21. UNIVERSAL CAPTURE HUB
    if (action === 'universal_capture_hub') {
      const docs = await loadDocs(200);
      const byType = docs.reduce((acc, d) => { const t = d.type || 'other'; acc[t] = (acc[t] || 0) + 1; return acc; }, {});
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Build a universal capture status brief for Scribe.

Total docs: ${docs.length}
Distribution: ${JSON.stringify(byType)}

Return:
1) ingestion coverage by source/type
2) gaps in capture streams
3) immediate improvements for ingestion reliability
4) recommended ingestion policy updates`,
        response_json_schema: {
          type: 'object',
          properties: {
            coverage_summary: { type: 'string' },
            source_coverage: { type: 'array', items: { type: 'object', properties: { source: { type: 'string' }, status: { type: 'string' }, notes: { type: 'string' } } } },
            capture_gaps: { type: 'array', items: { type: 'string' } },
            recommended_updates: { type: 'array', items: { type: 'string' } },
          },
        },
      });
    }

    // 22. KNOWLEDGE GRAPH MAP
    if (action === 'knowledge_graph_map') {
      const docs = await loadDocs(120);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a practical knowledge graph map from organizational documents.

Documents: ${JSON.stringify(docs.slice(0, 80).map(d => ({ title: d.title, type: d.type, tags: d.tags || [] })))}

Return:
1) key entities (projects, people, decisions, processes)
2) highest-value relationships
3) missing links to create
4) priority graph expansion plan`,
        response_json_schema: {
          type: 'object',
          properties: {
            entities: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, kind: { type: 'string' } } } },
            relationships: { type: 'array', items: { type: 'object', properties: { from: { type: 'string' }, to: { type: 'string' }, relation: { type: 'string' } } } },
            missing_links: { type: 'array', items: { type: 'string' } },
            expansion_plan: { type: 'array', items: { type: 'string' } },
          },
        },
      });
    }

    // 23. EXPERTISE LOCATOR
    if (action === 'expertise_locator') {
      const topic = params.topic || 'operations';
      const docs = await loadDocs(200);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Find likely internal experts for topic: "${topic}".

Docs sample: ${JSON.stringify(docs.map(d => ({ title: d.title, tags: d.tags || [], created_by: d.created_by || 'unknown' })))}

Rank top experts by relevance and supporting evidence from authored or tagged documents.`,
        response_json_schema: {
          type: 'object',
          properties: {
            topic: { type: 'string' },
            experts: { type: 'array', items: { type: 'object', properties: { person: { type: 'string' }, confidence: { type: 'string' }, evidence: { type: 'array', items: { type: 'string' } } } } },
            collaboration_recommendations: { type: 'array', items: { type: 'string' } },
          },
        },
      });
    }

    // 24. DECISION RATIONALE TRACKER
    if (action === 'decision_rationale_tracker') {
      const docs = await loadDocs(200);
      const decisionDocs = docs.filter(d => d.type === 'decision_log' || (d.tags || []).includes('decision')).slice(0, 80);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze decision logs and rationale quality.

Decision docs: ${JSON.stringify(decisionDocs.map(d => ({ title: d.title, summary: d.summary, content: (d.content || '').slice(0, 300) })))}

Return:
1) rationale quality score
2) decisions missing assumptions/alternatives
3) follow-up impact tracking plan
4) governance improvements`,
        response_json_schema: {
          type: 'object',
          properties: {
            rationale_quality_score: { type: 'number' },
            weak_decisions: { type: 'array', items: { type: 'string' } },
            impact_tracking_plan: { type: 'array', items: { type: 'string' } },
            governance_improvements: { type: 'array', items: { type: 'string' } },
          },
        },
      });
    }

    // 25. SOP VERSION GUARD
    if (action === 'sop_version_guard') {
      const docs = await loadDocs(200);
      const sops = docs.filter(d => d.type === 'sop');
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Run SOP version guard.

SOP docs: ${JSON.stringify(sops.map(s => ({ title: s.title, version: s.version || 'unknown', updated_date: s.updated_date, tags: s.tags || [] })))}

Return stale SOPs, duplication risk, missing owners, and update priority queue.`,
        response_json_schema: {
          type: 'object',
          properties: {
            stale_sops: { type: 'array', items: { type: 'string' } },
            duplication_risks: { type: 'array', items: { type: 'string' } },
            missing_owners: { type: 'array', items: { type: 'string' } },
            update_priority_queue: { type: 'array', items: { type: 'string' } },
          },
        },
      });
    }

    // 26. PROACTIVE KNOWLEDGE DELIVERY
    if (action === 'proactive_knowledge_delivery') {
      const task_context = params.task_context || 'new strategic initiative';
      const docs = await loadDocs(120);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Prepare proactive knowledge delivery pack for task context: "${task_context}".

Docs sample: ${JSON.stringify(docs.map(d => ({ title: d.title, type: d.type, summary: (d.summary || '').slice(0, 120), tags: d.tags || [] })))}

Return:
1) top references to review first
2) prior decisions to reuse
3) known pitfalls
4) fast-start checklist`,
        response_json_schema: {
          type: 'object',
          properties: {
            priority_references: { type: 'array', items: { type: 'string' } },
            prior_decisions: { type: 'array', items: { type: 'string' } },
            pitfalls: { type: 'array', items: { type: 'string' } },
            fast_start_checklist: { type: 'array', items: { type: 'string' } },
          },
        },
      });
    }

    // 27. GOVERNANCE GUARD
    if (action === 'governance_guard') {
      const docs = await loadDocs(200);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Run knowledge governance guardrail review.

Documents: ${docs.length}

Assess:
1) access sensitivity categories
2) PII/redaction risk indicators
3) retention policy candidates
4) legal-hold readiness
5) audit trail completeness`,
        response_json_schema: {
          type: 'object',
          properties: {
            sensitivity_classes: { type: 'array', items: { type: 'string' } },
            pii_risks: { type: 'array', items: { type: 'string' } },
            retention_recommendations: { type: 'array', items: { type: 'string' } },
            legal_hold_readiness: { type: 'string' },
            audit_trail_score: { type: 'number' },
          },
        },
      });
    }

    // 28. KNOWLEDGE VELOCITY REPORT
    if (action === 'knowledge_velocity_report') {
      const docs = await loadDocs(300);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate knowledge velocity report.

Documents (recent sample): ${JSON.stringify(docs.slice(0, 120).map(d => ({ title: d.title, type: d.type, created_date: d.created_date, updated_date: d.updated_date })))}

Provide:
1) capture-to-index timeliness estimate
2) freshness trend
3) bottlenecks
4) weekly throughput targets`,
        response_json_schema: {
          type: 'object',
          properties: {
            velocity_score: { type: 'number' },
            freshness_trend: { type: 'string' },
            bottlenecks: { type: 'array', items: { type: 'string' } },
            throughput_targets: { type: 'array', items: { type: 'string' } },
          },
        },
      });
    }

    // 29. SCRIBE FULL SELF TEST
    if (action === 'scribe_full_self_test') {
      const [health, digest, gaps, synth, governance] = await Promise.all([
        base44.functions.invoke('scribeKnowledgeBase', { action: 'knowledge_health' }).then((r: any) => r.data?.result).catch(() => null),
        base44.functions.invoke('scribeKnowledgeBase', { action: 'weekly_digest' }).then((r: any) => r.data?.result).catch(() => null),
        base44.functions.invoke('scribeKnowledgeBase', { action: 'knowledge_gap_analysis' }).then((r: any) => r.data?.result).catch(() => null),
        base44.functions.invoke('scribeKnowledgeBase', { action: 'synthesize_knowledge', params: { topic: 'strategy' } }).then((r: any) => r.data?.result).catch(() => null),
        base44.functions.invoke('scribeKnowledgeBase', { action: 'governance_guard' }).then((r: any) => r.data?.result).catch(() => null),
      ]);

      result = {
        health,
        digest,
        gaps,
        synth,
        governance,
        checks: {
          health_ok: Boolean(health),
          digest_ok: Boolean(digest),
          gaps_ok: Boolean(gaps),
          synth_ok: Boolean(synth),
          governance_ok: Boolean(governance),
        },
      };
    }
    if (!result) {
      result = { message: `Action '${action}' received. Available: store_document, ingest_file, semantic_search, question_answer, generate_summary, organize_knowledge, log_decision, generate_sop, summarize_meeting, knowledge_gap_analysis, compliance_package, generate_document, easy_read, extract_action_items, weekly_digest, knowledge_health, lessons_learned, audit_trail, synthesize_knowledge, formal_minutes, universal_capture_hub, knowledge_graph_map, expertise_locator, decision_rationale_tracker, sop_version_guard, proactive_knowledge_delivery, governance_guard, knowledge_velocity_report, scribe_full_self_test` };
    }

    return Response.json({ status: 'scribe_action_complete', action, result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

