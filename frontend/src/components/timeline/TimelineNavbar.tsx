"use client";

import Link from "next/link";

type Section = "message" | "system";

export function TimelineNavbar({
  activeSection,
  onSectionChange,
  diffEnabled,
  onDiffToggle,
  messageCount,
  systemCount,
  requestRowId,
  currentSequence,
}: {
  activeSection: Section;
  onSectionChange: (s: Section) => void;
  diffEnabled: boolean;
  onDiffToggle: () => void;
  messageCount: number;
  systemCount: number;
  requestRowId: number;
  currentSequence: number;
}) {
  return (
    <div className="sticky top-0 z-30 bg-canvas/95 backdrop-blur border-b border-surface-raised px-4 py-2.5">
      <div className="flex items-center gap-2">
        <button
          onClick={() => onSectionChange("message")}
          className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
            activeSection === "message"
              ? "bg-indigo-900/40 text-indigo-400"
              : "text-secondary hover:text-secondary-bright hover:bg-surface-raised"
          }`}
        >
          Messages
          <span className="ml-1 text-xs bg-surface-raised px-1.5 py-0.5 rounded-full">
            {messageCount}
          </span>
        </button>

        <button
          onClick={() => onSectionChange("system")}
          className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
            activeSection === "system"
              ? "bg-amber-900/40 text-amber-400"
              : "text-secondary hover:text-secondary-bright hover:bg-surface-raised"
          }`}
        >
          System
          <span className="ml-1 text-xs bg-surface-raised px-1.5 py-0.5 rounded-full">
            {systemCount}
          </span>
        </button>

        {activeSection === "message" && (
          <button
            onClick={onDiffToggle}
            className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
              diffEnabled
                ? "bg-emerald-900/40 text-emerald-400"
                : "text-secondary hover:text-secondary-bright hover:bg-surface-raised"
            }`}
          >
            Diff
          </button>
        )}

        <div className="flex-1" />

        <Link
          href={`/requests/${requestRowId}#msg-${currentSequence}`}
          className="flex items-center gap-1 text-xs text-secondary hover:text-secondary-bright transition-colors"
          title="Jump to Tab View"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
          </svg>
          Tab View
        </Link>
      </div>
    </div>
  );
}
