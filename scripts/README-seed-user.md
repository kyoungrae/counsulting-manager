# MongoDB 로그인 사용자 추가

웹 화면에서 직접 가입하지 않고 서버 관리 명령으로 사용자를 추가합니다. 비밀번호는 서버에서 scrypt 해시로 저장하며, 기존 Firebase 서비스 계정 키는 필요하지 않습니다.

## Docker

```bash
cp deploy/bootstrap.env.example .env.bootstrap.local
```

Git에서 제외되는 `.env.bootstrap.local`을 열고 다음 값을 입력합니다.

```env
BOOTSTRAP_USER_ID=관리자-아이디
BOOTSTRAP_PASSWORD=직접-정한-12자-이상-비밀번호
BOOTSTRAP_NAME=관리자
BOOTSTRAP_EMAIL=admin@example.com
BOOTSTRAP_ROLE=admin
```

```bash
docker compose --profile tools run --rm manage
```

도구 전용 컨테이너가 MongoDB의 앱 계정으로 사용자를 추가한 뒤 종료됩니다. 웹 앱 컨테이너에 초기 비밀번호를 넣거나 명령 인수로 비밀번호를 노출할 필요가 없습니다. 생성 후 관리용 파일에서 비밀번호를 비워도 계정은 DB에 유지됩니다.

다른 아이디를 추가하려면 파일 값을 바꾸고 명령을 다시 실행합니다. 기존 아이디의 비밀번호나 권한을 우발적으로 덮어쓰는 용도로 사용하지 않습니다. 일반 계정의 역할은 `user`로 설정합니다.

## 호스트 Node API

MongoDB 연결 정보는 `.env`에 설정합니다. 초기 계정 파일도 로드해서 명령을 실행합니다.

```bash
node --env-file=.env --env-file=.env.bootstrap.local scripts/seed-user.js
```

이름이나 이메일은 선택 사항입니다. 관리자 아이디와 비밀번호는 기본값 없이 직접 지정해야 하며 비밀번호는 12자 이상이어야 합니다.

기존 사용자 여러 명을 이전할 때는 [프로젝트 README의 이전 절차](../README.md#기존-firestore-사용자-이전)에 따라 `scripts/import-users.js`를 사용합니다. Firebase Auth에만 있는 비밀번호는 새로 발급합니다.
