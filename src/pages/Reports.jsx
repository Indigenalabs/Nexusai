import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText, ArrowLeft, Download, Plus, Loader2, BarChart3,
  DollarSign, Users, Zap, TrendingUp
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const typeIcons = {
  analytics: { icon: BarChart3, color: "blue" },
  financial: { icon: DollarSign, color: "emerald" },
  social: { icon: TrendingUp, color: "violet" },
  workflow: { icon: Zap, color: "amber" },
  team: { icon: Users, color: "cyan" },
  custom: { icon: FileText, color: "slate" },
};

export default function Reports() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [generating, setGenerating] = useState(null);
  const [newReport, setNewReport] = useState({ title: "", type: "analytics", period: "monthly", format: "pdf" });
  const queryClient = useQueryClient();

  const { data: reports = [] } = useQuery({
    queryKey: ["reports"],
    queryFn: () => base44.entities.Report.list("-created_date", 30),
  });

  const createMutation = useMutation({
    mutationFn: async (data) => {
      return base44.entities.Report.create({ ...data, status: "generating" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      setIsCreateOpen(false);
    },
  });

  const handleGenerate = async (report) => {
    setGenerating(report.id);

    // Gather relevant data
    const [insights, activities, metrics] = await Promise.all([
      base44.entities.Insight.list("-created_date", 20),
      base44.entities.Activity.list("-created_date", 30),
      base44.entities.Metric.list("-created_date", 10),
    ]);

    const summary = await base44.integrations.Core.InvokeLLM({
      prompt: `Generate a concise ${report.period} ${report.type} business report titled "${report.title}".

Data available:
- ${insights.length} business insights
- ${activities.length} recent activities
- ${metrics.length} tracked metrics
- Top insights: ${insights.slice(0,5).map(i => i.title).join(', ')}

Write a professional executive summary (3-5 paragraphs) with key findings, trends, and recommendations. Be specific and actionable.`,
    });

    await base44.entities.Report.update(report.id, {
      status: "ready",
      description: summary
    });

    queryClient.invalidateQueries({ queryKey: ["reports"] });
    setGenerating(null);
  };

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Report.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reports"] }),
  });

  const handleExportReport = (report) => {
    const payload = {
      title: report.title,
      type: report.type,
      period: report.period,
      status: report.status,
      created_date: report.created_date,
      description: report.description || "",
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${String(report.title || "report").replace(/[^a-z0-9]+/gi, "_").toLowerCase()}_${report.id || "export"}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] bg-grid">
      <div className="px-6 lg:px-10 pt-8 pb-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link to={createPageUrl("Dashboard")} className="text-slate-500 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <FileText className="w-5 h-5 text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Reports</h1>
              <p className="text-sm text-slate-500">AI-generated business intelligence reports</p>
            </div>
          </div>
          <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500">
                <Plus className="w-4 h-4 mr-2" /> New Report
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[hsl(222,42%,8%)] border-white/[0.1] text-white">
              <DialogHeader>
                <DialogTitle>Create Report</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-slate-400">Report Title</Label>
                  <input
                    value={newReport.title}
                    onChange={(e) => setNewReport({ ...newReport, title: e.target.value })}
                    placeholder="e.g. Q1 Performance Summary"
                    className="w-full mt-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs text-slate-400">Type</Label>
                    <Select value={newReport.type} onValueChange={(v) => setNewReport({ ...newReport, type: v })}>
                      <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[hsl(222,42%,8%)] border-white/[0.1] text-white">
                        <SelectItem value="analytics">Analytics</SelectItem>
                        <SelectItem value="financial">Financial</SelectItem>
                        <SelectItem value="social">Social</SelectItem>
                        <SelectItem value="workflow">Workflow</SelectItem>
                        <SelectItem value="team">Team</SelectItem>
                        <SelectItem value="custom">Custom</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Period</Label>
                    <Select value={newReport.period} onValueChange={(v) => setNewReport({ ...newReport, period: v })}>
                      <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white mt-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[hsl(222,42%,8%)] border-white/[0.1] text-white">
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                        <SelectItem value="monthly">Monthly</SelectItem>
                        <SelectItem value="quarterly">Quarterly</SelectItem>
                        <SelectItem value="yearly">Yearly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <Button
                  onClick={() => createMutation.mutate(newReport)}
                  disabled={!newReport.title}
                  className="w-full bg-blue-600 hover:bg-blue-500"
                >
                  Create Report
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {[
            { label: "Total Reports", value: reports.length, color: "blue" },
            { label: "Ready", value: reports.filter(r => r.status === 'ready').length, color: "emerald" },
            { label: "Generating", value: reports.filter(r => r.status === 'generating').length, color: "amber" },
          ].map((stat) => (
            <div key={stat.label} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
              <p className="text-xs text-slate-500 mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold text-${stat.color}-400`}>{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Reports List */}
        <div className="space-y-4">
          {reports.map((report, i) => {
            const typeCfg = typeIcons[report.type] || typeIcons.custom;
            const TypeIcon = typeCfg.icon;
            const isGen = generating === report.id;

            return (
              <motion.div
                key={report.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className={`p-2.5 rounded-xl bg-${typeCfg.color}-500/15 flex-shrink-0`}>
                      <TypeIcon className={`w-5 h-5 text-${typeCfg.color}-400`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-white mb-1">{report.title}</h3>
                      {report.description && (
                        <p className="text-xs text-slate-400 mb-2 line-clamp-2">{report.description}</p>
                      )}
                      <div className="flex items-center gap-2">
                        <Badge className={`bg-${typeCfg.color}-500/15 text-${typeCfg.color}-400 text-[10px]`}>
                          {report.type}
                        </Badge>
                        <Badge className="bg-white/[0.05] text-slate-400 text-[10px]">
                          {report.period}
                        </Badge>
                        <Badge className={`text-[10px] ${
                          report.status === 'ready' ? 'bg-emerald-500/15 text-emerald-400' :
                          report.status === 'generating' ? 'bg-amber-500/15 text-amber-400' :
                          'bg-red-500/15 text-red-400'
                        }`}>
                          {report.status}
                        </Badge>
                        <span className="text-[10px] text-slate-600">
                          {report.created_date && format(new Date(report.created_date), "MMM d, h:mm a")}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4 flex-shrink-0">
                    {report.status === 'generating' && (
                      <Button
                        size="sm"
                        onClick={() => handleGenerate(report)}
                        disabled={isGen}
                        className="bg-blue-600/80 hover:bg-blue-600 text-white h-8 text-xs"
                      >
                        {isGen ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Zap className="w-3 h-3 mr-1" />}
                        {isGen ? "Generating..." : "Generate AI Report"}
                      </Button>
                    )}
                    {report.status === 'ready' && (
                      <Button size="sm" variant="outline" onClick={() => handleExportReport(report)} className="border-white/[0.08] h-8 text-xs">
                        <Download className="w-3 h-3 mr-1" /> Export
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(report.id)}
                      className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                    >
                      ×
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}

          {reports.length === 0 && (
            <div className="text-center py-20 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
              <FileText className="w-12 h-12 text-slate-700 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">No reports yet</h3>
              <p className="text-sm text-slate-500">Create your first AI-powered business report</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
