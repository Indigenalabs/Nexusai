import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload, Image, Video, Disc, Music, Trash2, Eye,
  Sparkles, Download, Search
} from "lucide-react";

const typeIcons = {
  image: Image,
  video: Video,
  logo: Disc,
  audio: Music
};

const typeColors = {
  image: "blue",
  video: "violet",
  logo: "cyan",
  audio: "emerald"
};

export default function ContentBank() {
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [uploading, setUploading] = useState(false);
  const queryClient = useQueryClient();

  const { data: assets = [] } = useQuery({
    queryKey: ["content-assets"],
    queryFn: () => base44.entities.ContentAsset.list("-created_date")
  });

  const uploadMutation = useMutation({
    mutationFn: async (file) => {
      setUploading(true);
      
      // Upload file
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      
      // Use AI to analyze the media
      const analysis = await base44.integrations.Core.InvokeLLM({
        prompt: `Analyze this media asset and provide a brief, descriptive summary of what it shows. 
Be specific about colors, subjects, mood, and potential use cases for social media content.`,
        file_urls: [file_url],
        response_json_schema: {
          type: "object",
          properties: {
            description: { type: "string" },
            suggested_tags: {
              type: "array",
              items: { type: "string" }
            },
            category: { type: "string" }
          }
        }
      });
      
      // Create asset
      const asset = await base44.entities.ContentAsset.create({
        name: file.name,
        type: file.type.startsWith('image/') ? 'image' : 
              file.type.startsWith('video/') ? 'video' : 'clip',
        file_url,
        ai_description: analysis.description,
        tags: analysis.suggested_tags,
        category: analysis.category || 'other'
      });
      
      return asset;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-assets"] });
      setUploading(false);
    },
    onError: () => {
      setUploading(false);
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.ContentAsset.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["content-assets"] });
    }
  });

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files);
    files.forEach(file => uploadMutation.mutate(file));
  };

  const filteredAssets = assets.filter(asset => {
    const matchesFilter = filter === "all" || asset.type === filter;
    const matchesSearch = search === "" || 
      asset.name.toLowerCase().includes(search.toLowerCase()) ||
      asset.ai_description?.toLowerCase().includes(search.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] p-6 lg:p-10">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">Content Bank</h1>
        <p className="text-sm text-slate-500">Your media library for AI-powered content creation</p>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap items-center gap-3 mb-6">
        <label className="cursor-pointer">
          <input
            type="file"
            multiple
            accept="image/*,video/*"
            onChange={handleFileUpload}
            className="hidden"
            disabled={uploading}
          />
          <div className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium flex items-center gap-2 transition-all">
            {uploading ? (
              <>
                <Sparkles className="w-4 h-4 animate-spin" />
                Analyzing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Upload Media
              </>
            )}
          </div>
        </label>

        <div className="flex-1 max-w-sm">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search assets..."
              className="pl-9 bg-white/[0.04] border-white/[0.08] text-white"
            />
          </div>
        </div>
      </div>

      {/* Filters */}
      <Tabs value={filter} onValueChange={setFilter} className="mb-6">
        <TabsList className="bg-white/[0.04]">
          <TabsTrigger value="all">All</TabsTrigger>
          <TabsTrigger value="image">Images</TabsTrigger>
          <TabsTrigger value="video">Videos</TabsTrigger>
          <TabsTrigger value="logo">Logos</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <p className="text-xs text-slate-500 mb-1">Total Assets</p>
          <p className="text-2xl font-bold text-white">{assets.length}</p>
        </div>
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <p className="text-xs text-slate-500 mb-1">Images</p>
          <p className="text-2xl font-bold text-blue-400">{assets.filter(a => a.type === 'image').length}</p>
        </div>
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <p className="text-xs text-slate-500 mb-1">Videos</p>
          <p className="text-2xl font-bold text-violet-400">{assets.filter(a => a.type === 'video').length}</p>
        </div>
        <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
          <p className="text-xs text-slate-500 mb-1">Total Usage</p>
          <p className="text-2xl font-bold text-emerald-400">{assets.reduce((sum, a) => sum + (a.usage_count || 0), 0)}</p>
        </div>
      </div>

      {/* Assets Grid */}
      {filteredAssets.length > 0 ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {filteredAssets.map((asset, i) => {
            const Icon = typeIcons[asset.type] || Image;
            const color = typeColors[asset.type] || "slate";
            
            return (
              <motion.div
                key={asset.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="group rounded-xl bg-white/[0.03] border border-white/[0.06] overflow-hidden hover:border-white/[0.12] transition-all"
              >
                {/* Preview */}
                <div className="aspect-square bg-slate-900 relative overflow-hidden">
                  {asset.type === 'image' ? (
                    <img 
                      src={asset.file_url} 
                      alt={asset.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon className={`w-12 h-12 text-${color}-400`} />
                    </div>
                  )}
                  
                  {/* Overlay Actions */}
                  <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-white hover:bg-white/20"
                      onClick={() => window.open(asset.file_url, '_blank')}
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-white hover:bg-white/20"
                      onClick={() => {
                        const a = document.createElement('a');
                        a.href = asset.file_url;
                        a.download = asset.name;
                        a.click();
                      }}
                    >
                      <Download className="w-4 h-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="text-red-400 hover:bg-red-500/20"
                      onClick={() => deleteMutation.mutate(asset.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                {/* Info */}
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge variant="outline" className={`text-[10px] bg-${color}-500/15 text-${color}-400 border-${color}-500/20`}>
                      {asset.type}
                    </Badge>
                    {asset.usage_count > 0 && (
                      <Badge variant="outline" className="text-[10px]">
                        {asset.usage_count} uses
                      </Badge>
                    )}
                  </div>
                  <h3 className="text-xs font-medium text-white mb-1 truncate">{asset.name}</h3>
                  <p className="text-[10px] text-slate-500 line-clamp-2">{asset.ai_description}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-20">
          <Upload className="w-12 h-12 text-slate-700 mx-auto mb-3" />
          <p className="text-slate-500 text-sm mb-4">No assets yet. Upload your first media file!</p>
          <label className="cursor-pointer">
            <input
              type="file"
              multiple
              accept="image/*,video/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <div className="inline-flex px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium">
              <Upload className="w-4 h-4 mr-2" />
              Upload Media
            </div>
          </label>
        </div>
      )}
    </div>
  );
}