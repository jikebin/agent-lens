import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-canvas flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-bold text-primary mb-2">Not Found</h2>
        <p className="text-sm text-secondary mb-4">
          The page you are looking for does not exist.
        </p>
        <Link
          href="/"
          className="px-4 py-2 bg-surface-raised text-secondary-bright rounded-lg hover:bg-indigo-600/20 hover:text-indigo-400 transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
