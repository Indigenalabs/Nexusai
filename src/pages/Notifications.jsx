import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Bell, ArrowLeft, Check, CheckCheck, Trash2,
  Info, CheckCircle2, AlertTriangle, XCircle, Sparkles
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format } from "date-fns";

const typeIcons = {
  info: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/15" },
  success: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/15" },
  warning: { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/15" },
  error: { icon: XCircle, color: "text-red-400", bg: "bg-red-500/15" },
  ai_insight: { icon: Sparkles, color: "text-violet-400", bg: "bg-violet-500/15" },
};

export default function Notifications() {
  const [filter, setFilter] = useState("unread");
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => base44.entities.Notification.list("-created_date", 50),
  });

  const markReadMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.update(id, { status: "read" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const unread = notifications.filter(n => n.status === "unread");
      await Promise.all(unread.map(n => base44.entities.Notification.update(n.id, { status: "read" })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  });

  const filtered = filter === "all" ? notifications : notifications.filter(n => n.status === filter);

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] bg-grid">
      <div className="px-6 lg:px-10 pt-8 pb-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link to={createPageUrl("Dashboard")} className="text-slate-500 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Bell className="w-5 h-5 text-blue-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Notifications</h1>
              <p className="text-sm text-slate-500">Stay updated with your business</p>
            </div>
          </div>
          <Button 
            onClick={() => markAllReadMutation.mutate()}
            disabled={notifications.filter(n => n.status === "unread").length === 0}
            variant="outline"
            className="border-white/[0.08]"
          >
            <CheckCheck className="w-4 h-4 mr-2" /> Mark All Read
          </Button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: "Unread", value: notifications.filter(n => n.status === "unread").length, color: "blue" },
            { label: "Read", value: notifications.filter(n => n.status === "read").length, color: "slate" },
            { label: "Total", value: notifications.length, color: "violet" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4"
            >
              <p className="text-xs text-slate-400 mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold text-${stat.color}-400`}>{stat.value}</p>
            </motion.div>
          ))}
        </div>

        {/* Filters */}
        <Tabs value={filter} onValueChange={setFilter} className="mb-6">
          <TabsList className="bg-white/[0.04] border border-white/[0.06]">
            <TabsTrigger value="unread" className="text-xs data-[state=active]:bg-white/[0.1]">
              Unread
              {notifications.filter(n => n.status === "unread").length > 0 && (
                <Badge className="ml-1.5 bg-blue-500/20 text-blue-400 text-[9px] px-1">
                  {notifications.filter(n => n.status === "unread").length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="read" className="text-xs data-[state=active]:bg-white/[0.1]">Read</TabsTrigger>
            <TabsTrigger value="all" className="text-xs data-[state=active]:bg-white/[0.1]">All</TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Notifications List */}
        <div className="space-y-2">
          {filtered.map((notification, i) => {
            const typeCfg = typeIcons[notification.type];
            const TypeIcon = typeCfg?.icon || Info;

            return (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                className={`rounded-2xl border p-4 transition-all ${
                  notification.status === "unread"
                    ? "bg-blue-500/[0.06] border-blue-500/20"
                    : "bg-white/[0.03] border-white/[0.06]"
                } hover:bg-white/[0.05]`}
              >
                <div className="flex items-start gap-4">
                  <div className={`p-2 rounded-lg ${typeCfg?.bg} flex-shrink-0`}>
                    <TypeIcon className={`w-4 h-4 ${typeCfg?.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between mb-1">
                      <h3 className="text-sm font-semibold text-white">{notification.title}</h3>
                      {notification.status === "unread" && (
                        <div className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0 ml-2 mt-1" />
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mb-2">{notification.message}</p>
                    <div className="flex items-center gap-3 text-[10px] text-slate-600">
                      <span>{notification.created_date && format(new Date(notification.created_date), "MMM d, h:mm a")}</span>
                      {notification.category && <span>• {notification.category}</span>}
                      {notification.priority !== "normal" && (
                        <Badge className="bg-amber-500/15 text-amber-400 text-[9px] px-1.5">
                          {notification.priority}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {notification.status === "unread" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => markReadMutation.mutate(notification.id)}
                        className="h-8 w-8 p-0"
                      >
                        <Check className="w-3.5 h-3.5" />
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(notification.id)}
                      className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
            <Bell className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No notifications</h3>
            <p className="text-sm text-slate-500">You're all caught up!</p>
          </div>
        )}
      </div>
    </div>
  );
}