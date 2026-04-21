import Link from "next/link";
import { api } from "@/lib/api";
import { TrajectoryView } from "@/components/TrajectoryView";
import { ThemeToggle } from "@/components/ThemeToggle";
import { formatDate, formatTokens } from "@/lib/format";

export default async function RequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const requestRowId = parseInt(id, 10);

  const [detail, messages, tools, eventCountResult, systemPrompts] = await Promise.all([
    api.getRequestDetail(requestRowId),
    api.getRequestMessages(requestRowId),
    api.getRequestTools(requestRowId),
    api.getRequestEventCount(requestRowId),
    api.getRequestSystemPrompt(requestRowId),
  ]);

  return (
    <div className="min-h-screen">
      <header className="border-b border-surface-raised px-6 py-5">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <Link
              href={`/projects/${detail.project_id}`}
              className="text-sm text-secondary hover:text-secondary-bright transition-colors"
            >
              &larr; Back to project
            </Link>
            <ThemeToggle />
          </div>
          <div className="flex items-center gap-3 mt-2">
            <h1 className="text-xl font-bold">Request Detail</h1>
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded ${
                detail.api_format === "openai"
                  ? "bg-emerald-900/40 text-emerald-400"
                  : "bg-amber-900/40 text-amber-400"
              }`}
            >
              {detail.api_format}
            </span>
            <span
              className={`text-xs px-2 py-0.5 rounded ${
                detail.is_stream
                  ? "bg-violet-900/40 text-violet-400"
                  : "bg-surface-raised text-secondary"
              }`}
            >
              {detail.is_stream ? "streaming" : "non-stream"}
            </span>
            {detail.status === "error" && (
              <span className="text-xs px-2 py-0.5 rounded bg-red-900/40 text-red-400">
                error
              </span>
            )}
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-secondary">
            <span>
              Model:{" "}
              <span className="text-indigo-400 font-mono">{detail.model}</span>
            </span>
            <span>
              Key: <span className="font-mono">{detail.api_key_prefix}</span>
            </span>
            <span>{formatDate(detail.created_at)}</span>
          </div>
          {/* Token usage */}
          {detail.total_tokens > 0 && (
            <div className="mt-1 text-sm text-cyan-400">
              {formatTokens(detail.prompt_tokens)} in / {formatTokens(detail.completion_tokens)} out ({formatTokens(detail.total_tokens)} total)
            </div>
          )}
          {/* Error info */}
          {detail.status === "error" && (
            <div className="mt-1 text-sm text-red-400">
              {detail.error_type && <span className="font-mono mr-2">{detail.error_type}</span>}
              {detail.error_message && (
                <span className="text-red-300">{detail.error_message.length > 200 ? detail.error_message.slice(0, 200) + "..." : detail.error_message}</span>
              )}
            </div>
          )}
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-6 py-8">
        <TrajectoryView
          messages={messages}
          tools={tools}
          requestRowId={requestRowId}
          eventCount={eventCountResult.count}
          systemPrompts={systemPrompts}
        />
      </main>
    </div>
  );
}
