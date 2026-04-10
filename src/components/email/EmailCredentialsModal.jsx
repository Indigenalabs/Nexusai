import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { X, Mail, HardDrive, CheckCircle, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";

export default function EmailCredentialsModal({ open, onClose }) {
  const [creds, setCreds] = useState({
    gmail_access_token: "",
    google_drive_token: "",
    outlook_access_token: "",
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      base44.auth.me().then(u => {
        setCreds({
          gmail_access_token: u?.gmail_access_token || "",
          google_drive_token: u?.google_drive_token || "",
          outlook_access_token: u?.outlook_access_token || "",
        });
      }).catch(() => {});
    }
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    await base44.auth.updateMe(creds);
    setSaved(true);
    setSaving(false);
    setTimeout(() => setSaved(false), 2000);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-[hsl(222,42%,8%)] rounded-2xl border border-white/[0.1] p-6 max-w-lg w-full"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-lg font-bold text-white">Connect Email & Storage</h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 flex gap-2">
          <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300">
            Paste your OAuth access tokens below. Each business connects their own accounts.{" "}
            <a href="https://developers.google.com/oauthplayground" target="_blank" rel="noopener noreferrer" className="underline">
              Get tokens here
            </a>
          </p>
        </div>

        <div className="space-y-5">
          {/* Gmail */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-4 h-4 text-red-400" />
              <span className="text-sm font-medium text-white">Gmail</span>
              {creds.gmail_access_token && <CheckCircle className="w-3.5 h-3.5 text-emerald-400 ml-auto" />}
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-400">Gmail OAuth Access Token</Label>
              <Input
                type="password"
                value={creds.gmail_access_token}
                onChange={e => setCreds({ ...creds, gmail_access_token: e.target.value })}
                placeholder="ya29.xxxxxxxx..."
                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-600 font-mono text-xs"
              />
              <p className="text-[10px] text-slate-500">Requires: gmail.readonly, gmail.send, gmail.modify scopes</p>
            </div>
          </div>

          {/* Google Drive */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-3">
              <HardDrive className="w-4 h-4 text-blue-400" />
              <span className="text-sm font-medium text-white">Google Drive</span>
              {creds.google_drive_token && <CheckCircle className="w-3.5 h-3.5 text-emerald-400 ml-auto" />}
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-400">Google Drive OAuth Access Token</Label>
              <Input
                type="password"
                value={creds.google_drive_token}
                onChange={e => setCreds({ ...creds, google_drive_token: e.target.value })}
                placeholder="ya29.xxxxxxxx..."
                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-600 font-mono text-xs"
              />
              <p className="text-[10px] text-slate-500">Requires: drive.file scope — auto-organises into Invoices, Contracts, Reports, Proposals</p>
            </div>
          </div>

          {/* Outlook */}
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <div className="flex items-center gap-2 mb-3">
              <Mail className="w-4 h-4 text-blue-500" />
              <span className="text-sm font-medium text-white">Outlook / Microsoft 365</span>
              {creds.outlook_access_token && <CheckCircle className="w-3.5 h-3.5 text-emerald-400 ml-auto" />}
            </div>
            <div className="space-y-2">
              <Label className="text-xs text-slate-400">Microsoft Graph Access Token</Label>
              <Input
                type="password"
                value={creds.outlook_access_token}
                onChange={e => setCreds({ ...creds, outlook_access_token: e.target.value })}
                placeholder="eyJ0eXAiOiJKV1Qi..."
                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-600 font-mono text-xs"
              />
              <p className="text-[10px] text-slate-500">Requires: Mail.Read, Mail.Send scopes</p>
            </div>
          </div>
        </div>

        <div className="flex gap-2 mt-6">
          <Button onClick={onClose} variant="ghost" className="flex-1 text-slate-400">Cancel</Button>
          <Button
            onClick={handleSave}
            disabled={saving}
            className="flex-1 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500"
          >
            {saved ? <><CheckCircle className="w-4 h-4 mr-2" /> Saved!</> : saving ? "Saving..." : "Save Credentials"}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}