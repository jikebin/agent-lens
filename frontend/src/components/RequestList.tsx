"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { RequestInfo } from "@/types";
import { formatDate, formatTokens } from "@/lib/format";

type ApiFormatFilter = "all" | RequestInfo["api_format"];

const formatLabels: Record<ApiFormatFilter, string> = {
  all: "All",
  openai: "OpenAI",
  responses: "Responses",
  anthropic: "Anthropic",
};

const formatBadgeClass: Record<RequestInfo["api_format"], string> = {
  openai: "bg-emerald-900/40 text-emerald-400",
  responses: "bg-cyan-900/40 text-cyan-400",
  anthropic: "bg-amber-900/40 text-amber-400",
};

export function RequestList({ requests }: { requests: RequestInfo[] }) {
  const [formatFilter, setFormatFilter] = useState<ApiFormatFilter>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "success" | "error">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    return requests.filter((req) => {
      if (formatFilter !== "all" && req.api_format !== formatFilter) return false;
      if (statusFilter !== "all" && req.status !== statusFilter) return false;
      if (search && !req.request_id.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [requests, formatFilter, statusFilter, search]);

  if (requests.length === 0) {
    return (
      <div className="text-center py-20 text-secondary">
        <p>No requests recorded for this project yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-3">
        {/* Format toggle */}
        <div className="flex rounded-lg border border-surface-raised overflow-hidden">
          {(["all", "openai", "responses", "anthropic"] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFormatFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                formatFilter === f
                  ? "bg-indigo-600 text-white"
                  : "bg-surface text-secondary hover:text-secondary-bright"
              }`}
            >
              {formatLabels[f]}
            </button>
          ))}
        </div>

        {/* Status toggle */}
        <div className="flex rounded-lg border border-surface-raised overflow-hidden">
          {(["all", "success", "error"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                statusFilter === s
                  ? s === "error"
                    ? "bg-red-600 text-white"
                    : s === "success"
                    ? "bg-emerald-600 text-white"
                    : "bg-indigo-600 text-white"
                  : "bg-surface text-secondary hover:text-secondary-bright"
              }`}
            >
              {s === "all" ? "All" : s === "success" ? "Success" : "Error"}
            </button>
          ))}
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search request ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="bg-surface border border-surface-raised rounded-lg px-3 py-1.5 text-xs text-primary placeholder-muted focus:outline-none focus:border-indigo-500/50 transition-colors w-48"
        />
      </div>

      {/* Request list */}
      <div className="space-y-2">
        {filtered.map((req) => (
          <Link
            key={req.id}
            href={`/requests/${req.id}`}
            className="flex items-center justify-between rounded-lg border border-surface-raised bg-surface p-4 hover:border-indigo-500/30 transition-all"
          >
            <div className="flex items-center gap-3">
              {req.status === "error" && (
                <span className="w-2 h-2 rounded-full bg-red-500 flex-shrink-0" />
              )}
              <span
                className={`text-xs font-medium px-2 py-0.5 rounded ${formatBadgeClass[req.api_format]}`}
              >
                {req.api_format}
              </span>
              <span
                className={`text-xs px-2 py-0.5 rounded ${
                  req.is_stream
                    ? "bg-violet-900/40 text-violet-400"
                    : "bg-surface-raised text-secondary"
                }`}
              >
                {req.is_stream ? "streaming" : "non-stream"}
              </span>
              {req.status === "error" && (
                <span className="text-xs px-2 py-0.5 rounded bg-red-900/40 text-red-400">
                  error
                </span>
              )}
              <span className="text-xs text-secondary font-mono">
                {req.request_id.slice(0, 8)}...
              </span>
            </div>
            <div className="flex items-center gap-3">
              {req.total_tokens > 0 && (
                <span className="text-xs text-cyan-400">
                  {formatTokens(req.total_tokens)} tok
                </span>
              )}
              <span className="text-xs text-muted">
                {formatDate(req.created_at)}
              </span>
            </div>
          </Link>
        ))}
        {filtered.length === 0 && (
          <div className="text-center py-10 text-secondary text-sm">
            No requests match the current filters.
          </div>
        )}
      </div>
    </div>
  );
}
