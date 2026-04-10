import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  ArrowLeft, Settings as SettingsIcon, Building2,
  Bell, Shield, Save, Loader2, Trash2
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function Settings() {
  const [saving, setSaving] = useState(false);
  const [deleteStep, setDeleteStep] = useState(0);
  const [settings, setSettings] = useState({
    business_name: "",
    industry: "",
    brand_voice: "",
    target_audience: "",
    daily_briefing: true,
    email_notifications: true,
    slack_notifications: false,
    auto_approve_low_risk: false,
    theme: "dark",
  });

  useEffect(() => {
    base44.auth.me().then((u) => {
      if (u?.business_name) {
        setSettings(prev => ({
          ...prev,
          business_name: u.business_name || "",
          industry: u.industry || "",
          brand_voice: u.brand_voice || "",
          target_audience: u.target_audience || "",
          daily_briefing: u.daily_briefing !== false,
          email_notifications: u.email_notifications !== false,
          slack_notifications: u.slack_notifications || false,
          auto_approve_low_risk: u.auto_approve_low_risk || false,
        }));
      }
    }).catch(() => {});
  }, []);

  const handleSave = async () => {
    setSaving(true);
    await base44.auth.updateMe(settings);
    setSaving(false);
  };

  const handleDeleteAccount = async () => {
    if (deleteStep === 1) {
      await base44.auth.deleteMe();
      base44.auth.logout();
    }
  };

  const Section = ({ icon: Icon, title, children, color = "blue" }) => (
    <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6">
      <div className="flex items-center gap-2 mb-5">
        <Icon className={`w-4 h-4 text-${color}-400`} />
        <h3 className="text-sm font-semibold text-white">{title}</h3>
      </div>
      {children}
    </div>
  );

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] bg-grid">
      <div className="px-6 lg:px-10 pt-8 pb-10 max-w-3xl mx-auto">
        <div className="flex items-center gap-3 mb-2">
          <Link to={createPageUrl("Dashboard")} className="text-slate-500 hover:text-white transition-colors">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <SettingsIcon className="w-5 h-5 text-slate-400" />
          <h1 className="text-2xl font-bold text-white">Settings</h1>
        </div>
        <p className="text-sm text-slate-500 mb-8 ml-8">Configure your Nexus AI experience</p>

        <div className="space-y-6">
          {/* Business Profile */}
          <Section icon={Building2} title="Business Profile" color="blue">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-xs text-slate-400">Business Name</Label>
                <Input
                  value={settings.business_name}
                  onChange={(e) => setSettings({...settings, business_name: e.target.value})}
                  placeholder="Your business name"
                  className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-600"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs text-slate-400">Industry</Label>
                <Select value={settings.industry} onValueChange={(v) => setSettings({...settings, industry: v})}>
                  <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white">
                    <SelectValue placeholder="Select industry" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="technology">Technology</SelectItem>
                    <SelectItem value="ecommerce">E-Commerce</SelectItem>
                    <SelectItem value="saas">SaaS</SelectItem>
                    <SelectItem value="agency">Agency</SelectItem>
                    <SelectItem value="consulting">Consulting</SelectItem>
                    <SelectItem value="creator">Content Creator</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2 mt-4">
              <Label className="text-xs text-slate-400">Brand Voice</Label>
              <Textarea
                value={settings.brand_voice}
                onChange={(e) => setSettings({...settings, brand_voice: e.target.value})}
                placeholder="Describe your brand's tone... e.g. Professional yet approachable, data-driven, slightly humorous"
                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-600 h-20"
              />
            </div>
            <div className="space-y-2 mt-4">
              <Label className="text-xs text-slate-400">Target Audience</Label>
              <Input
                value={settings.target_audience}
                onChange={(e) => setSettings({...settings, target_audience: e.target.value})}
                placeholder="e.g. Small business owners, 25-45, tech-savvy"
                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-600"
              />
            </div>
          </Section>

          {/* Notifications */}
          <Section icon={Bell} title="Notifications" color="amber">
            <div className="space-y-4">
              {[
                { key: "daily_briefing", label: "Daily Briefing", desc: "Receive a morning summary of insights and tasks" },
                { key: "email_notifications", label: "Email Notifications", desc: "Get notified about critical events via email" },
                { key: "slack_notifications", label: "Slack Notifications", desc: "Send updates to your Slack workspace" },
              ].map((item) => (
                <div key={item.key} className="flex items-center justify-between py-2">
                  <div>
                    <p className="text-sm text-white font-medium">{item.label}</p>
                    <p className="text-xs text-slate-500">{item.desc}</p>
                  </div>
                  <Switch
                    checked={settings[item.key]}
                    onCheckedChange={(v) => setSettings({...settings, [item.key]: v})}
                  />
                </div>
              ))}
            </div>
          </Section>

          {/* Autonomy */}
          <Section icon={Shield} title="AI Autonomy" color="violet">
            <div className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm text-white font-medium">Auto-approve low-risk actions</p>
                <p className="text-xs text-slate-500">Let Nexus execute tasks like scheduling posts without confirmation</p>
              </div>
              <Switch
                checked={settings.auto_approve_low_risk}
                onCheckedChange={(v) => setSettings({...settings, auto_approve_low_risk: v})}
              />
            </div>
          </Section>

          <div className="flex items-center justify-between">
            <AlertDialog open={deleteStep > 0} onOpenChange={(open) => !open && setDeleteStep(0)}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {deleteStep === 0 ? "Delete Account" : "Confirm Account Deletion"}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {deleteStep === 0 
                      ? "Are you sure you want to delete your account? This action cannot be undone."
                      : "This will permanently delete your account and all associated data. Type 'DELETE' to confirm."
                    }
                  </AlertDialogDescription>
                </AlertDialogHeader>
                {deleteStep === 1 && (
                  <Input
                    placeholder="Type DELETE to confirm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && e.currentTarget.value === "DELETE") {
                        handleDeleteAccount();
                      }
                    }}
                    className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-600"
                  />
                )}
                <div className="flex gap-3 justify-end">
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  {deleteStep === 0 ? (
                    <AlertDialogAction
                      onClick={() => setDeleteStep(1)}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Delete
                    </AlertDialogAction>
                  ) : (
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      className="bg-red-600 hover:bg-red-700"
                    >
                      Delete Account
                    </AlertDialogAction>
                  )}
                </div>
              </AlertDialogContent>
            </AlertDialog>

            <Button
              onClick={() => setDeleteStep(1)}
              variant="outline"
              className="text-red-400 border-red-500/20 hover:bg-red-500/10"
            >
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Account
            </Button>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              <Button
                onClick={handleSave}
                disabled={saving}
                className="bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500 text-white px-6"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                Save Settings
              </Button>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
