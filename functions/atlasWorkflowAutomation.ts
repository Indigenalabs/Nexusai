import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const { action } = payload;
    let result = null;

    // ─── WORKFLOW ACTIONS ────────────────────────────────────────────────────

    if (action === 'create_workflow') {
      const { workflow_trigger, industry, departments, steps } = payload;
      const workflow = await base44.integrations.Core.InvokeLLM({
        prompt: `Design a complete business workflow for: ${workflow_trigger}
Industry: ${industry || 'General'}
Departments involved: ${departments || 'All'}
Additional context: ${steps || ''}

Create a production-ready workflow with:
1. Trigger conditions (what starts this workflow)
2. Step-by-step process with owners and time estimates
3. Decision points and branching logic (if X then Y)
4. Parallel tracks (what can happen simultaneously)
5. Approval gates (who needs to sign off and when)
6. Error handling and escalation rules
7. Success criteria and completion triggers
8. Estimated total cycle time and time savings vs. manual
9. KPIs to track this workflow's performance
10. Integration touchpoints with other systems/agents`,
        response_json_schema: {
          type: 'object',
          properties: {
            workflow_name: { type: 'string' },
            trigger: { type: 'string' },
            steps: { type: 'array', items: { type: 'object', properties: { step: { type: 'string' }, owner: { type: 'string' }, estimated_time: { type: 'string' }, type: { type: 'string' } } } },
            decision_points: { type: 'array', items: { type: 'string' } },
            approval_gates: { type: 'array', items: { type: 'string' } },
            error_handling: { type: 'array', items: { type: 'string' } },
            success_criteria: { type: 'array', items: { type: 'string' } },
            estimated_cycle_time: { type: 'string' },
            time_saved_vs_manual: { type: 'string' },
            kpis: { type: 'array', items: { type: 'string' } }
          }
        }
      });
      const workflowRecord = await base44.asServiceRole.entities.Workflow.create({
        name: workflow_trigger,
        status: 'draft',
        trigger: workflow_trigger,
        industry: industry || 'General'
      });
      result = { workflow_id: workflowRecord.id, ...workflow };
    }

    if (action === 'automate_process') {
      const { process_name, current_pain_points } = payload;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Design a full automation blueprint for: ${process_name}
Current pain points: ${current_pain_points || 'Not specified'}

Provide:
1. What can be 100% automated (no human needed)
2. What should be human-in-the-loop (automated + approval)
3. What must remain manual (and why)
4. Trigger mechanism (schedule, event, webhook, manual)
5. Tool/integration requirements
6. Step-by-step automation flow
7. Exception handling and fallback rules
8. Time saved per cycle (hours/minutes)
9. Error reduction estimate
10. Implementation priority (quick win vs. long-term)
11. Estimated implementation effort (days)`,
        response_json_schema: {
          type: 'object',
          properties: {
            automated_steps: { type: 'array', items: { type: 'string' } },
            human_in_loop_steps: { type: 'array', items: { type: 'string' } },
            manual_steps: { type: 'array', items: { type: 'string' } },
            trigger_mechanism: { type: 'string' },
            tools_required: { type: 'array', items: { type: 'string' } },
            automation_flow: { type: 'array', items: { type: 'string' } },
            exception_handling: { type: 'array', items: { type: 'string' } },
            time_saved_per_cycle: { type: 'string' },
            error_reduction: { type: 'string' },
            implementation_effort: { type: 'string' },
            priority: { type: 'string' }
          }
        }
      });
    }

    if (action === 'map_process') {
      const { process_name, description } = payload;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a detailed process map for: ${process_name}
Description: ${description || ''}

Map this process with:
1. All actors/roles involved (human and system)
2. Sequential steps with clear handoff points
3. Inputs and outputs for each step
4. Time per step and total cycle time
5. Decision gateways with conditions
6. Pain points and bottlenecks in current state
7. Inefficiencies and waste (waiting, rework, duplication)
8. Future state recommendations
9. Quick wins (fixes possible in <1 week)
10. Process health score (0-100)`,
        response_json_schema: {
          type: 'object',
          properties: {
            actors: { type: 'array', items: { type: 'string' } },
            process_steps: { type: 'array', items: { type: 'object', properties: { step: { type: 'string' }, actor: { type: 'string' }, input: { type: 'string' }, output: { type: 'string' }, time_estimate: { type: 'string' } } } },
            total_cycle_time: { type: 'string' },
            bottlenecks: { type: 'array', items: { type: 'string' } },
            pain_points: { type: 'array', items: { type: 'string' } },
            quick_wins: { type: 'array', items: { type: 'string' } },
            future_state_recommendations: { type: 'array', items: { type: 'string' } },
            process_health_score: { type: 'number' }
          }
        }
      });
    }

    if (action === 'approval_flow') {
      const { request_type, requester, amount, description } = payload;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Design an approval workflow for: ${request_type}
Requester: ${requester}
Amount/Scope: ${amount || 'Not specified'}
Description: ${description || ''}

Create:
1. Approval chain (who approves in what order)
2. Approval thresholds (auto-approve below $X, escalate above $Y)
3. Information required at each level
4. SLA for each approval stage
5. Escalation rules if approver doesn't respond
6. Rejection process and re-submission rules
7. Notification template for each stage
8. Audit trail requirements`,
        response_json_schema: {
          type: 'object',
          properties: {
            approval_chain: { type: 'array', items: { type: 'object', properties: { level: { type: 'number' }, approver: { type: 'string' }, sla_hours: { type: 'number' }, threshold: { type: 'string' } } } },
            auto_approve_conditions: { type: 'array', items: { type: 'string' } },
            escalation_rules: { type: 'array', items: { type: 'string' } },
            rejection_process: { type: 'array', items: { type: 'string' } },
            notification_templates: { type: 'object' }
          }
        }
      });
    }

    // ─── TASK & PROJECT ACTIONS ──────────────────────────────────────────────

    if (action === 'assign_tasks') {
      const tasks = await base44.asServiceRole.entities.Task.list('-created_date', 50);
      const unassigned = tasks.filter(t => !t.assignee && t.status !== 'completed' && t.status !== 'cancelled');
      const teamMembers = await base44.asServiceRole.entities.TeamMember.list();

      if (unassigned.length === 0) {
        result = { message: 'All tasks are already assigned.', tasks_assigned: 0 };
      } else {
        const assignments = await base44.integrations.Core.InvokeLLM({
          prompt: `Intelligently assign ${unassigned.length} tasks to ${teamMembers.length} team members.

Tasks:
${unassigned.map(t => `- ID: ${t.id} | Title: ${t.title} | Priority: ${t.priority || 'medium'} | Due: ${t.due_date || 'no due date'}`).join('\n')}

Team members:
${teamMembers.map(m => `- Name: ${m.name} | Role: ${m.role || 'team member'} | Skills: ${m.skills || 'general'}`).join('\n')}

Assign based on: role fit, skills match, priority urgency, even workload distribution.
Return assignments for ONLY the task IDs listed above.`,
          response_json_schema: {
            type: 'object',
            properties: {
              assignments: {
                type: 'array',
                items: { type: 'object', properties: { task_id: { type: 'string' }, assignee: { type: 'string' }, reasoning: { type: 'string' } } }
              }
            }
          }
        });

        let assigned = 0;
        for (const a of (assignments.assignments || [])) {
          const task = unassigned.find(t => t.id === a.task_id);
          if (task && a.assignee) {
            await base44.asServiceRole.entities.Task.update(task.id, { assignee: a.assignee });
            assigned++;
          }
        }
        result = { tasks_assigned: assigned, assignments: assignments.assignments };
      }
    }

    if (action === 'track_workload') {
      const teamMembers = await base44.asServiceRole.entities.TeamMember.list();
      const allTasks = await base44.asServiceRole.entities.Task.list('-created_date', 200);
      const activeTasks = allTasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');

      const workload = teamMembers.map(member => {
        const memberTasks = activeTasks.filter(t => t.assignee === member.name || t.assigned_to === member.name);
        const overdue = memberTasks.filter(t => t.due_date && new Date(t.due_date) < new Date());
        const highPriority = memberTasks.filter(t => t.priority === 'high' || t.priority === 'critical');
        return {
          name: member.name,
          role: member.role,
          total_tasks: memberTasks.length,
          overdue_tasks: overdue.length,
          high_priority_tasks: highPriority.length,
          workload_status: memberTasks.length > 10 ? 'overloaded' : memberTasks.length > 5 ? 'busy' : 'manageable'
        };
      });

      const analysis = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze team workload and provide recommendations:

${JSON.stringify(workload, null, 2)}

Total active tasks: ${activeTasks.length}
Total team members: ${teamMembers.length}

Provide:
1. Workload summary — who's overloaded, who has capacity
2. Redistribution recommendations (specific task moves)
3. Burnout risks (flag anyone with >10 tasks or excessive overdue)
4. Capacity gaps (tasks with no assignee)
5. Recommended immediate actions (top 3)`,
        response_json_schema: {
          type: 'object',
          properties: {
            workload_summary: { type: 'string' },
            overloaded_members: { type: 'array', items: { type: 'string' } },
            available_capacity: { type: 'array', items: { type: 'string' } },
            redistribution_recommendations: { type: 'array', items: { type: 'string' } },
            burnout_risks: { type: 'array', items: { type: 'string' } },
            immediate_actions: { type: 'array', items: { type: 'string' } }
          }
        }
      });
      result = { workload_by_member: workload, analysis };
    }

    if (action === 'project_status') {
      const tasks = await base44.asServiceRole.entities.Task.list('-updated_date', 200);
      const projects = {};
      tasks.forEach(t => {
        const proj = t.project || 'Unassigned';
        if (!projects[proj]) projects[proj] = { name: proj, total: 0, completed: 0, in_progress: 0, blocked: 0, overdue: 0 };
        projects[proj].total++;
        if (t.status === 'completed') projects[proj].completed++;
        if (t.status === 'in_progress') projects[proj].in_progress++;
        if (t.status === 'blocked') projects[proj].blocked++;
        if (t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed' && t.status !== 'cancelled') projects[proj].overdue++;
      });

      const projectList = Object.values(projects).map(p => ({
        ...p,
        completion_rate: p.total > 0 ? Math.round((p.completed / p.total) * 100) : 0,
        health: p.blocked > 0 ? 'at_risk' : p.overdue > 0 ? 'behind' : 'on_track'
      }));

      result = { projects: projectList, total_projects: projectList.length };
    }

    if (action === 'prioritize_tasks') {
      const tasks = await base44.asServiceRole.entities.Task.list('-created_date', 100);
      const active = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');

      const prioritized = await base44.integrations.Core.InvokeLLM({
        prompt: `Prioritize and rank these ${active.length} active tasks by business impact and urgency:

${active.map(t => `- ID: ${t.id} | ${t.title} | Priority: ${t.priority || 'medium'} | Due: ${t.due_date || 'no date'} | Status: ${t.status} | Assignee: ${t.assignee || 'unassigned'}`).join('\n')}

Rank them using:
1. Urgency (overdue or due soon = higher priority)
2. Business impact (blocking others, customer-facing, revenue impact)
3. Dependencies (tasks blocking other tasks)
4. Quick wins (high impact, low effort)

Return top 20 ranked tasks with reasoning.`,
        response_json_schema: {
          type: 'object',
          properties: {
            ranked_tasks: { type: 'array', items: { type: 'object', properties: { rank: { type: 'number' }, task_id: { type: 'string' }, title: { type: 'string' }, reason: { type: 'string' }, recommended_action: { type: 'string' } } } },
            immediate_focus: { type: 'array', items: { type: 'string' } }
          }
        }
      });
      result = prioritized;
    }

    if (action === 'dependency_check') {
      const { task_id, task_title } = payload;
      const tasks = await base44.asServiceRole.entities.Task.list('-created_date', 200);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze dependencies for task: ${task_title || task_id}

All active tasks in system:
${tasks.filter(t => t.status !== 'completed').map(t => `- ${t.title} (${t.status}) | Assignee: ${t.assignee || 'unassigned'} | Due: ${t.due_date || 'none'}`).join('\n')}

Identify:
1. Tasks that must complete BEFORE this task can start
2. Tasks that are BLOCKED by this task
3. Parallel tasks (can run simultaneously)
4. Risk of cascade delays if this task is late
5. Recommended sequencing`,
        response_json_schema: {
          type: 'object',
          properties: {
            prerequisites: { type: 'array', items: { type: 'string' } },
            blocked_by_this: { type: 'array', items: { type: 'string' } },
            parallel_tasks: { type: 'array', items: { type: 'string' } },
            cascade_risk: { type: 'string' },
            recommended_sequencing: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── RESOURCE ACTIONS ────────────────────────────────────────────────────

    if (action === 'resource_allocation') {
      const teamMembers = await base44.asServiceRole.entities.TeamMember.list();
      const tasks = await base44.asServiceRole.entities.Task.list('-created_date', 100);
      const active = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Optimize resource allocation for the current workload:

Team (${teamMembers.length} members):
${teamMembers.map(m => `- ${m.name} | Role: ${m.role || 'general'} | Skills: ${m.skills || 'not listed'}`).join('\n')}

Active tasks (${active.length}):
${active.slice(0, 30).map(t => `- ${t.title} | Priority: ${t.priority || 'medium'} | Assigned: ${t.assignee || 'UNASSIGNED'} | Due: ${t.due_date || 'no date'}`).join('\n')}

Provide:
1. Current allocation gaps (unassigned high-priority tasks)
2. Skill mismatches (wrong person on wrong task)
3. Capacity opportunities (who has bandwidth)
4. Reallocation recommendations (specific moves)
5. Hiring signals (if consistently understaffed in an area)`,
        response_json_schema: {
          type: 'object',
          properties: {
            allocation_gaps: { type: 'array', items: { type: 'string' } },
            skill_mismatches: { type: 'array', items: { type: 'string' } },
            capacity_opportunities: { type: 'array', items: { type: 'string' } },
            reallocation_recommendations: { type: 'array', items: { type: 'string' } },
            hiring_signals: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    if (action === 'capacity_forecast') {
      const { weeks_ahead } = payload;
      const teamMembers = await base44.asServiceRole.entities.TeamMember.list();
      const tasks = await base44.asServiceRole.entities.Task.list('-created_date', 200);

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Forecast resource capacity for the next ${weeks_ahead || 4} weeks.

Team size: ${teamMembers.length} members
Active tasks: ${tasks.filter(t => t.status !== 'completed').length}
Upcoming tasks (due in next ${weeks_ahead || 4} weeks): ${tasks.filter(t => t.due_date && new Date(t.due_date) > new Date() && new Date(t.due_date) < new Date(Date.now() + (weeks_ahead || 4) * 7 * 24 * 60 * 60 * 1000)).length}

Forecast:
1. Week-by-week capacity vs. demand
2. Peak crunch periods
3. Under-utilization periods
4. Recommended project scheduling to smooth load
5. Hiring or contractor needs
6. Risk periods (when team is most stretched)`,
        response_json_schema: {
          type: 'object',
          properties: {
            weekly_forecast: { type: 'array', items: { type: 'object', properties: { week: { type: 'string' }, capacity_percent: { type: 'number' }, notes: { type: 'string' } } } },
            peak_periods: { type: 'array', items: { type: 'string' } },
            recommendations: { type: 'array', items: { type: 'string' } },
            hiring_needs: { type: 'string' }
          }
        }
      });
    }

    if (action === 'skill_inventory') {
      const teamMembers = await base44.asServiceRole.entities.TeamMember.list();
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze team skill inventory and identify gaps:

Team:
${teamMembers.map(m => `- ${m.name} | Role: ${m.role || 'N/A'} | Skills: ${m.skills || 'not documented'} | Department: ${m.department || 'N/A'}`).join('\n')}

Provide:
1. Skills inventory summary (what skills the team collectively has)
2. Skill gaps (critical skills missing from the team)
3. Single points of failure (only one person knows X)
4. Cross-training recommendations
5. Skills to hire for next
6. Team capability score (0-100)`,
        response_json_schema: {
          type: 'object',
          properties: {
            skills_summary: { type: 'object' },
            critical_gaps: { type: 'array', items: { type: 'string' } },
            single_points_of_failure: { type: 'array', items: { type: 'string' } },
            cross_training_recommendations: { type: 'array', items: { type: 'string' } },
            next_hire_priority: { type: 'array', items: { type: 'string' } },
            team_capability_score: { type: 'number' }
          }
        }
      });
    }

    if (action === 'workload_balance') {
      const { from_member, to_member, num_tasks } = payload;
      const tasks = await base44.asServiceRole.entities.Task.list('-created_date', 200);
      const fromTasks = tasks.filter(t => (t.assignee === from_member || t.assigned_to === from_member) && t.status !== 'completed');
      const toMove = fromTasks.slice(0, num_tasks || 3);
      for (const t of toMove) {
        await base44.asServiceRole.entities.Task.update(t.id, { assignee: to_member });
      }
      result = { tasks_moved: toMove.length, from: from_member, to: to_member, tasks: toMove.map(t => t.title) };
    }

    // ─── BPO AUTOMATION ACTIONS ──────────────────────────────────────────────

    if (action === 'onboarding_workflow') {
      const { type, name, role, department, start_date } = payload;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Design a complete ${type === 'offboarding' ? 'offboarding' : 'onboarding'} workflow for:
Name: ${name}
Role: ${role || 'Not specified'}
Department: ${department || 'Not specified'}
${type === 'onboarding' ? `Start Date: ${start_date || 'TBD'}` : 'Departure date: Immediate'}

Create a day-by-day checklist for the first 30 days (onboarding) or full offboarding checklist with:
1. IT setup tasks (accounts, equipment, access)
2. HR tasks (contracts, benefits, payroll)
3. Department-specific tasks
4. Training and orientation schedule
5. Key people to meet
6. 30-day success milestones (onboarding) or access revocation checklist (offboarding)
7. Compliance requirements (NDIS worker screening if applicable)
8. Responsible party for each task`,
        response_json_schema: {
          type: 'object',
          properties: {
            workflow_type: { type: 'string' },
            employee_name: { type: 'string' },
            pre_start_tasks: { type: 'array', items: { type: 'object', properties: { task: { type: 'string' }, owner: { type: 'string' }, deadline: { type: 'string' } } } },
            week_1_tasks: { type: 'array', items: { type: 'string' } },
            week_2_4_tasks: { type: 'array', items: { type: 'string' } },
            compliance_items: { type: 'array', items: { type: 'string' } },
            success_milestones: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    if (action === 'procurement_automation') {
      const { item, quantity, estimated_cost, urgency, vendor } = payload;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a procurement workflow for:
Item: ${item}
Quantity: ${quantity || 1}
Estimated cost: ${estimated_cost || 'Unknown'}
Urgency: ${urgency || 'standard'}
Preferred vendor: ${vendor || 'Not specified'}

Design:
1. Purchase justification template
2. Approval routing (based on cost thresholds: <$500, $500-$5000, >$5000)
3. Vendor selection criteria if no vendor specified
4. PO creation checklist
5. Delivery and receipt process
6. Budget code and categorization
7. Three-way match process (PO, delivery, invoice)
8. Payment terms and timeline`,
        response_json_schema: {
          type: 'object',
          properties: {
            approval_required: { type: 'string' },
            approval_chain: { type: 'array', items: { type: 'string' } },
            justification_template: { type: 'string' },
            vendor_criteria: { type: 'array', items: { type: 'string' } },
            procurement_steps: { type: 'array', items: { type: 'string' } },
            estimated_timeline: { type: 'string' },
            budget_category: { type: 'string' }
          }
        }
      });
    }

    if (action === 'incident_management') {
      const { incident_type, severity, description, affected_systems } = payload;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Create an incident response playbook for:
Type: ${incident_type || 'General IT Incident'}
Severity: ${severity || 'medium'} (critical/high/medium/low)
Description: ${description || 'Not provided'}
Affected systems: ${affected_systems || 'Unknown'}

Generate a complete IR playbook:
1. Immediate triage steps (first 15 minutes)
2. Escalation matrix (who to notify at each severity level)
3. Containment actions (stop the bleeding)
4. Investigation steps (root cause analysis)
5. Communication templates (internal, customer-facing)
6. Recovery steps (restore to normal)
7. Post-incident review checklist
8. SLAs by severity (response and resolution times)
9. NDIS/Privacy Act implications if participant data involved`,
        response_json_schema: {
          type: 'object',
          properties: {
            severity_level: { type: 'string' },
            immediate_actions: { type: 'array', items: { type: 'string' } },
            escalation_matrix: { type: 'array', items: { type: 'object', properties: { severity: { type: 'string' }, notify: { type: 'array', items: { type: 'string' } }, timeline: { type: 'string' } } } },
            containment_steps: { type: 'array', items: { type: 'string' } },
            investigation_steps: { type: 'array', items: { type: 'string' } },
            communication_template: { type: 'string' },
            recovery_steps: { type: 'array', items: { type: 'string' } },
            post_incident_checklist: { type: 'array', items: { type: 'string' } },
            sla: { type: 'string' }
          }
        }
      });
    }

    if (action === 'expense_processing') {
      const { submitter, amount, category, description, receipts_provided } = payload;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Process and evaluate this expense claim:
Submitter: ${submitter}
Amount: $${amount}
Category: ${category}
Description: ${description}
Receipts provided: ${receipts_provided ? 'Yes' : 'No'}

Provide:
1. Policy compliance check (is this a valid business expense?)
2. Approval routing (who needs to approve based on amount)
3. Missing information checklist (what else is needed)
4. Budget category assignment
5. GST treatment (if applicable)
6. Expected processing timeline
7. Approve / Hold / Reject recommendation with reasoning`,
        response_json_schema: {
          type: 'object',
          properties: {
            recommendation: { type: 'string' },
            policy_compliant: { type: 'boolean' },
            approval_required_from: { type: 'string' },
            missing_items: { type: 'array', items: { type: 'string' } },
            budget_category: { type: 'string' },
            gst_treatment: { type: 'string' },
            reasoning: { type: 'string' }
          }
        }
      });
    }

    // ─── QUALITY & PERFORMANCE ACTIONS ──────────────────────────────────────

    if (action === 'sla_monitor') {
      const tasks = await base44.asServiceRole.entities.Task.list('-created_date', 200);
      const now = new Date();
      const slaData = tasks.filter(t => t.due_date && t.status !== 'completed' && t.status !== 'cancelled').map(t => {
        const due = new Date(t.due_date);
        const hoursLeft = (due - now) / (1000 * 60 * 60);
        return {
          task: t.title,
          assignee: t.assignee || 'Unassigned',
          due: t.due_date,
          hours_remaining: Math.round(hoursLeft),
          sla_status: hoursLeft < 0 ? 'breached' : hoursLeft < 24 ? 'critical' : hoursLeft < 72 ? 'warning' : 'on_track'
        };
      });

      const breached = slaData.filter(s => s.sla_status === 'breached');
      const critical = slaData.filter(s => s.sla_status === 'critical');
      result = { sla_summary: slaData, breached_count: breached.length, critical_count: critical.length, on_track_count: slaData.filter(s => s.sla_status === 'on_track').length };
    }

    if (action === 'process_analytics') {
      const tasks = await base44.asServiceRole.entities.Task.list('-created_date', 200);
      const completed = tasks.filter(t => t.status === 'completed');
      const workflows = await base44.asServiceRole.entities.Workflow.list('-created_date', 50);

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze operational process performance:

Tasks completed: ${completed.length}
Active tasks: ${tasks.filter(t => t.status !== 'completed').length}
Blocked tasks: ${tasks.filter(t => t.status === 'blocked').length}
Overdue: ${tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed').length}
Total workflows: ${workflows.length}

By assignee: ${JSON.stringify(Object.entries(tasks.reduce((acc, t) => {
  const a = t.assignee || 'unassigned';
  if (!acc[a]) acc[a] = { total: 0, completed: 0 };
  acc[a].total++;
  if (t.status === 'completed') acc[a].completed++;
  return acc;
}, {})).map(([k, v]) => `${k}: ${v.completed}/${v.total} completed`).join(', '))}

Identify:
1. Bottlenecks (where tasks get stuck)
2. High performers vs. struggling areas
3. Average cycle time estimates
4. Process health score (0-100)
5. Top 5 improvement recommendations
6. Quick wins (implement this week)`,
        response_json_schema: {
          type: 'object',
          properties: {
            process_health_score: { type: 'number' },
            bottlenecks: { type: 'array', items: { type: 'string' } },
            performance_highlights: { type: 'array', items: { type: 'string' } },
            improvement_recommendations: { type: 'array', items: { type: 'string' } },
            quick_wins: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    if (action === 'quality_check') {
      const { deliverable, type, context } = payload;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Perform a quality gate check on this deliverable:
Type: ${type || 'general output'}
Deliverable: ${deliverable}
Context: ${context || ''}

Check against:
1. Completeness (all required elements present)
2. Accuracy (logical, factual, no contradictions)
3. Clarity (clear, unambiguous)
4. Compliance (meets relevant standards/policies)
5. Format/presentation
6. Business impact readiness (safe to send/deliver?)

Return: PASS / FAIL / CONDITIONAL_PASS with specific items to fix.`,
        response_json_schema: {
          type: 'object',
          properties: {
            verdict: { type: 'string' },
            score: { type: 'number' },
            passed_checks: { type: 'array', items: { type: 'string' } },
            failed_checks: { type: 'array', items: { type: 'string' } },
            required_fixes: { type: 'array', items: { type: 'string' } },
            recommendations: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    if (action === 'improvement_recommendations') {
      const tasks = await base44.asServiceRole.entities.Task.list('-created_date', 200);
      const workflows = await base44.asServiceRole.entities.Workflow.list('-created_date', 50);
      const vendors = await base44.asServiceRole.entities.Vendor.list('-created_date', 50);

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate operational improvement recommendations based on current state:

Tasks: ${tasks.length} total, ${tasks.filter(t => t.status === 'blocked').length} blocked, ${tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed').length} overdue
Workflows: ${workflows.length} defined
Vendors: ${vendors.length} tracked

Provide 10 specific, actionable improvement recommendations ranked by impact:
1. Quick wins (implement this week, high impact)
2. Process improvements (1-4 weeks to implement)
3. Automation opportunities (reduce manual work)
4. Strategic improvements (1-3 months)

For each: what to do, why it matters, estimated time to implement, expected benefit.`,
        response_json_schema: {
          type: 'object',
          properties: {
            quick_wins: { type: 'array', items: { type: 'object', properties: { recommendation: { type: 'string' }, effort: { type: 'string' }, benefit: { type: 'string' } } } },
            process_improvements: { type: 'array', items: { type: 'object', properties: { recommendation: { type: 'string' }, effort: { type: 'string' }, benefit: { type: 'string' } } } },
            automation_opportunities: { type: 'array', items: { type: 'string' } },
            strategic_improvements: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── VENDOR ACTIONS ──────────────────────────────────────────────────────

    if (action === 'vendor_review') {
      const vendors = await base44.asServiceRole.entities.Vendor.list('-created_date', 100);
      const now = new Date();
      const expiringSoon = vendors.filter(v => v.contract_end && (new Date(v.contract_end) - now) / (1000 * 60 * 60 * 24) <= 60);
      const highCost = vendors.filter(v => v.monthly_cost > 1000).sort((a, b) => b.monthly_cost - a.monthly_cost);

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze vendor portfolio and provide recommendations:

Total vendors: ${vendors.length}
Expiring soon (60 days): ${expiringSoon.map(v => `${v.name} (${v.contract_end})`).join(', ')}
High-cost vendors: ${highCost.slice(0, 5).map(v => `${v.name}: $${v.monthly_cost}/mo`).join(', ')}
Total monthly spend: $${vendors.reduce((sum, v) => sum + (v.monthly_cost || 0), 0).toFixed(2)}

Provide:
1. Renewal action items (what to renew, renegotiate, or cancel)
2. Cost optimization opportunities
3. Consolidation opportunities (vendors doing similar things)
4. Risk assessment (single-source dependencies)
5. Vendor performance flags
6. Recommended vendor additions`,
        response_json_schema: {
          type: 'object',
          properties: {
            total_monthly_spend: { type: 'number' },
            renewal_actions: { type: 'array', items: { type: 'object', properties: { vendor: { type: 'string' }, action: { type: 'string' }, deadline: { type: 'string' }, reason: { type: 'string' } } } },
            cost_optimization: { type: 'array', items: { type: 'string' } },
            consolidation_opportunities: { type: 'array', items: { type: 'string' } },
            risk_flags: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    if (action === 'subscription_audit') {
      const vendors = await base44.asServiceRole.entities.Vendor.list('-created_date', 100);
      const subscriptions = vendors.filter(v => v.billing_cycle === 'monthly' || v.billing_cycle === 'annual' || v.category === 'software' || v.category === 'subscription');

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Audit software subscriptions and identify savings:

Subscriptions found:
${subscriptions.map(v => `- ${v.name}: $${v.monthly_cost || 0}/mo | Category: ${v.category || 'unknown'} | Last reviewed: ${v.last_review || 'never'}`).join('\n')}

Total monthly subscription spend: $${subscriptions.reduce((s, v) => s + (v.monthly_cost || 0), 0)}

Identify:
1. Redundant tools (duplicate functionality)
2. Unused or underused subscriptions (flag for cancellation)
3. Downgrade opportunities (paying for tier you don't need)
4. Bundle/negotiate opportunities
5. Total potential savings
6. Priority cancellations (cut these first)`,
        response_json_schema: {
          type: 'object',
          properties: {
            total_monthly_spend: { type: 'number' },
            redundant_tools: { type: 'array', items: { type: 'string' } },
            cancellation_candidates: { type: 'array', items: { type: 'object', properties: { tool: { type: 'string' }, monthly_saving: { type: 'number' }, reason: { type: 'string' } } } },
            downgrade_opportunities: { type: 'array', items: { type: 'string' } },
            total_potential_savings: { type: 'number' },
            priority_actions: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── REPORTING ACTIONS ───────────────────────────────────────────────────

    if (action === 'ops_report') {
      const tasks = await base44.asServiceRole.entities.Task.list('-created_date', 200);
      const vendors = await base44.asServiceRole.entities.Vendor.list('-created_date', 50);
      const workflows = await base44.asServiceRole.entities.Workflow.list('-created_date', 50);
      const now = new Date();

      const stats = {
        total_tasks: tasks.length,
        active: tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length,
        completed: tasks.filter(t => t.status === 'completed').length,
        blocked: tasks.filter(t => t.status === 'blocked').length,
        overdue: tasks.filter(t => t.due_date && new Date(t.due_date) < now && t.status !== 'completed' && t.status !== 'cancelled').length,
        total_vendors: vendors.length,
        active_workflows: workflows.filter(w => w.status === 'active').length
      };

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a comprehensive operational status report:

Current metrics:
${JSON.stringify(stats, null, 2)}

Top overdue tasks: ${tasks.filter(t => t.due_date && new Date(t.due_date) < now && t.status !== 'completed').slice(0, 5).map(t => t.title).join(', ')}
Blocked tasks: ${tasks.filter(t => t.status === 'blocked').slice(0, 5).map(t => t.title).join(', ')}

Generate an executive operational report with:
1. Operations health score (0-100)
2. Key highlights (what's going well)
3. Items requiring immediate attention
4. Week-over-week trends
5. Top 5 risks and mitigations
6. Recommended actions for today
7. Upcoming deadlines (next 7 days)`,
        response_json_schema: {
          type: 'object',
          properties: {
            ops_health_score: { type: 'number' },
            highlights: { type: 'array', items: { type: 'string' } },
            immediate_attention: { type: 'array', items: { type: 'string' } },
            risks: { type: 'array', items: { type: 'string' } },
            recommended_actions: { type: 'array', items: { type: 'string' } },
            metrics: { type: 'object' }
          }
        }
      });
      result = { ...result, raw_stats: stats };
    }

    if (action === 'status_briefing') {
      const { audience, period } = payload;
      const tasks = await base44.asServiceRole.entities.Task.list('-updated_date', 100);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Write a ${period || 'weekly'} operational status briefing for: ${audience || 'leadership team'}

Task data:
- Completed this period: ${tasks.filter(t => t.status === 'completed').length}
- Currently active: ${tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled').length}
- Overdue: ${tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed').length}
- Blocked: ${tasks.filter(t => t.status === 'blocked').length}

Write a professional, concise briefing covering:
1. Status summary (green/amber/red overall)
2. Key accomplishments
3. Issues and blockers requiring decisions
4. Next week priorities
5. Resource needs or escalations`,
        response_json_schema: {
          type: 'object',
          properties: {
            overall_status: { type: 'string' },
            briefing_text: { type: 'string' },
            decisions_required: { type: 'array', items: { type: 'string' } },
            next_period_priorities: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    if (action === 'project_postmortem') {
      const { project_name, outcome, duration, team } = payload;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Facilitate a project post-mortem for: ${project_name}
Outcome: ${outcome || 'Completed'}
Duration: ${duration || 'Not specified'}
Team: ${team || 'Not specified'}

Generate a structured retrospective:
1. What went well (celebrate these)
2. What didn't go well (be honest, no blame)
3. Root causes of issues
4. What we'd do differently
5. Process improvements to implement
6. Knowledge to document and share
7. Action items for next project
8. Team recognition highlights`,
        response_json_schema: {
          type: 'object',
          properties: {
            project_name: { type: 'string' },
            what_went_well: { type: 'array', items: { type: 'string' } },
            what_didnt_work: { type: 'array', items: { type: 'string' } },
            root_causes: { type: 'array', items: { type: 'string' } },
            do_differently: { type: 'array', items: { type: 'string' } },
            process_improvements: { type: 'array', items: { type: 'string' } },
            action_items: { type: 'array', items: { type: 'object', properties: { action: { type: 'string' }, owner: { type: 'string' }, deadline: { type: 'string' } } } }
          }
        }
      });
    }

    // ─── SELF-LEARNING ACTIONS ───────────────────────────────────────────────

    if (action === 'process_mining') {
      const tasks = await base44.asServiceRole.entities.Task.list('-created_date', 200);
      const workflows = await base44.asServiceRole.entities.Workflow.list('-created_date', 50);

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Mine operational patterns to discover insights and optimization opportunities:

Task patterns:
- Frequently blocked tasks: ${tasks.filter(t => t.status === 'blocked').map(t => t.title).join(', ')}
- Frequently unassigned: ${tasks.filter(t => !t.assignee).length} tasks
- Consistently overdue areas: ${tasks.filter(t => t.due_date && new Date(t.due_date) < new Date() && t.status !== 'completed').map(t => t.project || t.category || 'uncategorized').join(', ')}
- Workflow utilization: ${workflows.length} workflows defined, ${workflows.filter(w => w.status === 'active').length} active

Discover:
1. Hidden bottlenecks (recurring patterns of delay)
2. Process anti-patterns (what keeps going wrong)
3. Automation opportunities (repetitive manual steps)
4. Workflow gaps (processes that should be workflows but aren't)
5. Efficiency score by department/project
6. Recommendations ranked by ROI`,
        response_json_schema: {
          type: 'object',
          properties: {
            bottlenecks_discovered: { type: 'array', items: { type: 'string' } },
            process_antipatterns: { type: 'array', items: { type: 'string' } },
            automation_opportunities: { type: 'array', items: { type: 'object', properties: { process: { type: 'string' }, estimated_time_saved: { type: 'string' }, priority: { type: 'string' } } } },
            workflow_gaps: { type: 'array', items: { type: 'string' } },
            recommendations: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    if (action === 'workflow_optimization') {
      const workflows = await base44.asServiceRole.entities.Workflow.list('-created_date', 50);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Optimize existing workflows for efficiency:

Workflows: ${workflows.map(w => `${w.name} (${w.status})`).join(', ')}

For each workflow, suggest:
1. Steps that can be eliminated (no-value add)
2. Steps that can be automated
3. Approval steps that can be streamlined
4. Parallel execution opportunities (currently sequential but could run simultaneously)
5. Estimated time reduction per workflow execution
6. Priority order for optimization`,
        response_json_schema: {
          type: 'object',
          properties: {
            optimization_opportunities: { type: 'array', items: { type: 'object', properties: { workflow: { type: 'string' }, current_steps: { type: 'number' }, optimized_steps: { type: 'number' }, time_reduction: { type: 'string' }, changes: { type: 'array', items: { type: 'string' } } } } },
            total_time_savings: { type: 'string' },
            priority_order: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    if (action === 'predictive_allocation') {
      const tasks = await base44.asServiceRole.entities.Task.list('-created_date', 200);
      const teamMembers = await base44.asServiceRole.entities.TeamMember.list();
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Predict future resource needs and recommend proactive allocation:

Current team: ${teamMembers.length} members
Task pipeline: ${tasks.filter(t => t.status !== 'completed').length} active, ${tasks.filter(t => t.due_date && new Date(t.due_date) > new Date()).length} upcoming

Predict:
1. Which team members will be overloaded in the next 2 weeks
2. Which skills will be in highest demand
3. Where to pre-assign resources now to prevent future bottlenecks
4. Upcoming projects that need early resource reservation
5. Proactive hiring or contractor recommendations`,
        response_json_schema: {
          type: 'object',
          properties: {
            overload_predictions: { type: 'array', items: { type: 'object', properties: { member: { type: 'string' }, predicted_overload_week: { type: 'string' }, reason: { type: 'string' } } } },
            skills_in_demand: { type: 'array', items: { type: 'string' } },
            proactive_assignments: { type: 'array', items: { type: 'string' } },
            contractor_recommendations: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }


    if (action === 'atlas_full_self_test') {
      const tasks = await base44.asServiceRole.entities.Task.list('-created_date', 300);
      const workflows = await base44.asServiceRole.entities.Workflow.list('-created_date', 100);
      const teamMembers = await base44.asServiceRole.entities.TeamMember.list();

      const now = new Date();
      const activeTasks = tasks.filter(t => t.status !== 'completed' && t.status !== 'cancelled');
      const blockedTasks = tasks.filter(t => t.status === 'blocked');
      const overdueTasks = activeTasks.filter(t => t.due_date && new Date(t.due_date) < now);
      const unassignedTasks = activeTasks.filter(t => !t.assignee && !t.assigned_to);
      const activeWorkflows = workflows.filter(w => w.status === 'active');

      const checks = {
        task_visibility_ok: tasks.length > 0,
        active_workflows_present: activeWorkflows.length > 0,
        blocking_ratio_healthy: activeTasks.length === 0 ? true : (blockedTasks.length / activeTasks.length) < 0.2,
        overdue_ratio_healthy: activeTasks.length === 0 ? true : (overdueTasks.length / activeTasks.length) < 0.25,
        assignment_coverage_healthy: activeTasks.length === 0 ? true : (unassignedTasks.length / activeTasks.length) < 0.2,
        capacity_signal_available: teamMembers.length > 0
      };

      const passCount = Object.values(checks).filter(Boolean).length;
      const totalChecks = Object.keys(checks).length;
      const healthScore = Math.round((passCount / totalChecks) * 100);

      const recommendations = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a concise Atlas operational remediation plan from this snapshot:
Active tasks: ${activeTasks.length}
Blocked tasks: ${blockedTasks.length}
Overdue tasks: ${overdueTasks.length}
Unassigned tasks: ${unassignedTasks.length}
Total workflows: ${workflows.length}
Active workflows: ${activeWorkflows.length}
Team members: ${teamMembers.length}
Health score: ${healthScore}

Return:
1) top 3 immediate actions
2) top 3 process optimizations
3) top 3 capacity/routing interventions`,
        response_json_schema: {
          type: 'object',
          properties: {
            immediate_actions: { type: 'array', items: { type: 'string' } },
            process_optimizations: { type: 'array', items: { type: 'string' } },
            capacity_interventions: { type: 'array', items: { type: 'string' } }
          }
        }
      });

      result = {
        checks,
        health: {
          health_score: healthScore,
          active_tasks: activeTasks.length,
          blocked_tasks: blockedTasks.length,
          overdue_tasks: overdueTasks.length,
          unassigned_tasks: unassignedTasks.length,
          active_workflows: activeWorkflows.length,
          total_workflows: workflows.length,
          team_members: teamMembers.length
        },
        recommendations
      };
    }

    if (!result) {
      return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });
    }

    return Response.json({ status: 'atlas_action_complete', action, result });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

