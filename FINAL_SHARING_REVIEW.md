# 최종 GitHub 공유 준비 점검 — 2026-10-27

공유 대상: garcho625/mobileid-sinbun-backend, **codex/fix-audit-p1**. 기반은 기존 개선 브랜치의 7770e7dc5a7404f144f456f7f21dcc77f7ae946d이다. 이번 변경은 검토 후 이 P1 브랜치에만 로컬 Commit하며 main 및 codex/review-and-improve는 이동하거나 병합하지 않는다.

## main의 259,458개 파일 분류 및 보존

main의 추적 파일 미커밋 수정/스테이징은 없었다. 대량 변경 목록은 아래의 **미추적 생성 파일**이었다.

| 경로 | 파일 수 | 분류 |
|---|---:|---|
| node_modules | 214,423 | 설치된 의존성 및 내부 빌드/최적화 캐시 |
| .sites-runtime | 44,945 | pnpm store·런타임 자료·예전 실행 검사 사본 |
| .wrangler | 10 | 로컬 Workers/D1 상태, DB 및 테스트 기관 키가 포함될 수 있음 |
| dist | 78 | 빌드 결과 |
| .next | 1 | 자동 생성 프레임워크 자료 |
| next-env.d.ts | 1 | 자동 생성 타입 참조 |
| 합계 | **259,458** | Commit 제외 |

실제 파일을 삭제·Discard·Reset하지 않았다. 제외 처리 후 기존 목록 **259,458개 모두가 디스크에 남아 있음을 경로별로 확인**했다. 원본 main의 소스/DB를 옮기거나 덮어쓰지 않았다.

main에 .gitignore가 없어 GitHub Desktop이 생성 파일을 전부 표시했다. 브랜치 파일을 바꾸지 않고 로컬 메타데이터인 `.git/info/exclude`에 생성 폴더 7개 규칙(node_modules/.sites-runtime/.wrangler/.next/.vinext/dist/next-env.d.ts)을 추가했다. 원래 제외 목록은 저장소 밖 감사 폴더에 백업했다. 이 설정은 이 PC의 연결된 worktree에만 영향을 주며 Commit 대상이 아니다. main의 변경 목록은 이제 비어 있지만 파일은 보존된다.

## 소스 누락 비교

- P1 브랜치는 기준 7770e7d의 전체 이력을 포함한다. 최초 독립 실행 개선, 기록 보존/동기화, 서명 검사 보완 및 이번 P1 수정이 함께 있다.
- main의 생성 폴더 밖 **126개 파일**을 P1 worktree와 비교했다. P1에 없는 파일은 **0개**였다.
- main 자체에는 추적 소스의 미커밋 수정이 없었다. 따라서 다른 곳에서 작성한 중요 미커밋 소스를 누락한 흔적은 없었다.
- .sites-runtime/clean-checkout의 **138개 파일**을 7770e7d Git blob과 비교했다. 실행 소스는 모두 같았다. 차이는 README/LOCAL_DEMO_RESULT/VALIDATION의 예전 문서뿐이고 GITHUB_SHARING_REVIEW는 예전 사본에 없었다. 현재 문서가 후속 진단 및 공유 준비를 포함한다.
- 과거 .sites-runtime 사본이나 node_modules 안에 있는 제3자 코드 파일은 실제 프로젝트 신규 소스로 가져오지 않는다. 원래 위치에 보존한다.

## 최종 검증

P1 worktree에서 Commit 전 다시 실행했다.

| 검사 | 결과 |
|---|---|
| 기존 proof/clock 검사 13개 | 통과 |
| 새 DB 제약 검사 4개 | 통과 |
| TypeScript typecheck / ESLint | 통과 |
| Windows build | 통과, 기존 Vinext import 경고 남음 |
| 실제 로컬 Workers/D1 통합 | 통과, P1 중복·충돌·정지·멱등성·동시 충돌 6회 포함 |
| Chrome 빌드 서버 시연 | 통과, pageerror 없음 |
| Chrome offline 검증 | API 호출 0, 실제 서명 검증 및 재사용 차단 |
| 복구·정지 판정·D1 조회 | 통과 |
| 새로고침 대기 기록·새 Chrome 세션 복원 | 통과 |
| Windows Vite 가짜 파일 직접/ADS/인코딩 우회 | 차단 재확인 |

8.3 별칭은 이 PC에 생성되지 않아 실증 미검증이다. 물리적 인터넷 단절과 팀원별 다른 PC는 미검증이다. P1 원인/수정/새 마이그레이션은 [P1_FIX_RESULT.md](P1_FIX_RESULT.md), 남은 취약점 76건의 사용 경로 분류는 [DEPENDENCY_REVIEW.md](DEPENDENCY_REVIEW.md)를 참조한다. 모든 보안 항목이 해결된 상용 서비스라는 뜻은 아니다.

## Commit 범위 및 비밀정보 제외

P1 변경 파일과 이 공유 보고서만 파일명을 명시해 stage한다. .gitignore가 로컬 DB·기관 키·환경변수·node_modules·빌드·검사 산출물을 제외하며, stage 후 실제 경로/내용과 최종 Commit 트리를 재검사한다. .git/info/exclude, 원본 main의 생성 파일, 테스트 DB/키, 검사 JSON/스크린샷은 Commit에 포함하지 않는다. 최종 Commit ID와 포함 파일 수는 작업 완료 보고에 제시한다.

## 자동 배포 위험과 Push 판정

- GitHub의 기존 원격 main은 d6e4ee0…, 기존 개선 브랜치는 7770e7d…이며 원격 P1 브랜치는 검사 시 아직 없었다.
- P1 소스에 .github 배포 workflow가 없고, GitHub Actions runs 조회는 0건이었다.
- 활성 로컬 Git hook이 없고 core.hooksPath는 미설정이었다. 기본 실행 경로는 local 설정과 --local, placeholder D1, loopback 주소다.
- GitHub 연결 도구는 Webhooks endpoint를 거절했다. 추가로 Git Credential Manager의 저장 인증을 이용한 읽기 전용 API 조회를 시도했으나 비대화형 인증이 불가능해 실패했다. 토큰/비밀번호는 출력하거나 저장하지 않았다.
- 따라서 Webhook/GitHub App/외부 서비스의 브랜치별 자동 배포 연결은 **미확인**이다. Actions가 없다는 사실만으로 Work 자동 배포 위험이 없다고 단정하지 않는다. Work 사이트와 운영 Cloudflare에는 접근하지 않았다.

**로컬 Commit까지 진행하고, 자동 배포 안전성 확인 전에는 Push를 보류한다.** 새 브랜치가 Work 자동 배포 대상이 아니라는 확인 결과가 확보되면 해당 브랜치 하나만 명시적으로 Push할 수 있다. main과 기존 개선 브랜치에 Push/병합하지 않는다.

## 팀원 실행

원격 P1 브랜치 Push가 확인된 뒤 README의 브랜치 지정 Clone 명령을 사용한다. 현재 이 PC에서 수정본을 확인하려면 `C:\Users\USER\Documents\GitHub\mobileid-sinbun-p1-fix`에서 실행한다.

```powershell
pnpm.cmd install --frozen-lockfile
pnpm.cmd db:local
pnpm.cmd test
pnpm.cmd typecheck
pnpm.cmd lint
pnpm.cmd build
pnpm.cmd start
```

접속: http://127.0.0.1:8787/ . 기존 DB에도 db:local을 다시 실행해야 새 귀속 보호 트리거가 적용된다. 각 팀원의 DB/기관 테스트 키는 독립적이며 공유하지 않는다.
