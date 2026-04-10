import React, { useState } from "react";
import AgentPanel from "@/components/agents/AgentPanel";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Sparkles, Copy, Calendar, Instagram, Linkedin, 
  Twitter, Facebook, ArrowLeft, Loader2, Wand2, Upload, 
  Image as ImageIcon, FolderOpen
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const platforms = [
  { id: "instagram", icon: Instagram, color: "text-pink-400" },
  { id: "linkedin", icon: Linkedin, color: "text-blue-400" },
  { id: "twitter", icon: Twitter, color: "text-cyan-400" },
  { id: "facebook", icon: Facebook, color: "text-blue-500" },
];

const CONTENT_FORMATS = [
  { id: "social_post", label: "Social Post" },
  { id: "blog_article", label: "Blog Article" },
  { id: "email_campaign", label: "Email Campaign" },
  { id: "ad_copy", label: "Ad Copy" },
  { id: "video_script", label: "Video Script" },
];

export default function ContentCreator() {
  const [prompt, setPrompt] = useState("");
  const [platform, setPlatform] = useState("instagram");
  const [tone, setTone] = useState("professional");
  const [contentFormat, setContentFormat] = useState("social_post");
  const [generating, setGenerating] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [showAssetPicker, setShowAssetPicker] = useState(false);
  const queryClient = useQueryClient();

  const { data: assets = [] } = useQuery({
    queryKey: ["content-assets"],
    queryFn: () => base44.entities.ContentAsset.list("-created_date", 20)
  });

  const generateMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.integrations.Core.InvokeLLM({
        prompt: `Create a ${tone} ${contentFormat.replace("_", " ")} for ${platform} about: ${prompt}. 
        ${contentFormat === "social_post" ? "Include engaging copy, relevant emojis, and 5-8 hashtags." : ""}
        ${contentFormat === "blog_article" ? "Write a full blog article with headline, intro, 3-4 body sections, and conclusion." : ""}
        ${contentFormat === "email_campaign" ? "Write a compelling email with subject line, preview text, body copy, and CTA." : ""}
        ${contentFormat === "ad_copy" ? "Write primary text, headline, description and CTA for a high-converting ad." : ""}
        ${contentFormat === "video_script" ? "Write a video script with hook, main content sections, and outro CTA." : ""}
        Format as JSON with fields: content, hashtags (array, can be empty for non-social formats).`,
        response_json_schema: {
          type: "object",
          properties: {
            content: { type: "string" },
            hashtags: { type: "array", items: { type: "string" } }
          }
        }
      });
      return response;
    },
    onSuccess: (data) => {
      setGenerated(data);
    },
  });

  const saveMutation = useMutation({
    mutationFn: (data) => base44.entities.SocialPost.create({
      content: data.content,
      platform,
      hashtags: data.hashtags,
      status: "draft"
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-posts"] });
      setSelectedAssets([]);
    },
  });

  const generateFromAssetsMutation = useMutation({
    mutationFn: async () => {
      const response = await base44.functions.invoke('generateContentFromMedia', {
        assetIds: selectedAssets,
        contentType: 'social_post',
        platform,
        tone,
        additionalContext: prompt
      });
      return response.data;
    },
    onSuccess: (data) => {
      if (data.posts && data.posts.length > 0) {
        setGenerated({
          content: data.posts[0].idea.caption,
          hashtags: data.posts[0].idea.hashtags
        });
      }
      queryClient.invalidateQueries({ queryKey: ["social-posts"] });
    }
  });

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setGenerating(true);
    await generateMutation.mutateAsync();
    setGenerating(false);
  };

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] bg-grid">
      <div className="px-6 lg:px-10 pt-8 pb-10 max-w-6xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Link to={createPageUrl("Dashboard")} className="text-slate-500 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <Wand2 className="w-5 h-5 text-violet-400" />
          <h1 className="text-2xl font-bold text-white">AI Content Creator</h1>
        </div>
        <p className="text-sm text-slate-500 mb-6 ml-8">Generate blogs, email campaigns, ad copy, video scripts & more</p>

        {/* Format selector */}
        <div className="flex gap-2 mb-6 ml-8 flex-wrap">
          {CONTENT_FORMATS.map(f => (
            <button key={f.id} onClick={() => setContentFormat(f.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${contentFormat === f.id ? "bg-violet-500/20 border-violet-500/40 text-violet-300" : "bg-white/[0.03] border-white/[0.08] text-slate-400 hover:text-white"}`}>
              {f.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Input Section */}
          <div className="space-y-6">
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
              <div className="space-y-4">
                {/* Media Assets Picker */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label className="text-xs text-slate-400">Use Your Media (Optional)</Label>
                    <Link to={createPageUrl('ContentBank')}>
                      <Button variant="ghost" size="sm" className="text-xs text-blue-400 hover:text-blue-300 h-6 px-2">
                        <FolderOpen className="w-3 h-3 mr-1" />
                        Content Bank
                      </Button>
                    </Link>
                  </div>
                  
                  {selectedAssets.length > 0 && (
                    <div className="flex flex-wrap gap-2 mb-2">
                      {selectedAssets.map(assetId => {
                        const asset = assets.find(a => a.id === assetId);
                        return asset ? (
                          <Badge key={assetId} variant="outline" className="bg-blue-500/15 text-blue-400 border-blue-500/20 text-[10px]">
                            <ImageIcon className="w-2.5 h-2.5 mr-1" />
                            {asset.name.length > 15 ? asset.name.substring(0, 12) + '...' : asset.name}
                            <button
                              onClick={() => setSelectedAssets(prev => prev.filter(id => id !== assetId))}
                              className="ml-1 hover:text-white"
                            >
                              ×
                            </button>
                          </Badge>
                        ) : null;
                      })}
                    </div>
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowAssetPicker(!showAssetPicker)}
                    className="w-full border-white/[0.1] text-white hover:bg-white/[0.05] h-8 text-xs"
                  >
                    <Upload className="w-3 h-3 mr-2" />
                    {selectedAssets.length > 0 ? `${selectedAssets.length} assets selected` : 'Select media from your bank'}
                  </Button>

                  {showAssetPicker && assets.length > 0 && (
                    <div className="mt-2 p-3 rounded-xl bg-white/[0.04] border border-white/[0.08] max-h-40 overflow-y-auto">
                      <div className="grid grid-cols-4 gap-2">
                        {assets.map(asset => (
                          <button
                            key={asset.id}
                            onClick={() => {
                              if (selectedAssets.includes(asset.id)) {
                                setSelectedAssets(prev => prev.filter(id => id !== asset.id));
                              } else {
                                setSelectedAssets(prev => [...prev, asset.id]);
                              }
                            }}
                            className={`aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                              selectedAssets.includes(asset.id)
                                ? 'border-blue-500'
                                : 'border-white/[0.1] hover:border-white/[0.3]'
                            }`}
                          >
                            {asset.type === 'image' ? (
                              <img src={asset.file_url} alt={asset.name} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                                <ImageIcon className="w-6 h-6 text-slate-600" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <Label className="text-xs text-slate-400 mb-2 block">What do you want to post about?</Label>
                  <Textarea
                    value={prompt}
                    onChange={(e) => setPrompt(e.target.value)}
                    placeholder="e.g. Our new product launch, Q4 results, team achievement..."
                    className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-600 h-32"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-slate-400 mb-2 block">Platform</Label>
                    <Select value={platform} onValueChange={setPlatform}>
                      <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {platforms.map(p => (
                          <SelectItem key={p.id} value={p.id}>
                            <div className="flex items-center gap-2">
                              <p.icon className={`w-3.5 h-3.5 ${p.color}`} />
                              {p.id}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label className="text-xs text-slate-400 mb-2 block">Tone</Label>
                    <Select value={tone} onValueChange={setTone}>
                      <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="professional">Professional</SelectItem>
                        <SelectItem value="casual">Casual</SelectItem>
                        <SelectItem value="enthusiastic">Enthusiastic</SelectItem>
                        <SelectItem value="humorous">Humorous</SelectItem>
                        <SelectItem value="inspirational">Inspirational</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedAssets.length > 0 ? (
                  <Button
                    onClick={async () => {
                      setGenerating(true);
                      await generateFromAssetsMutation.mutateAsync();
                      setGenerating(false);
                    }}
                    disabled={generating}
                    className="w-full bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700"
                  >
                    {generating ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Creating from Media...</>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-2" /> Create from {selectedAssets.length} Asset{selectedAssets.length > 1 ? 's' : ''}</>
                    )}
                  </Button>
                ) : (
                  <Button
                    onClick={handleGenerate}
                    disabled={generating || !prompt.trim()}
                    className="w-full bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500"
                  >
                    {generating ? (
                      <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                    ) : (
                      <><Sparkles className="w-4 h-4 mr-2" /> Generate Content</>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Quick Templates */}
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
              <h3 className="text-sm font-semibold text-white mb-3">Quick Templates</h3>
              <div className="space-y-2">
                {[
                  "Product launch announcement",
                  "Behind-the-scenes content",
                  "Customer testimonial",
                  "Industry insights",
                  "Team milestone celebration"
                ].map((template, i) => (
                  <button
                    key={i}
                    onClick={() => setPrompt(template)}
                    className="w-full text-left px-3 py-2 rounded-lg bg-white/[0.03] hover:bg-white/[0.06] text-xs text-slate-400 hover:text-white transition-all"
                  >
                    {template}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Output Section */}
          <div>
            <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6 min-h-[400px]">
              {!generated ? (
                <div className="flex flex-col items-center justify-center h-full text-center py-20">
                  <Sparkles className="w-12 h-12 text-slate-700 mb-4" />
                  <p className="text-sm text-slate-600">Your AI-generated content will appear here</p>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-white">Generated Content</h3>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => navigator.clipboard.writeText(generated.content)}
                        className="h-7 text-xs"
                      >
                        <Copy className="w-3 h-3 mr-1" /> Copy
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => saveMutation.mutate(generated)}
                        disabled={saveMutation.isPending}
                        className="h-7 text-xs bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Calendar className="w-3 h-3 mr-1" /> Save Draft
                      </Button>
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.06]">
                    <p className="text-sm text-white whitespace-pre-wrap leading-relaxed">
                      {generated.content}
                    </p>
                  </div>

                  {generated.hashtags && generated.hashtags.length > 0 && (
                    <div>
                      <Label className="text-xs text-slate-400 mb-2 block">Hashtags</Label>
                      <div className="flex flex-wrap gap-2">
                        {generated.hashtags.map((tag, i) => (
                          <Badge key={i} variant="outline" className="bg-blue-500/10 text-blue-400 border-blue-500/20">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={() => {
                      setGenerated(null);
                      setPrompt("");
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Generate Another
                  </Button>
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* Agent Panels */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-6">
          <AgentPanel
            agentName="canvas_agent"
            agentLabel="Canvas"
            agentEmoji="🎨"
            accentColor="purple"
            startMessage="I'm on the Content Creator page. Help me think about the visual side — what images, graphics, or visual concepts would make this content more engaging? I can describe what I'm creating."
            quickCommands={[
              { label: "Visual concepts", text: "Suggest visual concepts and image ideas to accompany this content type." },
              { label: "Generate image", text: "I want to generate an AI image for my content. Ask me what the content is about and create a detailed image prompt." },
              { label: "Brand check", text: "Review my brand profile and tell me what visual style I should maintain in my content." },
            ]}
          />
          <AgentPanel
            agentName="maestro_agent"
            agentLabel="Maestro"
            agentEmoji="🎯"
            accentColor="pink"
            startMessage="I'm creating content right now. Give me a quick briefing — what content gaps do we have in our calendar? What topics are trending in our industry that I should create about? Any upcoming campaigns I should align with?"
            quickCommands={[
              { label: "Content calendar gaps", text: "What are the gaps in our content calendar? What should I be creating?" },
              { label: "Trending topics", text: "What topics are trending in our space that I should create content about today?" },
              { label: "Channel optimization", text: "For the platform I'm creating for, what content format and style performs best?" },
              { label: "Full content suite", text: "Create a full multi-platform content suite for my topic. Ask me the topic and I'll produce posts for every major platform with captions, hashtags, and posting times." },
            ]}
          />
          <AgentPanel
            agentName="sentinel_agent"
            agentLabel="Sentinel"
            agentEmoji="🛡️"
            accentColor="red"
            startMessage="I'm about to publish content. Review it for compliance and brand safety — SPAM Act, Privacy Act, NDIS marketing guidelines, misleading advertising, copyright issues, and brand safety standards."
            quickCommands={[
              { label: "Content compliance check", text: "Review this content before I publish it. Check for: misleading claims, SPAM Act compliance, Privacy Act issues, NDIS marketing rules, and brand safety standards. Tell me what to change." },
              { label: "Copyright check", text: "Check my content for potential copyright, trademark, or IP issues before I publish." },
              { label: "Brand safety review", text: "Is this content brand-safe? Check for anything that could create legal, reputational, or regulatory exposure." },
            ]}
          />
        </div>
      </div>
    </div>
  );
}