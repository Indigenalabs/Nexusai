import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const payload = await req.json();
    const { action, params = {} } = payload;

    // Legacy field support
    const calendar_items = payload.calendar_items || params.calendar_items || [];
    const meeting_duration = payload.meeting_duration || params.meeting_duration || 30;
    const attendees = payload.attendees || params.attendees || [];

    let result = null;

    // ─── LOAD HELPERS ────────────────────────────────────────────────────────
    const loadEvents = async (days = 7) => {
      const all = await base44.asServiceRole.entities.CalendarEvent.list('-start_time', 100).catch(() => []);
      const cutoff = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
      return all.filter(e => e.start_time && new Date(e.start_time) >= new Date() && new Date(e.start_time) <= cutoff);
    };

    const loadTasks = async () => base44.asServiceRole.entities.Task.list('-due_date', 50).catch(() => []);
    const loadTeam = async () => base44.asServiceRole.entities.TeamMember.list().catch(() => []);

    // ─── 1. SMART SCHEDULE ───────────────────────────────────────────────────
    if (action === 'smart_schedule') {
      const [events, tasks] = await Promise.all([loadEvents(7), loadTasks()]);
      const meetingHours = events.filter(e => e.type === 'meeting').reduce((s, e) => {
        return s + (e.start_time && e.end_time ? (new Date(e.end_time) - new Date(e.start_time)) / 3600000 : 0);
      }, 0);

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Design an optimal weekly schedule. Current state: ${events.length} events this week, ${meetingHours.toFixed(1)} hours in meetings, ${tasks.filter(t => t.status !== 'completed').length} open tasks.

Build an ideal weekly structure following evidence-based productivity principles:
1. Deep work (creative/focused tasks): morning blocks, 90-min sessions, cognitively peak times
2. Meetings: clustered mid-morning or afternoon, never before 10am or after 4pm ideally
3. Mandatory breaks: 15-20min every 90 minutes, lunch uninterrupted
4. Admin/email/comms: end of day or low-energy periods
5. Buffer time: 15min between all sessions minimum
6. Meeting-free mornings where possible

Provide: ideal daily structure, time block template, meeting load assessment (current vs recommended), and top 3 improvements to make this week.`,
        response_json_schema: {
          type: 'object',
          properties: {
            weekly_structure: { type: 'object', properties: {
              monday: { type: 'string' },
              tuesday: { type: 'string' },
              wednesday: { type: 'string' },
              thursday: { type: 'string' },
              friday: { type: 'string' }
            }},
            daily_template: { type: 'array', items: { type: 'object', properties: { time: { type: 'string' }, block: { type: 'string' }, type: { type: 'string' } } } },
            meeting_load_assessment: { type: 'string' },
            current_meeting_hours: { type: 'number' },
            recommended_meeting_hours: { type: 'number' },
            top_improvements: { type: 'array', items: { type: 'string' } },
            focus_time_available: { type: 'string' }
          }
        }
      });
    }

    // ─── 2. FIND MEETING TIME ────────────────────────────────────────────────
    if (action === 'find_meeting_time') {
      const events = await loadEvents(14);
      const purpose = payload.meeting_purpose || params.meeting_purpose || 'General meeting';

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Find the optimal time for a meeting. Details:
- Purpose: ${purpose}
- Duration: ${meeting_duration} minutes
- Attendees: ${attendees.join(', ') || 'TBD'}
- Existing events this fortnight: ${events.length} events
- Timezone: Australia/Adelaide (ACST/ACDT)

Recommend top 3 specific time slots (with day, date, time, and reasoning). Consider: attendee cognitive peaks, avoid Mondays before 10am, avoid Friday afternoons, cluster with existing meetings where possible to preserve deep work blocks. Also provide: agenda template, pre-meeting prep tasks, and suggested duration check.`,
        response_json_schema: {
          type: 'object',
          properties: {
            recommended_slots: { type: 'array', items: { type: 'object', properties: {
              slot: { type: 'string' },
              reasoning: { type: 'string' },
              confidence: { type: 'string' }
            }}},
            timezone_note: { type: 'string' },
            agenda_template: { type: 'string' },
            prep_tasks: { type: 'array', items: { type: 'string' } },
            duration_recommendation: { type: 'string' }
          }
        }
      });

      // Create tentative calendar event
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(10, 0, 0, 0);
      await base44.asServiceRole.entities.CalendarEvent.create({
        title: purpose,
        start_time: tomorrow.toISOString(),
        end_time: new Date(tomorrow.getTime() + meeting_duration * 60000).toISOString(),
        attendees,
        status: 'tentative',
        type: 'meeting'
      }).catch(() => null);
    }

    // ─── 3. SCHEDULE MEETING ─────────────────────────────────────────────────
    if (action === 'schedule_meeting') {
      const { title, start_time, end_time, description, location, conference_link } = params;
      const created = await base44.asServiceRole.entities.CalendarEvent.create({
        title: title || 'New Meeting',
        start_time: start_time || new Date().toISOString(),
        end_time: end_time || new Date(Date.now() + 3600000).toISOString(),
        attendees: attendees,
        description,
        location,
        conference_link,
        type: 'meeting',
        status: 'confirmed'
      });

      // Notify attendees
      if (attendees.length > 0) {
        await base44.asServiceRole.entities.Notification.create({
          type: 'meeting_scheduled',
          title: `Meeting scheduled: ${title}`,
          message: `A meeting "${title}" has been scheduled. Check your calendar for details.`,
          priority: 'medium'
        }).catch(() => null);
      }

      result = { event_id: created.id, message: `Meeting "${title}" confirmed`, event: created };
    }

    // ─── 4. BLOCK TIME ───────────────────────────────────────────────────────
    if (action === 'block_time') {
      const blocks = calendar_items.length > 0 ? calendar_items : [params];
      const created = [];
      for (const block of blocks) {
        const ev = await base44.asServiceRole.entities.CalendarEvent.create({
          title: block.title || 'Focus Time',
          start_time: block.start_time || block.start_date,
          end_time: block.end_time || block.end_date,
          type: block.type || 'focus_block',
          status: 'confirmed',
          description: block.description || 'Protected focus time — no meetings.'
        }).catch(() => null);
        if (ev) created.push(ev);
      }
      result = { blocks_created: created.length, blocks: created };
    }

    // ─── 5. PROTECT FOCUS ────────────────────────────────────────────────────
    if (action === 'protect_focus') {
      const events = await loadEvents(7);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Identify the best windows for deep work focus blocks this week. Current events: ${JSON.stringify(events.map(e => ({ title: e.title, start: e.start_time, end: e.end_time, type: e.type })))}. 

Find 3-5 windows of 90-120 minutes that are: currently free, in morning/peak energy hours (8-11am preferred), not adjacent to long meetings, and spread across the week. Return specific start/end times in ISO format (Australia/Adelaide timezone = UTC+10:30 or UTC+9:30). Label each with the reason it's a good focus window.`,
        response_json_schema: {
          type: 'object',
          properties: {
            focus_windows: { type: 'array', items: { type: 'object', properties: {
              title: { type: 'string' },
              start_time: { type: 'string' },
              end_time: { type: 'string' },
              reasoning: { type: 'string' }
            }}},
            total_focus_hours: { type: 'number' },
            recommendation: { type: 'string' }
          }
        }
      });

      // Auto-create the focus blocks
      if (result?.focus_windows) {
        for (const w of result.focus_windows) {
          await base44.asServiceRole.entities.CalendarEvent.create({
            title: w.title || 'Deep Work Block',
            start_time: w.start_time,
            end_time: w.end_time,
            type: 'focus_block',
            status: 'confirmed',
            description: w.reasoning || 'Protected deep work — no meetings.'
          }).catch(() => null);
        }
      }
    }

    // ─── 6. SEND REMINDERS ───────────────────────────────────────────────────
    if (action === 'send_reminders') {
      const upcoming = await loadEvents(1);
      let sent = 0;
      for (const event of upcoming) {
        await base44.asServiceRole.entities.Notification.create({
          type: 'event_reminder',
          title: `Upcoming: ${event.title}`,
          message: `Your event "${event.title}" starts at ${new Date(event.start_time).toLocaleTimeString('en-AU', { hour: '2-digit', minute: '2-digit' })}. ${event.attendees?.length ? `Attendees: ${event.attendees.join(', ')}` : ''}`,
          priority: 'medium'
        }).catch(() => null);
        sent++;
      }
      result = { reminders_sent: sent, events: upcoming.length };
    }

    // ─── 7. TIME AUDIT ───────────────────────────────────────────────────────
    if (action === 'time_audit') {
      const events = await loadEvents(30);
      const byType = events.reduce((acc, e) => {
        const t = e.type || 'meeting';
        if (!acc[t]) acc[t] = { count: 0, hours: 0 };
        acc[t].count++;
        if (e.start_time && e.end_time) {
          acc[t].hours += (new Date(e.end_time) - new Date(e.start_time)) / 3600000;
        }
        return acc;
      }, {});

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Perform a comprehensive organizational time audit. Time allocation data (last 30 days):
${JSON.stringify(byType, null, 2)}

Total events: ${events.length}

Analyze: 1) What % of time is in meetings vs. focus vs. admin, 2) Is meeting load healthy or excessive? (benchmark: strategic leaders should spend <40% in meetings), 3) Are there meeting-free focus blocks?, 4) What time is being wasted?, 5) Top 5 structural recommendations to reclaim productive time. Score overall time health 0-100.`,
        response_json_schema: {
          type: 'object',
          properties: {
            time_health_score: { type: 'number' },
            breakdown: { type: 'object', properties: {
              meeting_percent: { type: 'number' },
              focus_percent: { type: 'number' },
              admin_percent: { type: 'number' },
              unaccounted_percent: { type: 'number' }
            }},
            meeting_load_rating: { type: 'string' },
            biggest_time_drains: { type: 'array', items: { type: 'string' } },
            recommendations: { type: 'array', items: { type: 'string' } },
            hours_to_reclaim: { type: 'number' }
          }
        }
      });
    }

    // ─── 8. TIME VALUE ANALYSIS ──────────────────────────────────────────────
    if (action === 'time_value_analysis') {
      const team = await loadTeam();
      const events = await loadEvents(7);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Calculate the time value and ROI of meetings and activities. Team size: ${team.length}. This week's meetings: ${events.filter(e => e.type === 'meeting').length} meetings totaling ${events.filter(e => e.type === 'meeting').reduce((s, e) => s + (e.start_time && e.end_time ? (new Date(e.end_time) - new Date(e.start_time)) / 3600000 : 0), 0).toFixed(1)} hours.

Assuming average loaded cost of AU$120/hour per person, calculate: 1) Total dollar cost of meetings this week, 2) Cost per meeting type, 3) Which meeting types have highest vs. lowest ROI, 4) How much time/money could be saved by cutting low-value meetings, 5) Recommended meeting portfolio for cost efficiency.`,
        response_json_schema: {
          type: 'object',
          properties: {
            total_meeting_cost: { type: 'number' },
            cost_per_hour: { type: 'number' },
            high_roi_activities: { type: 'array', items: { type: 'string' } },
            low_roi_activities: { type: 'array', items: { type: 'string' } },
            potential_savings: { type: 'number' },
            recommendations: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 9. GENERATE AGENDA ──────────────────────────────────────────────────
    if (action === 'generate_agenda') {
      const { meeting_title, duration_minutes, attendees: ats, context } = params;
      const tasks = await loadTasks();
      const openItems = tasks.filter(t => t.status !== 'completed').slice(0, 10);

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a structured meeting agenda. Meeting: "${meeting_title || 'Team Meeting'}". Duration: ${duration_minutes || 60} minutes. Attendees: ${(ats || attendees).join(', ') || 'team'}. Context: ${context || 'General team meeting'}.

Open action items to possibly review: ${openItems.map(t => t.title).join(', ')}.

Create: 1) Timed agenda items with owner, 2) Pre-read list, 3) Decision items that need resolution, 4) Information-only items, 5) Parking lot for out-of-scope topics. Include 5min buffer at end. Make it tight — every minute should earn its place.`,
        response_json_schema: {
          type: 'object',
          properties: {
            meeting_title: { type: 'string' },
            total_duration: { type: 'number' },
            agenda_items: { type: 'array', items: { type: 'object', properties: {
              time: { type: 'string' },
              item: { type: 'string' },
              owner: { type: 'string' },
              type: { type: 'string' },
              duration_min: { type: 'number' }
            }}},
            pre_reads: { type: 'array', items: { type: 'string' } },
            decisions_required: { type: 'array', items: { type: 'string' } },
            desired_outcome: { type: 'string' }
          }
        }
      });
    }

    // ─── 10. MEETING BRIEF ───────────────────────────────────────────────────
    if (action === 'meeting_brief') {
      const { meeting_title, start_time, attendees: ats, description } = params;
      const tasks = await loadTasks();
      const relevantTasks = tasks.filter(t => t.status !== 'completed').slice(0, 5);

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a comprehensive pre-meeting brief for: "${meeting_title}". Time: ${start_time || 'TBD'}. Attendees: ${(ats || attendees).join(', ') || 'unknown'}. Description: ${description || 'N/A'}.

Open tasks that may be relevant: ${relevantTasks.map(t => t.title).join(', ')}.

Prepare: 1) Meeting objective and desired outcome, 2) Key context and background, 3) Questions to answer in this meeting, 4) Potential blockers to raise, 5) What success looks like at the end, 6) 3 things to prepare before joining. Make it scannable — the reader has 5 minutes.`,
        response_json_schema: {
          type: 'object',
          properties: {
            objective: { type: 'string' },
            desired_outcome: { type: 'string' },
            key_context: { type: 'string' },
            questions_to_answer: { type: 'array', items: { type: 'string' } },
            potential_blockers: { type: 'array', items: { type: 'string' } },
            prep_checklist: { type: 'array', items: { type: 'string' } },
            success_definition: { type: 'string' }
          }
        }
      });
    }

    // ─── 11. EXTRACT ACTION ITEMS ────────────────────────────────────────────
    if (action === 'extract_action_items') {
      const { meeting_notes, meeting_title } = params;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Extract action items from meeting notes. Meeting: "${meeting_title || 'Meeting'}". Notes: ${meeting_notes || 'No notes provided — ask the user to paste them.'}.

Extract: 1) All action items with clear owner and due date, 2) Decisions made, 3) Topics that need follow-up, 4) Any risks or blockers identified, 5) Next meeting recommendation. Format action items as: [Owner] will [action] by [date].`,
        response_json_schema: {
          type: 'object',
          properties: {
            action_items: { type: 'array', items: { type: 'object', properties: {
              owner: { type: 'string' },
              action: { type: 'string' },
              due_date: { type: 'string' },
              priority: { type: 'string' }
            }}},
            decisions_made: { type: 'array', items: { type: 'string' } },
            follow_ups: { type: 'array', items: { type: 'string' } },
            risks_identified: { type: 'array', items: { type: 'string' } },
            next_meeting_recommended: { type: 'string' }
          }
        }
      });

      // Push action items to Atlas as tasks
      if (result?.action_items) {
        for (const item of result.action_items) {
          await base44.asServiceRole.entities.Task.create({
            title: item.action,
            description: `Action item from ${meeting_title || 'meeting'}. Owner: ${item.owner}`,
            status: 'todo',
            priority: item.priority || 'medium',
            due_date: item.due_date || null,
            assigned_to: item.owner
          }).catch(() => null);
        }
      }
    }

    // ─── 12. MEETING EFFECTIVENESS ───────────────────────────────────────────
    if (action === 'meeting_effectiveness') {
      const events = await loadEvents(30);
      const meetings = events.filter(e => e.type === 'meeting');

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Score and analyze meeting effectiveness. ${meetings.length} meetings in the last 30 days. Meeting data: ${JSON.stringify(meetings.slice(0, 20).map(m => ({ title: m.title, duration_min: m.start_time && m.end_time ? Math.round((new Date(m.end_time) - new Date(m.start_time)) / 60000) : null, attendees: m.attendees?.length || 0 })))}.

Analyze: 1) Average meeting duration vs. optimal, 2) Meeting-to-attendee ratio (are there too many people in meetings?), 3) Meeting types that generate most/least value, 4) Patterns of back-to-back meetings without breaks, 5) Effectiveness score 0-100, 6) Top 5 improvements.`,
        response_json_schema: {
          type: 'object',
          properties: {
            effectiveness_score: { type: 'number' },
            avg_duration_min: { type: 'number' },
            avg_attendees: { type: 'number' },
            back_to_back_count: { type: 'number' },
            highest_value_meetings: { type: 'array', items: { type: 'string' } },
            lowest_value_meetings: { type: 'array', items: { type: 'string' } },
            improvements: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 13. RESOLVE CONFLICT ────────────────────────────────────────────────
    if (action === 'resolve_conflict') {
      const events = await loadEvents(7);
      const conflicts = [];
      const sorted = events.sort((a, b) => new Date(a.start_time) - new Date(b.start_time));
      for (let i = 0; i < sorted.length - 1; i++) {
        if (sorted[i].end_time && sorted[i + 1].start_time && new Date(sorted[i].end_time) > new Date(sorted[i + 1].start_time)) {
          conflicts.push({ event1: sorted[i], event2: sorted[i + 1] });
        }
      }

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Resolve ${conflicts.length} scheduling conflicts. Conflicts: ${JSON.stringify(conflicts.map(c => ({ conflict: `"${c.event1.title}" ends ${c.event1.end_time}, "${c.event2.title}" starts ${c.event2.start_time}` })))}.

For each conflict: 1) Which event is higher priority?, 2) Recommended resolution (reschedule which one, to when?), 3) Who to notify, 4) Any ripple effects to watch. Prioritize client-facing meetings over internal, required over optional.`,
        response_json_schema: {
          type: 'object',
          properties: {
            conflicts_found: { type: 'number' },
            resolutions: { type: 'array', items: { type: 'object', properties: {
              conflict_description: { type: 'string' },
              keep: { type: 'string' },
              reschedule: { type: 'string' },
              suggested_new_time: { type: 'string' },
              notify: { type: 'array', items: { type: 'string' } }
            }}},
            overall_recommendation: { type: 'string' }
          }
        }
      });
    }

    // ─── 14. WEEKLY REPORT ───────────────────────────────────────────────────
    if (action === 'weekly_report') {
      const [events, tasks] = await Promise.all([loadEvents(7), loadTasks()]);
      const meetingMins = events.filter(e => e.type === 'meeting').reduce((s, e) => {
        return s + (e.start_time && e.end_time ? (new Date(e.end_time) - new Date(e.start_time)) / 60000 : 0);
      }, 0);
      const focusBlocks = events.filter(e => e.type === 'focus_block').length;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate a weekly time management report. This week: ${events.length} calendar events, ${(meetingMins / 60).toFixed(1)} hours in meetings, ${focusBlocks} focus blocks. Open tasks: ${tasks.filter(t => t.status !== 'completed').length}. Overdue tasks: ${tasks.filter(t => t.status !== 'completed' && t.due_date && new Date(t.due_date) < new Date()).length}.

Report should cover: 1) Time health summary, 2) Meeting load assessment, 3) Focus time achieved vs. needed, 4) Key risks for next week, 5) Top 3 scheduling recommendations for next week, 6) One win and one area to improve.`,
        response_json_schema: {
          type: 'object',
          properties: {
            time_health_summary: { type: 'string' },
            meeting_hours: { type: 'number' },
            focus_hours: { type: 'number' },
            meeting_load_rating: { type: 'string' },
            risks_next_week: { type: 'array', items: { type: 'string' } },
            recommendations: { type: 'array', items: { type: 'string' } },
            win: { type: 'string' },
            area_to_improve: { type: 'string' }
          }
        }
      });
    }

    // ─── 15. TIME FORECAST ───────────────────────────────────────────────────
    if (action === 'time_forecast') {
      const events = await loadEvents(14);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Forecast time demands for the next 2 weeks. Current scheduled events: ${events.length} events, ${events.filter(e => e.type === 'meeting').length} meetings. Based on typical business patterns, predict: 1) Expected total meeting hours, 2) Likely scheduling pressure points, 3) Windows at risk of over-commitment, 4) Recommended pre-emptive actions (e.g., block certain mornings now), 5) Overall time pressure level (low/medium/high/critical).`,
        response_json_schema: {
          type: 'object',
          properties: {
            pressure_level: { type: 'string' },
            expected_meeting_hours_2w: { type: 'number' },
            pressure_points: { type: 'array', items: { type: 'string' } },
            at_risk_windows: { type: 'array', items: { type: 'string' } },
            preemptive_actions: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 16. TIMEZONE INTELLIGENCE ───────────────────────────────────────────
    if (action === 'timezone_intelligence') {
      const { participants, meeting_time } = params;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Provide timezone intelligence for a meeting. Base timezone: Australia/Adelaide (ACST/ACDT, UTC+9:30/10:30). Proposed meeting time: ${meeting_time || 'TBD'}. Participants and their likely locations: ${(participants || attendees || []).join(', ')}.

Convert the proposed time to all relevant timezones. Flag any times that fall outside business hours (before 8am or after 6pm) for any participant. Suggest the most inclusive time window that works for all time zones.`,
        response_json_schema: {
          type: 'object',
          properties: {
            timezone_conversions: { type: 'array', items: { type: 'object', properties: { timezone: { type: 'string' }, local_time: { type: 'string' }, within_business_hours: { type: 'boolean' } } } },
            best_inclusive_window: { type: 'string' },
            conflicts: { type: 'array', items: { type: 'string' } },
            recommendation: { type: 'string' }
          }
        }
      });
    }

    // ─── 17. INTERVIEW SCHEDULING ────────────────────────────────────────────
    if (action === 'interview_scheduling') {
      const { candidate_name, role, panel_members, interview_stages } = params;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Design an interview scheduling plan. Candidate: ${candidate_name || 'TBD'}. Role: ${role || 'TBD'}. Panel members: ${(panel_members || []).join(', ')}. Stages: ${(interview_stages || ['Screening', 'Technical', 'Cultural', 'Final']).join(', ')}.

Create: 1) Recommended interview schedule across stages with timing, 2) Panel assignments per stage, 3) Interview questions focus per stage, 4) Candidate communication timeline (invite, reminder, feedback), 5) Decision timeline after final interview.`,
        response_json_schema: {
          type: 'object',
          properties: {
            interview_plan: { type: 'array', items: { type: 'object', properties: {
              stage: { type: 'string' },
              recommended_timing: { type: 'string' },
              duration_minutes: { type: 'number' },
              panel: { type: 'array', items: { type: 'string' } },
              focus_areas: { type: 'array', items: { type: 'string' } }
            }}},
            candidate_comms_timeline: { type: 'array', items: { type: 'string' } },
            decision_date: { type: 'string' }
          }
        }
      });
    }

    // ─── 18. EVENT COORDINATION ──────────────────────────────────────────────
    if (action === 'event_coordination') {
      const { event_name, event_date, audience_size, event_type } = params;
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Coordinate a company event or webinar. Event: "${event_name || 'Company Event'}". Date: ${event_date || 'TBD'}. Type: ${event_type || 'webinar'}. Expected audience: ${audience_size || 'unknown'}.

Create a coordination plan: 1) Pre-event timeline (invites, reminders, tech checks), 2) Day-of schedule with buffers, 3) Roles and responsibilities, 4) Promotion timing recommendations (integrate with Maestro), 5) Post-event follow-up schedule.`,
        response_json_schema: {
          type: 'object',
          properties: {
            pre_event_timeline: { type: 'array', items: { type: 'object', properties: { days_before: { type: 'number' }, action: { type: 'string' }, owner: { type: 'string' } } } },
            day_of_schedule: { type: 'array', items: { type: 'object', properties: { time: { type: 'string' }, activity: { type: 'string' } } } },
            roles: { type: 'array', items: { type: 'object', properties: { role: { type: 'string' }, person: { type: 'string' } } } },
            post_event_actions: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }

    // ─── 19. PRODUCTIVITY ANALYSIS ───────────────────────────────────────────
    if (action === 'productivity_analysis') {
      const [events, tasks] = await Promise.all([loadEvents(30), loadTasks()]);
      const completedTasks = tasks.filter(t => t.status === 'completed').length;
      const overdueTasks = tasks.filter(t => t.status !== 'completed' && t.due_date && new Date(t.due_date) < new Date()).length;

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze personal/team productivity patterns. Data: ${events.length} calendar events in 30 days, ${completedTasks} tasks completed, ${overdueTasks} tasks overdue, ${tasks.filter(t => t.status !== 'completed').length} tasks open.

Assess: 1) Productivity score (0-100), 2) Are task completion rates healthy?, 3) Is overdue count trending up or manageable?, 4) Correlation between meeting load and task completion (more meetings = fewer tasks done?), 5) Top 5 productivity improvement recommendations.`,
        response_json_schema: {
          type: 'object',
          properties: {
            productivity_score: { type: 'number' },
            task_completion_rate: { type: 'number' },
            overdue_assessment: { type: 'string' },
            meeting_task_correlation: { type: 'string' },
            improvements: { type: 'array', items: { type: 'string' } }
          }
        }
      });
    }


    // 20. TIME VALUE ANALYTICS 2.0
    if (action === 'time_value_analytics') {
      const team = await loadTeam();
      const events = await loadEvents(14);
      const meetingHours = events.filter(e => e.type === 'meeting').reduce((s, e) => s + (e.start_time && e.end_time ? (new Date(e.end_time) - new Date(e.start_time)) / 3600000 : 0), 0);

      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Compute advanced time value analytics. Team size: ${team.length}. Meeting hours (14d): ${meetingHours.toFixed(1)}.

Provide:
1) effective blended hourly time value estimate
2) total meeting cost estimate
3) top time sinks
4) high-value activities to protect
5) quantifiable weekly savings opportunities`,
        response_json_schema: {
          type: 'object',
          properties: {
            blended_hourly_value: { type: 'number' },
            total_meeting_cost_estimate: { type: 'number' },
            top_time_sinks: { type: 'array', items: { type: 'string' } },
            protected_high_value_activities: { type: 'array', items: { type: 'string' } },
            weekly_savings_opportunity: { type: 'number' },
          },
        },
      });
    }

    // 21. MEETING COST GUARD
    if (action === 'meeting_cost_guard') {
      const events = await loadEvents(7);
      const meetings = events.filter(e => e.type === 'meeting').slice(0, 30);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Run meeting cost guard on upcoming meetings.

Meetings: ${JSON.stringify(meetings.map(m => ({ title: m.title, attendees: m.attendees?.length || 0, start: m.start_time, end: m.end_time })))}

For each meeting, estimate cost band and classify: keep, shorten, merge, async, cancel.
Return top interventions for immediate calendar cleanup.`,
        response_json_schema: {
          type: 'object',
          properties: {
            assessed_meetings: { type: 'array', items: { type: 'object', properties: {
              title: { type: 'string' },
              decision: { type: 'string' },
              reason: { type: 'string' },
              est_cost_band: { type: 'string' }
            } } },
            immediate_interventions: { type: 'array', items: { type: 'string' } },
          },
        },
      });
    }

    // 22. DEEP WORK GUARDIAN
    if (action === 'deep_work_guardian') {
      const events = await loadEvents(7);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Design deep-work protection plan for next 7 days.

Events: ${JSON.stringify(events.map(e => ({ title: e.title, type: e.type, start: e.start_time, end: e.end_time })))}

Return:
1) focus block schedule
2) meeting-free policy recommendations
3) interruption reduction actions
4) guardrail rules for auto-decline/deferral`,
        response_json_schema: {
          type: 'object',
          properties: {
            focus_schedule: { type: 'array', items: { type: 'object', properties: { day: { type: 'string' }, start: { type: 'string' }, end: { type: 'string' }, rationale: { type: 'string' } } } },
            meeting_free_policy: { type: 'array', items: { type: 'string' } },
            interruption_reduction: { type: 'array', items: { type: 'string' } },
            guardrail_rules: { type: 'array', items: { type: 'string' } },
          },
        },
      });
    }

    // 23. RECURRING MEETING OPTIMIZER
    if (action === 'recurring_meeting_optimizer') {
      const events = await loadEvents(30);
      const recurringLike = events.filter(e => /weekly|sync|standup|review|1:1/i.test((e.title || '').toLowerCase()));
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Optimize recurring meetings.

Candidate recurring meetings: ${JSON.stringify(recurringLike.map(m => ({ title: m.title, attendees: m.attendees?.length || 0, duration_min: m.start_time && m.end_time ? Math.round((new Date(m.end_time) - new Date(m.start_time)) / 60000) : 0 })))}

Recommend per meeting: keep cadence, reduce cadence, shorten duration, merge, or cancel.`,
        response_json_schema: {
          type: 'object',
          properties: {
            recommendations: { type: 'array', items: { type: 'object', properties: {
              title: { type: 'string' },
              current_state: { type: 'string' },
              recommended_state: { type: 'string' },
              impact: { type: 'string' }
            } } },
            reclaimed_hours_monthly: { type: 'number' },
          },
        },
      });
    }

    // 24. GLOBAL FAIRNESS SCHEDULER
    if (action === 'global_fairness_scheduler') {
      const participants = params.participants || attendees || [];
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a fair timezone meeting rotation schedule.
Participants/timezones: ${JSON.stringify(participants)}

Design 4-week rotation so early/late burden is shared fairly.
Include fairness score and rotation rationale.`,
        response_json_schema: {
          type: 'object',
          properties: {
            rotation_plan: { type: 'array', items: { type: 'object', properties: { week: { type: 'string' }, slot: { type: 'string' }, burdened_regions: { type: 'array', items: { type: 'string' } } } } },
            fairness_score: { type: 'number' },
            notes: { type: 'array', items: { type: 'string' } },
          },
        },
      });
    }

    // 25. TRAVEL TIME OPTIMIZER
    if (action === 'travel_time_optimizer') {
      const itinerary = params.itinerary || {};
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Optimize travel schedule and buffers.
Itinerary context: ${JSON.stringify(itinerary)}

Return:
1) travel-safe meeting windows
2) required buffers (airport/security/ground transfer)
3) jet-lag-aware first 48h schedule
4) risk mitigations`,
        response_json_schema: {
          type: 'object',
          properties: {
            safe_meeting_windows: { type: 'array', items: { type: 'string' } },
            required_buffers: { type: 'array', items: { type: 'string' } },
            first_48h_plan: { type: 'array', items: { type: 'string' } },
            mitigations: { type: 'array', items: { type: 'string' } },
          },
        },
      });
    }

    // 26. RESOURCE BOOKING OPTIMIZER
    if (action === 'resource_booking_optimizer') {
      const requests = params.requests || [];
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Optimize room/resource allocation.
Requests: ${JSON.stringify(requests)}

Produce conflict-free allocation with fallback options and utilization improvements.`,
        response_json_schema: {
          type: 'object',
          properties: {
            allocation_plan: { type: 'array', items: { type: 'object', properties: { request: { type: 'string' }, assigned_resource: { type: 'string' }, fallback: { type: 'string' } } } },
            utilization_improvements: { type: 'array', items: { type: 'string' } },
          },
        },
      });
    }

    // 27. AGENT LOAD BALANCER
    if (action === 'agent_load_balancer') {
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Create an agent-processing schedule strategy.

Goal: avoid API rate limits and smooth compute demand.
Return off-peak windows, priority queues, and maintenance windows for AI agents.`,
        response_json_schema: {
          type: 'object',
          properties: {
            off_peak_windows: { type: 'array', items: { type: 'string' } },
            priority_queue_rules: { type: 'array', items: { type: 'string' } },
            maintenance_windows: { type: 'array', items: { type: 'string' } },
            rate_limit_strategy: { type: 'string' },
          },
        },
      });
    }

    // 28. TIME ROI DASHBOARD
    if (action === 'time_roi_dashboard') {
      const [events, tasks] = await Promise.all([loadEvents(30), loadTasks()]);
      result = await base44.integrations.Core.InvokeLLM({
        prompt: `Generate time ROI dashboard insights.
Events: ${events.length}, Tasks: ${tasks.length}

Provide high-level ROI mapping across meetings, focus work, admin, and client calls.
Give top reallocation plan for next week.`,
        response_json_schema: {
          type: 'object',
          properties: {
            roi_by_activity: { type: 'array', items: { type: 'object', properties: { activity: { type: 'string' }, roi_rating: { type: 'string' }, recommendation: { type: 'string' } } } },
            next_week_reallocation: { type: 'array', items: { type: 'string' } },
            executive_summary: { type: 'string' },
          },
        },
      });
    }

    // 29. CHRONOS FULL SELF TEST
    if (action === 'chronos_full_self_test') {
      const [audit, effectiveness, forecast, deepwork, roi] = await Promise.all([
        base44.functions.invoke('chronosSchedulingEngine', { action: 'time_audit' }).then((r: any) => r.data?.result).catch(() => null),
        base44.functions.invoke('chronosSchedulingEngine', { action: 'meeting_effectiveness' }).then((r: any) => r.data?.result).catch(() => null),
        base44.functions.invoke('chronosSchedulingEngine', { action: 'time_forecast' }).then((r: any) => r.data?.result).catch(() => null),
        base44.functions.invoke('chronosSchedulingEngine', { action: 'deep_work_guardian' }).then((r: any) => r.data?.result).catch(() => null),
        base44.functions.invoke('chronosSchedulingEngine', { action: 'time_roi_dashboard' }).then((r: any) => r.data?.result).catch(() => null),
      ]);

      result = {
        audit,
        effectiveness,
        forecast,
        deepwork,
        roi,
        checks: {
          audit_ok: Boolean(audit),
          effectiveness_ok: Boolean(effectiveness),
          forecast_ok: Boolean(forecast),
          deepwork_ok: Boolean(deepwork),
          roi_ok: Boolean(roi),
        },
      };
    }
    if (!result) {
      result = { message: `Action '${action}' completed. Available actions: smart_schedule, find_meeting_time, schedule_meeting, block_time, protect_focus, send_reminders, time_audit, time_value_analysis, generate_agenda, meeting_brief, extract_action_items, meeting_effectiveness, resolve_conflict, weekly_report, time_forecast, timezone_intelligence, interview_scheduling, event_coordination, productivity_analysis, time_value_analytics, meeting_cost_guard, deep_work_guardian, recurring_meeting_optimizer, global_fairness_scheduler, travel_time_optimizer, resource_booking_optimizer, agent_load_balancer, time_roi_dashboard, chronos_full_self_test` };
    }

    return Response.json({ status: 'chronos_action_complete', action, result });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});

