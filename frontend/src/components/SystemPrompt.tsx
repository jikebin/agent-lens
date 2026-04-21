import type { SystemPrompt } from "@/types";

export function SystemPrompt({ prompts }: { prompts: SystemPrompt[] }) {
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
        <div
          key={prompt.id}
          className="rounded-xl border border-surface-raised bg-surface p-4"
        >
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xs font-medium bg-amber-900/40 text-amber-400 px-2 py-0.5 rounded">
              System Prompt
            </span>
          </div>
          <pre className="whitespace-pre-wrap text-sm text-content font-mono leading-relaxed">
            {prompt.content}
          </pre>
        </div>
      ))}
    </div>
  );
}
