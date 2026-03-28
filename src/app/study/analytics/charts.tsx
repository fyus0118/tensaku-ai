"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  Cell,
} from "recharts";

const COLORS = {
  text: "#888",
  accent: "#e11d48",
  success: "#22c55e",
  warning: "#f59e0b",
  danger: "#ef4444",
  grid: "#1a1a1a",
  tooltipBg: "#141414",
  tooltipBorder: "#2a2a2a",
};

function accuracyColor(accuracy: number): string {
  if (accuracy >= 80) return COLORS.success;
  if (accuracy >= 60) return COLORS.warning;
  return COLORS.danger;
}

// ── 科目別正答率 ──

interface SubjectAccuracyItem {
  subject: string;
  total: number;
  correct: number;
  accuracy: number;
}

function SubjectTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: SubjectAccuracyItem }> }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload as SubjectAccuracyItem;
  return (
    <div style={{ background: COLORS.tooltipBg, border: `1px solid ${COLORS.tooltipBorder}`, borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
      <p style={{ fontWeight: 700, marginBottom: 4 }}>{d.subject}</p>
      <p style={{ color: accuracyColor(d.accuracy) }}>正答率: {d.accuracy}%</p>
      <p style={{ color: COLORS.text, fontSize: 12 }}>{d.correct}/{d.total}問</p>
    </div>
  );
}

export function SubjectAccuracyChart({ data }: { data: SubjectAccuracyItem[] }) {
  if (data.length === 0) return <p className="text-sm text-[var(--color-text-muted)]">まだデータがありません</p>;

  const sorted = [...data].sort((a, b) => a.accuracy - b.accuracy);
  const chartHeight = Math.max(200, sorted.length * 44);

  return (
    <div className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-4">
      <ResponsiveContainer width="100%" height={chartHeight}>
        <BarChart data={sorted} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 4 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} horizontal={false} />
          <XAxis type="number" domain={[0, 100]} tick={{ fill: COLORS.text, fontSize: 12 }} tickLine={false} axisLine={false} unit="%" />
          <YAxis type="category" dataKey="subject" width={100} tick={{ fill: COLORS.text, fontSize: 12 }} tickLine={false} axisLine={false} />
          <Tooltip content={<SubjectTooltip />} cursor={{ fill: "rgba(255,255,255,0.03)" }} />
          <Bar dataKey="accuracy" radius={[0, 6, 6, 0]} barSize={24}>
            {sorted.map((entry, idx) => (
              <Cell key={idx} fill={accuracyColor(entry.accuracy)} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ── 正答率推移 ──

interface ScoreHistoryItem {
  date: string;
  total: number;
  accuracy: number;
}

function HistoryTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ScoreHistoryItem }> }) {
  if (!active || !payload?.[0]) return null;
  const d = payload[0].payload as ScoreHistoryItem;
  return (
    <div style={{ background: COLORS.tooltipBg, border: `1px solid ${COLORS.tooltipBorder}`, borderRadius: 8, padding: "8px 12px", fontSize: 13 }}>
      <p style={{ color: COLORS.text, marginBottom: 4 }}>{d.date}</p>
      <p style={{ color: COLORS.accent, fontWeight: 700 }}>正答率: {d.accuracy}%</p>
      <p style={{ color: COLORS.text, fontSize: 12 }}>{d.total}問</p>
    </div>
  );
}

export function ScoreHistoryChart({ data }: { data: ScoreHistoryItem[] }) {
  const recent = data.slice(-14).map((d) => ({ ...d, label: d.date.slice(5) }));

  return (
    <div className="rounded-2xl bg-[var(--color-bg-card)] border border-[var(--color-border)] p-4">
      <ResponsiveContainer width="100%" height={240}>
        <AreaChart data={recent} margin={{ top: 8, right: 12, left: -8, bottom: 4 }}>
          <defs>
            <linearGradient id="accentGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={COLORS.accent} stopOpacity={0.4} />
              <stop offset="100%" stopColor={COLORS.accent} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: COLORS.text, fontSize: 11 }} tickLine={false} axisLine={false} />
          <YAxis domain={[0, 100]} tick={{ fill: COLORS.text, fontSize: 12 }} tickLine={false} axisLine={false} unit="%" />
          <Tooltip content={<HistoryTooltip />} cursor={{ stroke: COLORS.accent, strokeDasharray: "3 3" }} />
          <Area type="monotone" dataKey="accuracy" stroke={COLORS.accent} strokeWidth={2} fill="url(#accentGrad)" dot={{ r: 3, fill: COLORS.accent, strokeWidth: 0 }} activeDot={{ r: 5, fill: COLORS.accent, strokeWidth: 2, stroke: "#fff" }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
