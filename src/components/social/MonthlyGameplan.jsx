import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calendar, Sparkles, Loader2, CheckCircle2,
  Zap, Target, TrendingUp, Brain
} from "lucide-react";
import { format } from "date-fns";

const PLATFORMS = ["instagram", "tiktok", "facebook", "linkedin"];
const CONTENT_MIX = [
  { id: "reel", label: "Reels/Shorts" },
  { id: "post", label: "Picture Posts" },
  { id: "carousel", label: "Carousels" },
  { id: "story", label: "Stories" },
  { id: "flyer", label: "Flyers" },
];
const MONTHS = Array.from({ length: 12 }, (_, i) => {
  const d = new Date(2026, i, 1);
  return { value: format(d, "yyyy-MM"), label: format(d, "MMMM yyyy") };
});

export default function MonthlyGameplan({ posts }) {
  const [selectedMonth, setSelectedMonth] = useState(MONTHS[new Date().getMonth()].value);
  const [selectedPlatforms, setSelectedPlatforms] = useState(["instagram", "tiktok"]);
  const [postsPerWeek, setPostsPerWeek] = useState(5);
  const [focus, setFocus] = useState("brand awareness and engagement");
  const [goals, setGoals] = useState("");
  const [targets, setTargets] = useState("");
  const [contentMix, setContentMix] = useState(["reel", "post", "carousel"]);
  const [result, setResult] = useState(null);
  const queryClient = useQueryClient();

  const gameplanMutation = useMutation({
    mutationFn: async () => {
      const { data } = await base44.functions.invoke('socialGameplan', {
        month: selectedMonth,
        platforms: selectedPlatforms,
        postsPerWeek,
        focus,
        goals,
        targets,
        contentMix
      });
      return data;
    },
    onSuccess: (data) => {
      setResult(data);
      queryClient.invalidateQueries({ queryKey: ["social-posts"] });
    }
  });

  const togglePlatform = (p) => {
    setSelectedPlatforms(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  };

  const monthPosts = posts.filter(p => p.gameplan_month === selectedMonth);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-400" /> Gameplan Settings
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Month</label>
                <select
                  value={selectedMonth}
                  onChange={e => setSelectedMonth(e.target.value)}
                  className="w-full bg-white/[0.04] border border-white/[0.08] text-white text-sm rounded-lg px-3 py-2"
                >
                  {MONTHS.map(m => <option key={m.value} value={m.value} className="bg-slate-900">{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Platforms</label>
                <div className="flex flex-wrap gap-2">
                  {PLATFORMS.map(p => (
                    <button
                      key={p}
                      onClick={() => togglePlatform(p)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all capitalize ${
                        selectedPlatforms.includes(p)
                          ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                          : 'bg-white/[0.03] border-white/[0.08] text-slate-400'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Posts per week</label>
                <div className="flex gap-2">
                  {[3, 5, 7, 10].map(n => (
                    <button
                      key={n}
                      onClick={() => setPostsPerWeek(n)}
                      className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${
                        postsPerWeek === n
                          ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                          : 'bg-white/[0.03] border-white/[0.08] text-slate-400'
                      }`}
                    >
                      {n}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Content Focus</label>
                <input
                  value={focus}
                  onChange={e => setFocus(e.target.value)}
                  placeholder="e.g. product launch, brand awareness..."
                  className="w-full bg-white/[0.04] border border-white/[0.08] text-white text-sm rounded-lg px-3 py-2 placeholder:text-slate-600"
                />
              </div>

              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Content Mix</label>
                <div className="flex flex-wrap gap-2">
                  {CONTENT_MIX.map(ct => (
                    <button
                      key={ct.id}
                      onClick={() => setContentMix(prev => prev.includes(ct.id) ? prev.filter(x => x !== ct.id) : [...prev, ct.id])}
                      className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                        contentMix.includes(ct.id)
                          ? 'bg-pink-500/20 border-pink-500/40 text-pink-300'
                          : 'bg-white/[0.03] border-white/[0.08] text-slate-500'
                      }`}
                    >
                      {ct.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Goals & Targets */}
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 border-l-2 border-l-violet-500/50">
            <h3 className="text-sm font-semibold text-white mb-1 flex items-center gap-2">
              <Target className="w-4 h-4 text-violet-400" /> Tell Nexus Your Goals
            </h3>
            <p className="text-[10px] text-slate-500 mb-3">The more you share, the more tailored your gameplan will be.</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Goals & Objectives</label>
                <textarea
                  value={goals}
                  onChange={e => setGoals(e.target.value)}
                  placeholder="e.g. Grow to 10k followers, drive traffic to our new product launch, build trust with local audience..."
                  rows={3}
                  className="w-full bg-white/[0.04] border border-white/[0.08] text-white text-xs rounded-lg px-3 py-2 placeholder:text-slate-600 resize-none"
                />
              </div>
              <div>
                <label className="text-xs text-slate-400 mb-1.5 block">Targets & KPIs</label>
                <textarea
                  value={targets}
                  onChange={e => setTargets(e.target.value)}
                  placeholder="e.g. 500 new followers/month, 5% engagement rate, 100 website clicks per post, 3 leads per week..."
                  rows={3}
                  className="w-full bg-white/[0.04] border border-white/[0.08] text-white text-xs rounded-lg px-3 py-2 placeholder:text-slate-600 resize-none"
                />
              </div>
            </div>
          </div>

          <Button
            onClick={() => gameplanMutation.mutate()}
            disabled={gameplanMutation.isPending || selectedPlatforms.length === 0}
            className="w-full bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 h-11"
          >
            {gameplanMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Building Gameplan...</>
            ) : (
              <><Zap className="w-4 h-4 mr-2" /> Generate & Schedule Month</>
            )}
          </Button>

          {monthPosts.length > 0 && (
            <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/20 p-4">
              <div className="flex items-center gap-2 mb-1">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <span className="text-sm font-semibold text-emerald-400">{monthPosts.length} posts scheduled</span>
              </div>
              <p className="text-xs text-slate-400">for {MONTHS.find(m => m.value === selectedMonth)?.label}</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          <AnimatePresence mode="wait">
            {gameplanMutation.isPending && (
              <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-10 text-center">
                <Sparkles className="w-12 h-12 text-violet-400 animate-pulse mx-auto mb-4" />
                <p className="text-white font-semibold mb-1">Nexus is building your gameplan</p>
                <p className="text-xs text-slate-500">Analyzing audience data, trends, and your brand...</p>
              </motion.div>
            )}

            {result && !gameplanMutation.isPending && (
              <motion.div key="result" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
                {result.strategy_summary && (
                  <div className="rounded-2xl bg-violet-500/10 border border-violet-500/20 p-5">
                    <div className="flex items-center gap-2 mb-2">
                      <Brain className="w-4 h-4 text-violet-400" />
                      <span className="text-sm font-semibold text-white">Strategy</span>
                    </div>
                    <p className="text-xs text-slate-300">{result.strategy_summary}</p>
                  </div>
                )}
                {result.content_pillars?.length > 0 && (
                  <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <Target className="w-4 h-4 text-pink-400" /> Content Pillars
                    </h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {result.content_pillars.map((pillar, i) => (
                        <div key={i} className="p-3 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                          <p className="text-xs font-semibold text-white mb-1">{pillar.name}</p>
                          <p className="text-[10px] text-slate-500">{pillar.description}</p>
                          <Badge className="mt-1 bg-pink-500/15 text-pink-400 text-[10px]">{pillar.posting_frequency}</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {result.audience_insights?.engagement_triggers?.length > 0 && (
                  <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
                    <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-emerald-400" /> Audience Insights Used
                    </h3>
                    <div className="space-y-2">
                      {result.audience_insights.engagement_triggers.slice(0, 3).map((trigger, i) => (
                        <div key={i} className="flex items-center gap-2 text-xs text-slate-400">
                          <Zap className="w-3 h-3 text-amber-400 flex-shrink-0" />
                          {trigger}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
                  <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                  <div>
                    <p className="text-sm font-semibold text-emerald-400">{result.posts_scheduled} posts autonomously scheduled</p>
                    <p className="text-xs text-slate-400">Nexus has scheduled your entire month. Review in the Scheduler.</p>
                  </div>
                </div>
              </motion.div>
            )}

            {!result && !gameplanMutation.isPending && monthPosts.length === 0 && (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-10 text-center">
                <Calendar className="w-12 h-12 text-slate-700 mx-auto mb-3" />
                <p className="text-white font-semibold mb-1">No gameplan yet</p>
                <p className="text-xs text-slate-500">Configure your settings and let Nexus build and schedule your entire month automatically.</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}