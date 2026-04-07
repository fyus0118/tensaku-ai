export type MaterialStatus = "processing" | "ready" | "failed";

export interface MaterialSummary {
  id: string;
  examId: string;
  title: string;
  subject: string;
  topic: string | null;
  totalChunks: number;
  totalChars: number;
  excerpt: string;
  createdAt: string;
  updatedAt: string;
  readMinutes: number;
  status: MaterialStatus;
  isLegacy?: boolean;
}

export interface MaterialSection {
  id: string;
  title: string;
  level: number;
  preview: string;
}

export interface MaterialDetail extends MaterialSummary {
  content: string;
  sections: MaterialSection[];
}

export interface MaterialSubjectGroup {
  subject: string;
  materials: MaterialSummary[];
}

export function normalizeMaterialContent(content: string): string {
  return content.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function estimateReadMinutes(charCount: number): number {
  return Math.max(1, Math.ceil(charCount / 700));
}

export function buildMaterialExcerpt(content: string, maxLength: number = 110): string {
  const compact = normalizeMaterialContent(content).replace(/\s+/g, " ");
  if (compact.length <= maxLength) {
    return compact;
  }
  return `${compact.slice(0, Math.max(0, maxLength - 1)).trim()}…`;
}

export function extractMaterialSections(content: string): MaterialSection[] {
  const normalized = normalizeMaterialContent(content);
  if (!normalized) return [];

  const headingPattern = /^(#{1,6})\s+(.+)$/gm;
  const headingMatches = Array.from(normalized.matchAll(headingPattern));

  if (headingMatches.length > 0) {
    return headingMatches.slice(0, 24).map((match, index) => {
      const start = match.index ?? 0;
      const nextStart = headingMatches[index + 1]?.index ?? normalized.length;
      const block = normalized.slice(start, nextStart).trim();
      const lines = block.split("\n").slice(1).join(" ").replace(/\s+/g, " ").trim();
      return {
        id: `section-${index + 1}`,
        title: match[2].trim(),
        level: match[1].length,
        preview: lines.slice(0, 80) || "この見出しの内容を読む",
      };
    });
  }

  const paragraphs = normalized
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);

  if (paragraphs.length <= 1) {
    return [
      {
        id: "section-1",
        title: "本文",
        level: 1,
        preview: buildMaterialExcerpt(normalized, 80),
      },
    ];
  }

  const sections: MaterialSection[] = [];
  const chunkSize = paragraphs.length >= 12 ? 4 : 3;
  for (let index = 0; index < paragraphs.length; index += chunkSize) {
    const part = paragraphs.slice(index, index + chunkSize);
    const preview = part.join(" ").replace(/\s+/g, " ").trim();
    sections.push({
      id: `section-${sections.length + 1}`,
      title: `セクション ${sections.length + 1}`,
      level: 1,
      preview: buildMaterialExcerpt(preview, 80),
    });
  }
  return sections;
}

export function groupMaterialsBySubject(materials: MaterialSummary[]): MaterialSubjectGroup[] {
  const map = new Map<string, MaterialSummary[]>();

  for (const material of materials) {
    const current = map.get(material.subject) ?? [];
    current.push(material);
    map.set(material.subject, current);
  }

  return Array.from(map.entries())
    .map(([subject, subjectMaterials]) => ({
      subject,
      materials: subjectMaterials.sort((a, b) => {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
      }),
    }))
    .sort((a, b) => a.subject.localeCompare(b.subject, "ja"));
}
