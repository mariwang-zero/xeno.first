# 매뉴얼 개정 관리 · 프론트엔드

Vue 3 + Vite. 화면 7개(홈, 매뉴얼 대시보드, 새 수정 요청, 이슈 상세, 개정 이력, 새 매뉴얼/AI 초안, 관리).

## 실행

```
npm install
npm run dev          # http://localhost:5173, /api 는 localhost:8000(FastAPI)으로 넘김
npm run build        # dist/  → FastAPI 서버가 정적 파일로 내보냄
npm run build:demo   # dist-demo/demo.html → 가짜 데이터로 도는 한 장짜리 데모
```

## 구조

- `src/api/index.js` 데모 빌드는 `mock.js`, 실제 빌드는 `http.js`를 씁니다. 두 파일은 함수 이름과 응답 모양이 같습니다.
- `src/api/mock.js` 백엔드가 지켜야 할 규칙(누가 어떤 상태로 바꿀 수 있는지)을 그대로 담은 가짜 서버입니다. 백엔드 구현 때 기준으로 씁니다.
- `src/api/seed.js` 데모용 예시 데이터. 사람 이름(부서 담당자)과 날짜는 예시입니다.
- `src/lib/status.js` 상태 이름, 절 상태 계산, 멈춘 이슈 판단.
- `src/pages/` 화면, `src/components/` 공통 부품.

공유 폴더(/mnt/project-files)는 심볼릭 링크를 만들 수 없어 `npm install`이 실패합니다. 다른 폴더에 복사해서 설치하세요.
