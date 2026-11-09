#!/usr/bin/env bash
# 운영 Docker 호스트에서 상담사 명단을 한 번에 등록합니다.
# 사용: 저장소 루트에서  bash scripts/easy-import-consultants.sh
set -euo pipefail

cd "$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"

echo "1) 검토된 상담사 원본 확인…"
git fetch origin cursor/receipt-table-margins-e75c >/dev/null 2>&1 || true
if ! git cat-file -e f34084945962ca4a52c43336daf8b7612894338c^{blob} 2>/dev/null; then
  echo "상담사 원본 Git 개체가 없습니다. git fetch 후 다시 실행하세요." >&2
  exit 1
fi

tmp_dir=$(mktemp -d "${TMPDIR:-/tmp}/consultants.XXXXXX")
chmod 700 "$tmp_dir"
json_path="$tmp_dir/consultants.json"
cleanup() { rm -rf "$tmp_dir"; }
trap cleanup EXIT HUP INT TERM

echo "2) 중간 JSON 생성…"
node scripts/extract-consultants.js "$json_path"

echo "3) 운영 앱 컨테이너 찾기…"
container=$(docker ps -q --filter label=com.docker.compose.project=consulting-manager --filter label=com.docker.compose.service=app)
if [[ -z "$container" ]]; then
  echo "consulting-manager app 컨테이너를 찾지 못했습니다. 젠킨스 배포 후 다시 실행하세요." >&2
  exit 1
fi
if [[ "$(echo "$container" | wc -l | tr -d ' ')" != "1" ]]; then
  echo "app 컨테이너가 여러 개입니다. 예상한 운영 환경인지 확인하세요." >&2
  exit 1
fi

echo "4) DB에 등록…"
docker exec -i "$container" node scripts/import-consultants.js - < "$json_path"

echo "완료. 웹에서 새로고침 후 '다시 시도'를 눌러 주세요."
