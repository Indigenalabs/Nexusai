import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const { action, ...params } = payload;

    // ─── 1. CONTINUOUS THREAT DETECTION ───────────────────────────────────────

    if (action === 'network_traffic_analysis') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's network traffic analysis engine. Perform a simulated network traffic analysis for a business.
Business context: ${JSON.stringify(params.context || {})}
Analyze for:
- Anomalous inbound/outbound traffic patterns
- Potential data exfiltration attempts
- Command & control (C2) communication patterns
- Unusual port activity or protocol abuse
- DNS tunneling indicators
- Bandwidth anomalies by time/source
Provide: threat level (CRITICAL/HIGH/MEDIUM/LOW/CLEAR), findings, IoCs detected, recommended firewall rules, and next steps.`,
        response_json_schema: {
          type: 'object',
          properties: {
            threat_level: { type: 'string' },
            anomalies: { type: 'array', items: { type: 'object', properties: { type: { type: 'string' }, description: { type: 'string' }, severity: { type: 'string' }, source_ip: { type: 'string' }, recommendation: { type: 'string' } } } },
            iocs_detected: { type: 'array', items: { type: 'string' } },
            firewall_rules_recommended: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    if (action === 'endpoint_detection_response') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's EDR engine. Analyze endpoint security for a business with the following context:
Endpoints: ${JSON.stringify(params.endpoints || 'typical SME: 10-50 workstations, 2-5 servers')}
Check for:
- Suspicious process executions (LOLBins, PowerShell abuse, unusual parent-child chains)
- Unauthorized file system changes (system directories, startup locations)
- Registry modifications (persistence mechanisms, autorun keys)
- Lateral movement indicators (remote service creation, pass-the-hash)
- Unusual network connections from endpoints
- Behavioral anomalies vs baseline
Provide risk-scored findings with remediation steps for each.`,
        response_json_schema: {
          type: 'object',
          properties: {
            overall_risk: { type: 'string' },
            endpoint_findings: { type: 'array', items: { type: 'object', properties: { endpoint: { type: 'string' }, issue: { type: 'string' }, severity: { type: 'string' }, evidence: { type: 'string' }, action: { type: 'string' } } } },
            containment_actions: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    if (action === 'cloud_security_scan') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's cloud security posture management engine. Perform a cloud security assessment.
Cloud environment: ${JSON.stringify(params.cloud_env || 'AWS/GCP/Azure mixed')}
Scan for:
- S3/GCS/Blob storage buckets with public read/write access
- Overly permissive IAM roles (wildcard permissions, *)
- Security groups / firewall rules with 0.0.0.0/0 on sensitive ports (22, 3389, 5432)
- Unencrypted data stores (RDS, S3 without SSE)
- CloudTrail/audit logging gaps
- Unused access keys older than 90 days
- MFA not enforced on root/privileged accounts
- Unused elastic IPs or exposed admin consoles
Score each finding by CVSS severity and provide exact remediation commands/steps.`,
        response_json_schema: {
          type: 'object',
          properties: {
            posture_score: { type: 'number', description: '0-100, higher is better' },
            critical_misconfigs: { type: 'array', items: { type: 'object', properties: { resource: { type: 'string' }, issue: { type: 'string' }, severity: { type: 'string' }, cvss: { type: 'number' }, remediation: { type: 'string' } } } },
            compliance_gaps: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    if (action === 'identity_access_monitoring') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's identity & access monitoring (UEBA) engine.
Context: ${JSON.stringify(params)}
Analyze authentication and access patterns for:
- Impossible travel (login from Sydney then London 2h apart)
- Brute force / credential stuffing patterns (>10 failed attempts)
- Privilege escalation attempts
- Dormant accounts that suddenly become active
- Service account misuse (interactive logins)
- Off-hours logins for non-admin staff
- Concurrent sessions from different geographies
- Mass data access / download events
Provide: risk-scored user list, specific suspicious events, recommended IAM policy changes, accounts to review/disable.`,
        response_json_schema: {
          type: 'object',
          properties: {
            high_risk_users: { type: 'array', items: { type: 'object', properties: { user: { type: 'string' }, risk_score: { type: 'number' }, reason: { type: 'string' }, action: { type: 'string' } } } },
            suspicious_events: { type: 'array', items: { type: 'object', properties: { event: { type: 'string' }, severity: { type: 'string' }, timestamp: { type: 'string' }, details: { type: 'string' } } } },
            iam_recommendations: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    if (action === 'application_security_scan') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's application security scanner (DAST + SAST analysis).
Application context: ${JSON.stringify(params)}
Scan for OWASP Top 10:
1. Broken Access Control
2. Cryptographic Failures (weak TLS, plaintext storage)
3. Injection (SQL, NoSQL, LDAP, OS command)
4. Insecure Design
5. Security Misconfiguration
6. Vulnerable and Outdated Components
7. Identification and Authentication Failures
8. Software and Data Integrity Failures
9. Security Logging and Monitoring Failures
10. Server-Side Request Forgery (SSRF)
Also check: API security (rate limiting, auth on all endpoints), dependency vulnerabilities (CVEs), hardcoded secrets in code.
Output: CVSS-scored findings with proof-of-concept description and exact remediation code/config.`,
        response_json_schema: {
          type: 'object',
          properties: {
            owasp_findings: { type: 'array', items: { type: 'object', properties: { category: { type: 'string' }, vulnerability: { type: 'string' }, severity: { type: 'string' }, cvss_score: { type: 'number' }, description: { type: 'string' }, remediation: { type: 'string' } } } },
            dependency_cves: { type: 'array', items: { type: 'object', properties: { package: { type: 'string' }, cve: { type: 'string' }, severity: { type: 'string' }, fix_version: { type: 'string' } } } },
            risk_score: { type: 'number' },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    if (action === 'third_party_supply_chain_risk') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's third-party and supply chain risk assessment engine.
Vendors/partners to assess: ${JSON.stringify(params.vendors || [])}
For each vendor evaluate:
- Security posture score (based on known public breach history, certifications)
- Data access scope (what data do they touch?)
- Contractual security requirements (DPA, right to audit)
- SLA and breach notification obligations
- SOC 2 / ISO 27001 certification status
- Dependency risk (what breaks if this vendor goes down?)
- Recent CVEs in their software/platform
- Geographic jurisdiction and data sovereignty risk
Produce: vendor risk registry with tiers (Critical/High/Medium/Low), specific remediation actions per vendor, and recommended contract clauses.`,
        response_json_schema: {
          type: 'object',
          properties: {
            vendor_risk_registry: { type: 'array', items: { type: 'object', properties: { vendor: { type: 'string' }, risk_tier: { type: 'string' }, risk_score: { type: 'number' }, data_access: { type: 'string' }, certified: { type: 'boolean' }, key_risks: { type: 'array', items: { type: 'string' } }, remediation: { type: 'string' } } } },
            critical_vendors: { type: 'array', items: { type: 'string' } },
            contract_clauses_needed: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    if (action === 'dark_web_monitoring') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's dark web and threat intelligence monitoring engine.
Organization: ${JSON.stringify(params.org_details || {})}
Simulate a dark web scan report for:
- Leaked credentials (email/password combos from breach databases)
- Exposed API keys or tokens
- Company data for sale (customer lists, financial data, IP)
- Planned attacks or discussions targeting this organization/sector
- Impersonation domains or phishing kits
- Executive personal data exposure (doxing risk)
- Mention of organization name in hacker forums
- Dark web paste sites with company data
Provide: exposure severity, specific data types found, recommended immediate actions (password resets, API key rotation, legal action), and monitoring cadence.`,
        response_json_schema: {
          type: 'object',
          properties: {
            exposure_level: { type: 'string' },
            leaked_credentials_count: { type: 'number' },
            exposures: { type: 'array', items: { type: 'object', properties: { type: { type: 'string' }, description: { type: 'string' }, severity: { type: 'string' }, source: { type: 'string' }, action: { type: 'string' } } } },
            executive_exposure: { type: 'array', items: { type: 'string' } },
            immediate_actions: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' }
          }
        },
        add_context_from_internet: true
      });
      return Response.json(result);
    }

    // ─── 2. THREAT INTELLIGENCE & ANALYSIS ────────────────────────────────────

    if (action === 'threat_intelligence_feed') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's threat intelligence analyst. Generate a current threat intelligence briefing.
Sector: ${params.sector || 'Healthcare/NDIS/E-commerce'}
Date: ${new Date().toISOString().split('T')[0]}
Include:
- Top 5 active threat actors targeting this sector (with TTPs from MITRE ATT&CK)
- Active CVEs being exploited in the wild (CVSS ≥7.0)
- Current ransomware groups and their preferred initial access vectors
- Phishing campaign indicators (subject lines, sender patterns, URLs)
- Emerging attack techniques (AI-generated phishing, deepfakes, etc.)
- MITRE ATT&CK techniques to monitor this week
- Recommended detection rules (Sigma format or plain English)
Be specific with IOCs, CVE numbers, and threat actor names.`,
        response_json_schema: {
          type: 'object',
          properties: {
            threat_level_overall: { type: 'string' },
            active_threat_actors: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, sector_targeting: { type: 'string' }, primary_ttp: { type: 'string' }, mitre_techniques: { type: 'array', items: { type: 'string' } } } } },
            critical_cves: { type: 'array', items: { type: 'object', properties: { cve_id: { type: 'string' }, cvss: { type: 'number' }, description: { type: 'string' }, exploitation_status: { type: 'string' }, patch_available: { type: 'boolean' } } } },
            phishing_indicators: { type: 'array', items: { type: 'string' } },
            detection_rules: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' }
          }
        },
        add_context_from_internet: true
      });
      return Response.json(result);
    }

    if (action === 'behavioral_analytics_ueba') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's User and Entity Behavior Analytics (UEBA) engine.
Analyze behavioral patterns for: ${JSON.stringify(params)}
Using machine learning baseline analysis, identify:
- Users whose behavior has deviated >3 standard deviations from their normal baseline
- Entities (devices, servers, apps) with anomalous communication patterns
- Insider threat indicators (data hoarding, after-hours access, unusual printing)
- Account sharing indicators
- Privilege creep patterns
- Data staging before exfiltration (large zip files, unusual cloud uploads)
Risk-score each user/entity and categorize threat type (malicious insider, compromised account, negligent user).`,
        response_json_schema: {
          type: 'object',
          properties: {
            high_risk_entities: { type: 'array', items: { type: 'object', properties: { entity: { type: 'string' }, entity_type: { type: 'string' }, risk_score: { type: 'number' }, threat_type: { type: 'string' }, anomalies: { type: 'array', items: { type: 'string' } }, recommended_action: { type: 'string' } } } },
            insider_threat_indicators: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    if (action === 'malware_analysis') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's malware analysis engine (sandboxing simulation).
File/URL to analyze: ${JSON.stringify(params.target || 'suspicious_attachment.exe')}
Indicators provided: ${JSON.stringify(params.indicators || {})}
Perform dynamic and static analysis simulation:
- File hash and reputation lookup (VirusTotal-style)
- Behavioral analysis (what does it do on execution?)
- Network communications (C2 domains, IPs, protocols)
- Persistence mechanisms (registry, scheduled tasks, services)
- Evasion techniques detected (sandbox detection, code obfuscation)
- Malware family classification (ransomware, RAT, stealer, dropper)
- MITRE ATT&CK technique mapping
- Extracted IOCs for blocking
- Clean-up and remediation steps`,
        response_json_schema: {
          type: 'object',
          properties: {
            verdict: { type: 'string', description: 'MALICIOUS/SUSPICIOUS/CLEAN' },
            malware_family: { type: 'string' },
            threat_score: { type: 'number' },
            behaviors: { type: 'array', items: { type: 'string' } },
            c2_indicators: { type: 'array', items: { type: 'string' } },
            persistence_mechanisms: { type: 'array', items: { type: 'string' } },
            mitre_techniques: { type: 'array', items: { type: 'string' } },
            iocs: { type: 'array', items: { type: 'string' } },
            remediation_steps: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    if (action === 'attack_surface_mapping') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's attack surface management engine.
Organization: ${JSON.stringify(params.org || {})}
Discover and map the entire attack surface:
- External-facing assets (domains, subdomains, IPs, cloud resources)
- Exposed admin interfaces (Grafana, Kibana, Jenkins, Kubernetes dashboards)
- Shadow IT (unmanaged SaaS, personal devices, unauthorized cloud)
- Open source intelligence (OSINT) exposure (LinkedIn enumeration, GitHub leaks, Google dorks)
- Email security posture (SPF, DKIM, DMARC config)
- Certificate transparency exposure
- Exposed development/staging environments
- Third-party JavaScript risks (supply chain via JS)
For each asset: exposure severity, ownership, business impact if compromised, remediation priority.`,
        response_json_schema: {
          type: 'object',
          properties: {
            total_attack_surface_score: { type: 'number' },
            exposed_assets: { type: 'array', items: { type: 'object', properties: { asset: { type: 'string' }, type: { type: 'string' }, severity: { type: 'string' }, exposure: { type: 'string' }, remediation: { type: 'string' } } } },
            shadow_it_detected: { type: 'array', items: { type: 'string' } },
            email_security: { type: 'object', properties: { spf: { type: 'string' }, dkim: { type: 'string' }, dmarc: { type: 'string' }, risk: { type: 'string' } } },
            osint_exposure: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    if (action === 'threat_hunting') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's proactive threat hunting analyst.
Hypothesis: ${params.hypothesis || 'Threat actor may have established persistence in the environment'}
Time range: ${params.time_range || 'Last 30 days'}
Hunt across all telemetry for:
- Evidence supporting or refuting the hypothesis
- Unusual LOLBIN usage (wmic, certutil, regsvr32, mshta, rundll32)
- WMI subscription persistence
- Scheduled task anomalies
- Service installation events
- Network beaconing patterns (regular intervals, jitter analysis)
- DNS resolution patterns for known bad TLDs
- Memory-only malware indicators
- Kerberoasting / AS-REP roasting artifacts
Provide: hunting queries (KQL/SPL format), evidence found, confidence level, and recommended follow-up hunts.`,
        response_json_schema: {
          type: 'object',
          properties: {
            hypothesis_verdict: { type: 'string' },
            confidence: { type: 'number' },
            evidence_found: { type: 'array', items: { type: 'object', properties: { finding: { type: 'string' }, severity: { type: 'string' }, evidence: { type: 'string' }, query: { type: 'string' } } } },
            threat_confirmed: { type: 'boolean' },
            follow_up_hunts: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    // ─── 3. INCIDENT RESPONSE & REMEDIATION ───────────────────────────────────

    if (action === 'automated_containment') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's automated incident response and containment engine.
Incident: ${JSON.stringify(params.incident || {})}
Threat type: ${params.threat_type || 'unknown'}
Execute containment playbook:
1. Immediate isolation actions (network quarantine, session revocation, IP blocking)
2. Account actions (disable, force password reset, revoke tokens)
3. System actions (snapshot, kill process, rollback)
4. Evidence preservation steps (before making changes)
5. Stakeholder notifications (who gets notified, how, within what timeframe)
6. Regulatory obligations (do we need to notify OAIC within 30 days? NDIS Quality Commission?)
7. Business continuity steps (how do we keep operating?)
Provide a timestamped incident response playbook with exact commands/actions and owner for each step.`,
        response_json_schema: {
          type: 'object',
          properties: {
            containment_phase: { type: 'array', items: { type: 'object', properties: { step: { type: 'number' }, action: { type: 'string' }, command: { type: 'string' }, owner: { type: 'string' }, timing: { type: 'string' } } } },
            eradication_phase: { type: 'array', items: { type: 'string' } },
            recovery_phase: { type: 'array', items: { type: 'string' } },
            notifications_required: { type: 'array', items: { type: 'object', properties: { recipient: { type: 'string' }, timeframe: { type: 'string' }, method: { type: 'string' } } } },
            regulatory_obligations: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    if (action === 'incident_playbook') {
      const incidentType = params.incident_type || 'ransomware';
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's SOAR playbook engine. Generate a complete incident response playbook for: ${incidentType}
Include all phases:
DETECTION: How to confirm this is actually happening (not a false positive)
CONTAINMENT (0-30 min): Immediate actions to stop the bleeding
ERADICATION (30min-24h): Remove the threat completely
RECOVERY (24h-72h): Restore normal operations safely
POST-INCIDENT (1-2 weeks): Lessons learned, hardening, report

For each action specify: exact steps, tools needed, owner (IT/Legal/HR/Exec/Comms), decision criteria, and rollback options.
Australian context: include OAIC notification requirements, NDIS Commission reporting if participant data involved, and ACSC advisory steps.
Also include: communication templates for staff, customers, and media (if applicable).`,
        response_json_schema: {
          type: 'object',
          properties: {
            playbook_name: { type: 'string' },
            severity_classification: { type: 'string' },
            detection_criteria: { type: 'array', items: { type: 'string' } },
            containment_steps: { type: 'array', items: { type: 'object', properties: { step: { type: 'string' }, action: { type: 'string' }, owner: { type: 'string' }, timeframe: { type: 'string' } } } },
            eradication_steps: { type: 'array', items: { type: 'string' } },
            recovery_steps: { type: 'array', items: { type: 'string' } },
            communication_templates: { type: 'object', properties: { staff: { type: 'string' }, customers: { type: 'string' }, regulator: { type: 'string' } } },
            regulatory_requirements: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    if (action === 'forensic_collection') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's digital forensics collection engine.
Incident scope: ${JSON.stringify(params)}
Generate a forensic collection plan:
- Evidence sources to collect (in priority order, most volatile first)
- Collection methodology (live acquisition vs dead disk, chain of custody)
- Hash verification procedures
- Timeline reconstruction approach
- Artifact types to prioritize (prefetch, shellbags, MFT, event logs, memory)
- Log sources to collect and retention verification
- Evidence storage and integrity protection
- Chain of custody documentation template
- Legal hold requirements
Also: determine if this meets the threshold for law enforcement referral (AFP/state police) or regulatory report (ACSC, OAIC).`,
        response_json_schema: {
          type: 'object',
          properties: {
            evidence_collection_order: { type: 'array', items: { type: 'object', properties: { priority: { type: 'number' }, source: { type: 'string' }, method: { type: 'string' }, rationale: { type: 'string' } } } },
            timeline_reconstruction: { type: 'array', items: { type: 'string' } },
            law_enforcement_threshold_met: { type: 'boolean' },
            regulatory_reports_required: { type: 'array', items: { type: 'string' } },
            chain_of_custody_template: { type: 'string' },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    if (action === 'system_restoration') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's system restoration and recovery engine.
Incident details: ${JSON.stringify(params)}
Plan a safe, verified system restoration:
- Backup integrity verification steps (before restoring)
- Restoration sequence (most critical systems first)
- Verification checks after each restoration step
- Re-infection prevention measures (don't restore from infected backup)
- Network re-admission criteria (what must be clean before reconnecting)
- User account restoration procedure
- Data integrity verification
- Monitoring uplift post-restoration (what extra logging to enable)
- Business continuity during restoration (who can work, how, from where)
Timeline estimate for full restoration by system tier.`,
        response_json_schema: {
          type: 'object',
          properties: {
            restoration_sequence: { type: 'array', items: { type: 'object', properties: { tier: { type: 'number' }, system: { type: 'string' }, backup_date: { type: 'string' }, steps: { type: 'array', items: { type: 'string' } }, verification: { type: 'string' }, eta_hours: { type: 'number' } } } },
            pre_restoration_checks: { type: 'array', items: { type: 'string' } },
            network_readmission_criteria: { type: 'array', items: { type: 'string' } },
            monitoring_uplift: { type: 'array', items: { type: 'string' } },
            total_eta_hours: { type: 'number' },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    // ─── 4. IDENTITY & ACCESS MANAGEMENT ──────────────────────────────────────

    if (action === 'privileged_access_audit') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's privileged access management auditor.
Organization context: ${JSON.stringify(params)}
Audit all privileged access:
- Admin accounts: are they dedicated (no email/browsing on admin accounts)?
- Service accounts: do they have interactive login rights? Passwords rotated?
- Root/sudo access: is it logged and time-limited?
- Shared credentials: any team accounts that should be individual?
- API keys: rotation policy, least privilege, not stored in code?
- Database admin access: direct production access vs through PAM?
- Cloud root accounts: MFA enforced? Access keys disabled?
- Vendor remote access: time-limited, monitored, VPN-less where possible?
Produce: privileged access risk register, accounts to disable immediately, policy gaps, PAM implementation roadmap.`,
        response_json_schema: {
          type: 'object',
          properties: {
            privileged_access_risk_score: { type: 'number' },
            high_risk_accounts: { type: 'array', items: { type: 'object', properties: { account: { type: 'string' }, type: { type: 'string' }, risk: { type: 'string' }, action: { type: 'string' } } } },
            policy_gaps: { type: 'array', items: { type: 'string' } },
            immediate_actions: { type: 'array', items: { type: 'string' } },
            pam_roadmap: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    if (action === 'mfa_enforcement_check') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's MFA and authentication security auditor.
Context: ${JSON.stringify(params)}
Audit MFA and authentication security:
- Which applications have MFA enabled vs disabled?
- MFA method strength ranking (FIDO2/passkeys > TOTP app > SMS > email)
- Users/accounts without MFA (especially privileged)
- MFA bypass opportunities (legacy protocols: SMTP AUTH, IMAP, POP3)
- Conditional access policies in place
- Session token lifetime and re-authentication requirements
- SSO configuration risks
- Password policy enforcement (length, complexity, breach checking)
Recommend: MFA enforcement priority list, legacy protocol blocking approach, step-up authentication rules.`,
        response_json_schema: {
          type: 'object',
          properties: {
            mfa_coverage_percent: { type: 'number' },
            unprotected_apps: { type: 'array', items: { type: 'string' } },
            mfa_bypass_risks: { type: 'array', items: { type: 'string' } },
            enforcement_priority: { type: 'array', items: { type: 'object', properties: { app: { type: 'string' }, users_affected: { type: 'number' }, risk: { type: 'string' }, timeline: { type: 'string' } } } },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    if (action === 'access_review_certification') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's access review and certification engine.
Run a quarterly access review:
Context: ${JSON.stringify(params)}
Review scope:
- All user access rights vs job role requirements (least privilege)
- Terminated employees with active accounts (orphaned accounts)
- Role changes where old permissions weren't removed (accumulation)
- External/contractor access that should have expired
- Application-specific excessive permissions
- Group memberships that grant unintended access
- Service accounts with more access than needed
For each finding: business justification check, recommendation (keep/reduce/revoke), and owner to confirm.
Output: access certification report ready for manager review.`,
        response_json_schema: {
          type: 'object',
          properties: {
            accounts_reviewed: { type: 'number' },
            access_to_revoke: { type: 'array', items: { type: 'object', properties: { account: { type: 'string' }, access: { type: 'string' }, reason: { type: 'string' }, action: { type: 'string' } } } },
            orphaned_accounts: { type: 'array', items: { type: 'string' } },
            excessive_permissions: { type: 'array', items: { type: 'object', properties: { account: { type: 'string' }, permission: { type: 'string' }, recommendation: { type: 'string' } } } },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    // ─── 5. DATA PROTECTION & PRIVACY ─────────────────────────────────────────

    if (action === 'dlp_scan') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's Data Loss Prevention engine.
Context: ${JSON.stringify(params)}
Scan for sensitive data at risk:
- PII in transit (emails, uploads, cloud sync) without encryption
- Financial data (credit cards, bank details) in unsecured locations
- Health information (PHI) — for NDIS providers: participant health data outside approved systems
- IP and trade secrets being sent externally
- Large data exports that could indicate exfiltration
- Cloud storage with sensitive data publicly accessible
- Email forwarding rules to external addresses (hidden data exfiltration)
- USB/removable media usage patterns
For Australian context: Privacy Act 1988 sensitive information categories, My Health Records Act, NDIS Privacy Rule.
Output: DLP incident register, policy rule recommendations, and blocking actions to implement.`,
        response_json_schema: {
          type: 'object',
          properties: {
            dlp_incidents: { type: 'array', items: { type: 'object', properties: { type: { type: 'string' }, description: { type: 'string' }, severity: { type: 'string' }, affected_data: { type: 'string' }, action: { type: 'string' } } } },
            policy_rules_needed: { type: 'array', items: { type: 'string' } },
            regulatory_risks: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    if (action === 'sensitive_data_discovery') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's sensitive data discovery engine.
Scan all data repositories:
Context: ${JSON.stringify(params)}
Discover and classify sensitive data across:
- Databases (look for columns named: ssn, dob, credit_card, password, health, diagnosis)
- File shares (Excel with PII, unencrypted PDFs with participant info)
- Email archives (sensitive attachments sent without encryption)
- Cloud storage (public S3 buckets, SharePoint with broad permissions)
- Source code repositories (hardcoded credentials, API keys, connection strings)
- Backup files (often forgotten, often unencrypted)
- Log files (that may contain PII inadvertently)
For each finding: data type, location, sensitivity level, regulatory framework applicable, remediation steps.
Australian context: Privacy Act APP 11 (security of personal information).`,
        response_json_schema: {
          type: 'object',
          properties: {
            total_sensitive_records_at_risk: { type: 'number' },
            data_findings: { type: 'array', items: { type: 'object', properties: { location: { type: 'string' }, data_type: { type: 'string' }, records_count: { type: 'number' }, sensitivity: { type: 'string' }, regulation: { type: 'string' }, remediation: { type: 'string' } } } },
            highest_risk_repositories: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    if (action === 'privacy_compliance_check') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's privacy compliance auditor for Australian businesses.
Context: ${JSON.stringify(params)}
Audit against:
1. Privacy Act 1988 — Australian Privacy Principles (APPs 1-13)
2. NDIS Privacy Rule 2014 (if NDIS provider)
3. My Health Records Act 2012 (if handling health data)
4. Notifiable Data Breaches (NDB) Scheme — what triggers notification, to whom, within what timeframe
5. Aged Care Act 1997 — resident privacy obligations
6. GDPR (if EU customers)
For each APP, assess: compliance status, gaps, and remediation steps.
Also check: Privacy Policy (published, current, accurate), consent collection mechanisms, DSARs process, data retention policy, cross-border data transfer controls.
Output: compliance scorecard, breach risk assessment, and compliance roadmap.`,
        response_json_schema: {
          type: 'object',
          properties: {
            overall_compliance_score: { type: 'number' },
            app_compliance: { type: 'array', items: { type: 'object', properties: { principle: { type: 'string' }, status: { type: 'string' }, gaps: { type: 'array', items: { type: 'string' } }, remediation: { type: 'string' } } } },
            ndb_readiness: { type: 'string' },
            breach_notification_process: { type: 'string' },
            high_priority_gaps: { type: 'array', items: { type: 'string' } },
            compliance_roadmap: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    // ─── 6. VULNERABILITY MANAGEMENT & PENETRATION TESTING ────────────────────

    if (action === 'vulnerability_scan') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's vulnerability management engine.
Scan scope: ${JSON.stringify(params)}
Perform a comprehensive vulnerability assessment:
- Known CVEs in operating systems, web servers, databases, and applications
- Patch status (missing critical patches with active exploits)
- Configuration vulnerabilities (default credentials, unnecessary services)
- Web application vulnerabilities (injection, auth bypass, IDOR)
- Network vulnerabilities (open ports, unencrypted protocols, routing issues)
- Container/Kubernetes misconfigurations
- Certificate issues (expired, self-signed, weak ciphers)
- API security gaps (no rate limiting, missing auth, verbose errors)
For each vuln: CVE ID, CVSS score, exploitability, business impact, patch/fix instructions, and priority ranking.
Consider: compensating controls that reduce actual risk vs theoretical CVSS score.`,
        response_json_schema: {
          type: 'object',
          properties: {
            vulnerability_summary: { type: 'object', properties: { critical: { type: 'number' }, high: { type: 'number' }, medium: { type: 'number' }, low: { type: 'number' } } },
            critical_vulnerabilities: { type: 'array', items: { type: 'object', properties: { cve_id: { type: 'string' }, cvss: { type: 'number' }, affected_system: { type: 'string' }, description: { type: 'string' }, exploited_in_wild: { type: 'boolean' }, fix: { type: 'string' }, priority: { type: 'string' } } } },
            patch_plan: { type: 'array', items: { type: 'object', properties: { patch: { type: 'string' }, systems: { type: 'array', items: { type: 'string' } }, schedule: { type: 'string' }, risk_if_delayed: { type: 'string' } } } },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    if (action === 'penetration_test_simulation') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's automated penetration testing engine.
Target scope: ${JSON.stringify(params.scope || 'external network + web applications')}
Test type: ${params.test_type || 'black box'}
Simulate a professional penetration test:
RECONNAISSANCE: OSINT findings, exposed infrastructure, employee enumeration
SCANNING: Open ports, service versions, potential entry points
EXPLOITATION: Attempted attack paths with success/fail outcomes
POST-EXPLOITATION: What could an attacker do with initial access? Lateral movement paths, data accessible.
REPORTING: Executive summary, technical findings, risk-ranked remediation list
Include: proof-of-concept descriptions, exploited vulnerabilities with CVE references, and recommended mitigations.
Ethical note: All simulated — for security awareness and remediation planning only.`,
        response_json_schema: {
          type: 'object',
          properties: {
            pentest_summary: { type: 'object', properties: { risk_rating: { type: 'string' }, critical_findings: { type: 'number' }, attack_paths_found: { type: 'number' }, data_accessible_if_breached: { type: 'array', items: { type: 'string' } } } },
            attack_paths: { type: 'array', items: { type: 'object', properties: { path: { type: 'string' }, steps: { type: 'array', items: { type: 'string' } }, success: { type: 'boolean' }, impact: { type: 'string' }, fix: { type: 'string' } } } },
            technical_findings: { type: 'array', items: { type: 'object', properties: { finding: { type: 'string' }, severity: { type: 'string' }, cvss: { type: 'number' }, remediation: { type: 'string' } } } },
            executive_summary: { type: 'string' },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    if (action === 'code_security_scan') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's code security (SAST/SCA) engine.
Repository/code context: ${JSON.stringify(params)}
Scan source code for:
- Hardcoded secrets (API keys, passwords, tokens, connection strings)
- SQL injection vulnerabilities (string concatenation in queries)
- Command injection risks
- Insecure deserialization
- Path traversal vulnerabilities
- Insecure random number generation (for security-sensitive operations)
- Unvalidated redirects
- Vulnerable dependency versions (SCA — software composition analysis)
- Missing security headers (CSP, HSTS, X-Frame-Options)
- Logging sensitive data (PII, passwords in logs)
Also provide: git commit history analysis for secrets accidentally committed and then deleted.`,
        response_json_schema: {
          type: 'object',
          properties: {
            secrets_found: { type: 'array', items: { type: 'object', properties: { type: { type: 'string' }, location: { type: 'string' }, severity: { type: 'string' }, action: { type: 'string' } } } },
            code_vulnerabilities: { type: 'array', items: { type: 'object', properties: { type: { type: 'string' }, file: { type: 'string' }, severity: { type: 'string' }, description: { type: 'string' }, fix: { type: 'string' } } } },
            vulnerable_dependencies: { type: 'array', items: { type: 'object', properties: { package: { type: 'string' }, current_version: { type: 'string' }, cve: { type: 'string' }, fix_version: { type: 'string' } } } },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    // ─── 7. COMPLIANCE & AUDIT READINESS ──────────────────────────────────────

    if (action === 'compliance_framework_audit') {
      const framework = params.framework || 'ISO27001';
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's compliance audit engine.
Framework: ${framework}
Organization: ${JSON.stringify(params.context || {})}
Perform a gap analysis against ${framework}:
For each control domain:
- Current implementation status (Implemented/Partial/Not Started/N/A)
- Gaps identified with specific evidence required
- Risk rating if gap not addressed
- Remediation effort estimate (hours/days)
- Priority score
Also assess:
- Evidence collection readiness (what docs/logs needed for audit)
- Audit trail completeness
- Policy documentation gaps
- Training and awareness gaps
Frameworks supported: ISO 27001, SOC 2 Type II, NIST CSF, PCI-DSS, Essential Eight (ACSC), HIPAA
For Australian businesses: focus on ACSC Essential Eight compliance level assessment.`,
        response_json_schema: {
          type: 'object',
          properties: {
            framework: { type: 'string' },
            overall_maturity: { type: 'string' },
            compliance_score: { type: 'number' },
            control_gaps: { type: 'array', items: { type: 'object', properties: { control: { type: 'string' }, status: { type: 'string' }, gap: { type: 'string' }, risk: { type: 'string' }, remediation: { type: 'string' }, effort_days: { type: 'number' } } } },
            evidence_gaps: { type: 'array', items: { type: 'string' } },
            roadmap_to_certification: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    if (action === 'essential_eight_assessment') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's ACSC Essential Eight maturity level assessor.
Organization: ${JSON.stringify(params)}
Assess all 8 Essential Eight strategies at Maturity Levels 0-3:
1. Application Control — which apps can run? Allowlisting in place?
2. Patch Applications — how fast are patches applied? Critical = <48h target
3. Configure Microsoft Office Macro Settings — macros blocked from internet?
4. User Application Hardening — Flash/Java/PDF disabled in browser?
5. Restrict Administrative Privileges — principle of least privilege enforced?
6. Patch Operating Systems — OS patch currency (target ML2: 2 weeks, ML3: 48h)
7. Multi-Factor Authentication — MFA for remote access, privileged accounts, O365?
8. Regular Backups — 3-2-1 rule, tested, disconnected/immutable copies?
For each: current maturity level (0/1/2/3), evidence required to prove it, gaps to next level, and recommended actions.`,
        response_json_schema: {
          type: 'object',
          properties: {
            target_maturity_level: { type: 'number' },
            current_maturity_level: { type: 'number' },
            strategies: { type: 'array', items: { type: 'object', properties: { strategy: { type: 'string' }, current_level: { type: 'number' }, target_level: { type: 'number' }, gaps: { type: 'array', items: { type: 'string' } }, actions: { type: 'array', items: { type: 'string' } } } } },
            highest_risk_gaps: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    if (action === 'risk_assessment') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's security risk quantification engine.
Organization: ${JSON.stringify(params)}
Perform a comprehensive security risk assessment:
For each identified risk:
- Risk description and threat scenario
- Likelihood (1-5: Rare/Unlikely/Possible/Likely/Almost Certain)
- Impact (1-5: Insignificant/Minor/Moderate/Major/Catastrophic)
- Risk rating (Likelihood × Impact matrix)
- Current controls in place
- Residual risk after controls
- Risk treatment option (Accept/Mitigate/Transfer/Avoid)
- Control recommendations
- Risk owner (role)
Also: quantify financial impact using FAIR methodology (annualized loss expectancy).
Australian context: include regulatory fines (Privacy Act up to $50M for serious breaches), reputational damage to NDIS registration, class action risk.
Output: risk register prioritized by residual risk rating.`,
        response_json_schema: {
          type: 'object',
          properties: {
            risk_register: { type: 'array', items: { type: 'object', properties: { risk_id: { type: 'string' }, risk: { type: 'string' }, likelihood: { type: 'number' }, impact: { type: 'number' }, rating: { type: 'string' }, current_controls: { type: 'string' }, residual_risk: { type: 'string' }, treatment: { type: 'string' }, ale_estimate: { type: 'string' }, owner: { type: 'string' } } } },
            top_5_risks: { type: 'array', items: { type: 'string' } },
            total_cyber_risk_exposure: { type: 'string' },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    // ─── 8. PHYSICAL & IOT SECURITY ───────────────────────────────────────────

    if (action === 'physical_security_assessment') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's physical security assessment engine.
Facility: ${JSON.stringify(params)}
Assess physical security posture:
- Access control systems (badge readers, biometrics, tailgating risk)
- CCTV coverage (blind spots, retention period, quality)
- Server room / data center physical security (locked racks, environmental monitoring)
- Visitor management (sign-in, escort policy, badge visibility)
- Clean desk / clear screen policy compliance
- Secure document disposal (shredding)
- Device security (laptop cable locks, screen privacy filters)
- Social engineering risks (receptionists, front-of-house staff security awareness)
- After-hours access controls and monitoring
- Environmental risks (fire suppression, water detection, temperature, UPS/generator)
For NDIS providers: also assess participant safety in service delivery locations.
Output: physical security risk register with prioritized remediation.`,
        response_json_schema: {
          type: 'object',
          properties: {
            physical_security_score: { type: 'number' },
            critical_gaps: { type: 'array', items: { type: 'object', properties: { area: { type: 'string' }, gap: { type: 'string' }, risk: { type: 'string' }, remediation: { type: 'string' }, cost_estimate: { type: 'string' } } } },
            environmental_risks: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    // ─── 9. SELF-LEARNING & ADAPTIVE DEFENSE ──────────────────────────────────

    if (action === 'security_posture_report') {
      // Comprehensive overall security health report
      const [incidents, threats] = await Promise.all([
        base44.asServiceRole.entities.SecurityIncident.filter({}, '-created_date', 50).catch(() => []),
        base44.asServiceRole.entities.ThreatLog.filter({}, '-created_date', 100).catch(() => [])
      ]);

      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel generating a comprehensive security posture report.
Open incidents (${incidents.length}): ${JSON.stringify(incidents.slice(0, 20))}
Threat logs (${threats.length}): ${JSON.stringify(threats.slice(0, 20))}
Additional context: ${JSON.stringify(params)}

Generate an executive security posture report covering:
1. OVERALL SECURITY SCORE (0-100) with letter grade
2. THREAT LANDSCAPE — current threat level and trending direction
3. INCIDENT SUMMARY — open/resolved by severity, MTTR, top incident categories
4. TOP RISKS — the 5 most critical unaddressed risks
5. COMPLIANCE STATUS — key framework status (Essential Eight, Privacy Act)
6. QUICK WINS — top 3 highest-impact actions that can be done this week
7. STRATEGIC RECOMMENDATIONS — 30/60/90 day roadmap
8. RISK TREND — improving/stable/deteriorating vs last period
Format: executive-ready, lead with numbers, be specific.`,
        response_json_schema: {
          type: 'object',
          properties: {
            security_score: { type: 'number' },
            security_grade: { type: 'string' },
            threat_level: { type: 'string' },
            trend: { type: 'string' },
            incident_summary: { type: 'object', properties: { open_critical: { type: 'number' }, open_high: { type: 'number' }, open_medium: { type: 'number' }, resolved_30d: { type: 'number' }, avg_mttr_hours: { type: 'number' } } },
            top_5_risks: { type: 'array', items: { type: 'string' } },
            quick_wins: { type: 'array', items: { type: 'string' } },
            roadmap_30_day: { type: 'array', items: { type: 'string' } },
            roadmap_60_day: { type: 'array', items: { type: 'string' } },
            roadmap_90_day: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    if (action === 'deception_honeypot') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's deception technology designer.
Design a honeypot and deception strategy for: ${JSON.stringify(params)}
Recommend:
- Honeypot types (credentials, data, systems) appropriate for this environment
- Honeytokens to deploy (fake API keys, fake DB credentials in code, fake email addresses)
- Canary files to place in sensitive directories
- Fake admin accounts to create as tripwires
- Decoy network segments
- Alert triggers and response automation when decoys are accessed
- MITRE Shield deception techniques applicable
Output: deployable deception plan with specific artefacts to create, placement locations, and monitoring rules.`,
        response_json_schema: {
          type: 'object',
          properties: {
            honeypots: { type: 'array', items: { type: 'object', properties: { type: { type: 'string' }, placement: { type: 'string' }, alert_on: { type: 'string' }, response: { type: 'string' } } } },
            honeytokens: { type: 'array', items: { type: 'object', properties: { token_type: { type: 'string' }, example_value: { type: 'string' }, placement: { type: 'string' }, detection_confidence: { type: 'string' } } } },
            tripwire_accounts: { type: 'array', items: { type: 'string' } },
            monitoring_rules: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    if (action === 'security_awareness_training') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's security awareness training designer.
Organization: ${JSON.stringify(params)}
Design a security awareness training program:
- Phishing simulation scenarios (realistic, sector-appropriate)
- Training modules needed (ranked by risk reduction impact)
- Role-based training requirements (exec, admin, general staff, IT)
- Current security awareness maturity assessment
- Simulated phishing email templates for testing staff
- Knowledge check questions for each module
- Metrics to track (click rate, report rate, completion rate)
- Gamification recommendations
For NDIS providers: include privacy and safeguarding-specific modules.
For e-commerce: include payment fraud and social engineering modules.
Output: 12-month training calendar with content specifications.`,
        response_json_schema: {
          type: 'object',
          properties: {
            awareness_score: { type: 'number' },
            training_modules: { type: 'array', items: { type: 'object', properties: { module: { type: 'string' }, audience: { type: 'string' }, duration_mins: { type: 'number' }, risk_reduction: { type: 'string' }, priority: { type: 'string' } } } },
            phishing_scenarios: { type: 'array', items: { type: 'object', properties: { scenario: { type: 'string' }, subject_line: { type: 'string' }, difficulty: { type: 'string' } } } },
            training_calendar: { type: 'array', items: { type: 'object', properties: { month: { type: 'string' }, topic: { type: 'string' }, audience: { type: 'string' } } } },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    // ─── 10. EXISTING CORE FUNCTIONS (Enhanced) ───────────────────────────────


    // AUTONOMOUS SECURITY EXPANSION

    if (action === 'global_threat_intel_fusion') {
      const [intel, darkweb, attackSurface] = await Promise.all([
        base44.functions.invoke('sentinelSecurityMonitoring', { action: 'threat_intelligence_feed' }).then((r: any) => r.data).catch(() => null),
        base44.functions.invoke('sentinelSecurityMonitoring', { action: 'dark_web_monitoring' }).then((r: any) => r.data).catch(() => null),
        base44.functions.invoke('sentinelSecurityMonitoring', { action: 'attack_surface_mapping' }).then((r: any) => r.data).catch(() => null),
      ]);
      return Response.json({
        status: 'sentinel_fusion_complete',
        action,
        intel,
        darkweb,
        attackSurface,
        checks: {
          intel_ok: Boolean(intel),
          darkweb_ok: Boolean(darkweb),
          attack_surface_ok: Boolean(attackSurface),
        }
      });
    }

    if (action === 'zero_trust_trust_scoring') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's Zero-Trust trust scoring engine.

Inputs: ${JSON.stringify(params)}

Create a continuous adaptive trust scoring model for users/devices/sessions:
- score dimensions
- weighting model
- step-up authentication triggers
- automatic session restrictions
- just-in-time privilege policies

Return practical policy matrix and deployment plan.`,
        response_json_schema: {
          type: 'object',
          properties: {
            scoring_dimensions: { type: 'array', items: { type: 'string' } },
            risk_bands: { type: 'array', items: { type: 'object', properties: { band: { type: 'string' }, score_range: { type: 'string' }, controls: { type: 'array', items: { type: 'string' } } } } },
            policy_matrix: { type: 'array', items: { type: 'string' } },
            deployment_steps: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    if (action === 'autonomous_incident_response') {
      const incidentType = params.incident_type || 'ransomware';
      const [playbook, containment, forensics] = await Promise.all([
        base44.functions.invoke('sentinelSecurityMonitoring', { action: 'incident_playbook', incident_type: incidentType }).then((r: any) => r.data).catch(() => null),
        base44.functions.invoke('sentinelSecurityMonitoring', { action: 'automated_containment', incident_type: incidentType }).then((r: any) => r.data).catch(() => null),
        base44.functions.invoke('sentinelSecurityMonitoring', { action: 'forensic_collection', incident_type: incidentType }).then((r: any) => r.data).catch(() => null),
      ]);
      return Response.json({
        status: 'autonomous_response_ready',
        action,
        incident_type: incidentType,
        playbook,
        containment,
        forensics,
        checks: {
          playbook_ok: Boolean(playbook),
          containment_ok: Boolean(containment),
          forensics_ok: Boolean(forensics),
        }
      });
    }

    if (action === 'cloud_saas_posture_unified') {
      const [cloud, thirdParty] = await Promise.all([
        base44.functions.invoke('sentinelSecurityMonitoring', { action: 'cloud_security_scan' }).then((r: any) => r.data).catch(() => null),
        base44.functions.invoke('sentinelSecurityMonitoring', { action: 'third_party_supply_chain_risk' }).then((r: any) => r.data).catch(() => null),
      ]);
      return Response.json({
        status: 'cloud_posture_unified',
        action,
        cloud,
        third_party: thirdParty,
        checks: {
          cloud_ok: Boolean(cloud),
          third_party_ok: Boolean(thirdParty),
        }
      });
    }

    if (action === 'insider_threat_watch') {
      const [ueba, identity] = await Promise.all([
        base44.functions.invoke('sentinelSecurityMonitoring', { action: 'behavioral_analytics_ueba' }).then((r: any) => r.data).catch(() => null),
        base44.functions.invoke('sentinelSecurityMonitoring', { action: 'identity_access_monitoring' }).then((r: any) => r.data).catch(() => null),
      ]);
      return Response.json({
        status: 'insider_watch_complete',
        action,
        ueba,
        identity,
        checks: {
          ueba_ok: Boolean(ueba),
          identity_ok: Boolean(identity),
        }
      });
    }

    if (action === 'data_protection_control_plane') {
      const [dlp, discovery, privacy] = await Promise.all([
        base44.functions.invoke('sentinelSecurityMonitoring', { action: 'dlp_scan' }).then((r: any) => r.data).catch(() => null),
        base44.functions.invoke('sentinelSecurityMonitoring', { action: 'sensitive_data_discovery' }).then((r: any) => r.data).catch(() => null),
        base44.functions.invoke('sentinelSecurityMonitoring', { action: 'privacy_compliance_check' }).then((r: any) => r.data).catch(() => null),
      ]);
      return Response.json({
        status: 'data_protection_control_plane_complete',
        action,
        dlp,
        discovery,
        privacy,
        checks: {
          dlp_ok: Boolean(dlp),
          discovery_ok: Boolean(discovery),
          privacy_ok: Boolean(privacy),
        }
      });
    }

    if (action === 'sentinel_full_self_test') {
      const [posture, fullScan, intelFusion, incidentResponse, insiderWatch, dataPlane] = await Promise.all([
        base44.functions.invoke('sentinelSecurityMonitoring', { action: 'security_posture_report' }).then((r: any) => r.data).catch(() => null),
        base44.functions.invoke('sentinelSecurityMonitoring', { action: 'full_threat_scan' }).then((r: any) => r.data).catch(() => null),
        base44.functions.invoke('sentinelSecurityMonitoring', { action: 'global_threat_intel_fusion' }).then((r: any) => r.data).catch(() => null),
        base44.functions.invoke('sentinelSecurityMonitoring', { action: 'autonomous_incident_response' }).then((r: any) => r.data).catch(() => null),
        base44.functions.invoke('sentinelSecurityMonitoring', { action: 'insider_threat_watch' }).then((r: any) => r.data).catch(() => null),
        base44.functions.invoke('sentinelSecurityMonitoring', { action: 'data_protection_control_plane' }).then((r: any) => r.data).catch(() => null),
      ]);

      return Response.json({
        status: 'sentinel_self_test_complete',
        action,
        posture,
        fullScan,
        intelFusion,
        incidentResponse,
        insiderWatch,
        dataPlane,
        checks: {
          posture_ok: Boolean(posture),
          full_scan_ok: Boolean(fullScan),
          intel_fusion_ok: Boolean(intelFusion),
          incident_response_ok: Boolean(incidentResponse),
          insider_watch_ok: Boolean(insiderWatch),
          data_plane_ok: Boolean(dataPlane),
        }
      });
    }
    if (action === 'full_threat_scan') {
      const [incidents, threats] = await Promise.all([
        base44.asServiceRole.entities.SecurityIncident.filter({}, '-created_date', 20).catch(() => []),
        base44.asServiceRole.entities.ThreatLog.filter({}, '-created_date', 50).catch(() => [])
      ]);
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel running a FULL security threat scan.
Existing incidents: ${JSON.stringify(incidents)}
Existing threat logs: ${JSON.stringify(threats)}
Additional context: ${JSON.stringify(params)}
Run a comprehensive threat assessment across:
- Financial anomalies (unusual expenses, unauthorized payments, revenue irregularities)
- Data security (exposed PII, unencrypted data, access anomalies)
- Identity threats (compromised accounts, excessive privileges)
- Application security (vulnerable dependencies, misconfigured APIs)
- Compliance gaps (Privacy Act, NDIS requirements, ATO obligations)
- Operational security (failed backups, expired certificates, unpatched systems)
- Brand safety (impersonation, fake accounts, reputation threats)
- Social engineering risks (phishing patterns, pretexting attempts)
For each threat found: severity (CRITICAL/HIGH/MEDIUM/LOW), description, evidence, recommended immediate action, and which agent should be notified.`,
        response_json_schema: {
          type: 'object',
          properties: {
            overall_threat_level: { type: 'string' },
            security_score: { type: 'number' },
            threats: { type: 'array', items: { type: 'object', properties: { category: { type: 'string' }, severity: { type: 'string' }, title: { type: 'string' }, description: { type: 'string' }, evidence: { type: 'string' }, action: { type: 'string' }, notify_agent: { type: 'string' } } } },
            immediate_actions: { type: 'array', items: { type: 'string' } },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    if (action === 'anomaly_detection') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's anomaly detection engine.
Data to analyze: ${JSON.stringify(params)}
Detect anomalies across financial, behavioral, and operational dimensions:
- Statistical outliers (values >3σ from mean)
- Pattern breaks (sudden changes in established patterns)
- Velocity anomalies (too many transactions/events in short time)
- Timing anomalies (activity at unusual times)
- Amount anomalies (round numbers, just-below-threshold amounts)
- Geographic anomalies (activity from unexpected locations)
- Relationship anomalies (unusual entity combinations)
Provide risk score, anomaly type, statistical basis, and recommended action for each finding.`,
        response_json_schema: {
          type: 'object',
          properties: {
            anomalies: { type: 'array', items: { type: 'object', properties: { type: { type: 'string' }, description: { type: 'string' }, risk_score: { type: 'number' }, statistical_basis: { type: 'string' }, action: { type: 'string' } } } },
            highest_risk_anomaly: { type: 'string' },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    if (action === 'brand_protection') {
      const result = await base44.integrations.Core.InvokeLLM({
        prompt: `You are Sentinel's brand protection and impersonation detection engine.
Brand details: ${JSON.stringify(params)}
Monitor and detect:
- Typosquat domains (domain variations that look like official domain)
- Fake social media accounts impersonating the brand
- Phishing pages using brand assets
- Counterfeit product listings on marketplaces
- Unauthorized use of brand name/logo in ads
- Negative SEO attacks (fake reviews, link schemes)
- Social media misinformation about the brand
- Executive impersonation (CEO fraud setup)
For each finding: threat level, platform, evidence, takedown procedure, legal action threshold.`,
        response_json_schema: {
          type: 'object',
          properties: {
            brand_threat_level: { type: 'string' },
            impersonation_threats: { type: 'array', items: { type: 'object', properties: { type: { type: 'string' }, platform: { type: 'string' }, details: { type: 'string' }, severity: { type: 'string' }, takedown_steps: { type: 'array', items: { type: 'string' } } } } },
            typosquat_domains: { type: 'array', items: { type: 'string' } },
            legal_action_warranted: { type: 'boolean' },
            summary: { type: 'string' }
          }
        }
      });
      return Response.json(result);
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
