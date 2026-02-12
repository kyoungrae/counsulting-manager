# 로그인 사용자 추가 방법

아이디 **805246** / 비밀번호 **930902** 로 로그인하려면 아래 둘 중 하나로 사용자를 추가하면 됩니다.

---

## 방법 1: Firebase 콘솔에서 수동 추가

1. [Firebase Console](https://console.firebase.google.com/) → **y2-consulting** 선택
2. **Firestore Database** → **데이터** 탭
3. **컬렉션 시작** 또는 기존 `users` 컬렉션 선택
4. **문서 추가**
   - **문서 ID**: `user_805246` (그대로 입력)
   - **필드**:

| 필드     | 타입   | 값                    |
|----------|--------|------------------------|
| uid      | string | user_805246            |
| userId   | string | 805246                 |
| email    | string | 805246@y2-consulting.app |
| password | string | 930902                 |
| name     | string | 분석 사용자            |
| role     | string | admin                 |
| status   | string | approved               |

5. 저장 후 앱에서 **아이디 805246 / 비밀번호 930902** 로 로그인

---

## 방법 2: 스크립트로 추가 (서비스 계정 키 필요)

1. Firebase 콘솔 → **프로젝트 설정** → **서비스 계정** → **새 비공개 키 생성** → JSON 다운로드
2. 다운로드한 파일을 프로젝트 루트에 `serviceAccountKey.json` 으로 저장
3. 터미널에서 실행:
   ```bash
   npm run seed:user
   ```
