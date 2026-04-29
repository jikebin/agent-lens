import { useState } from "react";
import Link from "next/link";
import type { Message } from "@/types";

export function MessageFlow({
  messages,
  requestRowId,
}: {
  messages: Message[];
  requestRowId?: number;
}) {
  if (messages.length === 0) {
    return (
      <div className="text-center py-12 text-secondary">
        No messages recorded for this request.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {messages.map((msg) => (
        <MessageCard key={msg.id} message={msg} requestRowId={requestRowId} />
      ))}
    </div>
  );
}

function MessageCard({ message, requestRowId }: { message: Message; requestRowId?: number }) {
  const [expanded, setExpanded] = useState(false);

  const roleColors: Record<string, string> = {
    system: "bg-amber-900/40 text-amber-400",
    user: "bg-indigo-900/40 text-indigo-400",
    assistant: "bg-emerald-900/40 text-emerald-400",
    tool: "bg-violet-900/40 text-violet-400",
  };

  const roleBg: Record<string, string> = {
    input: "border-l-indigo-500",
    output: "border-l-emerald-500",
  };

  const toolCalls = message.tool_calls;

  const contentPreview =
    message.content && message.content.length > 200
      ? message.content.slice(0, 200) + "..."
      : message.content;

  return (
    <div
      id={`msg-${message.sequence}`}
      className={`rounded-xl border border-surface-raised bg-surface p-4 border-l-4 ${
        roleBg[message.direction] || ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded ${
              roleColors[message.role] || "bg-surface-raised text-secondary"
            }`}
          >
            {message.role}
          </span>
          <span
            className={`text-xs px-1.5 py-0.5 rounded ${
              message.direction === "input"
                ? "bg-indigo-900/30 text-indigo-400"
                : "bg-emerald-900/30 text-emerald-400"
            }`}
          >
            {message.direction}
          </span>
          {message.tool_call_id && (
            <span className="text-xs text-muted font-mono">
              tool_call: {message.tool_call_id}
            </span>
          )}
          <span className="text-xs text-muted">#{message.sequence}</span>
        </div>
        {requestRowId && (
          <Link
            href={`/requests/${requestRowId}?view=timeline#msg-${message.sequence}`}
            className="text-xs text-secondary hover:text-indigo-400 transition-colors flex items-center gap-1"
            title="View in Timeline"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        )}
      </div>

      {message.content && (
        <div className="mt-2">
          <pre className="whitespace-pre-wrap text-sm text-content font-mono leading-relaxed">
            {expanded ? message.content : contentPreview}
          </pre>
          {message.content && message.content.length > 200 && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-indigo-400 hover:text-indigo-300 mt-1 transition-colors"
            >
              {expanded ? "Show less" : "Show more"}
            </button>
          )}
        </div>
      )}

      {toolCalls && (
        <div className="mt-2 border-t border-surface-raised pt-2">
          <p className="text-xs text-secondary mb-1">Tool Calls:</p>
          <pre className="text-xs text-content bg-canvas p-2 rounded-lg overflow-x-auto">
            {JSON.stringify(toolCalls, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
