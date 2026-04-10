import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { document_url, participant_id, document_type } = payload;

    // document_type: 'ndis_plan', 'service_agreement', 'id_document'

    // Use LLM to extract data from document (simulating OCR output)
    const extractionResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `Extract key data from this ${document_type} document. 
Document URL: ${document_url}

For NDIS plans, extract:
- Participant name, NDIS number
- Plan start/end dates
- Total funding amount
- Funding by category (core, capacity building, capital)
- List of support items and budgets
- Plan nominee details (if visible)
- Plan manager details (if visible)

For service agreements, extract:
- Service provider name
- Agreement dates
- Services to be provided
- Payment terms
- Cancellation clauses

For ID documents, extract:
- Document type
- Issue/expiry dates

Return extracted fields with confidence scores.`,
      response_json_schema: {
        type: 'object',
        properties: {
          extracted_fields: {
            type: 'object'
          },
          confidence_overall: {
            type: 'number'
          },
          warnings: {
            type: 'array',
            items: {
              type: 'string'
            }
          },
          requires_manual_review: {
            type: 'boolean'
          }
        }
      }
    });

    // Create or update NDISPlan record
    let plan = null;
    if (document_type === 'ndis_plan') {
      plan = await base44.asServiceRole.entities.NDISPlan.create({
        participant_id,
        ndis_number: extractionResponse.extracted_fields.ndis_number || '',
        plan_start_date: extractionResponse.extracted_fields.plan_start_date,
        plan_end_date: extractionResponse.extracted_fields.plan_end_date,
        total_annual_funding: extractionResponse.extracted_fields.total_funding || 0,
        funding_by_category: extractionResponse.extracted_fields.funding_by_category || {},
        goals: extractionResponse.extracted_fields.goals || [],
        support_items: extractionResponse.extracted_fields.support_items || [],
        plan_nominee: extractionResponse.extracted_fields.plan_nominee,
        plan_manager: extractionResponse.extracted_fields.plan_manager,
        document_source: 'pdf_extracted',
        extraction_confidence: extractionResponse.confidence_overall,
        last_verified: new Date().toISOString()
      });
    }

    // If confidence is low or warnings exist, create task for human review
    if (extractionResponse.requires_manual_review || extractionResponse.confidence_overall < 80) {
      await base44.asServiceRole.entities.Task.create({
        title: `Manual review: ${document_type} extraction for participant ${participant_id}`,
        description: `Confidence: ${extractionResponse.confidence_overall}%. Warnings: ${extractionResponse.warnings.join(', ')}`,
        status: 'pending',
        priority: 'high',
        source: 'system',
        source_id: participant_id,
        tags: ['document_extraction', 'manual_review']
      });
    }

    // Log activity
    await base44.asServiceRole.entities.Activity.create({
      type: 'document_extracted',
      title: `${document_type} extracted for ${participant_id}`,
      description: `Confidence: ${extractionResponse.confidence_overall}%`,
      entity_type: 'NDISPlan',
      entity_id: plan?.id || participant_id
    });

    return Response.json({
      status: 'extraction_complete',
      participant_id,
      document_type,
      plan_id: plan?.id,
      extracted_fields: extractionResponse.extracted_fields,
      confidence: extractionResponse.confidence_overall,
      requires_review: extractionResponse.requires_manual_review,
      warnings: extractionResponse.warnings
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});