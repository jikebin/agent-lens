"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-bold text-red-400 mb-2">Failed to load project</h2>
        <p className="text-sm text-secondary mb-4">{error.message}</p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-surface-raised text-secondary-bright rounded-lg hover:bg-indigo-600/20 hover:text-indigo-400 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
