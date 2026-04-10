import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Building2, CheckCircle2, Globe, Image as ImageIcon, Save, Settings2, Users2, Workflow } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { fetchUserProfileRemote, getRemoteSessionTenantId, getRemoteSessionUserId, hasRemoteBackend, saveUserProfileRemote } from "@/lib/remoteAgentClient";

const USER_ID = getRemoteSessionUserId();
const TENANT_ID = getRemoteSessionTenantId();
const BUSINESS_PROFILE_KEY = `jarvis.business.profile.v2.${TENANT_ID}`;

const DEFAULT_PROFILE = {
  company_name: "",
  legal_name: "",
  abn_or_tax_id: "",
  website: "",
  industry: "",
  business_model: "",
  stage: "",
  team_size: "",
  headquarters: "",
  service_areas: "",
  mission: "",
  vision: "",
  value_proposition: "",
  offerings: "",
  ideal_customer_profile: "",
  audience_personas: "",
  core_goals_90d: "",
  annual_goals: "",
  kpis: "",
  budget_marketing_monthly: "",
  budget_ops_monthly: "",
  preferred_channels: "",
  tools_and_integrations: "",
  compliance_requirements: "",
  approval_rules: "",
  risk_tolerance: "approve",
  brand_voice: "professional",
  brand_colors: "",
  brand_keywords: "",
  logo_data_url: "",
  notes_for_agents: "",
  updated_at: "",
};

function readLocalProfile() {
  try {
    const raw = localStorage.getItem(BUSINESS_PROFILE_KEY);
    if (!raw) return { ...DEFAULT_PROFILE };
    return { ...DEFAULT_PROFILE, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_PROFILE };
  }
}

export default function BusinessProfile() {
  const queryClient = useQueryClient();
  const [profile, setProfile] = useState(readLocalProfile);
  const [saved, setSaved] = useState(false);

  const remoteQuery = useQuery({
    queryKey: ["business_profile_remote", USER_ID],
    enabled: hasRemoteBackend(),
    queryFn: async () => {
      const res = await fetchUserProfileRemote(USER_ID);
      return res?.result?.profile || {};
    },
    staleTime: 30_000,
  });

  const mergedRemoteProfile = useMemo(() => {
    const settings = remoteQuery.data?.settings || {};
    const bp = settings.business_profile || {};
    return { ...DEFAULT_PROFILE, ...bp };
  }, [remoteQuery.data]);

  const saveMutation = useMutation({
    mutationFn: async (payload) => {
      localStorage.setItem(BUSINESS_PROFILE_KEY, JSON.stringify(payload));
      if (hasRemoteBackend()) {
        const remote = await fetchUserProfileRemote(USER_ID);
        const existing = remote?.result?.profile || {};
        const settings = existing.settings && typeof existing.settings === "object" ? existing.settings : {};
        await saveUserProfileRemote(USER_ID, {
          ...existing,
          settings: {
            ...settings,
            business_profile: payload,
          },
        });
      }
      return payload;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["business_profile_remote", USER_ID] });
      setSaved(true);
      setTimeout(() => setSaved(false), 1800);
    },
  });

  const onChange = (field, value) => setProfile((prev) => ({ ...prev, [field]: value }));

  const onLogoUpload = async (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      onChange("logo_data_url", String(reader.result || ""));
    };
    reader.readAsDataURL(file);
  };

  const onSave = async () => {
    const payload = { ...profile, updated_at: new Date().toISOString() };
    await saveMutation.mutateAsync(payload);
  };

  const sourceProfile = hasRemoteBackend() && remoteQuery.data ? mergedRemoteProfile : profile;

  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-6 py-6">
      <div className="app-card p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-600" />
              <h1 className="text-2xl font-semibold text-slate-900">Business Profile</h1>
            </div>
            <p className="text-sm text-slate-600 mt-1">Complete this once so all 17 agents can operate with business context, brand rules, and risk constraints.</p>
          </div>
          <Button className="bg-[#2563EB] hover:bg-[#1D4ED8] text-white rounded-lg" onClick={onSave} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? <Save className="w-4 h-4 mr-2 animate-pulse" /> : <Save className="w-4 h-4 mr-2" />}Save Profile
          </Button>
        </div>

        {saved && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 text-sm px-3 py-2 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />Profile saved. Agents will use this context immediately.
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-4">
          <section className="app-soft p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Building2 className="w-4 h-4" />Company Identity</h2>
            <Input placeholder="Company name" value={sourceProfile.company_name} onChange={(e) => onChange("company_name", e.target.value)} />
            <Input placeholder="Legal name" value={sourceProfile.legal_name} onChange={(e) => onChange("legal_name", e.target.value)} />
            <Input placeholder="ABN / Tax ID" value={sourceProfile.abn_or_tax_id} onChange={(e) => onChange("abn_or_tax_id", e.target.value)} />
            <Input placeholder="Website" value={sourceProfile.website} onChange={(e) => onChange("website", e.target.value)} />
            <div className="grid md:grid-cols-2 gap-2">
              <Input placeholder="Industry" value={sourceProfile.industry} onChange={(e) => onChange("industry", e.target.value)} />
              <Input placeholder="Business model" value={sourceProfile.business_model} onChange={(e) => onChange("business_model", e.target.value)} />
            </div>
            <div className="grid md:grid-cols-2 gap-2">
              <Input placeholder="Stage" value={sourceProfile.stage} onChange={(e) => onChange("stage", e.target.value)} />
              <Input placeholder="Team size" value={sourceProfile.team_size} onChange={(e) => onChange("team_size", e.target.value)} />
            </div>
            <Input placeholder="Headquarters" value={sourceProfile.headquarters} onChange={(e) => onChange("headquarters", e.target.value)} />
            <Textarea placeholder="Service areas / geographies" value={sourceProfile.service_areas} onChange={(e) => onChange("service_areas", e.target.value)} />
          </section>

          <section className="app-soft p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><ImageIcon className="w-4 h-4" />Brand + Creative</h2>
            <div className="grid md:grid-cols-2 gap-2">
              <Input placeholder="Brand voice" value={sourceProfile.brand_voice} onChange={(e) => onChange("brand_voice", e.target.value)} />
              <Input placeholder="Risk tolerance (suggest/approve/auto-low-risk/auto-broad)" value={sourceProfile.risk_tolerance} onChange={(e) => onChange("risk_tolerance", e.target.value)} />
            </div>
            <Input placeholder="Brand colors (comma separated)" value={sourceProfile.brand_colors} onChange={(e) => onChange("brand_colors", e.target.value)} />
            <Input placeholder="Brand keywords" value={sourceProfile.brand_keywords} onChange={(e) => onChange("brand_keywords", e.target.value)} />
            <Textarea placeholder="Mission" value={sourceProfile.mission} onChange={(e) => onChange("mission", e.target.value)} />
            <Textarea placeholder="Vision" value={sourceProfile.vision} onChange={(e) => onChange("vision", e.target.value)} />
            <Textarea placeholder="Value proposition" value={sourceProfile.value_proposition} onChange={(e) => onChange("value_proposition", e.target.value)} />
            <div className="space-y-2">
              <label className="text-xs text-slate-500">Logo</label>
              <Input type="file" accept="image/*" onChange={(e) => onLogoUpload(e.target.files?.[0])} />
              {sourceProfile.logo_data_url && <img src={sourceProfile.logo_data_url} alt="logo" className="h-16 w-auto rounded border border-slate-200 bg-white p-2" />}
            </div>
          </section>

          <section className="app-soft p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Users2 className="w-4 h-4" />Audience + Growth</h2>
            <Textarea placeholder="Offerings (products/services)" value={sourceProfile.offerings} onChange={(e) => onChange("offerings", e.target.value)} />
            <Textarea placeholder="Ideal customer profile" value={sourceProfile.ideal_customer_profile} onChange={(e) => onChange("ideal_customer_profile", e.target.value)} />
            <Textarea placeholder="Audience personas" value={sourceProfile.audience_personas} onChange={(e) => onChange("audience_personas", e.target.value)} />
            <Textarea placeholder="Core goals (next 90 days)" value={sourceProfile.core_goals_90d} onChange={(e) => onChange("core_goals_90d", e.target.value)} />
            <Textarea placeholder="Annual goals" value={sourceProfile.annual_goals} onChange={(e) => onChange("annual_goals", e.target.value)} />
            <Input placeholder="KPIs (comma separated)" value={sourceProfile.kpis} onChange={(e) => onChange("kpis", e.target.value)} />
            <Input placeholder="Preferred channels (comma separated)" value={sourceProfile.preferred_channels} onChange={(e) => onChange("preferred_channels", e.target.value)} />
          </section>

          <section className="app-soft p-4 space-y-3">
            <h2 className="text-sm font-semibold text-slate-900 flex items-center gap-2"><Workflow className="w-4 h-4" />Ops + Governance</h2>
            <div className="grid md:grid-cols-2 gap-2">
              <Input placeholder="Marketing budget / month" value={sourceProfile.budget_marketing_monthly} onChange={(e) => onChange("budget_marketing_monthly", e.target.value)} />
              <Input placeholder="Operations budget / month" value={sourceProfile.budget_ops_monthly} onChange={(e) => onChange("budget_ops_monthly", e.target.value)} />
            </div>
            <Textarea placeholder="Tools and integrations (CRM, Shopify, Gmail, etc.)" value={sourceProfile.tools_and_integrations} onChange={(e) => onChange("tools_and_integrations", e.target.value)} />
            <Textarea placeholder="Compliance requirements (GDPR, HIPAA, NDIS, etc.)" value={sourceProfile.compliance_requirements} onChange={(e) => onChange("compliance_requirements", e.target.value)} />
            <Textarea placeholder="Approval rules (what requires your sign-off)" value={sourceProfile.approval_rules} onChange={(e) => onChange("approval_rules", e.target.value)} />
            <Textarea placeholder="Notes for agents: constraints, non-negotiables, priorities" value={sourceProfile.notes_for_agents} onChange={(e) => onChange("notes_for_agents", e.target.value)} />
            <div className="text-xs text-slate-500 flex items-center gap-2"><Globe className="w-3 h-3" />
              {hasRemoteBackend() ? "Remote profile sync enabled" : "Local profile mode"}
            </div>
          </section>
        </div>

        <div className="app-soft p-4">
          <h3 className="text-sm font-semibold text-slate-900 mb-2 flex items-center gap-2"><Settings2 className="w-4 h-4" />Why this matters</h3>
          <p className="text-sm text-slate-600">Maestro uses this for campaign voice and channels. Canvas uses it for branded content generation. Veritas uses compliance fields for policy checks. Atlas and Nexus use goals, budgets, and approval rules for autonomy and orchestration decisions.</p>
        </div>
      </div>
    </div>
  );
}
