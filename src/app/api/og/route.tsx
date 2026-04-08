import { ImageResponse } from "next/og";
import type { NextRequest } from "next/server";

export const runtime = "edge";

export async function GET(req: NextRequest) {
  const title = req.nextUrl.searchParams.get("title") || "StudyEngines";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "center",
          background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 50%, #0a0a0a 100%)",
          padding: "60px 80px",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "32px",
            maxWidth: "1000px",
          }}
        >
          <div
            style={{
              fontSize: 48,
              fontWeight: 900,
              color: "#ffffff",
              textAlign: "center",
              lineHeight: 1.3,
              letterSpacing: "-0.02em",
            }}
          >
            {title}
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: "#e11d48",
              }}
            />
            <div
              style={{
                fontSize: 24,
                fontWeight: 700,
                color: "#e11d48",
                letterSpacing: "0.05em",
              }}
            >
              StudyEngines
            </div>
          </div>
          <div
            style={{
              fontSize: 18,
              color: "#888888",
            }}
          >
            studyengines.com
          </div>
        </div>
      </div>
    ),
    {
      width: 1200,
      height: 630,
    },
  );
}
