#!/bin/sh
# Capture configuration only; never change existing Serve/Funnel routes.
set -eu
umask 077

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
backup_dir=${1:-"$project_root/backups"}
tailscale_bin=${TAILSCALE_BIN:-/Applications/Tailscale.app/Contents/MacOS/Tailscale}
if [ ! -x "$tailscale_bin" ]; then
  tailscale_bin=$(command -v tailscale) || {
    echo 'Tailscale 실행 파일이 없습니다. TAILSCALE_BIN을 지정하세요.' >&2
    exit 1
  }
fi

mkdir -p "$backup_dir"
backup_file="$backup_dir/tailscale-serve-$(date -u +%Y%m%dT%H%M%SZ)-$$.json"
set -C
if "$tailscale_bin" serve status --json > "$backup_file"; then
  printf 'Tailscale Serve/Funnel 설정 백업: %s\n' "$backup_file"
else
  rm -f "$backup_file"
  echo '설정 백업에 실패했습니다. 기존 경로는 변경하지 않았습니다.' >&2
  exit 1
fi
