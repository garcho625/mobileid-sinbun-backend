# 안심 이어가기 — Windows 로컬 독립 시연

> 2026-10-28 새 기능: **codex/offline-qr-upgrade**(기준 7579cb3)의 로컬 worktree에서 오프라인 재실행·두 기기 QR을 구현했습니다. Commit/Push하지 않았으므로 원격 Clone에는 아직 없습니다. [최초 준비·HTTPS·QR 시연 가이드](OFFLINE_QR_GUIDE.md), [이번 검증 결과](OFFLINE_QR_RESULT.md)를 먼저 확인하세요. 아래 공유 기록은 기반 P1 버전의 이력입니다.

가상 발급기관·이용자 지갑·검증자·복구 기록을 같은 브라우저에서 시연하는 공모전 PoC입니다. 기존 React/TypeScript 화면, ECDSA P-256 전자서명, Cloudflare Workers API와 D1 스키마를 재사용합니다. 실제 신분증·정부 서비스·기존 Work 사이트와 연결하지 않습니다.

## 준비 프로그램

- Windows 10/11, PowerShell. 이번 직접 검증은 Windows PowerShell 5.1에서 수행했습니다.
- Git for Windows 또는 GitHub Desktop. 터미널에서 `git --version`이 동작하도록 Git PATH를 설정하세요.
- Node.js 24 계열. 이번 검증 버전은 **24.19.0**입니다. 저장소의 최소 선언은 22.13이지만 팀은 24로 통일하세요.
- **pnpm 11.25.0**. `packageManager`에 고정된 버전을 사용합니다.
- 브라우저: 최신 Chrome 또는 Edge. 자동 화면 검사는 Chrome에서 수행했습니다.

Node 설치 후 PowerShell을 새로 열고 확인합니다. `.cmd` 명령을 사용하면 PowerShell 스크립트 실행 정책을 바꾸지 않아도 됩니다.

```powershell
git --version
node --version
npm.cmd --version
npm.cmd install --global pnpm@11.25.0
pnpm.cmd --version
```

## 처음 Clone하고 실행

GitHub의 기존 공유 브랜치 `codex/review-and-improve`에는 기본 버전 `7770e7dc5a7404f144f456f7f21dcc77f7ae946d`가 올라가 있습니다. **최종 P1 수정본의 공유 대상은 `codex/fix-audit-p1`**입니다. 기존 개선 브랜치에는 이번 수정을 합치지 않습니다. 최종 파일 비교·Commit/Push 판단은 [FINAL_SHARING_REVIEW.md](FINAL_SHARING_REVIEW.md)와 작업 완료 보고를 확인하세요. 외부 자동 배포 연결이 확인되기 전에는 Push를 보류합니다.

기본 브랜치 main에는 실행 설정 누락이 있으므로 처음부터 최종 브랜치를 지정합니다. 기존 폴더가 main일 수 있으며, main에는 .gitignore도 없어 로컬 DB가 미추적 파일로 보일 수 있습니다. 기존 변경/DB를 보존하려면 아래처럼 **새 폴더에 Clone**하세요. 아래 명령은 P1 브랜치의 원격 Push가 확인된 뒤 사용합니다. 아직 원격에 없으면 Clone이 실패하므로 기존 개선 브랜치를 최종 수정본으로 오인하지 마세요. main에서 일괄 스테이징하거나 기존 폴더를 덮어쓰지 않습니다. [GITHUB_SHARING_REVIEW.md](GITHUB_SHARING_REVIEW.md)는 과거 Push 전 기록입니다.

```powershell
git clone --branch codex/fix-audit-p1 --single-branch https://github.com/garcho625/mobileid-sinbun-backend.git mobileid-sinbun-demo
cd mobileid-sinbun-demo
git branch --show-current
git rev-parse HEAD
pnpm.cmd install --frozen-lockfile
pnpm.cmd test
pnpm.cmd typecheck
pnpm.cmd lint
pnpm.cmd db:local
pnpm.cmd build
pnpm.cmd start
```

브라우저에서 **http://127.0.0.1:8788/** 에 접속합니다. `start` 하나가 화면과 API를 함께 제공합니다. 별도 Python 서버나 프런트엔드 서버를 추가 실행할 필요가 없습니다. 종료는 해당 터미널에서 `Ctrl+C`입니다.

처음 설치에는 npm 레지스트리 인터넷 연결이 필요합니다. Windows용 workerd/esbuild 등이 설치됩니다. 계정 로그인, Cloudflare API 토큰, 운영 DB ID는 필요 없습니다. `.dev.vars.example`은 값이 없는 안내 파일이며 복사하거나 값을 채울 필요가 없습니다.

`db:local`은 로컬 D1을 생성하고 기존 SQL 마이그레이션을 적용합니다. 빌드 전에 실행할 수 있고, 반복 실행해도 이미 적용한 마이그레이션은 다시 적용하지 않습니다. 각 PC의 `.wrangler/state`에 서로 다른 DB·기관 테스트 키·접수 기록이 생성됩니다. 팀원끼리 이 폴더를 공유하지 마세요.

P1 수정 버전을 받았을 때 기존 로컬 DB에도 `pnpm.cmd db:local`을 다시 실행해야 합니다. 새 마이그레이션은 기존 테이블/기록을 보존하고 접수 ID의 신분증 귀속 변경을 막는 DB 트리거를 추가합니다. 과거 잘못 저장된 복구 판정은 정상 기록 재동기화 시 현재 상태로 갱신됩니다.

## 코드를 수정하며 실행

의존성 설치와 `db:local`을 완료한 뒤:

```powershell
pnpm.cmd dev
```

개발 주소는 **http://127.0.0.1:5174/** 입니다. 프런트엔드와 Worker API가 함께 실행됩니다. 개발 서버와 빌드 서버는 같은 `.wrangler/state`의 D1을 사용하지만, 시연 때는 하나만 실행하는 것을 권장합니다.

코드를 바꾼 뒤 빌드 결과를 시연하려면 개발 서버를 종료하고 `pnpm.cmd build`, `pnpm.cmd start`를 다시 실행하세요. `start`는 소스 변경을 자동 반영하지 않습니다. 포트가 사용 중이면 기존 서버를 종료하세요. 개발 서버는 포트를 임의로 바꾸지 않도록 설정했습니다.

## 시연 순서

1. **가상 발급기관**에서 테스트 신분증 발급 → 검증자 신뢰키·정책 준비.
2. 상단 연결 스위치를 **연결 차단 중**으로 전환.
3. **검증자 단말**에서 새 요청 생성.
4. **이용자 지갑**에서 동의 → 기기 응답 생성.
5. **검증자 단말**에서 정상 조건으로 로컬 서명 검증. 성공 후 같은 응답으로 다시 검증하면 재사용이 차단됩니다.
6. 연결을 온라인으로 전환하고 **복구·기록**에서 상태 재확인·기록 동기화.
7. 필요하면 발급기관 정지 처리 후 다시 동기화하여 불일치 판정을 확인.
8. 새로고침 후 **복구·기록**에서 저장 기록을 확인.

공식 정책이 아닌 **15분 준비/1시간 만료 실험값**입니다. 로컬 프로세스의 시계 차이를 위해 미래 발급·준비 시각에만 최대 2초 오차를 허용하며, 만료와 15분 경과 제한은 유지합니다. 접수 성공은 출입 승인이 아닙니다. 동의는 버튼 시연이며 실제 생체인증이나 신분 확인이 아닙니다.

## 기록 보존과 로컬 DB 확인

- 기기 개인키는 비추출 CryptoKey로, 신분증·준비 정보·정책·요청·사용 기록은 IndexedDB에 저장합니다. 새로고침/재실행 후 복원하되 기존 만료/15분 정책을 유지합니다. 새 서명 동의는 다시 받습니다.
- 접수 기록의 권위 저장소는 IndexedDB이며 미동기화 기록도 복원합니다. localStorage는 기존 기록 이관/표시 호환만 유지하며 개인키·신분증은 넣지 않습니다.
- 서버에 동기화한 기록은 D1에 저장되며, 새 브라우저 세션에서도 조회합니다. 화면은 최근 서버 기록 최대 500건과 브라우저의 대기 기록을 합칩니다.
- 재발급해도 기존 접수 기록을 지우지 않습니다. 새로고침 후 신분증이 없어도 대기 기록 동기화는 가능합니다.
- 복구 시 각 기록의 신분증 상태를 서버에서 다시 조회하고, 서버가 판정한 결과를 저장·반환합니다. 기존 접수 ID의 판정도 갱신됩니다.
- 화면의 기록 시각은 대기 중에는 접수 시각, 서버 저장 후에는 최초 동기화 시각입니다. 원래 현장 시각의 영구 보존 기능은 없습니다.
- `127.0.0.1:5174`, `127.0.0.1:8788`, `localhost`는 서로 다른 브라우저 저장 공간입니다. 시연 중 주소를 통일하세요. 주소 간 이동 전 미동기화 기록을 서버에 저장하세요.

로컬 D1의 최근 100건을 직접 조회합니다. 이 명령은 개인키를 출력하지 않습니다.

```powershell
pnpm.cmd db:inspect
```

DB를 보존한 채 프로그램을 종료·재시작해도 기록은 남습니다. `.wrangler/state`를 삭제하면 키와 발급 이력도 사라집니다. 완전 재초기화가 필요할 때는 서버를 종료하고 이 폴더를 별도로 백업한 뒤 처리하세요. 초기화 후에는 브라우저의 해당 주소 사이트 데이터도 지워야 오래된 대기 기록과 충돌하지 않습니다. 일반 실행에 삭제/리셋은 필요 없습니다.

## 테스트

```powershell
pnpm.cmd test
pnpm.cmd typecheck
pnpm.cmd lint
pnpm.cmd build
```

별도 터미널에서 서버를 실행한 상태로 API 통합 검사를 실행합니다. 테스트용 발급·정지·접수 기록이 로컬 DB에 추가됩니다.

```powershell
pnpm.cmd test:integration
# 개발 서버 검사 시:
pnpm.cmd test:integration -- http://127.0.0.1:5174
```

P1 회귀 검사에는 동일 ID 중복의 고유 저장 건수, 재전송 멱등성, 다른 신분증 충돌 409, 정지 판정, 동시 충돌 및 배치 전체 취소가 포함됩니다. `pnpm.cmd test`는 기존 13개 검사와 SQLite 메모리 DB의 마이그레이션/귀속 제약 검사를 실행합니다.

Windows Vite 파일 접근 회귀 검사는 `pnpm.cmd dev`를 실행한 별도 터미널에서 아래 명령으로 수행합니다. 가짜 표식 `.key` 파일만 잠시 생성하고 정리하며 실제 개인키를 읽지 않습니다. ADS와 사용할 수 있는 8.3 별칭 접근 차단을 검사합니다.

```powershell
pnpm.cmd test:vite-security
```

선택 사항인 실제 Chrome 화면 검사는 별도 검사 도구를 무시 폴더에 설치합니다. 앱 실행에는 필요 없습니다. 프로젝트 package.json/잠금 파일을 변경하지 않습니다.

```powershell
npm.cmd install --prefix .sites-runtime/browser-tools --no-save --package-lock=false playwright@1.64.1
pnpm.cmd test:browser
# 개발 서버 검사 시:
pnpm.cmd test:browser -- http://127.0.0.1:5174
```

Chrome이 설치되어 있어야 합니다. 결과·화면 캡처는 `.sites-runtime/qa`에 생성됩니다. 자동 검사는 브라우저 네트워크를 오프라인으로 설정하며 물리적 인터넷 선을 끊는 시험은 아닙니다. 상세 근거는 [VALIDATION.md](VALIDATION.md)에 기록했습니다.

## 설정 분리와 원본 보호

| 파일 | 역할 |
|---|---|
| `vite.local.config.ts` | 기본 dev/build의 독립 실행 설정. Sites 인증/connector 플러그인 사용 안 함 |
| `wrangler.local.json` | 로컬 DB placeholder ID, remote:false, 원격 미리보기 비활성 |
| `scripts/run-local.mjs` | dev/build/start만 허용, 로컬 주소 고정, Cloudflare 자격증명 환경변수 제거 |
| `scripts/local-db.mjs` | 고정된 --local 마이그레이션·조회만 실행 |
| `vite.config.ts`, `scripts/run-framework.mjs` | 기존 Work용 구성 보존. 기본 실행 경로에서는 사용 안 함 |
| `.openai/hosting.json` | 기존 구성의 타입 검사 호환용 최소 DB 이름. project_id·운영 ID·토큰 없음. 로컬 실행은 이 파일을 읽지 않음 |

누락된 `.openai/hosting.json`은 내보내기 파일 목록에는 있으나 Clone의 Git 추적 파일에는 없었습니다. 숨김 파일 업로드 누락으로 추정하며 당시 업로드 작업 자체를 확인한 것은 아닙니다.

기존 Work 사이트·Workers·운영 D1은 조회하거나 변경하지 않았습니다. 기준 커밋에는 배포 GitHub Actions나 활성 Git hook이 없었습니다. GitHub 서버에 설정된 외부 자동 배포 연동은 미확인입니다. 기본 실행 버전은 이미 원격에 있지만 이번 P1 수정 작업에서는 Push하지 않습니다.

## 4명 공동 개발

공유 브랜치에서 각자 작업 브랜치를 만들고 화면·API/DB·서명 로직·테스트/문서로 역할을 나눌 수 있습니다. main 원본은 유지하며 통합할 브랜치는 팀에서 정하세요. PR 검토 전에 test/typecheck/lint/build를 확인하세요. DB 스키마 변경 시 새 마이그레이션을 추가하고 팀원 각자가 `pnpm.cmd db:local`을 실행합니다.

공유할 항목은 소스, 설정의 placeholder, 문서, 잠금 파일입니다. `.gitignore`가 node_modules, 빌드, 로컬 DB, 런타임 캐시, 실제 환경파일·키를 제외합니다. 실제 키·DB를 Git이나 메신저로 공유하지 않습니다. 커밋 전 `git status`와 `git diff --cached`로 포함 파일을 확인하세요.

## 흔한 실행 문제와 남은 범위

- `git`/`pnpm.cmd`를 찾지 못함: 설치와 PATH를 확인하고 PowerShell을 새로 여세요.
- 의존성 설치 연결 오류: npm 레지스트리 접근을 확인하세요. 잠금 파일 삭제나 보안 정책 해제 대신 오류 원인을 확인하세요.
- `no such table`: `pnpm.cmd db:local`을 먼저 실행하세요.
- `start` 빌드 설정 없음: `pnpm.cmd build` 후 실행하세요.
- `EPERM`/보안 제품 차단: 이번 Codex 샌드박스에서는 별도 실행 승인이 필요했습니다. 일반 PowerShell에서도 재현되면 보안 제품/실행 권한을 확인하세요. 관리자 실행을 기본 요건으로 두지 않습니다.
- 다른 기기에서 localhost는 그 기기 자신입니다. LAN QR 시연은 신뢰된 HTTPS와 PC 사설 IP가 필요하며 OFFLINE_QR_GUIDE.md를 따르세요. 물리 두 기기 카메라 시험은 미검증입니다.

연결 스위치는 모의 차단이며, 정지 버튼은 그 스위치를 우회해 실제 로컬 API를 호출합니다. build/start에서 화면 오프라인 준비와 온라인 발급/신뢰키 준비를 완료하면 서버 없이 새로고침·브라우저 재실행 및 QR 검증이 가능합니다. dev는 오프라인 화면을 지원하지 않습니다. 운영 인증·역할 분리·키 보관·신뢰 시각·서명된 감사 기록·동시 탭의 대기열 조정은 미구현입니다. 테스트용 localhost 시연 범위로 사용하세요.
