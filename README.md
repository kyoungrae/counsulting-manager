# 이화여대 컨설팅 분석 프로그램 (웹 버전)

## 🚀 시작하기

이 프로그램은 진로/취업 컨설팅 데이터를 분석하고 시각화하는 **웹 애플리케이션**입니다.

## ✅ 설치/실행 방법 (처음 받았을 때)

이 레포는 용량/속도 문제 때문에 보통 `node_modules/`를 Git에 올리지 않습니다.  
대신 `package.json` / `package-lock.json`만 올리고, **클론 후 로컬에서 `npm install`로 의존성을 다시 설치**하는 구조입니다.

### 1) Node.js 준비
- 권장: **Node LTS(20 또는 22)**  
- 확인:

```bash
node -v
npm -v
```

### 2) 설치 (최초 1회 또는 의존성 변경 시)
```bash
npm install
```

### 3) 개발 서버 실행 (수정 모드)
코드를 수정하면서 바로 결과를 확인하고 싶을 때 사용합니다.
```bash
npm run dev
```
- 실행 시 **기본 브라우저가 자동으로 열립니다.**
- 기본 주소: **http://localhost:5173**

### 4) 프로덕션 빌드/실행 (배포 모드)
최적화된 상태로 앱을 실행합니다.
```bash
npm run build
npm run serve
```
- 브라우저에서 **http://localhost:3000** 접속

---

## 🛠️ 자주 발생하는 문제 해결

### `sh: vite: command not found`
대부분 **의존성 설치 전** 상태입니다.

```bash
npm install
npm run dev
```

### `npm install` 했는데도 이상할 때
- `node_modules` 재설치:

```bash
rm -rf node_modules package-lock.json
npm install
```

- Node 버전이 너무 최신/실험 버전이면(예: v25 등) 일부 툴과 충돌할 수 있어요. 이 경우 **Node LTS(20/22)** 로 변경 후 다시 설치를 권장합니다.

---

## 🔥 Firebase 연결 (DB + Hosting)

이 프로젝트는 **Firebase**로 DB(Firestore)와 웹 Hosting을 사용할 수 있도록 설정되어 있습니다.

### 1) Firebase 콘솔에서 할 일
- [Firebase 콘솔](https://console.firebase.google.com/)에서 이미 만든 프로젝트 선택
- **빌드 > Firestore Database** 에서 DB 생성(테스트/프로덕션 규칙 설정)
- **호스팅**은 스크립트로 배포하면 자동 생성됨

### 2) 웹 앱 설정값 복사
- 프로젝트 설정(⚙️) → **일반** → **내 앱** → 웹 앱(</>) 선택 또는 추가
- **SDK 설정 및 스니펫** 에서 `firebaseConfig` 객체 값 확인

### 3) 로컬 환경 변수 설정
프로젝트 루트에 `.env` 파일을 만들고 아래 값을 채웁니다.

```bash
cp .env.example .env
```

`.env` 예시 (Firebase 콘솔에서 복사한 값으로 채우기):

```env
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=프로젝트ID.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=프로젝트ID
VITE_FIREBASE_STORAGE_BUCKET=프로젝트ID.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=숫자
VITE_FIREBASE_APP_ID=1:숫자:web:...
```

- `.env`는 Git에 올라가지 않습니다. (이미 `.gitignore`에 포함됨)
- **Vite**는 `VITE_` 로 시작하는 변수만 클라이언트에 노출합니다.

### 4) 코드에서 Firebase 사용하기
DB(Firestore)나 인증(Auth)을 쓰려면 아래처럼 import 하면 됩니다.

```js
import { db, auth } from './lib/firebase'
// Firestore: collection, doc, getDocs, setDoc, addDoc 등 사용
// Auth: signInWithEmailAndPassword, onAuthStateChanged 등 사용
```

### 5) Hosting 배포 (Firebase에 올리기)
최초 1회: Firebase CLI 로그인 및 프로젝트 연결

```bash
npx firebase login
npx firebase use --add
# 나오는 목록에서 사용할 프로젝트 선택 후 별칭(예: default) 입력
```

이후 배포:

```bash
npm run deploy
```

- `npm run build` 로 `dist`를 만든 뒤 **Firebase Hosting**에 배포됩니다.
- 배포된 URL은 Firebase 콘솔 **호스팅** 메뉴에서 확인할 수 있습니다.

---

## 📝 주요 기능

- 엑셀 파일 업로드/다운로드
- 진로/취업 컨설팅 데이터 관리
- 월별/이름별/단과대별 통계 분석
- 학생 유형별 필터링 (대학생/대학원생)
- 데이터 정렬 및 페이지네이션
- 차트 및 그래프 시각화

---

## 🔧 배포 방법

웹 애플리케이션이므로 어디서든 쉽게 배포할 수 있습니다.

1. **빌드**: `npm run build`
2. **배포**: 생성된 `dist` 폴더를 웹 서버에 업로드하거나, **Firebase Hosting** 사용 시 위 **Firebase 연결** 섹션의 `npm run deploy` 를 사용하세요.

---

## ⚙️ 기술 스택
- **React**: UI 라이브러리
- **Vite**: 초고속 빌드 도구
- **Firebase**: Firestore(DB), Hosting
- **XLSX**: 엑셀 데이터 처리
- **Lucide React**: 아이콘

---

Made with ❤️ for Ewha Womans University
