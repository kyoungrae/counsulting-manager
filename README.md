# 이화여대 컨설팅 분석

진로개발·서류면접·서면첨삭 엑셀을 분석하는 React 앱입니다. 로그인과 사용자 정보는 MacBook Pro의 Node API와 Docker MongoDB를 사용합니다. 브라우저는 MongoDB에 직접 접속하지 않습니다.

```text
사용자 브라우저 → 기존 도메인(Firebase Hosting: 화면 파일만)
               → Cloudflare Worker HTTPS API → Tailscale Funnel → MacBook Pro API → Docker MongoDB
```

기존 Firebase 사용 범위는 로그인과 Firestore `users`였습니다. 이를 서버 인증으로 교체했으며 비밀번호는 scrypt 해시로 저장합니다. 분석용 엑셀은 기존처럼 브라우저에서 처리하며, 이번 변경으로 분석 파일·행 데이터가 DB에 자동 저장되지는 않습니다. 기존 `*.web.app` 주소를 유지하기 위해 Firebase Hosting만 남깁니다.

## 현재 배포 주소

| 용도 | 주소 |
| --- | --- |
| 월간 컨설팅 화면 | [y2-consulting.web.app](https://y2-consulting.web.app) |
| 같은 Hosting 사이트의 별칭 | [y2-consulting.firebaseapp.com](https://y2-consulting.firebaseapp.com) |
| 브라우저용 공개 API | `https://y2-consulting-api.myljk1025.workers.dev/api` |
| API 상태 확인 | [공개 health endpoint](https://y2-consulting-api.myljk1025.workers.dev/api/health) |
| Worker 상위 연결·롤백 API | `https://macbookpro.tailf007d9.ts.net/consulting-manager/api` |
| Docker 앱 로컬 주소 | `http://127.0.0.1:3080` |

Firebase 프로젝트는 `y2-consulting`입니다. 기존 참여자 분석 앱의 Funnel 루트 `http://127.0.0.1:8080`과 이 앱의 `/consulting-manager` 경로를 함께 유지합니다. MongoDB는 `consulting-manager` Compose 프로젝트의 별도 볼륨에 저장합니다.

## Jenkins에서 수동 배포

배포 소스는 [kyoungrae/counsulting-manager](https://github.com/kyoungrae/counsulting-manager.git)의 `main` 브랜치입니다. **Git에 커밋하고 push하는 것만으로 운영 배포가 실행되지는 않습니다.** 변경을 올린 뒤 Jenkins에서 직접 실행합니다.

1. 변경 사항을 `main`에 push합니다.
2. MacBook Pro에서 [consulting-manager-deploy 작업](http://localhost:8081/job/consulting-manager-deploy/)을 엽니다.
3. **파라미터와 함께 빌드(Build with Parameters)**를 누르고 `VERIFY_ONLY`를 선택합니다.
   - **체크 해제:** 검증을 통과하면 Docker API와 Firebase Hosting을 운영 배포합니다.
   - **체크:** 테스트·린트·빌드와 운영 설정·인증 확인만 수행합니다. 운영 앱·DB 컨테이너와 Hosting을 갱신하지 않습니다.
4. 빌드를 실행하고 해당 실행의 **Console Output**에서 각 단계와 최종 결과를 확인합니다.

운영 배포는 다음 순서로 진행합니다.

```text
Git main 체크아웃
→ Docker Node.js 22에서 테스트·린트·프런트엔드 빌드
→ 기존 DB 볼륨·운영 설정·Firebase 권한 확인
→ 검증한 커밋의 Docker 이미지 빌드 및 앱·MongoDB 컨테이너 갱신
→ 앱 health와 Worker 경로의 공개 API·CORS 확인
→ Firebase Hosting y2-consulting 배포
```

MongoDB는 기존 `consulting-manager_mongo_data` 볼륨을 재사용합니다. 배포 작업은 이 볼륨을 삭제하거나 새 DB로 교체하지 않으며, 볼륨이 없으면 배포를 중단합니다. 기존 Funnel 경로를 유지하고, 화면 주소도 [y2-consulting.web.app](https://y2-consulting.web.app)으로 유지합니다.

Jenkins에서 사용하는 자격 증명은 다음과 같습니다. 아래 값은 자격 증명 **ID**이며 비밀값은 Jenkins에만 보관합니다.

| ID | 용도 |
| --- | --- |
| `accountbook-github` | Git 저장소 체크아웃 |
| `consulting-manager-runtime-env` | 운영 환경변수 Secret file: DB 비밀번호·세션 키·origin 설정 |
| `firebase-consulting-deploy` | Firebase Hosting 배포 인증 Secret file |
| `consulting-manager-gateway-hmac` | Worker와 서버의 클라이언트 IP 서명 검증을 위한 Secret text |

`.env`, 서비스 계정 키, 사용자 이전 파일, DB 백업, Jenkins 비밀 파일은 Git에 올리지 않습니다. 배포 단계는 [Jenkinsfile](Jenkinsfile), [배포 스크립트](scripts/jenkins-deploy.sh), [공개 배포 설정](deploy/jenkins/deploy.env)에 정의되어 있습니다.

## MacBook Pro Docker 실행

Docker Desktop과 Docker Compose를 실행한 뒤 환경 파일을 준비합니다.

```bash
cp .env.example .env
openssl rand -hex 32
openssl rand -hex 32
openssl rand -hex 32
```

세 명령의 결과를 각각 `.env`의 `MONGO_ROOT_PASSWORD`, `MONGO_APP_PASSWORD`, `SESSION_SECRET`에 입력합니다. 값은 서로 다르게 사용합니다. 앱 DB 비밀번호는 연결 문자열에 사용하므로 위와 같이 URL에 안전한 hex 값을 사용합니다.

```bash
docker compose up -d --build
docker compose ps
curl --fail http://localhost:3080/api/health
```

로컬 접속 주소는 `http://localhost:3080`입니다. `localhost`와 `127.0.0.1`은 서로 다른 origin이므로 `.env`의 `APP_ORIGIN`에 지정한 주소로 접속합니다. 앱은 호스트의 3080 포트를 로컬에만 바인딩하고 MongoDB 포트는 공개하지 않습니다. 기존 `consulting-participant-analysis`, AccountBook, Jenkins 컨테이너와 다른 Compose 프로젝트와 볼륨을 사용합니다.

첫 계정은 [사용자 추가 안내](scripts/README-seed-user.md)에 따라 만듭니다. 계정은 자동 생성되지 않으며, 저장소에 공통 기본 비밀번호를 두지 않습니다.

```bash
cp deploy/bootstrap.env.example .env.bootstrap.local
# 파일을 열고 관리자 아이디와 12자 이상 비밀번호를 입력
docker compose --profile tools run --rm manage
```

`.env.bootstrap.local`은 관리 명령용 일회성 컨테이너에만 전달합니다. 웹 앱 컨테이너에는 초기 관리자 비밀번호를 전달하지 않습니다. 계정 생성 후 관리용 파일의 비밀번호를 비워도 됩니다.

## 기존 도메인과 외부 API 연결

프런트엔드 도메인과 DB 저장 위치는 독립적입니다. `consulting-participant-analysis`처럼 정적 화면은 기존 Firebase Hosting에 두고 로그인 요청을 이 MacBook Pro의 HTTPS API로 보냅니다. Firebase Auth와 Firestore SDK는 앱에서 사용하지 않습니다.

현재 운영 도메인에 맞춘 환경 설정입니다.

```env
APP_ORIGIN=https://y2-consulting.web.app
ALLOWED_ORIGINS=https://y2-consulting.firebaseapp.com
COOKIE_SECURE=true
TRUST_PROXY=1
VITE_API_BASE_URL=https://y2-consulting-api.myljk1025.workers.dev/api
```

`APP_ORIGIN`과 `ALLOWED_ORIGINS`에는 origin만 넣고 경로를 붙이지 않습니다. 추가 origin은 쉼표로 구분합니다. API 주소의 `/api`까지 포함하며, 빌드할 때 정적 JavaScript에 반영됩니다. 비밀값이나 DB 연결 문자열은 `VITE_` 변수에 넣지 않습니다.

브라우저는 서버가 검증하는 세션 토큰으로 로그인합니다. 토큰은 탭의 `sessionStorage`에 보관하며, 외부 API의 서드파티 쿠키가 차단되는 브라우저에서도 동작합니다. API는 허용한 origin만 CORS로 수락합니다. 같은 origin으로 제공되는 앱은 HttpOnly 쿠키도 사용할 수 있습니다.

브라우저는 공개 Worker 주소로 접속하고, Worker만 Tailscale Funnel로 서버 요청을 중계합니다. Worker 무료 플랜의 사용량 제한을 확인하고, 유선망에서 Worker 주소가 허용되는지 확인합니다. Worker Secret `GATEWAY_HMAC_SECRET`과 Jenkins Secret text `consulting-manager-gateway-hmac`에는 동일한 32자 이상의 무작위 비밀값을 사용하며, 값은 Git이나 로그에 기록하지 않습니다. `GATEWAY_ENABLED=true`일 때 Jenkins가 이를 API에 전달합니다.

Tailscale Funnel 또는 기존 HTTPS 프록시에서 **이 앱 전용 경로**를 `http://127.0.0.1:3080`으로 연결합니다. 이미 운영 중인 `consulting-participant-analysis`의 Funnel 루트와 경로를 덮어쓰지 않습니다. MacBook Pro와 Docker Desktop, Tailscale/Funnel이 실행 중이어야 외부 브라우저에서 로그인할 수 있습니다.

Funnel 경로를 추가하기 전에 현재 설정을 Git에서 제외되는 `backups/`에 보관합니다. 이 스크립트는 설정을 읽어 저장하기만 하며 경로를 변경하지 않습니다.

```bash
sh deploy/backup-funnel.sh
```

현재 Funnel 루트는 기존 참여자 분석 앱의 `http://127.0.0.1:8080`을 유지합니다. 새 `/consulting-manager` 경로만 이 앱의 3080으로 전달하고 외부에서 `/consulting-manager/api/health` 응답을 확인합니다.

새 서버에서 같은 경로를 설정할 때는 백업 후 다음 명령을 사용합니다. 기존 루트와 다른 포트의 Serve 설정을 초기화하지 않습니다.

```bash
/Applications/Tailscale.app/Contents/MacOS/Tailscale funnel \
  --bg --https=443 --set-path=/consulting-manager http://127.0.0.1:3080
curl --fail https://macbookpro.tailf007d9.ts.net/consulting-manager/api/health
```

```bash
docker compose up -d --build
npm run deploy:hosting
```

Worker 전환을 되돌려야 하면 `deploy/jenkins/deploy.env`의 `VITE_API_BASE_URL`, `PUBLIC_API_HEALTH_URL`, `PUBLIC_API_SESSION_URL`을 각각 기존 `https://macbookpro.tailf007d9.ts.net/consulting-manager/api` 및 그 `/health`, `/auth/session` 주소로 복구하고 Jenkins에서 다시 배포합니다. 기존 Funnel 경로는 Worker의 상위 연결이므로 삭제하거나 초기화하지 않습니다.

Hosting 배포에는 Firebase CLI 인증이 필요하며 `.firebaserc`의 기본 프로젝트 `y2-consulting`을 사용합니다. `npm run deploy:hosting`은 기존 사이트에 정적 화면만 배포하므로 기존 배포 주소를 유지합니다. API의 로그인 → 새로고침 → 로그아웃을 외부 브라우저에서 확인한 뒤 전환을 완료합니다. 확인 전 기존 Firebase 데이터나 Hosting을 삭제하지 않습니다.

## 직접 소유한 도메인에 앱과 API 함께 제공하기

직접 소유한 도메인을 같은 서버에서 서비스하려는 경우에만 선택적으로 Caddy를 사용합니다. Firebase의 `*.web.app` 주소를 Caddy에 연결할 수는 없습니다.

```env
APP_DOMAIN=analysis.example.com
APP_ORIGIN=https://analysis.example.com
ALLOWED_ORIGINS=
COOKIE_SECURE=true
TRUST_PROXY=1
VITE_API_BASE_URL=/api
```

```bash
docker compose -f compose.yaml -f compose.edge.yaml up -d --build
```

공인 DNS가 이 서버를 가리키고 공유기가 80/443을 이 Mac으로 전달해야 합니다. 이미 해당 포트를 사용하는 서비스가 있다면 기존 프록시에서 `http://127.0.0.1:3080`으로 연결합니다.

## 기존 Firestore 사용자 이전

Firestore `users`를 읽기 권한이 있는 관리자 환경에서 일반 JSON으로 추출합니다. Cloud Firestore 관리형 백업 파일은 이 앱의 JSON 가져오기 형식과 다릅니다. Firebase Auth의 비밀번호 해시를 이 앱의 scrypt 해시로 그대로 변환할 수는 없으므로, 해당 계정은 새 비밀번호를 발급해야 합니다.

지원 JSON은 사용자 배열 또는 `{ "users": [...] }`입니다. 평문 비밀번호가 들어 있는 파일은 이전 작업 중에만 안전하게 보관하고 Git에 올리지 않습니다. 기존 평문 비밀번호는 가져올 때 해시로 바뀝니다. `userId` 앞뒤의 공백·탭은 제거하며 기존 UID, 역할, 승인 상태는 유지합니다.

```json
[
  {
    "uid": "기존-사용자-UID",
    "userId": "기존-로그인-아이디",
    "password": "사용자가-정한-비밀번호",
    "name": "관리자",
    "email": "admin@example.com",
    "role": "admin",
    "status": "approved"
  }
]
```

```bash
mkdir -p migrations
# 안전하게 준비한 JSON을 migrations/users.json에 저장
docker compose --profile tools run --rm \
  --volume "$PWD/migrations:/imports:ro" \
  manage node scripts/import-users.js /imports/users.json
```

가져오기 후 사용자 수·아이디·역할·승인 상태와 실제 로그인을 대조합니다. 중복 계정은 기존 계정을 임의 덮어쓰지 않으며, 기존 Firebase의 삭제는 이전 검증이 끝난 뒤 별도 수행합니다.

## 개발 실행

Node.js 22 이상을 사용합니다. API와 Vite를 호스트에서 실행할 때만 개발용 DB 포트를 엽니다. 다른 앱에서 사용 중인 27018 대신 27029를 사용합니다.

```bash
ELECTRON_SKIP_BINARY_DOWNLOAD=1 npm ci
docker compose -f compose.yaml -f compose.dev.yaml up -d mongodb
```

`.env`의 `MONGODB_URI`에서 `YOUR_HEX_APP_PASSWORD`를 실제 앱 DB 비밀번호로 바꾸고, DB 이름도 `MONGODB_DB`와 맞춥니다. `APP_ORIGIN=http://localhost:5173`, `COOKIE_SECURE=false`, `VITE_API_BASE_URL=/api`로 설정합니다. API와 프런트엔드를 서로 다른 터미널에서 실행합니다.

```bash
npm run dev:server
```

```bash
npm run dev
```

브라우저에서 `http://localhost:5173`에 접속합니다. Vite는 `/api`를 3080의 API로 전달합니다. 개발 후 운영 스택으로 돌아갈 때는 `.env`의 origin·보안 쿠키·공개 API 설정을 복구하고 운영용 Compose를 다시 적용합니다.

```bash
npm run build
npm test
```

Electron 배포판도 기본적으로 `https://y2-consulting.web.app`을 사용합니다. 다른 HTTPS 주소를 쓰는 경우에만 실행 환경의 `EWHA_APP_URL`로 변경합니다.

## 운영과 백업

```bash
docker compose logs --tail=100 app mongodb
docker compose restart app
docker compose down
```

`down`은 컨테이너와 네트워크만 내리고 MongoDB의 `consulting-manager_mongo_data` 볼륨을 유지합니다. `down -v`와 볼륨 정리 명령은 DB를 삭제하므로 운영 데이터에 사용하지 않습니다. Mongo 초기화 스크립트는 빈 볼륨에서 한 번 실행되며 `.env` 비밀번호 수정만으로 기존 DB 비밀번호가 변경되지는 않습니다.

DB 압축 백업 예시입니다. 백업 파일은 접근을 제한한 다른 디스크나 스토리지에도 복사합니다.

```bash
mkdir -p backups
docker compose exec -T mongodb sh -c \
  'mongodump --host 127.0.0.1 --username "$MONGO_INITDB_ROOT_USERNAME" --password "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin --db "$MONGO_INITDB_DATABASE" --archive --gzip' \
  > "backups/mongo-$(date +%Y%m%d-%H%M%S).archive.gz"
```

복구는 별도 빈 DB에서 먼저 검증합니다. 백업에는 비밀번호 해시와 세션이 포함될 수 있으므로 외부에 공유하지 않습니다.
