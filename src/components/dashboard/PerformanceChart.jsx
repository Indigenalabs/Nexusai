import React from "react";
import { motion } from "framer-motion";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

const sampleData = [
  { name: "Mon", tasks: 12, insights: 4, engagement: 85 },
  { name: "Tue", tasks: 19, insights: 7, engagement: 92 },
  { name: "Wed", tasks: 15, insights: 3, engagement: 78 },
  { name: "Thu", tasks: 25, insights: 9, engagement: 110 },
  { name: "Fri", tasks: 22, insights: 6, engagement: 95 },
  { name: "Sat", tasks: 8, insights: 2, engagement: 45 },
  { name: "Sun", tasks: 5, insights: 1, engagement: 30 },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-slate-900/95 border border-white/10 rounded-xl px-4 py-3 shadow-xl backdrop-blur-sm">
      <p className="text-xs text-slate-400 mb-2">{label}</p>
      {payload.map((entry, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <div className="w-2 h-2 rounded-full" style={{ background: entry.color }} />
          <span className="text-slate-300 capitalize">{entry.name}:</span>
          <span className="text-white font-semibold">{entry.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function PerformanceChart() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3, duration: 0.5 }}
      className="rounded-2xl bg-white/[0.03] border border-white/[0.06] p-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-sm font-semibold text-white">System Performance</h3>
          <p className="text-xs text-slate-500 mt-0.5">AI operations this week</p>
        </div>
        <div className="flex gap-4">
          {[
            { label: "Tasks", color: "#3b82f6" },
            { label: "Insights", color: "#8b5cf6" },
            { label: "Engagement", color: "#06b6d4" },
          ].map((item) => (
            <div key={item.label} className="flex items-center gap-1.5">
              <div className="w-2 h-2 rounded-full" style={{ background: item.color }} />
              <span className="text-[10px] text-slate-500">{item.label}</span>
            </div>
          ))}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={sampleData}>
          <defs>
            <linearGradient id="taskGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="insightGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="engageGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.3} />
              <stop offset="100%" stopColor="#06b6d4" stopOpacity={0} />
            </linearGradient>
          </defs>
          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: "#475569", fontSize: 11 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "#475569", fontSize: 11 }} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="tasks" stroke="#3b82f6" fill="url(#taskGrad)" strokeWidth={2} />
          <Area type="monotone" dataKey="insights" stroke="#8b5cf6" fill="url(#insightGrad)" strokeWidth={2} />
          <Area type="monotone" dataKey="engagement" stroke="#06b6d4" fill="url(#engageGrad)" strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </motion.div>
  );
}