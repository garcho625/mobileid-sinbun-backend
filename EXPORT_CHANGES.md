# 내보내기 변경 기록

기준: `7b2275136f491cfe341fce95da35a072beaa3e07`의 git archive. 원본 폴더 및 배포는 수정하지 않았습니다.

| 파일 | 변경 |
|---|---|
| `app/api/demo/route.ts` | req.json() 반환값에 기존 코드 스타일과 같은 any 타입 선언 추가. unknown 타입 오류만 해결 |
| `app/page.tsx` | API JSON 응답값에 any 타입 선언 추가. 화면·동작·CSS 변경 없음 |
| `package.json` | 프로젝트 이름, Bash 없는 install:ci, test/typecheck/db:local 스크립트 추가 |
| `.openai/hosting.json` | 원본 Site project_id 제거. DB 바인딩 이름은 유지 |
| `.gitignore` | 실제 환경/키/DB/아카이브 제외, 빈 예제 파일만 예외 허용 |
| `scripts/local-d1.mjs` | 빌드 설정으로 로컬 전용 마이그레이션 명령 생성. Node spawn 사용, --remote 없음 |
| `.dev.vars.example` | 실제 값 없는 안내 템플릿 |
| README 및 추가 문서 | Windows 안내·구조·API·시연·한계·검사 결과 |

서명 알고리즘, 검증 규칙, API 동작, DB 스키마/SQL, 테스트, UI 디자인, 의존성 버전과 잠금 파일은 유지했습니다. .git 이력, 생성 DB, 런타임 키, 캐시, 의존성 설치 결과는 포함하지 않습니다. 현재 API 동작상 한계는 기능을 바꾸지 않고 문서에 명시했습니다.
