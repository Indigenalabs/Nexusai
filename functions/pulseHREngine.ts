import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const { action, params = {} } = payload;
    const target = params.target || payload.target || '';

    const loadTeam = () => base44.asServiceRole.entities.TeamMember.list('-created_date', 100).catch(() => []);
    const loadWorkers = () => base44.asServiceRole.entities.WorkerProfile.list('-created_date', 50).catch(() => []);
    const loadWellness = () => base44.asServiceRole.entities.StaffWellness.list('-created_date', 100).catch(() => []);

    let result = null;

    // ─── 1. GENERATE JOB DESCRIPTION ───────────────────────────────────────
    if (action === 'generate_jd') {
      const { role, department, level, key_responsibilities, required_skills, nice_to_have, salary_range, location, company_culture } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a compelling, inclusive job description for a ${role || target} role.

Department: ${department || 'not specified'}
Level: ${level || 'mid-level'}
Key responsibilities: ${key_responsibilities || 'to be discussed'}
Required skills: ${required_skills || 'relevant experience'}
Nice to have: ${nice_to_have || 'none specified'}
Salary range: ${salary_range || 'competitive'}
Location: ${location || 'flexible'}
Company culture context: ${company_culture || 'collaborative, high-growth team'}

Generate:
1. **Compelling job title** (optimized for search AND appeal)
2. **The Role in One Paragraph** — why this role matters, the impact it will have
3. **What You'll Do** — 6-8 specific, engaging responsibilities (not a boring list)
4. **What We're Looking For** — required skills framed positively; separate from nice-to-haves
5. **Nice to Have** — additional skills/experience that would be a bonus
6. **What We Offer** — benefits, culture, growth opportunity (make it real, not generic)
7. **About the Company** — 2-3 sentences, culture-forward
8. **Diversity statement** — genuine, not boilerplate
9. **Inclusive language audit** — flag any potentially biased language in the JD

Tone: warm, human, energizing. Avoid corporate jargon. Make the best person for this role WANT to apply.`,
        response_json_schema: {
          type: 'object',
          properties: {
            job_title: { type: 'string' },
            full_jd: { type: 'string' },
            the_role: { type: 'string' },
            responsibilities: { type: 'array', items: { type: 'string' } },
            required_skills_list: { type: 'array', items: { type: 'string' } },
            nice_to_have_list: { type: 'array', items: { type: 'string' } },
            what_we_offer: { type: 'array', items: { type: 'string' } },
            diversity_statement: { type: 'string' },
            inclusive_language_flags: { type: 'array', items: { type: 'string' } },
            seo_keywords: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      await base44.asServiceRole.entities.Document.create({
        title: `JD: ${role || target}`,
        type: 'other',
        content: result?.full_jd?.slice(0, 5000) || '',
        status: 'draft'
      }).catch(() => null);
    }

    // ─── 2. ONBOARDING PLAN ─────────────────────────────────────────────────
    if (action === 'onboarding_plan') {
      const { employee_name, role, department, start_date, experience_level } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a comprehensive personalized onboarding plan.

New hire: ${employee_name || target}
Role: ${role || 'team member'}
Department: ${department || 'general'}
Start date: ${start_date || 'upcoming'}
Experience level: ${experience_level || 'mid-level'}

Generate a structured 30-60-90 day onboarding plan:

**Before Day 1 (Pre-boarding):**
- Documents to collect
- Accounts and access to set up
- Welcome communications to send
- Equipment to prepare

**Week 1 — Orientation:**
- Day 1 schedule (first impressions matter)
- People to meet (with context on who they are and why)
- Systems and tools to learn
- Culture immersion touchpoints
- Buddy/mentor introduction

**Days 8-30 — Integration:**
- Key projects to get involved in
- Stakeholder meetings to schedule
- Skills to develop
- Check-in schedule (with agenda prompts)
- First deliverable or contribution goal

**Days 31-60 — Contribution:**
- Increasing ownership milestones
- Feedback loop cadence
- Performance expectations set
- Social integration (team events, cross-functional exposure)

**Days 61-90 — Acceleration:**
- Probationary review preparation
- Goal setting for next quarter
- Areas to go deeper in
- Two-way feedback on the onboarding experience

Also provide:
- Buddy profile template (what to look for in a good buddy for this role)
- Manager check-in agenda prompts for 30/60/90 day conversations
- Success criteria: what does a great first 90 days look like for this person?`,
        response_json_schema: {
          type: 'object',
          properties: {
            preboarding_checklist: { type: 'array', items: { type: 'string' } },
            week_1_schedule: { type: 'array', items: { type: 'object', properties: { day: { type: 'string' }, activities: { type: 'array', items: { type: 'string' } } } } },
            day_30_milestones: { type: 'array', items: { type: 'string' } },
            day_60_milestones: { type: 'array', items: { type: 'string' } },
            day_90_milestones: { type: 'array', items: { type: 'string' } },
            buddy_profile: { type: 'string' },
            manager_checkin_agendas: { type: 'array', items: { type: 'object', properties: { timing: { type: 'string' }, agenda: { type: 'array', items: { type: 'string' } } } } },
            success_criteria: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      // Create onboarding tasks
      const tasks = result?.preboarding_checklist?.slice(0, 5) || [];
      for (const task of tasks) {
        await base44.asServiceRole.entities.Task.create({
          title: `Onboarding: ${task.slice(0, 80)}`,
          description: `For ${employee_name || target} — onboarding task`,
          status: 'todo',
          priority: 'high'
        }).catch(() => null);
      }
    }

    // ─── 3. NDIS ONBOARDING ─────────────────────────────────────────────────
    if (action === 'ndis_onboarding') {
      const { worker_name, role, state, support_types } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a complete NDIS-specific onboarding checklist and plan.

Worker: ${worker_name || target}
Role: ${role || 'Support Worker'}
State: ${state || 'South Australia'}
Support types they'll deliver: ${support_types || 'personal care, community access'}

NDIS Onboarding Checklist — critical sequence (must be done IN ORDER before first participant contact):

**MANDATORY BEFORE FIRST PARTICIPANT CONTACT:**
1. NDIS Worker Screening Clearance — status, application process for ${state}
2. NDIS Worker Orientation Module ('Quality, Safety and You') — completion timeline
3. Organisation-specific induction (policies, code of conduct, participant rights)
4. Incident reporting procedure training

**MANDATORY BY END OF WEEK 1:**
5. First Aid Certificate (valid, check expiry)
6. CPR Certificate (valid — annual renewal)
7. Privacy and confidentiality training
8. Manual handling (if delivering physical supports)
9. Medication management (if administering medications for ${state})

**SUPPORT-TYPE SPECIFIC (for ${support_types}):**
10. Role-specific competency checks
11. Shadow shift protocol (first 2-3 supports with experienced worker)
12. Participant introduction process (after clearance confirmed)

**COMPLIANCE TRACKING:**
- Alert triggers: clearance expiry dates, certificate renewal dates
- Compliance check schedule: pre-start, 3 months, 6 months, annual
- Who to alert if non-compliant: manager, Veritas

**CULTURE AND INTEGRATION:**
- Buddy assignment: who is a good match for this worker?
- Check-in schedule: Day 1, Week 1, Week 2, 30 days, 60 days, 90 days
- Recognition touchpoint: celebrate first 30 days

Also provide: manager checklist for onboarding a new NDIS worker, specific to their state.`,
        response_json_schema: {
          type: 'object',
          properties: {
            mandatory_before_first_shift: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, deadline: { type: 'string' }, how_to_complete: { type: 'string' } } } },
            mandatory_week_1: { type: 'array', items: { type: 'object', properties: { item: { type: 'string' }, deadline: { type: 'string' }, renewal_period: { type: 'string' } } } },
            role_specific_requirements: { type: 'array', items: { type: 'string' } },
            compliance_alert_schedule: { type: 'array', items: { type: 'string' } },
            checkin_schedule: { type: 'array', items: { type: 'object', properties: { timing: { type: 'string' }, agenda: { type: 'array', items: { type: 'string' } } } } },
            manager_checklist: { type: 'array', items: { type: 'string' } },
            state_specific_notes: { type: 'string' }
          }
        }
      });
    }

    // ─── 4. NDIS COMPLIANCE CHECK ───────────────────────────────────────────
    if (action === 'ndis_compliance_check') {
      const team = await loadTeam();
      const workers = await loadWorkers();

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Conduct an NDIS workforce compliance check.

Team members (${team.length}): ${JSON.stringify(team.slice(0, 20).map(m => ({
  name: m.name, role: m.role, status: m.employment_status,
  notes: m.notes?.slice(0, 100)
})))}

Worker profiles with certifications (${workers.length}): ${JSON.stringify(workers.slice(0, 20).map(w => ({
  name: w.name, certifications: w.certifications, specialisations: w.specialisations
})))}

NDIS Compliance Audit:

For each worker, assess:
1. **NDIS Worker Screening Clearance**: valid / expiring soon / expired / unknown
2. **NDIS Worker Orientation Module**: completed / not completed / unknown
3. **First Aid + CPR**: current / expiring / expired / unknown
4. **Mandatory Reporter Training**: completed / not completed (state-dependent)
5. **Role-specific training**: adequate for their support types

Overall compliance summary:
- Fully compliant workers
- Workers with imminent expiries (< 30 days)
- Workers with lapsed requirements (CRITICAL)
- Unknown/unverified workers

Priority actions:
- CRITICAL (block from participant contact immediately)
- HIGH (address within 7 days)
- MEDIUM (address within 30 days)

Recommendations for building a compliant workforce.`,
        response_json_schema: {
          type: 'object',
          properties: {
            overall_compliance_rate: { type: 'number' },
            fully_compliant: { type: 'array', items: { type: 'string' } },
            expiring_soon: { type: 'array', items: { type: 'object', properties: { worker: { type: 'string' }, item: { type: 'string' }, days_until_expiry: { type: 'number' } } } },
            critical_non_compliant: { type: 'array', items: { type: 'object', properties: { worker: { type: 'string' }, issue: { type: 'string' }, action_required: { type: 'string' } } } },
            unknown_status: { type: 'array', items: { type: 'string' } },
            priority_actions: { type: 'array', items: { type: 'object', properties: { priority: { type: 'string' }, action: { type: 'string' }, deadline: { type: 'string' } } } },
            recommendations: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      // Alert on critical non-compliant workers
      if (result?.critical_non_compliant?.length > 0) {
        await base44.asServiceRole.entities.Notification.create({
          title: `NDIS Compliance Alert — ${result.critical_non_compliant.length} worker(s) non-compliant`,
          message: `Critical: ${result.critical_non_compliant.map(w => w.worker).join(', ')} have lapsed compliance requirements. Immediate action required.`,
          priority: 'critical',
          is_read: false
        }).catch(() => null);
      }
    }

    // ─── 5. WORKER MATCHING ─────────────────────────────────────────────────
    if (action === 'worker_matching') {
      const { participant_needs, participant_preferences, support_types, location } = params;
      const workers = await loadWorkers();

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Provide participant-worker matching intelligence for NDIS rostering.

Participant needs: ${participant_needs || target}
Participant preferences: ${participant_preferences || 'not specified'}
Support types required: ${support_types || 'personal care, community access'}
Location: ${location || 'not specified'}

Available workers (${workers.length}): ${JSON.stringify(workers.slice(0, 20).map(w => ({
  name: w.name, specialisations: w.specialisations, languages: w.languages,
  certifications: w.certifications?.map(c => c.certification),
  performance_score: w.performance_score, availability: w.availability
})))}

Matching analysis:

1. **Ranked matches** (top 5): for each worker —
   - Match score (0-100)
   - Strengths (what makes them a good fit)
   - Considerations (anything to be aware of)
   - Availability fit

2. **Critical compatibility flags**:
   - Skills vs. support needs (e.g., medication training needed?)
   - Cultural and language considerations
   - Gender preferences (especially for personal care)
   - Experience with this disability type

3. **Recommended match**: who to roster and why

4. **Risk flags**: any combination to specifically AVOID and why

5. **Continuity consideration**: who could provide long-term consistent support?`,
        response_json_schema: {
          type: 'object',
          properties: {
            recommended_match: { type: 'string' },
            recommendation_rationale: { type: 'string' },
            ranked_matches: { type: 'array', items: { type: 'object', properties: {
              worker_name: { type: 'string' }, match_score: { type: 'number' }, strengths: { type: 'array', items: { type: 'string' } }, considerations: { type: 'array', items: { type: 'string' } }
            }}},
            critical_flags: { type: 'array', items: { type: 'string' } },
            combinations_to_avoid: { type: 'array', items: { type: 'string' } },
            continuity_assessment: { type: 'string' }
          }
        }
      });
    }

    // ─── 6. BURNOUT ANALYSIS (TEAM-WIDE) ───────────────────────────────────
    if (action === 'burnout_analysis') {
      const team = await loadTeam();
      const wellness = await loadWellness();

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Conduct a team-wide burnout risk analysis.

Team members (${team.length}): ${JSON.stringify(team.map(m => ({
  name: m.name, role: m.role, wellbeing_status: m.wellbeing_status,
  engagement_score: m.engagement_score, start_date: m.start_date, notes: m.notes?.slice(0, 150)
})))}

Recent wellness check-ins (${wellness.length}): ${JSON.stringify(wellness.slice(0, 30).map(w => ({
  staff_name: w.staff_name, wellbeing_score: w.wellbeing_score, stress_level: w.stress_level,
  burnout_risk: w.burnout_risk, support_needed: w.support_needed, days_since_last_day_off: w.days_since_last_day_off
})))}

NDIS sector context: support work has 25-30% annual turnover. Burnout risk signals specific to this sector:
- Overloaded caseloads (high-needs participants)
- Back-to-back shifts without recovery time
- Incident involvement (vicarious trauma)
- Regular overtime without recovery
- Long tenure without recognition
- Antisocial hours (weekends, late nights without rotation)

Burnout analysis:

1. **Individual risk assessment** — for each team member with sufficient data:
   - Risk level: LOW / MEDIUM / HIGH / CRITICAL
   - Primary stressors identified
   - Specific recommended interventions

2. **Team-level patterns**:
   - Overall burnout risk culture
   - Common stressors affecting multiple people
   - Structural issues (scheduling, caseloads, management)

3. **Priority interventions** (ranked):
   - Who needs immediate attention?
   - What specific action for each?

4. **Prevention recommendations**:
   - Structural changes to reduce burnout risk
   - Recognition and engagement initiatives
   - Scheduling and workload adjustments

5. **Retention impact**: estimate turnover cost risk if burnout is not addressed`,
        response_json_schema: {
          type: 'object',
          properties: {
            individual_risks: { type: 'array', items: { type: 'object', properties: {
              name: { type: 'string' }, risk_level: { type: 'string' }, primary_stressors: { type: 'array', items: { type: 'string' } }, recommended_intervention: { type: 'string' }
            }}},
            team_patterns: { type: 'array', items: { type: 'string' } },
            priority_actions: { type: 'array', items: { type: 'object', properties: { person: { type: 'string' }, urgency: { type: 'string' }, action: { type: 'string' } } } },
            prevention_recommendations: { type: 'array', items: { type: 'string' } },
            retention_risk_summary: { type: 'string' }
          }
        }
      });
    }

    // ─── 7. PULSE SURVEY ────────────────────────────────────────────────────
    if (action === 'pulse_survey') {
      const { focus_area, team_context, previous_concerns } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Design a pulse survey for team wellbeing and engagement measurement.

Focus: ${focus_area || 'general wellbeing, engagement, and culture'}
Team context: ${target || team_context || 'NDIS support worker team'}
Previous concerns to explore: ${previous_concerns || 'none specified'}

Design:
1. **5-7 core questions** (mix of rating scales and open text):
   - Engagement: 'On a scale of 1-10, how motivated do you feel about your work right now?'
   - Wellbeing: wellbeing and stress questions (NDIS-specific if applicable)
   - Culture: psychological safety, belonging
   - Growth: development and progression
   - Management: supervisor support
   - Specific to previous concerns: ${previous_concerns}

2. **2 open-text questions** that invite honest sharing

3. **1 NPS question**: 'How likely are you to recommend this organization as a place to work?' (0-10)

4. **Response analysis guide**: for each question, what response patterns should prompt action?

5. **Follow-up protocol**: based on survey results, what happens next?
   - Who gets the data?
   - How is anonymity protected?
   - How are results communicated back to the team?
   - What actions will we commit to taking?

Tone: warm, genuinely curious, safe. People should feel this is a real check-in, not box-ticking.`,
        response_json_schema: {
          type: 'object',
          properties: {
            survey_title: { type: 'string' },
            questions: { type: 'array', items: { type: 'object', properties: {
              question: { type: 'string' }, type: { type: 'string' }, scale: { type: 'string' }, what_low_scores_mean: { type: 'string' }
            }}},
            open_text_questions: { type: 'array', items: { type: 'string' } },
            nps_question: { type: 'string' },
            follow_up_protocol: { type: 'array', items: { type: 'string' } },
            anonymity_statement: { type: 'string' }
          }
        }
      });
    }

    // ─── 8. PERFORMANCE REVIEW ──────────────────────────────────────────────
    if (action === 'performance_review') {
      const { employee_name, role, review_period, achievements, areas_for_growth, manager_observations } = params;
      const team = await loadTeam();
      const member = team.find(m => m.name?.toLowerCase().includes((employee_name || target || '').toLowerCase()));

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Facilitate a structured performance review.

Employee: ${employee_name || target}
Role: ${role || (member?.role || 'team member')}
Review period: ${review_period || 'last quarter'}
Achievements: ${achievements || 'to be discussed'}
Areas for growth: ${areas_for_growth || 'to be discussed'}
Manager observations: ${manager_observations || 'to be gathered'}
Team context: ${member ? JSON.stringify({ wellbeing_status: member.wellbeing_status, engagement_score: member.engagement_score, notes: member.notes?.slice(0, 200) }) : 'no additional data'}

Complete performance review framework:

1. **Self-assessment prompts** (5 questions for the employee to reflect on before the review)

2. **Review agenda** (60-minute 1-on-1 structure):
   - Opening (5 min)
   - Achievements and wins (15 min)
   - Challenges and learnings (10 min)
   - Growth areas and development (15 min)
   - Goals for next period (10 min)
   - Closing and next steps (5 min)

3. **Manager preparation notes**:
   - Specific examples to reference
   - Sensitive topics to handle carefully
   - Growth opportunities to present

4. **Performance summary** (to be completed after the review):
   - Overall rating framework (suggest: Exceeding / Meeting / Developing)
   - Key accomplishments this period
   - Development areas with specific actions

5. **SMART goals framework** for next review period

6. **One thing to celebrate** in this review — specifically, something about this person that deserves genuine recognition`,
        response_json_schema: {
          type: 'object',
          properties: {
            self_assessment_prompts: { type: 'array', items: { type: 'string' } },
            review_agenda: { type: 'array', items: { type: 'object', properties: { section: { type: 'string' }, duration: { type: 'string' }, prompts: { type: 'array', items: { type: 'string' } } } } },
            manager_prep_notes: { type: 'array', items: { type: 'string' } },
            rating_framework: { type: 'array', items: { type: 'object', properties: { rating: { type: 'string' }, description: { type: 'string' } } } },
            goals_framework: { type: 'array', items: { type: 'object', properties: { area: { type: 'string' }, goal: { type: 'string' }, measure: { type: 'string' } } } },
            celebration_highlight: { type: 'string' }
          }
        }
      });
    }

    // ─── 9. SKILLS GAP ANALYSIS ─────────────────────────────────────────────
    if (action === 'skills_gap') {
      const { role, future_direction, team_description } = params;
      const team = await loadTeam();

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Conduct a skills gap analysis for workforce capability planning.

Role focus: ${role || target || 'the whole team'}
Business direction: ${future_direction || 'growth and operational excellence'}
Team overview (${team.length} members): ${JSON.stringify(team.slice(0, 20).map(m => ({ name: m.name, role: m.role, department: m.department, notes: m.notes?.slice(0, 100) })))}
Additional context: ${team_description || ''}

Skills gap analysis:

1. **Current capability inventory** (assessed from available data + general role knowledge):
   - Skills present in the team
   - Skills depth (beginner / intermediate / advanced)
   - Critical single points of failure

2. **Required capabilities** (for current + future state):
   - Skills needed now
   - Skills needed in 12 months
   - Skills needed in 3 years (strategic)

3. **Gap matrix**: current vs. required
   - Critical gaps (risk to operations today)
   - Strategic gaps (risk to growth)
   - Nice-to-have gaps

4. **Recommendations by gap**:
   - Build internally (train existing team member — who?)
   - Hire externally (what role/seniority?)
   - Partner/contract (specialist brought in temporarily)

5. **Learning priorities**: top 5 skills to develop this quarter, with recommended resources

6. **Quick wins**: skills the team can cross-train on immediately`,
        response_json_schema: {
          type: 'object',
          properties: {
            current_capabilities: { type: 'array', items: { type: 'object', properties: { skill: { type: 'string' }, depth: { type: 'string' }, notes: { type: 'string' } } } },
            critical_gaps: { type: 'array', items: { type: 'object', properties: { skill: { type: 'string' }, impact: { type: 'string' }, recommendation: { type: 'string' } } } },
            strategic_gaps: { type: 'array', items: { type: 'string' } },
            learning_priorities: { type: 'array', items: { type: 'object', properties: { skill: { type: 'string' }, recommended_approach: { type: 'string' }, resources: { type: 'array', items: { type: 'string' } } } } },
            hiring_recommendations: { type: 'array', items: { type: 'string' } },
            quick_wins: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 10. RETENTION RISK ANALYSIS ────────────────────────────────────────
    if (action === 'retention_risk') {
      const team = await loadTeam();
      const wellness = await loadWellness();

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Identify retention risks across the team and recommend interventions.

Team (${team.length}): ${JSON.stringify(team.map(m => ({
  name: m.name, role: m.role, start_date: m.start_date, engagement_score: m.engagement_score,
  wellbeing_status: m.wellbeing_status, notes: m.notes?.slice(0, 150)
})))}

Retention risk signals to analyze:
- Tenure: long enough to be seeking growth? Too short (probation risk)?
- Engagement score trends
- Wellbeing status
- No recognition in recent period
- Role unchanged for extended period (no growth signals)
- Notes suggesting dissatisfaction, workload issues, or external exploration

Retention risk report:

1. **High risk individuals** (likely to leave in < 3 months):
   - Name, primary risk factor, estimated replacement cost, recommended intervention

2. **Medium risk individuals** (watch over next 6 months):
   - Name, signal, proactive step to take

3. **Team-level retention health score** (0-100)

4. **Structural factors** driving turnover risk:
   - Compensation, growth, culture, management, workload

5. **Retention intervention playbook**:
   - For each high-risk individual: specific conversation to have, what to offer, what NOT to say
   - For team: systemic changes recommended

6. **NDIS sector context**: how does this team's risk profile compare to sector norms (25-30% annual turnover)?`,
        response_json_schema: {
          type: 'object',
          properties: {
            retention_health_score: { type: 'number' },
            high_risk: { type: 'array', items: { type: 'object', properties: {
              name: { type: 'string' }, primary_risk_factor: { type: 'string' }, estimated_replacement_cost: { type: 'string' }, intervention: { type: 'string' }
            }}},
            medium_risk: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, signal: { type: 'string' }, proactive_step: { type: 'string' } } } },
            structural_factors: { type: 'array', items: { type: 'string' } },
            team_wide_recommendations: { type: 'array', items: { type: 'string' } },
            sector_comparison: { type: 'string' }
          }
        }
      });
    }

    // ─── 11. RECOGNITION ────────────────────────────────────────────────────
    if (action === 'recognition') {
      const { employee_name, achievement, tone, channel } = params;
      const team = await loadTeam();
      const member = team.find(m => m.name?.toLowerCase().includes((employee_name || target || '').toLowerCase()));

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate genuine, specific recognition for a team member.

Person: ${employee_name || target}
Achievement/reason for recognition: ${achievement || 'outstanding contribution'}
Tone: ${tone || 'warm and genuine — not corporate'}
Channel: ${channel || 'written message / team announcement'}
Context from file: ${member ? JSON.stringify({ role: member.role, start_date: member.start_date, notes: member.notes?.slice(0, 200) }) : 'no additional data'}

Generate:
1. **Short recognition message** (2-3 sentences, for sharing in the moment or in a team meeting) — specific, human, not generic
2. **Expanded recognition write-up** (for a newsletter or formal recognition program) — includes the specific impact of what they did
3. **NDIS-specific framing** (if support worker): connect their contribution to participant outcomes — 'Your consistency with [participant] has meant...'
4. **Peer recognition prompt**: a suggested message from a colleague's perspective
5. **Manager follow-up**: beyond the message, what concrete action (bonus, extra leave, learning opportunity) would show this is real recognition?
6. **Things to AVOID** in recognition: generic language, hollow praise, making it about the company instead of them

The recognition should make the person feel genuinely seen, not performatively appreciated.`,
        response_json_schema: {
          type: 'object',
          properties: {
            short_message: { type: 'string' },
            expanded_writeup: { type: 'string' },
            ndis_framing: { type: 'string' },
            peer_recognition_prompt: { type: 'string' },
            manager_followup_action: { type: 'string' },
            avoid: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      await base44.asServiceRole.entities.Activity.create({
        type: 'recognition',
        title: `Recognition: ${employee_name || target}`,
        description: `Achievement: ${achievement || 'outstanding contribution'}`
      }).catch(() => null);
    }

    // ─── 12. PEOPLE ANALYTICS ───────────────────────────────────────────────
    if (action === 'people_analytics') {
      const team = await loadTeam();
      const wellness = await loadWellness();

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a comprehensive people analytics report for leadership.

Team data (${team.length} members): ${JSON.stringify(team.map(m => ({
  name: m.name, role: m.role, department: m.department, start_date: m.start_date,
  wellbeing_status: m.wellbeing_status, engagement_score: m.engagement_score, employment_status: m.employment_status
})))}

Wellness data (${wellness.length} check-ins): ${JSON.stringify(wellness.slice(0, 30).map(w => ({
  staff_name: w.staff_name, wellbeing_score: w.wellbeing_score, stress_level: w.stress_level, burnout_risk: w.burnout_risk
})))}

People Analytics Executive Report:

1. **Workforce Overview**: headcount, department distribution, tenure distribution, employment types
2. **Engagement & Wellbeing Score**: overall score, trend, by department
3. **Burnout Risk Summary**: high risk / medium risk / low risk counts
4. **Retention Metrics**: estimated annual turnover rate, retention health score
5. **Milestone Tracker**: anniversaries and recognition due this month
6. **Compliance Health** (NDIS-specific if applicable): clearance compliance rate
7. **Top 3 People Risks** this quarter — with recommended actions
8. **Top 3 People Opportunities** — growth and culture wins to pursue
9. **Recommended leadership actions** for the next 30 days`,
        response_json_schema: {
          type: 'object',
          properties: {
            workforce_overview: { type: 'object' },
            engagement_score: { type: 'number' },
            wellbeing_score: { type: 'number' },
            burnout_summary: { type: 'object' },
            retention_health_score: { type: 'number' },
            milestones_this_month: { type: 'array', items: { type: 'string' } },
            top_risks: { type: 'array', items: { type: 'object', properties: { risk: { type: 'string' }, impact: { type: 'string' }, recommended_action: { type: 'string' } } } },
            top_opportunities: { type: 'array', items: { type: 'object', properties: { opportunity: { type: 'string' }, action: { type: 'string' } } } },
            leadership_actions: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 13. EXIT INTERVIEW ─────────────────────────────────────────────────
    if (action === 'exit_interview') {
      const { employee_name, role, tenure, reason_if_known } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Facilitate an exit interview process for a departing team member.

Employee: ${employee_name || target}
Role: ${role || 'team member'}
Tenure: ${tenure || 'not specified'}
Known reason for leaving: ${reason_if_known || 'not disclosed'}

Exit interview framework:

1. **Pre-interview preparation**: what to review before the conversation; what not to say
2. **Interview questions** (10-12, covering): reasons for leaving, what worked well, what didn't, management feedback, culture assessment, would they return/refer, what would have kept them
3. **Sensitive question handling**: how to approach difficult topics without being defensive
4. **Analysis template**: how to categorize and record their feedback
5. **Retention attempt assessment**: is there anything we could offer to retain this person? Is it worth trying?
6. **Knowledge transfer checklist**: what does this person know that we must capture before they leave?
7. **Offboarding checklist**: accounts to revoke, equipment to return, farewell communications
8. **Pattern analysis prompt**: how does this exit fit with previous exits? What recurring themes should leadership know about?`,
        response_json_schema: {
          type: 'object',
          properties: {
            pre_interview_prep: { type: 'array', items: { type: 'string' } },
            interview_questions: { type: 'array', items: { type: 'object', properties: { question: { type: 'string' }, purpose: { type: 'string' } } } },
            retention_assessment: { type: 'string' },
            knowledge_transfer_checklist: { type: 'array', items: { type: 'string' } },
            offboarding_checklist: { type: 'array', items: { type: 'string' } },
            pattern_analysis_prompt: { type: 'string' }
          }
        }
      });
    }

    // ─── 14. COMPENSATION BENCHMARK ─────────────────────────────────────────
    if (action === 'compensation_benchmark') {
      const { role, location, experience_level, current_salary } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Provide compensation benchmarking analysis.

Role: ${role || target}
Location: ${location || 'Australia'}
Experience level: ${experience_level || 'mid-level (3-5 years)'}
Current salary: ${current_salary || 'not disclosed'}

Compensation analysis:
1. **Market range**: P25, P50 (median), P75, P90 for this role/location/level
2. **Total compensation components**: base, super, bonus, equity, benefits
3. **NDIS Award rates** (if support worker): relevant SCHADS Award classification, penalty rates
4. **Competitiveness assessment**: if current salary provided, where does it sit vs. market?
5. **Adjustment recommendation**: what adjustment (if any) would bring this role to market?
6. **Retention risk**: is compensation a likely factor in retention risk?
7. **Benefits that matter**: beyond salary, what non-cash compensation does this role type value most?
8. **Negotiation guidance**: if offer negotiation expected, what's a reasonable range to work within?`,
        add_context_from_internet: true,
        response_json_schema: {
          type: 'object',
          properties: {
            market_range: { type: 'object', properties: { p25: { type: 'number' }, p50: { type: 'number' }, p75: { type: 'number' }, p90: { type: 'number' } } },
            total_comp_components: { type: 'array', items: { type: 'string' } },
            award_rate_notes: { type: 'string' },
            competitiveness_assessment: { type: 'string' },
            adjustment_recommendation: { type: 'string' },
            retention_risk_assessment: { type: 'string' },
            valued_benefits: { type: 'array', items: { type: 'string' } },
            negotiation_range: { type: 'string' }
          }
        }
      });
    }

    // ─── 15. LEARNING RECOMMENDATIONS ──────────────────────────────────────
    if (action === 'learning_recommendations') {
      const { employee_name, role, career_goal, current_skills, learning_style } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate personalized learning and development recommendations.

Employee: ${employee_name || target}
Role: ${role || 'professional'}
Career goal: ${career_goal || 'growth in current field'}
Current skills: ${current_skills || 'general professional skills'}
Learning style: ${learning_style || 'mixed — practical and theoretical'}

Learning & Development plan:
1. **Skill priorities** (top 3 to develop this quarter, ranked by career impact)
2. **Learning resources for each** (specific courses, books, communities):
   - Online courses (free and paid options)
   - Books or resources
   - Communities or networks to join
   - Mentors or coaches to find
   - Practical projects to work on
3. **Learning schedule**: realistic weekly time commitment
4. **Milestones and checkpoints**: how to measure progress
5. **Internal opportunities**: stretch projects, cross-functional exposure, leadership opportunities
6. **NDIS-specific** (if support worker): pathways for professional development in disability sector (cert IV, diploma, specialist training)`,
        response_json_schema: {
          type: 'object',
          properties: {
            skill_priorities: { type: 'array', items: { type: 'string' } },
            learning_plan: { type: 'array', items: { type: 'object', properties: {
              skill: { type: 'string' }, courses: { type: 'array', items: { type: 'string' } }, books: { type: 'array', items: { type: 'string' } }, practical_projects: { type: 'array', items: { type: 'string' } }
            }}},
            recommended_weekly_hours: { type: 'number' },
            milestones: { type: 'array', items: { type: 'string' } },
            internal_opportunities: { type: 'array', items: { type: 'string' } },
            ndis_pathways: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 16. CULTURE HEALTH ─────────────────────────────────────────────────
    if (action === 'culture_health') {
      const team = await loadTeam();
      const wellness = await loadWellness();

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Assess the overall culture health of the organization.

Team (${team.length}): ${JSON.stringify(team.slice(0, 20).map(m => ({ name: m.name, role: m.role, wellbeing_status: m.wellbeing_status, engagement_score: m.engagement_score })))}
Wellness signals (${wellness.length}): avg wellbeing ${wellness.length > 0 ? (wellness.reduce((s, w) => s + (w.wellbeing_score || 50), 0) / wellness.length).toFixed(0) : 'unknown'}/100

Culture health assessment:
1. **Culture Health Score** (0-100) with rationale
2. **Strengths** (2-3 genuine cultural strengths from the data)
3. **Risk areas** (2-3 areas where culture health is at risk)
4. **Psychological safety signals**: is the team able to speak up, take risks, admit mistakes?
5. **Belonging and inclusion**: does the team feel like everyone belongs?
6. **Growth culture**: do people feel they're developing and have a future here?
7. **Manager health**: are managers creating the conditions for people to thrive?
8. **Recommended culture initiatives** (3, with implementation steps)
9. **Culture quick wins**: things that can be done THIS WEEK to improve culture health`,
        response_json_schema: {
          type: 'object',
          properties: {
            culture_health_score: { type: 'number' },
            strengths: { type: 'array', items: { type: 'string' } },
            risk_areas: { type: 'array', items: { type: 'string' } },
            psychological_safety: { type: 'string' },
            belonging_assessment: { type: 'string' },
            growth_culture: { type: 'string' },
            recommended_initiatives: { type: 'array', items: { type: 'object', properties: { initiative: { type: 'string' }, steps: { type: 'array', items: { type: 'string' } }, timeline: { type: 'string' } } } },
            quick_wins: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 17. WELLNESS SCORE (legacy support) ────────────────────────────────
    if (action === 'wellness_score') {
      const wellness = await loadWellness();
      const team = await loadTeam();
      result = {
        total_staff: team.length,
        total_checkins: wellness.length,
        avg_wellbeing: wellness.length > 0 ? (wellness.reduce((s, w) => s + (w.wellbeing_score || 50), 0) / wellness.length).toFixed(0) : null,
        high_risk_count: wellness.filter(w => w.burnout_risk === 'high').length,
        critical_stress_count: wellness.filter(w => w.stress_level === 'critical').length,
        at_risk_team: team.filter(m => m.wellbeing_status === 'at_risk').length,
        watching_team: team.filter(m => m.wellbeing_status === 'watch').length
      };
    }
    // --- 18. TALENT INTELLIGENCE HUB ---
    if (action === 'talent_intelligence_hub') {
      const team = await loadTeam();
      const wellness = await loadWellness();

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a talent intelligence snapshot for leadership.

Team (${team.length}): ${JSON.stringify(team.slice(0, 50).map(m => ({
  name: m.name, role: m.role, department: m.department, start_date: m.start_date,
  engagement_score: m.engagement_score, wellbeing_status: m.wellbeing_status
})))}

Wellness signals (${wellness.length}): ${JSON.stringify(wellness.slice(0, 40).map(w => ({
  staff_name: w.staff_name, wellbeing_score: w.wellbeing_score, burnout_risk: w.burnout_risk
})))}

Produce:
1. Critical role coverage health
2. Skills concentration and bus-factor risk
3. Top capability strengths and top capability gaps
4. High-potential talent pockets
5. Workforce risks requiring leadership action in 30 days`,
        response_json_schema: {
          type: 'object',
          properties: {
            role_coverage_health: { type: 'string' },
            capability_strengths: { type: 'array', items: { type: 'string' } },
            capability_gaps: { type: 'array', items: { type: 'string' } },
            high_potential_segments: { type: 'array', items: { type: 'string' } },
            bus_factor_risks: { type: 'array', items: { type: 'string' } },
            next_30_day_actions: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // --- 19. SKILLS INVENTORY MAPPING ---
    if (action === 'skills_inventory_mapping') {
      const { role_focus } = params;
      const team = await loadTeam();

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Build a real-time skills inventory map.

Role focus: ${role_focus || target || 'all roles'}
Team data (${team.length}): ${JSON.stringify(team.slice(0, 60).map(m => ({
  name: m.name, role: m.role, department: m.department, notes: m.notes?.slice(0, 120)
})))}

Return:
1. Skills inventory by role cluster
2. Skill depth (beginner/intermediate/advanced)
3. Critical missing skills
4. Cross-training opportunities
5. Recommended 90-day upskilling priorities`,
        response_json_schema: {
          type: 'object',
          properties: {
            skill_map: { type: 'array', items: { type: 'object', properties: {
              role_cluster: { type: 'string' },
              skills: { type: 'array', items: { type: 'object', properties: { skill: { type: 'string' }, depth: { type: 'string' } } } }
            } } },
            critical_missing_skills: { type: 'array', items: { type: 'string' } },
            cross_training_opportunities: { type: 'array', items: { type: 'string' } },
            ninety_day_upskilling_priorities: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // --- 20. WORKFORCE FORECASTING ---
    if (action === 'workforce_forecasting') {
      const { horizon, role_focus } = params;
      const team = await loadTeam();

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a workforce forecast.

Horizon: ${horizon || '12 months'}
Role focus: ${role_focus || 'all'}
Current team (${team.length}): ${JSON.stringify(team.slice(0, 60).map(m => ({
  role: m.role, department: m.department, employment_status: m.employment_status, start_date: m.start_date
})))}

Output:
1. Headcount trajectory by function
2. Roles likely under-capacity
3. Hiring priorities by quarter
4. Build vs buy recommendations
5. Risk-adjusted staffing plan`,
        response_json_schema: {
          type: 'object',
          properties: {
            headcount_trajectory: { type: 'array', items: { type: 'object', properties: { period: { type: 'string' }, expected_headcount: { type: 'number' } } } },
            under_capacity_roles: { type: 'array', items: { type: 'string' } },
            hiring_priorities: { type: 'array', items: { type: 'string' } },
            build_vs_buy_recommendations: { type: 'array', items: { type: 'string' } },
            staffing_plan: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // --- 21. SUCCESSION PLANNING ---
    if (action === 'succession_planning') {
      const { role_focus } = params;
      const team = await loadTeam();

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate succession planning recommendations.

Role focus: ${role_focus || 'critical roles'}
Team context: ${JSON.stringify(team.slice(0, 50).map(m => ({
  name: m.name, role: m.role, department: m.department, engagement_score: m.engagement_score
})))}

Deliver:
1. Critical roles and successor coverage
2. No-successor risk list
3. High-potential internal successors
4. Development actions per successor
5. Emergency succession gaps`,
        response_json_schema: {
          type: 'object',
          properties: {
            critical_roles: { type: 'array', items: { type: 'string' } },
            no_successor_risks: { type: 'array', items: { type: 'string' } },
            successor_candidates: { type: 'array', items: { type: 'object', properties: { role: { type: 'string' }, candidate: { type: 'string' }, readiness: { type: 'string' } } } },
            development_actions: { type: 'array', items: { type: 'string' } },
            emergency_gaps: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // --- 22. RECRUITMENT FUNNEL INTELLIGENCE ---
    if (action === 'recruitment_funnel_intelligence') {
      const { role } = params;
      const team = await loadTeam();

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Create recruitment funnel intelligence guidance.

Role to hire: ${role || target || 'support worker'}
Current team context: ${JSON.stringify(team.slice(0, 30).map(m => ({ role: m.role, department: m.department })))}

Return:
1. Ideal profile summary
2. Funnel stages and conversion benchmarks
3. Drop-off risk points and fixes
4. Interview panel design
5. 30-day hiring sprint plan`,
        response_json_schema: {
          type: 'object',
          properties: {
            ideal_profile: { type: 'string' },
            funnel_benchmarks: { type: 'array', items: { type: 'string' } },
            dropoff_risks: { type: 'array', items: { type: 'string' } },
            panel_design: { type: 'array', items: { type: 'string' } },
            hiring_sprint_plan: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // --- 23. ONBOARDING COMMAND CENTER ---
    if (action === 'onboarding_command_center') {
      const team = await loadTeam();

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate onboarding command-center controls.

Team context (${team.length}): ${JSON.stringify(team.slice(0, 40).map(m => ({ name: m.name, role: m.role, start_date: m.start_date })))}

Produce:
1. Preboarding checklist controls
2. Day 1-30 risk points
3. 30-60-90 check-in sequence
4. Manager accountability actions
5. Early attrition prevention interventions`,
        response_json_schema: {
          type: 'object',
          properties: {
            preboarding_controls: { type: 'array', items: { type: 'string' } },
            day_1_30_risks: { type: 'array', items: { type: 'string' } },
            checkin_sequence: { type: 'array', items: { type: 'string' } },
            manager_actions: { type: 'array', items: { type: 'string' } },
            attrition_prevention: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // --- 24. PERFORMANCE SIGNAL SCAN ---
    if (action === 'performance_signal_scan') {
      const { context } = params;
      const team = await loadTeam();

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Scan performance signals across the team.

Context: ${context || 'general performance and development review'}
Team data: ${JSON.stringify(team.slice(0, 60).map(m => ({
  name: m.name, role: m.role, engagement_score: m.engagement_score, wellbeing_status: m.wellbeing_status
})))}

Return:
1. High-performance signals
2. At-risk performance signals
3. Coaching opportunities
4. Goal/OKR misalignment signals
5. 30-day manager actions`,
        response_json_schema: {
          type: 'object',
          properties: {
            high_performance_signals: { type: 'array', items: { type: 'string' } },
            at_risk_signals: { type: 'array', items: { type: 'string' } },
            coaching_opportunities: { type: 'array', items: { type: 'string' } },
            okr_misalignment: { type: 'array', items: { type: 'string' } },
            manager_actions_30_days: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // --- 25. BURNOUT RISK DETECTION ---
    if (action === 'burnout_risk_detection') {
      const team = await loadTeam();
      const wellness = await loadWellness();

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Run a burnout risk detection scan.

Team: ${JSON.stringify(team.slice(0, 60).map(m => ({
  name: m.name, role: m.role, wellbeing_status: m.wellbeing_status, engagement_score: m.engagement_score
})))}

Wellness: ${JSON.stringify(wellness.slice(0, 40).map(w => ({
  staff_name: w.staff_name, wellbeing_score: w.wellbeing_score, stress_level: w.stress_level,
  burnout_risk: w.burnout_risk, days_since_last_day_off: w.days_since_last_day_off
})))}

Return:
1. High and critical risk staff list
2. Team-level stress clusters
3. Immediate interventions
4. Structural prevention actions`,
        response_json_schema: {
          type: 'object',
          properties: {
            high_risk_staff: { type: 'array', items: { type: 'string' } },
            critical_risk_staff: { type: 'array', items: { type: 'string' } },
            stress_clusters: { type: 'array', items: { type: 'string' } },
            immediate_interventions: { type: 'array', items: { type: 'string' } },
            structural_prevention: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // --- 26. ATTRITION PREDICTION ---
    if (action === 'attrition_prediction') {
      const team = await loadTeam();
      const wellness = await loadWellness();

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Predict attrition risk.

Team: ${JSON.stringify(team.slice(0, 60).map(m => ({
  name: m.name, role: m.role, start_date: m.start_date, engagement_score: m.engagement_score, wellbeing_status: m.wellbeing_status
})))}

Wellness: ${JSON.stringify(wellness.slice(0, 40).map(w => ({
  staff_name: w.staff_name, wellbeing_score: w.wellbeing_score, burnout_risk: w.burnout_risk
})))}

Provide:
1. High-risk attrition list
2. Medium-risk watchlist
3. Predicted drivers of turnover
4. Retention interventions by segment
5. 90-day attrition outlook`,
        response_json_schema: {
          type: 'object',
          properties: {
            high_risk: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, primary_risk_factor: { type: 'string' }, intervention: { type: 'string' } } } },
            medium_risk: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, signal: { type: 'string' }, proactive_step: { type: 'string' } } } },
            turnover_drivers: { type: 'array', items: { type: 'string' } },
            interventions: { type: 'array', items: { type: 'string' } },
            outlook_90_days: { type: 'string' }
          }
        }
      });
    }

    // --- 27. MANAGER EFFECTIVENESS COACH ---
    if (action === 'manager_effectiveness_coach') {
      const team = await loadTeam();

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate manager effectiveness coaching recommendations.

Team data: ${JSON.stringify(team.slice(0, 60).map(m => ({
  name: m.name, role: m.role, department: m.department, engagement_score: m.engagement_score, notes: m.notes?.slice(0, 120)
})))}

Provide:
1. Manager effectiveness strengths
2. Manager risk signals
3. Coaching prompts for managers
4. Team communication habits to improve
5. Priority manager actions for next 30 days`,
        response_json_schema: {
          type: 'object',
          properties: {
            strengths: { type: 'array', items: { type: 'string' } },
            manager_risks: { type: 'array', items: { type: 'string' } },
            coaching_prompts: { type: 'array', items: { type: 'string' } },
            communication_improvements: { type: 'array', items: { type: 'string' } },
            priority_manager_actions: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // --- 28. COMPENSATION FAIRNESS SCAN ---
    if (action === 'compensation_fairness_scan') {
      const { role_focus } = params;
      const team = await loadTeam();

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Run a compensation fairness and competitiveness scan.

Role focus: ${role_focus || 'all roles'}
Team snapshot: ${JSON.stringify(team.slice(0, 60).map(m => ({
  name: m.name, role: m.role, department: m.department, employment_status: m.employment_status
})))}

Deliver:
1. Internal fairness signals to investigate
2. Role families likely below-market
3. Equity/benefits risk indicators
4. Retention risk from compensation posture
5. Recommended adjustment framework`,
        response_json_schema: {
          type: 'object',
          properties: {
            fairness_signals: { type: 'array', items: { type: 'string' } },
            below_market_role_families: { type: 'array', items: { type: 'string' } },
            benefits_risks: { type: 'array', items: { type: 'string' } },
            compensation_retention_risks: { type: 'array', items: { type: 'string' } },
            adjustment_framework: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // --- 29. CULTURE ALIGNMENT MONITOR ---
    if (action === 'culture_alignment_monitor') {
      const team = await loadTeam();
      const wellness = await loadWellness();

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Monitor culture alignment and belonging signals.

Team: ${JSON.stringify(team.slice(0, 60).map(m => ({
  name: m.name, role: m.role, engagement_score: m.engagement_score, wellbeing_status: m.wellbeing_status
})))}

Wellness: ${JSON.stringify(wellness.slice(0, 40).map(w => ({
  staff_name: w.staff_name, wellbeing_score: w.wellbeing_score, stress_level: w.stress_level
})))}

Return:
1. Culture alignment score
2. Inclusion/belonging strengths
3. Emerging culture risks
4. Leadership behaviors to reinforce
5. Team rituals to improve`,
        response_json_schema: {
          type: 'object',
          properties: {
            culture_alignment_score: { type: 'number' },
            belonging_strengths: { type: 'array', items: { type: 'string' } },
            risk_areas: { type: 'array', items: { type: 'string' } },
            leadership_behaviors: { type: 'array', items: { type: 'string' } },
            ritual_improvements: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // --- 30. COMPLIANCE POLICY AUDIT ---
    if (action === 'compliance_policy_audit') {
      const team = await loadTeam();

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Run HR policy and people-compliance audit readiness scan.

Team context (${team.length}): ${JSON.stringify(team.slice(0, 50).map(m => ({
  name: m.name, role: m.role, employment_status: m.employment_status
})))}

Provide:
1. Policy acknowledgment risk areas
2. Training compliance blind spots
3. Leave/accommodation process risks
4. Audit evidence readiness score
5. 30-day remediation plan`,
        response_json_schema: {
          type: 'object',
          properties: {
            policy_risks: { type: 'array', items: { type: 'string' } },
            training_blind_spots: { type: 'array', items: { type: 'string' } },
            leave_process_risks: { type: 'array', items: { type: 'string' } },
            audit_readiness_score: { type: 'number' },
            remediation_plan: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // --- 31. EMPLOYEE JOURNEY MAP ---
    if (action === 'employee_journey_map') {
      const { team_context } = params;
      const team = await loadTeam();

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Map the employee journey and key moments.

Team context: ${team_context || target || 'organization-wide'}
Team data: ${JSON.stringify(team.slice(0, 60).map(m => ({ name: m.name, role: m.role, start_date: m.start_date, wellbeing_status: m.wellbeing_status })))}

Deliver:
1. Journey stages and moments that matter
2. Friction points per stage
3. Signals that predict disengagement
4. Experience improvements by stage
5. Metrics to monitor for each stage`,
        response_json_schema: {
          type: 'object',
          properties: {
            journey_stages: { type: 'array', items: { type: 'string' } },
            friction_points: { type: 'array', items: { type: 'string' } },
            disengagement_signals: { type: 'array', items: { type: 'string' } },
            stage_improvements: { type: 'array', items: { type: 'string' } },
            stage_metrics: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // --- 32. PULSE FULL SELF TEST ---
    if (action === 'pulse_full_self_test') {
      const team = await loadTeam();
      const wellness = await loadWellness();

      const people = await base44.integrations.Core.InvokeLLM({
        prompt: `Summarize people analytics.
Team: ${JSON.stringify(team.slice(0, 50).map(m => ({ role: m.role, engagement_score: m.engagement_score, wellbeing_status: m.wellbeing_status })))}
Wellness: ${JSON.stringify(wellness.slice(0, 30).map(w => ({ wellbeing_score: w.wellbeing_score, burnout_risk: w.burnout_risk })))}
Return engagement_score, wellbeing_score, retention_health_score and top_risks/top_opportunities arrays.`,
        response_json_schema: {
          type: 'object',
          properties: {
            engagement_score: { type: 'number' },
            wellbeing_score: { type: 'number' },
            retention_health_score: { type: 'number' },
            top_risks: { type: 'array', items: { type: 'string' } },
            top_opportunities: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      const forecast = await base44.integrations.Core.InvokeLLM({
        prompt: `Provide workforce forecast summary with headcount_outlook, hiring_priorities, and capacity_risks arrays from this team context: ${JSON.stringify(team.slice(0, 40).map(m => ({ role: m.role, department: m.department })))}.`,
        response_json_schema: {
          type: 'object',
          properties: {
            headcount_outlook: { type: 'string' },
            hiring_priorities: { type: 'array', items: { type: 'string' } },
            capacity_risks: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      const attrition = await base44.integrations.Core.InvokeLLM({
        prompt: `Provide attrition risk summary with high_risk list and intervention_playbook from: ${JSON.stringify(team.slice(0, 40).map(m => ({ name: m.name, engagement_score: m.engagement_score, wellbeing_status: m.wellbeing_status })))}.`,
        response_json_schema: {
          type: 'object',
          properties: {
            high_risk: { type: 'array', items: { type: 'object', properties: { name: { type: 'string' }, primary_risk_factor: { type: 'string' }, intervention: { type: 'string' } } } },
            intervention_playbook: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      const burnout = await base44.integrations.Core.InvokeLLM({
        prompt: `Provide burnout summary with priority_actions and structural_prevention from wellness data: ${JSON.stringify(wellness.slice(0, 40).map(w => ({ staff_name: w.staff_name, wellbeing_score: w.wellbeing_score, stress_level: w.stress_level, burnout_risk: w.burnout_risk })))}.`,
        response_json_schema: {
          type: 'object',
          properties: {
            priority_actions: { type: 'array', items: { type: 'object', properties: { person: { type: 'string' }, action: { type: 'string' } } } },
            structural_prevention: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      const culture = await base44.integrations.Core.InvokeLLM({
        prompt: `Provide culture health with culture_alignment_score and risk_areas from this team context: ${JSON.stringify(team.slice(0, 40).map(m => ({ role: m.role, engagement_score: m.engagement_score, wellbeing_status: m.wellbeing_status })))}.`,
        response_json_schema: {
          type: 'object',
          properties: {
            culture_alignment_score: { type: 'number' },
            risk_areas: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      const compliance = await base44.integrations.Core.InvokeLLM({
        prompt: `Provide policy compliance summary with audit_readiness_score and remediation_plan based on team profile: ${JSON.stringify(team.slice(0, 40).map(m => ({ role: m.role, employment_status: m.employment_status })))}.`,
        response_json_schema: {
          type: 'object',
          properties: {
            audit_readiness_score: { type: 'number' },
            remediation_plan: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      const managerCoach = await base44.integrations.Core.InvokeLLM({
        prompt: `Provide manager coaching summary with priority_manager_actions based on engagement/wellbeing patterns: ${JSON.stringify(team.slice(0, 40).map(m => ({ role: m.role, engagement_score: m.engagement_score, wellbeing_status: m.wellbeing_status })))}.`,
        response_json_schema: {
          type: 'object',
          properties: {
            priority_manager_actions: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      result = {
        checks: {
          people_ok: !!people,
          forecast_ok: !!forecast,
          attrition_ok: !!attrition,
          burnout_ok: !!burnout,
          culture_ok: !!culture,
          compliance_ok: !!compliance,
          manager_coach_ok: !!managerCoach,
        },
        people,
        forecast,
        attrition,
        burnout,
        culture,
        compliance,
        managerCoach,
      };
    }
        if (!result) {
      result = { message: `Action '${action}' received. Available actions: generate_jd, onboarding_plan, ndis_onboarding, ndis_compliance_check, worker_matching, burnout_analysis, pulse_survey, performance_review, skills_gap, retention_risk, recognition, people_analytics, exit_interview, compensation_benchmark, learning_recommendations, culture_health, wellness_score, talent_intelligence_hub, skills_inventory_mapping, workforce_forecasting, succession_planning, recruitment_funnel_intelligence, onboarding_command_center, performance_signal_scan, burnout_risk_detection, attrition_prediction, manager_effectiveness_coach, compensation_fairness_scan, culture_alignment_monitor, compliance_policy_audit, employee_journey_map, pulse_full_self_test` };
    }

    return Response.json({ status: 'pulse_complete', action, result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});
