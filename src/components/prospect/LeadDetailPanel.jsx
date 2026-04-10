import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Zap, Mail, Phone, Building2,
  Loader2, Send, RefreshCw, ChevronDown, ChevronUp
} from "lucide-react";

const STATUS_CONFIG = {
  new:          { label: "New",          color: "bg-blue-500/15 text-blue-400 border-blue-500/20" },
  contacted:    { label: "Contacted",    color: "bg-yellow-500/15 text-yellow-400 border-yellow-500/20" },
  qualified:    { label: "Qualified",    color: "bg-green-500/15 text-green-400 border-green-500/20" },
  nurturing:    { label: "Nurturing",    color: "bg-purple-500/15 text-purple-400 border-purple-500/20" },
  proposal:     { label: "Proposal",     color: "bg-orange-500/15 text-orange-400 border-orange-500/20" },
  converted:    { label: "Converted",    color: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20" },
  disqualified: { label: "Disqualified", color: "bg-red-500/15 text-red-400 border-red-500/20" },
  lost:         { label: "Lost",         color: "bg-slate-500/15 text-slate-400 border-slate-500/20" },
};

export default function LeadDetailPanel({ lead, onEnrich, onGenerateOutreach }) {
  const [enriching, setEnriching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [outreach, setOutreach] = useState(null);
  const [showOutreach, setShowOutreach] = useState(false);
  const [sending, setSending] = useState(false);

  const score = lead.score || 0;
  const cfg = STATUS_CONFIG[lead.status] || STATUS_CONFIG.new;
  const name = `${lead.first_name || ""} ${lead.last_name || ""}`.trim() || "Unknown";

  const scoreColor = score >= 80 ? "text-orange-400" : score >= 60 ? "text-yellow-400" : score >= 40 ? "text-blue-400" : "text-slate-500";
  const scoreIcon = score >= 80 ? "🔥" : score >= 60 ? "⚡" : score >= 40 ? "🌤️" : "❄️";

  const handleEnrich = async () => {
    setEnriching(true);
    await base44.functions.invoke('prospectLeadGeneration', { action: 'enrich_lead', lead_id: lead.id });
    setEnriching(false);
    onEnrich?.();
  };

  const handleGenerateOutreach = async () => {
    setGenerating(true);
    const res = await base44.functions.invoke('prospectLeadGeneration', { action: 'generate_outreach', lead_id: lead.id });
    setOutreach(res.data?.outreach);
    setShowOutreach(true);
    setGenerating(false);
    onGenerateOutreach?.();
  };

  const handleSend = async () => {
    if (!outreach) return;
    setSending(true);
    await base44.functions.invoke('prospectLeadGeneration', {
      action: 'send_outreach',
      lead_id: lead.id,
      subject: outreach.subject_variants?.[0] || "Following up",
      body: outreach.primary_message
    });
    setSending(false);
  };

  return (
    <div className="h-full flex flex-col bg-[hsl(222,42%,8%)] border-l border-white/[0.06]">
      {/* Header */}
      <div className="p-4 border-b border-white/[0.06]">
        <div className="flex items-start justify-between mb-3">
          <div>
            <h3 className="text-sm font-semibold text-white">{name}</h3>
            <p className="text-xs text-slate-500">{lead.title}{lead.title && lead.company ? " · " : ""}{lead.company}</p>
          </div>
          <div className={`text-2xl font-bold ${scoreColor}`}>{scoreIcon} {score}</div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] px-2 py-0.5 rounded-full border ${cfg.color}`}>{cfg.label}</span>
          {lead.source && <span className="text-[10px] text-slate-500 px-2 py-0.5 rounded-full bg-white/[0.03] border border-white/[0.06]">{lead.source}</span>}
          {lead.priority && <span className={`text-[10px] px-2 py-0.5 rounded-full border ${lead.priority === 'high' ? 'bg-red-500/10 text-red-400 border-red-500/20' : lead.priority === 'medium' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20' : 'bg-slate-500/10 text-slate-400 border-slate-500/20'}`}>{lead.priority}</span>}
        </div>
      </div>

      {/* Contact Info */}
      <div className="p-4 border-b border-white/[0.06] space-y-2">
        {lead.email && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Mail className="w-3 h-3 text-slate-600" />
            <span>{lead.email}</span>
          </div>
        )}
        {lead.phone && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Phone className="w-3 h-3 text-slate-600" />
            <span>{lead.phone}</span>
          </div>
        )}
        {lead.company && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <Building2 className="w-3 h-3 text-slate-600" />
            <span>{lead.company}</span>
          </div>
        )}
      </div>

      {/* Notes */}
      {lead.notes && (
        <div className="p-4 border-b border-white/[0.06]">
          <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-1">Notes</p>
          <p className="text-xs text-slate-400 leading-relaxed">{lead.notes}</p>
        </div>
      )}

      {/* Actions */}
      <div className="p-4 space-y-2">
        <Button onClick={handleEnrich} disabled={enriching} size="sm" variant="outline"
          className="w-full border-white/[0.08] text-slate-300 hover:text-white text-xs">
          {enriching ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <RefreshCw className="w-3 h-3 mr-1.5" />}
          {enriching ? "Enriching..." : "AI Enrich Lead"}
        </Button>

        <Button onClick={handleGenerateOutreach} disabled={generating} size="sm"
          className="w-full bg-violet-600/80 hover:bg-violet-600 text-white text-xs">
          {generating ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Zap className="w-3 h-3 mr-1.5" />}
          {generating ? "Generating..." : "Generate Outreach"}
        </Button>
      </div>

      {/* Outreach Preview */}
      {outreach && (
        <div className="p-4 border-t border-white/[0.06] flex-1 overflow-y-auto">
          <button onClick={() => setShowOutreach(!showOutreach)}
            className="flex items-center justify-between w-full text-xs font-semibold text-slate-300 mb-3">
            <span>Outreach Messages</span>
            {showOutreach ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>

          {showOutreach && (
            <div className="space-y-3">
              {outreach.subject_variants?.length > 0 && (
                <div>
                  <p className="text-[10px] text-slate-600 mb-1">Subject Lines</p>
                  {outreach.subject_variants.map((s, i) => (
                    <p key={i} className="text-[10px] text-slate-400 py-0.5">{i + 1}. {s}</p>
                  ))}
                </div>
              )}
              {outreach.primary_message && (
                <div>
                  <p className="text-[10px] text-slate-600 mb-1">Primary Email</p>
                  <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3 text-[10px] text-slate-400 leading-relaxed max-h-40 overflow-y-auto whitespace-pre-wrap">
                    {outreach.primary_message}
                  </div>
                </div>
              )}
              {lead.email && (
                <Button onClick={handleSend} disabled={sending} size="sm"
                  className="w-full bg-emerald-600/80 hover:bg-emerald-600 text-white text-xs">
                  {sending ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Send className="w-3 h-3 mr-1.5" />}
                  {sending ? "Sending..." : "Send to " + lead.email}
                </Button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
