#!/bin/bash
# Kindle自動スクショスクリプト
#
# 使い方:
#   1. Mac Kindle アプリでテキストを開く
#   2. 最初のページに移動
#   3. このスクリプトを実行:
#      bash scripts/review/capture-kindle.sh [ページ数] [出力ディレクトリ]
#
# 例: bash scripts/review/capture-kindle.sh 500 scripts/review/screenshots/takken

PAGES=${1:-100}
OUTPUT_DIR=${2:-"scripts/review/screenshots"}
DELAY=${3:-1.5}

mkdir -p "$OUTPUT_DIR"

echo "📸 Kindle自動スクショ開始"
echo "   ページ数: $PAGES"
echo "   出力先: $OUTPUT_DIR"
echo "   ページ送り間隔: ${DELAY}秒"
echo ""
echo "⚠️  3秒後に開始します。Kindleアプリを最前面にしてください。"
echo "   中断: Ctrl+C"
sleep 3

# Kindleを最前面に
osascript -e 'tell application "Amazon Kindle" to activate'
sleep 1

# ウィンドウ領域を取得（プロセス名は "Kindle"）
REGION=$(osascript -e '
tell application "System Events"
    tell process "Kindle"
        set win to window 1
        set {x, y} to position of win
        set {w, h} to size of win
        return "" & x & "," & y & "," & w & "," & h
    end tell
end tell
' 2>&1)

if [ -z "$REGION" ] || [[ "$REGION" == *"error"* ]]; then
    echo "❌ Kindleウィンドウが見つかりません"
    exit 1
fi

echo "   ウィンドウ領域: $REGION"
echo ""

for i in $(seq 1 $PAGES); do
    FILENAME=$(printf "%04d.png" $i)

    # Kindleウィンドウのスクリーンショット
    screencapture -x -R "$REGION" "$OUTPUT_DIR/$FILENAME"

    # 進捗表示
    if [ $((i % 10)) -eq 0 ] || [ $i -eq 1 ]; then
        echo "  ✅ $i/$PAGES ページ完了"
    fi

    # 次のページへ（右矢印キー）
    osascript -e 'tell application "System Events" to key code 124'

    sleep "$DELAY"
done

echo ""
echo "========================================"
echo "📊 スクショ完了"
echo "  ページ数: $PAGES"
echo "  出力先: $OUTPUT_DIR"
TOTAL=$(ls "$OUTPUT_DIR"/*.png 2>/dev/null | wc -l | tr -d ' ')
echo "  ファイル数: $TOTAL"
echo "========================================"
