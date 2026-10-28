# 로컬 독립 실행 구축 결과

> 아래는 기반 P1 버전의 범위/구축 기록입니다. 2026-10-28 기능 브랜치는 IndexedDB CryptoKey 저장·Service Worker 재실행·두 기기 QR을 추가했습니다. 최신 동작/지원 제한은 OFFLINE_QR_GUIDE.md와 OFFLINE_QR_RESULT.md를 기준으로 보세요.


> 아래는 최초 구축 당시 기록입니다. 기본 버전 7770e7d는 이후 GitHub의 codex/review-and-improve에 올라갔습니다. 아래의 Commit/Push 미수행·원격 미반영 설명은 당시 상태입니다. P1 수정 범위와 검증은 P1_FIX_RESULT.md, 최종 공유 준비와 Commit/Push 판단은 FINAL_SHARING_REVIEW.md 및 작업 완료 보고를 참조하세요.

기존 UI·CSS·P-256 방식·Workers 진입점·D1 테이블/마이그레이션을 재사용해 Windows 개발/시연 환경을 구축했습니다. 현재 브랜치는 codex/review-and-improve이며 main 원본은 보존했습니다. GitHub origin도 변경하지 않았습니다. Commit/Push는 하지 않았습니다.

## 추가/수정 파일

| 구분 | 파일 | 내용 |
|---|---|---|
| 추가 | .gitignore | DB·키·환경파일·설치/빌드/검사 산출물 제외 |
| 추가 | .openai/hosting.json | project_id 없는 최소 호환 설정. 로컬 실행은 읽지 않음 |
| 추가 | .dev.vars.example | 비밀값 없는 안내. 실제 환경변수 불필요 |
| 추가 | wrangler.local.json, vite.local.config.ts | Sites와 독립된 로컬 바인딩·실행 설정 |
| 추가 | scripts/run-local.mjs | dev/build/start의 로컬 실행 및 자격증명 환경변수 제거 |
| 추가 | scripts/local-db.mjs | 빌드 없이 로컬 D1 생성/마이그레이션·조회 |
| 추가 | tests/local-api.mjs | 실제 로컬 HTTP/Workers/D1 검사 |
| 추가 | tests/local-browser.mjs | Chrome UI·오프라인·복구·기록 보존 검사 |
| 추가 | tests/clock.mjs | 로컬 시각 차이 및 만료/준비 경계 검사 |
| 수정 | package.json | 기본 로컬 명령·DB 조회·추가 검사 연결. 의존성 버전 변경 없음 |
| 수정 | app/api/demo/route.ts | 입력 검사, 기록 조회, 서버 복구 판정 저장/갱신, 실제 저장 응답, 요청 스트림 처리 순서 보완 |
| 수정 | app/page.tsx | 기존 화면 유지, 기록 보존·복원, 배치 동기화, 재발급 시 기록 유지, timeout·타입 보완 |
| 수정 | lib/proof.ts | any 제거, 잘못된 입력/빈 nonce 방어, 최대 2초 미래 시각 오차 허용 |
| 수정 | README.md, API.md, ARCHITECTURE.md, DEMO_GUIDE.md, LIMITATIONS.md, VALIDATION.md | 실제 Windows 실행·API·구현 상태와 일치하도록 갱신 |
| 문서 | REVIEW_REPORT_2026-10-27.md, LOCAL_DEMO_RESULT.md, SECURITY_SCAN.md, EXPORT_CHANGES.md, FILES.txt | 초기 검토와 현재 상태 구분, 최종 보고 및 파일 목록 안내 |

기존 CSS, 화면 배치, tests/proof.mjs의 기존 9개 시나리오, worker/index.ts, DB 스키마와 마이그레이션, vite.config.ts와 기존 Work 실행 도구, pnpm-lock.yaml은 변경하지 않았습니다.

## 실행 명령과 접속 주소

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd db:local
pnpm.cmd test
pnpm.cmd typecheck
pnpm.cmd lint
pnpm.cmd build
pnpm.cmd start
```

빌드 시연: http://127.0.0.1:8787/ . 개발: pnpm.cmd dev → http://127.0.0.1:5173/ . 두 명령 모두 화면과 API를 함께 실행합니다. 로컬 기록 조회: pnpm.cmd db:inspect . 계정·토큰·운영 환경변수는 필요 없습니다.

## 검증 결과

기존 테스트 9개와 시각 경계 4개, 타입 검사, Lint, Windows 빌드가 통과했습니다. 개발/빌드 서버의 실제 API와 Chrome 시연 검사를 통과했습니다. 발급·준비·네트워크 모의 차단·브라우저 오프라인 서명·재사용 차단·복구·정지 불일치·D1 저장/조회·새로고침 보존·새 브라우저 조회를 확인했습니다.

의존성·DB 없는 새 소스 사본에서도 설치·새 D1·빌드·API·화면 검사를 통과했습니다. 상세 실패 원인과 재검사 범위는 VALIDATION.md에 있습니다.

실제 서명·검증·DB 저장은 구현됐지만 기관/방문자/동의/연결 스위치는 모의입니다. 실제 신분증, 생체인증, 두 단말 전송, 오프라인 재기동, 운영 권한·키 보호·신뢰 시각·서명된 감사 기록은 미구현입니다. 기기 키는 메모리에만 있어 새로고침 후 재발급해야 합니다.

## 원본 분리와 GitHub 공유 준비

Work 사이트, 운영 Workers/D1을 조회하거나 변경하지 않았습니다. 원격 배포/DB 명령도 실행하지 않았습니다. 로컬 설정은 project_id나 원격 DB UUID 없이 placeholder만 사용합니다. 저장소에서 GitHub 배포 워크플로/활성 hook은 발견되지 않았으나 GitHub 서버 측 외부 자동 배포 연동은 미확인입니다. Push하지 않아 그 연동을 실행하지도 않았습니다.

소스와 문서는 GitHub 공유 전 검토할 상태로 준비됐습니다. 아직 변경이 GitHub에 올라가지 않았으므로 팀원이 현재 main을 Clone해도 이 수정은 받지 못합니다. 별도 지시 후 공유 브랜치에 Commit/Push해야 합니다. 실제 DB/키/환경파일/스크린샷/캐시가 공유 대상에서 제외되는지도 확인했습니다.

## 남은 오류와 우선순위

1. 공유 후 팀원 PC별 설치·브라우저 실행 확인, GitHub 서버 측 자동 배포 연동 확인. 실제 회선 단절 및 제출 시연 순서 리허설.
2. 프레임워크 import/최적화 경고의 후속 점검. 오류 응답 후 Wrangler가 종료되던 문제는 요청 본문 처리 순서를 보완해 해결하고 회귀 검사함. 빌드 결과를 바꿀 때는 서버 종료 → build → start 순서를 사용.
3. 여러 탭 동시 대기열 조정, 기록 500건 초과 UI 페이지 처리, 원래 접수 시각·상태 조회 시각 및 별도 복구 감사 이력.
4. 인터넷 공개를 계획하는 경우 인증/권한·키 저장/회전·서버 검증 가능한 접수 증거·신뢰 시간을 우선 설계. 현재는 localhost 데모 범위.

검증용 서버는 작업 종료 시 정리합니다. 데이터는 각 checkout의 무시 폴더에 남겨 재실행 시 확인할 수 있습니다. 검증용 가상 데이터 외 실제 개인정보·운영 키를 사용하지 않았습니다.
