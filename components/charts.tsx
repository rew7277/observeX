"use client";

import { Area, AreaChart, CartesianGrid, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Cell, Bar, BarChart } from "recharts";

export function TimelineChart({ data }: { data: Array<{ time: string; avgLatency: number; errors: number }> }) {
  return (
    <div className="h-80 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          <defs>
            <linearGradient id="latency" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.8}/>
              <stop offset="95%" stopColor="#22d3ee" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey="time" tick={{ fill: "#94a3b8", fontSize: 12 }} />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
          <Tooltip contentStyle={{ background: "#081120", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16 }} />
          <Area type="monotone" dataKey="avgLatency" stroke="#22d3ee" fillOpacity={1} fill="url(#latency)" />
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
          <Tooltip contentStyle={{ background: "#081120", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16 }} />
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
          <CartesianGrid stroke="rgba(255,255,255,0.08)" />
          <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
          <YAxis tick={{ fill: "#94a3b8", fontSize: 12 }} />
          <Tooltip contentStyle={{ background: "#081120", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 16 }} />
          <Bar dataKey="value" fill="#a78bfa" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
