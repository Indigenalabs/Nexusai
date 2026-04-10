import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Video, Upload, Sparkles, Loader2, CheckCircle2
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

const PLATFORMS = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "facebook", label: "Facebook" },
  { id: "linkedin", label: "LinkedIn" },
];

const CONTENT_TYPES = [
  { id: "reel", label: "Reel / Short", icon: "🎬" },
  { id: "post", label: "Picture Post", icon: "📸" },
  { id: "carousel", label: "Carousel", icon: "🎠" },
  { id: "story", label: "Story", icon: "⚡" },
  { id: "flyer", label: "Flyer", icon: "📄" },
];

export default function VideoReelGenerator({ assets }) {
  const [selectedAssets, setSelectedAssets] = useState([]);
  const [selectedPlatforms, setSelectedPlatforms] = useState(["instagram"]);
  const [selectedContentType, setSelectedContentType] = useState("reel");
  const [quantity, setQuantity] = useState(5);
  const [generatedPosts, setGeneratedPosts] = useState([]);
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const videos = assets.filter(a => a.type === 'video');
  const images = assets.filter(a => a.type === 'image');

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files);
    setUploading(true);
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      const analysis = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this video/image for social media content creation. Describe: what's happening, the mood, colors, people/objects, and 5 specific content angles this could be used for as a reel.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            description: { type: "string" },
            suggested_tags: { type: "array", items: { type: "string" } },
            category: { type: "string" },
            content_angles: { type: "array", items: { type: "string" } }
          }
        }
      });
      await base44.entities.ContentAsset.create({
        name: file.name,
        type: file.type.startsWith('video/') ? 'video' : 'image',
        file_url,
        ai_description: analysis.description,
        tags: analysis.suggested_tags,
        category: analysis.category || 'other'
      });
    }
    queryClient.invalidateQueries({ queryKey: ["content-assets"] });
    setUploading(false);
  };

  const generateMutation = useMutation({
    mutationFn: async () => {
      const ids = selectedAssets.length > 0 ? selectedAssets : assets.slice(0, 3).map(a => a.id);
      const { data } = await base44.functions.invoke('generateContentFromMedia', {
        assetIds: ids,
        contentType: selectedContentType,
        platform: selectedPlatforms,
        tone: 'engaging',
        quantity
      });
      return data;
    },
    onSuccess: (data) => {
      setGeneratedPosts(data.posts || []);
      queryClient.invalidateQueries({ queryKey: ["social-posts"] });
    }
  });

  const toggleAsset = (id) => {
    setSelectedAssets(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const togglePlatform = (id) => {
    setSelectedPlatforms(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Upload className="w-4 h-4 text-blue-400" /> Upload Videos
            </h3>
            <label className="block w-full cursor-pointer">
              <input type="file" multiple accept="video/*,image/*" onChange={handleUpload} className="hidden" disabled={uploading} />
              <div className="border-2 border-dashed border-white/[0.1] rounded-xl p-6 text-center hover:border-violet-500/50 hover:bg-violet-500/5 transition-all">
                {uploading ? (
                  <div className="flex flex-col items-center gap-2">
                    <Loader2 className="w-8 h-8 text-violet-400 animate-spin" />
                    <p className="text-xs text-slate-400">Analyzing with AI...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2">
                    <Video className="w-8 h-8 text-slate-600" />
                    <p className="text-xs text-slate-500">Drop videos here or click to upload</p>
                    <p className="text-[10px] text-slate-600">Nexus will analyze and extract multiple reel ideas</p>
                  </div>
                )}
              </div>
            </label>
          </div>

          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Content Type</h3>
            <div className="flex flex-wrap gap-2">
              {CONTENT_TYPES.map(ct => (
                <button
                  key={ct.id}
                  onClick={() => setSelectedContentType(ct.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    selectedContentType === ct.id
                      ? 'bg-pink-500/20 border-pink-500/40 text-pink-300'
                      : 'bg-white/[0.03] border-white/[0.08] text-slate-400 hover:text-slate-300'
                  }`}
                >
                  {ct.icon} {ct.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Target Platforms</h3>
            <div className="flex flex-wrap gap-2">
              {PLATFORMS.map(p => (
                <button
                  key={p.id}
                  onClick={() => togglePlatform(p.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    selectedPlatforms.includes(p.id)
                      ? 'bg-violet-500/20 border-violet-500/40 text-violet-300'
                      : 'bg-white/[0.03] border-white/[0.08] text-slate-400 hover:text-slate-300'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
            <h3 className="text-sm font-semibold text-white mb-3">Content Variations</h3>
            <div className="flex gap-2">
              {[3, 5, 8, 10].map(n => (
                <button
                  key={n}
                  onClick={() => setQuantity(n)}
                  className={`flex-1 py-2 rounded-lg text-sm font-bold border transition-all ${
                    quantity === n
                      ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                      : 'bg-white/[0.03] border-white/[0.08] text-slate-400'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={() => generateMutation.mutate()}
            disabled={generateMutation.isPending || assets.length === 0}
            className="w-full bg-gradient-to-r from-violet-600 to-pink-600 hover:from-violet-500 hover:to-pink-500 h-11"
          >
            {generateMutation.isPending ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating {quantity} Ideas...</>
            ) : (
              <><Sparkles className="w-4 h-4 mr-2" /> Generate {quantity} {CONTENT_TYPES.find(c=>c.id===selectedContentType)?.label || 'Content'} Ideas</>
            )}
          </Button>
        </div>

        <div className="lg:col-span-2 space-y-4">
          <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5">
            <h3 className="text-sm font-semibold text-white mb-3">
              Select Media <span className="text-slate-500 text-xs font-normal">(or leave empty to use all videos)</span>
            </h3>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-48 overflow-y-auto">
              {[...videos, ...images].map(asset => (
                <button
                  key={asset.id}
                  onClick={() => toggleAsset(asset.id)}
                  className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                    selectedAssets.includes(asset.id) ? 'border-violet-500' : 'border-transparent'
                  }`}
                >
                  {asset.type === 'image' ? (
                    <img src={asset.file_url} alt={asset.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                      <Video className="w-6 h-6 text-violet-400" />
                    </div>
                  )}
                  {selectedAssets.includes(asset.id) && (
                    <div className="absolute inset-0 bg-violet-500/20 flex items-center justify-center">
                      <CheckCircle2 className="w-5 h-5 text-violet-300" />
                    </div>
                  )}
                </button>
              ))}
              {assets.length === 0 && (
                <div className="col-span-4 text-center py-8 text-slate-500 text-xs">
                  Upload videos or images first
                </div>
              )}
            </div>
          </div>

          <AnimatePresence>
            {generatedPosts.length > 0 && (
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  <h3 className="text-sm font-semibold text-white">{generatedPosts.length} Drafts Created</h3>
                  <Button size="sm" variant="outline" className="ml-auto h-7 text-xs border-white/[0.1] text-slate-400" onClick={() => navigate(createPageUrl('SocialScheduler'))}>
                    View in Scheduler
                  </Button>
                </div>
                {generatedPosts.slice(0, 3).map((post, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-pink-500/15 text-pink-400 text-[10px] capitalize">{post.platform}</Badge>
                        <Badge className="bg-violet-500/15 text-violet-400 text-[10px]">{post.content_type || 'reel'}</Badge>
                      </div>
                      {post.ai_score && (
                        <span className={`text-xs font-bold ${post.ai_score >= 80 ? 'text-emerald-400' : 'text-amber-400'}`}>
                          {post.ai_score}/100
                        </span>
                      )}
                    </div>
                    {post.idea?.hook && (
                      <p className="text-xs text-violet-300 mb-1 font-medium">Hook: "{post.idea.hook}"</p>
                    )}
                    <p className="text-xs text-slate-300 line-clamp-2">{post.content}</p>
                    {post.hashtags?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {post.hashtags.slice(0, 5).map((tag, j) => (
                          <span key={j} className="text-[10px] text-blue-400">{tag}</span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}