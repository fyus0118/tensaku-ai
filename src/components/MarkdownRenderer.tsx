"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MermaidBlock from "./MermaidBlock";

export default function MarkdownRenderer({
  children,
  className = "prose prose-neutral max-w-none",
}: {
  children: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ className: codeClassName, children: codeChildren, ...props }) {
            const match = /language-mermaid/.exec(codeClassName || "");
            if (match) {
              return <MermaidBlock chart={String(codeChildren).replace(/\n$/, "")} />;
            }
            const isInline = !codeClassName;
            if (isInline) {
              return <code className="px-1.5 py-0.5 rounded bg-[var(--color-bg-card)] text-sm" {...props}>{codeChildren}</code>;
            }
            return (
              <code className={codeClassName} {...props}>
                {codeChildren}
              </code>
            );
          },
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  );
}
