"use client";

import { useEffect, useRef, useState } from "react";

let mermaidInitialized = false;

export default function MermaidBlock({ chart }: { chart: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string>("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        // @ts-ignore — mermaid is optional, loaded at runtime
        const mermaid = (await import(/* webpackIgnore: true */ "https://cdn.jsdelivr.net/npm/mermaid@11/dist/mermaid.esm.min.mjs")).default;
        if (!mermaidInitialized) {
          mermaid.initialize({
            startOnLoad: false,
            theme: "neutral",
            fontFamily: "inherit",
            securityLevel: "strict",
          });
          mermaidInitialized = true;
        }

        const id = `mermaid-${Math.random().toString(36).slice(2, 8)}`;
        const { svg: rendered } = await mermaid.render(id, chart.trim());
        if (!cancelled) setSvg(rendered);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "図の描画に失敗しました");
      }
    })();

    return () => { cancelled = true; };
  }, [chart]);

  if (error) {
    return (
      <pre className="p-4 rounded-xl bg-red-50 border border-red-200 text-red-600 text-xs overflow-auto">
        {chart}
      </pre>
    );
  }

  if (!svg) {
    return (
      <div className="p-6 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] text-center text-[var(--color-text-muted)] text-sm">
        図を描画中...
      </div>
    );
  }

  return (
    <div
      ref={ref}
      className="my-6 p-4 rounded-xl bg-[var(--color-bg-card)] border border-[var(--color-border)] overflow-x-auto flex justify-center [&_svg]:max-w-full"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
