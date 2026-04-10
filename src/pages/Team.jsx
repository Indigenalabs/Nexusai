import React, { useState } from "react";
import AgentPanel from "@/components/agents/AgentPanel";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Users, ArrowLeft, Plus, Mail, Shield,
  UserCheck, Crown, Eye
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format } from "date-fns";

const roleColors = {
  admin: "bg-red-500/15 text-red-400 border-red-500/20",
  manager: "bg-violet-500/15 text-violet-400 border-violet-500/20",
  member: "bg-blue-500/15 text-blue-400 border-blue-500/20",
  viewer: "bg-slate-500/15 text-slate-400 border-slate-500/20",
};

const roleIcons = { admin: Crown, manager: Shield, member: UserCheck, viewer: Eye };

export default function Team() {
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState("user");
  const [inviting, setInviting] = useState(false);
  const queryClient = useQueryClient();

  const { data: members = [] } = useQuery({
    queryKey: ["team_members"],
    queryFn: () => base44.entities.TeamMember.list("-created_date"),
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TeamMember.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team_members"] });
      setIsInviteOpen(false);
      setInviteEmail("");
    },
  });

  const handleInvite = async () => {
    setInviting(true);
    await base44.users.inviteUser(inviteEmail, inviteRole);
    await createMutation.mutateAsync({
      name: inviteEmail.split("@")[0],
      email: inviteEmail,
      role: inviteRole === "admin" ? "admin" : "member",
      status: "pending"
    });
    setInviting(false);
  };

  const departmentColors = {
    marketing: "text-pink-400", sales: "text-emerald-400",
    operations: "text-blue-400", finance: "text-amber-400", tech: "text-cyan-400"
  };

  const stats = [
    { label: "Total Members", value: members.length },
    { label: "Active", value: members.filter(m => m.status === 'active').length },
    { label: "Pending", value: members.filter(m => m.status === 'pending').length },
  ];

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] bg-grid">
      <div className="px-6 lg:px-10 pt-8 pb-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link to={createPageUrl("Dashboard")} className="text-slate-500 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <Users className="w-5 h-5 text-violet-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Team</h1>
              <p className="text-sm text-slate-500">Manage your team and permissions</p>
            </div>
          </div>
          <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-violet-600 to-blue-600 hover:from-violet-500 hover:to-blue-500">
                <Plus className="w-4 h-4 mr-2" /> Invite Member
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[hsl(222,42%,8%)] border-white/[0.1] text-white">
              <DialogHeader>
                <DialogTitle>Invite Team Member</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label className="text-xs text-slate-400">Email Address</Label>
                  <input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    className="w-full mt-1 bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white placeholder:text-slate-600 focus:outline-none"
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-400">Role</Label>
                  <Select value={inviteRole} onValueChange={setInviteRole}>
                    <SelectTrigger className="bg-white/[0.04] border-white/[0.08] text-white mt-1">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-[hsl(222,42%,8%)] border-white/[0.1] text-white">
                      <SelectItem value="user">Member</SelectItem>
                      <SelectItem value="admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  onClick={handleInvite}
                  disabled={!inviteEmail || inviting}
                  className="w-full bg-violet-600 hover:bg-violet-500"
                >
                  {inviting ? "Inviting..." : "Send Invite"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {stats.map((stat) => (
            <div key={stat.label} className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-4">
              <p className="text-xs text-slate-500 mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        {/* Members Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {members.map((member, i) => {
            const RoleIcon = roleIcons[member.role] || UserCheck;
            return (
              <motion.div
                key={member.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-5"
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-violet-600 flex items-center justify-center text-white font-bold text-sm">
                      {member.name?.[0]?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <h3 className="text-sm font-semibold text-white">{member.name}</h3>
                      <p className={`text-xs font-medium ${departmentColors[member.department] || 'text-slate-400'} capitalize`}>
                        {member.department || "No department"}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${roleColors[member.role]}`}>
                    <RoleIcon className="w-2.5 h-2.5 mr-1" />
                    {member.role}
                  </Badge>
                </div>

                <div className="flex items-center gap-2 text-xs text-slate-400 mb-3">
                  <Mail className="w-3 h-3" />
                  {member.email}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/[0.06]">
                  <Badge className={`text-[10px] ${
                    member.status === 'active' ? 'bg-emerald-500/15 text-emerald-400' :
                    member.status === 'pending' ? 'bg-amber-500/15 text-amber-400' :
                    'bg-red-500/15 text-red-400'
                  }`}>
                    {member.status || "active"}
                  </Badge>
                  {member.last_active && (
                    <span className="text-[10px] text-slate-600">
                      Active {format(new Date(member.last_active), "MMM d")}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>

        {members.length === 0 && (
          <div className="text-center py-20 rounded-2xl bg-white/[0.02] border border-white/[0.04]">
            <Users className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No team members yet</h3>
            <p className="text-sm text-slate-500">Invite your first team member to get started</p>
          </div>
        )}

        {/* Agent Panels */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4">
          <AgentPanel
            agentName="pulse_agent"
            agentLabel="Pulse"
            agentEmoji="💓"
            accentColor="pink"
            startMessage={`We have ${members.length} team members. Give me a team health overview — who might be at risk of burnout, who has upcoming milestones or anniversaries, and what should I focus on to keep the team engaged?`}
            quickCommands={[
              { label: "Team health check", text: "Run a team health check. Who needs a 1-on-1? Who might be at risk?" },
              { label: "Burnout risk scan", text: "Scan the team for burnout risk signals and give me a prioritized action list." },
              { label: "Upcoming milestones", text: "What team milestones or anniversaries are coming up that I should celebrate?" },
              { label: "Retention risks", text: "Which team members might be at risk of leaving? What should I do?" },
            ]}
          />
          <AgentPanel
            agentName="atlas_agent"
            agentLabel="Atlas"
            agentEmoji="🏗️"
            accentColor="orange"
            startMessage={`Review our team of ${members.length} people. From an operations perspective, is the team structured well? Are workloads balanced? What tasks are overdue or at risk?`}
            quickCommands={[
              { label: "Workload balance", text: "Is our team workload balanced? Who is overloaded or underutilized?" },
              { label: "Overdue tasks", text: "What tasks are overdue or at risk? Who owns them?" },
              { label: "Team structure review", text: "Review our team structure — are there any operational gaps or risks?" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}