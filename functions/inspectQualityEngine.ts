import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const { action, params = {} } = payload;

    // Legacy field support
    const test_type = payload.test_type || params.test_type || 'functional';
    const target = payload.target || params.target || '';

    let result = null;

    const loadTickets = () => base44.asServiceRole.entities.Ticket.list('-created_date', 50).catch(() => []);
    const loadIncidents = () => base44.asServiceRole.entities.SecurityIncident.list('-created_date', 50).catch(() => []);
    const loadMetrics = () => base44.asServiceRole.entities.Metric.list('-created_date', 100).catch(() => []);
    const loadTasks = () => base44.asServiceRole.entities.Task.list('-created_date', 50).catch(() => []);
    const loadWorkflows = () => base44.asServiceRole.entities.Workflow.list('-created_date', 30).catch(() => []);

    // ─── 1. RUN TESTS ────────────────────────────────────────────────────────
    if (action === 'run_tests') {
      const { scope, requirements, user_stories, test_depth } = params;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate and simulate comprehensive test execution for a software feature or system.

Feature/Scope: ${scope || target || test_type}
Requirements: ${requirements || 'standard quality requirements'}
User stories: ${user_stories || 'not provided'}
Test depth: ${test_depth || 'standard'}

Generate a complete test execution report:

1. **Unit Tests** (10-15 cases): Input validation, boundary conditions, error handling, business logic
2. **Integration Tests** (5-8 cases): API contracts, database operations, service dependencies
3. **End-to-End Tests** (3-5 flows): Critical user journeys from start to finish
4. **Edge Cases** (5-10 cases): Unusual inputs, concurrent operations, resource limits
5. **Negative Tests** (5 cases): Invalid inputs, unauthorized access, missing data

For each test: name, description, steps, expected result, pass/fail status, severity if failed.

Provide:
- Overall pass rate
- Critical failures that must be fixed before release
- Warnings (non-blocking but should be addressed)
- Test coverage estimate by feature area
- Recommended additional test cases`,
        response_json_schema: {
          type: 'object',
          properties: {
            summary: { type: 'object', properties: {
              total_tests: { type: 'number' },
              passed: { type: 'number' },
              failed: { type: 'number' },
              warnings: { type: 'number' },
              pass_rate: { type: 'number' },
              coverage_estimate: { type: 'string' }
            }},
            critical_failures: { type: 'array', items: { type: 'object', properties: {
              test_name: { type: 'string' },
              description: { type: 'string' },
              failure_reason: { type: 'string' },
              severity: { type: 'string' }
            }}},
            warnings: { type: 'array', items: { type: 'string' } },
            test_suites: { type: 'array', items: { type: 'object', properties: {
              suite: { type: 'string' },
              passed: { type: 'number' },
              failed: { type: 'number' },
              key_findings: { type: 'string' }
            }}},
            release_recommendation: { type: 'string' },
            next_test_priorities: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 2. REGRESSION TEST ───────────────────────────────────────────────────
    if (action === 'regression_test') {
      const { changed_areas, previous_version, current_version } = params;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Perform a regression test analysis for a software change.

Changed areas: ${changed_areas || target || 'general update'}
Previous version: ${previous_version || 'prior release'}
Current version: ${current_version || 'current'}

Regression analysis:
1. Identify which existing features are at risk from these changes (impact radius)
2. Prioritized regression test suite — which tests MUST run given these changes
3. Tests that can be safely skipped (change doesn't affect them)
4. Known regression patterns to watch for in this type of change
5. Smoke tests for immediate post-deployment verification
6. Full regression suite recommendation (what to run overnight)
7. Predicted regression risk score (0-100)

Flag any high-risk regressions with specific test steps.`,
        response_json_schema: {
          type: 'object',
          properties: {
            regression_risk_score: { type: 'number' },
            impact_radius: { type: 'array', items: { type: 'string' } },
            must_run_tests: { type: 'array', items: { type: 'object', properties: {
              test: { type: 'string' }, reason: { type: 'string' }, steps: { type: 'array', items: { type: 'string' } }
            }}},
            safe_to_skip: { type: 'array', items: { type: 'string' } },
            smoke_tests: { type: 'array', items: { type: 'string' } },
            high_risk_areas: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 3. PERFORMANCE TEST ─────────────────────────────────────────────────
    if (action === 'performance_test' || action === 'monitor_performance') {
      const { endpoint, expected_users, sla_targets } = params;
      const metrics = await loadMetrics();
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Perform a comprehensive performance analysis and testing plan.

Target: ${endpoint || target || 'application performance'}
Expected concurrent users: ${expected_users || '100-1000'}
SLA targets: ${sla_targets || 'response time < 2s, uptime 99.9%, error rate < 1%'}
Recent metrics snapshot: ${JSON.stringify(metrics.slice(0, 20).map(m => ({ name: m.name, value: m.value, date: m.created_date })))}

Performance analysis:
1. **Load Test Plan**: user ramp-up, peak load, soak test scenarios
2. **Key metrics to track**: response time (p50, p95, p99), throughput (RPS), error rate, CPU/memory
3. **Performance baselines** from metrics data (identify any existing regressions)
4. **Bottleneck predictions**: where is the system likely to break first?
5. **Performance budget**: recommended limits per endpoint/operation
6. **Optimization recommendations**: quick wins vs. larger architectural changes
7. **Alerting thresholds**: when to page the team
8. Current performance health score (0-100) based on available data`,
        response_json_schema: {
          type: 'object',
          properties: {
            health_score: { type: 'number' },
            current_baselines: { type: 'object', properties: {
              avg_response_ms: { type: 'number' },
              estimated_error_rate: { type: 'number' },
              uptime_estimate: { type: 'string' }
            }},
            bottleneck_predictions: { type: 'array', items: { type: 'string' } },
            load_test_plan: { type: 'array', items: { type: 'object', properties: {
              scenario: { type: 'string' }, users: { type: 'string' }, duration: { type: 'string' }, success_criteria: { type: 'string' }
            }}},
            optimization_quick_wins: { type: 'array', items: { type: 'string' } },
            alerting_thresholds: { type: 'object' },
            alerts: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 4. SECURITY SCAN ─────────────────────────────────────────────────────
    if (action === 'security_scan') {
      const { scan_type, components } = params;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Perform a comprehensive security quality assessment.

Target: ${components || target || 'application'}
Scan type: ${scan_type || 'SAST + DAST + dependency'}

Security assessment:
1. **OWASP Top 10 checklist**: assess each category for the described application
2. **Common vulnerability patterns** for this type of application
3. **Authentication & Authorization review**: session management, JWT handling, role enforcement
4. **Data exposure risks**: PII handling, encryption, logging of sensitive data
5. **Input validation gaps**: injection risks, XSS, CSRF
6. **Dependency vulnerabilities**: known CVEs in common packages for this stack
7. **API security**: rate limiting, authentication, schema validation
8. **Security headers**: HSTS, CSP, X-Frame-Options, etc.
9. **Risk prioritization**: critical → high → medium findings
10. **Remediation roadmap**: quick fixes vs. architectural improvements

Output a security scorecard and findings report.`,
        response_json_schema: {
          type: 'object',
          properties: {
            security_score: { type: 'number' },
            owasp_assessment: { type: 'array', items: { type: 'object', properties: {
              category: { type: 'string' }, risk_level: { type: 'string' }, findings: { type: 'string' }
            }}},
            critical_findings: { type: 'array', items: { type: 'object', properties: {
              finding: { type: 'string' }, impact: { type: 'string' }, remediation: { type: 'string' }
            }}},
            high_findings: { type: 'array', items: { type: 'string' } },
            quick_fixes: { type: 'array', items: { type: 'string' } },
            remediation_roadmap: { type: 'array', items: { type: 'object', properties: {
              priority: { type: 'string' }, action: { type: 'string' }, effort: { type: 'string' }
            }}}
          }
        }
      });
    }

    // ─── 5. ACCESSIBILITY AUDIT ────────────────────────────────────────────────
    if (action === 'accessibility_audit') {
      const { page_or_feature, wcag_level } = params;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Perform a WCAG accessibility audit.

Feature/Page: ${page_or_feature || target || 'application'}
WCAG level: ${wcag_level || 'AA'}

Accessibility audit:
1. **Perceivable** (WCAG 1.x): alt text, captions, color contrast, resizable text
2. **Operable** (WCAG 2.x): keyboard navigation, focus management, no seizure triggers, sufficient time
3. **Understandable** (WCAG 3.x): readable language, predictable behavior, error identification
4. **Robust** (WCAG 4.x): compatible with assistive technologies, valid markup
5. **Screen reader experience**: heading structure, ARIA labels, landmark regions
6. **Color contrast failures**: specific elements likely to fail 4.5:1 ratio
7. **Keyboard trap risks**: modal dialogs, dropdowns, date pickers
8. **Mobile accessibility**: touch target sizes, pinch zoom, orientation
9. **Priority violations**: which issues block the most users
10. **Remediation guide**: specific code-level fixes for each issue type`,
        response_json_schema: {
          type: 'object',
          properties: {
            wcag_compliance_score: { type: 'number' },
            critical_violations: { type: 'array', items: { type: 'object', properties: {
              criterion: { type: 'string' }, issue: { type: 'string' }, fix: { type: 'string' }, affected_users: { type: 'string' }
            }}},
            warnings: { type: 'array', items: { type: 'string' } },
            passes: { type: 'array', items: { type: 'string' } },
            screen_reader_assessment: { type: 'string' },
            keyboard_nav_assessment: { type: 'string' },
            remediation_priority: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 6. API TEST ──────────────────────────────────────────────────────────
    if (action === 'api_test') {
      const { api_name, endpoints, auth_type } = params;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Design and simulate API test suite execution.

API: ${api_name || target || 'application API'}
Endpoints: ${endpoints || 'standard REST endpoints'}
Auth type: ${auth_type || 'JWT/Bearer token'}

API test coverage:
1. **Happy path tests**: correct request → correct response for each endpoint
2. **Error handling**: 400, 401, 403, 404, 422, 500 scenarios
3. **Schema validation**: response structure, field types, required fields
4. **Authentication tests**: missing token, expired token, invalid token, insufficient scope
5. **Rate limiting**: behavior when limits exceeded
6. **Pagination**: correct pagination headers and data
7. **Filtering & sorting**: query parameter handling
8. **Large payload handling**: oversized requests, response truncation
9. **Concurrent requests**: race conditions and idempotency
10. **Contract testing**: backwards compatibility with current consumers

Generate specific test cases with: method, endpoint, request, expected response, assertion.`,
        response_json_schema: {
          type: 'object',
          properties: {
            api_quality_score: { type: 'number' },
            test_cases: { type: 'array', items: { type: 'object', properties: {
              name: { type: 'string' },
              method: { type: 'string' },
              endpoint: { type: 'string' },
              scenario: { type: 'string' },
              expected_status: { type: 'string' },
              assertions: { type: 'array', items: { type: 'string' } },
              status: { type: 'string' }
            }}},
            critical_gaps: { type: 'array', items: { type: 'string' } },
            security_findings: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 7. CONTENT QA ────────────────────────────────────────────────────────
    if (action === 'content_qa') {
      const { content, content_type, channel } = params;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Perform comprehensive content quality assurance review.

Content: ${content || target || 'content to review'}
Content type: ${content_type || 'marketing/general'}
Channel: ${channel || 'multi-channel'}

Quality review:
1. **Grammar & Spelling**: specific errors found, corrections
2. **Clarity & Readability**: Flesch reading score estimate, complex sentences, jargon
3. **Structure & Flow**: logical progression, missing transitions, unclear sections
4. **Brand Voice**: tone consistency, vocabulary alignment, banned terms used
5. **Factual accuracy flags**: claims that should be verified
6. **SEO check**: keyword usage, meta description, heading structure (if applicable)
7. **Call-to-action**: clarity and effectiveness of CTAs
8. **Accessibility**: plain language, reading level, inclusive language
9. **Legal/Compliance flags**: claims requiring disclaimers, regulatory language
10. **Overall quality score** (0-100) and publish recommendation: Approve / Minor edits / Major revision

Provide line-level feedback where possible.`,
        response_json_schema: {
          type: 'object',
          properties: {
            quality_score: { type: 'number' },
            recommendation: { type: 'string' },
            grammar_issues: { type: 'array', items: { type: 'object', properties: { issue: { type: 'string' }, correction: { type: 'string' } } } },
            clarity_issues: { type: 'array', items: { type: 'string' } },
            brand_voice_flags: { type: 'array', items: { type: 'string' } },
            factual_flags: { type: 'array', items: { type: 'string' } },
            compliance_flags: { type: 'array', items: { type: 'string' } },
            strengths: { type: 'array', items: { type: 'string' } },
            revised_version_suggestion: { type: 'string' }
          }
        }
      });
    }

    // ─── 8. BRAND VOICE CHECK ────────────────────────────────────────────────
    if (action === 'brand_voice_check') {
      const { content, brand_guidelines, tone_targets } = params;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Check content for brand voice compliance.

Content to check: ${content || target}
Brand guidelines: ${brand_guidelines || 'professional, clear, approachable, expert but not jargon-heavy'}
Target tone attributes: ${tone_targets || 'confident, helpful, direct, warm'}

Brand voice audit:
1. **Tone score** (0-100): how well does it match target tone?
2. **Voice consistency**: consistent throughout, or does it drift?
3. **Vocabulary alignment**: uses brand-appropriate words? Any jarring terms?
4. **Banned/flagged terms**: any terms that conflict with guidelines?
5. **Sentence structure**: too formal? Too casual? Too complex?
6. **Personality markers**: does it sound human and on-brand?
7. **Specific passages to rewrite**: which lines are most off-brand and why
8. **Rewritten examples**: show the on-brand version of flagged passages`,
        response_json_schema: {
          type: 'object',
          properties: {
            tone_score: { type: 'number' },
            compliance_verdict: { type: 'string' },
            voice_issues: { type: 'array', items: { type: 'object', properties: {
              original: { type: 'string' }, issue: { type: 'string' }, rewrite: { type: 'string' }
            }}},
            banned_terms_found: { type: 'array', items: { type: 'string' } },
            strengths: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 9. FACT CHECK ────────────────────────────────────────────────────────
    if (action === 'fact_check') {
      const { content, claims } = params;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Fact-check the following content for accuracy and verifiability.

Content: ${content || target}
Specific claims to check: ${claims || 'all factual claims in content'}

Fact-check report:
1. Extract all factual claims (statistics, dates, names, attributed quotes)
2. For each claim: Verified / Unverified / Likely False / Needs Citation
3. Red flags: claims that are demonstrably incorrect
4. Unsupported claims: statements presented as fact without basis
5. Outdated information: facts that may have changed
6. Missing citations: claims that require attribution
7. Recommended corrections or additions
8. Overall factual accuracy score (0-100)`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            accuracy_score: { type: 'number' },
            claims_checked: { type: 'array', items: { type: 'object', properties: {
              claim: { type: 'string' }, verdict: { type: 'string' }, evidence: { type: 'string' }, correction: { type: 'string' }
            }}},
            red_flags: { type: 'array', items: { type: 'string' } },
            missing_citations: { type: 'array', items: { type: 'string' } },
            overall_verdict: { type: 'string' }
          }
        }
      });
    }

    // ─── 10. PROCESS AUDIT ────────────────────────────────────────────────────
    if (action === 'process_audit') {
      const { process_name, sop_description } = params;
      const tasks = await loadTasks();
      const workflows = await loadWorkflows();
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Audit business process adherence and quality.

Process: ${process_name || target || 'general business operations'}
SOP/Expected process: ${sop_description || 'standard best practices'}
Current tasks (${tasks.length}): ${JSON.stringify(tasks.slice(0, 15).map(t => ({ title: t.title, status: t.status, priority: t.priority })))}
Current workflows (${workflows.length}): ${JSON.stringify(workflows.slice(0, 10).map(w => ({ name: w.name, status: w.status })))}

Process audit:
1. **Process adherence score** (0-100)
2. **Deviations detected**: where actual process differs from SOP
3. **Bottlenecks**: where tasks are stalling or accumulating
4. **SLA risks**: tasks at risk of missing deadlines
5. **Efficiency gaps**: unnecessary steps, duplication, manual effort that could be automated
6. **Quality control points missing**: where QA checks should exist but don't
7. **Root causes** of any deviations
8. **Recommended process improvements**
9. **Automation opportunities**`,
        response_json_schema: {
          type: 'object',
          properties: {
            adherence_score: { type: 'number' },
            deviations: { type: 'array', items: { type: 'object', properties: {
              deviation: { type: 'string' }, impact: { type: 'string' }, root_cause: { type: 'string' }, fix: { type: 'string' }
            }}},
            bottlenecks: { type: 'array', items: { type: 'string' } },
            sla_risks: { type: 'array', items: { type: 'string' } },
            automation_opportunities: { type: 'array', items: { type: 'string' } },
            improvement_recommendations: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 11. SLA CHECK ───────────────────────────────────────────────────────
    if (action === 'sla_check') {
      const { sla_targets } = params;
      const tickets = await loadTickets();
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze SLA compliance across support and operations.

SLA targets: ${sla_targets || 'P1: 1h response, P2: 4h response, P3: 24h response'}
Active tickets (${tickets.length}): ${JSON.stringify(tickets.slice(0, 20).map(t => ({
  title: t.title?.slice(0, 50),
  status: t.status,
  priority: t.priority,
  created: t.created_date,
  category: t.category
})))}

SLA analysis:
1. **Overall SLA compliance rate**
2. **Breached SLAs**: which tickets/processes are in breach?
3. **At-risk SLAs**: likely to breach in next 24 hours
4. **SLA performance by priority level**
5. **SLA performance by category/team**
6. **Trend**: improving or deteriorating?
7. **Root causes of breaches**
8. **Recommended actions** to prevent future breaches`,
        response_json_schema: {
          type: 'object',
          properties: {
            compliance_rate: { type: 'number' },
            breached_slas: { type: 'array', items: { type: 'object', properties: {
              item: { type: 'string' }, breach_duration: { type: 'string' }, impact: { type: 'string' }
            }}},
            at_risk: { type: 'array', items: { type: 'string' } },
            by_priority: { type: 'object' },
            trend: { type: 'string' },
            root_causes: { type: 'array', items: { type: 'string' } },
            recommendations: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 12. DATA QUALITY AUDIT ───────────────────────────────────────────────
    if (action === 'data_quality_audit') {
      const { entity_focus } = params;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Perform a data quality audit for business data.

Focus area: ${entity_focus || target || 'all business data'}

Data quality assessment:
1. **Completeness**: critical fields that are often empty or null
2. **Accuracy**: data that looks incorrect (wrong format, implausible values)
3. **Consistency**: contradictory data across records or systems
4. **Timeliness**: stale or outdated records that need refreshing
5. **Duplicates**: duplicate records that should be merged
6. **Referential integrity**: orphaned records, broken relationships
7. **Format standardization**: inconsistent formats (phone, email, date, currency)
8. **Overall data quality score** (0-100)
9. **Priority cleanup actions** with estimated effort
10. **Ongoing governance recommendations** to prevent data quality degradation`,
        response_json_schema: {
          type: 'object',
          properties: {
            data_quality_score: { type: 'number' },
            completeness_issues: { type: 'array', items: { type: 'string' } },
            accuracy_issues: { type: 'array', items: { type: 'string' } },
            consistency_issues: { type: 'array', items: { type: 'string' } },
            duplicate_patterns: { type: 'array', items: { type: 'string' } },
            format_issues: { type: 'array', items: { type: 'string' } },
            priority_cleanup: { type: 'array', items: { type: 'object', properties: {
              action: { type: 'string' }, effort: { type: 'string' }, impact: { type: 'string' }
            }}},
            governance_recommendations: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 13. ROOT CAUSE ANALYSIS ─────────────────────────────────────────────
    if (action === 'root_cause_analysis') {
      const { incident_description, timeline, symptoms } = params;
      const incidents = await loadIncidents();
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Perform systematic root cause analysis for an incident or recurring issue.

Incident/Issue: ${incident_description || target}
Timeline: ${timeline || 'not provided'}
Symptoms: ${symptoms || 'as described'}
Recent incidents for context (${incidents.length}): ${JSON.stringify(incidents.slice(0, 10).map(i => ({ title: i.title, severity: i.severity, status: i.status })))}

Root cause analysis using 5-Why and Fishbone methodology:

1. **Immediate cause**: what directly caused this?
2. **5-Why analysis**: drill down 5 levels to find root cause
3. **Contributing factors**: what made the system susceptible?
4. **Fishbone categories**: people, process, technology, environment, measurement
5. **Systemic issues**: is this a one-time event or a pattern?
6. **Similar incidents**: does this connect to other recent issues?
7. **Corrective actions**: fix the root cause (not just symptoms)
8. **Preventive measures**: process/system changes to prevent recurrence
9. **Detection improvements**: how to catch this faster next time
10. **Owner assignments** for each action item`,
        response_json_schema: {
          type: 'object',
          properties: {
            immediate_cause: { type: 'string' },
            five_why_chain: { type: 'array', items: { type: 'object', properties: { why: { type: 'string' }, because: { type: 'string' } } } },
            root_cause: { type: 'string' },
            contributing_factors: { type: 'array', items: { type: 'string' } },
            is_systemic: { type: 'boolean' },
            corrective_actions: { type: 'array', items: { type: 'object', properties: {
              action: { type: 'string' }, owner_team: { type: 'string' }, timeline: { type: 'string' }, priority: { type: 'string' }
            }}},
            preventive_measures: { type: 'array', items: { type: 'string' } },
            detection_improvements: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      // Create notification for critical RCAs
      await base44.asServiceRole.entities.Notification.create({
        title: `RCA Completed: ${incident_description?.slice(0, 60) || 'Incident'}`,
        type: 'quality',
        priority: 'high',
        message: `Root cause analysis completed. Root cause: ${result?.root_cause || 'See report'}`,
        is_read: false
      }).catch(() => null);
    }

    // ─── 14. RELEASE READINESS ───────────────────────────────────────────────
    if (action === 'release_readiness') {
      const { release_name, release_type, features } = params;
      const incidents = await loadIncidents();
      const tickets = await loadTickets();
      const tasks = await loadTasks();

      const openCritical = incidents.filter(i => i.severity === 'critical' && i.status !== 'resolved');
      const openHighBugs = incidents.filter(i => i.severity === 'high' && i.status !== 'resolved');
      const openBlockers = tasks.filter(t => t.priority === 'critical' && t.status !== 'done');

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Perform a release readiness assessment and generate GO/NO-GO recommendation.

Release: ${release_name || target || 'upcoming release'}
Release type: ${release_type || 'standard'}
Features included: ${features || 'not specified'}

Current state:
- Critical bugs open: ${openCritical.length}
- High severity bugs open: ${openHighBugs.length}
- Blocker tasks open: ${openBlockers.length}
- Open support tickets: ${tickets.filter(t => t.status === 'open').length}
- Critical bugs: ${JSON.stringify(openCritical.map(i => ({ title: i.title, status: i.status })))}

Release readiness assessment:
1. **Overall readiness score** (0-100)
2. **GO/NO-GO recommendation** with clear justification
3. **Blockers**: must be resolved before release
4. **Warnings**: issues that should be noted but don't block
5. **Pre-launch checklist** (20+ items): testing, documentation, comms, rollback plan
6. **Risk assessment**: probability and impact of potential issues post-release
7. **Rollback plan**: if things go wrong, what's the revert strategy?
8. **Post-launch monitoring plan**: what to watch for in the first 24-72 hours
9. **Conditional release option**: can we release with known issues if properly mitigated?`,
        response_json_schema: {
          type: 'object',
          properties: {
            readiness_score: { type: 'number' },
            go_no_go: { type: 'string' },
            decision_rationale: { type: 'string' },
            blockers: { type: 'array', items: { type: 'object', properties: { blocker: { type: 'string' }, severity: { type: 'string' }, resolution: { type: 'string' } } } },
            warnings: { type: 'array', items: { type: 'string' } },
            pre_launch_checklist: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, category: { type: 'string' }, status: { type: 'string' } } } },
            risk_assessment: { type: 'array', items: { type: 'object', properties: { risk: { type: 'string' }, probability: { type: 'string' }, impact: { type: 'string' }, mitigation: { type: 'string' } } } },
            rollback_plan: { type: 'string' },
            post_launch_monitoring: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      if (openCritical.length > 0) {
        await base44.asServiceRole.entities.Notification.create({
          title: `Release Blocked: ${openCritical.length} critical bugs open`,
          type: 'quality',
          priority: 'critical',
          message: `Release readiness check for "${release_name || 'upcoming release'}" returned NO-GO. ${openCritical.length} critical bugs must be resolved.`,
          is_read: false
        }).catch(() => null);
      }
    }

    // ─── 15. PRE-LAUNCH CHECKLIST ─────────────────────────────────────────────
    if (action === 'pre_launch_checklist') {
      const { launch_type, product_name, channels } = params;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a comprehensive pre-launch checklist.

Launch type: ${launch_type || 'product/feature launch'}
Product/Feature: ${product_name || target}
Channels: ${channels || 'web, email, social media'}

Generate a complete pre-launch checklist covering:
1. **Technical** (10+ items): testing complete, performance validated, monitoring set up, rollback ready
2. **Content & Copy** (8+ items): all copy reviewed, CTAs tested, images optimized, metadata set
3. **Marketing** (8+ items): campaigns scheduled, email sequences ready, social posts queued
4. **Legal & Compliance** (6+ items): terms updated, privacy policy, required disclaimers
5. **Support** (6+ items): team briefed, FAQs updated, escalation paths defined
6. **Analytics** (5+ items): tracking set up, dashboards ready, success metrics defined
7. **Communications** (4+ items): stakeholders notified, announcement ready
8. **Post-launch** (5+ items): monitoring plan, feedback collection, iteration plan

Each item: category, item description, owner, status (pending), and priority.`,
        response_json_schema: {
          type: 'object',
          properties: {
            launch_name: { type: 'string' },
            total_items: { type: 'number' },
            checklist: { type: 'array', items: { type: 'object', properties: {
              category: { type: 'string' },
              item: { type: 'string' },
              owner_team: { type: 'string' },
              priority: { type: 'string' },
              status: { type: 'string' },
              notes: { type: 'string' }
            }}},
            critical_path_items: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 16. SUPPORT QA ──────────────────────────────────────────────────────
    if (action === 'support_qa') {
      const { sample_conversations, quality_criteria } = params;
      const tickets = await loadTickets();
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze customer support quality across recent interactions.

Sample conversations/tickets: ${sample_conversations || 'use ticket data below'}
Quality criteria: ${quality_criteria || 'resolution accuracy, empathy, speed, adherence to scripts'}
Recent tickets (${tickets.length}): ${JSON.stringify(tickets.slice(0, 15).map(t => ({
  title: t.title?.slice(0, 60),
  status: t.status,
  priority: t.priority,
  category: t.category,
  resolution: t.resolution?.slice(0, 100)
})))}

Support quality analysis:
1. **Overall quality score** (0-100)
2. **Resolution quality**: are issues being properly resolved?
3. **Response time performance** vs. SLA targets
4. **Empathy and tone**: are agents responding with appropriate empathy?
5. **Common escalation patterns**: what keeps being escalated?
6. **Knowledge gaps**: what do agents frequently get wrong or struggle with?
7. **Script adherence**: are agents following guidelines?
8. **Customer effort score**: how much work are customers having to do?
9. **Coaching recommendations**: specific skills/areas to improve
10. **Process improvements**: changes to reduce ticket volume`,
        response_json_schema: {
          type: 'object',
          properties: {
            quality_score: { type: 'number' },
            resolution_quality: { type: 'string' },
            empathy_score: { type: 'number' },
            common_patterns: { type: 'array', items: { type: 'string' } },
            knowledge_gaps: { type: 'array', items: { type: 'string' } },
            coaching_recommendations: { type: 'array', items: { type: 'string' } },
            process_improvements: { type: 'array', items: { type: 'string' } },
            top_issue_categories: { type: 'array', items: { type: 'object', properties: { category: { type: 'string' }, count_estimate: { type: 'number' }, resolution_difficulty: { type: 'string' } } } }
          }
        }
      });
    }

    // ─── 17. FEEDBACK ANALYSIS ────────────────────────────────────────────────
    if (action === 'feedback_analysis') {
      const { feedback_data, source } = params;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze customer feedback for quality insights and action items.

Feedback source: ${source || 'mixed channels'}
Feedback data: ${feedback_data || target || 'customer feedback to analyze'}

Feedback quality analysis:
1. **Sentiment distribution**: % positive, neutral, negative
2. **Top themes** (positive and negative): what customers are saying most
3. **Quality signals**: specific product/service quality issues mentioned
4. **NPS/CSAT drivers**: what's driving satisfaction and dissatisfaction
5. **Churn risk signals**: feedback indicating customers may leave
6. **Feature requests vs. bug reports**: categorize actionable feedback
7. **Urgency ranking**: which feedback themes need immediate attention
8. **Competitor mentions**: what are customers comparing us to?
9. **Recommended actions**: specific changes to address top themes
10. **Feedback trend**: improving or worsening over time?`,
        add_context_from_internet: false,
        response_json_schema: {
          type: 'object',
          properties: {
            sentiment: { type: 'object', properties: { positive: { type: 'number' }, neutral: { type: 'number' }, negative: { type: 'number' } } },
            top_positive_themes: { type: 'array', items: { type: 'string' } },
            top_negative_themes: { type: 'array', items: { type: 'string' } },
            quality_issues: { type: 'array', items: { type: 'object', properties: { issue: { type: 'string' }, frequency: { type: 'string' }, severity: { type: 'string' } } } },
            churn_risk_signals: { type: 'array', items: { type: 'string' } },
            priority_actions: { type: 'array', items: { type: 'object', properties: { action: { type: 'string' }, impact: { type: 'string' }, effort: { type: 'string' } } } }
          }
        }
      });
    }

    // ─── 18. ANOMALY DETECTION ────────────────────────────────────────────────
    if (action === 'anomaly_detection') {
      const metrics = await loadMetrics();
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Detect anomalies and quality signals in business metrics.

Metrics data (${metrics.length} data points): ${JSON.stringify(metrics.slice(0, 50).map(m => ({
  name: m.name, value: m.value, date: m.created_date, category: m.category
})))}

Anomaly detection:
1. **Spikes and drops**: unusual deviations from baseline
2. **Trend breaks**: where a trend reverses or changes slope
3. **Missing data**: gaps in expected data streams
4. **Correlation anomalies**: metrics that should move together but diverged
5. **Severity rating** for each anomaly: critical / high / medium / low
6. **Probable causes** for each anomaly
7. **Business impact** of each anomaly
8. **Recommended investigations**: what to dig into first
9. **False positive assessment**: which anomalies are likely noise
10. **Alert configuration suggestions**: thresholds to set for ongoing monitoring`,
        response_json_schema: {
          type: 'object',
          properties: {
            anomalies_detected: { type: 'number' },
            critical_anomalies: { type: 'array', items: { type: 'object', properties: {
              metric: { type: 'string' }, description: { type: 'string' }, probable_cause: { type: 'string' }, impact: { type: 'string' }, action: { type: 'string' }
            }}},
            warnings: { type: 'array', items: { type: 'string' } },
            investigation_priorities: { type: 'array', items: { type: 'string' } },
            suggested_alert_thresholds: { type: 'array', items: { type: 'object', properties: { metric: { type: 'string' }, threshold: { type: 'string' } } } }
          }
        }
      });
    }

    // ─── 19. QUALITY DASHBOARD ───────────────────────────────────────────────
    if (action === 'quality_dashboard') {
      const [incidents, tickets, tasks, metrics] = await Promise.all([
        loadIncidents(), loadTickets(), loadTasks(), loadMetrics()
      ]);

      const openCritical = incidents.filter(i => i.severity === 'critical' && i.status !== 'resolved').length;
      const openHigh = incidents.filter(i => i.severity === 'high' && i.status !== 'resolved').length;
      const resolved7d = incidents.filter(i => {
        const d = new Date(i.updated_date);
        return d > new Date(Date.now() - 7 * 86400000) && i.status === 'resolved';
      }).length;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a comprehensive quality dashboard report.

Current quality state:
- Critical bugs open: ${openCritical}
- High severity bugs open: ${openHigh}
- Bugs resolved in last 7 days: ${resolved7d}
- Total incidents tracked: ${incidents.length}
- Open support tickets: ${tickets.filter(t => t.status === 'open').length}
- Tasks overdue: ${tasks.filter(t => t.status !== 'done').length}

Quality dashboard analysis:
1. **Overall quality health score** (0-100) with trend
2. **Defect summary**: by severity, by area, by status
3. **Quality velocity**: defects found vs. fixed rate
4. **SLA performance** across support and operations
5. **Quality trends** this week vs. last week
6. **Top quality risks** that need attention now
7. **Quality wins**: what's improving
8. **Cost of quality estimate**: rework, support load, potential churn from quality issues
9. **Recommended quality initiatives** for the next sprint/month
10. **Agent-by-agent quality summary**: which areas of the business have quality issues`,
        response_json_schema: {
          type: 'object',
          properties: {
            overall_health_score: { type: 'number' },
            health_trend: { type: 'string' },
            defect_summary: { type: 'object', properties: {
              critical: { type: 'number' }, high: { type: 'number' }, medium: { type: 'number' }, low: { type: 'number' }
            }},
            quality_velocity: { type: 'string' },
            sla_performance: { type: 'string' },
            top_risks: { type: 'array', items: { type: 'string' } },
            quality_wins: { type: 'array', items: { type: 'string' } },
            cost_of_quality_estimate: { type: 'string' },
            recommended_initiatives: { type: 'array', items: { type: 'object', properties: {
              initiative: { type: 'string' }, impact: { type: 'string' }, effort: { type: 'string' }
            }}},
            agent_quality_summary: { type: 'object' }
          }
        }
      });
    }

    // ─── 20. BUG TRIAGE ───────────────────────────────────────────────────────
    if (action === 'bug_triage') {
      const { bug_description, steps_to_reproduce, environment, reported_by } = params;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Triage a reported bug or issue.

Bug description: ${bug_description || target}
Steps to reproduce: ${steps_to_reproduce || 'not provided'}
Environment: ${environment || 'production'}
Reported by: ${reported_by || 'user'}

Bug triage report:
1. **Severity classification**: Critical / High / Medium / Low (with justification)
2. **Priority score** (1-10)
3. **Impact assessment**: how many users affected, what business functions impacted
4. **Reproduction assessment**: how reliably can this be reproduced?
5. **Likely root cause**: initial hypothesis
6. **Area of code/system** most likely responsible
7. **Similar known issues**: does this match any patterns?
8. **Recommended assignee type**: frontend, backend, DB, DevOps, content
9. **Workaround**: is there a temporary fix users can apply?
10. **Fix complexity estimate**: quick fix, medium effort, major refactor
11. **Test cases to add** once fixed to prevent regression`,
        response_json_schema: {
          type: 'object',
          properties: {
            severity: { type: 'string' },
            priority_score: { type: 'number' },
            impact: { type: 'object', properties: {
              users_affected: { type: 'string' },
              business_functions: { type: 'array', items: { type: 'string' } },
              revenue_risk: { type: 'string' }
            }},
            reproducibility: { type: 'string' },
            likely_root_cause: { type: 'string' },
            responsible_area: { type: 'string' },
            workaround: { type: 'string' },
            fix_complexity: { type: 'string' },
            recommended_assignee: { type: 'string' },
            regression_tests: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      await base44.asServiceRole.entities.SecurityIncident.create({
        title: bug_description?.slice(0, 100) || 'Bug Report',
        severity: result?.severity?.toLowerCase() || 'medium',
        description: bug_description,
        status: 'open',
        investigation_findings: `Triage: ${result?.likely_root_cause || 'Under investigation'}`
      }).catch(() => null);
    }

    // ─── 21. QUALITY FORECAST ────────────────────────────────────────────────
    if (action === 'quality_forecast') {
      const { planned_changes, timeline } = params;
      const [incidents, metrics] = await Promise.all([loadIncidents(), loadMetrics()]);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Forecast quality trends and predict future issues.

Planned changes: ${planned_changes || 'normal business operations'}
Forecast timeline: ${timeline || '30 days'}
Historical incidents (${incidents.length}): ${JSON.stringify(incidents.slice(0, 20).map(i => ({ title: i.title?.slice(0, 40), severity: i.severity, status: i.status })))}
Metrics trend: ${JSON.stringify(metrics.slice(0, 20).map(m => ({ name: m.name, value: m.value })))}

Quality forecast:
1. **Predicted quality health score** in 30 days
2. **Defect predictions**: areas likely to generate issues based on planned changes
3. **Risk events**: specific planned changes with high quality risk
4. **Preventive actions**: what to do NOW to prevent predicted issues
5. **Quality debt**: accumulated quality issues that will compound if not addressed
6. **Recommended quality investments**: where to focus QA resources
7. **Confidence level** of the forecast
8. **Early warning indicators**: signals to watch that indicate quality deterioration`,
        response_json_schema: {
          type: 'object',
          properties: {
            predicted_health_score: { type: 'number' },
            trend_direction: { type: 'string' },
            defect_predictions: { type: 'array', items: { type: 'object', properties: {
              area: { type: 'string' }, risk_level: { type: 'string' }, trigger: { type: 'string' }
            }}},
            risk_events: { type: 'array', items: { type: 'string' } },
            preventive_actions: { type: 'array', items: { type: 'object', properties: {
              action: { type: 'string' }, priority: { type: 'string' }, prevents: { type: 'string' }
            }}},
            quality_debt: { type: 'string' },
            early_warning_indicators: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 22. COMPLIANCE CHECKLIST ────────────────────────────────────────────
    if (action === 'compliance_checklist') {
      const { compliance_type, business_context } = params;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a comprehensive compliance checklist and assessment.

Compliance type: ${compliance_type || 'general business compliance'}
Business context: ${business_context || target || 'digital business operations'}

Compliance checklist:
1. **Data Privacy** (GDPR/CCPA): consent management, data rights, breach notification
2. **Security compliance**: access controls, encryption, audit logging, pen testing
3. **Content compliance**: required disclosures, advertising standards, copyright
4. **Financial compliance**: record-keeping, reporting, fraud prevention
5. **Operational compliance**: SLAs, contracts, vendor management
6. **Industry-specific**: relevant sector regulations
7. **Status assessment** for each area: Compliant / Partially Compliant / Non-Compliant / Unknown
8. **Critical gaps**: items that require immediate attention
9. **Remediation plan** with timelines and owners
10. **Certification readiness** if targeting ISO, SOC2, etc.`,
        response_json_schema: {
          type: 'object',
          properties: {
            overall_compliance_score: { type: 'number' },
            checklist: { type: 'array', items: { type: 'object', properties: {
              category: { type: 'string' },
              requirement: { type: 'string' },
              status: { type: 'string' },
              gap: { type: 'string' },
              priority: { type: 'string' }
            }}},
            critical_gaps: { type: 'array', items: { type: 'string' } },
            remediation_plan: { type: 'array', items: { type: 'object', properties: {
              action: { type: 'string' }, owner: { type: 'string' }, deadline: { type: 'string' }
            }}}
          }
        }
      });
    }

    // ─── 23. COST OF QUALITY ─────────────────────────────────────────────────
    if (action === 'cost_of_quality') {
      const [incidents, tickets] = await Promise.all([loadIncidents(), loadTickets()]);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Calculate and analyze the cost of quality for the business.

Current quality state:
- Open bugs: ${incidents.filter(i => i.status !== 'resolved').length}
- Critical bugs: ${incidents.filter(i => i.severity === 'critical').length}
- Support tickets: ${tickets.length}
- Resolved incidents: ${incidents.filter(i => i.status === 'resolved').length}

Cost of quality analysis:
1. **Cost of Poor Quality (COPQ)**:
   - Internal failure costs: rework time, bug fixing, retesting
   - External failure costs: support volume, customer churn, reputation damage
   - Estimated dollar impact per category
2. **Cost of Good Quality (COGQ)**:
   - Prevention costs: QA investment, testing infrastructure, training
   - Appraisal costs: auditing, inspections, monitoring
3. **Quality ROI**: for every $1 spent on prevention, how much is saved in failure costs?
4. **Benchmark comparison**: industry standard COPQ as % of revenue
5. **Priority investments**: where to invest in quality for maximum ROI
6. **Quality dividend**: projected savings from fixing top issues`,
        response_json_schema: {
          type: 'object',
          properties: {
            total_copq_estimate: { type: 'string' },
            internal_failure_costs: { type: 'object' },
            external_failure_costs: { type: 'object' },
            quality_roi_ratio: { type: 'string' },
            industry_benchmark: { type: 'string' },
            priority_investments: { type: 'array', items: { type: 'object', properties: {
              investment: { type: 'string' }, cost: { type: 'string' }, expected_saving: { type: 'string' }, roi: { type: 'string' }
            }}},
            quality_dividend: { type: 'string' }
          }
        }
      });
    }

    // ─── LEGACY: AB TEST ────────────────────────────────────────────────────
    if (action === 'ab_test') {
      const abtests = await base44.asServiceRole.entities.ABTest.list().then(
        t => t.filter(x => x.status === 'completed')
      ).catch(() => []);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze A/B test results for statistical significance and actionable recommendations.
Tests: ${JSON.stringify(abtests.map(t => ({
  test_name: t.test_name,
  variant_a_engagement: t.variant_a?.engagement_rate,
  variant_b_engagement: t.variant_b?.engagement_rate,
  sample_size: (t.variant_a?.posts_using_this || 0) + (t.variant_b?.posts_using_this || 0)
})))}
Provide: statistical significance, winner confidence, effect size, rollout recommendation, next test suggestions.`,
        response_json_schema: {
          type: 'object',
          properties: {
            significant_tests: { type: 'number' },
            recommendations: { type: 'array', items: { type: 'string' } },
            next_tests: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // Inspect 2.0 orchestration actions
    if (action === 'quality_strategy_command') {
      const [incidents, tickets, metrics] = await Promise.all([loadIncidents(), loadTickets(), loadMetrics()]);
      const openCritical = incidents.filter((i) => i.severity === 'critical' && i.status !== 'resolved').length;
      const openHigh = incidents.filter((i) => i.severity === 'high' && i.status !== 'resolved').length;
      const openTickets = tickets.filter((t) => t.status === 'open').length;
      const anomalySignals = metrics.filter((m) => String(m.name || '').toLowerCase().includes('error') || String(m.name || '').toLowerCase().includes('latency')).length;
      const qualityScore = Math.max(0, 100 - (openCritical * 20 + openHigh * 8 + Math.min(openTickets, 20) + Math.min(anomalySignals, 10)));

      result = {
        quality_score: qualityScore,
        posture: qualityScore >= 80 ? 'stable' : qualityScore >= 60 ? 'attention_required' : 'critical',
        snapshot: {
          open_critical_incidents: openCritical,
          open_high_incidents: openHigh,
          open_tickets: openTickets,
          anomaly_signals: anomalySignals,
        },
        strategic_priorities: [
          'Contain critical and high severity incident backlog',
          'Harden release gate before next production deploy',
          'Reduce repeat ticket themes via root-cause correction',
        ],
      };
    }

    if (action === 'quality_gate_orchestrator') {
      const release = String(params.release_name || 'Current Release');
      const minPassRate = Number(params.min_pass_rate || 90);
      const [incidents] = await Promise.all([loadIncidents()]);
      const blockers = incidents.filter((i) => ['critical', 'high'].includes(String(i.severity || '').toLowerCase()) && i.status !== 'resolved').length;
      const simulatedPassRate = Math.max(70, 98 - blockers * 5);

      result = {
        release_name: release,
        gate_inputs: {
          min_pass_rate: minPassRate,
          simulated_pass_rate: simulatedPassRate,
          unresolved_blockers: blockers,
        },
        gate_decision: simulatedPassRate >= minPassRate && blockers === 0 ? 'GO' : 'NO_GO',
        required_actions: blockers > 0
          ? ['Resolve critical/high incidents', 'Re-run smoke + regression suite', 'Re-check release_readiness']
          : ['Run final smoke test', 'Enable canary + post-release monitors'],
      };
    }

    if (action === 'predictive_defect_risk') {
      const changeSummary = String(params.change_summary || 'General product changes');
      const [incidents, tasks] = await Promise.all([loadIncidents(), loadTasks()]);
      const unresolved = incidents.filter((i) => i.status !== 'resolved').length;
      const overdueTasks = tasks.filter((t) => t.status !== 'done').length;
      const riskScore = Math.min(100, 35 + unresolved * 3 + Math.min(overdueTasks, 15) * 2);
      result = {
        change_summary: changeSummary,
        predicted_risk_score: riskScore,
        risk_level: riskScore >= 75 ? 'high' : riskScore >= 55 ? 'medium' : 'low',
        leading_indicators: [
          `Unresolved incident load: ${unresolved}`,
          `Open workflow debt: ${overdueTasks}`,
          'Regression exposure elevated in recent change window',
        ],
        preventive_controls: [
          'Run targeted regression on changed components',
          'Add one negative-path test per high-risk endpoint',
          'Increase monitoring sensitivity for first 48h post-release',
        ],
      };
    }

    if (action === 'process_conformance_command') {
      const workflows = await loadWorkflows();
      const inFlight = workflows.filter((w) => w.status !== 'completed').length;
      result = {
        workflows_in_scope: workflows.length,
        in_flight_workflows: inFlight,
        conformance_score: Math.max(40, 92 - Math.min(inFlight, 20) * 2),
        top_deviation_patterns: [
          'Missing QA checkpoint before handoff',
          'Late-stage requirement changes without re-validation',
          'Insufficient closure evidence in resolved items',
        ],
        corrective_actions: [
          'Enforce mandatory QA gate in Atlas workflow templates',
          'Attach evidence artifacts to task completion',
          'Add automated SLA breach warning thresholds',
        ],
      };
    }

    if (action === 'inspect_full_self_test') {
      const [incidents, tickets, metrics, tasks] = await Promise.all([
        loadIncidents(),
        loadTickets(),
        loadMetrics(),
        loadTasks(),
      ]);
      const openCritical = incidents.filter((i) => i.severity === 'critical' && i.status !== 'resolved').length;
      const openHigh = incidents.filter((i) => i.severity === 'high' && i.status !== 'resolved').length;
      const openTickets = tickets.filter((t) => t.status === 'open').length;
      const qaTasksOpen = tasks.filter((t) => String(t.title || '').toLowerCase().includes('qa') && t.status !== 'done').length;
      const signalCoverage = metrics.length > 0;

      const checks = {
        no_open_critical: openCritical === 0,
        high_severity_controlled: openHigh <= 3,
        support_backlog_controlled: openTickets <= 25,
        qa_work_queue_healthy: qaTasksOpen <= 15,
        observability_signals_present: signalCoverage,
      };

      result = {
        checks,
        operations: {
          open_critical_incidents: openCritical,
          open_high_incidents: openHigh,
          open_support_tickets: openTickets,
          open_qa_tasks: qaTasksOpen,
          metrics_signals: metrics.length,
        },
        readiness: {
          release_gate_posture: checks.no_open_critical && checks.high_severity_controlled ? 'ready_with_monitoring' : 'hold_release',
          recommended_next_run: '24h',
        },
        priorities_7d: [
          'Drive critical/high incident burn-down',
          'Run release_readiness and quality_dashboard before deployment',
          'Close recurring root-cause categories via CAPA actions',
        ],
      };
    }
    if (!result) {
      result = { message: `Action '${action}' received. Available actions: run_tests, regression_test, performance_test, security_scan, api_test, accessibility_audit, content_qa, brand_voice_check, fact_check, process_audit, sla_check, data_quality_audit, root_cause_analysis, release_readiness, pre_launch_checklist, support_qa, feedback_analysis, anomaly_detection, quality_dashboard, bug_triage, quality_forecast, compliance_checklist, cost_of_quality, ab_test, monitor_performance, quality_strategy_command, quality_gate_orchestrator, predictive_defect_risk, process_conformance_command, inspect_full_self_test` };
    }

    return Response.json({ status: 'inspect_complete', action, result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
