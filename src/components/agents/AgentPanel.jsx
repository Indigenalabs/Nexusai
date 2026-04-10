import { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import ReactMarkdown from "react-markdown";
import { Send, Loader2, ChevronDown, ChevronUp } from "lucide-react";

/**
 * Reusable floating agent panel that can be embedded in any page.
 * Props:
 *   agentName: string (e.g. "centsible_agent")
 *   agentLabel: string (e.g. "Centsible")
 *   agentEmoji: string
 *   accentColor: string (tailwind color name, e.g. "emerald")
 *   startMessage: string (auto-sent on open)
 *   quickCommands: Array<{label, text}>
 *   defaultOpen: boolean
 */
export default function AgentPanel({
  agentName,
  agentLabel,
  agentEmoji,
  accentColor = "blue",
  startMessage,
  quickCommands = [],
  defaultOpen = false,
}) {
  const [open, setOpen] = useState(defaultOpen);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState(null);
  const [initialized, setInitialized] = useState(false);
  const messagesEndRef = useRef(null);

  const colorMap = {
    emerald: { btn: "bg-emerald-500/20 border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/30", dot: "bg-emerald-400", header: "border-emerald-500/20", quick: "hover:border-emerald-500/30 hover:bg-emerald-500/10 hover:text-white" },
    blue:    { btn: "bg-blue-500/20 border-blue-500/30 text-blue-400 hover:bg-blue-500/30",          dot: "bg-blue-400",    header: "border-blue-500/20",    quick: "hover:border-blue-500/30 hover:bg-blue-500/10 hover:text-white" },
    violet:  { btn: "bg-violet-500/20 border-violet-500/30 text-violet-400 hover:bg-violet-500/30",  dot: "bg-violet-400",  header: "border-violet-500/20",  quick: "hover:border-violet-500/30 hover:bg-violet-500/10 hover:text-white" },
    amber:   { btn: "bg-amber-500/20 border-amber-500/30 text-amber-400 hover:bg-amber-500/30",      dot: "bg-amber-400",   header: "border-amber-500/20",   quick: "hover:border-amber-500/30 hover:bg-amber-500/10 hover:text-white" },
    pink:    { btn: "bg-pink-500/20 border-pink-500/30 text-pink-400 hover:bg-pink-500/30",          dot: "bg-pink-400",    header: "border-pink-500/20",    quick: "hover:border-pink-500/30 hover:bg-pink-500/10 hover:text-white" },
    cyan:    { btn: "bg-cyan-500/20 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/30",          dot: "bg-cyan-400",    header: "border-cyan-500/20",    quick: "hover:border-cyan-500/30 hover:bg-cyan-500/10 hover:text-white" },
    orange:  { btn: "bg-orange-500/20 border-orange-500/30 text-orange-400 hover:bg-orange-500/30", dot: "bg-orange-400",  header: "border-orange-500/20",  quick: "hover:border-orange-500/30 hover:bg-orange-500/10 hover:text-white" },
    indigo:  { btn: "bg-indigo-500/20 border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/30", dot: "bg-indigo-400",  header: "border-indigo-500/20",  quick: "hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-white" },
    red:     { btn: "bg-red-500/20 border-red-500/30 text-red-400 hover:bg-red-500/30",             dot: "bg-red-400",     header: "border-red-500/20",     quick: "hover:border-red-500/30 hover:bg-red-500/10 hover:text-white" },
    purple:  { btn: "bg-purple-500/20 border-purple-500/30 text-purple-400 hover:bg-purple-500/30", dot: "bg-purple-400",  header: "border-purple-500/20",  quick: "hover:border-purple-500/30 hover:bg-purple-500/10 hover:text-white" },
  };

  const c = colorMap[accentColor] || colorMap.blue;

  useEffect(() => {
    const timer = requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    });
    return () => cancelAnimationFrame(timer);
  }, [messages, isLoading]);

  useEffect(() => {
    if (!open || initialized) return;
    let isMounted = true;
    let unsubscribe;
    const setupConversation = async () => {
      try {
        const conv = await base44.agents.createConversation({
          agent_name: agentName,
          metadata: { name: `${agentLabel} Panel` },
        });
        if (!isMounted) return;
        setConversation(conv);
        let timeoutId;
        unsubscribe = base44.agents.subscribeToConversation(conv.id, (data) => {
          if (!isMounted) return;
          clearTimeout(timeoutId);
          timeoutId = setTimeout(() => {
            if (!isMounted) return;
            setMessages((data.messages || []).filter(m => (m.role === "user" || m.role === "assistant") && m.content));
            const lastMsg = data.messages?.[data.messages.length - 1];
            if (lastMsg?.role === "assistant" && lastMsg?.content) setIsLoading(false);
          }, 50);
        });
        if (startMessage) {
          setIsLoading(true);
          setTimeout(() => {
            if (isMounted) base44.agents.addMessage(conv, { role: "user", content: startMessage });
          }, 400);
        }
      } catch (err) {
        console.error("Failed to init conversation:", err);
      }
    };
    setupConversation().then(() => {
      if (isMounted) setInitialized(true);
    });
    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, [open, agentName, agentLabel, startMessage]);

  const handleOpen = () => {
    setOpen(true);
  };

  const sendMessage = async (text) => {
    const msg = text || input.trim();
    if (!msg || !conversation || isLoading) return;
    setInput("");
    setIsLoading(true);
    await base44.agents.addMessage(conversation, { role: "user", content: msg });
  };

  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
      {/* Header / toggle */}
      <button
        onClick={open ? () => setOpen(false) : handleOpen}
        className={`w-full flex items-center justify-between px-4 py-3 border-b ${open ? c.header : "border-transparent"} transition-all`}
      >
        <div className="flex items-center gap-2.5">
          <span className="text-lg">{agentEmoji}</span>
          <div className="text-left">
            <p className="text-sm font-semibold text-white">{agentLabel}</p>
            <div className="flex items-center gap-1">
              <div className={`w-1.5 h-1.5 rounded-full ${open ? c.dot : "bg-slate-600"} ${open ? "animate-pulse" : ""}`} />
              <span className="text-[10px] text-slate-500">{open ? "Active" : "Click to ask"}</span>
            </div>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>

      {open && (
        <div className="flex flex-col" style={{ maxHeight: 420 }}>
          {/* Quick commands */}
          {quickCommands.length > 0 && messages.length === 0 && (
            <div className="px-3 pt-3 pb-2 flex flex-wrap gap-1.5">
              {quickCommands.map(cmd => (
                <button
                  key={cmd.label}
                  onClick={() => sendMessage(cmd.text)}
                  disabled={isLoading}
                  className={`text-[10px] px-2.5 py-1.5 rounded-lg bg-white/[0.03] border border-white/[0.06] text-slate-400 transition-all ${c.quick} disabled:opacity-40`}
                >
                  {cmd.label}
                </button>
              ))}
            </div>
          )}

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3 min-h-[120px]">
            {messages.length === 0 && !isLoading && (
              <p className="text-xs text-slate-600 text-center pt-4">Ask {agentLabel} anything about this page...</p>
            )}
            {messages.map((msg, i) => (
              <div key={i} className={`flex gap-2 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                {msg.role === "assistant" && <span className="text-base flex-shrink-0 mt-0.5">{agentEmoji}</span>}
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${
                  msg.role === "user" ? "bg-slate-700 text-white" : "bg-white/[0.04] border border-white/[0.06] text-slate-200"
                }`}>
                  {msg.role === "user" ? (
                    <p>{msg.content}</p>
                  ) : (
                    <ReactMarkdown className="prose prose-sm prose-invert max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                      {msg.content}
                    </ReactMarkdown>
                  )}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-2">
                <span className="text-base">{agentEmoji}</span>
                <div className="bg-white/[0.04] border border-white/[0.06] rounded-xl px-3 py-2 flex items-center gap-1.5">
                  <Loader2 className={`w-3 h-3 animate-spin text-${accentColor}-400`} />
                  <span className="text-[10px] text-slate-500">Thinking...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 pb-3 pt-1 border-t border-white/[0.04]">
            <div className="flex gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); sendMessage(); } }}
                placeholder={`Ask ${agentLabel}...`}
                className="flex-1 bg-white/[0.04] border border-white/[0.06] rounded-lg px-3 py-2 text-xs text-white placeholder:text-slate-600 focus:outline-none focus:border-white/[0.15]"
              />
              <button
                onClick={() => sendMessage()}
                disabled={!input.trim() || isLoading}
                className={`p-2 rounded-lg border transition-all ${c.btn} disabled:opacity-40`}
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}