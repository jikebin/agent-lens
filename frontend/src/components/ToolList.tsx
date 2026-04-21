"use client";

import { useState } from "react";
import type { ToolDefinition } from "@/types";

function formatToolsText(tools: ToolDefinition[]): string {
  return tools
    .map((tool) => {
      const parts: string[] = [`## ${tool.name}`];
      if (tool.description) {
        parts.push(tool.description);
      }
      if (tool.parameters) {
        parts.push("```json\n" + JSON.stringify(tool.parameters, null, 2) + "\n```");
      }
      return parts.join("\n\n");
    })
    .join("\n\n---\n\n");
}

export function ToolList({ tools }: { tools: ToolDefinition[] }) {
  const [copied, setCopied] = useState(false);

  if (tools.length === 0) {
    return (
      <div className="text-center py-12 text-secondary">
        No tool definitions recorded for this request.
      </div>
    );
  }

  const handleCopy = async () => {
    await navigator.clipboard.writeText(formatToolsText(tools));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <button
          onClick={handleCopy}
          className="text-xs text-secondary hover:text-secondary-bright px-2.5 py-1.5 rounded-md border border-surface-raised hover:bg-surface-raised transition-colors"
        >
          {copied ? "Copied" : "Copy All"}
        </button>
      </div>
      {tools.map((tool) => (
        <ToolCard key={tool.id} tool={tool} />
      ))}
    </div>
  );
}

function ToolCard({ tool }: { tool: ToolDefinition }) {
  const [expanded, setExpanded] = useState(false);
  const parameters = tool.parameters;

  return (
    <div className="rounded-xl border border-surface-raised bg-surface p-4">
      <div
        className="flex items-center justify-between cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium bg-cyan-900/40 text-cyan-400 px-2 py-0.5 rounded">
            Tool
          </span>
          <span className="font-mono text-sm text-cyan-300">{tool.name}</span>
        </div>
        <span className="text-muted text-xs">
          {expanded ? "Collapse" : "Expand"}
        </span>
      </div>
      {tool.description && (
        <p className="text-sm text-secondary-bright mt-2">{tool.description}</p>
      )}
      {expanded && parameters && (
        <div className="mt-3 border-t border-surface-raised pt-3">
          <p className="text-xs text-secondary mb-2">Parameters Schema:</p>
          <pre className="text-xs text-content bg-canvas p-3 rounded-lg overflow-x-auto">
            {JSON.stringify(parameters, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
