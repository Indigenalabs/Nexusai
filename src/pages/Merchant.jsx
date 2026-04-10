import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import AgentPanel from "@/components/agents/AgentPanel";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Send, Plus, Loader2, ShoppingBag, Package, AlertTriangle,
  TrendingUp, Zap, BarChart2, Tag,
  ChevronRight, RotateCcw, Globe, Users, Lightbulb
} from "lucide-react";

const STOCK_STATUS = (qty) => {
  if (!qty && qty !== 0) return { label: "Unknown", color: "text-slate-500", dot: "bg-slate-600" };
  if (qty <= 0) return { label: "Out of stock", color: "text-red-400", dot: "bg-red-400" };
  if (qty <= 10) return { label: "Low stock", color: "text-amber-400", dot: "bg-amber-400" };
  return { label: "In stock", color: "text-green-400", dot: "bg-green-400" };
};

const CAPABILITY_GROUPS = [
  {
    label: "Store Health & Analytics",
    icon: BarChart2,
    color: "text-emerald-400",
    commands: [
      { label: "Full store health check", text: "Give me a comprehensive store health report — revenue, inventory alerts, pricing health, conversion issues, and top 5 action items ranked by revenue impact." },
      { label: "Product performance matrix", text: "Classify all my products into Stars, Workhorses, Question Marks, and Dogs. Which should I invest in, optimize, or discontinue?" },
      { label: "Profitability deep-dive", text: "Calculate the true profitability of my store — accounting for COGS, shipping, returns, marketing, and platform fees. Which categories are genuinely profitable?" },
      { label: "Retention & cohort analysis", text: "Analyze customer retention patterns — repeat purchase rates, cohort performance, and what I can do to improve loyalty and LTV." },
    ]
  },
  {
    label: "Inventory & Supply Chain",
    icon: Package,
    color: "text-blue-400",
    commands: [
      { label: "Inventory sync & alerts", text: "Sync my inventory and flag everything critical — stockouts losing revenue now, low stock needing reorder, and overstocked items tying up capital." },
      { label: "Demand forecast", text: "Forecast demand for the next 30 days across my catalog. Which products will run out? What should I reorder and how much?" },
      { label: "Slow mover analysis", text: "Identify my slow-moving and dead stock. Give me a markdown strategy, bundle ideas, and phase-out recommendations with estimated capital recovery." },
      { label: "Replenishment plan", text: "Build me a prioritized reorder list — what to restock, how much, and in what order of urgency." },
    ]
  },
  {
    label: "Pricing & Promotions",
    icon: Tag,
    color: "text-violet-400",
    commands: [
      { label: "Dynamic pricing audit", text: "Analyze my current prices against competitor benchmarks, demand signals, and margin targets. Where should I raise prices? Where am I leaving money on the table?" },
      { label: "Margin analysis", text: "Calculate gross margins for every product. Flag anything below target, identify price increase candidates, and find bundle opportunities to improve portfolio margin." },
      { label: "Promotion strategy", text: "Design a promotion strategy for this week — what to discount, by how much, how to structure it (flash, BOGO, bundle), and the expected revenue and margin impact." },
      { label: "Price elasticity modeling", text: "Which of my products are price-inelastic (I can raise without losing volume)? Which are highly elastic (price sensitive customers)? Model the revenue impact of a 10% price change across my catalog." },
    ]
  },
  {
    label: "Conversion & Merchandising",
    icon: TrendingUp,
    color: "text-amber-400",
    commands: [
      { label: "Conversion funnel audit", text: "Audit my conversion funnel — where are customers dropping off? What are the top 5 leaks and what's the estimated revenue recovery from fixing each?" },
      { label: "Product page optimization", text: "Optimize my product listings for conversion — titles, descriptions, missing information, image recommendations, and trust signals. Prioritize by expected impact." },
      { label: "Cart recovery strategy", text: "Design a 3-message cart abandonment recovery sequence. Include subject lines, copy, offer timing, and expected recovery rates." },
      { label: "Merchandising strategy", text: "How should I arrange my product catalog to maximize conversion? What should I feature, what should I cross-sell, and how do I create urgency without feeling manipulative?" },
    ]
  },
  {
    label: "Orders, Fraud & Returns",
    icon: RotateCcw,
    color: "text-pink-400",
    commands: [
      { label: "Fraud risk assessment", text: "Analyze my recent orders for fraud patterns. What's the risk score, which orders need manual review, and what prevention measures should I implement?" },
      { label: "Returns analysis", text: "Analyze my returns patterns — top return reasons, products with high return rates, what's causing them, and how to reduce returns without hurting customer satisfaction." },
      { label: "Returns policy optimization", text: "Should I change my returns policy? Balance customer satisfaction, conversion impact, and profitability. What do the top performers in my category do?" },
      { label: "Order health report", text: "Give me a full order health report — fulfillment rates, chargeback risk, refund trends, and any operational issues I should address." },
    ]
  },
  {
    label: "Channels & Growth",
    icon: Globe,
    color: "text-cyan-400",
    commands: [
      { label: "Channel performance analysis", text: "Analyze my sales channel mix — DTC, Amazon, social commerce. Which is most profitable after fees? Where should I invest more and what should I de-prioritize?" },
      { label: "Marketplace strategy", text: "Should I expand to Amazon, eBay, or other marketplaces? Give me a go/no-go with profitability modeling, operational requirements, and recommended first steps." },
      { label: "Social commerce opportunities", text: "Evaluate Instagram Shopping, TikTok Shop, and Facebook Commerce for my products. Which makes most sense and how should I set them up?" },
      { label: "International expansion", text: "Which international markets should I consider for expansion? Analyze demand, competition, logistics, compliance requirements, and recommended entry strategy." },
    ]
  },
  {
    label: "Customer & Loyalty",
    icon: Users,
    color: "text-rose-400",
    commands: [
      { label: "Loyalty program design", text: "Design a loyalty program for my store — structure, tiers, earning rules, rewards, and expected impact on repeat purchase rate and AOV." },
      { label: "Review management strategy", text: "How should I manage customer reviews? Generate response templates for negative reviews, a strategy to get more reviews, and which platforms to prioritize." },
      { label: "Customer segmentation", text: "Segment my customers by purchase behavior — who are my VIPs, who's at risk of churning, who's one purchase away from becoming loyal?" },
      { label: "Post-purchase experience", text: "Map and optimize the post-purchase journey — from order confirmation to delivery to review request. What touchpoints am I missing?" },
    ]
  },
  {
    label: "Product Innovation",
    icon: Lightbulb,
    color: "text-yellow-400",
    commands: [
      { label: "New product ideas", text: "Generate 5 validated product ideas to expand my catalog — with market demand signals, competition level, margin potential, and how to test each before full launch." },
      { label: "Catalog gaps analysis", text: "What products should my catalog have that it doesn't? Where are customers likely going elsewhere because I don't carry what they need?" },
      { label: "Phase-out planning", text: "Which products should I phase out? Build me a managed wind-down plan with clearance pricing and inventory run-down timelines." },
      { label: "Bundle strategy", text: "Design a product bundle strategy — which products to group, how to price bundles, and the expected AOV and margin impact." },
    ]
  },
];

function ProductRow({ product, onSelect, selected }) {
  const stockQty = product.stock_quantity ?? product.inventory ?? null;
  const stock = STOCK_STATUS(stockQty);
  return (
    <button onClick={() => onSelect(product)}
      className={`w-full text-left p-2.5 rounded-lg border transition-all ${
        selected ? "bg-emerald-500/10 border-emerald-500/30" : "bg-white/[0.02] border-white/[0.04] hover:bg-white/[0.04] hover:border-white/[0.08]"
      }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-200 truncate">{product.name}</p>
          {product.category && <p className="text-[9px] text-slate-600">{product.category}</p>}
        </div>
        {product.price != null && (
          <span className="text-xs font-semibold text-emerald-400 flex-shrink-0">${Number(product.price).toFixed(2)}</span>
        )}
      </div>
      <div className="flex items-center gap-2 mt-1.5">
        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${stock.dot}`} />
        <span className={`text-[9px] ${stock.color}`}>{stockQty != null ? `${stockQty} units · ` : ""}{stock.label}</span>
        {product.sku && <span className="text-[9px] text-slate-700">SKU: {product.sku}</span>}
      </div>
    </button>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === "user";
  return (
    <div className={`flex gap-3 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0 mt-0.5">
          <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
        </div>
      )}
      <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
        isUser ? "bg-slate-700 text-white" : "bg-white/[0.05] border border-white/[0.08] text-slate-200"
      }`}>
        {isUser
          ? <p className="leading-relaxed">{message.content}</p>
          : <ReactMarkdown className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">{message.content}</ReactMarkdown>
        }
      </div>
    </div>
  );
}

export default function Merchant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [activeTab, setActiveTab] = useState("products");
  const [expandedGroup, setExpandedGroup] = useState(null);
  const messagesEndRef = useRef(null);
  const queryClient = useQueryClient();

  const { data: products = [], refetch } = useQuery({
    queryKey: ["merchant_products"],
    queryFn: () => base44.entities.Product.list("-created_date", 100),
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["merchant_invoices"],
    queryFn: () => base44.entities.Invoice.list("-created_date", 50),
  });

  const outOfStock = products.filter(p => (p.stock_quantity ?? p.inventory ?? 1) <= 0);
  const lowStock = products.filter(p => { const q = p.stock_quantity ?? p.inventory ?? 1; return q > 0 && q <= 10; });
  const recentRevenue = invoices.filter(i => i.status === "paid").reduce((sum, i) => sum + (i.amount || 0), 0);

  const tabs = [
    { id: "products", label: "Products", count: products.length },
    { id: "alerts", label: "Alerts", count: outOfStock.length + lowStock.length },
    { id: "orders", label: "Orders", count: invoices.length },
  ];

  const displayedProducts = activeTab === "alerts" ? [...outOfStock, ...lowStock] : products;

  useEffect(() => { initConversation(); }, []);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const initConversation = async () => {
    const conv = await base44.agents.createConversation({
      agent_name: "merchant_agent",
      metadata: { name: "Merchant Session" },
    });
    setConversation(conv);
    base44.agents.subscribeToConversation(conv.id, (data) => {
      setMessages(data.messages || []);
      setIsLoading(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ["merchant_invoices"] });
    });
  };

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || !conversation) return;
    setInput("");
    setIsLoading(true);
    await base44.agents.addMessage(conversation, { role: "user", content: msg });
  };

  const handleProductSelect = (product) => {
    setSelectedProduct(product);
    const stockQty = product.stock_quantity ?? product.inventory;
    sendMessage(`Full product analysis for: "${product.name}". Price: $${product.price || "not set"}. Stock: ${stockQty != null ? stockQty + " units" : "unknown"}. ${product.cost_price ? `Cost: $${product.cost_price}.` : ""} ${product.category ? `Category: ${product.category}.` : ""} ${product.description ? `Description: ${product.description}` : ""} Give me: pricing analysis with margin, inventory status and reorder recommendation, conversion optimization suggestions, and your recommended next action.`);
  };

  return (
    <div className="flex h-screen bg-[hsl(222,47%,6%)]">
      {/* Left Panel */}
      <div className="w-72 flex-shrink-0 border-r border-white/[0.06] flex flex-col">
        <div className="p-4 border-b border-white/[0.06]">
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center">
              <ShoppingBag className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Merchant</h2>
              <div className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                <span className="text-[10px] text-emerald-400">Chief Commerce Officer</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-1.5">
            {[
              { label: "Products",   value: products.length,    color: "text-emerald-400" },
              { label: "Low stock",  value: lowStock.length,    color: lowStock.length > 0 ? "text-amber-400" : "text-slate-600" },
              { label: "No stock",   value: outOfStock.length,  color: outOfStock.length > 0 ? "text-red-400" : "text-slate-600" },
              { label: "Revenue",    value: recentRevenue > 0 ? `$${(recentRevenue/1000).toFixed(1)}k` : "$0", color: "text-emerald-400" },
            ].map(s => (
              <div key={s.label} className="bg-white/[0.03] rounded-lg px-2 py-1.5 text-center">
                <p className={`text-sm font-bold ${s.color}`}>{s.value}</p>
                <p className="text-[9px] text-slate-600">{s.label}</p>
              </div>
            ))}
          </div>

          {(outOfStock.length > 0 || lowStock.length > 0) && (
            <div className="mt-2 bg-amber-500/10 border border-amber-500/20 rounded-lg px-3 py-1.5 flex items-center gap-2">
              <AlertTriangle className="w-3 h-3 text-amber-400 flex-shrink-0" />
              <span className="text-[10px] text-amber-400">
                {outOfStock.length > 0 ? `${outOfStock.length} out of stock` : ""}{outOfStock.length > 0 && lowStock.length > 0 ? " · " : ""}{lowStock.length > 0 ? `${lowStock.length} low` : ""}
              </span>
              <button onClick={() => sendMessage("Sync my inventory and flag all critical stockouts — how much revenue am I losing per day and what needs reordering immediately?")}
                className="ml-auto text-[10px] text-amber-400 hover:underline">Fix →</button>
            </div>
          )}
        </div>

        {/* Tabs */}
        <div className="px-3 py-2 border-b border-white/[0.06] flex gap-1">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)}
              className={`flex-1 text-[10px] py-1.5 rounded-lg transition-all flex items-center justify-center gap-1 ${
                activeTab === t.id ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30" : "text-slate-600 hover:text-slate-400"
              }`}>
              {t.label}{t.count > 0 && <span className="opacity-70">({t.count})</span>}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-3">
          {activeTab === "orders" ? (
            <div className="space-y-1.5">
              {invoices.length === 0 ? (
                <div className="text-center py-10">
                  <Package className="w-6 h-6 text-slate-700 mx-auto mb-2" />
                  <p className="text-xs text-slate-600">No orders yet</p>
                </div>
              ) : (
                invoices.slice(0, 30).map(inv => (
                  <div key={inv.id} className="p-2.5 rounded-lg bg-white/[0.02] border border-white/[0.04] cursor-pointer hover:border-emerald-500/20 transition-all"
                    onClick={() => sendMessage(`Analyze this order: ${inv.client_name || inv.title || "Order"}, amount $${inv.amount}, status: ${inv.status}. Any fraud signals or issues?`)}>
                    <div className="flex justify-between items-start gap-2">
                      <div className="min-w-0">
                        <p className="text-xs font-medium text-slate-200 truncate">{inv.client_name || inv.title || "Order"}</p>
                        <p className="text-[9px] text-slate-600">{inv.status}</p>
                      </div>
                      {inv.amount && <span className="text-[10px] font-semibold text-emerald-400">${inv.amount}</span>}
                    </div>
                  </div>
                ))
              )}
            </div>
          ) : (
            <div className="space-y-1.5">
              {displayedProducts.length === 0 ? (
                <div className="text-center py-10">
                  <ShoppingBag className="w-6 h-6 text-slate-700 mx-auto mb-2" />
                  <p className="text-xs text-slate-600">{activeTab === "alerts" ? "No inventory alerts" : "No products yet"}</p>
                  {activeTab === "products" && (
                    <button onClick={() => sendMessage("Help me add a new product to my catalog. Ask me for the details.")}
                      className="mt-1 text-[10px] text-emerald-400 hover:underline">Add a product →</button>
                  )}
                </div>
              ) : (
                displayedProducts.map(p => (
                  <ProductRow key={p.id} product={p} selected={selectedProduct?.id === p.id} onSelect={handleProductSelect} />
                ))
              )}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-white/[0.06] space-y-1.5">
          <button onClick={() => sendMessage("I want to add a new product to my catalog. Ask me for the name, price, description, cost, and initial inventory.")}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-white/[0.08] text-xs text-slate-600 hover:text-slate-400 hover:border-emerald-500/30 transition-all">
            <Plus className="w-3 h-3" /> Add product
          </button>
          <button onClick={() => sendMessage("Give me a comprehensive store health report — revenue, inventory, pricing, conversion, and top 5 actions ranked by revenue impact.")}
            className="w-full flex items-center justify-center gap-1.5 py-2 rounded-lg border border-dashed border-white/[0.08] text-xs text-slate-600 hover:text-slate-400 hover:border-emerald-500/30 transition-all">
            <BarChart2 className="w-3 h-3" /> Store health
          </button>
        </div>
      </div>

      {/* Main Chat */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="px-6 py-4 border-b border-white/[0.06] flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">
              {selectedProduct ? `Analyzing: ${selectedProduct.name}` : "Merchant — Commerce Engine"}
            </h1>
            <p className="text-xs text-slate-500">
              {selectedProduct
                ? `${selectedProduct.category || "product"} · $${selectedProduct.price || "??"}`
                : "Inventory · Pricing · Conversion · Orders · Returns · Channels · Loyalty"}
            </p>
          </div>
          <Button size="sm" variant="ghost" onClick={initConversation} className="text-slate-400 hover:text-white text-xs">
            <Plus className="w-3.5 h-3.5 mr-1" /> New Session
          </Button>
        </div>

        {/* Capabilities */}
        {messages.length === 0 && (
          <div className="px-6 py-4 border-b border-white/[0.06] overflow-y-auto max-h-72">
            <p className="text-xs text-slate-500 mb-3">Merchant capabilities — expand to explore</p>
            <div className="space-y-2">
              {CAPABILITY_GROUPS.map(group => {
                const Icon = group.icon;
                const isExpanded = expandedGroup === group.label;
                return (
                  <div key={group.label} className="rounded-lg border border-white/[0.06] overflow-hidden">
                    <button onClick={() => setExpandedGroup(isExpanded ? null : group.label)}
                      className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-white/[0.03] transition-all">
                      <Icon className={`w-3.5 h-3.5 flex-shrink-0 ${group.color}`} />
                      <span className="text-xs font-medium text-slate-300 flex-1">{group.label}</span>
                      <ChevronRight className={`w-3 h-3 text-slate-600 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                    </button>
                    {isExpanded && (
                      <div className="border-t border-white/[0.06] p-2 space-y-1">
                        {group.commands.map(cmd => (
                          <button key={cmd.label} onClick={() => sendMessage(cmd.text)}
                            className="w-full text-left text-xs px-3 py-2 rounded-lg bg-white/[0.02] border border-white/[0.04] text-slate-400 hover:text-white hover:border-emerald-500/20 hover:bg-emerald-500/5 transition-all flex items-center gap-2">
                            <Zap className={`w-3 h-3 flex-shrink-0 ${group.color}`} />
                            {cmd.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
                <ShoppingBag className="w-8 h-8 text-emerald-400" />
              </div>
              <h3 className="text-white font-semibold mb-1">Merchant is running your store</h3>
              <p className="text-slate-500 text-sm max-w-sm">
                {products.length > 0
                  ? `${products.length} products in catalog${outOfStock.length > 0 ? `, ${outOfStock.length} out of stock` : ""}${lowStock.length > 0 ? `, ${lowStock.length} low stock` : ""}. Click a product for a full analysis or expand a capability group above.`
                  : "Your commerce engine is ready. Expand a capability group above or ask Merchant for a store health check to get started."}
              </p>
            </div>
          )}
          {messages.map((msg, i) => <MessageBubble key={i} message={msg} />)}
          {isLoading && (
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center flex-shrink-0">
                <ShoppingBag className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="bg-white/[0.05] border border-white/[0.08] rounded-2xl px-4 py-3 flex items-center gap-2">
                <Loader2 className="w-3.5 h-3.5 text-emerald-400 animate-spin" />
                <span className="text-xs text-slate-400">Optimizing the store...</span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="px-6 py-4 border-t border-white/[0.06]">
          <div className="flex gap-3 items-end">
            <Textarea value={input} onChange={e => setInput(e.target.value)}
              placeholder="Store health · Inventory · Pricing · Conversion · Fraud · Returns · Channels · Loyalty · Product ideas..."
              className="bg-white/[0.04] border-white/[0.08] text-white placeholder:text-slate-600 resize-none min-h-[44px] max-h-32 text-sm"
              rows={1}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); } }} />
            <Button onClick={() => sendMessage()} disabled={!input.trim() || isLoading}
              className="bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/30 flex-shrink-0" size="icon">
              <Send className="w-4 h-4" />
            </Button>
          </div>
          <p className="text-[10px] text-slate-600 mt-2">Enter to send · Click any product for a full analysis · Expand capabilities above</p>
        </div>
      </div>

      {/* Right Sidebar */}
      <div className="w-64 flex-shrink-0 border-l border-white/[0.06] flex flex-col gap-2 p-3 overflow-y-auto">
        <p className="text-[10px] text-slate-600 uppercase tracking-wider px-1 pt-1">Connected Agents</p>
        <AgentPanel agentName="compass_agent" agentLabel="Compass" agentEmoji="🧭" accentColor="cyan"
          quickCommands={[
            { label: "Competitor pricing intel", text: "Give me current competitor pricing for my product categories. Where am I overpriced or underpriced vs. the market?" },
            { label: "Market trends for products", text: "What market trends should inform my product catalog and pricing strategy right now?" },
          ]} />
        <AgentPanel agentName="maestro_agent" agentLabel="Maestro" agentEmoji="🎼" accentColor="violet"
          quickCommands={[
            { label: "Cart recovery campaign", text: "Launch a cart abandonment recovery campaign. I have abandoned carts to recover — create the email sequence and set it live." },
            { label: "Product launch campaign", text: "We're launching a new product. Plan and execute a launch campaign across email and social." },
          ]} />
        <AgentPanel agentName="centsible_agent" agentLabel="Centsible" agentEmoji="💰" accentColor="green"
          quickCommands={[
            { label: "Revenue & margin report", text: "Pull the latest revenue, margin, and COGS data. Are we hitting our financial targets for the store?" },
            { label: "Commission payouts", text: "Calculate and process any outstanding affiliate or partner commission payouts based on recent order data." },
          ]} />
        <AgentPanel agentName="support_sage_agent" agentLabel="Support Sage" agentEmoji="💬" accentColor="blue"
          quickCommands={[
            { label: "Product issues from support", text: "What product-related issues are customers raising most in support tickets? What do I need to fix?" },
            { label: "Return complaints", text: "What are the top return-related complaints? Are there patterns I should address in the product or policy?" },
          ]} />
      </div>
    </div>
  );
}