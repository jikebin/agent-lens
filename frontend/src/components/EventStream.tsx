"use client";

import { useState, useEffect } from "react";
import type { StreamEvent } from "@/types";
import { api } from "@/lib/api";

export function EventStream({ requestRowId }: { requestRowId: number }) {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.getRequestEvents(requestRowId, page, 50).then((res) => {
      setEvents(res.items);
      setTotal(res.total);
      setTotalPages(res.total_pages);
      setLoading(false);
    });
  }, [requestRowId, page]);

  if (loading && events.length === 0) {
    return (
      <div className="text-center py-12 text-[#64748b]">
        Loading events...
      </div>
    );
  }

  if (!loading && total === 0) {
    return (
      <div className="text-center py-12 text-[#64748b]">
        No stream events recorded for this request.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="text-xs text-[#64748b] mb-3">
        Total events: {total}
      </div>
      {events.map((event) => (
        <EventRow key={event.id} event={event} />
      ))}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 pt-4 pb-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-xs px-3 py-1.5 rounded-md border border-[#1e1e2e] text-[#94a3b8] hover:bg-[#1e1e2e] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-xs text-[#64748b]">
            Page {page} of {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="text-xs px-3 py-1.5 rounded-md border border-[#1e1e2e] text-[#94a3b8] hover:bg-[#1e1e2e] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}

function EventRow({ event }: { event: StreamEvent }) {
  const [expanded, setExpanded] = useState(false);

  const eventData = event.event_data;

  const typeColors: Record<string, string> = {
    openai_chunk: "bg-emerald-900/40 text-emerald-400",
    openai_chunk_raw: "bg-emerald-900/40 text-emerald-400",
    message_start: "bg-indigo-900/40 text-indigo-400",
    message_delta: "bg-indigo-900/40 text-indigo-400",
    message_stop: "bg-indigo-900/40 text-indigo-400",
    content_block_start: "bg-violet-900/40 text-violet-400",
    content_block_start_tool: "bg-cyan-900/40 text-cyan-400",
    content_block_delta: "bg-violet-900/40 text-violet-400",
    content_block_delta_tool: "bg-cyan-900/40 text-cyan-400",
    content_block_stop: "bg-violet-900/40 text-violet-400",
    content_block_stop_tool: "bg-cyan-900/40 text-cyan-400",
  };

  return (
    <div
      className="rounded-lg border border-[#1e1e2e] bg-[#12121a]/50 p-2 cursor-pointer hover:bg-[#12121a] transition-colors"
      onClick={() => setExpanded(!expanded)}
    >
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#475569] w-8">#{event.sequence}</span>
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded ${
            typeColors[event.event_type] || "bg-[#1e1e2e] text-[#64748b]"
          }`}
        >
          {event.event_type}
        </span>
        {!expanded && eventData && (
          <span className="text-xs text-[#475569] truncate flex-1">
            {JSON.stringify(eventData).slice(0, 100)}
          </span>
        )}
      </div>
      {expanded && eventData && (
        <pre className="mt-2 text-xs text-[#cbd5e1] bg-[#0a0a0f] p-2 rounded-lg overflow-x-auto">
          {JSON.stringify(eventData, null, 2)}
        </pre>
      )}
    </div>
  );
}
