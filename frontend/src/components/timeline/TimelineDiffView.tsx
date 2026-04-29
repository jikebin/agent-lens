"use client";

import { useState } from "react";
import type { Message } from "@/types";
import { computeDiff, computeJsonDiff, type DiffLine } from "@/lib/diff";

export function TimelineDiffView({
  prevMessage,
  currentMessage,
}: {
  prevMessage: Message;
  currentMessage: Message;
}) {
  const [expanded, setExpanded] = useState(false);

  const contentDiff = computeDiff(prevMessage.content ?? "", currentMessage.content ?? "");
  const hasContentDiff = contentDiff.some((d) => d.type !== "unchanged");

  const toolCallsDiff = computeJsonDiff(prevMessage.tool_calls, currentMessage.tool_calls);
  const hasToolDiff = toolCallsDiff.some((d) => d.type !== "unchanged");

  if (!hasContentDiff && !hasToolDiff) return null;

  return (
    <div className="border-b border-surface-raised">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-2 text-xs text-secondary hover:text-secondary-bright transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          Diff from #{prevMessage.sequence} → #{currentMessage.sequence}
        </span>
        <svg
          className={`w-3.5 h-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="px-4 pb-3 space-y-2">
          {hasContentDiff && (
            <DiffBlock label="Content" lines={contentDiff} />
          )}
          {hasToolDiff && (
            <DiffBlock label="Tool Calls" lines={toolCallsDiff} />
          )}
        </div>
      )}
    </div>
  );
}

function DiffBlock({ label, lines }: { label: string; lines: DiffLine[] }) {
  return (
    <div>
      <p className="text-xs text-secondary mb-1">{label}</p>
      <div className="text-xs font-mono bg-canvas rounded-lg border border-surface-raised overflow-hidden">
        {lines.map((line, i) => (
          <div
            key={i}
            className={`px-3 py-0.5 ${
              line.type === "added"
                ? "bg-emerald-900/30 text-emerald-300"
                : line.type === "removed"
                ? "bg-red-900/30 text-red-300"
                : "text-muted"
            }`}
          >
            <span className="inline-block w-4 text-right mr-2 select-none opacity-50">
              {line.type === "added" ? "+" : line.type === "removed" ? "-" : " "}
            </span>
            {line.content}
          </div>
        ))}
      </div>
    </div>
  );
}
