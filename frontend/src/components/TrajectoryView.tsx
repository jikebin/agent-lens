"use client";

import { useState } from "react";
import type { Message, ToolDefinition, SystemPrompt } from "@/types";
import { SystemPrompt as SystemPromptView } from "./SystemPrompt";
import { ToolList } from "./ToolList";
import { MessageFlow } from "./MessageFlow";
import { EventStream } from "./EventStream";

type Tab = "messages" | "system-prompt" | "tools" | "events";

export function TrajectoryView({
  messages,
  tools,
  requestRowId,
  eventCount,
  systemPrompts,
}: {
  messages: Message[];
  tools: ToolDefinition[];
  requestRowId: number;
  eventCount: number;
  systemPrompts: SystemPrompt[];
}) {
  const [activeTab, setActiveTab] = useState<Tab>("messages");

  const tabs: { key: Tab; label: string; count: number }[] = [
    { key: "messages", label: "Messages", count: messages.length },
    { key: "system-prompt", label: "System Prompt", count: systemPrompts.length },
    { key: "tools", label: "Tools", count: tools.length },
    { key: "events", label: "Events", count: eventCount },
  ];

  return (
    <div>
      <div className="flex border-b border-surface-raised mb-6">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? "border-indigo-500 text-indigo-400"
                : "border-transparent text-secondary hover:text-secondary-bright"
            }`}
          >
            {tab.label}
            <span className="ml-1.5 text-xs bg-surface-raised px-1.5 py-0.5 rounded-full">
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {activeTab === "messages" && <MessageFlow messages={messages} requestRowId={requestRowId} />}
      {activeTab === "system-prompt" && <SystemPromptView prompts={systemPrompts} />}
      {activeTab === "tools" && <ToolList tools={tools} />}
      {activeTab === "events" && <EventStream requestRowId={requestRowId} />}
    </div>
  );
}
