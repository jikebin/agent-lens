import Link from "next/link";
import { api } from "@/lib/api";
import { RequestList } from "@/components/RequestList";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const projectId = parseInt(id, 10);
  const projects = await api.listProjects();
  const project = projects.find((p) => p.id === projectId);
  const requests = await api.listProjectRequests(projectId);

  return (
    <div className="min-h-screen">
      <header className="border-b border-[#1e1e2e] px-6 py-5">
        <div className="max-w-6xl mx-auto">
          <Link href="/" className="text-sm text-[#64748b] hover:text-[#94a3b8] transition-colors">
            &larr; Back to projects
          </Link>
          <div className="flex items-center justify-between mt-2">
            <h1 className="text-xl font-bold">
              <span className="font-mono text-sm bg-[#1e1e2e] text-[#94a3b8] px-2.5 py-1 rounded-md">
                {project?.api_key_prefix}
              </span>
              <span className="text-[#475569] mx-2">/</span>
              <span className="font-mono text-sm text-indigo-400">
                {project?.model}
              </span>
            </h1>
            <DeleteProjectButton projectId={projectId} />
          </div>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <RequestList requests={requests} />
      </main>
    </div>
  );
}
