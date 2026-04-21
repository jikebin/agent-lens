"use client";

import Link from "next/link";
import type { Project } from "@/types";
import { formatDate } from "@/lib/format";

export function ProjectList({ projects }: { projects: Project[] }) {
  if (projects.length === 0) {
    return (
      <div className="text-center py-20 text-[#64748b]">
        <p className="text-lg">No projects yet</p>
        <p className="text-sm mt-2">
          Start making API calls through the proxy to see trajectories here.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-4">
      {projects.map((project) => (
        <Link
          key={project.id}
          href={`/projects/${project.id}`}
          className="block rounded-xl border border-[#1e1e2e] bg-[#12121a] p-5 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5 transition-all"
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm bg-[#1e1e2e] text-[#94a3b8] px-2.5 py-1 rounded-md">
                  {project.api_key_prefix}
                </span>
                <span className="text-[#64748b]">/</span>
                <span className="font-mono text-sm text-indigo-400">
                  {project.model}
                </span>
              </div>
              {project.name && (
                <p className="text-sm text-[#64748b] mt-1">{project.name}</p>
              )}
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                {project.request_count}
              </span>
              <p className="text-xs text-[#64748b]">requests</p>
            </div>
          </div>
          <div className="text-xs text-[#475569] mt-3">
            Created {formatDate(project.created_at)}
          </div>
        </Link>
      ))}
    </div>
  );
}
