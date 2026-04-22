"use client";

import {
  Area, AreaChart, CartesianGrid, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis, Cell,
  Bar, BarChart, Legend
} from "recharts";

export function TimelineChart({
  data,
}: {
  data: Array<{ time: string; avgLatency: number; errors: number; warns: number }>;
}) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="latencyGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#22d3ee" stopOpacity={0.5} />
              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}   />
            </linearGradient>
            <linearGradient id="errorGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#fb7185" stopOpacity={0.4} />
              <stop offset="95%" stopColor="#fb7185" stopOpacity={0}   />
            </linearGradient>
            <linearGradient id="warnGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%"  stopColor="#fbbf24" stopOpacity={0.3} />
              <stop offset="95%" stopColor="#fbbf24" stopOpacity={0}   />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="time" tick={{ fill: "#94a3b8", fontSize: 11 }} />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: "#081120",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 16,
              fontSize: 12,
            }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: "#94a3b8", paddingTop: 12 }} />
          <Area type="monotone" dataKey="avgLatency" name="Avg Latency (ms)" stroke="#22d3ee" fill="url(#latencyGrad)" strokeWidth={2} />
          <Area type="monotone" dataKey="errors"     name="Errors"           stroke="#fb7185" fill="url(#errorGrad)"   strokeWidth={2} />
          <Area type="monotone" dataKey="warns"      name="Warnings"         stroke="#fbbf24" fill="url(#warnGrad)"    strokeWidth={2} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

const COLORS = ["#22d3ee", "#a78bfa", "#34d399", "#fb7185", "#f59e0b", "#60a5fa", "#c084fc", "#2dd4bf"];

export function DistributionPie({ data }: { data: Array<{ name: string; value: number }> }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Tooltip
            contentStyle={{
              background: "#081120",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 16,
            }}
          />
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={65} outerRadius={96} paddingAngle={4}>
            {data.map((_, index) => (
              <Cell key={index} fill={COLORS[index % COLORS.length]} />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function ApplicationBar({ data }: { data: Array<{ name: string; value: number }> }) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data}>
          <CartesianGrid stroke="rgba(255,255,255,0.06)" />
          <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 11 }} />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: "#081120",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 16,
            }}
          />
          <Bar dataKey="value" name="Records" fill="#a78bfa" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const LEVEL_COLORS: Record<string, string> = {
  ERROR: "#fb7185",
  WARN:  "#fbbf24",
  INFO:  "#22d3ee",
  DEBUG: "#94a3b8",
};

export function LevelBreakdownBar({
  data,
  total,
}: {
  data: Array<{ name: string; value: number }>;
  total: number;
}) {
  if (!total) return null;
  return (
    <div className="space-y-3">
      {data.map((item) => {
        const pct = Math.round((item.value / total) * 100);
        const color = LEVEL_COLORS[item.name] || "#94a3b8";
        return (
          <div key={item.name}>
            <div className="mb-1 flex justify-between text-xs">
              <span style={{ color }} className="font-mono font-semibold">{item.name}</span>
              <span className="text-slate-400">{pct}%</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, background: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

