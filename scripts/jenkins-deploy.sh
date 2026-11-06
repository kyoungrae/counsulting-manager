#!/usr/bin/env bash
# Secrets are read only from Jenkins Secret file credentials. Do not enable xtrace.
set -euo pipefail

project_root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
cd "$project_root"
# shellcheck source=../deploy/jenkins/deploy.env
source ./deploy/jenkins/deploy.env

commit=$(git rev-parse --verify HEAD)
if [[ ! "$commit" =~ ^[a-f0-9]{40,64}$ ]]; then
  echo '배포할 Git 커밋을 확인할 수 없습니다.' >&2
  exit 1
fi
build_number=${BUILD_NUMBER:-manual}
if [[ ! "$build_number" =~ ^[A-Za-z0-9_.-]+$ ]]; then
  echo 'BUILD_NUMBER 형식이 올바르지 않습니다.' >&2
  exit 1
fi
CI_IMAGE="consulting-manager-ci:${build_number}-${commit:0:12}"
export API_IMAGE="consulting-manager:$commit"
export MONGO_IMAGE="consulting-manager-mongo:$commit"

compose_runtime() {
  if [[ -z "${RUNTIME_ENV:-}" || ! -r "$RUNTIME_ENV" ]]; then
    echo 'Jenkins Secret file consulting-manager-runtime-env가 필요합니다.' >&2
    return 1
  fi
  docker compose --project-name "$COMPOSE_PROJECT_NAME" \
    --env-file "$RUNTIME_ENV" -f deploy/jenkins/compose.yaml "$@"
}

require_firebase_token() {
  if [[ -z "${FIREBASE_TOKEN_FILE:-}" || ! -s "$FIREBASE_TOKEN_FILE" || ! -r "$FIREBASE_TOKEN_FILE" ]]; then
    echo 'Jenkins Secret file firebase-consulting-deploy가 필요합니다.' >&2
    return 1
  fi
}

case "${1:-}" in
  verify)
    docker build --target verified --file deploy/jenkins/Dockerfile \
      --build-arg "VITE_API_BASE_URL=$VITE_API_BASE_URL" --tag "$CI_IMAGE" .
    ;;
  preflight)
    # Read-only checks. Require the existing production volume rather than
    # accidentally initializing a new database under a different project name.
    docker volume inspect consulting-manager_mongo_data >/dev/null
    compose_runtime config --quiet
    compose_runtime config --format json | docker run --rm --interactive "$CI_IMAGE" \
      node --input-type=module -e '
        import { readFileSync } from "node:fs";
        import { loadConfig } from "./server/config.js";
        const compose = JSON.parse(readFileSync(0, "utf8"));
        const config = loadConfig(compose.services.app.environment);
        if (config.appOrigin !== "https://y2-consulting.web.app" || !config.cookieSecure) {
          throw new Error("운영 origin과 HTTPS 쿠키 설정을 확인하세요.");
        }
        if (compose.services.mongodb.ports?.length) {
          throw new Error("운영 MongoDB 포트를 공개할 수 없습니다.");
        }
        console.log("운영 환경과 기존 MongoDB 볼륨 확인 완료");
      '
    ;;
  build)
    docker build --file Dockerfile --build-arg "VITE_API_BASE_URL=$VITE_API_BASE_URL" \
      --tag "$API_IMAGE" .
    docker build --file deploy/mongo/Dockerfile --tag "$MONGO_IMAGE" .
    ;;
  deploy)
    docker volume inspect consulting-manager_mongo_data >/dev/null
    compose_runtime up --detach --no-build --wait --wait-timeout 120 mongodb app
    ;;
  check)
    docker run --rm \
      --env "PUBLIC_FRONTEND_ORIGIN=$PUBLIC_FRONTEND_ORIGIN" \
      --env "PUBLIC_API_HEALTH_URL=$PUBLIC_API_HEALTH_URL" \
      --env "PUBLIC_API_SESSION_URL=$PUBLIC_API_SESSION_URL" \
      "$CI_IMAGE" node --input-type=module -e '
        const headers = { Origin: process.env.PUBLIC_FRONTEND_ORIGIN };
        let lastError;
        for (let attempt = 0; attempt < 12; attempt++) {
          try {
            const health = await fetch(process.env.PUBLIC_API_HEALTH_URL, { headers, signal: AbortSignal.timeout(5000) });
            if (!health.ok || health.headers.get("access-control-allow-origin") !== process.env.PUBLIC_FRONTEND_ORIGIN || (await health.json()).status !== "ok") throw new Error("공개 API 준비 상태 확인 실패");
            const response = await fetch(process.env.PUBLIC_API_SESSION_URL, { headers, signal: AbortSignal.timeout(5000) });
            const session = await response.json();
            if (!response.ok || session.user !== null || session.profile !== null) throw new Error("공개 인증 API 확인 실패");
            console.log("공개 HTTPS API와 Hosting origin CORS 확인 완료");
            process.exit(0);
          } catch (error) {
            lastError = error;
            if (attempt < 11) await new Promise(resolve => setTimeout(resolve, 2000));
          }
        }
        console.error(lastError?.message || "공개 API 확인 실패");
        process.exit(1);
      '
    ;;
  firebase-check)
    require_firebase_token
    docker run --rm --interactive --env "FIREBASE_PROJECT=$FIREBASE_PROJECT" "$CI_IMAGE" \
      sh -ec 'FIREBASE_TOKEN=$(cat); export FIREBASE_TOKEN; exec ./node_modules/.bin/firebase hosting:sites:list --project "$FIREBASE_PROJECT" --non-interactive' \
      < "$FIREBASE_TOKEN_FILE"
    ;;
  firebase)
    require_firebase_token
    # Deploy the same dist that passed verification; token goes through stdin,
    # never into the image, workspace, Docker metadata, or command arguments.
    docker run --rm --interactive --env "FIREBASE_PROJECT=$FIREBASE_PROJECT" "$CI_IMAGE" \
      sh -ec 'FIREBASE_TOKEN=$(cat); export FIREBASE_TOKEN; exec ./node_modules/.bin/firebase deploy --only hosting --project "$FIREBASE_PROJECT" --non-interactive' \
      < "$FIREBASE_TOKEN_FILE"
    ;;
  cleanup)
    # Keep all commit-tagged runtime images, including the images still in use.
    docker image rm "$CI_IMAGE" >/dev/null 2>&1 || true
    ;;
  *)
    echo '사용법: bash scripts/jenkins-deploy.sh {verify|preflight|build|deploy|check|firebase-check|firebase|cleanup}' >&2
    exit 1
    ;;
esac
