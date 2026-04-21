import { api } from "@/lib/api";
import { ProjectList } from "@/components/ProjectList";

export default async function Home() {
  const projects = await api.listProjects();

  return (
    <div className="min-h-screen">
      <header className="border-b border-[#1e1e2e] px-6 py-5">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
            Agent Lens
          </h1>
          <p className="text-sm text-[#94a3b8] mt-1">
            AI Agent Trajectory Viewer
          </p>
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <ProjectList projects={projects} />
      </main>
    </div>
  );
}
