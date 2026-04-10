import React, { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2 } from "lucide-react";

export default function CustomIntegrationForm({ open, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "custom",
    api_config: {
      base_url: "",
      auth_type: "api_key",
      auth_header: "X-API-Key",
      secret_name: "",
      endpoints: []
    }
  });

  const [endpoint, setEndpoint] = useState({ name: "", method: "GET", path: "", description: "" });

  const addEndpoint = () => {
    if (endpoint.name && endpoint.path) {
      setFormData({
        ...formData,
        api_config: {
          ...formData.api_config,
          endpoints: [...formData.api_config.endpoints, endpoint]
        }
      });
      setEndpoint({ name: "", method: "GET", path: "", description: "" });
    }
  };

  const removeEndpoint = (index) => {
    const newEndpoints = formData.api_config.endpoints.filter((_, i) => i !== index);
    setFormData({
      ...formData,
      api_config: { ...formData.api_config, endpoints: newEndpoints }
    });
  };

  const handleSubmit = () => {
    onSubmit({ 
      ...formData, 
      integration_type: 'custom',
      status: 'disconnected',
      function_name: 'universalApiCaller'
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto bg-[hsl(222,42%,8%)] border-white/[0.1]">
        <DialogHeader>
          <DialogTitle className="text-white">Add Custom Integration</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-slate-300">Integration Name</Label>
            <Input
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g., My CRM"
              className="bg-white/[0.04] border-white/[0.08] text-white"
            />
          </div>

          <div>
            <Label className="text-slate-300">Description</Label>
            <Textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="What does this integration do?"
              className="bg-white/[0.04] border-white/[0.08] text-white"
            />
          </div>

          <div>
            <Label className="text-slate-300">Category</Label>
            <Select 
              value={formData.category} 
              onValueChange={(value) => setFormData({ ...formData, category: value })}
            >
              <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="custom">Custom</SelectItem>
                <SelectItem value="crm">CRM</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="accounting">Accounting</SelectItem>
                <SelectItem value="project_management">Project Management</SelectItem>
                <SelectItem value="social">Social</SelectItem>
                <SelectItem value="analytics">Analytics</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="border-t border-white/[0.1] pt-4">
            <h4 className="text-sm font-semibold text-white mb-3">API Configuration</h4>
            
            <div className="space-y-3">
              <div>
                <Label className="text-slate-300">Base URL</Label>
                <Input
                  value={formData.api_config.base_url}
                  onChange={(e) => setFormData({
                    ...formData,
                    api_config: { ...formData.api_config, base_url: e.target.value }
                  })}
                  placeholder="https://api.example.com"
                  className="bg-white/[0.04] border-white/[0.08] text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-slate-300">Auth Type</Label>
                  <Select 
                    value={formData.api_config.auth_type}
                    onValueChange={(value) => setFormData({
                      ...formData,
                      api_config: { ...formData.api_config, auth_type: value }
                    })}
                  >
                    <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="api_key">API Key</SelectItem>
                      <SelectItem value="bearer_token">Bearer Token</SelectItem>
                      <SelectItem value="basic_auth">Basic Auth</SelectItem>
                      <SelectItem value="oauth2">OAuth 2.0</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label className="text-slate-300">Auth Header</Label>
                  <Input
                    value={formData.api_config.auth_header}
                    onChange={(e) => setFormData({
                      ...formData,
                      api_config: { ...formData.api_config, auth_header: e.target.value }
                    })}
                    placeholder="X-API-Key"
                    className="bg-white/[0.04] border-white/[0.08] text-white"
                  />
                </div>
              </div>

              <div>
                <Label className="text-slate-300">Secret Name (in environment variables)</Label>
                <Input
                  value={formData.api_config.secret_name}
                  onChange={(e) => setFormData({
                    ...formData,
                    api_config: { ...formData.api_config, secret_name: e.target.value }
                  })}
                  placeholder="MY_API_KEY"
                  className="bg-white/[0.04] border-white/[0.08] text-white"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-white/[0.1] pt-4">
            <h4 className="text-sm font-semibold text-white mb-3">Endpoints</h4>
            
            {formData.api_config.endpoints.map((ep, i) => (
              <div key={i} className="flex items-center gap-2 mb-2 p-2 rounded bg-white/[0.04]">
                <span className="text-xs text-blue-400 font-mono">{ep.method}</span>
                <span className="text-xs text-white flex-1">{ep.name} - {ep.path}</span>
                <Button 
                  size="sm" 
                  variant="ghost" 
                  onClick={() => removeEndpoint(i)}
                  className="text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}

            <div className="grid grid-cols-2 gap-2 mb-2">
              <Input
                value={endpoint.name}
                onChange={(e) => setEndpoint({ ...endpoint, name: e.target.value })}
                placeholder="Endpoint name"
                className="bg-white/[0.04] border-white/[0.08] text-white text-xs"
              />
              <div className="flex gap-2">
                <Select 
                  value={endpoint.method}
                  onValueChange={(value) => setEndpoint({ ...endpoint, method: value })}
                >
                  <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Input
              value={endpoint.path}
              onChange={(e) => setEndpoint({ ...endpoint, path: e.target.value })}
              placeholder="/api/v1/resource"
              className="bg-white/[0.04] border-white/[0.08] text-white text-xs mb-2"
            />
            <Button 
              size="sm" 
              variant="outline" 
              onClick={addEndpoint}
              className="w-full border-white/[0.1] text-white hover:bg-white/[0.05]"
            >
              <Plus className="w-3 h-3 mr-1" /> Add Endpoint
            </Button>
          </div>

          <div className="flex gap-2 pt-4">
            <Button onClick={onClose} variant="outline" className="flex-1 border-white/[0.1] text-white">
              Cancel
            </Button>
            <Button onClick={handleSubmit} className="flex-1 bg-blue-600 hover:bg-blue-700">
              Create Integration
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}