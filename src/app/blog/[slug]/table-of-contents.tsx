"use client";

import { useState } from "react";
import { ChevronDown, List } from "lucide-react";

interface Heading {
  id: string;
  text: string;
  level: number;
}

export function TableOfContents({ headings }: { headings: Heading[] }) {
  const [open, setOpen] = useState(false);

  return (
    <nav className="mb-10 rounded-xl border border-[var(--color-border)] overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-4 text-sm font-bold text-[var(--color-text)] hover:bg-[var(--color-bg-secondary)] transition-colors"
      >
        <span className="flex items-center gap-2">
          <List className="w-4 h-4 text-[var(--color-accent)]" />
          目次
        </span>
        <ChevronDown
          className={`w-4 h-4 text-[var(--color-text-muted)] transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open && (
        <div className="px-5 pb-4 border-t border-[var(--color-border)] pt-3">
          <ul className="space-y-1.5">
            {headings.map((h) => (
              <li key={h.id}>
                <a
                  href={`#${h.id}`}
                  className={`block text-sm transition-colors hover:text-[var(--color-accent)] ${
                    h.level === 2
                      ? "text-[var(--color-text-secondary)] font-medium"
                      : "text-[var(--color-text-muted)] pl-4 text-[13px]"
                  }`}
                  onClick={() => setOpen(false)}
                >
                  {h.text}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </nav>
  );
}
