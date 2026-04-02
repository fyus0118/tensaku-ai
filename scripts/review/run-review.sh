#!/bin/bash
# Gemini照合パイプライン自動実行
# cronから呼ばれる想定

cd /Users/yusei/tensaku-ai
source .env.local
export PATH="/Users/yusei/.bun/bin:$PATH"

echo "$(date): Gemini照合開始" >> /tmp/review-cron.log
bun run scripts/review/review-gemini.ts scripts/review/screenshots/takken >> /tmp/review-cron.log 2>&1
echo "$(date): Gemini照合終了" >> /tmp/review-cron.log
