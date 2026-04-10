import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

/**
 * Participant Acquisition Engine — Autonomous participant acquisition for NDIS, Aged Care, and care sector providers.
 *
 * Actions:
 * - score_inquiry              → Score a participant inquiry with NDIS/Aged Care-specific model
 * - trigger_nurture_sequence   → Start a care-sector-appropriate nurturing sequence
 * - discover_referral_partners → Identify and score potential referral partners for a service area
 * - track_referral             → Attribute a new participant to a referral partner, update relationship score
 * - analyze_market_opportunity → Analyze a geographic area/service type for participant acquisition opportunity
 * - generate_content_brief     → Generate an educational content brief for care-sector SEO and awareness
 * - score_referral_partner     → Score and tier a referral partner by potential and relationship strength
 */
Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await req.json().catch(() => ({}));
    const { action, data } = body;

    if (!action) return Response.json({ error: 'action is required' }, { status: 400 });

    // === SCORE INQUIRY ===
    if (action === 'score_inquiry') {
      const { name, email, phone, inquiryType, serviceType, location, urgency, fundingStatus, source, ndisNumber, hcpLevel, notes } = data || {};

      // inquiryType: 'ndis' | 'aged_care' | 'self_funded' | 'general'
      let fitScore = 0;
      let engagementScore = 0;
      let intentScore = 0;
      const intentSignals = [];
      let isUrgent = false;

      // Engagement score
      if (email) { engagementScore += 10; }
      if (phone) { engagementScore += 10; }
      if (ndisNumber || hcpLevel) { engagementScore += 10; }

      // NDIS-specific scoring
      if (inquiryType === 'ndis') {
        fitScore += 20; // Has NDIS funding = strong fit for an NDIS provider
        if (ndisNumber) { intentScore += 15; intentSignals.push('has_ndis_number'); }
        if (fundingStatus === 'active_plan') { intentScore += 20; intentSignals.push('active_plan'); }
        if (fundingStatus === 'plan_review_soon') { intentScore += 10; intentSignals.push('plan_review_upcoming'); }
        if (urgency === 'plan_expiring') { intentScore += 20; intentSignals.push('plan_expiry_imminent'); }
        if (urgency === 'hospital_discharge') { intentScore += 30; intentSignals.push('hospital_discharge_URGENT'); isUrgent = true; }
        if (urgency === 'provider_ending') { intentScore += 15; intentSignals.push('current_provider_ending'); }
        if (urgency === 'unserviced') { intentScore += 15; intentSignals.push('currently_unserviced'); }
      }

      // Aged Care-specific scoring
      if (inquiryType === 'aged_care') {
        fitScore += 20;
        if (hcpLevel) { intentScore += 15; intentSignals.push(`hcp_level_${hcpLevel}`); }
        if (fundingStatus === 'assessed') { intentScore += 15; intentSignals.push('acat_assessed'); }
        if (urgency === 'hospital_discharge') { intentScore += 30; intentSignals.push('hospital_discharge_URGENT'); isUrgent = true; }
        if (urgency === 'family_driving') { intentScore += 10; intentSignals.push('family_decision_maker'); }
        if (urgency === 'provider_dissatisfied') { intentScore += 20; intentSignals.push('leaving_current_provider'); }
      }

      // Source scoring
      const sourceBoosts = {
        referral_plan_manager: 25,
        referral_support_coordinator: 25,
        referral_lac: 20,
        referral_gp: 20,
        referral_hospital: 25,
        website_contact_form: 10,
        facebook_lead_ad: 8,
        community_forum: 20,
        competitor_review: 20,
        organic_search: 12,
        phone_call: 15,
      };
      intentScore += sourceBoosts[source] || 5;
      intentSignals.push(`source_${source}`);

      // Location scoring
      if (location) { fitScore += 10; } // Assumes location is within service area

      const totalScore = Math.min(100, fitScore + engagementScore + intentScore);
      const grade = totalScore >= 80 ? 'HOT 🔥' : totalScore >= 60 ? 'WARM ⚡' : totalScore >= 40 ? 'COOL 🌤️' : 'COLD ❄️';
      const responseTime = isUrgent ? 'WITHIN 1 HOUR — URGENT' : totalScore >= 80 ? 'Within 1 hour' : totalScore >= 60 ? 'Within 24 hours' : 'Within 72 hours (nurture sequence)';

      // Create Lead record
      const lead = await base44.entities.Lead.create({
        first_name: name?.split(' ')[0] || name || 'Unknown',
        last_name: name?.split(' ').slice(1).join(' ') || '',
        email: email || '',
        phone: phone || '',
        source: source?.replace(/_/g, ' ') || 'direct',
        status: 'new',
        score: totalScore,
        fit_score: fitScore,
        engagement_score: engagementScore,
        intent_score: intentScore,
        intent_signals: intentSignals,
        notes: `${inquiryType?.toUpperCase()} inquiry. Service: ${serviceType}. Urgency: ${urgency || 'standard'}. ${notes || ''}`,
        next_followup: new Date(Date.now() + (isUrgent ? 1 : totalScore >= 80 ? 1 : totalScore >= 60 ? 24 : 72) * 60 * 60 * 1000).toISOString().split('T')[0],
      }).catch(() => null);

      // Alert for urgent or hot leads
      if (isUrgent || totalScore >= 70) {
        await base44.entities.Notification.create({
          title: `${isUrgent ? '🚨 URGENT' : '🔥 HOT'} ${inquiryType === 'ndis' ? 'NDIS' : 'Aged Care'} Inquiry: ${name}`,
          message: `${grade} — Score: ${totalScore}/100. Source: ${source}. ${isUrgent ? '⏰ HOSPITAL DISCHARGE — contact within 1 hour. Window: 24-48 hours.' : `Contact ${responseTime}.`}\nService needed: ${serviceType}. Urgency: ${urgency || 'standard'}.\nSupport Sage: send immediate empathetic response. Atlas: create consultation task.`,
          type: isUrgent ? 'warning' : 'info',
          is_read: false,
        }).catch(() => {});
      }

      await base44.entities.Activity.create({
        type: 'lead_capture',
        title: `${inquiryType?.toUpperCase()} Inquiry: ${name} — Score ${totalScore}`,
        description: `Source: ${source} | Grade: ${grade} | Service: ${serviceType} | Urgent: ${isUrgent}`,
      }).catch(() => {});

      return Response.json({ name, inquiryType, fitScore, engagementScore, intentScore, totalScore, grade, isUrgent, responseTime, intentSignals, leadCreated: !!lead, recommendedAction: isUrgent ? 'Phone call within 1 hour' : totalScore >= 80 ? 'Personal call or message today' : totalScore >= 60 ? 'Email + schedule consultation' : 'Enter nurture sequence' });
    }

    // === TRIGGER NURTURE SEQUENCE ===
    if (action === 'trigger_nurture_sequence') {
      const { leadId, leadName, email, inquiryType, serviceType, score } = data || {};
      // inquiryType: 'ndis' | 'aged_care'

      const sequences = {
        ndis: [
          { day: 1, subject: 'Welcome — here\'s how we can help with your NDIS journey', content: 'Thank you for reaching out. [Provider name] specialises in [service type]. Here\'s a guide to choosing the right NDIS provider for your situation.' },
          { day: 4, subject: '[Name]\'s story — how NDIS supports changed her life', content: 'A participant success story from someone with a similar support need. Real outcomes, real difference.' },
          { day: 8, subject: '10 questions to ask your NDIS provider at your first meeting', content: 'Educational content positioning us as the trusted expert. Includes a downloadable checklist.' },
          { day: 14, subject: 'We\'d love to learn more about your goals', content: 'Soft invitation to a free 30-minute consultation. No obligation. We just want to understand how we can help.' },
          { day: 30, subject: 'New guide: navigating your NDIS plan review', content: 'Helpful content — keeps us top of mind for when they\'re ready.' },
        ],
        aged_care: [
          { day: 1, subject: 'Caring for a loved one — you\'re not alone', content: 'Empathetic welcome. Acknowledge the emotional weight of this journey. Brief overview of how we help.' },
          { day: 4, subject: 'A guide to Home Care Packages — what level is right for Mum or Dad?', content: 'Educational explainer on HCP levels 1-4. What each level covers and how to access it.' },
          { day: 8, subject: 'What to look for in a quality aged care provider', content: '10-point checklist — positions us well while being genuinely helpful. Downloadable PDF.' },
          { day: 14, subject: 'Invitation: free information session — [date]', content: 'Invite to a webinar or in-person session. Brings families together. Builds trust.' },
          { day: 30, subject: 'Still thinking? Our team is here to answer any questions', content: 'Gentle follow-up. Reiterate our unique value. Testimonial from a family carer.' },
        ],
      };

      const sequence = sequences[inquiryType] || sequences.ndis;
      const tasks = [];

      for (const step of sequence) {
        tasks.push(base44.entities.Task.create({
          title: `Nurture D+${step.day}: ${leadName} — "${step.subject}"`,
          description: `Send nurture email to ${leadName} (${email}).\nSubject: "${step.subject}"\nContent brief: ${step.content}\nInquiry type: ${inquiryType} | Service: ${serviceType}`,
          priority: step.day <= 4 ? 'high' : 'medium',
          status: 'pending',
          due_date: new Date(Date.now() + step.day * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          source: 'agent',
          tags: ['nurture', inquiryType, leadName],
        }).catch(() => null));
      }

      await Promise.all(tasks);

      await base44.entities.Notification.create({
        title: `📧 Nurture Sequence Started: ${leadName}`,
        message: `${inquiryType?.toUpperCase()} nurture sequence initiated for ${leadName} (${email}). ${sequence.length} touchpoints over 30 days. Maestro: review and personalise each email before send. First email due: today.`,
        type: 'info',
        is_read: false,
      }).catch(() => {});

      return Response.json({ leadName, inquiryType, sequenceLength: sequence.length, touchpoints: sequence.map(s => `D+${s.day}: ${s.subject}`), tasksCreated: tasks.filter(Boolean).length });
    }

    // === DISCOVER REFERRAL PARTNERS ===
    if (action === 'discover_referral_partners') {
      const { serviceArea, serviceType, sector } = data || {};
      // sector: 'ndis' | 'aged_care' | 'both'

      const partnerTypesBySecctor = {
        ndis: [
          { type: 'plan_manager', description: 'NDIS Plan Managers in the service area', potentialReferrals: 'High (each manages 50-200 participants)', priority: 1 },
          { type: 'support_coordinator', description: 'Support Coordinators and Specialist Support Coordinators', potentialReferrals: 'High (key referral relationship)', priority: 1 },
          { type: 'local_area_coordinator', description: 'LACs contracted by the NDIA', potentialReferrals: 'Very High (community-wide touchpoint)', priority: 1 },
          { type: 'early_childhood_partner', description: 'Early Childhood Partners (for ECEI participants 0-6)', potentialReferrals: 'High if offering early intervention', priority: 1 },
          { type: 'allied_health', description: 'OTs, speech therapists, physiotherapists, psychologists', potentialReferrals: 'Medium (direct referrals for complementary services)', priority: 2 },
          { type: 'hospital', description: 'Hospital discharge planners and social workers', potentialReferrals: 'High (time-sensitive referrals)', priority: 1 },
          { type: 'school', description: 'Schools and special education units', potentialReferrals: 'Medium (for school-age participants)', priority: 2 },
          { type: 'disability_advocacy', description: 'Disability advocacy organisations', potentialReferrals: 'Medium (trusted by community)', priority: 2 },
          { type: 'community_health', description: 'Community health centres and GP clinics', potentialReferrals: 'Medium (first point of contact for new diagnoses)', priority: 2 },
        ],
        aged_care: [
          { type: 'gp_clinic', description: 'GP clinics — primary referral source for aged care assessments', potentialReferrals: 'Very High', priority: 1 },
          { type: 'acat_assessor', description: 'Aged Care Assessment Teams (unlock HCP funding)', potentialReferrals: 'High (direct pathway to funding)', priority: 1 },
          { type: 'hospital_discharge', description: 'Hospital discharge planners', potentialReferrals: 'Very High (urgent referrals)', priority: 1 },
          { type: 'geriatrician', description: 'Geriatricians and aged care specialists', potentialReferrals: 'High (high-acuity referrals)', priority: 1 },
          { type: 'pharmacy', description: 'Community pharmacies (frequent contact with elderly)', potentialReferrals: 'Medium', priority: 2 },
          { type: 'senior_community_group', description: 'Churches, RSLs, ethnic associations, U3A', potentialReferrals: 'Medium (community trust)', priority: 2 },
          { type: 'financial_adviser', description: 'Financial advisers and estate planners (work with families)', potentialReferrals: 'Medium', priority: 2 },
          { type: 'retirement_village', description: 'Retirement villages and independent living communities', potentialReferrals: 'High (adjacent service, natural transition)', priority: 1 },
        ],
      };

      const targetTypes = sector === 'both'
        ? [...partnerTypesBySecctor.ndis, ...partnerTypesBySecctor.aged_care]
        : (partnerTypesBySecctor[sector] || partnerTypesBySecctor.ndis);

      const priority1 = targetTypes.filter(p => p.priority === 1);
      const priority2 = targetTypes.filter(p => p.priority === 2);

      // Create tasks for Part to outreach to each priority 1 partner type
      const tasks = [];
      for (const partner of priority1.slice(0, 5)) {
        tasks.push(base44.entities.Task.create({
          title: `Identify and outreach: ${partner.type} — ${serviceArea}`,
          description: `Part + Prospect: identify ${partner.description} in ${serviceArea}. Create Partner records for each. Outreach with personalised introduction email.\nPotential: ${partner.potentialReferrals}\nSector: ${sector?.toUpperCase()}`,
          priority: 'high',
          status: 'pending',
          source: 'agent',
          tags: ['referral_partner', partner.type, sector, serviceArea],
        }).catch(() => null));
      }
      await Promise.all(tasks);

      await base44.entities.Notification.create({
        title: `🤝 Referral Partner Discovery: ${serviceArea}`,
        message: `${priority1.length} priority-1 partner types identified for ${sector?.toUpperCase()} in ${serviceArea}.\nTop priorities: ${priority1.slice(0,3).map(p => p.type).join(', ')}\nPart: initiate outreach for priority-1 partners. Tasks created.\nNexus: build referral relationship nurturing sequences for each partner type.`,
        type: 'info',
        is_read: false,
      }).catch(() => {});

      await base44.entities.Insight.create({
        title: `Referral Partner Opportunity: ${serviceArea} — ${sector}`,
        description: `${priority1.length} priority-1 partner types and ${priority2.length} priority-2 partner types identified. Primary targets: ${priority1.map(p => p.type).join(', ')}`,
      }).catch(() => {});

      return Response.json({ serviceArea, sector, priority1Partners: priority1, priority2Partners: priority2, totalPartnerTypes: targetTypes.length, tasksCreated: tasks.filter(Boolean).length, quickWins: priority1.slice(0, 3).map(p => ({ type: p.type, why: p.description, potential: p.potentialReferrals })) });
    }

    // === TRACK REFERRAL ===
    if (action === 'track_referral') {
      const { partnerId, partnerName, participantName, participantId, serviceType, estimatedLTV } = data || {};

      // Update Partner record
      const partners = await base44.entities.Partner.filter({ id: partnerId }).catch(() => []);
      if (partners?.length > 0) {
        const partner = partners[0];
        await base44.entities.Partner.update(partnerId, {
          leads_generated: (partner.leads_generated || 0) + 1,
          revenue_attributed: (partner.revenue_attributed || 0) + (estimatedLTV || 0),
          last_contact: new Date().toISOString().split('T')[0],
        }).catch(() => {});
      }

      // Check if this is a milestone referral (5th, 10th, 25th)
      const partners2 = await base44.entities.Partner.filter({ id: partnerId }).catch(() => []);
      const currentReferrals = (partners2?.[0]?.leads_generated || 0);
      const milestones = [5, 10, 25, 50];
      const isMilestone = milestones.includes(currentReferrals);

      await base44.entities.Activity.create({
        type: 'referral',
        title: `Referral from ${partnerName}: ${participantName}`,
        description: `Partner: ${partnerName} | Participant: ${participantName} | Service: ${serviceType} | Estimated LTV: $${estimatedLTV || 'TBC'} | Total referrals from this partner: ${currentReferrals}`,
      }).catch(() => {});

      if (isMilestone) {
        await base44.entities.Notification.create({
          title: `🎉 Referral Milestone: ${partnerName} — ${currentReferrals} referrals!`,
          message: `${partnerName} has now sent us ${currentReferrals} participants. Part: acknowledge this milestone with a personalised thank-you and recognition. Consider: priority service commitment, invitation to co-marketing, exclusive information sessions. Estimated revenue attributed: $${partners2?.[0]?.revenue_attributed?.toLocaleString() || estimatedLTV || '?'}.`,
          type: 'info',
          is_read: false,
        }).catch(() => {});
      }

      // Alert Centsible
      if (estimatedLTV) {
        await base44.entities.Notification.create({
          title: `💰 Referral Attribution: ${partnerName} → ${participantName}`,
          message: `Centsible: new participant ${participantName} attributed to referral partner ${partnerName}. Estimated LTV: $${estimatedLTV}. Update partner ROI tracking.`,
          type: 'info',
          is_read: false,
        }).catch(() => {});
      }

      return Response.json({ success: true, partnerId, partnerName, participantName, currentReferrals, isMilestone, milestoneType: isMilestone ? `${currentReferrals}th referral — recognition triggered` : null, estimatedLTV });
    }

    // === ANALYZE MARKET OPPORTUNITY ===
    if (action === 'analyze_market_opportunity') {
      const { region, serviceType, sector } = data || {};

      // Simulated market analysis (in production: integrate with ABS census API, NDIS data portal)
      const opportunityFactors = {
        ndis_early_childhood: { demandSignal: 'Rising — early intervention demand growing 15% YoY', competitorDensity: 'Low in outer suburbs', keyAudienceNote: 'Parents aged 25-40, searching online and through paediatricians', contentAngle: '"10 Signs Your Child Might Need Early Intervention" — high search volume', recommendedPartners: 'Paediatricians, childcare centres, kindergartens, child psychologists', urgency: 'Act now — underprovided' },
        ndis_behaviour_support: { demandSignal: 'Very high demand — registered behaviour support practitioners in short supply', competitorDensity: 'Very Low', keyAudienceNote: 'Families of participants with complex needs, schools and group homes', contentAngle: '"Understanding Behaviour Support Under the NDIS" — low competition keyword', recommendedPartners: 'Schools, group home operators, disability advocacy orgs', urgency: 'Critical gap in most regions' },
        ndis_community_access: { demandSignal: 'Consistent demand — social participation is a top goal for many participants', competitorDensity: 'Medium', keyAudienceNote: 'Young adults with disability and their families', contentAngle: '"Fun things to do in [suburb] with NDIS support" — highly local and searchable', recommendedPartners: 'Support coordinators, LACs, community centres', urgency: 'Steady opportunity' },
        aged_care_home_care: { demandSignal: 'Massive — Baby Boomer cohort entering aged care years, HCP waitlist shrinking', competitorDensity: 'Medium — growing demand outstripping supply in many regions', keyAudienceNote: 'Adults aged 65+ and their adult children aged 40-60', contentAngle: '"What can a Level 3 Home Care Package pay for?" — very high family search volume', recommendedPartners: 'GPs, pharmacies, retirement villages, financial advisers', urgency: 'Strong growth opportunity' },
        aged_care_dementia: { demandSignal: 'Rapidly growing — 400,000 Australians living with dementia, growing to 1M by 2058', competitorDensity: 'Low for specialist providers', keyAudienceNote: 'Family carers experiencing crisis — high emotional urgency', contentAngle: '"Caring for a parent with dementia — you don\'t have to do it alone"', recommendedPartners: 'GPs, neurologists, Dementia Australia', urgency: 'Critical — high unmet need' },
      };

      const key = `${sector}_${serviceType?.toLowerCase().replace(/\s/g, '_')}`;
      const analysis = opportunityFactors[key] || {
        demandSignal: `Research needed for ${serviceType} in ${sector} sector`,
        competitorDensity: 'Unknown — conduct manual research via Compass',
        keyAudienceNote: 'Engage Compass for audience intelligence',
        contentAngle: 'Conduct keyword research for specific content angles',
        recommendedPartners: 'Standard referral partner types for sector',
        urgency: 'Assess with more data',
      };

      const opportunityScore = analysis.urgency.includes('Critical') ? 90 : analysis.urgency.includes('Strong') ? 80 : analysis.urgency.includes('now') ? 85 : 65;

      await base44.entities.Insight.create({
        title: `Market Opportunity: ${serviceType} in ${region}`,
        description: `Sector: ${sector} | Score: ${opportunityScore}/100 | Demand: ${analysis.demandSignal} | Competition: ${analysis.competitorDensity} | Recommended action: ${analysis.contentAngle}`,
      }).catch(() => {});

      if (opportunityScore >= 80) {
        await base44.entities.Notification.create({
          title: `🎯 High-Value Market Opportunity: ${serviceType} in ${region}`,
          message: `Score: ${opportunityScore}/100. ${analysis.demandSignal}\nContent angle for Maestro: "${analysis.contentAngle}"\nReferral partners for Part: ${analysis.recommendedPartners}\nKey audience for Canvas + Maestro: ${analysis.keyAudienceNote}\nCompass: begin monitoring this area for leads.`,
          type: 'info',
          is_read: false,
        }).catch(() => {});
      }

      return Response.json({ region, serviceType, sector, opportunityScore, ...analysis, recommendations: { content: `Maestro + Canvas: create "${analysis.contentAngle}"`, partners: `Part + Nexus: identify ${analysis.recommendedPartners} in ${region}`, advertising: `Maestro: geo-targeted campaign in ${region} targeting ${analysis.keyAudienceNote}` } });
    }

    // === GENERATE CONTENT BRIEF ===
    if (action === 'generate_content_brief') {
      const { topic, sector, targetAudience, format } = data || {};
      // format: 'blog_post' | 'social_media' | 'video_script' | 'easy_read' | 'email' | 'facebook_ad'

      const contentBriefs = {
        blog_post: {
          structure: 'H1 keyword-rich title → Empathetic intro (acknowledge the reader\'s situation) → H2 subheadings with value → Practical tips/information → Real-world example or story → Clear CTA (book a free consultation)',
          seoTip: 'Target long-tail keywords: "NDIS [service type] [suburb]", "How to find an NDIS provider for [disability type]"',
          wordCount: '800-1500 words for SEO value',
          callToAction: 'Book a free, no-obligation consultation → link to calendar booking',
        },
        social_media: {
          structure: 'Hook (first 2 lines must stop the scroll) → Value (educational tip or relatable insight) → Empathetic close → CTA',
          platform: 'Facebook: target carers groups. LinkedIn: target support coordinators and plan managers. Instagram: visual with accessible caption.',
          sensitivityNote: 'No participant photos without documented written consent. No claims of guaranteed outcomes.',
          callToAction: 'Comment "INFO" to receive our [resource]. Link in bio for more.',
        },
        video_script: {
          structure: '[0:00-0:05] Hook: Open with the problem the viewer is facing. [0:05-0:40] Value: Explain the solution simply. [0:40-0:55] Authority: Brief credibility signal. [0:55-1:00] CTA: One clear action.',
          accessibilityNote: 'Add captions to all videos. Use clear speech, not jargon. Consider Easy English version.',
          platforms: 'Facebook (for families), YouTube (for SEO), TikTok (for younger carers/participants)',
          callToAction: 'Visit [website] or call [number] for a free chat',
        },
        easy_read: {
          structure: 'One idea per sentence. Max 12 words per sentence. Active voice. Include image/pictogram instructions alongside each key point. Large font minimum 14pt.',
          contentPrinciples: 'Use: "We will help you." Not: "Our organisation provides support to eligible participants." Use pictures to support the text.',
          accessibilityNote: 'Have a person with lived experience review before publishing',
          callToAction: 'Call us on [number] or ask someone to help you email us',
        },
        facebook_ad: {
          structure: 'Headline (benefit + audience): "[Service] for people with [disability/age] in [suburb]" → Body (empathetic + educational, 2-3 sentences) → CTA button: "Learn More" or "Book Free Consultation"',
          targeting: 'Facebook Detailed Targeting: interests (disability support, NDIS, aged care), demographics (parents, carers, age 35-60 for aged care), location (specific suburbs)',
          complianceNote: 'Veritas + Sentinel must review before publishing: no guaranteed outcomes, no discriminatory language, participant consent for any images used',
          callToAction: 'Learn More → landing page with free guide download (email capture)',
        },
      };

      const brief = contentBriefs[format] || contentBriefs.blog_post;

      const contentIdeas = {
        ndis: [
          `"${topic}" — What NDIS participants in [suburb] need to know`,
          `5 things to look for when choosing an NDIS ${topic} provider`,
          `How to make the most of your NDIS funding for ${topic}`,
          `Real stories: how ${topic} support changed [first name]'s life`,
          `Your rights as an NDIS participant when accessing ${topic}`,
        ],
        aged_care: [
          `"${topic}" — A practical guide for families`,
          `How a Home Care Package can help with ${topic}`,
          `Questions to ask when choosing an aged care provider for ${topic}`,
          `Supporting Mum or Dad with ${topic} — you don't have to do it alone`,
          `What the My Aged Care assessment means for accessing ${topic} support`,
        ],
      };

      const ideas = contentIdeas[sector] || contentIdeas.ndis;

      await base44.entities.Task.create({
        title: `Create ${format}: ${topic} — ${sector} audience`,
        description: `Maestro + Canvas: create ${format} on topic "${topic}" for ${targetAudience}.\nStructure: ${brief.structure}\n${brief.seoTip || ''}\n${brief.accessibilityNote || ''}\nCTA: ${brief.callToAction}\nSentinel + Veritas: review before publishing.`,
        priority: 'medium',
        status: 'pending',
        source: 'agent',
        tags: ['content', sector, format, topic],
      }).catch(() => {});

      return Response.json({ topic, sector, targetAudience, format, contentBrief: brief, suggestedTitles: ideas, complianceNote: 'Veritas and Sentinel must review all content before publishing in NDIS/Aged Care contexts. No guaranteed outcomes, no participant photos without signed consent.' });
    }

    // === SCORE REFERRAL PARTNER ===
    if (action === 'score_referral_partner') {
      const { partnerName, partnerType, location, existingReferrals, participantsUnderManagement, geographicAlignment, serviceAlignment, hasContactPerson } = data || {};

      // Scoring model for referral partners
      let score = 0;
      const scoreFactors = [];

      // Referral volume potential
      const volumeByType = { plan_manager: 30, support_coordinator: 28, local_area_coordinator: 30, hospital_discharge: 28, gp_clinic: 25, acat_assessor: 25, allied_health: 18, school: 15, community_group: 12, pharmacy: 12 };
      const volumeScore = volumeByType[partnerType] || 10;
      score += volumeScore;
      scoreFactors.push(`Referral volume potential: +${volumeScore} (${partnerType})`);

      if (participantsUnderManagement > 100) { score += 15; scoreFactors.push('Large participant/patient base: +15'); }
      else if (participantsUnderManagement > 20) { score += 8; scoreFactors.push('Medium participant/patient base: +8'); }

      if (geographicAlignment === 'exact') { score += 15; scoreFactors.push('Geographic alignment (exact): +15'); }
      else if (geographicAlignment === 'partial') { score += 8; scoreFactors.push('Geographic alignment (partial): +8'); }

      if (serviceAlignment === 'high') { score += 15; scoreFactors.push('Service specialisation alignment: +15'); }
      else if (serviceAlignment === 'medium') { score += 8; scoreFactors.push('Service alignment: +8'); }

      if (existingReferrals > 0) { score += 10; scoreFactors.push(`Existing referral history (${existingReferrals} referrals): +10`); }
      if (hasContactPerson) { score += 5; scoreFactors.push('Named contact identified: +5'); }

      const tier = score >= 75 ? 'Tier 1 — Priority Partner' : score >= 50 ? 'Tier 2 — Active Partner' : score >= 30 ? 'Tier 3 — Outreach Stage' : 'Waitlist — Monitor';
      const outreachPriority = score >= 75 ? 'Immediate — within this week' : score >= 50 ? 'This month' : score >= 30 ? 'Within quarter' : 'Low priority';

      const outreachApproach = {
        plan_manager: 'Professional email introduction + info pack on our services + how to refer (referral form link). Follow up with a phone call.',
        support_coordinator: 'Warm introduction via mutual connection if possible. Offer to present at their team meeting. Provide participant outcomes data.',
        hospital_discharge: 'Meet the discharge planning team in person. Provide 24-hour response guarantee for urgent referrals. Leave physical intake forms.',
        gp_clinic: 'Practice manager introduction + simple GP referral pathway. Brief 1-page service summary. Consider breakfast education session.',
        community_group: 'Attend a meeting as a guest speaker. Offer a free information session. Leave easy-read materials.',
      };

      await base44.entities.Partner.create({
        company_name: partnerName,
        type: 'referral',
        status: 'prospect',
        audience_size: participantsUnderManagement || 0,
        relationship_strength: Math.round(score / 2),
        opportunity_score: score,
        notes: `Type: ${partnerType} | Tier: ${tier} | Scored by Prospect. Factors: ${scoreFactors.join('; ')}`,
        opportunity_type: ['referral', partnerType],
      }).catch(() => {});

      return Response.json({ partnerName, partnerType, score, tier, outreachPriority, scoreFactors, recommendedOutreachApproach: outreachApproach[partnerType] || 'Professional introduction email + service overview + clear referral pathway', partnerCreated: true });
    }

    return Response.json({ error: `Unknown action: ${action}` }, { status: 400 });

  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});