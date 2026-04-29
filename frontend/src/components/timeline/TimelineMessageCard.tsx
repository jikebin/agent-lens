"use client";

import type { Message } from "@/types";
import { formatDate } from "@/lib/format";

const roleColors: Record<string, string> = {
  system: "bg-amber-900/40 text-amber-400",
  user: "bg-indigo-900/40 text-indigo-400",
  assistant: "bg-emerald-900/40 text-emerald-400",
  tool: "bg-violet-900/40 text-violet-400",
};

const dirColors: Record<string, string> = {
  input: "bg-indigo-900/30 text-indigo-400",
  output: "bg-emerald-900/30 text-emerald-400",
};

export function TimelineMessageCard({ message }: { message: Message }) {
  const toolCalls = message.tool_calls;

  return (
    <div id={`msg-${message.sequence}`} className="p-4">
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded ${
            roleColors[message.role] || "bg-surface-raised text-secondary"
          }`}
        >
          {message.role}
        </span>
        <span
          className={`text-xs px-1.5 py-0.5 rounded ${
            dirColors[message.direction] || ""
          }`}
        >
          {message.direction}
        </span>
        <span className="text-xs text-muted">#{message.sequence}</span>
        {message.tool_call_id && (
          <span className="text-xs text-muted font-mono">
            tool_call: {message.tool_call_id}
          </span>
        )}
        <span className="text-xs text-muted ml-auto">
          {formatDate(message.created_at)}
        </span>
      </div>

      {message.content && (
        <pre className="whitespace-pre-wrap text-sm text-content font-mono leading-relaxed bg-canvas rounded-lg p-3 border border-surface-raised">
          {message.content}
        </pre>
      )}

      {toolCalls && toolCalls.length > 0 && (
        <div className="mt-3 border border-surface-raised rounded-lg overflow-hidden">
          <div className="bg-surface-raised px-3 py-1.5 text-xs text-secondary font-medium">
            Tool Calls ({toolCalls.length})
          </div>
          <div className="p-3 space-y-2">
            {toolCalls.map((tc, i) => {
              const func = (tc as Record<string, unknown>).function as Record<string, unknown> | undefined;
              return (
                <div key={i} className="bg-canvas rounded-lg p-2 border border-surface-raised">
                  <div className="text-xs text-cyan-400 font-mono font-medium mb-1">
                    {String(func?.name ?? "unknown")}
                  </div>
                  {func?.arguments != null && (
                    <pre className="text-xs text-content font-mono whitespace-pre-wrap">
                      {typeof func.arguments === "string"
                        ? func.arguments
                        : JSON.stringify(func.arguments, null, 2)}
                    </pre>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
