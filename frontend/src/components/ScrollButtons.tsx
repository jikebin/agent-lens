"use client";

export function ScrollButtons({ scrollTargetId }: { scrollTargetId: string }) {
  const scrollTo = (position: "top" | "bottom") => {
    const el = document.getElementById(scrollTargetId);
    if (!el) return;
    el.scrollTo({
      top: position === "top" ? 0 : el.scrollHeight,
      behavior: "smooth",
    });
  };

  return (
    <div className="absolute bottom-6 right-6 flex flex-col gap-2 z-40">
      <button
        onClick={() => scrollTo("top")}
        className="w-9 h-9 rounded-full border border-surface-raised bg-surface hover:bg-surface-raised text-secondary hover:text-secondary-bright transition-colors flex items-center justify-center shadow-lg"
        title="Scroll to top"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
      </button>
      <button
        onClick={() => scrollTo("bottom")}
        className="w-9 h-9 rounded-full border border-surface-raised bg-surface hover:bg-surface-raised text-secondary hover:text-secondary-bright transition-colors flex items-center justify-center shadow-lg"
        title="Scroll to bottom"
      >
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>
    </div>
  );
}
