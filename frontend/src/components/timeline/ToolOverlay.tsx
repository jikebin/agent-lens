"use client";

import { useEffect } from "react";
import type { ToolDefinition } from "@/types";

export function ToolOverlay({
  tool,
  onClose,
}: {
  tool: ToolDefinition;
  onClose: () => void;
}) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-surface border border-surface-raised rounded-xl max-w-xl w-full mx-4 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-surface-raised shrink-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium px-2 py-0.5 rounded bg-cyan-900/40 text-cyan-400">
              Tool
            </span>
            <h3 className="text-sm font-mono font-medium text-primary">
              {tool.name}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-secondary hover:text-secondary-bright transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="overflow-y-auto p-5 space-y-4">
          {tool.description && (
            <div>
              <h4 className="text-xs font-medium text-secondary mb-1">Description</h4>
              <p className="text-sm text-content leading-relaxed">
                {tool.description}
              </p>
            </div>
          )}

          {tool.parameters && (
            <div>
              <h4 className="text-xs font-medium text-secondary mb-1">Parameters Schema</h4>
              <pre className="text-xs text-content font-mono whitespace-pre-wrap bg-canvas rounded-lg p-3 border border-surface-raised overflow-x-auto">
                {JSON.stringify(tool.parameters, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
