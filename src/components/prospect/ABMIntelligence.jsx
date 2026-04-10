import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Building2, Search, Target, Users, Zap, Globe } from "lucide-react";

export default function ABMIntelligence() {
  const [industry, setIndustry] = useState("");
  const [companySize, setCompanySize] = useState("any");
  const [location, setLocation] = useState("Australia");
  const [loading, setLoading] = useState(null);
  const [abmList, setAbmList] = useState(null);
  const [discoverIndustry, setDiscoverIndustry] = useState("");
  const [targetProfile, setTargetProfile] = useState("");
  const [discoveryResult, setDiscoveryResult] = useState(null);
  const [competitor, setCompetitor] = useState("");
  const [competitorResult, setCompetitorResult] = useState(null);
  const [referralSector, setReferralSector] = useState("ndis");
  const [referralResult, setReferralResult] = useState(null);

  const buildABMList = async () => {
    if (!industry) return;
    setLoading("abm");
    const res = await base44.functions.invoke('prospectLeadGeneration', {
      action: 'build_abm_list', industry, company_size: companySize, location
    });
    setAbmList(res.data?.abm_list);
    setLoading(null);
  };

  const discoverLeads = async () => {
    if (!discoverIndustry) return;
    setLoading("discover");
    const res = await base44.functions.invoke('prospectLeadGeneration', {
      action: 'discover_leads', industry: discoverIndustry, target_profile: { description: targetProfile }, location
    });
    setDiscoveryResult(res.data?.result);
    setLoading(null);
  };

  const runCompetitorIntel = async () => {
    if (!competitor) return;
    setLoading("competitor");
    const res = await base44.functions.invoke('prospectLeadGeneration', {
      action: 'competitive_intelligence', competitor
    });
    setCompetitorResult(res.data?.intel);
    setLoading(null);
  };

  const discoverReferrals = async () => {
    setLoading("referral");
    const res = await base44.functions.invoke('prospectLeadGeneration', {
      action: 'discover_referral_partners', sector: referralSector, location
    });
    setReferralResult(res.data?.partners);
    setLoading(null);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Lead Discovery */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Search className="w-4 h-4 text-violet-400" />
            <h3 className="text-sm font-semibold text-white">Lead Discovery Engine</h3>
          </div>
          <Input value={discoverIndustry} onChange={e => setDiscoverIndustry(e.target.value)}
            placeholder="Industry (e.g., NDIS, Aged Care, SaaS)"
            className="bg-white/[0.04] border-white/[0.08] text-slate-300 placeholder:text-slate-600 text-xs" />
          <Input value={targetProfile} onChange={e => setTargetProfile(e.target.value)}
            placeholder="Target profile (e.g., plan managers, CEOs of 50+ employee companies)"
            className="bg-white/[0.04] border-white/[0.08] text-slate-300 placeholder:text-slate-600 text-xs" />
          <Input value={location} onChange={e => setLocation(e.target.value)}
            placeholder="Location"
            className="bg-white/[0.04] border-white/[0.08] text-slate-300 placeholder:text-slate-600 text-xs" />
          <Button onClick={discoverLeads} disabled={loading === "discover" || !discoverIndustry}
            className="w-full bg-violet-600/80 hover:bg-violet-600 text-white text-xs">
            {loading === "discover" ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Zap className="w-3 h-3 mr-1.5" />}
            {loading === "discover" ? "Discovering..." : "Discover Lead Sources"}
          </Button>
          {discoveryResult && (
            <div className="space-y-2 pt-2">
              {discoveryResult.search_strategies?.slice(0, 3).map((s, i) => (
                <p key={i} className="text-[10px] text-slate-400 flex gap-2"><span className="text-violet-400">→</span>{s}</p>
              ))}
              {discoveryResult.top_channels?.map((ch, i) => (
                <div key={i} className="flex items-center justify-between bg-white/[0.02] rounded px-2 py-1">
                  <span className="text-[10px] text-slate-300">{ch.channel}</span>
                  <span className="text-[10px] text-emerald-400">~{ch.estimated_leads} leads</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ABM List Builder */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Building2 className="w-4 h-4 text-blue-400" />
            <h3 className="text-sm font-semibold text-white">ABM Target Account Builder</h3>
          </div>
          <Input value={industry} onChange={e => setIndustry(e.target.value)}
            placeholder="Industry (e.g., NDIS Providers, Disability Services)"
            className="bg-white/[0.04] border-white/[0.08] text-slate-300 placeholder:text-slate-600 text-xs" />
          <Select value={companySize} onValueChange={setCompanySize}>
            <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-slate-300 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="any">Any size</SelectItem>
              <SelectItem value="1-10">1-10 employees</SelectItem>
              <SelectItem value="10-50">10-50 employees</SelectItem>
              <SelectItem value="50-200">50-200 employees</SelectItem>
              <SelectItem value="200+">200+ employees</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={buildABMList} disabled={loading === "abm" || !industry}
            className="w-full bg-blue-600/80 hover:bg-blue-600 text-white text-xs">
            {loading === "abm" ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Target className="w-3 h-3 mr-1.5" />}
            {loading === "abm" ? "Building..." : "Build ABM Target List"}
          </Button>
          {abmList?.target_accounts && (
            <div className="max-h-48 overflow-y-auto space-y-1.5 pt-2">
              {abmList.target_accounts.slice(0, 10).map((acc, i) => (
                <div key={i} className="flex items-start gap-2 bg-white/[0.02] rounded-lg px-2 py-1.5">
                  <span className={`text-[9px] px-1 py-0.5 rounded flex-shrink-0 ${acc.tier === 'A' ? 'bg-emerald-500/20 text-emerald-400' : acc.tier === 'B' ? 'bg-blue-500/20 text-blue-400' : 'bg-slate-500/20 text-slate-400'}`}>{acc.tier || 'B'}</span>
                  <div className="min-w-0">
                    <p className="text-[10px] font-medium text-slate-300 truncate">{acc.company}</p>
                    <p className="text-[9px] text-slate-600 truncate">{acc.reason}</p>
                  </div>
                  {acc.estimated_deal && <span className="text-[9px] text-emerald-400 flex-shrink-0 ml-auto">{acc.estimated_deal}</span>}
                </div>
              ))}
              {abmList.decision_maker_titles?.length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {abmList.decision_maker_titles.slice(0, 5).map((t, i) => (
                    <span key={i} className="text-[9px] px-1.5 py-0.5 rounded-full bg-violet-500/10 text-violet-400 border border-violet-500/20">{t}</span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Competitive Intelligence */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Globe className="w-4 h-4 text-orange-400" />
            <h3 className="text-sm font-semibold text-white">Competitive Intelligence</h3>
          </div>
          <Input value={competitor} onChange={e => setCompetitor(e.target.value)}
            placeholder="Competitor name (e.g., Mable, Hireup, MedHealth)"
            className="bg-white/[0.04] border-white/[0.08] text-slate-300 placeholder:text-slate-600 text-xs" />
          <Button onClick={runCompetitorIntel} disabled={loading === "competitor" || !competitor}
            className="w-full bg-orange-600/80 hover:bg-orange-600 text-white text-xs">
            {loading === "competitor" ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Search className="w-3 h-3 mr-1.5" />}
            {loading === "competitor" ? "Researching..." : "Run Competitor Intel"}
          </Button>
          {competitorResult && (
            <div className="space-y-2 pt-1">
              {competitorResult.our_differentiators?.slice(0, 3).map((d, i) => (
                <p key={i} className="text-[10px] text-emerald-400 flex gap-2"><span>✓</span>{d}</p>
              ))}
              {competitorResult.competitor_weaknesses?.slice(0, 3).map((w, i) => (
                <p key={i} className="text-[10px] text-red-400 flex gap-2"><span>✗</span>{w}</p>
              ))}
              {competitorResult.battle_card && (
                <div className="bg-white/[0.02] border border-white/[0.06] rounded p-2 mt-2">
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Battle Card</p>
                  <p className="text-[10px] text-slate-400 leading-relaxed">{competitorResult.battle_card}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Referral Partner Discovery */}
        <div className="bg-white/[0.03] border border-white/[0.06] rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 mb-2">
            <Users className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-semibold text-white">Referral Partner Discovery</h3>
          </div>
          <Select value={referralSector} onValueChange={setReferralSector}>
            <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-slate-300 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ndis">NDIS</SelectItem>
              <SelectItem value="aged_care">Aged Care</SelectItem>
              <SelectItem value="both">NDIS + Aged Care</SelectItem>
              <SelectItem value="disability">Disability Services</SelectItem>
              <SelectItem value="healthcare">Healthcare</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={discoverReferrals} disabled={loading === "referral"}
            className="w-full bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs">
            {loading === "referral" ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Users className="w-3 h-3 mr-1.5" />}
            {loading === "referral" ? "Discovering..." : "Discover Referral Partners"}
          </Button>
          {referralResult?.partner_types && (
            <div className="space-y-2 pt-1 max-h-52 overflow-y-auto">
              {referralResult.partner_types.map((p, i) => (
                <div key={i} className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-2">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-[10px] font-medium text-slate-300">{p.type}</p>
                    {p.monthly_referral_potential && <span className="text-[9px] text-emerald-400">~{p.monthly_referral_potential}/mo</span>}
                  </div>
                  <p className="text-[9px] text-slate-600">{p.description}</p>
                </div>
              ))}
              {referralResult.top_opportunities?.slice(0, 3).map((opp, i) => (
                <p key={i} className="text-[10px] text-slate-400 flex gap-2"><span className="text-emerald-400">→</span>{opp}</p>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}