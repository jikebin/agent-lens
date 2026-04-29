"use client";

import Link from "next/link";
import type { Message, SystemPrompt } from "@/types";
import { TimelineMessageCard } from "./TimelineMessageCard";
import { TimelineDiffView } from "./TimelineDiffView";

export function TimelineMainContent({
  mode,
  currentStep,
  messages,
  systemPrompts,
  diffEnabled,
  requestRowId,
  onPrev,
  onNext,
}: {
  mode: "message" | "system";
  currentStep: number;
  messages: Message[];
  systemPrompts: SystemPrompt[];
  diffEnabled: boolean;
  requestRowId: number;
  onPrev: () => void;
  onNext: () => void;
}) {
  if (mode === "system") {
    return (
      <div className="p-4">
        <h3 className="text-sm font-medium text-secondary mb-3">System Prompt</h3>
        {systemPrompts.length === 0 ? (
          <p className="text-sm text-muted text-center py-8">
            No system prompt recorded for this request.
          </p>
        ) : (
          <div className="space-y-3">
            {systemPrompts.map((sp) => (
              <div
                key={sp.id}
                className="rounded-lg border border-surface-raised bg-canvas p-3"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xs font-medium px-2 py-0.5 rounded bg-amber-900/40 text-amber-400">
                    System Prompt
                  </span>
                </div>
                <pre className="whitespace-pre-wrap text-sm text-content font-mono leading-relaxed">
                  {sp.content}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Message mode
  if (messages.length === 0) {
    return (
      <div className="text-center py-12 text-secondary">
        No messages recorded for this request.
      </div>
    );
  }

  const msg = messages[currentStep];

  return (
    <div className="flex flex-col h-full">
      {/* Diff view */}
      {diffEnabled && currentStep > 0 && (
        <TimelineDiffView
          prevMessage={messages[currentStep - 1]}
          currentMessage={msg}
        />
      )}

      {/* Current message */}
      <TimelineMessageCard message={msg} />

      {/* Navigation controls */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-surface-raised">
        <button
          onClick={onPrev}
          disabled={currentStep === 0}
          className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full border border-surface-raised transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-secondary hover:text-secondary-bright hover:bg-surface-raised"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
          Previous
        </button>

        <Link
          href={`/requests/${requestRowId}#msg-${msg.sequence}`}
          className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors"
        >
          View in Tab Mode
        </Link>

        <button
          onClick={onNext}
          disabled={currentStep === messages.length - 1}
          className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-full border border-surface-raised transition-colors disabled:opacity-30 disabled:cursor-not-allowed text-secondary hover:text-secondary-bright hover:bg-surface-raised"
        >
          Next
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      </div>
    </div>
  );
}
