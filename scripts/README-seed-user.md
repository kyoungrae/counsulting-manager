# 로그인 사용자 추가 방법

인증은 **Firebase Auth**만 사용합니다. Firestore `users` 문서에 `password` 필드를 넣지 마세요.

로그인 시 앱은 아이디를 `{아이디}@{도메인}` 이메일로 바꿔 Auth에 로그인합니다.  
도메인 기본값: `y2-consulting.app` (`VITE_AUTH_EMAIL_DOMAIN` / `SEED_AUTH_EMAIL_DOMAIN`으로 변경 가능)

---

## 방법 1: 스크립트 (권장)

1. Firebase 콘솔 → **프로젝트 설정** → **서비스 계정** → **새 비공개 키 생성** → JSON 다운로드  
2. 파일을 프로젝트 루트에 `serviceAccountKey.json` 으로 저장 (Git에 올리지 마세요)  
3. 터미널:

```bash
SEED_USER_ID=원하는아이디 \
SEED_USER_PASSWORD='안전한비밀번호' \
SEED_USER_NAME='표시이름' \
SEED_USER_ROLE=admin \
npm run seed:user
```

선택 환경변수: `SEED_USER_EMAIL`, `SEED_USER_STATUS`(기본 `approved`), `SEED_AUTH_EMAIL_DOMAIN`

스크립트는 Auth 계정을 만들고, Firestore `users/{authUid}`에 프로필만 저장합니다 (비밀번호 저장 안 함).

---

## 방법 2: 콘솔 수동

1. **Authentication** → 사용자 추가 → 이메일 `{아이디}@y2-consulting.app` + 비밀번호  
2. **Firestore** → `users` 컬렉션 → 문서 ID를 **Auth UID**와 동일하게 추가  

| 필드   | 타입   | 값 예시                          |
|--------|--------|----------------------------------|
| uid    | string | (Auth UID와 동일)                |
| userId | string | 로그인에 쓸 아이디               |
| email  | string | `{아이디}@y2-consulting.app`     |
| name   | string | 표시 이름                        |
| role   | string | `admin` 또는 `user`              |
| status | string | `approved`                       |

**password 필드는 만들지 마세요.**

---

## Firestore 규칙

`firestore.rules`는 본인 문서 읽기만 허용하고, 클라이언트 쓰기는 막습니다.  
규칙 변경 후:

```bash
npx firebase deploy --only firestore:rules
```
