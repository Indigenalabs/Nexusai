import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Plus, Trash2, ArrowDown, Zap } from "lucide-react";

const TRIGGERS = [
  { value: "manual", label: "Manual" },
  { value: "schedule", label: "Scheduled" },
  { value: "email_received", label: "Email Received" },
  { value: "new_lead", label: "New Lead Detected" },
  { value: "invoice_overdue", label: "Invoice Overdue" },
];

const ACTIONS = [
  { value: "classify_email", label: "Classify & Summarise Email" },
  { value: "auto_create_lead", label: "Auto-Create CRM Lead" },
  { value: "send_follow_up_email", label: "Send Follow-up Email" },
  { value: "flag_invoice", label: "Flag Overdue Invoice" },
  { value: "schedule_post", label: "Schedule Social Post" },
  { value: "generate_insight", label: "Generate AI Insight" },
  { value: "notify_team", label: "Notify Team" },
  { value: "create_notification", label: "Create System Notification" },
  { value: "update_client_status", label: "Update Client Status" },
  { value: "create_report", label: "Generate Report" },
  { value: "track_metric", label: "Track Metric" },
];

function ActionConfig({ action, index, onUpdate }) {
  const update = (key, value) => onUpdate(index, key, value);

  if (action.type === "send_follow_up_email") return (
    <div className="space-y-2 mt-2">
      <Input placeholder="Recipient Email (e.g., {{client.email}})" value={action.config.recipient_email || ""} onChange={e => update('recipient_email', e.target.value)} className="bg-white/[0.04] border-white/[0.08] text-white text-xs" />
      <Input placeholder="Subject" value={action.config.subject || ""} onChange={e => update('subject', e.target.value)} className="bg-white/[0.04] border-white/[0.08] text-white text-xs" />
      <Textarea placeholder="Body (e.g., Hi {{client.name}}, ...)" value={action.config.body || ""} onChange={e => update('body', e.target.value)} className="bg-white/[0.04] border-white/[0.08] text-white text-xs h-20" />
    </div>
  );

  if (action.type === "notify_team") return (
    <div className="mt-2">
      <Textarea placeholder="Message (e.g., New lead: {{client.name}})" value={action.config.message || ""} onChange={e => update('message', e.target.value)} className="bg-white/[0.04] border-white/[0.08] text-white text-xs h-16" />
    </div>
  );

  if (action.type === "create_notification") return (
    <div className="space-y-2 mt-2">
      <Input placeholder="Notification Title" value={action.config.title || ""} onChange={e => update('title', e.target.value)} className="bg-white/[0.04] border-white/[0.08] text-white text-xs" />
      <Textarea placeholder="Notification Message" value={action.config.message || ""} onChange={e => update('message', e.target.value)} className="bg-white/[0.04] border-white/[0.08] text-white text-xs h-16" />
      <div className="flex gap-2">
        <Select value={action.config.type || "info"} onValueChange={v => update('type', v)}>
          <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white text-xs flex-1">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent className="bg-[hsl(222,42%,8%)] border-white/[0.1]">
            {["info","success","warning","error","ai_insight"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={action.config.category || "workflow"} onValueChange={v => update('category', v)}>
          <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white text-xs flex-1">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent className="bg-[hsl(222,42%,8%)] border-white/[0.1]">
            {["system","workflow","social","email","finance","team"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  if (action.type === "update_client_status") return (
    <div className="space-y-2 mt-2">
      <Input placeholder="Client ID variable (e.g., {{client.id}})" value={action.config.client_id_field || ""} onChange={e => update('client_id_field', e.target.value)} className="bg-white/[0.04] border-white/[0.08] text-white text-xs" />
      <Select value={action.config.status || "prospect"} onValueChange={v => update('status', v)}>
        <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white text-xs">
          <SelectValue placeholder="New Status" />
        </SelectTrigger>
        <SelectContent className="bg-[hsl(222,42%,8%)] border-white/[0.1]">
          {["lead","prospect","active","inactive","churned"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  if (action.type === "create_report") return (
    <div className="space-y-2 mt-2">
      <Input placeholder="Report Title" value={action.config.title || ""} onChange={e => update('title', e.target.value)} className="bg-white/[0.04] border-white/[0.08] text-white text-xs" />
      <div className="flex gap-2">
        <Select value={action.config.type || "analytics"} onValueChange={v => update('type', v)}>
          <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white text-xs flex-1">
            <SelectValue placeholder="Type" />
          </SelectTrigger>
          <SelectContent className="bg-[hsl(222,42%,8%)] border-white/[0.1]">
            {["analytics","financial","social","workflow","team","custom"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={action.config.period || "weekly"} onValueChange={v => update('period', v)}>
          <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white text-xs flex-1">
            <SelectValue placeholder="Period" />
          </SelectTrigger>
          <SelectContent className="bg-[hsl(222,42%,8%)] border-white/[0.1]">
            {["daily","weekly","monthly","quarterly","yearly"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
    </div>
  );

  if (action.type === "track_metric") return (
    <div className="space-y-2 mt-2">
      <Input placeholder="Metric Name" value={action.config.name || ""} onChange={e => update('name', e.target.value)} className="bg-white/[0.04] border-white/[0.08] text-white text-xs" />
      <Input placeholder="Value (e.g., {{leads_count}})" value={action.config.value || ""} onChange={e => update('value', e.target.value)} className="bg-white/[0.04] border-white/[0.08] text-white text-xs" />
      <Select value={action.config.category || "growth"} onValueChange={v => update('category', v)}>
        <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white text-xs">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent className="bg-[hsl(222,42%,8%)] border-white/[0.1]">
          {["revenue","engagement","productivity","growth","efficiency"].map(v => <SelectItem key={v} value={v}>{v}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );

  return null;
}

export default function WorkflowBuilder({ open, onClose, onSave, workflow: initialWorkflow }) {
  const [id, setId] = useState(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [trigger, setTrigger] = useState("manual");
  const [actions, setActions] = useState([{ type: "generate_insight", config: {} }]);

  useEffect(() => {
    if (initialWorkflow) {
      setId(initialWorkflow.id);
      setName(initialWorkflow.name || "");
      setDescription(initialWorkflow.description || "");
      setTrigger(initialWorkflow.trigger || "manual");
      setActions(initialWorkflow.actions?.length ? initialWorkflow.actions : [{ type: "generate_insight", config: {} }]);
    } else {
      setId(null);
      setName("");
      setDescription("");
      setTrigger("manual");
      setActions([{ type: "generate_insight", config: {} }]);
    }
  }, [initialWorkflow, open]);

  const addAction = () => setActions([...actions, { type: "notify_team", config: {} }]);
  const removeAction = (i) => setActions(actions.filter((_, idx) => idx !== i));
  const updateAction = (i, key, value) => {
    const updated = [...actions];
    if (key === 'type') {
      updated[i] = { type: value, config: {} };
    } else {
      updated[i] = { ...updated[i], config: { ...updated[i].config, [key]: value } };
    }
    setActions(updated);
  };

  const handleSave = () => {
    if (!name.trim()) return;
    onSave({ id, name, description, trigger, actions, status: id ? initialWorkflow.status : "active" });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="bg-[hsl(222,42%,8%)] border-white/[0.1] text-white max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-400" />
            {id ? "Edit Workflow" : "Build a Workflow"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <Label className="text-xs text-slate-400">Workflow Name</Label>
            <Input value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Auto-qualify email leads"
              className="bg-white/[0.04] border-white/[0.08] text-white mt-1" />
          </div>
          <div>
            <Label className="text-xs text-slate-400">Description</Label>
            <Input value={description} onChange={e => setDescription(e.target.value)}
              placeholder="What does this workflow do?"
              className="bg-white/[0.04] border-white/[0.08] text-white mt-1" />
          </div>

          {/* Trigger */}
          <div className="p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
            <Label className="text-xs text-blue-400 mb-2 block">Trigger</Label>
            <Select value={trigger} onValueChange={setTrigger}>
              <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-[hsl(222,42%,8%)] border-white/[0.1]">
                {TRIGGERS.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <Label className="text-xs text-slate-400">Actions (in order)</Label>
            {actions.map((action, i) => (
              <div key={i}>
                {i > 0 && <div className="flex justify-center py-1"><ArrowDown className="w-3 h-3 text-slate-600" /></div>}
                <div className="p-3 rounded-xl bg-violet-500/10 border border-violet-500/20">
                  <div className="flex gap-2 items-center">
                    <span className="text-xs text-violet-400 w-5 flex-shrink-0">{i + 1}.</span>
                    <Select value={action.type} onValueChange={v => updateAction(i, 'type', v)}>
                      <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white flex-1">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-[hsl(222,42%,8%)] border-white/[0.1]">
                        {ACTIONS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {actions.length > 1 && (
                      <Button size="icon" variant="ghost" onClick={() => removeAction(i)}
                        className="text-red-400 hover:text-red-300 h-7 w-7 flex-shrink-0">
                        <Trash2 className="w-3 h-3" />
                      </Button>
                    )}
                  </div>
                  <div className="ml-7">
                    <ActionConfig action={action} index={i} onUpdate={updateAction} />
                  </div>
                </div>
              </div>
            ))}
            <Button variant="outline" onClick={addAction} size="sm"
              className="w-full border-dashed border-white/[0.1] text-slate-400 hover:text-white">
              <Plus className="w-3 h-3 mr-2" /> Add Action
            </Button>
          </div>

          <div className="flex gap-2 pt-2">
            <Button variant="ghost" onClick={onClose} className="flex-1 text-slate-400">Cancel</Button>
            <Button onClick={handleSave} disabled={!name.trim()}
              className="flex-1 bg-gradient-to-r from-blue-600 to-violet-600 hover:from-blue-500 hover:to-violet-500">
              {id ? "Update Workflow" : "Save & Activate"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}