"use client";

import { useState } from "react";
import type { Message, ToolDefinition, SystemPrompt } from "@/types";
import { TrajectoryView } from "./TrajectoryView";
import { TimelineView } from "./timeline/TimelineView";

export function RequestViewSwitch({
  messages,
  tools,
  requestRowId,
  eventCount,
  systemPrompts,
  viewMode,
}: {
  messages: Message[];
  tools: ToolDefinition[];
  requestRowId: number;
  eventCount: number;
  systemPrompts: SystemPrompt[];
  viewMode: "tab" | "timeline";
}) {
  const [currentView, setCurrentView] = useState<"tab" | "timeline">(viewMode);

  const handleToggle = () => {
    const next = currentView === "tab" ? "timeline" : "tab";
    setCurrentView(next);
    const url = new URL(window.location.href);
    if (next === "timeline") {
      url.searchParams.set("view", "timeline");
    } else {
      url.searchParams.delete("view");
    }
    window.history.replaceState({}, "", url.toString());
  };

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          onClick={handleToggle}
          className="flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full border border-surface-raised bg-surface hover:bg-surface-raised transition-colors text-secondary hover:text-secondary-bright"
          title={currentView === "tab" ? "Switch to Timeline View" : "Switch to Tab View"}
        >
          {currentView === "tab" ? (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              Timeline
            </>
          ) : (
            <>
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              Tab View
            </>
          )}
        </button>
      </div>

      {currentView === "tab" ? (
        <TrajectoryView
          messages={messages}
          tools={tools}
          requestRowId={requestRowId}
          eventCount={eventCount}
          systemPrompts={systemPrompts}
        />
      ) : (
        <TimelineView
          messages={messages}
          tools={tools}
          requestRowId={requestRowId}
          systemPrompts={systemPrompts}
        />
      )}
    </div>
  );
}
