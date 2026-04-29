"use client";

import type { Message } from "@/types";

const roleColors: Record<string, string> = {
  system: "bg-amber-400",
  user: "bg-indigo-400",
  assistant: "bg-emerald-400",
  tool: "bg-violet-400",
};

export function TimelineStatusAxis({
  currentStep,
  messages,
  onStepClick,
}: {
  currentStep: number;
  messages: Message[];
  onStepClick: (index: number) => void;
}) {
  if (messages.length <= 1) return null;

  return (
    <div className="sticky top-[45px] z-20 bg-canvas/95 backdrop-blur border-b border-surface-raised px-4 py-2">
      <div className="flex items-center gap-1.5 overflow-x-auto">
        {messages.map((msg, i) => (
          <button
            key={msg.id}
            onClick={() => onStepClick(i)}
            title={`#${msg.sequence} ${msg.role}`}
            className={`shrink-0 rounded-full transition-all ${
              i === currentStep
                ? `w-3 h-3 ring-2 ring-offset-1 ring-offset-canvas ${roleColors[msg.role] || "bg-secondary"} ring-current`
                : `w-2 h-2 ${roleColors[msg.role] || "bg-secondary"} opacity-50 hover:opacity-100`
            }`}
            style={
              i === currentStep
                ? { color: "var(--indigo-400, #818cf8)" }
                : undefined
            }
          />
        ))}
        <span className="ml-2 text-xs text-secondary shrink-0">
          Step {currentStep + 1} of {messages.length}
        </span>
      </div>
    </div>
  );
}
