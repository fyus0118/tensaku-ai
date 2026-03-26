import { ImageResponse } from "next/og";

export const runtime = "edge";

// OG画像生成: SNSシェア用スコアカード
export async function GET(request: Request) {
  const url = new URL(request.url);
  const exam = url.searchParams.get("exam") || "試験";
  const score = url.searchParams.get("score") || "0";
  const total = url.searchParams.get("total") || "0";
  const streak = url.searchParams.get("streak") || "0";

  const accuracy = parseInt(total) > 0
    ? Math.round((parseInt(score) / parseInt(total)) * 100)
    : 0;

  const color = accuracy >= 80 ? "#10b981" : accuracy >= 60 ? "#f59e0b" : "#ef4444";

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#0a0a0a",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            padding: "40px 60px",
            borderRadius: "24px",
            border: "2px solid #2a2a2a",
            background: "#1a1a1a",
          }}
        >
          <div style={{ display: "flex", fontSize: 28, color: "#888", marginBottom: 20 }}>
            {exam}
          </div>
          <div style={{ display: "flex", fontSize: 96, fontWeight: 900, color }}>
            {accuracy}%
          </div>
          <div style={{ display: "flex", fontSize: 24, color: "#888", marginTop: 10 }}>
            {score}/{total}問正解
          </div>
          {parseInt(streak) > 0 && (
            <div style={{ display: "flex", fontSize: 20, color: "#f59e0b", marginTop: 16 }}>
              {streak}日連続学習中
            </div>
          )}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 30,
              fontSize: 24,
              fontWeight: 900,
              color: "#fafafa",
            }}
          >
            TENS
            <span style={{ color: "#e11d48" }}>AKU</span>
          </div>
          <div style={{ display: "flex", fontSize: 14, color: "#555", marginTop: 8 }}>
            国家試験・資格試験のAI学習パートナー
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    }
  );
}
