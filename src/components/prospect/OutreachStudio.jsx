import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, Zap, Mail, Copy, CheckCircle2 } from "lucide-react";

export default function OutreachStudio({ leads }) {
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [channel, setChannel] = useState("email");
  const [tone, setTone] = useState("professional");
  const [generating, setGenerating] = useState(false);
  const [outreach, setOutreach] = useState(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(null);
  const [nurtureSegment, setNurtureSegment] = useState("");
  const [nurturePain, setNurturePain] = useState("");
  const [nurtureWeeks, setNurtureWeeks] = useState("6");
  const [generatingNurture, setGeneratingNurture] = useState(false);
  const [nurtureSeq, setNurtureSeq] = useState(null);

  const selectedLead = leads.find(l => l.id === selectedLeadId);

  const generate = async () => {
    if (!selectedLeadId) return;
    setGenerating(true);
    setOutreach(null);
    const res = await base44.functions.invoke('prospectLeadGeneration', {
      action: 'generate_outreach', lead_id: selectedLeadId, channel, tone
    });
    setOutreach(res.data?.outreach);
    setGenerating(false);
  };

  const send = async () => {
    if (!outreach || !selectedLead?.email) return;
    setSending(true);
    await base44.functions.invoke('prospectLeadGeneration', {
      action: 'send_outreach', lead_id: selectedLeadId,
      subject: outreach.subject_variants?.[0] || "Following up",
      body: outreach.primary_message
    });
    setSending(false);
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  };

  const copy = (text, key) => {
    navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  const generateNurture = async () => {
    if (!nurtureSegment || !nurturePain) return;
    setGeneratingNurture(true);
    const res = await base44.functions.invoke('prospectLeadGeneration', {
      action: 'generate_nurture_sequence',
      segment: nurtureSegment, pain_point: nurturePain, duration_weeks: parseInt(nurtureWeeks)
    });
    setNurtureSeq(res.data?.sequence);
    setGeneratingNurture(false);
  };

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Left — Single Outreach Generator */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white mb-1">Personalized Outreach Generator</h3>
          <p className="text-xs text-slate-500">Generate multi-channel outreach with A/B subject lines and follow-ups</p>
        </div>

        <Select value={selectedLeadId} onValueChange={setSelectedLeadId}>
          <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-slate-300 text-xs">
            <SelectValue placeholder="Select a lead..." />
          </SelectTrigger>
          <SelectContent>
            {leads.map(l => (
              <SelectItem key={l.id} value={l.id} className="text-xs">
                {l.first_name} {l.last_name} — {l.company} ({l.score || 0} pts)
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="grid grid-cols-2 gap-3">
          <Select value={channel} onValueChange={setChannel}>
            <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-slate-300 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">Email</SelectItem>
              <SelectItem value="linkedin">LinkedIn</SelectItem>
              <SelectItem value="sms">SMS</SelectItem>
              <SelectItem value="phone">Phone Script</SelectItem>
            </SelectContent>
          </Select>
          <Select value={tone} onValueChange={setTone}>
            <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-slate-300 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="professional">Professional</SelectItem>
              <SelectItem value="warm">Warm & Friendly</SelectItem>
              <SelectItem value="direct">Direct & Concise</SelectItem>
              <SelectItem value="consultative">Consultative</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={generate} disabled={generating || !selectedLeadId}
          className="w-full bg-violet-600 hover:bg-violet-500 text-white text-xs">
          {generating ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Zap className="w-3 h-3 mr-1.5" />}
          {generating ? "Generating..." : "Generate Outreach Suite"}
        </Button>

        {outreach && (
          <div className="space-y-3">
            {outreach.subject_variants?.length > 0 && (
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
                <p className="text-[10px] text-slate-600 uppercase tracking-wider mb-2">Subject Lines (A/B/C)</p>
                {outreach.subject_variants.map((s, i) => (
                  <div key={i} className="flex items-center justify-between gap-2 py-1">
                    <p className="text-xs text-slate-300">{i + 1}. {s}</p>
                    <button onClick={() => copy(s, `sub-${i}`)} className="flex-shrink-0 text-slate-600 hover:text-slate-300">
                      {copied === `sub-${i}` ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {outreach.primary_message && (
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider">Primary Message</p>
                  <button onClick={() => copy(outreach.primary_message, 'primary')} className="text-slate-600 hover:text-slate-300">
                    {copied === 'primary' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
                <p className="text-xs text-slate-400 leading-relaxed whitespace-pre-wrap max-h-32 overflow-y-auto">{outreach.primary_message}</p>
              </div>
            )}

            {outreach.followup_day3 && (
              <div className="bg-white/[0.02] border border-white/[0.06] rounded-lg p-3">
                <div className="flex items-center justify-between mb-1">
                  <p className="text-[10px] text-slate-600 uppercase tracking-wider">Follow-up Day 3</p>
                  <button onClick={() => copy(outreach.followup_day3, 'fu3')} className="text-slate-600 hover:text-slate-300">
                    {copied === 'fu3' ? <CheckCircle2 className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  </button>
                </div>
                <p className="text-xs text-slate-500 whitespace-pre-wrap max-h-20 overflow-y-auto">{outreach.followup_day3}</p>
              </div>
            )}

            {selectedLead?.email && (
              <Button onClick={send} disabled={sending || sent}
                className={`w-full text-white text-xs ${sent ? 'bg-emerald-600' : 'bg-slate-700 hover:bg-slate-600'}`}>
                {sending ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : sent ? <CheckCircle2 className="w-3 h-3 mr-1.5" /> : <Send className="w-3 h-3 mr-1.5" />}
                {sent ? "Sent!" : sending ? "Sending..." : `Send to ${selectedLead.email}`}
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Right — Nurture Sequence Builder */}
      <div className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-white mb-1">Nurture Sequence Builder</h3>
          <p className="text-xs text-slate-500">Build multi-week drip sequences for any segment</p>
        </div>

        <Input value={nurtureSegment} onChange={e => setNurtureSegment(e.target.value)}
          placeholder="Segment (e.g., NDIS families, plan managers, warm leads)"
          className="bg-white/[0.04] border-white/[0.08] text-slate-300 placeholder:text-slate-600 text-xs" />
        <Input value={nurturePain} onChange={e => setNurturePain(e.target.value)}
          placeholder="Primary pain point (e.g., finding reliable support workers)"
          className="bg-white/[0.04] border-white/[0.08] text-slate-300 placeholder:text-slate-600 text-xs" />

        <div className="flex gap-3 items-center">
          <Select value={nurtureWeeks} onValueChange={setNurtureWeeks}>
            <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-slate-300 text-xs w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {["2", "4", "6", "8", "12"].map(w => <SelectItem key={w} value={w}>{w} weeks</SelectItem>)}
            </SelectContent>
          </Select>
          <Button onClick={generateNurture} disabled={generatingNurture || !nurtureSegment || !nurturePain}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white text-xs">
            {generatingNurture ? <Loader2 className="w-3 h-3 animate-spin mr-1.5" /> : <Mail className="w-3 h-3 mr-1.5" />}
            {generatingNurture ? "Building..." : "Build Sequence"}
          </Button>
        </div>

        {nurtureSeq?.sequence && (
          <div className="bg-white/[0.02] border border-white/[0.06] rounded-xl overflow-hidden">
            <div className="p-3 border-b border-white/[0.06]">
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Generated Sequence ({nurtureSeq.sequence.length} touchpoints)</p>
            </div>
            <div className="max-h-80 overflow-y-auto divide-y divide-white/[0.04]">
              {nurtureSeq.sequence.map((step, i) => (
                <div key={i} className="p-3">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-300">Week {step.week}, Day {step.day}</span>
                    <span className="text-[9px] text-slate-600">{step.channel}</span>
                  </div>
                  {step.subject && <p className="text-xs font-medium text-slate-300 mb-0.5">{step.subject}</p>}
                  <p className="text-[10px] text-slate-500 leading-relaxed line-clamp-2">{step.content}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}