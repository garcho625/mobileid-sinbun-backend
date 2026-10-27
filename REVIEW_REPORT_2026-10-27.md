# 1~3단계 프로젝트 분석 및 로컬 검증 보고서

> 이 문서는 수정 전 상태의 검토 기록입니다. 이후 로컬 독립 실행을 구축했으며 현재 결과는 README.md, VALIDATION.md, LOCAL_DEMO_RESULT.md를 참조하세요.

검토일: 2026-10-27. 대상: GitHub에서 Clone한 현재 저장소. 기존 문서의 Linux 검증 결과를 이번 Windows 검증 결과로 간주하지 않았다.

## 판정

**현재 Clone 상태는 팀원에게 정상 실행 가능한 상태로 공유하기 어렵다.** 필수 숨김 설정 파일 누락 때문에 설치 후에도 타입 검사·빌드·개발 서버가 실패한다. 서명 단위 테스트 9개는 통과했으나 화면 및 Workers/D1 통합 동작은 미검증이다. PoC로 구현된 실제 암호화 기능과 운영용 신원 확인의 보안 수준은 구분해야 한다.

검토 중 애플리케이션 코드, UI, CSS, 의존성 버전, 잠금 파일을 수정하지 않았다. 검토 문서만 추가했다. Commit·Push·배포·운영 DB 접속은 수행하지 않았다.

## 1. Git 및 실행 환경

| 항목 | 확인 결과 |
|---|---|
| origin | https://github.com/garcho625/mobileid-sinbun-backend.git |
| 최초 브랜치 | main, 작업 트리 깨끗함 |
| 기준 커밋 | d6e4ee0fa1d22b0f68ad32a0025321e2a5fc098b |
| main / origin/main | 로컬 참조 기준 같은 커밋. fetch하지 않아 원격의 현재 상태까지 확인한 것은 아님 |
| 생성 및 전환 | codex/review-and-improve |
| main 보존 | 검토 후에도 기준 커밋과 동일 |
| PowerShell | Windows PowerShell 5.1.26100.8875, Desktop |
| Node.js / npm | v24.19.0 / 11.17.0 |
| Git | PATH에서 찾지 못함. GitHub Desktop 3.6.8 내장 git.exe 사용 |
| pnpm | PATH에 없음. npm exec로 프로젝트 지정 11.25.0 확보 후 캐시 내 pnpm.cjs 직접 실행 |
| 작업 지침 | 사용자·Documents·GitHub 상위 폴더 및 저장소에서 AGENTS.md를 찾지 못함 |

Git 명령에 사용한 실행 파일은 `C:\Users\USER\AppData\Local\GitHubDesktop\app-3.6.8\resources\app\git\cmd\git.exe`다. 다른 팀원 PC에서는 경로가 다를 수 있으므로 Git PATH 설정을 권장한다.

## 2. 폴더 및 연결 구조

현재 추적 소스/문서 파일은 126개다. 설치 산출물은 분석 대상에서 제외했다.

```text
app/                 화면(page.tsx), 레이아웃, CSS, POST /api/demo, 인증 템플릿
worker/              Vinext fetch-handler를 호출하는 Cloudflare Worker 진입점
lib/                 proof.ts(암호화), connector 템플릿, UI 유틸리티
db/                  Drizzle 스키마와 D1 바인딩 헬퍼
drizzle/             초기 SQL 및 마이그레이션 메타데이터
tests/               proof.mjs: 검증 함수 9개 시나리오
components/          UI 템플릿 및 connector 오류 표시
hooks/               반응형 UI 훅
scripts/             Windows/portable 및 managed-linux 실행·설치·로컬 D1 도구
examples/            현재 서비스 경로에 포함되지 않는 D1 예제
public/              favicon
vendor/              UI CSS 및 라이선스
루트 설정/문서        package.json, pnpm 잠금/정책, Vite/TS/ESLint 설정, 시연 문서
```

React 19 화면은 `app/page.tsx` 한 파일에서 발급기관·지갑·검증자·복구 탭을 전환한다. Next 형식의 소스를 Vinext/Vite로 빌드하며, 일반 Next 서버로 실행하는 프로젝트가 아니다.

온라인 흐름은 `page.tsx → fetch('/api/demo') → worker/index.ts → Vinext 라우터 → app/api/demo/route.ts → env.DB`다. API는 Drizzle 헬퍼를 사용하지 않고 D1 prepared statement를 직접 실행한다. `db/index.ts`의 getDb는 별도 헬퍼다. SQL 인자는 bind로 전달되며, 검토한 API에는 문자열 연결 SQL이 없다.

Vite는 `.openai/hosting.json`의 d1 이름으로 DB 바인딩을 만들고, 로컬 설정에 placeholder DB UUID를 사용한다. 그러나 해당 파일이 현재 저장소에 없다. 빌드 결과 `dist/server/wrangler.json`을 기반으로 `db:local`이 마이그레이션 설정을 만들며, 데이터는 `.wrangler/state`에 저장하도록 구성돼 있다. `db:local`과 `start`에는 `--local`이 명시돼 있다. 이번 검토에서는 실제 D1 DB 생성/마이그레이션까지 도달하지 못했다.

connector 관련 Worker/lib/scripts 및 `app/chatgpt-auth.ts`는 템플릿 잔재다. 현재 신분증 화면/API에서 외부 connector를 호출하거나 requireChatGPTUser로 인증을 강제하지 않는다. 로컬 모의 로그인은 API의 역할별 권한 검사가 아니다.

## 3. ECDSA 및 로컬 검증

`lib/proof.ts`는 Web Crypto로 P-256 키를 생성하고 ECDSA/SHA-256으로 `JSON.stringify(payload)`의 UTF-8 바이트를 서명한다. 서명은 Base64다. JWT/JWS 또는 공식 신분증 형식은 아니다.

1. 브라우저가 기기 키를 생성한다. 개인키/공개키를 추출 가능한 JWK로 내보내 React 메모리에 보관한다.
2. issue API가 가상 이름, UUID, 기기 공개키, 발급·만료 시각에 기관 개인키로 서명한다.
3. 기관 키는 최초 요청 시 생성되고 D1 settings의 issuer 행에 JSON으로 저장된다. prepare 응답은 공개키와 준비 시각만 반환한다.
4. 검증자가 UUID 요청값을 만들고, 이용자 응답은 요청값과 증명정보 ID를 기기 키로 서명한다.
5. check는 기관 서명, 기기 서명·요청값·ID·재사용 여부, 유효기간, 양측 준비 15분, visit 업무, 시험 시각 이상 여부를 검사한다.
6. 성공 시 호출자인 화면 코드가 seen에 요청값을 추가하고 접수 기록을 메모리에 저장한다. check 자체가 재사용 목록을 갱신하지는 않는다.

실제 암호학적 검증은 구현돼 있다. 반면 신뢰키 배포·키 수명주기·시간 신뢰·주체 확인·정책 배포·기록 보존은 운영 수준으로 구현되지 않았다. JSON 직렬화 방식에 의존하므로 다른 구현/단말과의 연동 시 정규화 규칙이나 표준 서명 형식이 필요하다.

## 4. 실제 기능과 모의 기능

| 구분 | 내용 |
|---|---|
| 실제 코드 및 단위 실행 확인 | P-256 생성/서명/검증, 요청값·ID 대조, 메모리 Set을 이용한 재사용 검사, 시각·업무 조건 검사 |
| 실제 코드 존재, 이번 통합 실행 미검증 | Worker 라우팅, D1 바인딩·마이그레이션, 발급/상태/정지 API, 접수 INSERT, 화면의 전체 흐름 |
| 격리 검사에서 실행 확인 | API 핸들러를 메모리 SQLite에 연결한 발급·서명·정지·sync 처리. Workers/D1 HTTP 검증은 아님 |
| 시연용 모의 | 가상 발급기관/방문자/시설, 동의 버튼, 역할 전환, 연결 차단 스위치, 시험 시각/불신 키 등 시나리오 |
| 미구현 | 정부/공식 앱 연동, 실제 소지자 확인, PIN/생체인증, 하드웨어 키 보호, QR/NFC/Bluetooth 및 두 기기 전송, 오프라인 재기동, 신뢰 시각, 운영 권한 분리 |

## 5. 실제 실행 결과

package.json의 실제 명령을 npm.cmd run으로 실행했다. pnpm으로 설치한 의존성을 사용하며 npm install로 잠금 파일을 바꾸지 않았다.

| 명령/검사 | 결과 | 근거 |
|---|---|---|
| pnpm 11.25.0 install --frozen-lockfile | 성공 | 639개 설치, Windows용 workerd/esbuild postinstall 완료. 잠금 파일 변경 없음 |
| npm.cmd test | 성공 | 정상·변조·불신 키·다른 요청값·재사용·만료·준비 경과·금지 업무·시험 시각 이상 9개 |
| npm.cmd run typecheck | 실패, exit 1 | vite.config.ts:3, TS2307: .openai/hosting.json 없음 |
| npm.cmd run build | 실패, exit 1 | Vite 설정의 .openai/hosting.json import 해석 실패 |
| npm.cmd run lint | 실패, exit 1 | 22 errors: any 19개, prefer-const 2개, 내부 링크 1개 |
| npm.cmd run dev | 실패, exit 1 | 동일한 hosting.json 누락. 서버 기동 안 됨 |
| npm.cmd run db:local | 실패, exit 1 | 빌드 산출물 없음: Run pnpm build before pnpm db:local |
| npm.cmd start | 실패, exit 1 | 샌드박스 EPERM 후 승인된 재실행에서 dist/server/wrangler.json ENOENT 확인 |
| workerd.exe --version | 성공 | workerd 2026-05-15. 버전 실행만 확인했으며 앱/D1 서비스 기동 증거는 아님 |
| 브라우저 클릭/E2E·화면 회귀 | 미검증 | 빌드·기동 차단 |
| 실제 인터넷 단절·오프라인 재로딩 | 미검증 | 화면 기동 차단. 서비스워커/영구 큐도 없음 |

설치 초기에 npm 캐시 제한 ENOTCACHED 및 pnpm 레지스트리 ECONNREFUSED가 발생했다. 샌드박스 밖 실행 승인 후 설치가 성공했다. 이는 프로젝트 자체 빌드 오류와 분리된다. Git/Node 자식 프로세스 검사 중 EPERM도 발생했으므로 Git은 PowerShell에서 직접 호출하고 파일 검사는 Node에서 자식 프로세스 없이 재실행했다.

초기 조회의 exit 1은 존재하지 않는 AGENTS.md를 Get-Item으로 조회한 경우와 rg가 해당 이름을 찾지 못한 경우였다. 파일 내용 읽기 실패가 아니다. PowerShell에서는 중간 명령이 실패해도 마지막 명령이 성공하면 전체 exit 0이 될 수 있어 출력의 오류도 함께 확인했다. 한국어 문서 최초 출력의 깨짐은 기본 읽기 인코딩 때문이며 UTF-8 지정으로 정상 재조회했다.

## 6. 중요도별 문제와 해결 제안

P0는 팀 로컬 실행 차단, P1은 데이터 손실/판정 오류 또는 외부 공개 전 필수 보안 조치, P2는 견고성·시연·유지보수 개선이다. 보안 P1을 현재 로컬 PoC에서 실제 외부 침해가 발생했다는 뜻으로 해석하면 안 된다.

| ID / 중요도 | 문제 및 근거 | 해결 제안 |
|---|---|---|
| R01 / P0 | .openai/hosting.json 누락. vite.config.ts:3에서 필수 import. 타입 검사·빌드·dev 모두 실제 실패 | 원본 배포 ID/자격증명을 제외한 로컬 DB 바인딩 설정 복원. 이후 모든 실행 검사 재수행 |
| R02 / P1 | .gitignore 누락. 설치 후 node_modules/와 .sites-runtime/가 Git 미추적 파일로 노출됨. 향후 .wrangler DB 및 키를 실수로 추가할 위험 | 설정/DB/키/캐시/빌드 산출물 제외 규칙을 먼저 복원하고 실제 환경파일 예외를 최소화. 이번 검토는 stage하지 않음 |
| R03 / P1 | route.ts에 인증/권한 검사 없음. 인증정보 없는 격리 요청으로 stop이 stopped를 반환. issue·status·sync도 같은 구조 | 기관·검증자 권한 분리, API 인증/인가. 로컬 시연 범위 유지 시 외부 공개 제한 및 데모 전용 경계 명시 |
| R04 / P1 | sync는 서명 검증 없이 임의 결과·임의 credential을 저장. 격리 SQLite에 임의 성공 문자열 저장 재현 | 서버가 검증 가능한 접수 증거·주체/요청 식별자를 확인하고 결과를 판정. 단순 클라이언트 로그와 감사 기록을 구분 |
| R05 / P1 | page.tsx recover가 기존 log를 sync한 뒤 화면만 복구 판정으로 변경. 서버에는 첫 복구 시 이전 문구가 저장됨. INSERT OR IGNORE라 재복구로 기존 결과 갱신도 안 됨 | 접수 사실과 복구 판정을 분리 저장하거나 명시적 갱신 API/이력 추가. 판정·checkedAt·서버 확인 결과를 영구 저장하고 응답으로 화면 갱신 |
| R06 / P1 | 로그·키·trust·seen 모두 useState 메모리. 새로고침/브랜드 홈 링크 이동 시 소실. issue도 L([])로 미동기화 기록 삭제 | 미동기화 건 존재 시 재발급/이동 경고, 보존 정책을 정한 durable queue. 키 저장은 기록 보존과 별도 보안 설계 |
| R07 / P1 | sync는 100건만 처리하면서 화면은 전체 동기화 성공처럼 표시. saved는 실제 삽입 수가 아닌 입력 수. records:[{}]가 saved:1 반환 재현. 행별 처리 중 실패 시 일부만 저장될 수 있음 | 청크 전송, 행별 검증, 실제 저장/중복/거절 건수 및 확인된 ID 반환. 성공 확인 전 대기열 완료 처리 금지. 원자성 또는 명시적 부분 성공 처리 |
| R08 / P1 | 기관 개인키가 DB JSON 평문, 기기 개인키는 추출 가능한 JWK 메모리. DB·메모리 접근자가 키를 가져갈 수 있음 | 공유 전 제외 규칙부터 복구. 운영 확장 시 키 저장/접근 통제·회전·키 ID·감사 설계, 기기 비추출 키 및 하드웨어 옵션 검토 |
| R09 / P1 | 시각 검사 양쪽이 Date.now 기반. 실제 OS 시계 조작 방어 안 됨. prepare의 prepared도 서명된 정책이 아님 | PoC 한계 유지 표기. 운영 확장 시 신뢰 시간·서명된 정책/준비 정보·키 배포 및 최신성 보장 설계 |
| R10 / P2 | issue의 기기키 검사는 kty==='EC'와 truthy d 배제뿐. {kty:'EC'}도 발급 HTTP 상태 200에 해당하는 핸들러 응답 재현 | P-256 공개 JWK 스키마와 x/y 검증, 공개키 import 검증. d 속성 존재 자체 거절. 잘못된 요청은 400 |
| R11 / P2 | check는 any 입력을 구조 검사 없이 참조. null credential은 TypeError. 빈 nonce를 서명하면 check가 전체 통과하는 사례 재현. UI는 정상 UUID를 생성하므로 현재 화면에서 바로 가능한 우회와는 구분 | 명시적 타입과 런타임 스키마, 빈 요청값 거절, 안전한 실패 결과 반환. 경계값/잘못된 입력 테스트 추가 |
| R12 / P2 | API JSON/행 스키마·입력 크기 제한·rate limit·timeout 없음. null body, records:[null]는 500 재현. UI fetch에는 취소/timeout이 없어 지연 시 busy가 오래 유지될 수 있음 | 400/413 구분, 본문/필드 크기 제한, 요청 제한, 타임아웃·재시도 정책. 서버 진단 로그는 개인키/본문을 제외 |
| R13 / P2 | lint 22개 오류. 주요 로직이 한 줄과 any 위주라 경계 조건·복구 코드 검토가 어려움 | 동작 보존 범위에서 포맷/타입 정의/함수 분리. 링크는 메모리 소실 정책을 먼저 정한 뒤 수정 |
| R14 / P2 | FILES.txt에는 있지만 Clone에는 .dev.vars.example/.gitignore/.npmrc/.openai/hosting.json 네 파일이 없음. README는 ZIP 기준이며 GitHub 미생성 안내도 낡음 | 숨김 파일 포함 여부 점검 및 팀 Clone 기반 Windows 안내 갱신. .npmrc는 원본의 비밀값 유무 확인 후 필요한 공개 설정만 복원 |
| R15 / P2 | 연결 스위치는 조건문이며 실제 네트워크 감지가 아님. stop은 force=true로 우회하여 실제 API 호출. 실제 단절 시 실패 | 시연 안내에 모의 차단과 물리적 단절을 구분. 시연 전 상태 정지 순서와 한계 설명 준비 |
| R16 / P2 | 기존 테스트는 proof 함수 9개뿐. API·D1·UI·복구·네트워크 오류·부분 동기화 검증이 없음 | 실행 복원 후 로컬 API/D1 통합과 브라우저 시연 흐름 검증. 복구 불일치/100건 초과/재시작 데이터 손실을 우선 시험 |

추가로 seen은 세션 범위이고 검사 후 화면에서 별도 갱신한다. 여러 단말·재시작·동시 처리까지 안전하다는 근거는 없다. 응답 서명에는 기관/목적/검증자/요청 만료가 포함되지 않아 향후 별도 단말 시스템으로 확장할 때 해당 문맥의 결합이 필요하다. 현재 한 페이지 역할 전환 시연과 구분해야 한다.

## 7. 민감정보 검사 및 격리 재현 범위

현재 소스/문서 126개에서 OpenAI/GitHub 토큰, PEM 개인키, 실제 JWK d 값 패턴을 검사했으며 일치하는 리터럴을 찾지 못했다. 초기 PowerShell 인용 방식의 검색이 UI 파일/설정 파일을 잘못 매칭해 Node 정규식으로 다시 검사했다. 실제 개인키가 소스에 노출됐다는 증거는 없다. Git 과거 이력 전체·의존성 CVE·배포 시스템·기존 계정의 비밀값까지 감사한 결과는 아니다.

추가 재현은 저장소 파일을 수정하지 않고 표준 입력으로 Node에 전달해 실행했다. API 검사는 원본 route.ts를 메모리에서 TypeScript 변환하고 cloudflare:workers 바인딩만 node:sqlite의 메모리 DB 어댑터로 치환했다. 원본 SQL 마이그레이션을 적용한 일회성 메모리 DB이며 실제 Cloudflare D1 또는 HTTP 서버가 아니다. 실행 종료 시 DB/발급키는 폐기했다.

이 검사에서 정상 발급의 기관 서명 검증 성공, prepare 공개키에 d 필드 없음, 불완전 공개키 발급 허용, 무인증 stop, 임의 sync 결과 저장, saved 수의 불일치, null 입력 500을 확인했다. 검증 함수의 빈 nonce 수락 및 null 예외도 별도로 실행했다. 신뢰 시각 검사는 Date.now 참조를 고정한 조건에서 통과하는 것을 확인한 수준이며 실제 OS 시계 변경 시험은 하지 않았다.

## 8. 수정 결정 시 권장 순서 및 미검증 항목

1. R01/R02/R14: 비밀값 없는 실행 설정과 제외 규칙 복원. 화면 변경 없이 팀원이 Clone만으로 설치·빌드하도록 만든다.
2. 타입 검사·lint·빌드 통과 후 로컬 마이그레이션·서버를 재검증한다. 현재 실패를 설정 복원만으로 전부 해결된다고 단정하지 않는다.
3. R05/R06/R07: 복구 결과 저장, 대기 기록 보존, 동기화 확인 문제를 해결한다.
4. R10/R11/R12 및 R16: 입력 검증과 실패 시나리오 검증을 추가한다.
5. 외부 공개/운영 확장을 선택하면 R03/R04/R08/R09의 보안 설계를 별도로 진행한다.

이번에는 실패를 가리기 위해 누락 설정을 임시로 넣거나 소스/디자인을 수정하지 않았다. 브라우저 실제 시연, 신규 D1 마이그레이션, DB 영속성, 실제 API HTTP 통합, 실제 네트워크 단절은 검증되지 않았다.

최종 작업 트리에는 보고서와 설치 산출물 node_modules/, .sites-runtime/가 미추적 상태로 존재한다. 기존 추적 파일 diff는 없다. .gitignore 복원 전 일괄 git add를 하면 설치 산출물이 포함될 수 있으므로 stage하지 않았다. GitHub Push 및 main 변경은 없다.
