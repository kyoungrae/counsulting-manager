# 상담사 마스터 초기 등록

상담사 인적·계좌 정보는 Git/앱 파일이 아니라 MongoDB `consultants`에만 둡니다.  
로그인·승인된 사용자만 조회하고, **최초 등록은 관리자만** 할 수 있습니다.

## 가장 쉬운 방법 (운영 Mac / Docker 호스트)

젠킨스 배포가 끝난 뒤, 저장소 루트에서 **한 줄**:

```sh
npm run import:consultants
```

또는

```sh
bash scripts/easy-import-consultants.sh
```

성공 후 웹에서 새로고침 → **다시 시도**.

## 웹에서 등록 (관리자)

1. **관리자** 계정으로 로그인  
2. **지출처리** 메뉴  
3. “등록된 상담사 정보가 없습니다”가 보이면 **상담사 JSON 등록** 클릭  
4. 미리 만들어 둔 `consultants.json` 선택  

JSON 만드는 법(개발 PC):

```sh
mkdir -p "$HOME/secure-consultants"
git fetch origin cursor/receipt-table-margins-e75c
node scripts/extract-consultants.js "$HOME/secure-consultants/consultants.json"
```

만든 JSON은 Git에 올리지 마세요. 등록 후 삭제하는 것을 권장합니다.

## 참고

- 이미 DB에 상담사가 있으면 추가 등록은 거부됩니다.  
- 일반 사용자에게는 등록 버튼이 보이지 않습니다.
