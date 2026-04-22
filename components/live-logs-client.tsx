"use client";

import { useState, useMemo } from "react";
import { Search, X, ChevronDown, Clock, Layers, Hash, Tag, MessageSquare, Activity } from "lucide-react";
import type { LogRecord } from "@/lib/log-parser";

const LEVEL_COLORS: Record<string, string> = {
  ERROR: "text-rose-400 bg-rose-400/10 ring-rose-400/30",
  WARN:  "text-amber-300 bg-amber-400/10 ring-amber-400/30",
  INFO:  "text-cyan-300 bg-cyan-400/10 ring-cyan-400/30",
  DEBUG: "text-slate-400 bg-slate-400/10 ring-slate-400/20",
};

const PAGE_SIZE = 60;

export function LiveLogsClient({ records }: { records: LogRecord[] }) {
  const [search,      setSearch]      = useState("");
  const [levelFilter, setLevelFilter] = useState("ALL");
  const [dateFrom,    setDateFrom]    = useState("");
  const [dateTo,      setDateTo]      = useState("");
  const [selected,    setSelected]    = useState<LogRecord | null>(null);
  const [page,        setPage]        = useState(1);

  // Unique levels present in data
  const levels = useMemo(() => {
    const s = new Set(records.map((r) => r.level));
    return ["ALL", ...Array.from(s).sort()];
  }, [records]);

  // Filtered + sorted records
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return records.filter((r) => {
      if (levelFilter !== "ALL" && r.level !== levelFilter) return false;
      if (dateFrom) {
        const ts = new Date(String(r.timestamp)).getTime();
        if (!isNaN(ts) && ts < new Date(dateFrom).getTime()) return false;
      }
      if (dateTo) {
        const ts = new Date(String(r.timestamp)).getTime();
        if (!isNaN(ts) && ts > new Date(dateTo + "T23:59:59").getTime()) return false;
      }
      if (q) {
        const hay = [r.message, r.application, r.traceId, r.environment, r.level]
          .join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [records, search, levelFilter, dateFrom, dateTo]);

  const paginated = filtered.slice(0, page * PAGE_SIZE);
  const hasMore   = paginated.length < filtered.length;

  const clearFilters = () => {
    setSearch(""); setLevelFilter("ALL"); setDateFrom(""); setDateTo(""); setPage(1);
  };
  const hasActiveFilter = search || levelFilter !== "ALL" || dateFrom || dateTo;

  return (
    <div className="flex gap-5">
      {/* ── Main log table ─────────────────────────────────── */}
      <div className="min-w-0 flex-1 space-y-4">

        {/* Filter bar */}
        <div className="glass rounded-[24px] p-4">
          <div className="flex flex-wrap gap-3">
            {/* Keyword search */}
            <div className="relative flex-1 min-w-48">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className="input pl-9"
                placeholder="Search message, app, trace ID…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
              {search && (
                <button onClick={() => { setSearch(""); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            {/* Level filter */}
            <div className="relative">
              <select
                className="input appearance-none pr-8 min-w-[120px]"
                value={levelFilter}
                onChange={(e) => { setLevelFilter(e.target.value); setPage(1); }}
              >
                {levels.map((l) => <option key={l} value={l}>{l === "ALL" ? "All levels" : l}</option>)}
              </select>
              <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            </div>

            {/* Date from */}
            <input
              type="date"
              className="input w-auto"
              value={dateFrom}
              onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
              title="From date"
            />

            {/* Date to */}
            <input
              type="date"
              className="input w-auto"
              value={dateTo}
              onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
              title="To date"
            />

            {hasActiveFilter && (
              <button onClick={clearFilters} className="btn-secondary flex items-center gap-2 py-2 px-4 text-xs">
                <X className="h-3 w-3" /> Clear
              </button>
            )}
          </div>

          <div className="mt-3 flex items-center gap-2 text-xs text-slate-500">
            <Activity className="h-3 w-3" />
            Showing <span className="text-slate-300 font-medium">{paginated.length.toLocaleString()}</span> of{" "}
            <span className="text-slate-300 font-medium">{filtered.length.toLocaleString()}</span> matching records
            {hasActiveFilter && <span>(filtered from {records.length.toLocaleString()} total)</span>}
          </div>
        </div>

        {/* Table */}
        <div className="glass overflow-hidden rounded-[24px]">
          {/* Header */}
          <div className="grid grid-cols-[140px_80px_140px_110px_130px_1fr] gap-2 border-b border-white/10 bg-white/[0.05] px-4 py-3 text-[11px] uppercase tracking-[0.18em] text-slate-400">
            <div>Timestamp</div>
            <div>Level</div>
            <div>Application</div>
            <div>Environment</div>
            <div>Trace ID</div>
            <div>Message</div>
          </div>

          {paginated.length === 0 && (
            <div className="px-4 py-16 text-center text-sm text-slate-500">
              {records.length === 0
                ? "Upload log files to explore records here."
                : "No records match your current filters."}
            </div>
          )}

          {paginated.map((row, i) => {
            const levelCls = LEVEL_COLORS[row.level] ?? LEVEL_COLORS.DEBUG;
            const isSelected = selected === row;
            return (
              <div
                key={`${row.traceId || "—"}-${i}`}
                onClick={() => setSelected(isSelected ? null : row)}
                className={`grid cursor-pointer grid-cols-[140px_80px_140px_110px_130px_1fr] gap-2 border-b border-white/5 px-4 py-3 text-xs transition last:border-0 ${
                  isSelected ? "bg-cyan-400/10 ring-inset ring-1 ring-cyan-400/30" : "hover:bg-white/[0.05]"
                }`}
              >
                <div className="truncate font-mono text-slate-400">{String(row.timestamp).slice(0, 19)}</div>
                <div>
                  <span className={`inline-flex items-center rounded-lg px-2 py-0.5 text-[10px] font-semibold ring-1 ${levelCls}`}>
                    {row.level}
                  </span>
                </div>
                <div className="truncate text-slate-300">{row.application}</div>
                <div className="truncate text-slate-400">{row.environment}</div>
                <div className="truncate font-mono text-violet-300 text-[10px]">{row.traceId || "—"}</div>
                <div className="truncate text-slate-200">{row.message}</div>
              </div>
            );
          })}
        </div>

        {/* Load more */}
        {hasMore && (
          <div className="flex justify-center">
            <button
              onClick={() => setPage((p) => p + 1)}
              className="btn-secondary text-sm"
            >
              Load more ({(filtered.length - paginated.length).toLocaleString()} remaining)
            </button>
          </div>
        )}
      </div>

      {/* ── Detail drawer ──────────────────────────────────── */}
      <div
        className={`glass rounded-[24px] overflow-hidden transition-all duration-300 ease-in-out ${
          selected ? "w-96 opacity-100" : "w-0 opacity-0 pointer-events-none"
        }`}
        style={{ flexShrink: 0 }}
      >
        {selected && (
          <div className="flex h-full flex-col p-5">
            {/* Header */}
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm font-semibold text-slate-100">Log Detail</div>
                <div className="mt-0.5 text-xs text-slate-400">Full record inspection</div>
              </div>
              <button
                onClick={() => setSelected(null)}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.05] text-slate-400 hover:text-white transition"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Level badge */}
            <div className="mt-4">
              <span className={`inline-flex items-center rounded-xl px-3 py-1.5 text-sm font-semibold ring-1 ${LEVEL_COLORS[selected.level] ?? LEVEL_COLORS.DEBUG}`}>
                {selected.level}
              </span>
            </div>

            {/* Fields */}
            <div className="mt-4 flex-1 overflow-y-auto space-y-3">
              {[
                { icon: Clock,        label: "Timestamp",   value: String(selected.timestamp) },
                { icon: Layers,       label: "Application", value: selected.application },
                { icon: Tag,          label: "Environment", value: selected.environment },
                { icon: Hash,         label: "Trace ID",    value: selected.traceId || "—" },
                { icon: Activity,     label: "Latency",     value: `${selected.latencyMs} ms` },
              ].map(({ icon: Icon, label, value }) => (
                <div key={label} className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
                    <Icon className="h-3 w-3" />
                    {label}
                  </div>
                  <div className="mt-1.5 break-all font-mono text-xs text-slate-200">{value}</div>
                </div>
              ))}

              {/* Message — full text, no truncation */}
              <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
                  <MessageSquare className="h-3 w-3" />
                  Message
                </div>
                <div className="mt-1.5 whitespace-pre-wrap break-words text-xs leading-5 text-slate-100">
                  {selected.message}
                </div>
              </div>

              {selected.payloadJson ? (
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
                  <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-slate-500">
                    <Layers className="h-3 w-3" />
                    Structured payload
                  </div>
                  <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-black/20 p-3 text-[11px] leading-5 text-slate-300">
{JSON.stringify(selected.payloadJson, null, 2)}
                  </pre>
                </div>
              ) : null}
            </div>

            {/* Nav between records */}
            <div className="mt-4 border-t border-white/10 pt-4 text-center text-xs text-slate-500">
              Click any row to inspect it
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
