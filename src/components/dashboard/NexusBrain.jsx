import React from "react";
import { motion } from "framer-motion";

export default function NexusBrain({ size = 120, isThinking = false }) {
  return (
    <div className="relative" style={{ width: size, height: size }}>
      {/* Outer glow ring */}
      <motion.div
        animate={{
          scale: isThinking ? [1, 1.15, 1] : [1, 1.05, 1],
          opacity: isThinking ? [0.3, 0.6, 0.3] : [0.15, 0.3, 0.15],
        }}
        transition={{ duration: isThinking ? 1.5 : 3, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-0 rounded-full bg-gradient-to-r from-blue-500 via-violet-500 to-cyan-500 blur-xl"
      />
      {/* Middle ring */}
      <motion.div
        animate={{
          rotate: 360,
        }}
        transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
        className="absolute inset-2 rounded-full border border-blue-500/30"
        style={{
          background: "conic-gradient(from 0deg, transparent, rgba(59,130,246,0.15), transparent, rgba(139,92,246,0.15), transparent)",
        }}
      />
      {/* Inner core */}
      <motion.div
        animate={{
          scale: isThinking ? [1, 1.08, 1] : [1, 1.03, 1],
        }}
        transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        className="absolute inset-4 rounded-full bg-gradient-to-br from-blue-600/40 via-violet-600/30 to-cyan-600/40 border border-white/10 flex items-center justify-center"
      >
        <motion.div
          animate={{ opacity: isThinking ? [0.5, 1, 0.5] : 0.7 }}
          transition={{ duration: 1, repeat: Infinity }}
          className="text-white/90 font-bold tracking-widest"
          style={{ fontSize: size * 0.12 }}
        >
          N
        </motion.div>
      </motion.div>
      {/* Orbiting dots */}
      {[0, 120, 240].map((deg, i) => (
        <motion.div
          key={i}
          animate={{ rotate: [deg, deg + 360] }}
          transition={{ duration: 8 + i * 2, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0"
          style={{ transformOrigin: "center" }}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              ["bg-blue-400", "bg-violet-400", "bg-cyan-400"][i]
            }`}
            style={{ position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)" }}
          />
        </motion.div>
      ))}
    </div>
  );
}