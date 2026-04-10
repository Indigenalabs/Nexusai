import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Sparkles, Send, Archive, Loader2, Paperclip,
  HardDrive, CheckCircle, Reply, FolderOpen
} from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";

const priorityColors = {
  urgent: "bg-red-500/15 text-red-400 border-red-500/20",
  high: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  normal: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  low: "bg-slate-500/15 text-slate-400 border-slate-500/20",
};

export default function EmailDetailPanel({ email, provider, onArchive, onReplysent }) {
  const [reply, setReply] = useState(email?.suggested_reply || "");
  const [generating, setGenerating] = useState(false);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [savingDocs, setSavingDocs] = useState({});
  const [savedDocs, setSavedDocs] = useState({});
  const [showReply, setShowReply] = useState(false);

  const attachments = email?.attachments || [];

  const handleGenerateReply = async () => {
    setGenerating(true);
    const res = await base44.functions.invoke('emailDocumentProcessor', {
      action: 'generate_reply',
      data: {
        subject: email.subject,
        body: email.body,
        from: email.from_email,
      }
    });
    setReply(res.data?.reply || "");
    await base44.entities.Email.update(email.id, { suggested_reply: res.data?.reply });
    setGenerating(false);
    setShowReply(true);
  };

  const handleSendReply = async () => {
    if (!reply.trim()) return;
    setSending(true);
    await base44.functions.invoke('emailDocumentProcessor', {
      action: 'send_reply',
      data: {
        provider: provider || 'gmail',
        messageId: email.message_id || email.id,
        threadId: email.thread_id,
        to: email.from_email,
        subject: email.subject,
        body: reply,
      }
    });
    await base44.entities.Email.update(email.id, { status: 'replied' });
    setSending(false);
    setSent(true);
    if (onReplysent) onReplysent();
  };

  const handleSaveToDrive = async (attachment) => {
    setSavingDocs(prev => ({ ...prev, [attachment.filename]: true }));
    const res = await base44.functions.invoke('emailDocumentProcessor', {
      action: 'save_attachment_to_drive',
      data: {
        messageId: attachment.messageId,
        attachmentId: attachment.attachmentId,
        filename: attachment.filename,
        mimeType: attachment.mimeType,
        emailSubject: email.subject,
      }
    });
    setSavingDocs(prev => ({ ...prev, [attachment.filename]: false }));
    setSavedDocs(prev => ({ ...prev, [attachment.filename]: res.data?.folder || 'Drive' }));
  };

  if (!email) {
    return (
      <div className="flex flex-col items-center justify-center h-full rounded-2xl bg-white/[0.03] border border-white/[0.06] p-12">
        <Reply className="w-16 h-16 text-slate-700 mb-4" />
        <p className="text-sm text-slate-600">Select an email to view</p>
      </div>
    );
  }

  return (
    <motion.div
      key={email.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6 space-y-5"
    >
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <h2 className="text-lg font-semibold text-white mb-2">{email.subject}</h2>
          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
            <span>From: <span className="text-slate-300">{email.from_email || "N/A"}</span></span>
            <span>To: <span className="text-slate-300">{email.to_email}</span></span>
            {email.created_date && <span>{format(new Date(email.created_date), "MMM d, h:mm a")}</span>}
          </div>
        </div>
        <div className="flex items-center gap-2 ml-3">
          <Badge variant="outline" className={`text-[10px] ${priorityColors[email.priority]}`}>{email.priority}</Badge>
          {email.status === 'replied' && <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/20">Replied</Badge>}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 rounded-xl bg-white/[0.04] border border-white/[0.06]">
        <p className="text-sm text-slate-300 whitespace-pre-wrap leading-relaxed">{email.body || "No content"}</p>
      </div>

      {/* AI Summary */}
      {email.ai_summary && (
        <div className="p-4 rounded-xl bg-violet-500/[0.08] border border-violet-500/15">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-violet-400" />
            <span className="text-xs font-medium text-violet-400">AI Summary</span>
          </div>
          <p className="text-xs text-slate-300">{email.ai_summary}</p>
        </div>
      )}

      {/* Attachments → Save to Drive */}
      {attachments.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 mb-1">
            <Paperclip className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-medium text-slate-300">Attachments</span>
          </div>
          {attachments.map(att => (
            <div key={att.filename} className="flex items-center justify-between p-3 rounded-lg bg-white/[0.04] border border-white/[0.06]">
              <div className="flex items-center gap-2 min-w-0">
                <FolderOpen className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" />
                <span className="text-xs text-slate-300 truncate">{att.filename}</span>
              </div>
              {savedDocs[att.filename] ? (
                <span className="text-[10px] text-emerald-400 flex items-center gap-1 flex-shrink-0">
                  <CheckCircle className="w-3 h-3" /> Saved to {savedDocs[att.filename]}
                </span>
              ) : (
                <Button
                  size="sm"
                  onClick={() => handleSaveToDrive(att)}
                  disabled={savingDocs[att.filename]}
                  className="h-6 text-[10px] px-2 bg-blue-600/80 hover:bg-blue-600 flex-shrink-0 ml-2"
                >
                  {savingDocs[att.filename] ? <Loader2 className="w-3 h-3 animate-spin" /> : <><HardDrive className="w-3 h-3 mr-1" /> Save to Drive</>}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Reply Section */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-white">Reply</h3>
          <Button
            size="sm"
            onClick={handleGenerateReply}
            disabled={generating}
            variant="outline"
            className="h-7 text-xs border-violet-500/30 text-violet-400 hover:bg-violet-500/10"
          >
            {generating ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : <Sparkles className="w-3 h-3 mr-1" />}
            AI Draft
          </Button>
        </div>

        {(showReply || reply) && (
          <Textarea
            value={reply}
            onChange={e => setReply(e.target.value)}
            placeholder="Write your reply..."
            className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-600 h-28 text-sm resize-none"
          />
        )}

        {!showReply && !reply && (
          <button
            onClick={() => setShowReply(true)}
            className="w-full p-3 rounded-xl border border-dashed border-white/[0.1] text-xs text-slate-500 hover:text-slate-300 hover:border-white/20 transition-all text-left"
          >
            + Write a reply...
          </button>
        )}

        <div className="flex gap-2">
          {(showReply || reply) && (
            <Button
              onClick={handleSendReply}
              disabled={sending || sent || !reply.trim()}
              className="flex-1 bg-blue-600 hover:bg-blue-700"
            >
              {sent ? <><CheckCircle className="w-3.5 h-3.5 mr-2" /> Sent!</> :
               sending ? <><Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" /> Sending...</> :
               <><Send className="w-3.5 h-3.5 mr-2" /> Send Reply</>}
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => onArchive && onArchive(email)}
            className="flex-1 border-white/[0.1] text-slate-400 hover:text-white"
          >
            <Archive className="w-3.5 h-3.5 mr-2" /> Archive
          </Button>
        </div>
      </div>
    </motion.div>
  );
}