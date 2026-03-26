"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);
  return (
    <html lang="ja">
      <body style={{ backgroundColor: "#0a0a0a", color: "#fafafa", fontFamily: "sans-serif" }}>
        <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", padding: "0 24px" }}>
            <h2 style={{ fontSize: "20px", fontWeight: "bold", marginBottom: "8px" }}>
              エラーが発生しました
            </h2>
            <p style={{ color: "#888", fontSize: "14px", marginBottom: "32px" }}>
              予期しないエラーが発生しました。ページを再読み込みしてください。
            </p>
            <button
              onClick={reset}
              style={{
                padding: "12px 24px",
                borderRadius: "12px",
                backgroundColor: "#e11d48",
                color: "white",
                fontWeight: "bold",
                fontSize: "14px",
                border: "none",
                cursor: "pointer",
              }}
            >
              再試行
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
