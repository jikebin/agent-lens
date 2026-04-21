import { api } from "@/lib/api";
import { ProjectList } from "@/components/ProjectList";
import { ThemeToggle } from "@/components/ThemeToggle";

export default async function Home() {
  const projects = await api.listProjects();

  return (
    <div className="min-h-screen">
      <header className="border-b border-surface-raised px-6 py-5">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
              Agent Lens
            </h1>
            <p className="text-sm text-secondary-bright mt-1">
              AI Agent Trajectory Viewer
            </p>
          </div>
          <ThemeToggle />
        </div>
      </header>
      <main className="max-w-6xl mx-auto px-6 py-8">
        <ProjectList initialProjects={projects} />
      </main>
    </div>
  );
}
