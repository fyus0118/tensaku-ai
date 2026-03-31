"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

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
        <Link href="/" className="text-xl font-black">
          Study<span className="text-[var(--color-accent)]">Engines</span>
        </Link>
        <nav className="hidden sm:flex items-center gap-6 text-sm text-[var(--color-text-secondary)]">
          <a href="#features" className="hover:text-[var(--color-text)] transition-colors">機能</a>
          <a href="#pricing" className="hover:text-[var(--color-text)] transition-colors">料金</a>
        </nav>
        <Link
          href="/login"
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white text-sm font-bold transition-colors"
        >
          無料で始める
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </header>
  );
}
