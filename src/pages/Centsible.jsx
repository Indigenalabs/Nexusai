import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send, Plus, Loader2, AlertTriangle, TrendingUp, TrendingDown,
  DollarSign, FileText, ShieldAlert, Zap, PiggyBank, RefreshCw
} from "lucide-react";
import AgentPanel from "@/components/agents/AgentPanel";

const CATEGORY_COLORS = {
  revenue:   "text-green-400",
  marketing: "text-purple-400",
  payroll:   "text-blue-400",
  rent:      "text-yellow-400",
  utilities: "text-orange-400",
  software:  "text-cyan-400",
  travel:    "text-pink-400",
  meals:     "text-amber-400",
  office:    "text-slate-400",
  tax:       "text-red-400",
  other:     "text-slate-500",
};

const QUICK_COMMANDS = [
  { label: "Full health check", text: "Run a comprehensive financial health check. Give me an overall score, cash flow status, profitability, budget adherence, top 5 risks, and immediate action items." },
  { label: "Budget & forecast", text: "Create an automated budget forecast. Show me the annual budget by category, 12-month revenue and expense projections, break-even point, and runway." },
  { label: "Cash flow forecast", text: "Forecast my cash flow for the next 12 months. Identify any shortfall dates, cash acceleration strategies, and working capital improvements." },
  { label: "Anomaly & fraud scan", text: "Scan all transactions for anomalies, fraud, duplicates, round-number patterns, and velocity spikes. Rank by severity and give me action steps." },
  { label: "Spend analysis", text: "Run a full spend analysis. Show spend by category, top vendors, subscription bloat, duplicate payments, and total estimated savings achievable." },
  { label: "Subscription audit", text: "Audit all my subscriptions and recurring charges. Find what's unused, what to cancel, what to downgrade, and total monthly savings." },
  { label: "Vendor optimization", text: "Analyze my top vendors and benchmark pricing against the market. Give me renegotiation scripts and alternatives for each, with estimated savings." },
  { label: "Overdue invoices", text: "Run the dunning management process. List all overdue invoices by tier, generate personalized recovery messages for each, and flag write-off risks." },
  { label: "Tax preparation", text: "Prepare my tax summary. Calculate GST collected/paid (net BAS), taxable income, estimated tax liability, deductions I'm missing, and ATO compliance checklist." },
  { label: "Revenue optimization", text: "Analyze my revenue streams. Show customer concentration risk, LTV estimates, churn detection, upsell opportunities, and top revenue growth strategies." },
  { label: "Compliance check", text: "Check my full financial compliance: GST, BAS, superannuation (11.5%), PAYG, payroll tax, ATO record-keeping, FBT. Flag any non-compliant items with deadlines." },
  { label: "Investor report", text: "Generate a professional investor update for this month. Include executive summary, revenue growth, cash position, key wins, challenges, forward guidance, and board asks." },
  { label: "KPI dashboard", text: "Build my executive KPI dashboard with liquidity ratios, profitability ratios, efficiency ratios, growth metrics, and a health score with traffic light status for each." },
  { label: "Scenario modeling", text: "Run a what-if scenario model. Ask me what scenario to analyze and I'll project the P&L, cash flow, and balance sheet impact across conservative, base, and aggressive outcomes." },
  { label: "Benchmarking", text: "Benchmark my key financial metrics against industry peers. Show gross margin, CAC, LTV, burn rate, revenue growth — with percentile ranking and gap analysis." },
  { label: "Bank reconciliation", text: "Perform a bank reconciliation. Match transactions to invoices, find unmatched items, flag duplicates, and give me a reconciled balance." },
  { label: "Fundraising support", text: "Prepare fundraising financial materials. Ask me the raise type and target amount — I'll build the 5-year model, use of funds, valuation range, dilution scenarios, and data room checklist." },
  { label: "P&L summary", text: "Generate a detailed P&L for this month. Break down all income and expenses by category, calculate margins, and give me cost optimization recommendations." },
  { label: "Virtual CFO Q&A", text: "I have a financial question. Ask me what it is — you'll get a CFO-quality answer with supporting data, context, and recommended next steps." },
  { label: "Payroll analysis", text: "Analyze payroll costs. Show total payroll, super obligations (11.5% SG), PAYG estimate, payroll as % of revenue, and payroll tax risk." },
];

function TransactionRow({ txn }) {
  const isIncome = txn.amount > 0;
  const catColor = CATEGORY_COLORS[txn.category] || "text-slate-400";
  return (
    <div className={`flex items-center justify-between px-3 py-2 rounded-lg border transition-all ${
      txn.is_anomaly
        ? "bg-red-500/5 border-red-500/20"
        : "bg-white/[0.02] border-white/[0.05] hover:bg-white/[0.04]"
    }`}>
      <div className="flex items-center gap-2 min-w-0">
        {txn.is_anomaly && <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />}
        <div className="min-w-0">
          <p className="text-xs text-slate-300 truncate">{txn.merchant || txn.description}</p>
          <p className={`text-[10px] ${catColor}`}>{txn.category}</p>
        </div>
      </div>
      <span className={`text-xs font-semibold flex-shrink-0 ml-2 ${isIncome ? "text-green-400" : "text-slate-300"}`}>
        {isIncome ? "+" : ""}{txn.amount < 0 ? "-" : ""}${Math.abs(txn.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
      </span>
    </div>
  );
}

function BudgetBar({ budget }) {
  const pct = budget.amount > 0 ? Math.min((budget.spent / budget.amount) * 100, 100) : 0;
  const color = pct >= 100 ? "bg-red-500" : pct >= 80 ? "bg-orange-500" : "bg-green-500";
  return (
    <div className="space-y-1">
      <div className="flex justify-between text-xs">
        <span className="text-slate-300 capitalize">{budget.category}</span>
        <span className="text-slate-500">${(budget.spent || 0).toLocaleString()} / ${budget.amount.toLocaleString()}</span>
      </div>
      <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-green-500/20 border border-green-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
          <PiggyBank className="w-3.5 h-3.5 text-green-400" />
        </div>
      )}
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
        isUser
          ? "bg-slate-700 text-white"
          : "bg-white/[0.05] border border-white/[0.08] text-slate-200"
      }`}>
        {isUser ? (
          <p className="leading-relaxed">{message.content}</p>
        ) : (
          <ReactMarkdown className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
            {message.content}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}

export default function Centsible() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState(null);
  const messagesEndRef = useRef(null);

  const { data: transactions = [] } = useQuery({
    queryKey: ["transactions_recent"],
    queryFn: () => base44.entities.Transaction.list("-date", 30),
  });

  const { data: budgets = [] } = useQuery({
    queryKey: ["budgets"],
    queryFn: () => base44.entities.Budget.list(),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["invoices_open"],
    queryFn: () => base44.entities.Invoice.filter({ status: "overdue" }),
  });

  const anomalies = transactions.filter(t => t.is_anomaly);
  const totalIncome = transactions.filter(t => t.amount > 0).reduce((s, t) => s + t.amount, 0);
  const totalExpenses = transactions.filter(t => t.amount < 0).reduce((s, t) => s + Math.abs(t.amount), 0);
  const netCash = totalIncome - totalExpenses;

  useEffect(() => { initConversation(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const initConversation = async () => {
    const conv = await base44.agents.createConversation({
      agent_name: "centsible_agent",
      metadata: { name: "Centsible Session" },
    });
    setConversation(conv);
    base44.agents.subscribeToConversation(conv.id, (data) => {
      setMessages(data.messages || []);
    });
  };

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || !conversation) return;
    setInput("");
    setIsLoading(true);
    await base44.agents.addMessage(conversation, { role: "user", content: msg });
    setIsLoading(false);
  };

  return (
    <div className="flex h-screen bg-[hsl(222,47%,6%)]">
      {/* Left Panel */}
      <div className="w-72 flex-shrink-0 border-r border-white/[0.06] flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
              <PiggyBank className="w-4 h-4 text-green-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Centsible</h2>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                <span className="text-[10px] text-green-400">Watching</span>
              </div>
            </div>
          </div>
          {/* KPIs */}
          <div className="space-y-2">
            <div className="flex justify-between items-center bg-white/[0.03] rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-green-400" />
                <span className="text-xs text-slate-400">Income</span>
              </div>
              <span className="text-xs font-semibold text-green-400">${totalIncome.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex justify-between items-center bg-white/[0.03] rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5">
                <TrendingDown className="w-3.5 h-3.5 text-red-400" />
                <span className="text-xs text-slate-400">Expenses</span>
              </div>
              <span className="text-xs font-semibold text-red-400">${totalExpenses.toLocaleString("en-US", { maximumFractionDigits: 0 })}</span>
            </div>
            <div className="flex justify-between items-center bg-white/[0.03] rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5">
                <DollarSign className="w-3.5 h-3.5 text-blue-400" />
                <span className="text-xs text-slate-400">Net</span>
              </div>
              <span className={`text-xs font-semibold ${netCash >= 0 ? "text-green-400" : "text-red-400"}`}>
                {netCash >= 0 ? "+" : ""}${netCash.toLocaleString("en-US", { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
          {anomalies.length > 0 && (
            <button
              onClick={() => sendMessage(`I found ${anomalies.length} flagged transaction(s). Please analyze each one and tell me what action to take.`)}
              className="mt-2 w-full flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-xs hover:bg-red-500/15 transition-all"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              {anomalies.length} Anomal{anomalies.length === 1 ? "y" : "ies"} Flagged
            </button>
          )}
        </div>

        {/* Budgets */}
        {budgets.length > 0 && (
          <div className="p-4 border-b border-white/[0.06]">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-3">Budgets</p>
            <div className="space-y-3">
              {budgets.slice(0, 4).map(b => <BudgetBar key={b.id} budget={b} />)}
            </div>
          </div>
        )}

        {/* Recent Transactions */}
        <div className="flex-1 overflow-y-auto p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] text-slate-500 uppercase tracking-wider">Recent Transactions</p>
            <RefreshCw className="w-3 h-3 text-slate-600" />
          </div>
          <div className="space-y-1.5">
            {transactions.slice(0, 15).map(t => <TransactionRow key={t.id} txn={t} />)}
            {transactions.length === 0 && (
              <p className="text-xs text-slate-600 text-center py-4">No transactions yet</p>
            )}
          </div>
        </div>

        {/* Overdue Invoices */}
        {invoices.length > 0 && (
          <div className="p-3 border-t border-white/[0.06]">
            <button
              onClick={() => sendMessage("List all overdue invoices with amounts and suggest follow-up messages for each client.")}
              className="w-full flex items-center gap-2 px-3 py-2 bg-orange-500/10 border border-orange-500/20 rounded-lg text-orange-400 text-xs hover:bg-orange-500/15 transition-all"
            >
              <FileText className="w-3.5 h-3.5" />
              {invoices.length} Overdue Invoice{invoices.length > 1 ? "s" : ""}
            </button>
          </div>
        )}
      </div>

      {/* Connected Agents */}
      <div className="hidden xl:flex w-60 flex-shrink-0 border-r border-white/[0.06] order-last border-l border-r-0 flex-col gap-2 p-3 overflow-y-auto">
        <p className="text-[10px] text-slate-600 uppercase tracking-wider px-1 pt-1">Connected Agents</p>
        <AgentPanel agentName="sage_agent" agentLabel="Sage" agentEmoji="🧠" accentColor="amber"
          quickCommands={[
            { label: "Financial context for strategy", text: "Centsible has the latest financial data. Use it to update the strategic health assessment and OKR progress." },
            { label: "Investment ROI analysis", text: "Calculate the risk-adjusted ROI for our top 3 strategic initiatives based on current financial data from Centsible." },
          ]} />
        <AgentPanel agentName="atlas_agent" agentLabel="Atlas" agentEmoji="⚙️" accentColor="orange"
          quickCommands={[
            { label: "Budget approval workflow", text: "Set up a budget approval workflow in Atlas for expenses above threshold. Who approves what?" },
            { label: "Cost reduction tasks", text: "Centsible has identified cost savings. Create tasks in Atlas for each item with an owner and deadline." },
          ]} />
        <AgentPanel agentName="maestro_agent" agentLabel="Maestro" agentEmoji="🎼" accentColor="violet"
          quickCommands={[
            { label: "Marketing spend ROI", text: "Pull the marketing spend from Centsible and calculate true campaign ROI by channel. What should we scale and cut?" },
            { label: "Budget for next campaign", text: "How much budget does Centsible say we have available for the next marketing campaign?" },
          ]} />
        <AgentPanel agentName="merchant_agent" agentLabel="Merchant" agentEmoji="🛒" accentColor="emerald"
          quickCommands={[
            { label: "Revenue by product line", text: "Pull revenue by product category from Centsible and tell me which product lines are most and least profitable." },
            { label: "Inventory investment analysis", text: "How much capital is tied up in inventory and is the investment yielding the right return given our margins?" },
          ]} />
      </div>

      {/* Chat Panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">Centsible — Autonomous CFO</h1>
            <p className="text-xs text-slate-500">Budgeting · Forecasting · Compliance · Risk · Investor Reporting · Cash Flow</p>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={initConversation}
            className="text-slate-400 hover:text-white text-xs"
          >
            <Plus className="w-3.5 h-3.5 mr-1" />
            New Session
          </Button>
        </div>

        {/* Quick Commands */}
        {messages.length === 0 && (
          <div className="px-6 py-4 border-b border-white/[0.06]">
            <p className="text-xs text-slate-500 mb-3">Quick commands</p>
            <div className="flex flex-wrap gap-2">
              {QUICK_COMMANDS.map((cmd) => (
                <button
                  key={cmd.label}
                  onClick={() => sendMessage(cmd.text)}
                  className="text-xs px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.08] text-slate-300 hover:text-white hover:border-green-500/30 hover:bg-green-500/10 transition-all flex items-center gap-1.5"
                >
                  <Zap className="w-3 h-3 text-green-400" />
                  {cmd.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/20 flex items-center justify-center mb-4">
                <PiggyBank className="w-8 h-8 text-green-400" />
              </div>
              <h3 className="text-white font-semibold mb-1">Centsible is watching</h3>
              <p className="text-slate-500 text-sm max-w-sm">Ask for a health check, budget forecast, anomaly scan, compliance review, investor report, or any CFO-level financial analysis.</p>
            </div>
          )}
          {messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-green-500/20 border border-green-500/30 flex items-center justify-center flex-shrink-0">
                <PiggyBank className="w-3.5 h-3.5 text-green-400" />
              </div>
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-green-400 animate-spin" />
                <span className="text-xs text-slate-400">Analyzing finances...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-white/[0.06]">
          <div className="flex gap-3 items-end">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask Centsible to check budgets, scan for fraud, forecast cash flow, or review invoices..."
              className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-600 resize-none min-h-[44px] max-h-32 text-sm"
              rows={1}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
              }}
            />
            <Button
              onClick={() => sendMessage()}
              disabled={!input.trim() || isLoading}
              className="bg-green-500/20 hover:bg-green-500/30 text-green-400 border border-green-500/30 flex-shrink-0"
              size="icon"
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-slate-600 mt-2">Press Enter to send · Shift+Enter for new line</p>
        </div>
      </div>
    </div>
  );
}