import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  Sparkles, Loader2, CheckCircle2, AlertTriangle, Zap, RefreshCw, Layers
} from "lucide-react";

const CANVAS_ACTIONS = [
  {
    id: "creative_audit",
    label: "Creative Audit",
    description: "Scan your asset library for gaps and generate a priority creation list.",
    icon: RefreshCw,
    color: "purple",
    fn: "canvasAutopilot",
  },
  {
    id: "generate_brand_kit",
    label: "Generate Brand Kit",
    description: "Auto-generate hero images, bios, taglines and brand copy for all platforms.",
    icon: Sparkles,
    color: "pink",
    fn: "canvasAutopilot",
  },
  {
    id: "batch_generate_social",
    label: "Month of Content",
    description: "Generate a full month of social post drafts across Instagram & LinkedIn.",
    icon: Layers,
    color: "violet",
    fn: "canvasAutopilot",
    payload: { platforms: ["instagram", "linkedin"], postsPerWeek: 3 },
  },
];

const COLOR_MAP = {
  purple: { bg: "bg-purple-500/10", border: "border-purple-500/20", text: "text-purple-400", btn: "bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border-purple-500/30" },
  pink:   { bg: "bg-pink-500/10",   border: "border-pink-500/20",   text: "text-pink-400",   btn: "bg-pink-500/20 hover:bg-pink-500/30 text-pink-400 border-pink-500/30" },
  violet: { bg: "bg-violet-500/10", border: "border-violet-500/20", text: "text-violet-400", btn: "bg-violet-500/20 hover:bg-violet-500/30 text-violet-400 border-violet-500/30" },
};

export default function CanvasAutopilotPanel({ onComplete }) {
  const [running, setRunning] = useState({});
  const [results, setResults] = useState({});

  const runAction = async (action) => {
    setRunning(r => ({ ...r, [action.id]: true }));
    try {
      const res = await base44.functions.invoke(action.fn, {
        action: action.id,
        ...(action.payload || {}),
      });
      setResults(r => ({ ...r, [action.id]: res.data }));
      if (onComplete) onComplete();
    } catch (e) {
      setResults(r => ({ ...r, [action.id]: { error: e.message } }));
    }
    setRunning(r => ({ ...r, [action.id]: false }));
  };

  return (
    <div className="space-y-2 p-3 border-t border-white/[0.06]">
      <p className="text-[10px] text-slate-600 uppercase tracking-wider">Autopilot</p>
      {CANVAS_ACTIONS.map((action) => {
        const c = COLOR_MAP[action.color];
        const isRunning = running[action.id];
        const result = results[action.id];
        const Icon = action.icon;

        return (
          <motion.div
            key={action.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className={`rounded-xl border ${c.border} ${c.bg} p-3`}
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-2">
                <Icon className={`w-3.5 h-3.5 ${c.text}`} />
                <span className={`text-xs font-semibold ${c.text}`}>{action.label}</span>
              </div>
              <Button
                size="sm"
                onClick={() => runAction(action)}
                disabled={isRunning}
                className={`h-6 text-[10px] px-2 border ${c.btn}`}
              >
                {isRunning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                {isRunning ? "Working..." : "Run"}
              </Button>
            </div>
            <p className="text-[10px] text-slate-500">{action.description}</p>
            {result && !result.error && (
              <div className="mt-1.5 flex items-center gap-1 text-[10px] text-emerald-400">
                <CheckCircle2 className="w-3 h-3" />
                {result.items_created !== undefined && `${result.items_created} brand assets created`}
                {result.posts_created !== undefined && `${result.posts_created} posts drafted`}
                {result.audit !== undefined && `Audit complete · ${result.audit.gaps?.length || 0} gaps found`}
              </div>
            )}
            {result?.error && (
              <div className="mt-1.5 flex items-center gap-1 text-[10px] text-red-400">
                <AlertTriangle className="w-3 h-3" />
                {result.error}
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}