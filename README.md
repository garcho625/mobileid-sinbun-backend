# 안심 이어가기 — 모바일신분증 비상 검증 모드

가상 발급기관·이용자 지갑·검증자 단말·준비 및 복구 API를 한 프로젝트에서 실행하는 공모전 PoC입니다. 실제 신분증이나 정부 서비스에 연결하지 않습니다.

## 내보내기 기준

- 원본 커밋: `7b2275136f491cfe341fce95da35a072beaa3e07`
- Work Sites로 생성된 **실제 소스코드 기반** React/TypeScript + Vinext + Cloudflare Workers + D1 프로젝트입니다.
- 별도 사본만 정리했습니다. 원본 Site, 배포 DB, 배포 소스 저장소는 변경하지 않았습니다.
- 화면 디자인·컴포넌트·서명 검증·API 처리 흐름은 유지했습니다. 내보내기용 변경은 `EXPORT_CHANGES.md`를 확인하세요.
- 배포 DB의 내용이나 발급 개인키를 내보내지 않습니다. 새 로컬 DB에서 새 테스트 키를 자동 생성합니다.

## Windows 10/11 + PowerShell 준비

**Windows 직접 실행 검증은 하지 못했습니다. Linux에서 동일 Node 기반 빌드·검사·로컬 Workers/D1 실행을 확인했습니다.** Windows 전용 네이티브 바이너리 설치 및 개발 서버 동작은 팀 PC에서 재확인해야 합니다.

1. Node.js 공식 사이트(nodejs.org)에서 **Node.js 24 LTS Windows Installer(.msi)**를 설치합니다. PATH 추가 옵션을 유지한 뒤 PowerShell을 새로 엽니다. 프로젝트의 원본 최소 조건은 Node 22.13이지만 테스트 실행 호환성을 위해 24 사용을 권장합니다.
2. ZIP을 `C:\dev\ansim-continue`처럼 짧은 경로에 풉니다. `package.json`이 있는 폴더에서 아래 명령을 실행합니다.

```powershell
cd C:\dev\ansim-continue
node --version
npm.cmd --version
npm.cmd install --global pnpm@11.25.0
pnpm.cmd --version
pnpm.cmd install --frozen-lockfile
```

PowerShell 실행 정책 오류를 피하도록 `.cmd` 명령을 사용합니다. 시스템 실행 정책을 바꿀 필요는 없습니다. 설치 시 npm 레지스트리 접근이 필요하며 Windows용 workerd 등 네이티브 의존성을 내려받습니다. pnpm의 의존성 빌드 허용 설정은 `pnpm-workspace.yaml`에 포함돼 있습니다. 설치가 차단되면 오류 원인을 재확인하고, 잠금 파일을 임의로 삭제하지 마세요.

## 처음 실행 — 계정 없이 로컬 개발

```powershell
pnpm.cmd test
pnpm.cmd typecheck
pnpm.cmd build
pnpm.cmd db:local
pnpm.cmd start
```

터미널이 출력하는 `http://127.0.0.1:8787` 주소를 엽니다. 다른 포트가 출력되면 그 주소를 사용합니다. 종료는 `Ctrl+C`입니다.

- `build`: 프런트엔드와 Worker를 `dist/`에 빌드합니다.
- `db:local`: 생성된 설정으로 로컬 D1 마이그레이션을 적용합니다. 적용 내역을 관리하므로 반복 실행할 수 있습니다. `--local`만 사용합니다.
- `start`: 로컬 workerd/Wrangler에서 빌드 결과와 D1을 실행합니다.
- Cloudflare 로그인, 유료 계정, API 토큰, 운영 DB 연결이 필요 없습니다.
- 환경변수 설정도 필요 없습니다. `.dev.vars.example`은 설명만 있는 빈 템플릿입니다.
- localhost와 127.0.0.1에서는 Web Crypto를 사용할 수 있습니다. 다른 PC에서 평문 HTTP로 접속하면 암호화 기능이 차단될 수 있습니다. 두 기기 시연은 현재 범위 밖입니다.

## 코드를 수정하면서 실행

초기 빌드와 `db:local`을 한 번 실행한 뒤:

```powershell
pnpm.cmd dev
```

터미널에 출력되는 localhost 주소(기본 5173)를 엽니다. `start`와 `dev`의 로컬 D1은 `.wrangler/state`에 저장됩니다. 종료 후에도 DB는 남고 브라우저의 신분증·요청·미동기화 기록은 새로고침하면 사라집니다.

빌드 결과를 확인하려면 `dev`를 종료한 뒤 `pnpm.cmd build`, `pnpm.cmd start`를 실행합니다. DB 스키마를 수정했다면 먼저 `pnpm.cmd db:generate`, `pnpm.cmd build`, `pnpm.cmd db:local` 순으로 진행합니다. 기존 마이그레이션을 수정하지 말고 추가하세요.

## 주요 폴더

| 경로 | 역할 |
|---|---|
| `app/` | React 화면, CSS, API 라우트 |
| `lib/proof.ts` | ECDSA 키·서명·검증 |
| `worker/` | Cloudflare Worker 진입점 |
| `db/`, `drizzle/` | D1 스키마·SQL·Drizzle 메타데이터 |
| `tests/` | 기존 서명 검증 테스트 9개 |
| `scripts/` | 빌드·로컬 실행·D1 도구 |
| `components/`, `hooks/`, `vendor/` | 기존 UI 템플릿·라이선스 자산 |
| `examples/` | 원본에서 제공한 참고 예제. 현재 서비스 경로가 아님 |

`package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`을 함께 관리합니다. Python 백엔드는 없으므로 `requirements.txt`는 필요 없습니다. 사용하지 않는 템플릿 의존성도 동작 보존을 위해 이번 내보내기에서 대규모 제거하지 않았습니다.

## 팀 공동 개발

GitHub 저장소는 아직 만들거나 업로드하지 않았습니다. ZIP을 푼 뒤 이 폴더 내용 전체(숨김 설정 포함)를 저장소 루트로 사용하세요. 개인별 로컬 DB는 서로 공유되지 않습니다. 코드를 공유해도 테스트 키·접수 이력은 각 PC에서 별도로 생성됩니다.

4명은 화면·API/DB·검증 로직·테스트/문서로 작업을 나눌 수 있습니다. 작업 브랜치별로 변경하고 PR에서 테스트·타입 검사·빌드를 확인하세요. `.git`, `node_modules`, `dist`, `.wrangler`, `.sites-runtime`, 실제 환경변수·키·DB는 올리지 않습니다. 제공한 `FILES.txt`가 ZIP 내부 파일 목록입니다.

이 사본은 원본 Site의 프로젝트 ID를 제거해 연결을 끊었습니다. Cloudflare나 Sites에 다시 배포하려면 별도 배포 설정과 접근 제어가 필요합니다. GitHub 업로드만으로 웹서비스가 배포되는 것은 아닙니다.

## 관련 문서

- `ARCHITECTURE.md`: 데이터 흐름과 DB
- `API.md`: API 계약
- `DEMO_GUIDE.md`: 시연 순서
- `LIMITATIONS.md`: 실제 구현·모의 기능·한계
- `VALIDATION.md`: 검증 결과와 미검증 항목
- `EXPORT_CHANGES.md`: 원본과 내보내기 사본의 차이
- `SECURITY_SCAN.md`: 포함·제외 및 민감정보 검사
