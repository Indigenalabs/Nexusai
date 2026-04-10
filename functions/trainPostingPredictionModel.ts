import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await req.json();
    const { platform, lookback_weeks = 12 } = payload;

    // Fetch all social posts for this platform from past N weeks
    const socialPosts = await base44.asServiceRole.entities.SocialPost.filter({
      platform,
      created_date: {
        $gte: new Date(Date.now() - lookback_weeks * 7 * 24 * 60 * 60 * 1000).toISOString()
      }
    });

    if (socialPosts.length < 10) {
      return Response.json({
        status: 'insufficient_data',
        message: `Only ${socialPosts.length} posts found. Need minimum 10 for reliable model.`
      });
    }

    // Prepare training data
    const trainingData = socialPosts.map(post => ({
      date: new Date(post.created_date),
      hour: new Date(post.created_date).getHours(),
      day_of_week: new Date(post.created_date).toLocaleDateString('en-US', { weekday: 'long' }),
      format: post.format || 'text',
      topic: post.topic || 'general',
      engagement_rate: (post.engagement_metrics?.engagement_rate || 0),
      views: post.engagement_metrics?.reach || 0
    }));

    // Use LLM to analyze patterns and generate predictions
    const predictionResponse = await base44.integrations.Core.InvokeLLM({
      prompt: `Analyze this social media posting performance data and predict optimal posting schedule:

Platform: ${platform}
Data points: ${trainingData.length} posts over ${lookback_weeks} weeks

Performance by day and time:
${trainingData.map(d => `${d.day_of_week} at ${d.hour}:00 - Format: ${d.format}, Topic: ${d.topic} → ${d.engagement_rate}% engagement`).slice(0, 30).join('\n')}

Generate optimal posting schedule for next week with:
1. Best day/time for each day (Monday-Sunday)
2. Recommended content format per slot
3. Expected engagement rate based on historical data
4. Confidence score for each prediction

Format as JSON:
{
  "predictions": [
    {"day": "monday", "optimal_time": "HH:MM", "optimal_time_window": "HH:MM-HH:MM", "format": "video|carousel|image|text|reel", "topic": "string", "engagement": 0-100, "confidence": 0-100}
  ],
  "model_accuracy": 0-100,
  "insights": "string with key findings"
}`,
      response_json_schema: {
        type: 'object',
        properties: {
          predictions: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                day: { type: 'string' },
                optimal_time: { type: 'string' },
                optimal_time_window: { type: 'string' },
                format: { type: 'string' },
                topic: { type: 'string' },
                engagement: { type: 'number' },
                confidence: { type: 'number' }
              }
            }
          },
          model_accuracy: { type: 'number' },
          insights: { type: 'string' }
        }
      }
    });

    // Store the prediction schedule
    const weekStart = new Date();
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Next Monday

    const schedule = await base44.asServiceRole.entities.PostingSchedulePrediction.create({
      platform,
      week_starting: weekStart.toISOString().split('T')[0],
      predictions: predictionResponse.predictions.map(p => ({
        day: p.day,
        optimal_time: p.optimal_time,
        optimal_time_window: p.optimal_time_window,
        recommended_format: p.format,
        recommended_topic: p.topic,
        predicted_engagement_rate: p.engagement,
        confidence_score: p.confidence,
        reasoning: `Based on ${trainingData.length} historical posts`
      })),
      model_accuracy_last_week: predictionResponse.model_accuracy,
      data_points_used: trainingData.length,
      model_version: 'v1.0'
    });

    // Create Notification for Sage/Maestro
    await base44.asServiceRole.entities.Notification.create({
      type: 'posting_schedule_ready',
      title: `📅 Optimal Posting Schedule Generated: ${platform}`,
      message: `${platform} posting schedule for week of ${weekStart.toISOString().split('T')[0]} is ready. Model accuracy: ${predictionResponse.model_accuracy}%.`,
      priority: 'medium',
      action_url: `/PostingSchedulePrediction?id=${schedule.id}`,
      recipient_role: 'admin'
    });

    return Response.json({
      status: 'success',
      schedule_id: schedule.id,
      platform,
      week_starting: weekStart.toISOString().split('T')[0],
      model_accuracy: predictionResponse.model_accuracy,
      data_points: trainingData.length,
      insights: predictionResponse.insights,
      predictions_count: predictionResponse.predictions.length
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});