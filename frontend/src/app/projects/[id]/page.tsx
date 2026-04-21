import Link from "next/link";
import { api } from "@/lib/api";
import { RequestList } from "@/components/RequestList";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";
import { ThemeToggle } from "@/components/ThemeToggle";
import { formatTokens } from "@/lib/format";
import type { ProjectStats } from "@/types";

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colorClasses: Record<string, string> = {
    cyan: "text-cyan-400",
    indigo: "text-indigo-400",
    red: "text-red-400",
    emerald: "text-emerald-400",
    violet: "text-violet-400",
  };
  return (
    <div className="rounded-xl border border-surface-raised bg-surface p-4">
      <p className="text-xs text-secondary mb-1">{label}</p>
      <p className={`text-xl font-bold ${colorClasses[color] || "text-primary"}`}>{value}</p>
    </div>
  );
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const projectId = parseInt(id, 10);
  const [projects, requests, stats] = await Promise.all([
    api.listProjects(),
    api.listProjectRequests(projectId),
    api.getProjectStats(projectId),
  ]);
  const project = projects.find((p) => p.id === projectId);

  const errorRateColor = (stats as ProjectStats).error_rate > 0.1 ? "red" : "emerald";

  return (
    <div className="min-h-screen">
      <header className="border-b border-surface-raised px-6 py-5">
        <div className="max-w-6xl mx-auto">
          <Link href="/" className="text-sm text-secondary hover:text-secondary-bright transition-colors">
            &larr; Back to projects
          </Link>
          <div className="flex items-center justify-between mt-2">
            <h1 className="text-xl font-bold">
              <span className="font-mono text-sm bg-surface-raised text-secondary-bright px-2.5 py-1 rounded-md">
                {project?.api_key_prefix}
              </span>
              <span className="text-muted mx-2">/</span>
              <span className="font-mono text-sm text-indigo-400">
                {project?.model}
              </span>
            </h1>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              <DeleteProjectButton projectId={projectId} />
            </div>
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Stats cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <StatCard
            label="Total Tokens"
            value={formatTokens((stats as ProjectStats).total_tokens)}
            color="cyan"
          />
          <StatCard
            label="Avg / Request"
            value={formatTokens((stats as ProjectStats).avg_tokens_per_request)}
            color="indigo"
          />
          <StatCard
            label="Error Rate"
            value={`${((stats as ProjectStats).error_rate * 100).toFixed(1)}%`}
            color={errorRateColor}
          />
          <StatCard
            label="Total Requests"
            value={String((stats as ProjectStats).total_requests)}
            color="violet"
          />
        </div>

        <RequestList requests={requests} />
      </main>
    </div>
  );
}
