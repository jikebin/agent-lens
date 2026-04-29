"use client";

import { useState, useEffect, useCallback } from "react";
import type { Message, ToolDefinition, SystemPrompt } from "@/types";
import { TimelineNavbar } from "./TimelineNavbar";
import { TimelineStatusAxis } from "./TimelineStatusAxis";
import { TimelineMainContent } from "./TimelineMainContent";
import { TimelineSidebar } from "./TimelineSidebar";
import { ToolOverlay } from "./ToolOverlay";

export function TimelineView({
  messages,
  tools,
  requestRowId,
  systemPrompts,
}: {
  messages: Message[];
  tools: ToolDefinition[];
  requestRowId: number;
  systemPrompts: SystemPrompt[];
}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [activeSection, setActiveSection] = useState<"message" | "system">("message");
  const [diffEnabled, setDiffEnabled] = useState(false);
  const [selectedToolId, setSelectedToolId] = useState<number | null>(null);

  // Hash scroll: jump to message by hash on mount
  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith("#msg-")) {
      const seq = parseInt(hash.slice(5), 10);
      const idx = messages.findIndex((m) => m.sequence === seq);
      if (idx >= 0) setCurrentStep(idx);
    }
  }, [messages]);

  // Keyboard navigation
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (selectedToolId !== null) {
        if (e.key === "Escape") setSelectedToolId(null);
        return;
      }
      if (activeSection !== "message") return;
      if (e.key === "ArrowLeft" && currentStep > 0) {
        setCurrentStep((s) => s - 1);
      } else if (e.key === "ArrowRight" && currentStep < messages.length - 1) {
        setCurrentStep((s) => s + 1);
      }
    },
    [currentStep, messages.length, activeSection, selectedToolId]
  );

  const selectedTool = selectedToolId !== null
    ? tools.find((t) => t.id === selectedToolId) ?? null
    : null;

  const currentSequence = messages[currentStep]?.sequence ?? 0;

  return (
    <div
      className="rounded-xl border border-surface-raised bg-surface overflow-hidden"
      onKeyDown={handleKeyDown}
      tabIndex={0}
    >
      <TimelineNavbar
        activeSection={activeSection}
        onSectionChange={setActiveSection}
        diffEnabled={diffEnabled}
        onDiffToggle={() => setDiffEnabled(!diffEnabled)}
        messageCount={messages.length}
        systemCount={systemPrompts.length}
        requestRowId={requestRowId}
        currentSequence={currentSequence}
      />

      {activeSection === "message" && (
        <TimelineStatusAxis
          currentStep={currentStep}
          messages={messages}
          onStepClick={setCurrentStep}
        />
      )}

      <div className="flex min-h-[400px]">
        <div className="flex-1 min-w-0">
          <TimelineMainContent
            mode={activeSection}
            currentStep={currentStep}
            messages={messages}
            systemPrompts={systemPrompts}
            diffEnabled={diffEnabled}
            requestRowId={requestRowId}
            onPrev={() => setCurrentStep((s) => Math.max(0, s - 1))}
            onNext={() => setCurrentStep((s) => Math.min(messages.length - 1, s + 1))}
          />
        </div>

        <TimelineSidebar
          tools={tools}
          selectedToolId={selectedToolId}
          onToolClick={setSelectedToolId}
        />
      </div>

      {selectedTool && (
        <ToolOverlay
          tool={selectedTool}
          onClose={() => setSelectedToolId(null)}
        />
      )}
    </div>
  );
}
