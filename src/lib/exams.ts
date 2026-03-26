export interface ExamCategory {
  id: string;
  name: string;
  shortName: string;
  description: string;
  icon: string;
  color: string;
  isNational: boolean;
  examMonth: number | null;
  subjects: ExamSubject[];
  hasEssay: boolean; // 論述式があるか
}

export interface ExamSubject {
  id: string;
  name: string;
  topics: string[];
}

export const EXAM_CATEGORIES: ExamCategory[] = [
  // === 法律系 ===
  {
    id: "yobi-shihou",
    name: "司法試験予備試験",
    shortName: "予備試験",
    description: "法曹への最短ルート。短答+論文+口述の3段階",
    icon: "⚖️",
    color: "#6366f1",
    isNational: true,
    examMonth: 7,
    hasEssay: true,
    subjects: [
      { id: "kenpo", name: "憲法", topics: ["人権", "統治機構", "違憲審査基準", "判例"] },
      { id: "minpo", name: "民法", topics: ["総則", "物権", "債権", "親族・相続"] },
      { id: "keiho", name: "刑法", topics: ["総論", "各論", "構成要件", "違法性・責任"] },
      { id: "shoho", name: "商法", topics: ["会社法", "商行為", "手形・小切手"] },
      { id: "minsosho", name: "民事訴訟法", topics: ["訴訟要件", "証拠", "判決効"] },
      { id: "keisosho", name: "刑事訴訟法", topics: ["捜査", "公訴", "証拠法"] },
      { id: "gyosei", name: "行政法", topics: ["行政行為", "行政救済", "行政組織"] },
      { id: "ippan", name: "一般教養", topics: ["人文科学", "社会科学", "自然科学"] },
    ],
  },
  {
    id: "shihou-shiken",
    name: "司法試験",
    shortName: "司法試験",
    description: "法曹三者（裁判官・検察官・弁護士）の国家試験",
    icon: "⚖️",
    color: "#6366f1",
    isNational: true,
    examMonth: 7,
    hasEssay: true,
    subjects: [
      { id: "kenpo", name: "憲法", topics: ["人権", "統治機構", "違憲審査基準"] },
      { id: "minpo", name: "民法", topics: ["総則", "物権", "債権", "親族・相続"] },
      { id: "keiho", name: "刑法", topics: ["総論", "各論"] },
      { id: "shoho", name: "商法", topics: ["会社法", "商行為"] },
      { id: "minsosho", name: "民事訴訟法", topics: ["訴訟要件", "証拠", "判決効"] },
      { id: "keisosho", name: "刑事訴訟法", topics: ["捜査", "公訴", "証拠法"] },
      { id: "gyosei", name: "行政法", topics: ["行政行為", "行政救済"] },
      { id: "sentaku", name: "選択科目", topics: ["倒産法", "租税法", "経済法", "知財法", "労働法", "環境法", "国際関係法"] },
    ],
  },
  // === 会計・経営系 ===
  {
    id: "shindan-shi",
    name: "中小企業診断士",
    shortName: "診断士",
    description: "経営コンサルの国家資格。1次+2次（記述式）",
    icon: "📊",
    color: "#f59e0b",
    isNational: true,
    examMonth: 10,
    hasEssay: true,
    subjects: [
      { id: "keizai", name: "経済学・経済政策", topics: ["ミクロ経済", "マクロ経済", "経済政策"] },
      { id: "zaimu", name: "財務・会計", topics: ["簿記", "財務分析", "投資評価", "企業価値"] },
      { id: "kigyou", name: "企業経営理論", topics: ["経営戦略", "組織論", "マーケティング"] },
      { id: "unei", name: "運営管理", topics: ["生産管理", "店舗管理", "物流"] },
      { id: "houbu", name: "経営法務", topics: ["会社法", "知的財産", "契約"] },
      { id: "jouhou", name: "経営情報システム", topics: ["IT基礎", "システム開発", "情報セキュリティ"] },
      { id: "seisaku", name: "中小企業経営・政策", topics: ["中小企業白書", "政策", "支援制度"] },
      { id: "jirei", name: "2次試験（事例I〜IV）", topics: ["組織・人事", "マーケティング", "生産・技術", "財務・会計"] },
    ],
  },
  {
    id: "kounin-kaikeishi",
    name: "公認会計士",
    shortName: "会計士",
    description: "会計・監査のプロフェッショナル資格",
    icon: "🧮",
    color: "#10b981",
    isNational: true,
    examMonth: 8,
    hasEssay: true,
    subjects: [
      { id: "boki", name: "簿記", topics: ["商業簿記", "工業簿記", "連結会計"] },
      { id: "zaimu-shohyo", name: "財務会計論", topics: ["会計基準", "財務諸表", "開示制度"] },
      { id: "kanri", name: "管理会計論", topics: ["原価計算", "意思決定", "業績管理"] },
      { id: "kansa", name: "監査論", topics: ["監査基準", "内部統制", "監査手続"] },
      { id: "kigyou-hou", name: "企業法", topics: ["会社法", "金融商品取引法"] },
      { id: "zeimu", name: "租税法", topics: ["法人税", "所得税", "消費税"] },
      { id: "sentaku", name: "選択科目", topics: ["経営学", "経済学", "民法", "統計学"] },
    ],
  },
  // === 不動産・行政系 ===
  {
    id: "takken",
    name: "宅地建物取引士",
    shortName: "宅建",
    description: "不動産取引の必須国家資格。受験者20万人超",
    icon: "🏠",
    color: "#8b5cf6",
    isNational: true,
    examMonth: 10,
    hasEssay: false,
    subjects: [
      { id: "minpo-takken", name: "権利関係（民法等）", topics: ["意思表示", "代理", "物権変動", "抵当権", "賃貸借", "相続"] },
      { id: "hourei", name: "法令上の制限", topics: ["都市計画法", "建築基準法", "国土利用計画法", "農地法"] },
      { id: "takken-gyouhou", name: "宅建業法", topics: ["免許", "営業保証金", "重要事項説明", "37条書面", "8種制限"] },
      { id: "zeikin", name: "税・その他", topics: ["不動産取得税", "固定資産税", "譲渡所得税", "統計", "土地・建物"] },
    ],
  },
  {
    id: "gyousei-shoshi",
    name: "行政書士",
    shortName: "行政書士",
    description: "行政手続の専門家。記述式あり",
    icon: "📝",
    color: "#ec4899",
    isNational: true,
    examMonth: 11,
    hasEssay: true,
    subjects: [
      { id: "kiso-hourei", name: "基礎法学", topics: ["法の概念", "法体系", "法解釈"] },
      { id: "kenpo-gs", name: "憲法", topics: ["人権", "統治", "判例"] },
      { id: "gyosei-hou", name: "行政法", topics: ["行政手続法", "行政不服審査法", "行政事件訴訟法", "国家賠償法", "地方自治法"] },
      { id: "minpo-gs", name: "民法", topics: ["総則", "物権", "債権", "親族・相続"] },
      { id: "shoho-gs", name: "商法・会社法", topics: ["商法総則", "会社法"] },
      { id: "ippan-chishiki", name: "一般知識", topics: ["政治・経済・社会", "情報通信", "文章理解"] },
    ],
  },
  {
    id: "sharoshi",
    name: "社会保険労務士",
    shortName: "社労士",
    description: "労働・社会保険の専門家",
    icon: "👥",
    color: "#0ea5e9",
    isNational: true,
    examMonth: 8,
    hasEssay: false,
    subjects: [
      { id: "roudou-kijun", name: "労働基準法", topics: ["労働時間", "賃金", "解雇", "就業規則"] },
      { id: "anzen-eisei", name: "労働安全衛生法", topics: ["安全管理", "健康診断", "ストレスチェック"] },
      { id: "rousai", name: "労災保険法", topics: ["業務災害", "通勤災害", "給付"] },
      { id: "koyou", name: "雇用保険法", topics: ["失業等給付", "育児・介護", "教育訓練"] },
      { id: "kenkou-hoken", name: "健康保険法", topics: ["被保険者", "給付", "保険料"] },
      { id: "kokumin-nenkin", name: "国民年金法", topics: ["被保険者", "老齢基礎年金", "障害・遺族"] },
      { id: "kousei-nenkin", name: "厚生年金保険法", topics: ["被保険者", "老齢厚生年金", "在職老齢"] },
      { id: "ippan-joko", name: "一般常識", topics: ["労務管理", "社会保険", "統計"] },
    ],
  },
  // === 金融系 ===
  {
    id: "fp2",
    name: "FP2級（ファイナンシャルプランナー）",
    shortName: "FP2級",
    description: "お金の専門家。実技試験あり",
    icon: "💰",
    color: "#f97316",
    isNational: true,
    examMonth: 1, // 1月, 5月, 9月
    hasEssay: false,
    subjects: [
      { id: "life", name: "ライフプランニング", topics: ["社会保険", "年金", "住宅ローン", "教育資金"] },
      { id: "risk", name: "リスク管理", topics: ["生命保険", "損害保険", "第三分野"] },
      { id: "kinyu", name: "金融資産運用", topics: ["株式", "債券", "投資信託", "ポートフォリオ"] },
      { id: "tax", name: "タックスプランニング", topics: ["所得税", "住民税", "法人税", "消費税"] },
      { id: "fudousan", name: "不動産", topics: ["取引", "法令", "税金", "有効活用"] },
      { id: "souzoku", name: "相続・事業承継", topics: ["相続税", "贈与税", "事業承継", "財産評価"] },
    ],
  },
  // === 公務員 ===
  {
    id: "koumuin",
    name: "公務員試験（国家一般・地方上級）",
    shortName: "公務員",
    description: "教養+専門+論文。年間受験者数2万人超",
    icon: "🏛️",
    color: "#14b8a6",
    isNational: true,
    examMonth: 6,
    hasEssay: true,
    subjects: [
      { id: "suuri", name: "数的処理", topics: ["数的推理", "判断推理", "空間把握", "資料解釈"] },
      { id: "bunkei", name: "文章理解", topics: ["現代文", "英文", "古文"] },
      { id: "shakai-kagaku", name: "社会科学", topics: ["政治", "経済", "法律", "社会"] },
      { id: "jinbun", name: "人文科学", topics: ["日本史", "世界史", "地理", "思想"] },
      { id: "shizen", name: "自然科学", topics: ["数学", "物理", "化学", "生物", "地学"] },
      { id: "senmon", name: "専門科目", topics: ["憲法", "民法", "行政法", "経済学", "政治学"] },
      { id: "ronbun", name: "論文試験", topics: ["政策論文", "小論文"] },
    ],
  },
  // === 医療系 ===
  {
    id: "ishi",
    name: "医師国家試験",
    shortName: "医師国試",
    description: "医学部6年間の集大成。合格率約90%",
    icon: "🩺",
    color: "#ef4444",
    isNational: true,
    examMonth: 2,
    hasEssay: false,
    subjects: [
      { id: "naikagaku", name: "内科学", topics: ["循環器", "消化器", "呼吸器", "内分泌", "腎臓", "血液", "神経"] },
      { id: "gekagaku", name: "外科学", topics: ["消化器外科", "心臓血管外科", "脳神経外科"] },
      { id: "sanfujinka", name: "産婦人科", topics: ["周産期", "婦人科腫瘍", "生殖医療"] },
      { id: "shonika", name: "小児科", topics: ["新生児", "先天異常", "感染症", "発達"] },
      { id: "kouei", name: "公衆衛生", topics: ["疫学", "統計", "医療制度", "感染症法"] },
      { id: "ippan-rinsho", name: "一般臨床", topics: ["救急", "麻酔", "放射線", "病理"] },
    ],
  },
  {
    id: "kangoshi",
    name: "看護師国家試験",
    shortName: "看護師国試",
    description: "看護学部・専門学校の国家試験",
    icon: "💊",
    color: "#ec4899",
    isNational: true,
    examMonth: 2,
    hasEssay: false,
    subjects: [
      { id: "kiso-kango", name: "基礎看護学", topics: ["看護概論", "基本技術", "看護過程"] },
      { id: "seijin", name: "成人看護学", topics: ["急性期", "慢性期", "終末期", "周手術期"] },
      { id: "roujin", name: "老年看護学", topics: ["加齢変化", "認知症", "リハビリ"] },
      { id: "boshi", name: "母性看護学", topics: ["妊娠・分娩・産褥", "新生児", "女性の健康"] },
      { id: "shouni", name: "小児看護学", topics: ["成長発達", "小児疾患", "入院児の看護"] },
      { id: "seishin", name: "精神看護学", topics: ["精神疾患", "治療", "社会復帰"] },
      { id: "zaitaku", name: "在宅看護論", topics: ["訪問看護", "在宅医療", "地域連携"] },
      { id: "kenko-shien", name: "健康支援と社会保障", topics: ["公衆衛生", "社会保障", "関係法規"] },
    ],
  },
  // === IT・情報処理 ===
  {
    id: "it-passport",
    name: "ITパスポート試験",
    shortName: "ITパスポート",
    description: "IT系国家資格の登竜門。全社会人に推奨される基礎的IT力",
    icon: "💻",
    color: "#6366f1",
    isNational: true,
    examMonth: null, // CBT方式で通年
    hasEssay: false,
    subjects: [
      { id: "strategy", name: "ストラテジ系", topics: ["企業活動", "法務", "経営戦略", "システム戦略", "マーケティング"] },
      { id: "management", name: "マネジメント系", topics: ["プロジェクトマネジメント", "サービスマネジメント", "システム監査"] },
      { id: "technology", name: "テクノロジ系", topics: ["基礎理論", "アルゴリズム", "コンピュータシステム", "技術要素", "セキュリティ", "ネットワーク", "データベース"] },
    ],
  },
  {
    id: "kihon-jouhou",
    name: "基本情報技術者試験",
    shortName: "基本情報",
    description: "ITエンジニアの登竜門。科目A+科目Bの2部構成",
    icon: "🖥️",
    color: "#6366f1",
    isNational: true,
    examMonth: null, // CBT通年
    hasEssay: false,
    subjects: [
      { id: "kiso-riron", name: "基礎理論", topics: ["離散数学", "応用数学", "アルゴリズム", "プログラミング", "データ構造"] },
      { id: "computer", name: "コンピュータシステム", topics: ["プロセッサ", "メモリ", "OS", "ハードウェア", "ソフトウェア"] },
      { id: "gijutsu", name: "技術要素", topics: ["データベース", "ネットワーク", "セキュリティ", "マルチメディア"] },
      { id: "kaihatsu", name: "開発技術", topics: ["システム開発", "ソフトウェア開発", "テスト手法", "開発プロセス"] },
      { id: "management-ki", name: "マネジメント", topics: ["プロジェクトマネジメント", "サービスマネジメント", "システム監査"] },
      { id: "strategy-ki", name: "ストラテジ", topics: ["システム戦略", "経営戦略", "企業と法務"] },
      { id: "kamoku-b", name: "科目B（アルゴリズム）", topics: ["擬似言語", "トレース", "データ構造操作", "セキュリティ実践"] },
    ],
  },
  // === 会計・簿記 ===
  {
    id: "boki2",
    name: "日商簿記検定2級",
    shortName: "簿記2級",
    description: "経理・会計の実務レベル資格。商業簿記+工業簿記",
    icon: "📒",
    color: "#10b981",
    isNational: false,
    examMonth: null, // 年3回 + CBT
    hasEssay: false,
    subjects: [
      { id: "shogyo-boki", name: "商業簿記", topics: ["仕訳", "決算整理", "財務諸表作成", "連結会計", "税効果会計", "リース会計", "外貨建取引"] },
      { id: "kogyo-boki", name: "工業簿記", topics: ["費目別計算", "部門別計算", "個別原価計算", "総合原価計算", "標準原価計算", "直接原価計算", "CVP分析"] },
    ],
  },
  {
    id: "boki3",
    name: "日商簿記検定3級",
    shortName: "簿記3級",
    description: "簿記の基礎。就職・転職で評価される入門資格",
    icon: "📒",
    color: "#10b981",
    isNational: false,
    examMonth: null,
    hasEssay: false,
    subjects: [
      { id: "boki-kiso", name: "簿記の基礎", topics: ["仕訳", "勘定記入", "試算表", "精算表", "財務諸表"] },
      { id: "shiwake", name: "取引と仕訳", topics: ["現金・預金", "売掛金・買掛金", "手形", "有価証券", "固定資産", "貸倒引当金", "減価償却"] },
      { id: "kessan", name: "決算", topics: ["決算整理仕訳", "精算表作成", "損益計算書", "貸借対照表", "繰越試算表"] },
    ],
  },
  // === 販売・流通 ===
  {
    id: "touroku-hanbai",
    name: "登録販売者試験",
    shortName: "登録販売者",
    description: "一般用医薬品の販売に必須。ドラッグストア等で需要大",
    icon: "💊",
    color: "#ec4899",
    isNational: true,
    examMonth: 8, // 都道府県により異なるが8-12月
    hasEssay: false,
    subjects: [
      { id: "iyakuhin-kiso", name: "医薬品に共通する特性と基本的な知識", topics: ["医薬品概論", "副作用", "適正使用", "薬害の歴史"] },
      { id: "jinntai", name: "人体の働きと医薬品", topics: ["消化器系", "呼吸器系", "循環器系", "泌尿器系", "感覚器", "皮膚", "中枢神経系"] },
      { id: "syuyaku", name: "主な医薬品とその作用", topics: ["かぜ薬", "解熱鎮痛薬", "胃腸薬", "アレルギー用薬", "皮膚用薬", "点眼薬", "漢方薬"] },
      { id: "yakuji-hourei", name: "薬事関連法規・制度", topics: ["医薬品医療機器等法", "販売業の許可", "販売制度", "リスク区分"] },
      { id: "tekisei-shiyo", name: "医薬品の適正使用・安全対策", topics: ["添付文書の読み方", "副作用報告制度", "医薬品副作用被害救済制度"] },
    ],
  },
  // === 入試（既存機能の拡張） ===
  {
    id: "daigaku-nyushi",
    name: "大学入試（小論文・志望理由書）",
    shortName: "大学入試",
    description: "小論文・志望理由書・自己推薦書の添削",
    icon: "🎓",
    color: "#e11d48",
    isNational: false,
    examMonth: null,
    hasEssay: true,
    subjects: [
      { id: "shoronbun", name: "小論文", topics: ["社会問題", "科学技術", "教育", "国際関係"] },
      { id: "shibou-riyu", name: "志望理由書", topics: ["AO入試", "推薦入試", "総合型選抜"] },
      { id: "jiko-suisen", name: "自己推薦書", topics: ["活動実績", "将来ビジョン"] },
    ],
  },
  {
    id: "daigaku-report",
    name: "大学レポート",
    shortName: "大学レポート",
    description: "大学の各種レポート・論文の添削",
    icon: "📖",
    color: "#e11d48",
    isNational: false,
    examMonth: null,
    hasEssay: true,
    subjects: [
      { id: "ronsho", name: "論証型レポート", topics: ["法学", "経済学", "社会学"] },
      { id: "jikken", name: "実験レポート", topics: ["理工系", "IMRAD構造"] },
      { id: "bunken", name: "文献レビュー", topics: ["先行研究", "批判的検討"] },
    ],
  },
];

export function getExamById(id: string): ExamCategory | undefined {
  return EXAM_CATEGORIES.find((e) => e.id === id);
}

export function getExamsByType(national: boolean): ExamCategory[] {
  return EXAM_CATEGORIES.filter((e) => e.isNational === national);
}
