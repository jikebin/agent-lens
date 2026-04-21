"use client";

import Link from "next/link";
import type { RequestInfo } from "@/types";
import { formatDate } from "@/lib/format";

export function RequestList({ requests }: { requests: RequestInfo[] }) {
  if (requests.length === 0) {
    return (
      <div className="text-center py-20 text-[#64748b]">
        <p>No requests recorded for this project yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {requests.map((req) => (
        <Link
          key={req.id}
          href={`/requests/${req.id}`}
          className="flex items-center justify-between rounded-lg border border-[#1e1e2e] bg-[#12121a] p-4 hover:border-indigo-500/30 transition-all"
        >
          <div className="flex items-center gap-3">
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded ${
                req.api_format === "openai"
                  ? "bg-emerald-900/40 text-emerald-400"
                  : "bg-amber-900/40 text-amber-400"
              }`}
            >
              {req.api_format}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded ${
                req.is_stream
                  ? "bg-violet-900/40 text-violet-400"
                  : "bg-[#1e1e2e] text-[#64748b]"
              }`}
            >
              {req.is_stream ? "streaming" : "non-stream"}
            </span>
            <span className="text-xs text-[#64748b] font-mono">
              {req.request_id.slice(0, 8)}...
            </span>
          </div>
          <span className="text-xs text-[#475569]">
            {formatDate(req.created_at)}
          </span>
        </Link>
      ))}
    </div>
  );
}
