import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, TrendingUp, Loader2, Globe, Target, AlertTriangle, Users } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function GrowthIntelligence() {
  const [intelligence, setIntelligence] = useState(null);
  const [loading, setLoading] = useState(false);
  const { data: profile = [] } = useQuery({
    queryKey: ["profile_growth"],
    queryFn: () => base44.entities.BusinessProfile.list("-created_date", 1),
  });
  const { data: clients = [] } = useQuery({
    queryKey: ["clients_growth"],
    queryFn: () => base44.entities.Client.list("-created_date", 50),
  });
  const { data: trends = [] } = useQuery({
    queryKey: ["trends_growth"],
    queryFn: () => base44.entities.Trend.list("-created_date", 10),
  });
  const { data: financials = [] } = useQuery({
    queryKey: ["financials_growth"],
    queryFn: () => base44.entities.FinancialSnapshot.list("-date", 3),
  });

  const runIntelligence = async () => {
    setLoading(true);
    const bp = profile[0];
    const result = await base44.integrations.Core.InvokeLLM({
      prompt: `You are a Growth Intelligence AI. Conduct a deep market analysis for this business and surface high-value growth opportunities.

Business Profile: ${JSON.stringify(bp || {})}
Total Clients: ${clients.length} (${clients.filter(c => c.status === "active").length} active, ${clients.filter(c => c.status === "lead").length} leads)
Recent Trends: ${JSON.stringify(trends.slice(0, 5))}
Financial Health: ${JSON.stringify(financials[0] || {})}
Industry: ${bp?.industry || "unknown"}
Business Type: ${bp?.business_type || "unknown"}

Generate comprehensive growth intelligence including:
1. Market opportunities (new segments, verticals, geographies)
2. Competitor gaps they are missing that you could exploit
3. Partnership and collaboration plays
4. Upsell/cross-sell opportunities from current client base
5. Whitespace opportunities in the market
6. Recommended priority actions ranked by ROI potential

Be highly specific and data-driven. Provide concrete, actionable insights.`,
      add_context_from_internet: true,
      response_json_schema: {
        type: "object",
        properties: {
          market_opportunities: {
            type: "array",
            items: { type: "object", properties: { title: { type: "string" }, description: { type: "string" }, potential_value: { type: "string" }, effort: { type: "string", enum: ["low", "medium", "high"] } } }
          },
          competitor_gaps: {
            type: "array",
            items: { type: "object", properties: { gap: { type: "string" }, how_to_exploit: { type: "string" } } }
          },
          partnership_plays: {
            type: "array",
            items: { type: "string" }
          },
          upsell_opportunities: {
            type: "array",
            items: { type: "object", properties: { opportunity: { type: "string" }, target_segment: { type: "string" } } }
          },
          priority_actions: {
            type: "array",
            items: { type: "object", properties: { action: { type: "string" }, roi_potential: { type: "string" }, timeline: { type: "string" } } }
          },
          growth_score: { type: "number" }
        }
      }
    });
    setIntelligence(result);
    setLoading(false);
  };

  const effortColors = { low: "emerald", medium: "amber", high: "red" };

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] bg-grid">
      <div className="px-6 lg:px-10 pt-8 pb-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link to={createPageUrl("Dashboard")} className="text-slate-500 hover:text-white">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Globe className="w-5 h-5 text-emerald-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Growth Intelligence</h1>
              <p className="text-sm text-slate-500">AI market scanning, competitor gaps & expansion plays</p>
            </div>
          </div>
          <Button onClick={runIntelligence} disabled={loading}
            className="bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500">
            {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Scanning Market...</> : <><Globe className="w-4 h-4 mr-2" />Run Intelligence Scan</>}
          </Button>
        </div>

        {!intelligence && !loading && (
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-20 text-center">
            <Globe className="w-16 h-16 text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Market Intelligence Scan</h3>
            <p className="text-sm text-slate-500 mb-6 max-w-md mx-auto">AI will scan the internet and your business data to surface competitor gaps, expansion opportunities, and high-ROI growth plays.</p>
            <Button onClick={runIntelligence} className="bg-gradient-to-r from-emerald-600 to-blue-600">
              <Globe className="w-4 h-4 mr-2" /> Run Scan Now
            </Button>
          </div>
        )}

        {loading && (
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-20 text-center">
            <Loader2 className="w-12 h-12 text-emerald-400 mx-auto mb-4 animate-spin" />
            <p className="text-white font-medium">Scanning market intelligence...</p>
            <p className="text-sm text-slate-500 mt-2">Analysing competitors, trends, and your business data</p>
          </div>
        )}

        {intelligence && (
          <div className="space-y-6">
            {/* Growth Score */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
                <p className="text-xs text-slate-400 mb-1">Growth Potential Score</p>
                <p className="text-4xl font-bold text-emerald-400">{intelligence.growth_score}/100</p>
                <div className="w-full bg-white/[0.06] rounded-full h-2 mt-3">
                  <div className="h-2 rounded-full bg-gradient-to-r from-emerald-500 to-blue-500" style={{ width: `${intelligence.growth_score}%` }} />
                </div>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
                <p className="text-xs text-slate-400 mb-1">Opportunities Found</p>
                <p className="text-4xl font-bold text-white">{intelligence.market_opportunities?.length || 0}</p>
              </motion.div>
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
                <p className="text-xs text-slate-400 mb-1">Competitor Gaps</p>
                <p className="text-4xl font-bold text-white">{intelligence.competitor_gaps?.length || 0}</p>
              </motion.div>
            </div>

            {/* Priority Actions */}
            {intelligence.priority_actions?.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                className="rounded-2xl bg-blue-500/10 border border-blue-500/20 p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-semibold text-white">Priority Growth Actions</h3>
                </div>
                <div className="space-y-3">
                  {intelligence.priority_actions.map((action, i) => (
                    <div key={i} className="flex items-start justify-between gap-3 p-3 bg-white/[0.04] rounded-xl">
                      <div className="flex items-start gap-2">
                        <span className="text-xs text-blue-400 font-bold mt-0.5">#{i + 1}</span>
                        <div>
                          <p className="text-sm text-white">{action.action}</p>
                          <p className="text-xs text-slate-400">{action.timeline}</p>
                        </div>
                      </div>
                      <Badge className="bg-emerald-500/15 text-emerald-400 text-[10px] shrink-0">{action.roi_potential}</Badge>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Market Opportunities */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-white">Market Opportunities</h3>
                </div>
                <div className="space-y-3">
                  {intelligence.market_opportunities?.map((opp, i) => (
                    <div key={i} className="p-3 bg-white/[0.03] rounded-xl border border-white/[0.04]">
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="text-sm text-white font-medium">{opp.title}</p>
                        <div className="flex gap-1 shrink-0">
                          <Badge className={`text-[10px] bg-${effortColors[opp.effort]}-500/15 text-${effortColors[opp.effort]}-400`}>{opp.effort} effort</Badge>
                        </div>
                      </div>
                      <p className="text-xs text-slate-400">{opp.description}</p>
                      {opp.potential_value && <p className="text-xs text-emerald-400 mt-1">Value: {opp.potential_value}</p>}
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Competitor Gaps + Partnerships */}
              <div className="space-y-4">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                  className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                    <h3 className="text-sm font-semibold text-white">Competitor Gaps</h3>
                  </div>
                  <div className="space-y-2">
                    {intelligence.competitor_gaps?.map((gap, i) => (
                      <div key={i} className="p-3 bg-white/[0.03] rounded-xl">
                        <p className="text-xs font-medium text-amber-300">{gap.gap}</p>
                        <p className="text-[11px] text-slate-400 mt-1">{gap.how_to_exploit}</p>
                      </div>
                    ))}
                  </div>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
                  className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-violet-400" />
                    <h3 className="text-sm font-semibold text-white">Partnership Plays</h3>
                  </div>
                  <ul className="space-y-1.5">
                    {intelligence.partnership_plays?.map((play, i) => (
                      <li key={i} className="text-xs text-slate-400 flex items-start gap-2">
                        <span className="text-violet-400">•</span>{play}
                      </li>
                    ))}
                  </ul>
                </motion.div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
