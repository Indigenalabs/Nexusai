import { useState, useEffect, useRef } from "react";
import CanvasAutopilotPanel from "@/components/canvas/CanvasAutopilotPanel";
import AgentPanel from "@/components/agents/AgentPanel";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send, Plus, Loader2, Palette, Image as ImageIcon,
  Zap, Film, Layout, Sparkles, TrendingUp, ChevronRight, Eye, Lightbulb
} from "lucide-react";

const ASSET_TYPE_CONFIG = {
  copy:          { label: "Copy",         color: "text-violet-400", bg: "bg-violet-500/10" },
  image:         { label: "Image",        color: "text-pink-400",   bg: "bg-pink-500/10" },
  image_prompt:  { label: "Image",        color: "text-pink-400",   bg: "bg-pink-500/10" },
  full_post:     { label: "Post",         color: "text-blue-400",   bg: "bg-blue-500/10" },
  headline:      { label: "Headline",     color: "text-amber-400",  bg: "bg-amber-500/10" },
  hashtags:      { label: "Hashtags",     color: "text-slate-400",  bg: "bg-slate-500/10" },
  subject_line:  { label: "Subject",      color: "text-green-400",  bg: "bg-green-500/10" },
  cta:           { label: "CTA",          color: "text-red-400",    bg: "bg-red-500/10" },
  template:      { label: "Template",     color: "text-purple-400", bg: "bg-purple-500/10" },
  social_graphic:{ label: "Social",       color: "text-cyan-400",   bg: "bg-cyan-500/10" },
};

const CAPABILITY_GROUPS = [
  {
    label: "Brand Identity & Audit",
    icon: Palette,
    color: "text-purple-400",
    commands: [
      { label: "Design full brand identity", text: "Design a complete brand identity system for the business — positioning, color palette with hex codes, typography system, logo directions, photography style, and visual dos/don'ts." },
      { label: "Generate brand guidelines", text: "Create comprehensive brand guidelines — logo usage rules, color system, typography hierarchy, imagery guidelines, layout principles, and channel-specific adaptations." },
      { label: "Brand consistency audit", text: "Audit my creative asset library for brand consistency. Rate it, identify the most common deviations, flag assets to refresh, and give me a priority list of improvements." },
      { label: "Color psychology analysis", text: "Analyze my brand color palette for psychological impact, cultural appropriateness, accessibility compliance, and conversion optimization. Recommend any tweaks." },
    ]
  },
  {
    label: "Images & Visual Content",
    icon: ImageIcon,
    color: "text-pink-400",
    commands: [
      { label: "Generate campaign image", text: "Generate a campaign hero image. Ask me about the campaign topic, platform, brand colors, and style preference — then create it." },
      { label: "Product visualization", text: "Create product visualization concepts and generate the hero product image. Ask me for the product name, description, and use case." },
      { label: "Social graphics brief", text: "Design a complete social graphics brief with platform-specific specs, image prompts, and 5 caption variants. Ask me what the post is about." },
      { label: "Background generation", text: "Generate custom backgrounds for product photography or social content. Ask me the style, mood, and context." },
    ]
  },
  {
    label: "Video & Motion",
    icon: Film,
    color: "text-red-400",
    commands: [
      { label: "Full video script + storyboard", text: "Write a complete video script with hook, scene-by-scene breakdown, voiceover, text overlays, music direction, and CTA. Ask me the topic, platform, and duration." },
      { label: "Motion graphics brief", text: "Design a motion graphics brief — animation style, text animation, logo reveal, color transitions. Ask me what it's for." },
      { label: "Repurpose long-form to shorts", text: "Help me repurpose a long-form video into short social clips. Ask me what the content is — then give me the clip strategy, timestamps, and short-form scripts." },
      { label: "AI avatar video script", text: "Write a script for an AI spokesperson/avatar video. Ask me the topic, audience, and tone — then create the full script with delivery notes." },
    ]
  },
  {
    label: "Graphic Design & Layout",
    icon: Layout,
    color: "text-amber-400",
    commands: [
      { label: "Design template system", text: "Design a complete template system for recurring content. Ask me the template type and platform — specify dimensions, fixed elements, variable zones, and layout variations." },
      { label: "Presentation design", text: "Design a slide-by-slide presentation structure with visual direction. Ask me the topic, audience, and number of slides." },
      { label: "Infographic design", text: "Design an infographic concept — narrative structure, section breakdown, chart types, color mapping, and punchy copy. Ask me the topic and data." },
      { label: "Email template design", text: "Design a complete email template brief — layout, header, CTA design, mobile rules, subject lines, and accessibility checklist. Ask me the email type." },
    ]
  },
  {
    label: "Creative Strategy",
    icon: Lightbulb,
    color: "text-yellow-400",
    commands: [
      { label: "Generate campaign concepts", text: "Generate 3 creative campaign concepts with names, taglines, hero visual ideas, and channel execution plans. Ask me the objective and audience." },
      { label: "Expand creative brief", text: "Expand a high-level brief into a full creative direction document — objective, audience, key message, visual direction, deliverables, and success criteria. Give me the brief." },
      { label: "Create mood board", text: "Create a detailed mood board specification — creative territory, color story, photography direction, typography personality, and 4 image prompts. Ask me what it's for." },
      { label: "Competitor creative analysis", text: "Analyze the visual creative of our competitors and identify gaps and opportunities for differentiation. Ask me who our competitors are." },
    ]
  },
  {
    label: "Trends & Performance",
    icon: TrendingUp,
    color: "text-cyan-400",
    commands: [
      { label: "Visual trend forecast", text: "Forecast the top visual design trends right now — what's emerging, what's at peak, what to retire. Focus on color, photography, typography, and motion. Include adoption roadmap." },
      { label: "Creative performance analysis", text: "Analyze my creative asset library performance — what's working, what's missing, what to make next, and creative experiments for the next 30 days." },
      { label: "A/B test plan", text: "Design a rigorous creative A/B test. Ask me what we're testing — then specify control vs. variant, the single variable changed, success metrics, and decision framework." },
      { label: "Seasonal creative adaptation", text: "Adapt our creative assets for an upcoming season, holiday, or cultural moment. Ask me which event and what assets need adapting." },
    ]
  },
];

function AssetCard({ asset, onSelect, selected }) {
  const typeConfig = ASSET_TYPE_CONFIG[asset.asset_type] || ASSET_TYPE_CONFIG[asset.type] || { label: asset.asset_type || "Asset", color: "text-slate-400", bg: "bg-slate-500/10" };
  return (
    <button onClick={() => onSelect(asset)}
      className={`w-full text-left p-2.5 rounded-lg border transition-all ${
        selected ? "bg-purple-500/10 border-purple-500/30" : "bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08]"
      }`}>
      {asset.file_url && (
        <div className="w-full h-20 rounded-md overflow-hidden mb-2 bg-white/[0.03]">
          <img src={asset.file_url} alt={asset.title || "Asset"} className="w-full h-full object-cover" />
        </div>
      )}
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium text-slate-200 truncate flex-1">{asset.title?.slice(0, 60) || asset.content?.slice(0, 60) || "Untitled asset"}</p>
        <span className={`text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0 ${typeConfig.bg} ${typeConfig.color}`}>{typeConfig.label}</span>
      </div>
      {asset.channel && <p className="text-[9px] text-slate-600 mt-0.5">{asset.channel}</p>}
    </button>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Palette className="w-3.5 h-3.5 text-purple-400" />
        </div>
      )}
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
        isUser ? "bg-slate-700 text-white" : "bg-white/[0.05] border border-white/[0.08] text-slate-200"
      }`}>
        {isUser ? (
          <p className="leading-relaxed">{message.content}</p>
        ) : (
          <>
            <ReactMarkdown className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">{message.content}</ReactMarkdown>
            {message.file_urls?.map((url, i) => (
              <img key={i} src={url} alt="Generated" className="mt-3 rounded-xl w-full max-w-sm" />
            ))}
          </>
        )}
      </div>
    </div>
  );
}

export default function Canvas() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [selectedAsset, setSelectedAsset] = useState(null);
  const [activeTab, setActiveTab] = useState("assets");
  const [expandedGroup, setExpandedGroup] = useState(null);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: assets = [], refetch } = useQuery({
    queryKey: ["canvas_assets"],
    queryFn: () => base44.entities.ContentAsset.list("-created_date", 60),
  });

  const images = assets.filter(a => a.file_url);
  const templates = assets.filter(a => a.asset_type === 'template');
  const copy = assets.filter(a => !a.file_url && a.asset_type !== 'template');

  const tabs = [
    { id: "assets", label: "All", count: assets.length },
    { id: "images", label: "Images", count: images.length },
    { id: "copy", label: "Copy", count: copy.length },
    { id: "templates", label: "Templates", count: templates.length },
  ];

  const displayed = activeTab === "images" ? images : activeTab === "copy" ? copy : activeTab === "templates" ? templates : assets;

  useEffect(() => { initConversation(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const initConversation = async () => {
    const conv = await base44.agents.createConversation({
      agent_name: "canvas_agent",
      metadata: { name: "Canvas Session" },
    });
    setConversation(conv);
    base44.agents.subscribeToConversation(conv.id, (data) => {
      setMessages(data.messages || []);
      setIsLoading(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["canvas_assets"] });
    });
  };

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || !conversation) return;
    setInput("");
    setIsLoading(true);
    await base44.agents.addMessage(conversation, { role: "user", content: msg });
  };

  const handleAssetSelect = (asset) => {
    setSelectedAsset(asset);
    sendMessage(`I want to work with this asset: "${asset.title?.slice(0, 80) || asset.content?.slice(0, 80) || "selected asset"}". ${asset.channel ? `Platform: ${asset.channel}.` : ""} ${asset.asset_type ? `Type: ${asset.asset_type}.` : ""} Help me iterate on it, create variations, or repurpose for other platforms.`);
  };

  return (
    <div className="flex h-screen bg-[hsl(222,47%,6%)]">
      {/* Left Panel */}
      <div className="w-72 flex-shrink-0 border-r border-white/[0.06] flex flex-col">
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
              <Palette className="w-4 h-4 text-purple-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Canvas</h2>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
                <span className="text-[10px] text-purple-400">Chief Creative Officer</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: "Total assets",  value: assets.length,     color: "text-purple-400" },
              { label: "Images",        value: images.length,     color: "text-pink-400" },
              { label: "Templates",     value: templates.length,  color: "text-amber-400" },
              { label: "Campaigns",     value: new Set(assets.map(a => a.campaign_id).filter(Boolean)).size, color: "text-blue-400" },
            ].map(s => (
              <div key={s.label} className="bg-white/[0.03] rounded-lg px-2 py-1.5 text-center">
                <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-slate-600">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="px-3 py-2 border-b border-white/[0.06] flex gap-1 flex-wrap">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 text-[10px] py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 min-w-[44px] ${
                activeTab === t.id ? "bg-purple-500/20 text-purple-400 border border-purple-500/30" : "text-slate-600 hover:text-slate-400"
              }`}>
              {t.label}{t.count > 0 && <span className="opacity-70">({t.count})</span>}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {displayed.length === 0 ? (
            <div className="text-center py-10">
              <ImageIcon className="w-6 h-6 text-slate-700 mx-auto mb-2" />
              <p className="text-xs text-slate-600">No assets yet</p>
              <button onClick={() => sendMessage("Generate a hero image for my brand. Ask me about our brand, colors, and what the image is for.")}
                className="mt-1 text-[10px] text-purple-400 hover:underline">Generate first image →</button>
            </div>
          ) : (
            displayed.map(a => (
              <AssetCard key={a.id} asset={a} selected={selectedAsset?.id === a.id} onSelect={handleAssetSelect} />
            ))
          )}
        </div>

        <div className="p-3 border-t border-white/[0.06] space-y-1.5">
          <button onClick={() => sendMessage("Generate a brand image for me. Ask me the topic, platform, style preference, and brand colors.")}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-white/[0.08] text-xs text-slate-600 hover:text-slate-400 hover:border-purple-500/30 transition-all">
            <Sparkles className="w-3 h-3" /> Generate image
          </button>
          <button onClick={() => sendMessage("Audit my brand creative library — rate overall consistency, flag common deviations, and give me the top 5 improvements to make.")}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-white/[0.08] text-xs text-slate-600 hover:text-slate-400 hover:border-purple-500/30 transition-all">
            <Eye className="w-3 h-3" /> Brand audit
          </button>
        </div>
        <CanvasAutopilotPanel onComplete={refetch} />
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">
              {selectedAsset ? `Working on: ${selectedAsset.title?.slice(0, 50) || "asset"}` : "Canvas — Chief Creative Officer"}
            </h1>
            <p className="text-xs text-slate-500">Brand identity · Images · Video · Graphic design · Creative strategy · Trends</p>
          </div>
          <Button size="sm" variant="ghost" onClick={initConversation} className="text-slate-400 hover:text-white text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" /> New Session
          </Button>
        </div>

        {/* Capability Groups */}
        {messages.length === 0 && (
          <div className="px-6 py-4 border-b border-white/[0.06] overflow-y-auto max-h-72">
            <p className="text-xs text-slate-500 mb-3">Canvas capabilities — expand to explore</p>
            <div className="space-y-2">
              {CAPABILITY_GROUPS.map(group => {
                const Icon = group.icon;
                const isExpanded = expandedGroup === group.label;
                return (
                  <div key={group.label} className="rounded-lg border border-white/[0.06] overflow-hidden">
                    <button onClick={() => setExpandedGroup(isExpanded ? null : group.label)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.03] transition-all">
                      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${group.color}`} />
                      <span className="text-xs font-medium text-slate-300 flex-1">{group.label}</span>
                      <ChevronRight className={`w-3 h-3 text-slate-600 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    </button>
                    {isExpanded && (
                      <div className="border-t border-white/[0.06] p-2 space-y-1">
                        {group.commands.map(cmd => (
                          <button key={cmd.label} onClick={() => sendMessage(cmd.text)}
                            className="w-full text-left text-xs px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-slate-400 hover:text-white hover:border-purple-500/20 hover:bg-purple-500/5 transition-all flex items-center gap-2">
                            <Zap className={`w-3 h-3 flex-shrink-0 ${group.color}`} />
                            {cmd.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center mb-4">
                <Palette className="w-8 h-8 text-purple-400" />
              </div>
              <h3 className="text-white font-semibold mb-1">Canvas is ready to create</h3>
              <p className="text-slate-500 text-sm max-w-sm">
                {assets.length > 0
                  ? `${assets.length} assets in your library. Click any asset to iterate, or expand a capability group above.`
                  : "Your creative director is ready. Expand a capability above or just describe what you need — images, video scripts, brand identity, campaign concepts, trend forecasts, and more."}
              </p>
            </div>
          )}
          {messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-purple-500/20 border border-purple-500/30 flex items-center justify-center flex-shrink-0">
                <Palette className="w-3.5 h-3.5 text-purple-400" />
              </div>
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-purple-400 animate-spin" />
                <span className="text-xs text-slate-400">Creating something worth looking at...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-white/[0.06]">
          <div className="flex gap-3 items-end">
            <Textarea value={input} onChange={e => setInput(e.target.value)}
              placeholder="Generate images · Video scripts · Brand identity · Campaign concepts · Templates · Mood boards · Trend forecasts..."
              className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-600 resize-none min-h-[44px] max-h-32 text-sm"
              rows={1}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
            <Button onClick={() => sendMessage()} disabled={!input.trim() || isLoading}
              className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/30 flex-shrink-0" size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-slate-600 mt-2">Enter to send · Click an asset to iterate · Expand capabilities above</p>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-64 flex-shrink-0 border-l border-white/[0.06] flex flex-col gap-2 p-3 overflow-y-auto">
        <p className="text-[10px] text-slate-600 uppercase tracking-wider px-1 pt-1">Connected Agents</p>
        <AgentPanel agentName="maestro_agent" agentLabel="Maestro" agentEmoji="🎼" accentColor="violet"
          quickCommands={[
            { label: "Campaign brief for Canvas", text: "Send Canvas a creative brief for our next campaign. What's the objective, audience, and channels — and what assets do you need?" },
            { label: "A/B creative test", text: "We need to A/B test two creative directions. Brief Canvas on what to produce and coordinate the test." },
          ]} />
        <AgentPanel agentName="compass_agent" agentLabel="Compass" agentEmoji="🧭" accentColor="cyan"
          quickCommands={[
            { label: "Visual trend intelligence", text: "What visual and design trends are emerging in our market? Canvas needs this for creative direction." },
            { label: "Competitor creative analysis", text: "Analyze what our competitors are doing visually. What creative gaps can Canvas exploit?" },
          ]} />
        <AgentPanel agentName="merchant_agent" agentLabel="Merchant" agentEmoji="🛒" accentColor="emerald"
          quickCommands={[
            { label: "Product photography brief", text: "Brief Canvas on product photography needs — which products need new images, what shots are missing, and what the priority is." },
            { label: "Promotional visual assets", text: "We're running a promotion. Brief Canvas on what promotional visuals are needed — banners, social posts, email header." },
          ]} />
        <AgentPanel agentName="scribe_agent" agentLabel="Scribe" agentEmoji="📝" accentColor="blue"
          quickCommands={[
            { label: "Archive creative assets", text: "Archive the latest Canvas creative assets and brand guidelines in the knowledge base with proper tagging." },
            { label: "Brand rationale document", text: "Document the rationale behind our current brand visual direction for future reference." },
          ]} />
      </div>
    </div>
  );
}