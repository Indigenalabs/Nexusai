import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Brain, Loader2, Sparkles } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";

export default function AIIntegrationBuilder({ open, onClose }) {
  const [formData, setFormData] = useState({
    apiName: "",
    apiDocUrl: "",
    apiDescription: ""
  });

  const queryClient = useQueryClient();

  const buildMutation = useMutation({
    mutationFn: async (data) => {
      const response = await base44.functions.invoke('aiIntegrationBuilder', data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations"] });
      onClose();
      setFormData({ apiName: "", apiDocUrl: "", apiDescription: "" });
    }
  });

  const handleBuild = () => {
    buildMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-xl bg-[hsl(222,42%,8%)] border-white/[0.1]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Brain className="w-5 h-5 text-violet-400" />
            AI Integration Builder
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
            <div className="flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-violet-400 mt-0.5" />
              <p className="text-xs text-slate-300">
                Provide an API name and documentation URL. Our AI will analyze it and automatically 
                generate a complete integration configuration with endpoints, authentication, and usage examples.
              </p>
            </div>
          </div>

          <div>
            <Label className="text-slate-300">API Name</Label>
            <Input
              value={formData.apiName}
              onChange={(e) => setFormData({ ...formData, apiName: e.target.value })}
              placeholder="e.g., Stripe, Mailchimp, Shopify"
              className="bg-white/[0.04] border-white/[0.08] text-white"
            />
          </div>

          <div>
            <Label className="text-slate-300">API Documentation URL (optional)</Label>
            <Input
              value={formData.apiDocUrl}
              onChange={(e) => setFormData({ ...formData, apiDocUrl: e.target.value })}
              placeholder="https://docs.example.com/api"
              className="bg-white/[0.04] border-white/[0.08] text-white"
            />
          </div>

          <div>
            <Label className="text-slate-300">Description</Label>
            <Textarea
              value={formData.apiDescription}
              onChange={(e) => setFormData({ ...formData, apiDescription: e.target.value })}
              placeholder="What does this API do? What features do you want to integrate?"
              className="bg-white/[0.04] border-white/[0.08] text-white h-24"
            />
          </div>

          <div className="flex gap-2 pt-4">
            <Button 
              onClick={onClose} 
              variant="outline" 
              className="flex-1 border-white/[0.1] text-white"
              disabled={buildMutation.isPending}
            >
              Cancel
            </Button>
            <Button 
              onClick={handleBuild} 
              className="flex-1 bg-violet-600 hover:bg-violet-700"
              disabled={!formData.apiName || buildMutation.isPending}
            >
              {buildMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Building...
                </>
              ) : (
                <>
                  <Brain className="w-4 h-4 mr-2" />
                  Build Integration
                </>
              )}
            </Button>
          </div>

          {buildMutation.isError && (
            <p className="text-xs text-red-400">Error: {buildMutation.error.message}</p>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}