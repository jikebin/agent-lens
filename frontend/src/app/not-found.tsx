import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-xl font-bold text-[#e2e8f0] mb-2">Not Found</h2>
        <p className="text-sm text-[#64748b] mb-4">
          The page you are looking for does not exist.
        </p>
        <Link
          href="/"
          className="px-4 py-2 bg-[#1e1e2e] text-[#94a3b8] rounded-lg hover:bg-indigo-600/20 hover:text-indigo-400 transition-colors"
        >
          Back to Home
        </Link>
      </div>
    </div>
  );
}
