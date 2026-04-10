import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Plug, ArrowLeft, Check, X, Clock, Lock, Plus, Brain, Sparkles,
  Instagram, Linkedin, Twitter, Facebook, Mail,
  FileText, Trello, Github, Slack
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import CustomIntegrationForm from "@/components/integrations/CustomIntegrationForm";
import IntegrationTemplates from "@/components/integrations/IntegrationTemplates";
import AIIntegrationBuilder from "@/components/integrations/AIIntegrationBuilder";

const iconMap = {
  Instagram, Linkedin, Twitter, Facebook, Mail,
  FileText, Trello, Github, Slack
};

const statusColors = {
  connected: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  disconnected: "bg-slate-500/15 text-slate-400 border-slate-500/20",
  error: "bg-red-500/15 text-red-400 border-red-500/20",
  coming_soon: "bg-amber-500/15 text-amber-400 border-amber-500/20",
};

const categoryColors = {
  social: "from-violet-500/20 to-violet-600/5",
  email: "from-blue-500/20 to-blue-600/5",
  crm: "from-emerald-500/20 to-emerald-600/5",
  accounting: "from-amber-500/20 to-amber-600/5",
  project_management: "from-cyan-500/20 to-cyan-600/5",
  analytics: "from-pink-500/20 to-pink-600/5",
  other: "from-slate-500/20 to-slate-600/5",
};

export default function Integrations() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAIBuilder, setShowAIBuilder] = useState(false);
  const queryClient = useQueryClient();

  const { data: integrations = [] } = useQuery({
    queryKey: ["integrations"],
    queryFn: () => base44.entities.Integration.list(),
  });
  const visibleIntegrations = integrations.filter(i => i.integration_type !== "webhook");

  const connectMutation = useMutation({
    mutationFn: (integration) => base44.entities.Integration.update(integration.id, { 
      status: "connected",
      last_sync: new Date().toISOString(),
      data_synced: Math.floor(Math.random() * 1000)
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Integration.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
    },
  });

  const handleTemplateSelect = (template) => {
    createMutation.mutate({
      ...template,
      integration_type: 'template',
      status: 'disconnected',
      icon_name: 'Plug'
    });
    setShowTemplates(false);
  };

  const filtered = visibleIntegrations.filter(i => {
    const categoryMatch = filter === "all" || i.category === filter;
    const searchMatch = !search || i.name.toLowerCase().includes(search.toLowerCase());
    return categoryMatch && searchMatch;
  });

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] bg-grid">
      <div className="px-6 lg:px-10 pt-8 pb-10">
        <div className="flex items-center gap-3 mb-2">
          <Link to={createPageUrl("Dashboard")} className="text-slate-500 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Plug className="w-5 h-5 text-emerald-400" />
          <h1 className="text-2xl font-bold text-white">Integrations</h1>
        </div>
        <p className="text-sm text-slate-500 mb-6 ml-8">Connect your favorite tools to Nexus AI</p>

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 mb-6">
          <Button
            onClick={() => setShowAIBuilder(true)}
            className="bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
          >
            <Brain className="w-4 h-4 mr-2" />
            AI Builder
          </Button>
          <Button
            onClick={() => setShowTemplates(true)}
            variant="outline"
            className="border-blue-500/30 text-blue-400 hover:bg-blue-500/10"
          >
            <Sparkles className="w-4 h-4 mr-2" />
            Templates
          </Button>
          <Button
            onClick={() => setShowCustomForm(true)}
            variant="outline"
            className="border-white/[0.1] text-white hover:bg-white/[0.05]"
          >
            <Plus className="w-4 h-4 mr-2" />
            Custom API
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          {[
            { label: "Connected", value: visibleIntegrations.filter(i => i.status === "connected").length, color: "emerald" },
            { label: "Available", value: visibleIntegrations.filter(i => i.status === "disconnected").length, color: "blue" },
            { label: "Coming Soon", value: visibleIntegrations.filter(i => i.status === "coming_soon").length, color: "amber" },
            { label: "Total", value: visibleIntegrations.length, color: "violet" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`rounded-2xl bg-${stat.color}-500/[0.08] border border-${stat.color}-500/20 p-4`}
            >
              <p className="text-xs text-slate-400 mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold text-${stat.color}-400`}>{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <div className="flex flex-col md:flex-row gap-4 mb-6">
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search integrations..."
            className="md:w-64 bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-600"
          />
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="bg-white/[0.04] border border-white/[0.06]">
              <TabsTrigger value="all" className="text-xs data-[state=active]:bg-white/[0.1]">All</TabsTrigger>
              <TabsTrigger value="social" className="text-xs data-[state=active]:bg-white/[0.1]">Social</TabsTrigger>
              <TabsTrigger value="crm" className="text-xs data-[state=active]:bg-white/[0.1]">CRM</TabsTrigger>
              <TabsTrigger value="project_management" className="text-xs data-[state=active]:bg-white/[0.1]">PM</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Integrations Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((integration, i) => {
            const Icon = iconMap[integration.icon_name] || Plug;
            const isConnected = integration.status === "connected";
            const isComingSoon = integration.status === "coming_soon";

            return (
              <motion.div
                key={integration.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className={`rounded-2xl bg-gradient-to-br ${categoryColors[integration.category] || categoryColors.other} border border-white/[0.06] p-5 ${
                  isComingSoon ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="p-2.5 rounded-xl bg-white/[0.06]">
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${statusColors[integration.status]}`}>
                    {integration.status === "connected" && <Check className="w-2.5 h-2.5 mr-1" />}
                    {integration.status === "error" && <X className="w-2.5 h-2.5 mr-1" />}
                    {integration.status === "coming_soon" && <Clock className="w-2.5 h-2.5 mr-1" />}
                    {integration.status.replace("_", " ")}
                  </Badge>
                </div>

                <h3 className="text-sm font-semibold text-white mb-1">{integration.name}</h3>
                <p className="text-xs text-slate-400 line-clamp-2 mb-4">{integration.description}</p>

                {isConnected && integration.last_sync && (
                  <div className="mb-3 p-2 rounded-lg bg-white/[0.04] border border-white/[0.04]">
                    <p className="text-[10px] text-slate-500">Last sync: {new Date(integration.last_sync).toLocaleString()}</p>
                    {integration.data_synced > 0 && (
                      <p className="text-[10px] text-slate-600">{integration.data_synced} items synced</p>
                    )}
                  </div>
                )}

                <Button
                  onClick={() => !isComingSoon && !isConnected && connectMutation.mutate(integration)}
                  disabled={isConnected || isComingSoon}
                  className={`w-full ${
                    isConnected 
                      ? "bg-emerald-600 hover:bg-emerald-700" 
                      : isComingSoon
                      ? "bg-slate-700"
                      : "bg-blue-600 hover:bg-blue-700"
                  }`}
                >
                  {isComingSoon ? (
                    <><Lock className="w-3.5 h-3.5 mr-2" /> Coming Soon</>
                  ) : isConnected ? (
                    <><Check className="w-3.5 h-3.5 mr-2" /> Connected</>
                  ) : (
                    <>Connect</>
                  )}
                </Button>
              </motion.div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20">
            <Plug className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No integrations found</h3>
            <p className="text-sm text-slate-500">Try adjusting your search or filters</p>
          </div>
        )}

        {/* Dialogs */}
        <CustomIntegrationForm
          open={showCustomForm}
          onClose={() => setShowCustomForm(false)}
          onSubmit={(data) => createMutation.mutate(data)}
        />

        <AIIntegrationBuilder
          open={showAIBuilder}
          onClose={() => setShowAIBuilder(false)}
        />

        {showTemplates && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[hsl(222,42%,8%)] rounded-2xl border border-white/[0.1] p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-white">Integration Templates</h2>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setShowTemplates(false)}
                  className="text-slate-400 hover:text-white"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
              <p className="text-sm text-slate-400 mb-6">
                Pre-built integrations for popular business apps. Just add your credentials and start using.
              </p>
              <IntegrationTemplates onSelect={handleTemplateSelect} />
            </motion.div>
          </div>
        )}
      </div>
    </div>
  );
}

