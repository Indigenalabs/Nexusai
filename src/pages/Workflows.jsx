import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Workflow as WorkflowIcon, ArrowLeft, Plus, Play, Pause, Trash2, Pencil,
  Mail, Target, DollarSign, Zap, Calendar, Download
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import WorkflowBuilder from "@/components/workflows/WorkflowBuilder";
import { getRemoteBackendBase, hasRemoteBackend } from "@/lib/remoteAgentClient";

const triggerIcons = {
  email_received: Mail,
  new_lead: Target,
  invoice_overdue: DollarSign,
  schedule: Calendar,
  manual: Zap,
};

const riskStyles = {
  low: "bg-emerald-500/15 text-emerald-300 border-emerald-500/25",
  medium: "bg-amber-500/15 text-amber-300 border-amber-500/25",
  high: "bg-red-500/15 text-red-300 border-red-500/25",
};

async function fetchBackend(path, options = {}) {
  const base = getRemoteBackendBase();
  const res = await fetch(`${base}${path}`, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

export default function Workflows() {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingWorkflow, setEditingWorkflow] = useState(null);
  const queryClient = useQueryClient();

  const { data: workflows = [] } = useQuery({
    queryKey: ["workflows"],
    queryFn: () => base44.entities.Workflow.list("-created_date"),
  });

  const { data: templateResult, isLoading: templatesLoading } = useQuery({
    queryKey: ["workflow_templates", "v1"],
    enabled: hasRemoteBackend(),
    queryFn: async () => {
      const res = await fetchBackend("/v1/workflow-templates");
      return res?.result || { templates: [] };
    },
    staleTime: 60_000,
  });

  const templates = templateResult?.templates || [];

  const { data: autonomyResult } = useQuery({
    queryKey: ["autonomy_matrix", "v1"],
    enabled: hasRemoteBackend(),
    queryFn: async () => {
      const res = await fetchBackend("/v1/autonomy/matrix");
      return res?.result || {};
    },
    staleTime: 60_000,
  });

  const autonomyUpdateMutation = useMutation({
    mutationFn: async (nextMatrix) => {
      const res = await fetchBackend("/v1/autonomy/matrix", {
        method: "POST",
        body: JSON.stringify({ matrix: nextMatrix }),
      });
      return res?.result || {};
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["autonomy_matrix", "v1"] });
    },
  });

  const saveWorkflowMutation = useMutation({
    mutationFn: (data) => {
      if (data.id) {
        const { id, ...rest } = data;
        return base44.entities.Workflow.update(id, rest);
      }
      return base44.entities.Workflow.create(data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
      setIsCreateOpen(false);
      setEditingWorkflow(null);
    },
  });

  const importTemplateMutation = useMutation({
    mutationFn: async (template) => {
      if (!hasRemoteBackend()) throw new Error("Backend not configured");
      const res = await fetchBackend(`/v1/workflow-templates/${encodeURIComponent(template.id)}/instantiate`, {
        method: "POST",
        body: JSON.stringify({}),
      });
      const workflow = res?.result?.workflow;
      if (!workflow) throw new Error("Template instantiate failed");
      return await base44.entities.Workflow.create(workflow);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workflows"] });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, status }) => base44.entities.Workflow.update(id, {
      status: status === "active" ? "paused" : "active"
    }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflows"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Workflow.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["workflows"] }),
  });

  const handleEdit = (workflow) => {
    setEditingWorkflow(workflow);
    setIsCreateOpen(true);
  };

  const handleClose = () => {
    setIsCreateOpen(false);
    setEditingWorkflow(null);
  };

  const matrix = autonomyResult?.matrix || {};

  const updateMatrixTier = (key, tier) => {
    const next = {
      social_posting: matrix.social_posting || "approve",
      email_replies: matrix.email_replies || "approve",
      document_ingestion: matrix.document_ingestion || "auto-low-risk",
      shop_operations: matrix.shop_operations || "approve",
      generic_operations: matrix.generic_operations || "approve",
      [key]: tier,
    };
    autonomyUpdateMutation.mutate(next);
  };

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] bg-grid">
      <div className="px-6 lg:px-10 pt-8 pb-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link to={createPageUrl("Dashboard")} className="text-slate-500 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <WorkflowIcon className="w-5 h-5 text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">AI Workflows</h1>
              <p className="text-sm text-slate-500">Automate your business processes</p>
            </div>
          </div>
          <Button onClick={() => { setEditingWorkflow(null); setIsCreateOpen(true); }} className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500">
            <Plus className="w-4 h-4 mr-2" /> Create Workflow
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Active", value: workflows.filter((w) => w.status === "active").length, color: "emerald" },
            { label: "Paused", value: workflows.filter((w) => w.status === "paused").length, color: "amber" },
            { label: "Total Runs", value: workflows.reduce((sum, w) => sum + (w.runs_count || 0), 0), color: "blue" },
            { label: "Total", value: workflows.length, color: "violet" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4"
            >
              <p className="text-xs text-slate-400 mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold text-${stat.color}-400`}>{stat.value}</p>
            </motion.div>
          ))}
        </div>

        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-white">Autonomy Matrix</h2>
            <Badge variant="outline" className="border-white/10 text-slate-400">supervised autonomy</Badge>
          </div>
          {!hasRemoteBackend() && (
            <p className="text-xs text-amber-300">Backend connection required to persist autonomy tiers.</p>
          )}
          {hasRemoteBackend() && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
              {[
                ["social_posting", "social posting"],
                ["email_replies", "email replies"],
                ["document_ingestion", "document ingestion"],
                ["shop_operations", "shop operations"],
                ["generic_operations", "generic operations"],
              ].map(([key, label]) => (
                <div key={key} className="rounded-lg border border-white/[0.08] bg-black/20 p-2">
                  <p className="text-[10px] text-slate-500 mb-1">{label}</p>
                  <select
                    value={matrix[key] || "approve"}
                    onChange={(e) => updateMatrixTier(key, e.target.value)}
                    className="w-full bg-white/[0.05] border border-white/[0.12] rounded px-2 py-1 text-xs text-slate-200"
                    disabled={autonomyUpdateMutation.isPending}
                  >
                    {["suggest", "approve", "auto-low-risk", "auto-broad"].map((tier) => (
                      <option key={tier} value={tier}>{tier}</option>
                    ))}
                  </select>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 mb-6">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base font-semibold text-white">Business Workflow Packs</h2>
            <Badge variant="outline" className="border-white/10 text-slate-400">{templates.length} templates</Badge>
          </div>

          {!hasRemoteBackend() && (
            <p className="text-xs text-amber-300">Connect backend (`VITE_AGENT_BACKEND_URL`) to import template packs.</p>
          )}

          {hasRemoteBackend() && templatesLoading && (
            <p className="text-xs text-slate-400">Loading templates...</p>
          )}

          {hasRemoteBackend() && !templatesLoading && templates.length === 0 && (
            <p className="text-xs text-slate-500">No templates returned by backend.</p>
          )}

          {templates.length > 0 && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {templates.map((t) => (
                <div key={t.id} className="rounded-xl border border-white/[0.08] bg-black/20 p-3">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{t.name}</p>
                      <p className="text-[11px] text-slate-500">{t.business_type} - {t.category}</p>
                    </div>
                    <Badge className={`${riskStyles[t.risk] || riskStyles.medium} border`}>{t.risk}</Badge>
                  </div>
                  <p className="text-xs text-slate-400 mb-2 line-clamp-2">{t.description}</p>
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[10px] text-slate-500">Autonomy: {t.autonomy}</div>
                    <Button
                      size="sm"
                      onClick={() => importTemplateMutation.mutate(t)}
                      disabled={importTemplateMutation.isPending || !hasRemoteBackend()}
                      className="h-7 text-[11px] bg-blue-600 hover:bg-blue-500"
                    >
                      <Download className="w-3 h-3 mr-1" />
                      Use Template
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-3">
          {workflows.map((workflow, i) => {
            const TriggerIcon = triggerIcons[workflow.trigger] || Zap;
            return (
              <motion.div
                key={workflow.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5 hover:bg-white/[0.05] transition-all"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4 flex-1">
                    <div className="p-2.5 rounded-xl bg-blue-500/15">
                      <TriggerIcon className="w-5 h-5 text-blue-400" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="text-base font-semibold text-white">{workflow.name}</h3>
                        <Badge className={workflow.status === "active" ? "bg-emerald-500/15 text-emerald-400" : "bg-amber-500/15 text-amber-400"}>
                          {workflow.status}
                        </Badge>
                        {workflow.created_from_template && (
                          <Badge variant="outline" className="border-blue-500/25 text-blue-300">template</Badge>
                        )}
                      </div>
                      <p className="text-sm text-slate-400 mb-2">{workflow.description}</p>
                      <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                        <span>Trigger: {(workflow.trigger || "").replace(/_/g, " ")}</span>
                        <span>- {workflow.actions?.length || 0} action{workflow.actions?.length !== 1 ? "s" : ""}</span>
                        {workflow.runs_count > 0 && <span>- {workflow.runs_count} runs</span>}
                        {workflow.last_run && <span>- Last: {new Date(workflow.last_run).toLocaleString()}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(workflow)}
                      className="border-white/[0.08] text-slate-400 hover:text-white"
                    >
                      <Pencil className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => toggleMutation.mutate({ id: workflow.id, status: workflow.status })}
                      className="border-white/[0.08]"
                    >
                      {workflow.status === "active" ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deleteMutation.mutate(workflow.id)}
                      className="border-white/[0.08] text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {workflows.length === 0 && (
          <div className="text-center py-20 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
            <WorkflowIcon className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No workflows yet</h3>
            <p className="text-sm text-slate-500 mb-4">Create your first workflow or import a workflow pack template</p>
          </div>
        )}
      </div>

      <WorkflowBuilder
        open={isCreateOpen}
        onClose={handleClose}
        onSave={(data) => saveWorkflowMutation.mutate(data)}
        workflow={editingWorkflow}
      />
    </div>
  );
}



