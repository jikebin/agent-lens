import { useState } from "react";
import type { ToolDefinition } from "@/types";

export function ToolList({ tools }: { tools: ToolDefinition[] }) {
  if (tools.length === 0) {
    return (
      <div className="text-center py-12 text-[#64748b]">
        No tool definitions recorded for this request.
      </div>
    );
  }

  return (
    <div className="space-y-3">
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
    <div className="rounded-xl border border-[#1e1e2e] bg-[#12121a] p-4">
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
        <span className="text-[#475569] text-xs">
          {expanded ? "Collapse" : "Expand"}
        </span>
      </div>
      {tool.description && (
        <p className="text-sm text-[#94a3b8] mt-2">{tool.description}</p>
      )}
      {expanded && parameters && (
        <div className="mt-3 border-t border-[#1e1e2e] pt-3">
          <p className="text-xs text-[#64748b] mb-2">Parameters Schema:</p>
          <pre className="text-xs text-[#cbd5e1] bg-[#0a0a0f] p-3 rounded-lg overflow-x-auto">
            {JSON.stringify(parameters, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
