/**
 * ドメイン別の死角表示語彙。試験前提の文言を差し替え可能に。
 * 将来 examCategory に domain フィールドが入ったら getDomainForExam を差し替える。
 */

export type BlindspotDomain = "legal_exam" | "medical" | "finance" | "engineering" | "default";

export interface BlindspotLexicon {
  sectionTitle: string;       // セクションタイトル
  sectionSubtitle: string;    // サブタイトル
  unitSingular: string;       // 知識単位の呼称 (論点/症例/銘柄/モジュール)
  unawareLabel: string;       // "気づいていない穴"
  awareLabel: string;         // "自覚している弱点"
  impactVerb: string;         // "誤判断する"
  riskNoun: string;           // 罠/盲点
}

const LEXICONS: Record<BlindspotDomain, BlindspotLexicon> = {
  legal_exam: {
    sectionTitle: "認知の死角",
    sectionSubtitle: "知っていると思っているが、実は理解していない論点",
    unitSingular: "論点",
    unawareLabel: "本人は気づいていない",
    awareLabel: "自覚している",
    impactVerb: "誤判断する",
    riskNoun: "落とし穴",
  },
  medical: {
    sectionTitle: "診断の死角",
    sectionSubtitle: "自信があるが実は盲点になっている症例",
    unitSingular: "症例",
    unawareLabel: "自覚されていない盲点",
    awareLabel: "自覚している",
    impactVerb: "見落とす",
    riskNoun: "盲点",
  },
  finance: {
    sectionTitle: "評価の死角",
    sectionSubtitle: "自信があるが実は評価が甘いセクター/銘柄",
    unitSingular: "評価単位",
    unawareLabel: "自覚されていない盲点",
    awareLabel: "自覚している",
    impactVerb: "誤評価する",
    riskNoun: "盲点",
  },
  engineering: {
    sectionTitle: "設計の死角",
    sectionSubtitle: "理解したと思っているが、実装で崩れるモジュール",
    unitSingular: "モジュール",
    unawareLabel: "気づいていない",
    awareLabel: "自覚している",
    impactVerb: "バグを出す",
    riskNoun: "落とし穴",
  },
  default: {
    sectionTitle: "認知の死角",
    sectionSubtitle: "自分では知っていると思っているが、実は穴がある判断単位",
    unitSingular: "判断単位",
    unawareLabel: "気づいていない",
    awareLabel: "自覚している",
    impactVerb: "誤判断する",
    riskNoun: "盲点",
  },
};

const EXAM_DOMAIN_MAP: Record<string, BlindspotDomain> = {
  takken: "legal_exam",
  "yobi-shihou": "legal_exam",
  "shihou-shiken": "legal_exam",
  "gyousei-shoshi": "legal_exam",
  sharoshi: "legal_exam",
  "kounin-kaikeishi": "legal_exam",
  zeirishi: "legal_exam",
  "shindan-shi": "legal_exam",
  fp2: "finance",
};

export function getDomainForExam(examId: string): BlindspotDomain {
  return EXAM_DOMAIN_MAP[examId] ?? "default";
}

export function getLexicon(domain: BlindspotDomain): BlindspotLexicon {
  return LEXICONS[domain];
}

export function getLexiconForExam(examId: string): BlindspotLexicon {
  return getLexicon(getDomainForExam(examId));
}
