"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[var(--color-bg)]/80 backdrop-blur-xl border-b border-[var(--color-border)]"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link href="/blog" className="text-xl font-black">
          Study<span className="text-[var(--color-accent)]">Engines</span>
        </Link>
        <nav
          className="flex items-center gap-3 sm:gap-6 text-xs sm:text-sm text-[var(--color-text-secondary)]"
          aria-label="ナビゲーション"
        >
          <Link
            href="/blog"
            className="hover:text-[var(--color-text)] transition-colors whitespace-nowrap rounded-md px-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--color-accent)]"
          >
            ブログ
          </Link>
        </nav>
      </div>
    </header>
  );
}
