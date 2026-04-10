import React, { useState } from "react";
import AgentPanel from "@/components/agents/AgentPanel";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  FileText, Plus, ArrowLeft, Calendar,
  Mail, Download
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";

const statusColors = {
  draft: "bg-slate-500/15 text-slate-400",
  sent: "bg-blue-500/15 text-blue-400",
  paid: "bg-emerald-500/15 text-emerald-400",
  overdue: "bg-red-500/15 text-red-400",
  cancelled: "bg-slate-600/15 text-slate-500",
};

export default function InvoiceManager() {
  const [filter, setFilter] = useState("all");
  const [isOpen, setIsOpen] = useState(false);
  const [formData, setFormData] = useState({
    client_name: "",
    client_email: "",
    amount: "",
    due_date: "",
    notes: ""
  });
  const queryClient = useQueryClient();

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices"],
    queryFn: () => base44.entities.Invoice.list("-created_date", 50),
  });

  const createMutation = useMutation({
    mutationFn: (data) => {
      const invoiceNumber = `INV-${Date.now().toString().slice(-6)}`;
      return base44.entities.Invoice.create({
        ...data,
        invoice_number: invoiceNumber,
        amount: parseFloat(data.amount),
        status: "draft"
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      setIsOpen(false);
      setFormData({ client_name: "", client_email: "", amount: "", due_date: "", notes: "" });
    },
  });

  const sendMutation = useMutation({
    mutationFn: async (invoice) => {
      await base44.integrations.Core.SendEmail({
        to: invoice.client_email,
        subject: `Invoice ${invoice.invoice_number} from Nexus AI`,
        body: `Dear ${invoice.client_name},\n\nPlease find attached invoice ${invoice.invoice_number} for $${invoice.amount}.\n\nDue date: ${format(new Date(invoice.due_date), "MMMM d, yyyy")}\n\nThank you for your business!`
      });
      return base44.entities.Invoice.update(invoice.id, { status: "sent" });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    },
  });

  const filtered = filter === "all" ? invoices : invoices.filter(i => i.status === filter);

  const totalAmount = invoices.reduce((sum, inv) => sum + (inv.amount || 0), 0);
  const overdueAmount = invoices.filter(i => i.status === "overdue").reduce((sum, i) => sum + (i.amount || 0), 0);
  const paidAmount = invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + (i.amount || 0), 0);
  const handleDownloadInvoice = (invoice) => {
    const lines = [
      `Invoice Number: ${invoice.invoice_number}`,
      `Client: ${invoice.client_name}`,
      `Email: ${invoice.client_email}`,
      `Amount: $${Number(invoice.amount || 0).toFixed(2)}`,
      `Status: ${invoice.status}`,
      `Due Date: ${invoice.due_date || ""}`,
      `Notes: ${invoice.notes || ""}`,
      `Created: ${invoice.created_date || ""}`,
    ];

    const blob = new Blob([lines.join("\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${invoice.invoice_number || "invoice"}.txt`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[hsl(222,47%,6%)] bg-grid">
      <div className="px-6 lg:px-10 pt-8 pb-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link to={createPageUrl("Dashboard")} className="text-slate-500 hover:text-white transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <FileText className="w-5 h-5 text-emerald-400" />
            <div>
              <h1 className="text-2xl font-bold text-white">Invoice Manager</h1>
              <p className="text-sm text-slate-500">Create and track invoices</p>
            </div>
          </div>
          <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
              <Button className="bg-gradient-to-r from-emerald-600 to-blue-600 hover:from-emerald-500 hover:to-blue-500">
                <Plus className="w-4 h-4 mr-2" /> New Invoice
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-[hsl(222,40%,10%)] border-white/[0.1]">
              <DialogHeader>
                <DialogTitle className="text-white">Create New Invoice</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-slate-400">Client Name</Label>
                    <Input
                      value={formData.client_name}
                      onChange={(e) => setFormData({...formData, client_name: e.target.value})}
                      className="bg-white/[0.04] border-white/[0.08] text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Client Email</Label>
                    <Input
                      type="email"
                      value={formData.client_email}
                      onChange={(e) => setFormData({...formData, client_email: e.target.value})}
                      className="bg-white/[0.04] border-white/[0.08] text-white"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-xs text-slate-400">Amount ($)</Label>
                    <Input
                      type="number"
                      value={formData.amount}
                      onChange={(e) => setFormData({...formData, amount: e.target.value})}
                      className="bg-white/[0.04] border-white/[0.08] text-white"
                    />
                  </div>
                  <div>
                    <Label className="text-xs text-slate-400">Due Date</Label>
                    <Input
                      type="date"
                      value={formData.due_date}
                      onChange={(e) => setFormData({...formData, due_date: e.target.value})}
                      className="bg-white/[0.04] border-white/[0.08] text-white"
                    />
                  </div>
                </div>
                <div>
                  <Label className="text-xs text-slate-400">Notes (Optional)</Label>
                  <Input
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    className="bg-white/[0.04] border-white/[0.08] text-white"
                  />
                </div>
                <Button
                  onClick={() => createMutation.mutate(formData)}
                  disabled={!formData.client_name || !formData.amount}
                  className="w-full bg-emerald-600 hover:bg-emerald-700"
                >
                  Create Invoice
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[
            { label: "Total Billed", value: `$${totalAmount.toFixed(2)}`, color: "blue" },
            { label: "Paid", value: `$${paidAmount.toFixed(2)}`, color: "emerald" },
            { label: "Overdue", value: `$${overdueAmount.toFixed(2)}`, color: "red" },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className={`rounded-2xl bg-${stat.color}-500/[0.08] border border-${stat.color}-500/20 p-5`}
            >
              <p className="text-xs text-slate-400 mb-1">{stat.label}</p>
              <p className={`text-2xl font-bold text-${stat.color}-400`}>{stat.value}</p>
            </motion.div>
          ))}
        </div>

        <div className="mb-6">
          <Tabs value={filter} onValueChange={setFilter}>
            <TabsList className="bg-white/[0.04] border border-white/[0.06]">
              <TabsTrigger value="all" className="text-xs data-[state=active]:bg-white/[0.1]">All</TabsTrigger>
              <TabsTrigger value="draft" className="text-xs data-[state=active]:bg-white/[0.1]">Drafts</TabsTrigger>
              <TabsTrigger value="sent" className="text-xs data-[state=active]:bg-white/[0.1]">Sent</TabsTrigger>
              <TabsTrigger value="paid" className="text-xs data-[state=active]:bg-white/[0.1]">Paid</TabsTrigger>
              <TabsTrigger value="overdue" className="text-xs data-[state=active]:bg-white/[0.1]">Overdue</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="space-y-3">
          {filtered.map((invoice, i) => (
            <motion.div
              key={invoice.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center justify-between p-5 rounded-2xl bg-white/[0.03] border border-white/[0.06] hover:bg-white/[0.05] transition-all"
            >
              <div className="flex items-center gap-4 flex-1">
                <div className="p-3 rounded-xl bg-emerald-500/15">
                  <FileText className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-white">{invoice.invoice_number}</h3>
                    <Badge className={`text-[10px] ${statusColors[invoice.status]}`}>
                      {invoice.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-500">{invoice.client_name} • {invoice.client_email}</p>
                </div>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <div className="flex items-center gap-1 text-slate-500 text-xs mb-1">
                    <Calendar className="w-3 h-3" />
                    Due {invoice.due_date && format(new Date(invoice.due_date), "MMM d")}
                  </div>
                  <p className="text-lg font-bold text-emerald-400">${invoice.amount.toFixed(2)}</p>
                </div>
                <div className="flex gap-2">
                  {invoice.status === "draft" && (
                    <Button
                      size="sm"
                      onClick={() => sendMutation.mutate(invoice)}
                      disabled={sendMutation.isPending}
                      className="h-8 text-xs bg-blue-600 hover:bg-blue-700"
                    >
                      <Mail className="w-3 h-3 mr-1" /> Send
                    </Button>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => handleDownloadInvoice(invoice)} className="h-8 w-8 p-0">
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-20">
            <FileText className="w-12 h-12 text-slate-700 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No invoices found</h3>
            <p className="text-sm text-slate-500">Create your first invoice to get started</p>
          </div>
        )}

        {/* Agent Panels */}
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
          <AgentPanel
            agentName="centsible_agent"
            agentLabel="Centsible"
            agentEmoji="💰"
            accentColor="emerald"
            startMessage={`Review our invoices: ${invoices.length} total, $${overdueAmount.toFixed(2)} overdue, $${paidAmount.toFixed(2)} paid. Run the full dunning management process — list all overdue by tier, draft personalized recovery messages for each, and flag any write-off risks.`}
            quickCommands={[
              { label: "Chase overdue invoices", text: "Run dunning management. For every overdue invoice, tell me the tier (days overdue), draft a personalised follow-up email, and recommend the next action." },
              { label: "Revenue analysis", text: "Analyse our invoice data — average payment time, patterns in late payers, DSO, and cash conversion cycle." },
              { label: "Cash flow impact", text: "Based on all outstanding invoices, what is our expected cash inflow for the next 30, 60, and 90 days?" },
              { label: "Write-off risk assessment", text: "Which overdue invoices are at risk of becoming bad debt? Rank by risk and recommend write-off vs collection action for each." },
            ]}
          />
          <AgentPanel
            agentName="sentinel_agent"
            agentLabel="Sentinel"
            agentEmoji="🛡️"
            accentColor="red"
            startMessage={`Scan our ${invoices.length} invoices for fraud and financial risks. Total billed: $${totalAmount.toFixed(2)}, overdue: $${overdueAmount.toFixed(2)}. Check for: duplicate invoices, unusual amounts, suspicious client patterns, and any invoice fraud signals.`}
            quickCommands={[
              { label: "Invoice fraud scan", text: "Scan all invoices for fraud — duplicate invoices, round-number anomalies, ghost vendors, unusual payment patterns, and late payment that could indicate financial abuse." },
              { label: "Client risk check", text: "Which clients consistently pay late or are at risk of defaulting? Give me a risk score for each overdue client." },
              { label: "Financial data integrity", text: "Check the integrity of our invoice records — are there gaps, irregularities, or patterns that suggest manipulation?" },
            ]}
          />
          <AgentPanel
            agentName="veritas_agent"
            agentLabel="Veritas"
            agentEmoji="⚖️"
            accentColor="indigo"
            startMessage={`I'm managing ${invoices.length} invoices with $${overdueAmount.toFixed(2)} overdue. Review the legal and compliance aspects — payment terms, late payment interest, ATO GST requirements, and what legal steps I can take on severely overdue invoices.`}
            quickCommands={[
              { label: "Payment terms check", text: "Review our standard invoice payment terms — are they legally sound? Should we add late fees? What's the maximum interest we can charge in Australia?" },
              { label: "Tax compliance", text: "What GST and tax requirements apply to our invoices? Are we handling BAS correctly? Any ATO compliance gaps?" },
              { label: "Legal recovery options", text: "For invoices over 90 days overdue, what legal recovery options do we have? Debt collection, VCAT/NCAT, or legal letters?" },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
