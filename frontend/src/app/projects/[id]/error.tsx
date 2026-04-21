"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-bold text-red-400 mb-2">Failed to load project</h2>
        <p className="text-sm text-[#64748b] mb-4">{error.message}</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-[#1e1e2e] text-[#94a3b8] rounded-lg hover:bg-indigo-600/20 hover:text-indigo-400 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
