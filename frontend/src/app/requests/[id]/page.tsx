import Link from "next/link";
import { api } from "@/lib/api";
import { RequestViewSwitch } from "@/components/RequestViewSwitch";
import { ScrollButtons } from "@/components/ScrollButtons";
import { ThemeToggle } from "@/components/ThemeToggle";
import { formatDate, formatTokens } from "@/lib/format";

export default async function RequestPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ view?: string }>;
}) {
  const { id } = await params;
  const { view } = await searchParams;
  const requestRowId = parseInt(id, 10);
  const viewMode = view === "timeline" ? "timeline" as const : "tab" as const;

  const detail = await api.getRequestDetail(requestRowId);

  const [messages, tools, eventCountResult, systemPrompts, projectRequests] = await Promise.all([
    api.getRequestMessages(requestRowId),
    api.getRequestTools(requestRowId),
    api.getRequestEventCount(requestRowId),
    api.getRequestSystemPrompt(requestRowId),
    api.listProjectRequests(detail.project_id),
  ]);

  // Find prev/next requests by time
  const sortedRequests = [...projectRequests].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
  const currentIndex = sortedRequests.findIndex((r) => r.id === requestRowId);
  const prevRequest = currentIndex > 0 ? sortedRequests[currentIndex - 1] : null;
  const nextRequest = currentIndex >= 0 && currentIndex < sortedRequests.length - 1 ? sortedRequests[currentIndex + 1] : null;

  return (
    <div className="h-screen flex flex-col">
      <header className="shrink-0 border-b border-surface-raised px-6 py-4 bg-canvas z-10">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Link
                href={`/projects/${detail.project_id}`}
                className="text-sm text-secondary hover:text-secondary-bright transition-colors"
              >
                &larr; Back to project
              </Link>
              <span className="text-surface-raised">|</span>
              {prevRequest ? (
                <Link
                  href={`/requests/${prevRequest.id}`}
                  className="text-sm text-secondary hover:text-secondary-bright transition-colors flex items-center gap-1"
                >
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Prev
                </Link>
              ) : (
                <span className="text-sm text-muted/40 flex items-center gap-1">
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                  </svg>
                  Prev
                </span>
              )}
              {nextRequest ? (
                <Link
                  href={`/requests/${nextRequest.id}`}
                  className="text-sm text-secondary hover:text-secondary-bright transition-colors flex items-center gap-1"
                >
                  Next
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </Link>
              ) : (
                <span className="text-sm text-muted/40 flex items-center gap-1">
                  Next
                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              )}
            </div>
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
      <main id="request-main" className="flex-1 min-h-0 overflow-y-auto relative">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <RequestViewSwitch
          messages={messages}
          tools={tools}
          requestRowId={requestRowId}
          eventCount={eventCountResult.count}
          systemPrompts={systemPrompts}
          viewMode={viewMode}
          />
        </div>
      </main>
      <ScrollButtons scrollTargetId="request-main" />
    </div>
  );
}
