#!/bin/bash
# DRMS cache-bust 스크립트
# 사용법: ./bust.sh
# index.html의 모든 ?v=XXX 값을 현재 시각 기반 새 값으로 갱신.
# 이후 git add index.html && git commit && git push 하면 캐시 무력화된 새 버전 배포.

set -e
cd "$(dirname "$0")"

# 새 버전 키: YYMMDD-HHMM (예: 260612-1635)
NEW_V=$(date +%y%m%d-%H%M)
INDEX_HTML="index.html"

if [ ! -f "$INDEX_HTML" ]; then
  echo "❌ $INDEX_HTML 을 찾을 수 없습니다."
  exit 1
fi

# 모든 ?v=... 값을 NEW_V로 치환 (macOS sed 호환)
sed -i.bak -E "s/\?v=[a-zA-Z0-9-]+/?v=${NEW_V}/g" "$INDEX_HTML"
rm -f "${INDEX_HTML}.bak"

echo "✅ Cache busted: ?v=${NEW_V}"
echo "변경 확인:"
grep -E "\?v=" "$INDEX_HTML" | head -3
