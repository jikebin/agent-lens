"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import type { Project } from "@/types";
import { api } from "@/lib/api";
import { formatDate, formatTokens } from "@/lib/format";

export function ProjectList({ initialProjects }: { initialProjects: Project[] }) {
  const [projects, setProjects] = useState(initialProjects);
  const [search, setSearch] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const doSearch = useCallback(async (q: string) => {
    const result = await api.listProjects(q || undefined);
    setProjects(result);
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => doSearch(search), 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search, doSearch]);

  if (projects.length === 0 && !search) {
    return (
      <div className="text-center py-20 text-secondary">
        <p className="text-lg">No projects yet</p>
        <p className="text-sm mt-2">
          Start making API calls through the proxy to see trajectories here.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <input
          type="text"
          placeholder="Search by model, key, or name..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-surface border border-surface-raised rounded-lg px-4 py-2.5 text-sm text-primary placeholder-muted focus:outline-none focus:border-indigo-500/50 transition-colors"
        />
        <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
      </div>
      <div className="grid gap-4">
        {projects.map((project) => (
          <Link
            key={project.id}
            href={`/projects/${project.id}`}
            className="block rounded-xl border border-surface-raised bg-surface p-5 hover:border-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/5 transition-all"
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm bg-surface-raised text-secondary-bright px-2.5 py-1 rounded-md">
                    {project.api_key_prefix}
                  </span>
                  <span className="text-muted">/</span>
                  <span className="font-mono text-sm text-indigo-400">
                    {project.model}
                  </span>
                </div>
                {project.name && (
                  <p className="text-sm text-secondary mt-1">{project.name}</p>
                )}
              </div>
              <div className="text-right">
                <span className="text-2xl font-bold bg-gradient-to-r from-indigo-400 to-violet-400 bg-clip-text text-transparent">
                  {project.request_count}
                </span>
                <p className="text-xs text-secondary">requests</p>
              </div>
            </div>
            <div className="flex items-center gap-4 mt-3 text-xs text-muted">
              <span>Created {formatDate(project.created_at)}</span>
              {project.total_tokens > 0 && (
                <span className="text-cyan-400">{formatTokens(project.total_tokens)} tokens</span>
              )}
              {project.error_count > 0 && (
                <span className="text-red-400">{project.error_count} errors</span>
              )}
            </div>
          </Link>
        ))}
      </div>
      {projects.length === 0 && search && (
        <div className="text-center py-10 text-secondary">
          <p>No projects match &quot;{search}&quot;</p>
        </div>
      )}
    </div>
  );
}
