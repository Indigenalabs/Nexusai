import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const { action, params = {} } = payload;

    // Legacy field support
    const industry = payload.industry || params.industry || 'general business';
    const compliance_area = payload.compliance_area || params.compliance_area || '';
    const target = payload.target || params.target || '';

    let result = null;

    const loadDocs = () => base44.asServiceRole.entities.Document.list('-created_date', 50).catch(() => []);
    const loadTasks = () => base44.asServiceRole.entities.Task.list('-created_date', 30).catch(() => []);
    const loadPartners = () => base44.asServiceRole.entities.Partner.list('-created_date', 20).catch(() => []);
    const loadVendors = () => base44.asServiceRole.entities.Vendor.list('-created_date', 20).catch(() => []);

    // ─── 1. GENERATE CONTRACT ───────────────────────────────────────────────
    if (action === 'generate_contract') {
      const { contract_type, party_a, party_b, key_terms, jurisdiction, special_provisions } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a professional, legally sound contract draft.

Contract type: ${contract_type || 'NDA/Mutual Non-Disclosure Agreement'}
Party A: ${party_a || 'Company (us)'}
Party B: ${party_b || target || 'Counterparty'}
Key terms: ${key_terms || 'standard terms'}
Jurisdiction: ${jurisdiction || 'Australia (general common law)'}
Special provisions: ${special_provisions || 'none'}

Generate a complete contract including:
1. **Parties**: full legal names, addresses, recitals
2. **Definitions**: all defined terms
3. **Core provisions**: the main obligations of each party
4. **Term and termination**: duration, renewal, termination triggers and consequences
5. **Representations and warranties**: what each party is warranting
6. **Liability and indemnification**: caps, carve-outs, mutual vs. one-sided
7. **Confidentiality**: if not the primary subject
8. **Intellectual property**: ownership, licenses, work-for-hire
9. **Dispute resolution**: governing law, jurisdiction, arbitration or litigation
10. **General provisions**: force majeure, severability, entire agreement, notices
11. **Signature blocks**

For each key clause, provide a brief plain-language explanation of what it means.
Flag any clauses that deviate from market standard and explain why.`,
        response_json_schema: {
          type: 'object',
          properties: {
            contract_title: { type: 'string' },
            contract_draft: { type: 'string' },
            key_clause_summaries: { type: 'array', items: { type: 'object', properties: {
              clause: { type: 'string' }, plain_language: { type: 'string' }, risk_note: { type: 'string' }
            }}},
            negotiation_notes: { type: 'array', items: { type: 'string' } },
            missing_provisions_to_consider: { type: 'array', items: { type: 'string' } },
            jurisdiction_specific_notes: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      await base44.asServiceRole.entities.Document.create({
        title: `${contract_type || 'Contract'} — ${party_b || target || 'Draft'}`,
        type: 'contract',
        content: result?.contract_draft?.slice(0, 5000) || '',
        status: 'draft'
      }).catch(() => null);
    }

    // ─── 2. REVIEW CONTRACT ─────────────────────────────────────────────────
    if (action === 'review_contract') {
      const { contract_text, contract_type, counterparty, our_position } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Review and analyze a contract for legal risk and compliance.

Contract type: ${contract_type || 'commercial agreement'}
Counterparty: ${counterparty || target || 'third party'}
Our position: ${our_position || 'buyer/service recipient'}
Contract text: ${contract_text || 'See description above'}

Comprehensive contract review:

1. **Executive Summary**: What is this contract? What does it commit us to? One paragraph.

2. **Risk-Rated Clause Analysis**: For each significant clause, rate it:
   - 🔴 CRITICAL: Must change before signing
   - 🟡 HIGH: Should negotiate, material risk if accepted
   - 🟢 LOW: Note for awareness, acceptable as-is

3. **Critical Issues** (blocking):
   - What MUST change before we can sign?
   - Specific clause reference and alternative language

4. **Key Obligations Extracted**:
   - What do WE have to do? (deliverables, payments, reporting, restrictions)
   - What do THEY have to do?
   - Important deadlines and milestones

5. **Missing Provisions**: What's not in this contract that should be?

6. **Liability Exposure**: Cap, carve-outs, indemnification — what's our worst-case exposure?

7. **Intellectual Property**: Who owns what is created? Any license grants?

8. **Termination Rights**: How can each party get out? What are the consequences?

9. **Negotiation Strategy**: What's our opening position? What can we concede? What's our walk-away?

10. **Recommendation**: SIGN / NEGOTIATE / DO NOT SIGN — with specific conditions.`,
        response_json_schema: {
          type: 'object',
          properties: {
            executive_summary: { type: 'string' },
            recommendation: { type: 'string' },
            recommendation_conditions: { type: 'array', items: { type: 'string' } },
            critical_issues: { type: 'array', items: { type: 'object', properties: {
              clause: { type: 'string' }, issue: { type: 'string' }, risk: { type: 'string' }, alternative_language: { type: 'string' }
            }}},
            high_risk_clauses: { type: 'array', items: { type: 'object', properties: {
              clause: { type: 'string' }, concern: { type: 'string' }, suggested_position: { type: 'string' }
            }}},
            key_obligations_ours: { type: 'array', items: { type: 'string' } },
            key_obligations_theirs: { type: 'array', items: { type: 'string' } },
            important_deadlines: { type: 'array', items: { type: 'string' } },
            missing_provisions: { type: 'array', items: { type: 'string' } },
            liability_exposure: { type: 'string' },
            ip_summary: { type: 'string' },
            termination_summary: { type: 'string' },
            negotiation_strategy: { type: 'string' }
          }
        }
      });
    }

    // ─── 3. CLAUSE ANALYSIS ─────────────────────────────────────────────────
    if (action === 'clause_analysis') {
      const { clause_text, clause_type, contract_context } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze a specific contract clause for risk and suggest improvements.

Clause: ${clause_text || target}
Clause type: ${clause_type || 'general commercial'}
Contract context: ${contract_context || 'commercial services agreement'}

Analysis:
1. **Plain language translation**: what does this clause actually mean?
2. **Risk assessment**: what's the risk if this clause stands as-is?
3. **Market standard comparison**: is this clause market standard, favorable, or unfavorable?
4. **Specific risks**: what scenarios could make this clause costly or problematic?
5. **Alternative language** (3 options): aggressive / balanced / conservative positions
6. **Fallback position**: minimum we should accept
7. **What to watch for**: related clauses elsewhere that interact with this one`,
        response_json_schema: {
          type: 'object',
          properties: {
            plain_language: { type: 'string' },
            risk_level: { type: 'string' },
            market_standard_assessment: { type: 'string' },
            specific_risks: { type: 'array', items: { type: 'string' } },
            alternative_language: { type: 'array', items: { type: 'object', properties: {
              position: { type: 'string' }, language: { type: 'string' }, rationale: { type: 'string' }
            }}},
            fallback_minimum: { type: 'string' },
            related_clauses_to_check: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 4. NEGOTIATION SUPPORT ────────────────────────────────────────────
    if (action === 'negotiation_support') {
      const { disputed_points, our_priorities, counterparty_position, deal_context } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Provide strategic contract negotiation support.

Deal: ${deal_context || target}
Our priorities: ${our_priorities || 'protect liability, IP ownership, termination rights'}
Counterparty's position: ${counterparty_position || 'as described'}
Disputed points: ${disputed_points || 'multiple commercial terms'}

Negotiation playbook:
1. **Rank our priorities**: which issues are must-wins, nice-to-haves, and concessions?
2. **Counterparty analysis**: what are their likely priorities and pressure points?
3. **Trade-off matrix**: what can we give up to get what we need?
4. **Issue-by-issue strategy**: for each disputed point — opening position, target, walk-away
5. **Proposed compromise language**: for each key issue, draft compromise language
6. **Escalation triggers**: what would make us walk away from the deal?
7. **Closing tactics**: how to move toward signature once aligned on key issues
8. **Redline summary**: what changes to propose in our next redline`,
        response_json_schema: {
          type: 'object',
          properties: {
            must_wins: { type: 'array', items: { type: 'string' } },
            concessions_available: { type: 'array', items: { type: 'string' } },
            issue_strategies: { type: 'array', items: { type: 'object', properties: {
              issue: { type: 'string' }, our_opening: { type: 'string' }, target: { type: 'string' }, walk_away: { type: 'string' }
            }}},
            compromise_language: { type: 'array', items: { type: 'object', properties: {
              issue: { type: 'string' }, proposed_language: { type: 'string' }
            }}},
            escalation_triggers: { type: 'array', items: { type: 'string' } },
            redline_summary: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 5. PRIVACY POLICY ─────────────────────────────────────────────────
    if (action === 'privacy_policy') {
      const { business_description, data_collected, jurisdictions, services } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a comprehensive, legally compliant privacy policy.

Business: ${business_description || target || 'digital business'}
Data collected: ${data_collected || 'names, emails, payment data, usage analytics'}
Jurisdictions: ${jurisdictions || 'Australia, potentially EU (GDPR), US (CCPA)'}
Services: ${services || 'web application, email marketing'}

Generate a complete privacy policy covering:
1. **Introduction and scope**
2. **What data we collect** (first-party, third-party, automatically collected)
3. **How we use data** (each purpose with legal basis under GDPR)
4. **How we share data** (third parties, categories, safeguards)
5. **Data retention** (how long we keep each type)
6. **Your rights** (GDPR: access, rectification, deletion, portability, objection; CCPA: opt-out)
7. **Cookies and tracking** (types, purposes, controls)
8. **Data security** (measures taken)
9. **International transfers** (if applicable)
10. **Children's privacy** (COPPA if applicable)
11. **Changes to this policy**
12. **Contact information and DPO details**

Write in plain, accessible language. Flag any provisions that need legal review before publishing.`,
        response_json_schema: {
          type: 'object',
          properties: {
            policy_text: { type: 'string' },
            gdpr_legal_bases: { type: 'array', items: { type: 'object', properties: { purpose: { type: 'string' }, legal_basis: { type: 'string' } } } },
            data_inventory: { type: 'array', items: { type: 'object', properties: { data_type: { type: 'string' }, purpose: { type: 'string' }, retention: { type: 'string' } } } },
            requires_legal_review: { type: 'array', items: { type: 'string' } },
            missing_disclosures: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      await base44.asServiceRole.entities.Document.create({
        title: `Privacy Policy — ${new Date().toISOString().split('T')[0]}`,
        type: 'other',
        content: result?.policy_text?.slice(0, 5000) || '',
        status: 'draft'
      }).catch(() => null);
    }

    // ─── 6. RISK ASSESSMENT ────────────────────────────────────────────────
    if (action === 'risk_assessment') {
      const { initiative_description, business_context, jurisdiction } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Perform a comprehensive legal risk assessment.

Initiative/Decision: ${initiative_description || target}
Business context: ${business_context || industry}
Jurisdiction: ${jurisdiction || 'Australia, with consideration of international reach'}

Legal risk assessment:

1. **Regulatory Risk**: What regulations apply? Are we compliant? What's the exposure if not?
   - Data privacy (GDPR, Privacy Act, CCPA)
   - Industry-specific regulation
   - Consumer protection and advertising standards
   - Employment law implications

2. **Contractual Risk**: What contract obligations does this create or affect?
   - Existing contracts that may be impacted
   - New contracts needed
   - Breach risk

3. **Intellectual Property Risk**: IP implications of this initiative?
   - IP we're creating (who owns it?)
   - IP we're using (do we have rights?)
   - Infringement risk

4. **Liability Exposure**: What's our worst-case legal exposure?
   - Direct liability
   - Third-party claims
   - Regulatory penalties

5. **Employment Law Risk**: Any employment implications?

6. **Reputational/Ethical Risk**: Legal-adjacent risks to reputation

7. **Risk Matrix**: Rate each risk by Likelihood × Impact (Critical / High / Medium / Low)

8. **Mitigation Measures**: For each significant risk, what mitigations should we implement?

9. **Go/No-Go Recommendation**: Should we proceed? Proceed with conditions? Or not proceed?
   - If proceed: required conditions
   - If not proceed: what would change the recommendation`,
        response_json_schema: {
          type: 'object',
          properties: {
            recommendation: { type: 'string' },
            recommendation_rationale: { type: 'string' },
            conditions_to_proceed: { type: 'array', items: { type: 'string' } },
            risk_matrix: { type: 'array', items: { type: 'object', properties: {
              risk_area: { type: 'string' }, description: { type: 'string' }, likelihood: { type: 'string' }, impact: { type: 'string' }, rating: { type: 'string' }, mitigation: { type: 'string' }
            }}},
            regulatory_analysis: { type: 'string' },
            contractual_analysis: { type: 'string' },
            ip_analysis: { type: 'string' },
            liability_exposure: { type: 'string' },
            immediate_actions: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 7. COMPLIANCE GAP ANALYSIS ────────────────────────────────────────
    if (action === 'compliance_gap' || action === 'audit_compliance') {
      const { frameworks, business_type } = params;
      const docs = await loadDocs();

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Perform a compliance gap analysis.

Industry: ${industry}
Business type: ${business_type || target || 'digital services business'}
Applicable frameworks: ${frameworks || 'GDPR, Australian Privacy Act, consumer law, employment law'}
Documents on file (${docs.length}): ${JSON.stringify(docs.slice(0, 15).map(d => ({ title: d.title, type: d.type, status: d.status })))}

Compliance gap analysis:

For each applicable regulatory area:
1. **Required**: what the regulation requires
2. **Current state**: what we likely have in place (based on document library)
3. **Gap**: what's missing or insufficient
4. **Risk**: what's the exposure if we don't fix it?
5. **Remediation**: what to do, with effort estimate (hours/days)
6. **Priority**: Critical / High / Medium / Low

Areas to assess:
- Data privacy and protection (GDPR/Privacy Act/CCPA)
- Marketing and advertising compliance (CAN-SPAM, anti-spam, claims)
- Consumer protection and terms of service
- Employment law (contracts, leave, classification)
- Financial and invoicing requirements
- IP and content licensing
- Cybersecurity and data breach obligations
- Industry-specific requirements

Overall compliance score (0-100) and top 5 priority actions.`,
        response_json_schema: {
          type: 'object',
          properties: {
            compliance_score: { type: 'number' },
            areas_compliant: { type: 'array', items: { type: 'string' } },
            gaps: { type: 'array', items: { type: 'object', properties: {
              area: { type: 'string' }, requirement: { type: 'string' }, current_state: { type: 'string' }, gap: { type: 'string' }, risk: { type: 'string' }, remediation: { type: 'string' }, effort: { type: 'string' }, priority: { type: 'string' }
            }}},
            critical_gaps: { type: 'array', items: { type: 'string' } },
            top_5_actions: { type: 'array', items: { type: 'string' } },
            remediation_priority: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 8. REGULATORY MONITOR ─────────────────────────────────────────────
    if (action === 'regulatory_monitor' || action === 'impact_assessment') {
      const { regulation_name, jurisdiction } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Monitor and assess regulatory changes relevant to the business.

Business: ${industry}
Regulation/Change to assess: ${regulation_name || target || 'recent regulatory developments'}
Jurisdiction: ${jurisdiction || 'Australia, EU, US'}

Regulatory intelligence report:
1. **Recent and upcoming regulatory changes** relevant to this business type
2. **For each change**:
   - What changed or is changing
   - Effective date
   - Who is affected
   - Impact on our business (operations, products, contracts, marketing)
   - Required actions and timeline
   - Penalty for non-compliance
3. **Priority ranking** of changes requiring action
4. **Regulatory calendar**: key compliance dates in the next 12 months
5. **Emerging trends**: regulatory directions we should prepare for
6. **Action plan**: specific steps to take this quarter`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            regulatory_changes: { type: 'array', items: { type: 'object', properties: {
              regulation: { type: 'string' },
              jurisdiction: { type: 'string' },
              what_changed: { type: 'string' },
              effective_date: { type: 'string' },
              business_impact: { type: 'string' },
              required_actions: { type: 'array', items: { type: 'string' } },
              penalty: { type: 'string' },
              priority: { type: 'string' }
            }}},
            compliance_calendar: { type: 'array', items: { type: 'object', properties: {
              date: { type: 'string' }, obligation: { type: 'string' }, jurisdiction: { type: 'string' }
            }}},
            emerging_trends: { type: 'array', items: { type: 'string' } },
            quarterly_action_plan: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 9. DSAR HANDLING ──────────────────────────────────────────────────
    if (action === 'dsar_handling') {
      const { request_type, requester_info, data_held } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Handle a Data Subject Access Request (DSAR) or other privacy rights request.

Request type: ${request_type || 'access request'}
Requester: ${requester_info || target || 'data subject'}
Data we may hold: ${data_held || 'customer account data, transaction history, communications'}

DSAR response plan:
1. **Verify the request**: is it valid? Identity verification requirements.
2. **Applicable law**: GDPR / Privacy Act / CCPA — which applies? What are the timeframes?
3. **Response deadline**: when must we respond?
4. **Data search plan**: where to look, what systems to check, what data to compile
5. **Data to provide**: what must be included in the response?
6. **Data to redact/withhold**: exemptions that apply (third-party data, legal privilege, etc.)
7. **Response letter draft**: complete draft response letter to the requester
8. **If deletion request**: data to delete, data we can legally retain, retention justifications
9. **Record-keeping**: what to log for compliance purposes
10. **Edge cases**: anything unusual about this request that needs special handling`,
        response_json_schema: {
          type: 'object',
          properties: {
            request_validity: { type: 'string' },
            applicable_law: { type: 'string' },
            response_deadline_days: { type: 'number' },
            data_search_plan: { type: 'array', items: { type: 'string' } },
            data_to_provide: { type: 'array', items: { type: 'string' } },
            data_to_withhold: { type: 'array', items: { type: 'object', properties: { data: { type: 'string' }, exemption: { type: 'string' } } } },
            response_letter: { type: 'string' },
            record_keeping: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 10. VENDOR PRIVACY REVIEW ─────────────────────────────────────────
    if (action === 'vendor_privacy') {
      const { vendor_name, services_provided, data_shared } = params;
      const vendors = await loadVendors();

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Conduct a vendor privacy and compliance due diligence review.

Vendor: ${vendor_name || target}
Services: ${services_provided || 'SaaS platform'}
Data shared with them: ${data_shared || 'customer personal data, business data'}
Known vendors for context: ${JSON.stringify(vendors.slice(0, 10).map(v => ({ name: v.name, category: v.category })))}

Vendor due diligence:
1. **Privacy risk rating**: Critical / High / Medium / Low
2. **Data processing assessment**: what data flows to them? What legal basis?
3. **Required contractual protections**: DPA, SCCs, specific clauses needed
4. **Questions to ask the vendor**: security questionnaire items
5. **Certifications to request**: ISO 27001, SOC2, Privacy Shield, etc.
6. **Subprocessor review**: key questions about their subprocessors
7. **Breach notification obligations**: what they must tell us if breached
8. **Data deletion/return**: on termination, what happens to our data?
9. **Red flags to watch for**: specific things that would be deal-breakers
10. **Approval recommendation**: Approved / Approved with conditions / Not approved`,
        response_json_schema: {
          type: 'object',
          properties: {
            privacy_risk_rating: { type: 'string' },
            recommendation: { type: 'string' },
            conditions: { type: 'array', items: { type: 'string' } },
            required_contracts: { type: 'array', items: { type: 'string' } },
            vendor_questionnaire: { type: 'array', items: { type: 'string' } },
            certifications_to_request: { type: 'array', items: { type: 'string' } },
            red_flags: { type: 'array', items: { type: 'string' } },
            data_flows: { type: 'string' }
          }
        }
      });
    }

    // ─── 11. IP AUDIT ──────────────────────────────────────────────────────
    if (action === 'ip_audit') {
      const { ip_description, ip_type } = params;
      const docs = await loadDocs();

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Conduct an intellectual property audit and protection assessment.

IP focus: ${ip_description || target || 'business IP portfolio'}
IP type: ${ip_type || 'all: trademarks, copyrights, trade secrets, potentially patents'}
Documents on file: ${JSON.stringify(docs.slice(0, 10).map(d => ({ title: d.title, type: d.type })))}

IP audit:
1. **IP inventory**: what IP assets does the business likely have? (brand, content, software, processes, data)
2. **Protection status**: for each asset, how is it currently protected (or not)?
3. **Registration recommendations**: what should be registered? Where? Estimated cost and timeline.
4. **Ownership verification**: are there any gaps in IP assignment (contractors, employees)?
5. **License review**: what third-party IP are we using? Do we have the rights we need?
6. **Open source exposure**: common open source licenses we should be aware of
7. **Trade secret protection**: what processes/data qualify as trade secrets? How to protect them.
8. **Infringement risk**: are we doing anything that could infringe third-party IP?
9. **Monitoring recommendations**: what to watch for in competitor IP activity
10. **Priority actions**: top 5 IP protection actions to take this quarter`,
        response_json_schema: {
          type: 'object',
          properties: {
            ip_inventory: { type: 'array', items: { type: 'object', properties: {
              asset: { type: 'string' }, type: { type: 'string' }, current_protection: { type: 'string' }, recommendation: { type: 'string' }
            }}},
            registration_priorities: { type: 'array', items: { type: 'object', properties: {
              ip: { type: 'string' }, action: { type: 'string' }, jurisdiction: { type: 'string' }, estimated_cost: { type: 'string' }
            }}},
            ownership_gaps: { type: 'array', items: { type: 'string' } },
            license_issues: { type: 'array', items: { type: 'string' } },
            infringement_risks: { type: 'array', items: { type: 'string' } },
            top_5_actions: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 12. EMPLOYMENT CONTRACT ────────────────────────────────────────────
    if (action === 'employment_contract') {
      const { role, employment_type, compensation, jurisdiction, special_terms } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a legally compliant employment or contractor agreement.

Role: ${role || target || 'general employee'}
Employment type: ${employment_type || 'full-time employee'}
Compensation: ${compensation || 'salary + superannuation'}
Jurisdiction: ${jurisdiction || 'Australia'}
Special terms: ${special_terms || 'standard'}

Generate a complete, compliant agreement including:
1. **Parties and commencement date**
2. **Role and responsibilities**
3. **Hours of work and location**
4. **Compensation**: salary, super, bonuses, expense reimbursement
5. **Leave entitlements**: annual, sick, parental (per jurisdiction)
6. **Confidentiality and non-disclosure**
7. **IP assignment**: all work created is company property
8. **Non-compete and non-solicitation** (with jurisdiction notes on enforceability)
9. **Termination**: notice periods, for-cause termination, redundancy
10. **Dispute resolution**
11. **Jurisdiction-specific mandatory clauses**

Flag any clauses that may not be enforceable in the specified jurisdiction.
Note minimum entitlements that cannot be contracted below.`,
        response_json_schema: {
          type: 'object',
          properties: {
            contract_draft: { type: 'string' },
            mandatory_entitlements: { type: 'array', items: { type: 'string' } },
            enforceability_notes: { type: 'array', items: { type: 'object', properties: {
              clause: { type: 'string' }, note: { type: 'string' }
            }}},
            jurisdiction_specific_requirements: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      await base44.asServiceRole.entities.Document.create({
        title: `Employment Agreement — ${role || 'Employee'} (${employment_type || 'FT'})`,
        type: 'contract',
        content: result?.contract_draft?.slice(0, 5000) || '',
        status: 'draft'
      }).catch(() => null);
    }

    // ─── 13. WORKER CLASSIFICATION ─────────────────────────────────────────
    if (action === 'worker_classification') {
      const { worker_description, engagement_structure } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze worker classification (employee vs. independent contractor).

Worker situation: ${worker_description || target}
Engagement structure: ${engagement_structure || 'as described'}
Jurisdiction: ${industry || 'Australia'}

Worker classification analysis:
1. **Classification factors**: apply the relevant test (multi-factor, economic reality, control test)
2. **Employee indicators**: factors suggesting employment
3. **Contractor indicators**: factors suggesting independent contractor
4. **Risk assessment**: what's the misclassification risk (1-10)?
5. **Consequences of misclassification**: tax, super, leave entitlements, penalties
6. **Recommendation**: classify as employee or contractor — and why
7. **Structural changes** (if contractor): what safeguards to implement
8. **Restructuring options** (if currently misclassified): path to compliance`,
        response_json_schema: {
          type: 'object',
          properties: {
            classification_recommendation: { type: 'string' },
            misclassification_risk: { type: 'number' },
            employee_factors: { type: 'array', items: { type: 'string' } },
            contractor_factors: { type: 'array', items: { type: 'string' } },
            misclassification_consequences: { type: 'array', items: { type: 'string' } },
            recommended_safeguards: { type: 'array', items: { type: 'string' } },
            compliance_steps: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 14. BREACH NOTIFICATION ────────────────────────────────────────────
    if (action === 'breach_notification') {
      const { breach_description, data_affected, individuals_affected, discovery_date } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze a data breach and determine notification obligations.

Breach: ${breach_description || target}
Data affected: ${data_affected || 'personal data — details unknown'}
Individuals potentially affected: ${individuals_affected || 'unknown'}
Discovery date: ${discovery_date || 'recently'}

Breach response and notification analysis:
1. **Severity assessment**: is this a notifiable breach? Under which frameworks?
2. **Notification requirements**:
   - OAIC (Australia): Is it an 'eligible data breach'? 30-day assessment period.
   - GDPR (if applicable): 72-hour notification to supervisory authority
   - Individual notification: when and how?
   - State breach notification laws (if applicable)
3. **Timeline**: notification deadlines for each applicable authority
4. **Regulatory notification drafts**: template notifications for each authority
5. **Individual notification draft**: clear, plain-language letter to affected individuals
6. **Containment steps**: immediate actions to prevent further breach
7. **Forensic preservation**: what evidence to preserve
8. **Record-keeping**: what to document for regulatory compliance
9. **Public statement** (if needed): holding statement
10. **Post-breach improvements**: what to change to prevent recurrence`,
        response_json_schema: {
          type: 'object',
          properties: {
            is_notifiable: { type: 'boolean' },
            applicable_frameworks: { type: 'array', items: { type: 'string' } },
            notification_deadlines: { type: 'array', items: { type: 'object', properties: {
              authority: { type: 'string' }, deadline: { type: 'string' }, requirement: { type: 'string' }
            }}},
            regulatory_notification_draft: { type: 'string' },
            individual_notification_draft: { type: 'string' },
            immediate_containment_steps: { type: 'array', items: { type: 'string' } },
            evidence_to_preserve: { type: 'array', items: { type: 'string' } },
            post_breach_improvements: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      await base44.asServiceRole.entities.Notification.create({
        title: 'DATA BREACH — Notification obligations triggered',
        type: 'legal',
        priority: 'critical',
        message: `Data breach requires immediate attention. Analysis complete — check Veritas for notification requirements and deadlines.`,
        is_read: false
      }).catch(() => null);
    }

    // ─── 15. OBLIGATION TRACKING ────────────────────────────────────────────
    if (action === 'obligation_tracking') {
      const { contract_description, counterparty } = params;
      const docs = await loadDocs();

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract and track key obligations from contracts and legal documents.

Contract/Document: ${contract_description || target}
Counterparty: ${counterparty || 'not specified'}
Document library (${docs.length} docs): ${JSON.stringify(docs.slice(0, 15).map(d => ({ title: d.title, type: d.type, status: d.status })))}

Extract all tracked obligations:

For each obligation found:
1. **Party obligated**: us or them?
2. **Obligation**: exactly what must be done
3. **Deadline/frequency**: when and how often
4. **Consequence of breach**: what happens if we miss it
5. **Current status**: pending / overdue / completed
6. **Owner**: which team/agent is responsible
7. **Next action**: what needs to happen next

Categories:
- Payment obligations (amounts, dates)
- Deliverable obligations (what, by when)
- Reporting obligations (reports, certifications)
- Compliance obligations (maintain certifications, etc.)
- Notice obligations (changes, renewal elections)
- Restriction obligations (things we can't do)
- Renewal and termination deadlines

Create a master obligation tracker.`,
        response_json_schema: {
          type: 'object',
          properties: {
            obligations: { type: 'array', items: { type: 'object', properties: {
              party: { type: 'string' },
              obligation: { type: 'string' },
              category: { type: 'string' },
              deadline: { type: 'string' },
              consequence_of_breach: { type: 'string' },
              status: { type: 'string' },
              owner: { type: 'string' },
              next_action: { type: 'string' }
            }}},
            critical_deadlines: { type: 'array', items: { type: 'string' } },
            overdue_obligations: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      // Create tasks for upcoming obligations
      if (result?.critical_deadlines?.length > 0) {
        for (const deadline of result.critical_deadlines.slice(0, 3)) {
          await base44.asServiceRole.entities.Task.create({
            title: `Legal obligation: ${deadline.slice(0, 80)}`,
            priority: 'high',
            status: 'todo',
            description: `Contract obligation flagged by Veritas. Details: ${deadline}`
          }).catch(() => null);
        }
      }
    }

    // ─── 16. REMEDIATION PLAN ──────────────────────────────────────────────
    if (action === 'remediation_plan') {
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a detailed compliance remediation plan.

Compliance area: ${compliance_area || target}
Industry: ${industry}

Remediation plan with:
1. Priority ranking (critical/high/medium/low)
2. Specific actions for each gap
3. Responsible party type (legal, ops, IT, HR, marketing)
4. Timeline (start date, end date, effort estimate)
5. Success criteria (how to verify it's fixed)
6. Contingency (what if we can't fix in time)
7. Budget estimate
8. Dependencies between items`,
        response_json_schema: {
          type: 'object',
          properties: {
            remediation_items: { type: 'array', items: { type: 'object', properties: {
              item: { type: 'string' }, priority: { type: 'string' }, actions: { type: 'array', items: { type: 'string' } },
              owner: { type: 'string' }, timeline_weeks: { type: 'number' }, success_criteria: { type: 'string' }
            }}},
            total_timeline_weeks: { type: 'number' },
            estimated_cost: { type: 'string' },
            quick_wins: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 17. GENERATE REPORT ───────────────────────────────────────────────
    if (action === 'generate_report') {
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a comprehensive compliance status report.

Industry: ${industry}
Focus area: ${compliance_area || 'all compliance areas'}

Report includes:
1. Executive summary (for board/leadership)
2. Compliance posture score
3. Key findings by area
4. Risk assessment (critical/high/medium/low)
5. Recommendations with timeline
6. Progress on previous actions (if applicable)
7. Upcoming regulatory changes to prepare for
8. Budget and resource requirements
9. Next review date`,
        response_json_schema: {
          type: 'object',
          properties: {
            executive_summary: { type: 'string' },
            compliance_score: { type: 'number' },
            findings: { type: 'array', items: { type: 'string' } },
            recommendations: { type: 'array', items: { type: 'string' } },
            remediation_timeline: { type: 'string' },
            next_review: { type: 'string' }
          }
        }
      });

      await base44.asServiceRole.entities.Document.create({
        title: `Compliance Report — ${new Date().toISOString().split('T')[0]}`,
        type: 'report',
        content: result?.executive_summary || '',
        status: 'final'
      }).catch(() => null);
    }

    // ─── 18. VALIDATE REQUIREMENTS ─────────────────────────────────────────
    if (action === 'validate_requirements') {
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Validate compliance requirements for a specific area.

Industry: ${industry}
Area: ${compliance_area || target}

Check:
1. Legal requirements (all applicable laws/regulations)
2. Current state assessment
3. Gaps identified
4. Implementation steps
5. Timeline and cost estimate
6. Risk if non-compliant`,
        response_json_schema: {
          type: 'object',
          properties: {
            requirements: { type: 'array', items: { type: 'string' } },
            gaps: { type: 'array', items: { type: 'string' } },
            implementation_steps: { type: 'array', items: { type: 'string' } },
            timeline_weeks: { type: 'number' },
            penalty_risk: { type: 'string' }
          }
        }
      });
    }

    // ─── 19. COMPLIANCE TIPS ────────────────────────────────────────────────
    if (action === 'compliance_tips') {
      const { activity, context } = params;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Provide just-in-time compliance guidance for a specific business activity.

Activity: ${activity || target}
Context: ${context || industry}

Provide:
1. Compliance requirements for this activity (quick reference)
2. Common mistakes to avoid
3. Required disclosures or notices
4. Data privacy implications
5. Record-keeping requirements
6. "Do this, don't do that" checklist
7. When to get legal review before proceeding`,
        response_json_schema: {
          type: 'object',
          properties: {
            requirements: { type: 'array', items: { type: 'string' } },
            common_mistakes: { type: 'array', items: { type: 'string' } },
            required_disclosures: { type: 'array', items: { type: 'string' } },
            dos: { type: 'array', items: { type: 'string' } },
            donts: { type: 'array', items: { type: 'string' } },
            escalate_if: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    if (!result) {
      result = { message: `Action '${action}' received. Available: generate_contract, review_contract, clause_analysis, negotiation_support, privacy_policy, risk_assessment, compliance_gap, audit_compliance, regulatory_monitor, impact_assessment, dsar_handling, vendor_privacy, ip_audit, employment_contract, worker_classification, breach_notification, obligation_tracking, remediation_plan, generate_report, validate_requirements, compliance_tips` };
    }

    return Response.json({ status: 'veritas_complete', action, result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});