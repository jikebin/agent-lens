"use client";

import type { ToolDefinition } from "@/types";

export function TimelineSidebar({
  tools,
  selectedToolId,
  onToolClick,
}: {
  tools: ToolDefinition[];
  selectedToolId: number | null;
  onToolClick: (id: number | null) => void;
}) {
  return (
    <div className="w-56 shrink-0 border-l border-surface-raised bg-canvas/50">
      <div className="px-3 py-2.5 border-b border-surface-raised">
        <h3 className="text-xs font-medium text-secondary">
          Tools
          <span className="ml-1.5 text-xs bg-surface-raised px-1.5 py-0.5 rounded-full">
            {tools.length}
          </span>
        </h3>
      </div>

      {tools.length === 0 ? (
        <div className="px-3 py-6 text-xs text-muted text-center">
          No tools defined
        </div>
      ) : (
        <div className="p-2 space-y-1 overflow-y-auto max-h-[calc(100vh-250px)]">
          {tools.map((tool) => (
            <button
              key={tool.id}
              onClick={() =>
                onToolClick(selectedToolId === tool.id ? null : tool.id)
              }
              className={`w-full text-left px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors ${
                selectedToolId === tool.id
                  ? "bg-cyan-900/30 text-cyan-300"
                  : "text-secondary hover:text-secondary-bright hover:bg-surface-raised"
              }`}
            >
              <div className="flex items-center gap-1.5">
                <span className="w-1 h-1 rounded-full bg-cyan-400 shrink-0" />
                {tool.name}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
