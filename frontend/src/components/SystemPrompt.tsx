"use client";

import { useState } from "react";
import type { SystemPrompt as SystemPromptType } from "@/types";

export function SystemPrompt({ prompts }: { prompts: SystemPromptType[] }) {
  if (prompts.length === 0) {
    return (
      <div className="text-center py-12 text-secondary">
        No system prompt recorded for this request.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {prompts.map((prompt) => (
        <PromptCard key={prompt.id} content={prompt.content} />
      ))}
    </div>
  );
}

function PromptCard({ content }: { content: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="rounded-xl border border-surface-raised bg-surface p-4">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-medium bg-amber-900/40 text-amber-400 px-2 py-0.5 rounded">
          System Prompt
        </span>
        <button
          onClick={handleCopy}
          className="text-xs text-secondary hover:text-secondary-bright px-2 py-1 rounded-md border border-surface-raised hover:bg-surface-raised transition-colors"
        >
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <pre className="whitespace-pre-wrap text-sm text-content font-mono leading-relaxed">
        {content}
      </pre>
    </div>
  );
}
