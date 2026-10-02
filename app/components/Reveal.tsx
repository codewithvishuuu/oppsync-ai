"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Scroll reveal. IntersectionObserver, unobserved after the first hit,
 * transform/opacity/clip-path only. Collapses to fully visible when the user
 * prefers reduced motion, and to a no-op without IntersectionObserver.
 *
 * The observer watches a plain wrapper — never the animated node itself —
 * because a clip-path'd element reports a zero intersection rect and the
 * callback would never fire.
 */
export default function Reveal({
  children,
  delay = 0,
  variant = "up",
  className = "",
}: {
  children: ReactNode;
  delay?: number;
  variant?: "up" | "clip";
  className?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced || typeof IntersectionObserver === "undefined") {
      setShown(true);
      return;
    }

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShown(true);
            io.unobserve(e.target);
          }
        }
      },
      { threshold: 0.1, rootMargin: "0px 0px -6% 0px" }
    );

    io.observe(node);
    return () => io.disconnect();
  }, []);

  const cls = variant === "clip" ? "rv-clip" : "rv";

  return (
    <div ref={ref} className={`rvw ${className}`.trim()}>
      <div className={cls} data-in={shown} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
        {children}
      </div>
    </div>
  );
}
