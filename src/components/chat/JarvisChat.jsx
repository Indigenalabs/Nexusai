import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, X, Send, Loader2, Sparkles, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { base44 } from "@/api/base44Client";
import NexusBrain from "@/components/dashboard/NexusBrain";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ReactMarkdown from "react-markdown";

export default function JarvisChat() {
  const [isOpen, setIsOpen] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [conversation, setConversation] = useState(null);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    base44.agents.createConversation({
      agent_name: "nexus_agent",
      metadata: { name: "Nexus Quick Chat" }
    }).then(setConversation).catch(() => {});
  }, []);

  useEffect(() => {
    if (!conversation?.id) return;
    let isMounted = true;
    const unsubscribe = base44.agents.subscribeToConversation(conversation.id, (data) => {
      if (!isMounted) return;
      const combined = data.messages
        .filter(m => (m.role === "user" || m.role === "assistant") && m.content)
        .map(m => ({ role: m.role, content: m.content }));
      setMessages(combined);
      const lastMsg = data.messages[data.messages.length - 1];
      if (lastMsg?.role === "assistant" && lastMsg?.content) setIsLoading(false);
    });
    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, [conversation?.id]);

  const handleSend = async () => {
    if (!input.trim() || isLoading || !conversation) return;
    const userMessage = input.trim();
    setInput("");
    setIsLoading(true);
    setMessages(prev => [...prev, { role: "user", content: userMessage }]);
    await base44.agents.addMessage(conversation, { role: "user", content: userMessage });
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isDismissed) return null;

  return (
    <>
      {/* Floating Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="fixed bottom-6 right-6 z-50"
          >
            <motion.button
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsOpen(true)}
              className="p-4 rounded-full bg-gradient-to-r from-blue-600 to-violet-600 shadow-2xl hover:shadow-blue-500/50 transition-all"
            >
              <Brain className="w-6 h-6 text-white" />
            </motion.button>
            <button
              onClick={() => setIsDismissed(true)}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-slate-800 border border-white/[0.1] flex items-center justify-center text-slate-400 hover:text-white hover:bg-slate-700 transition-all"
            >
              <X className="w-3 h-3" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="fixed bottom-6 right-6 z-50 w-[400px] h-[600px] rounded-2xl bg-[hsl(222,42%,8%)] border border-white/[0.1] shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/[0.1] flex items-center justify-between bg-gradient-to-r from-blue-600/20 to-violet-600/20">
              <div className="flex items-center gap-3">
                <NexusBrain size={32} isThinking={isLoading} />
                <div>
                  <h3 className="text-white font-semibold text-sm">Nexus AI</h3>
                  <p className="text-xs text-slate-400">
                    {isLoading ? "Executing..." : "Your AI Chief of Operations"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Link
                  to={createPageUrl("AICommandCenter")}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.1] transition-all"
                  title="Open Command Center"
                >
                  <Maximize2 className="w-4 h-4" />
                </Link>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/[0.1] transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 overflow-x-hidden">
              {messages.length === 0 && !isLoading && (
                <div className="text-center py-8">
                  <Sparkles className="w-8 h-8 text-violet-400/40 mx-auto mb-3" />
                  <p className="text-sm text-slate-500">Ask Nexus to do anything — or open the <Link to={createPageUrl("AICommandCenter")} className="text-blue-400 hover:underline">Command Center</Link> for full autonomy mode.</p>
                </div>
              )}

              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                    msg.role === "user"
                      ? "bg-blue-600 text-white"
                      : "bg-white/[0.06] text-slate-200 border border-white/[0.08]"
                  }`}>
                    {msg.role === "assistant" && (
                      <div className="flex items-center gap-2 mb-1">
                        <Sparkles className="w-3 h-3 text-violet-400" />
                        <span className="text-xs text-violet-400 font-medium">Nexus</span>
                      </div>
                    )}
                    {msg.role === "assistant" ? (
                      <ReactMarkdown
                        className="prose prose-invert prose-sm max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                        components={{
                          p: ({ children }) => <p className="my-0.5 text-slate-200">{children}</p>,
                          ul: ({ children }) => <ul className="my-1 ml-4 list-disc">{children}</ul>,
                          li: ({ children }) => <li className="text-slate-300">{children}</li>,
                          strong: ({ children }) => <strong className="text-white">{children}</strong>,
                        }}
                      >{msg.content}</ReactMarkdown>
                    ) : (
                      <p className="whitespace-pre-wrap">{msg.content}</p>
                    )}
                  </div>
                </motion.div>
              ))}

              {isLoading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
                  <div className="bg-white/[0.06] rounded-2xl px-4 py-2.5 border border-white/[0.08] flex items-center gap-2">
                    <Loader2 className="w-3.5 h-3.5 text-violet-400 animate-spin" />
                    <span className="text-xs text-violet-400">Nexus executing...</span>
                  </div>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-4 border-t border-white/[0.1]">
              <div className="flex gap-2">
                <input
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={handleKeyPress}
                  placeholder="Command Nexus..."
                  className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:border-blue-500/40 transition-all"
                  disabled={isLoading || !conversation}
                />
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading || !conversation}
                  className="bg-blue-600 hover:bg-blue-700 rounded-xl px-3"
                >
                  <Send className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}