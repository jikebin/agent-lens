"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";

type State = "idle" | "confirming" | "deleting";

export function DeleteProjectButton({ projectId }: { projectId: number }) {
  const [state, setState] = useState<State>("idle");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  if (state === "idle") {
    return (
      <button
        onClick={() => setState("confirming")}
        className="text-xs text-red-400 hover:text-red-300 border border-red-900/50 hover:border-red-700 px-3 py-1.5 rounded-md transition-colors"
      >
        Delete Project
      </button>
    );
  }

  if (state === "confirming") {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-400">Are you sure?</span>
        <button
          onClick={async () => {
            setState("deleting");
            setError(null);
            try {
              await api.deleteProject(projectId);
              router.push("/");
              router.refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed to delete");
              setState("confirming");
            }
          }}
          className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1.5 rounded-md transition-colors"
        >
          Yes, Delete
        </button>
        <button
          onClick={() => setState("idle")}
          className="text-xs text-[#64748b] hover:text-[#94a3b8] px-3 py-1.5 rounded-md transition-colors"
        >
          Cancel
        </button>
        {error && <span className="text-xs text-red-400">{error}</span>}
      </div>
    );
  }

  return (
    <span className="text-xs text-[#64748b]">Deleting...</span>
  );
}
