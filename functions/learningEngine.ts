import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const learnings = [];

    const [invoices, posts, emails, clients] = await Promise.all([
      base44.asServiceRole.entities.Invoice.list('-created_date', 100),
      base44.asServiceRole.entities.SocialPost.filter({ status: 'published' }),
      base44.asServiceRole.entities.Email.list('-created_date', 200),
      base44.asServiceRole.entities.Client.list(),
    ]);

    // 1. Learn invoice approval patterns
    const paidInvoices = invoices.filter(i => i.status === 'paid');
    if (paidInvoices.length >= 5) {
      const amounts = paidInvoices.map(i => i.amount || 0).filter(a => a > 0);
      if (amounts.length > 0) {
        const avgAmount = Math.round(amounts.reduce((a, b) => a + b, 0) / amounts.length);
        const threshold = Math.round(avgAmount * 0.8);
        await base44.asServiceRole.entities.UserPreference.create({
          category: 'workflow', key: 'auto_approve_invoice_threshold',
          value: threshold.toString(), learned_from: 'behavior', confidence: 85
        });
        learnings.push({ preference: 'auto_approve_invoice_threshold', value: threshold, confidence: 85 });
      }
    }

    // 2. Learn optimal posting times from engagement data
    if (posts.length >= 10) {
      // Analyse which hour of day has highest ai_score for published posts
      const hourScores = {};
      posts.forEach(p => {
        if (p.scheduled_time && p.ai_score) {
          const hour = new Date(p.scheduled_time).getHours();
          if (!hourScores[hour]) hourScores[hour] = { total: 0, count: 0 };
          hourScores[hour].total += p.ai_score;
          hourScores[hour].count++;
        }
      });
      let bestHour = 13; // default
      let bestAvg = 0;
      Object.entries(hourScores).forEach(([hour, data]) => {
        const avg = data.total / data.count;
        if (avg > bestAvg) { bestAvg = avg; bestHour = parseInt(hour); }
      });
      await base44.asServiceRole.entities.UserPreference.create({
        category: 'workflow', key: 'optimal_post_time',
        value: `${bestHour}:00`, learned_from: 'behavior', confidence: 75
      });
      learnings.push({ preference: 'optimal_post_time', value: `${bestHour}:00`, confidence: 75 });

      // 3. Learn best performing content type
      const typeScores = {};
      posts.forEach(p => {
        if (p.content_type && p.ai_score) {
          if (!typeScores[p.content_type]) typeScores[p.content_type] = { total: 0, count: 0 };
          typeScores[p.content_type].total += p.ai_score;
          typeScores[p.content_type].count++;
        }
      });
      let bestType = null; let bestTypeAvg = 0;
      Object.entries(typeScores).forEach(([type, data]) => {
        const avg = data.total / data.count;
        if (avg > bestTypeAvg) { bestTypeAvg = avg; bestType = type; }
      });
      if (bestType) {
        await base44.asServiceRole.entities.UserPreference.create({
          category: 'ai_behavior', key: 'best_content_type',
          value: bestType, learned_from: 'behavior', confidence: 80
        });
        learnings.push({ preference: 'best_content_type', value: bestType, confidence: 80 });
      }

      // 4. Learn best performing platform
      const platformScores = {};
      posts.forEach(p => {
        if (p.platform && p.ai_score) {
          if (!platformScores[p.platform]) platformScores[p.platform] = { total: 0, count: 0 };
          platformScores[p.platform].total += p.ai_score;
          platformScores[p.platform].count++;
        }
      });
      let bestPlatform = null; let bestPlatformAvg = 0;
      Object.entries(platformScores).forEach(([platform, data]) => {
        const avg = data.total / data.count;
        if (avg > bestPlatformAvg) { bestPlatformAvg = avg; bestPlatform = platform; }
      });
      if (bestPlatform) {
        await base44.asServiceRole.entities.UserPreference.create({
          category: 'ai_behavior', key: 'best_platform',
          value: bestPlatform, learned_from: 'behavior', confidence: 78
        });
        learnings.push({ preference: 'best_platform', value: bestPlatform, confidence: 78 });
      }
    }

    // 5. Learn email response time patterns
    const repliedEmails = emails.filter(e => e.status === 'replied');
    if (repliedEmails.length >= 5) {
      // Estimate responsiveness score based on ratio
      const responseRate = Math.round((repliedEmails.length / emails.length) * 100);
      await base44.asServiceRole.entities.UserPreference.create({
        category: 'workflow', key: 'email_response_rate_pct',
        value: responseRate.toString(), learned_from: 'behavior', confidence: 90
      });
      learnings.push({ preference: 'email_response_rate_pct', value: responseRate, confidence: 90 });
    }

    // 6. Learn client follow-up cadence
    const activeClients = clients.filter(c => c.status === 'active' && c.next_followup && c.last_contact);
    if (activeClients.length >= 3) {
      const intervals = activeClients.map(c => {
        const lastContact = new Date(c.last_contact);
        const nextFollowup = new Date(c.next_followup);
        return Math.round((nextFollowup - lastContact) / (1000 * 60 * 60 * 24));
      }).filter(d => d > 0 && d < 90);
      if (intervals.length > 0) {
        const avgInterval = Math.round(intervals.reduce((a, b) => a + b, 0) / intervals.length);
        await base44.asServiceRole.entities.UserPreference.create({
          category: 'workflow', key: 'default_followup_interval_days',
          value: avgInterval.toString(), learned_from: 'behavior', confidence: 75
        });
        learnings.push({ preference: 'default_followup_interval_days', value: avgInterval, confidence: 75 });
      }
    }

    // 7. Log learning update
    if (learnings.length > 0) {
      await base44.asServiceRole.entities.Insight.create({
        title: 'AI Learning Update',
        description: `Nexus learned ${learnings.length} new behavioral preferences from your actual usage patterns. Autonomous actions will now be more personalised.`,
        category: 'recommendation', priority: 'low', module: 'analytics',
        action_label: 'View Preferences', status: 'new'
      });
      await base44.asServiceRole.entities.Activity.create({
        title: 'Learning Engine Updated',
        description: `Learned ${learnings.length} behavioral preferences: ${learnings.map(l => l.preference).join(', ')}`,
        type: 'ai_action', status: 'completed', module: 'analytics'
      });
    }

    return Response.json({ success: true, learnings_count: learnings.length, learnings, timestamp: new Date().toISOString() });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});