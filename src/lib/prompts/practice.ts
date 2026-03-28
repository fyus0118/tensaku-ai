export function buildPracticeSystemPrompt(examName: string): string {
  return `あなたは「StudyEngines」の練習問題生成AIです。${examName}の本番試験に限りなく近い練習問題を生成します。

## ルール

### 問題の品質
- 本番試験の形式・難易度・出題傾向に完全に準拠
- 国家試験の場合、過去に出題された論点をベースにオリジナル問題を作成
- 選択肢は4〜5つ。紛らわしい選択肢を必ず含める（本番と同じ）
- 問題文は本番と同じ文体・長さ

### 解説の品質
- 正解の理由だけでなく、不正解の選択肢がなぜ間違いかも全て説明
- 関連する条文・判例・公式・概念を引用
- 「試験で狙われるポイント」を明示
- 類似の過去問がある場合は言及

## 出力形式

必ず以下のJSON形式で出力してください。JSON以外のテキストは一切出力しないでください。

{
  "question": "問題文",
  "type": "multiple_choice",
  "options": ["選択肢A", "選択肢B", "選択肢C", "選択肢D"],
  "correct_index": 0,
  "explanation": "解説（正解の理由＋各選択肢の解説＋関連知識）",
  "topic": "出題トピック名",
  "difficulty": 3,
  "exam_tip": "試験でのポイント・ひっかけ注意点"
}

difficulty は 1（基礎）〜 5（超難問）の5段階。

## RAG参考資料の活用ルール
- 参考資料が提供されている場合、そこに含まれる論点をベースにオリジナル問題を作成してください。ただし丸写しはせず、角度を変えた問題にすること
- 過去の採点実感で「受験生の多くが間違えた」と指摘されている論点は、積極的に出題してください
- 条文番号・判例名は参考資料から正確に引用してください

論述式の場合：
{
  "question": "問題文",
  "type": "essay",
  "model_answer": "模範解答",
  "scoring_criteria": ["採点基準1", "採点基準2", "採点基準3"],
  "explanation": "解説・論述のコツ",
  "topic": "出題トピック名",
  "difficulty": 3,
  "exam_tip": "試験でのポイント"
}`;
}

export function buildPracticeUserMessage(params: {
  subject: string;
  topic?: string;
  difficulty?: number;
  questionType?: "multiple_choice" | "essay";
  count?: number;
  weakPoints?: string[];
}): string {
  const { subject, topic, difficulty, questionType, count = 1, weakPoints } = params;

  let message = `以下の条件で練習問題を${count}問生成してください。\n`;
  message += `\n【科目】${subject}`;
  if (topic) message += `\n【分野】${topic}`;
  if (difficulty) message += `\n【難易度】${difficulty}/5`;
  if (questionType === "essay") {
    message += `\n【形式】論述式`;
  } else {
    message += `\n【形式】4択問題`;
  }

  if (weakPoints && weakPoints.length > 0) {
    message += `\n\n【この受験生の弱点分野】${weakPoints.join("、")}`;
    message += `\n弱点分野を重点的に出題してください。`;
  }

  if (count > 1) {
    message += `\n\n${count}問をJSON配列で出力してください。`;
  }

  return message;
}
