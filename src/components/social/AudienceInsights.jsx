import React from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Brain, TrendingUp, Clock, Zap, Loader2, Users
} from "lucide-react";

export default function AudienceInsights({ insights, posts }) {
  const queryClient = useQueryClient();

  const refreshMutation = useMutation({
    mutationFn: async () => {
      const { data } = await base44.functions.invoke('proactiveAnalysis', {});
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["audience-prefs"] });
      queryClient.invalidateQueries({ queryKey: ["social-posts"] });
    }
  });

  const publishedPosts = posts.filter(p => p.status === 'published');
  const highScorePosts = posts.filter(p => p.ai_score >= 80);
  const scoredPosts = posts.filter(p => p.ai_score);
  const avgScore = scoredPosts.length
    ? Math.round(scoredPosts.reduce((s, p) => s + p.ai_score, 0) / scoredPosts.length)
    : null;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-semibold text-white">Audience Intelligence</h3>
          <p className="text-xs text-slate-500 mt-0.5">What your audience responds to — learned from your data</p>
        </div>
        <Button
          size="sm"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          className="bg-violet-600/80 hover:bg-violet-600 h-8 text-xs"
        >
          {refreshMutation.isPending ? (
            <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Analyzing...</>
          ) : (
            <><Brain className="w-3 h-3 mr-1" /> Refresh Analysis</>
          )}
        </Button>
      </div>

      {insights ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {insights.best_posting_times && (
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
              <div className="flex items-center gap-2 mb-3">
                <Clock className="w-4 h-4 text-blue-400" />
                <h4 className="text-sm font-semibold text-white">Best Posting Times</h4>
              </div>
              <div className="space-y-2">
                {Object.entries(insights.best_posting_times).map(([platform, time]) => (
                  <div key={platform} className="flex items-center justify-between">
                    <span className="text-xs text-slate-400 capitalize">{platform}</span>
                    <Badge className="bg-blue-500/15 text-blue-400 text-[10px]">{String(time)}</Badge>
                  </div>
                ))}
              </div>
            </div>
          )}

          {insights.top_content_types?.length > 0 && (
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                <h4 className="text-sm font-semibold text-white">Top Content Types</h4>
              </div>
              <div className="flex flex-wrap gap-2">
                {insights.top_content_types.map((type, i) => (
                  <Badge key={i} className="bg-emerald-500/15 text-emerald-400 text-xs capitalize">{type}</Badge>
                ))}
              </div>
            </div>
          )}

          {insights.audience_pain_points?.length > 0 && (
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
              <div className="flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-amber-400" />
                <h4 className="text-sm font-semibold text-white">Audience Pain Points</h4>
              </div>
              <div className="space-y-2">
                {insights.audience_pain_points.map((point, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-slate-400">
                    <span className="text-amber-400 mt-0.5">•</span>
                    {point}
                  </div>
                ))}
              </div>
            </div>
          )}

          {insights.engagement_triggers?.length > 0 && (
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
              <div className="flex items-center gap-2 mb-3">
                <Zap className="w-4 h-4 text-violet-400" />
                <h4 className="text-sm font-semibold text-white">Engagement Triggers</h4>
              </div>
              <div className="space-y-2">
                {insights.engagement_triggers.map((trigger, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-slate-300">
                    <Zap className="w-3 h-3 text-violet-400 flex-shrink-0 mt-0.5" />
                    {trigger}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-10 text-center">
          <Brain className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-white font-semibold mb-1">No audience data yet</p>
          <p className="text-xs text-slate-500 mb-4">Generate a monthly gameplan or run a refresh analysis to let Nexus learn your audience's preferences.</p>
          <Button
            onClick={() => refreshMutation.mutate()}
            disabled={refreshMutation.isPending}
            className="bg-violet-600 hover:bg-violet-700 text-sm"
          >
            {refreshMutation.isPending ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Brain className="w-4 h-4 mr-2" />}
            Analyze Audience Now
          </Button>
        </div>
      )}

      {avgScore !== null && (
        <div className="grid grid-cols-3 gap-3">
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
            <p className="text-2xl font-bold text-white">{avgScore}</p>
            <p className="text-xs text-slate-500 mt-1">Avg AI Score</p>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
            <p className="text-2xl font-bold text-emerald-400">{highScorePosts.length}</p>
            <p className="text-xs text-slate-500 mt-1">High Performers</p>
          </div>
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] text-center">
            <p className="text-2xl font-bold text-blue-400">{publishedPosts.length}</p>
            <p className="text-xs text-slate-500 mt-1">Published</p>
          </div>
        </div>
      )}
    </div>
  );
}