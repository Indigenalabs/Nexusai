import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { participant_id, service_type, date_required } = payload;

    // Fetch participant details
    const participant = await base44.entities.Order.read(participant_id).catch(() => null);
    const participantGoals = await base44.asServiceRole.entities.ParticipantGoal.list().then(
      goals => goals.filter(g => g.participant_id === participant_id)
    );

    // Fetch available workers
    const workers = await base44.asServiceRole.entities.WorkerProfile.list();

    // Score each worker for compatibility
    const matchedWorkers = [];

    for (const worker of workers) {
      let score = 0;
      const reasons = [];

      // 1. Specialisation match (20 points)
      const specialisationMatch = worker.specialisations?.some(s => {
        if (service_type === 'early_intervention' && s === 'early_intervention') return true;
        if (service_type === 'behaviour_support' && s === 'behaviour_support') return true;
        if (service_type === 'personal_care' && s === 'aged_care') return true;
        return false;
      });
      if (specialisationMatch) {
        score += 20;
        reasons.push('Specialisation match');
      }

      // 2. Certification check (15 points if all current)
      const allCertsCurrent = worker.certifications?.every(c => new Date(c.expiry_date) > new Date());
      if (allCertsCurrent) {
        score += 15;
        reasons.push('All certifications current');
      }

      // 3. Location proximity (20 points if nearby)
      if (participant?.shipping_address) {
        // Simple mock: check if in same postcode or nearby
        const workerSuburb = worker.location?.suburb;
        const participantSuburb = participant.shipping_address?.split(' ').pop();
        if (workerSuburb === participantSuburb || Math.random() > 0.5) { // Mock proximity check
          score += 20;
          reasons.push('Located nearby');
        }
      }

      // 4. Availability (20 points if available on required date)
      const dateObj = new Date(date_required);
      const dayName = dateObj.toLocaleDateString('en-US', { weekday: 'lowercase' });
      const isAvailable = worker.availability?.weekdays?.some(w => w.day === dayName);
      if (isAvailable) {
        score += 20;
        reasons.push('Available on required date');
      }

      // 5. Language match (10 points if language match)
      if (worker.languages?.includes('English')) {
        score += 10;
        reasons.push('Language compatible');
      }

      // 6. Performance history (15 points if high performance score)
      if ((worker.performance_score || 0) > 80) {
        score += 15;
        reasons.push('High performance score');
      }

      if (score > 0) {
        matchedWorkers.push({
          worker_id: worker.id,
          worker_name: worker.name,
          score,
          reasons,
          availability: worker.availability,
          specialisations: worker.specialisations,
          contact_email: worker.email
        });
      }
    }

    // Sort by score
    matchedWorkers.sort((a, b) => b.score - a.score);

    // Return top 3 matches
    const topMatches = matchedWorkers.slice(0, 3);

    // Create task to review and assign
    if (topMatches.length > 0) {
      await base44.asServiceRole.entities.Task.create({
        title: `Assign worker: ${participant_id}`,
        description: `Top matches: ${topMatches.map(m => `${m.worker_name} (${m.score}%)`).join(', ')}. Service: ${service_type}. Date: ${date_required}`,
        status: 'pending',
        priority: 'high',
        source: 'system',
        source_id: participant_id,
        tags: ['worker_assignment']
      });
    }

    return Response.json({
      status: 'matching_complete',
      participant_id,
      service_type,
      date_required,
      top_matches: topMatches,
      total_candidates: workers.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});