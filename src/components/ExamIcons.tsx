const s = { xmlns: "http://www.w3.org/2000/svg", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };

// 法律系 — 天秤
export function IconLaw({ className }: { className?: string }) {
  return (
    <svg {...s} className={className}>
      <path d="M12 3v18" />
      <path d="M5 7l7-4 7 4" />
      <path d="M3 13l2-6 2 6a3 3 0 01-4 0z" />
      <path d="M17 13l2-6 2 6a3 3 0 01-4 0z" />
      <line x1="8" y1="21" x2="16" y2="21" />
    </svg>
  );
}

// 会計系 — 電卓
export function IconAccounting({ className }: { className?: string }) {
  return (
    <svg {...s} className={className}>
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <rect x="7" y="5" width="10" height="4" rx="1" />
      <circle cx="8.5" cy="12.5" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12.5" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="12.5" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="16" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="12" cy="16" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="15.5" cy="16" r="0.75" fill="currentColor" stroke="none" />
      <circle cx="8.5" cy="19.5" r="0.75" fill="currentColor" stroke="none" />
      <rect x="11" y="19" width="5" height="1" rx="0.5" fill="currentColor" stroke="none" />
    </svg>
  );
}

// 不動産 — ビル
export function IconBuilding({ className }: { className?: string }) {
  return (
    <svg {...s} className={className}>
      <path d="M3 21h18" />
      <path d="M5 21V7l7-4 7 4v14" />
      <path d="M9 21v-4h6v4" />
      <rect x="8" y="8" width="2.5" height="2.5" rx="0.5" />
      <rect x="13.5" y="8" width="2.5" height="2.5" rx="0.5" />
      <rect x="8" y="13" width="2.5" height="2.5" rx="0.5" />
      <rect x="13.5" y="13" width="2.5" height="2.5" rx="0.5" />
    </svg>
  );
}

// 行政 — 公印・判子
export function IconStamp({ className }: { className?: string }) {
  return (
    <svg {...s} className={className}>
      <path d="M14 3a2 2 0 00-4 0v5a1 1 0 01-1 1H7a1 1 0 00-1 1v2h12v-2a1 1 0 00-1-1h-2a1 1 0 01-1-1V3z" />
      <rect x="4" y="14" width="16" height="3" rx="1" />
      <path d="M6 20h12" />
    </svg>
  );
}

// 社労士 — 人と盾
export function IconLabor({ className }: { className?: string }) {
  return (
    <svg {...s} className={className}>
      <circle cx="9" cy="7" r="3" />
      <path d="M3 21v-2a4 4 0 014-4h4" />
      <path d="M16 11l-1.5 6.5L16 21l1.5-3.5L19 21l1.5-3.5L16 11z" />
      <path d="M16 11a3 3 0 100-6 3 3 0 000 6z" strokeDasharray="2 2" />
    </svg>
  );
}

// FP — コイン
export function IconFinance({ className }: { className?: string }) {
  return (
    <svg {...s} className={className}>
      <circle cx="12" cy="12" r="9" />
      <path d="M9 9.5a2.5 2.5 0 015 0c0 1.5-2.5 2-2.5 3.5" />
      <path d="M12 8v-1.5" />
      <path d="M12 17.5V16" />
      <path d="M9.5 15.5h5" />
      <path d="M10 8.5h4" />
    </svg>
  );
}

// 公務員 — 庁舎
export function IconGovernment({ className }: { className?: string }) {
  return (
    <svg {...s} className={className}>
      <path d="M12 2l10 5v2H2V7l10-5z" />
      <path d="M4 9v10" />
      <path d="M8 9v10" />
      <path d="M12 9v10" />
      <path d="M16 9v10" />
      <path d="M20 9v10" />
      <path d="M2 19h20v2H2z" />
    </svg>
  );
}

// 医師 — 聴診器
export function IconDoctor({ className }: { className?: string }) {
  return (
    <svg {...s} className={className}>
      <path d="M6 10V7a6 6 0 0112 0v3" />
      <path d="M6 10a2 2 0 01-2-2V6" />
      <path d="M18 10a2 2 0 002-2V6" />
      <circle cx="12" cy="18" r="3" />
      <path d="M12 15V10" />
      <circle cx="12" cy="18" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

// 看護師 — 十字とハート
export function IconNurse({ className }: { className?: string }) {
  return (
    <svg {...s} className={className}>
      <path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2z" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  );
}

// IT — ターミナル
export function IconTerminal({ className }: { className?: string }) {
  return (
    <svg {...s} className={className}>
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="M6 9l3 3-3 3" />
      <path d="M12 15h5" />
    </svg>
  );
}

// 簿記 — 帳簿
export function IconLedger({ className }: { className?: string }) {
  return (
    <svg {...s} className={className}>
      <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
      <path d="M8 7h8" />
      <path d="M8 11h8" />
      <path d="M12 7v8" />
    </svg>
  );
}

// 登録販売者 — 薬瓶
export function IconPharmacy({ className }: { className?: string }) {
  return (
    <svg {...s} className={className}>
      <path d="M9 2h6v3H9z" />
      <path d="M7 5h10a1 1 0 011 1v14a2 2 0 01-2 2H8a2 2 0 01-2-2V6a1 1 0 011-1z" />
      <path d="M12 10v6" />
      <path d="M9 13h6" />
    </svg>
  );
}

// 大学入試 — 卒業帽
export function IconGraduation({ className }: { className?: string }) {
  return (
    <svg {...s} className={className}>
      <path d="M12 3L1 9l11 6 9-4.91V17" />
      <path d="M5 13.18v4.82a8.36 8.36 0 007 3 8.36 8.36 0 007-3v-4.82" />
    </svg>
  );
}

// 大学レポート — ペンと紙
export function IconReport({ className }: { className?: string }) {
  return (
    <svg {...s} className={className}>
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
      <path d="M14 2v6h6" />
      <path d="M8 13h8" />
      <path d="M8 17h5" />
      <path d="M8 9h2" />
    </svg>
  );
}

// 試験IDからアイコンコンポーネントを取得
export const EXAM_ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  "yobi-shihou": IconLaw,
  "shihou-shiken": IconLaw,
  "shindan-shi": IconAccounting,
  "kounin-kaikeishi": IconAccounting,
  "takken": IconBuilding,
  "gyousei-shoshi": IconStamp,
  "sharoshi": IconLabor,
  "fp2": IconFinance,
  "koumuin": IconGovernment,
  "ishi": IconDoctor,
  "kangoshi": IconNurse,
  "it-passport": IconTerminal,
  "kihon-jouhou": IconTerminal,
  "boki2": IconLedger,
  "boki3": IconLedger,
  "touroku-hanbai": IconPharmacy,
  "daigaku-nyushi": IconGraduation,
  "daigaku-report": IconReport,
};
