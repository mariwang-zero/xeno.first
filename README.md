# 매뉴얼 개정 관리

제품 매뉴얼의 초안 작성, 수정 요청, 수정, 개정(Rev.) 확정을 한곳에서 관리하는 사내 도구입니다.

- 데모: https://mariwang.co.kr (예시 데이터로 동작, 입력한 내용은 각자 브라우저에만 저장)
- `frontend/` Vue 3 화면. 자세한 내용은 [frontend/README.md](frontend/README.md)
- `server/` 사내 PC용 앱 서버 (NAS 계정 로그인, NAS 공유 폴더에 매뉴얼 파일 저장)

## 제품과 매뉴얼 폴더

- 제품군: 루페(Looks), 라이트(L2S14C, L2S15, L2SW, L2SWE, L2SX5, L2SX6, XD Light, XD Light4), 카메라(LooksCAM LT, LooksCAM2)
- 제품마다 `매뉴얼 폴더/<제품명>/최종본·검토본·참고자료` 폴더를 둡니다. 규칙은 `frontend/src/lib/folders.js` 한 곳에 있습니다.
- 관리 > 제품에서 제품을 추가하면 폴더가 생깁니다. 대분류도 추가할 수 있습니다.
- 폴더에 직접 만든 제품 폴더는 "폴더 다시 읽기"로 제품 목록에 '미분류'로 들어옵니다.
- 데모에서는 관리 > 제품의 "폴더 연결"로 PC나 NAS 공유 폴더를 골라 실제로 읽고 쓸 수 있습니다 (PC의 크롬·엣지).
