import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Mail, Inbox, ArrowLeft, Search, RefreshCw,
  Loader2, Settings2, HardDrive, Sparkles, ArrowUp
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import EmailDetailPanel from "@/components/email/EmailDetailPanel";
import EmailCredentialsModal from "@/components/email/EmailCredentialsModal";

const priorityColors = {
  urgent: "bg-red-500/15 text-red-400 border-red-500/20",
  high: "bg-amber-500/15 text-amber-400 border-amber-500/20",
  normal: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  low: "bg-slate-500/15 text-slate-400 border-slate-500/20",
};

export default function EmailHub() {
  const [filter, setFilter] = useState("all");
  const [selectedEmail, setSelectedEmail] = useState(null);
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [provider, setProvider] = useState("gmail");
  const [showCredentials, setShowCredentials] = useState(false);
  const [pullToRefresh, setPullToRefresh] = useState(0);
  const queryClient = useQueryClient();

  const { data: emails = [], refetch } = useQuery({
    queryKey: ["emails"],
    queryFn: () => base44.entities.Email.list("-created_date", 50),
  });

  const handleTouchStart = (e) => {
    if (window.scrollY === 0) {
      setPullToRefresh(e.touches[0].clientY);
    }
  };

  const handleTouchMove = (e) => {
    if (pullToRefresh > 0 && window.scrollY === 0) {
      const pull = e.touches[0].clientY - pullToRefresh;
      if (pull > 80) {
        refetch();
        setPullToRefresh(0);
      }
    }
  };

  const handleTouchEnd = () => {
    setPullToRefresh(0);
  };

  React.useEffect(() => {
    window.addEventListener('touchstart', handleTouchStart);
    window.addEventListener('touchmove', handleTouchMove);
    window.addEventListener('touchend', handleTouchEnd);
    return () => {
      window.removeEventListener('touchstart', handleTouchStart);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [pullToRefresh]);

  const archiveMutation = useMutation({
    mutationFn: (email) => base44.entities.Email.update(email.id, { status: "archived" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emails"] });
      setSelectedEmail(null);
    }
  });

  const handleSync = async () => {
    setSyncing(true);
    await base44.functions.invoke('emailDocumentProcessor', {
      action: 'sync_emails',
      data: { provider }
    });
    await queryClient.invalidateQueries({ queryKey: ["emails"] });
    setSyncing(false);
  };

  const filtered = emails.filter(e => {
    const statusMatch = filter === "all" || e.type === filter || e.status === filter;
    const searchMatch = !search ||
      e.subject?.toLowerCase().includes(search.toLowerCase()) ||
      e.from_email?.toLowerCase().includes(search.toLowerCase());
    return statusMatch && searchMatch;
  });

  const unreadCount = emails.filter(e => e.status === "unread").length;
  const withAttachments = emails.filter(e => e.attachments?.length > 0).length;

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] bg-grid" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      {pullToRefresh > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex justify-center items-center p-4"
        >
          <ArrowUp className="w-5 h-5 text-blue-400 animate-bounce" />
        </motion.div>
      )}
      <div className="px-6 lg:px-10 pt-8 pb-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Link to={createPageUrl("Dashboard")} className="text-slate-500 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Mail className="w-5 h-5 text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Email Hub</h1>
              <p className="text-xs text-slate-500">AI replies, document detection & Drive sync</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Provider Toggle */}
            <div className="flex items-center gap-1 p-1 rounded-lg bg-white/[0.04] border border-white/[0.06]">
              {["gmail", "outlook"].map(p => (
                <button
                  key={p}
                  onClick={() => setProvider(p)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    provider === p ? "bg-blue-600 text-white" : "text-slate-400 hover:text-white"
                  }`}
                >
                  {p === "gmail" ? "Gmail" : "Outlook"}
                </button>
              ))}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setShowCredentials(true)}
              className="text-slate-400 hover:text-white"
            >
              <Settings2 className="w-4 h-4" />
            </Button>
            <Button
              onClick={handleSync}
              disabled={syncing}
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <RefreshCw className="w-4 h-4 mr-2" />}
              Sync Emails
            </Button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Unread", value: unreadCount, color: "blue", icon: Mail },
            { label: "With Documents", value: withAttachments, color: "amber", icon: HardDrive },
            { label: "Total", value: emails.length, color: "violet", icon: Sparkles },
          ].map((stat) => (
            <div key={stat.label} className={`rounded-xl bg-${stat.color}-500/[0.08] border border-${stat.color}-500/20 p-4 flex items-center gap-3`}>
              <stat.icon className={`w-4 h-4 text-${stat.color}-400`} />
              <div>
                <p className="text-xs text-slate-400">{stat.label}</p>
                <p className={`text-xl font-bold text-${stat.color}-400`}>{stat.value}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Email List */}
          <div className="lg:col-span-1 space-y-3">
            <div className="flex items-center gap-2">
              <Input
                placeholder="Search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-600"
              />
              <Search className="w-4 h-4 text-slate-600 flex-shrink-0" />
            </div>

            <Tabs value={filter} onValueChange={setFilter}>
              <TabsList className="bg-white/[0.04] border border-white/[0.06] w-full flex">
                <TabsTrigger value="all" className="text-xs flex-1 data-[state=active]:bg-white/[0.1]">All</TabsTrigger>
                <TabsTrigger value="unread" className="text-xs flex-1 data-[state=active]:bg-white/[0.1]">Unread</TabsTrigger>
                <TabsTrigger value="lead" className="text-xs flex-1 data-[state=active]:bg-white/[0.1]">Leads</TabsTrigger>
                <TabsTrigger value="replied" className="text-xs flex-1 data-[state=active]:bg-white/[0.1]">Replied</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {filtered.length === 0 && (
                <div className="text-center py-10">
                  <Inbox className="w-8 h-8 text-slate-700 mx-auto mb-2" />
                  <p className="text-xs text-slate-600">No emails. Click Sync Emails to fetch.</p>
                </div>
              )}
              {filtered.map((email, i) => (
                <motion.div
                  key={email.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => setSelectedEmail(email)}
                  className={`p-4 rounded-xl cursor-pointer transition-all ${
                    selectedEmail?.id === email.id
                      ? "bg-blue-500/15 border border-blue-500/20"
                      : "bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05]"
                  }`}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="text-xs font-medium text-white truncate">{email.from_email || email.to_email}</h4>
                        {email.status === "unread" && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 flex-shrink-0" />}
                        {email.attachments?.length > 0 && <HardDrive className="w-3 h-3 text-amber-400 flex-shrink-0" />}
                      </div>
                      <p className="text-xs text-slate-400 truncate">{email.subject}</p>
                    </div>
                    <Badge variant="outline" className={`text-[10px] ${priorityColors[email.priority]} ml-2 flex-shrink-0`}>
                      {email.priority}
                    </Badge>
                  </div>
                  <p className="text-[10px] text-slate-600 mt-1">
                    {email.created_date && format(new Date(email.created_date), "MMM d, h:mm a")}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Email Detail */}
          <div className="lg:col-span-2">
            <EmailDetailPanel
              email={selectedEmail}
              provider={provider}
              onArchive={(email) => archiveMutation.mutate(email)}
              onReplysent={() => queryClient.invalidateQueries({ queryKey: ["emails"] })}
            />
          </div>
        </div>
      </div>

      <EmailCredentialsModal
        open={showCredentials}
        onClose={() => setShowCredentials(false)}
      />
    </div>
  );
}