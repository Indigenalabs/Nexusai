import React from "react";
import { motion } from "framer-motion";

const phases = [
  { number: 1, name: "Foundation", months: "1-9", color: "bg-blue-500" },
  { number: 2, name: "Growth", months: "10-24", color: "bg-violet-500" },
  { number: 3, name: "Scale", months: "25-36", color: "bg-emerald-500" },
  { number: 4, name: "Dominance", months: "37-48", color: "bg-amber-500" },
];

export default function TimelineView({ currentPhase = 1 }) {
  return (
    <div className="relative">
      {/* Timeline Bar */}
      <div className="flex items-center gap-1 mb-6">
        {phases.map((phase, i) => {
          const isActive = phase.number === currentPhase;
          const isCompleted = phase.number < currentPhase;
          
          return (
            <React.Fragment key={phase.number}>
              <motion.div
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: i * 0.2, duration: 0.5 }}
                className="relative flex-1"
              >
                <div className={`h-2 rounded-full transition-all ${
                  isCompleted ? phase.color : isActive ? `${phase.color} opacity-60` : "bg-slate-800"
                }`}>
                  {isActive && (
                    <motion.div
                      animate={{ x: [0, 100, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 bg-white/20 rounded-full"
                      style={{ width: "30%" }}
                    />
                  )}
                </div>
                <div className="absolute -bottom-8 left-0 right-0">
                  <p className={`text-[10px] font-medium ${
                    isActive ? "text-white" : "text-slate-600"
                  }`}>
                    Phase {phase.number}
                  </p>
                  <p className="text-[9px] text-slate-700">Mo {phase.months}</p>
                </div>
              </motion.div>
              {i < phases.length - 1 && (
                <div className="w-2 h-2 rounded-full bg-slate-700 flex-shrink-0" />
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}