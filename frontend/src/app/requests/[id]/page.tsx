import Link from "next/link";
import { api } from "@/lib/api";
import { TrajectoryView } from "@/components/TrajectoryView";
import { formatDate } from "@/lib/format";

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
      <header className="border-b border-[#1e1e2e] px-6 py-5">
        <div className="max-w-7xl mx-auto">
          <Link
            href={`/projects/${detail.project_id}`}
            className="text-sm text-[#64748b] hover:text-[#94a3b8] transition-colors"
          >
            &larr; Back to project
          </Link>
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
                  : "bg-[#1e1e2e] text-[#64748b]"
              }`}
            >
              {detail.is_stream ? "streaming" : "non-stream"}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-1 text-sm text-[#64748b]">
            <span>
              Model:{" "}
              <span className="text-indigo-400 font-mono">{detail.model}</span>
            </span>
            <span>
              Key: <span className="font-mono">{detail.api_key_prefix}</span>
            </span>
            <span>{formatDate(detail.created_at)}</span>
          </div>
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
