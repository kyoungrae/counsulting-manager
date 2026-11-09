# 상담사 마스터 초기 이전

영수증의 인적·계좌 정보는 앱 코드와 Git이 아닌 MongoDB `consultants` 컬렉션에 둡니다. 최초 이전은 운영자가 DB에 접근할 수 있는 환경에서 한 번 실행합니다. 이후 로그인한 승인 사용자만 영수증 생성에 필요한 정보를 조회할 수 있습니다.

1. PR #5의 원본 Git 개체가 없는 환경이라면 해당 브랜치를 가져옵니다.

   ```sh
   git fetch origin cursor/receipt-table-margins-e75c
   ```

2. 저장소 **밖**의 본인만 읽을 수 있는 디렉터리에 중간 JSON을 생성합니다. 이 스크립트는 검토된 특정 Git 개체만 사용하며 기존 파일을 덮어쓰지 않습니다.

   ```sh
   node scripts/extract-consultants.js /안전한-절대경로/consultants.json
   ```

3. 해당 환경에 올바른 `MONGODB_URI`와 필요하면 `MONGODB_DB`를 설정하고, 대상 DB를 재확인한 다음 실행합니다. `.env`에 설정했다면 아래 명령이 읽습니다.

   ```sh
   node --env-file-if-exists=.env scripts/import-consultants.js /안전한-절대경로/consultants.json
   ```

   **Jenkins/Docker 운영 환경:** 운영 MongoDB는 호스트에 포트가 공개되지 않으므로 위 호스트 명령만으로는 접속할 수 없습니다. 새 버전 API가 배포된 후 Docker 호스트에서 실행 중인 `consulting-manager` 프로젝트의 `app` 컨테이너에 표준 입력으로 파일을 전달하면, 컨테이너가 기존 DB 연결 환경을 사용합니다. `/안전한-절대경로/consultants.json`은 위 단계에서 생성한 파일 경로로 바꾸세요.

   ```sh
   consulting_app_container=$(docker ps -q --filter label=com.docker.compose.project=consulting-manager --filter label=com.docker.compose.service=app)
   docker exec -i "$consulting_app_container" node scripts/import-consultants.js - < /안전한-절대경로/consultants.json
   ```

   Docker 앱 컨테이너가 하나이고 예상한 운영 환경인지 먼저 확인하세요. 파일은 컨테이너 이미지에 포함하거나 컨테이너 파일로 복사하지 않습니다. 초기 가져오기는 컬렉션에 데이터가 하나라도 있으면 중단하며 기존 레코드를 수정하거나 삭제하지 않습니다. 입력은 JSON 배열 또는 `{"consultants": [...]}` 형식입니다. 스크립트는 완료 인원만 출력합니다. 데이터가 이미 있는 경우 임의로 지우지 말고 기존 데이터와 대조해 별도 이전 계획을 세우세요.

4. 정상 이전과 영수증을 확인한 뒤 중간 JSON을 안전하게 관리하거나 삭제합니다. 원본 문서와 JSON을 Git에 추가하거나 채팅에 붙여 넣지 마세요. 이전 PR 브랜치에는 기존 정보가 여전히 남아 있습니다.
