# Astra 감사 P1 수정 결과 — 2026-10-27

> P1 수정 완료 당시의 검증 기록입니다. 아래 미커밋 설명은 당시 상태이며, 이후 최종 공유 준비에 따른 로컬 Commit 및 Push 판단은 FINAL_SHARING_REVIEW.md와 작업 완료 보고를 기준으로 합니다.

판정: **지정된 P1 두 문제의 재현 경로를 수정하고 회귀 검증을 통과했다. 단일 PC localhost 공모전 데모의 팀 공유 변경안으로 검토 가능하다.** 전체 의존성 취약점이 제거된 것은 아니며, 외부 공개 서비스로의 사용은 별도 검토가 필요하다.

## 작업 위치 및 보호 상태

- 원본: `C:\Users\USER\Documents\GitHub\mobileid-sinbun-backend`, main, `d6e4ee0fa1d22b0f68ad32a0025321e2a5fc098b`. 원본 소스/DB를 변경하지 않았다.
- 수정 worktree: `C:\Users\USER\Documents\GitHub\mobileid-sinbun-p1-fix`.
- 로컬 수정 브랜치: `codex/fix-audit-p1`, 기반 HEAD `7770e7dc5a7404f144f456f7f21dcc77f7ae946d`.
- 이번 변경은 **미커밋 로컬 변경**이다. Commit·Push·Merge·배포를 하지 않았다. GitHub의 기존 공유 브랜치에는 이 수정이 아직 없다.
- 기존 Work 사이트와 운영 Workers/D1에 접근하지 않았다. 실행/DB 명령은 worktree의 로컬 바인딩과 --local만 사용했다. 테스트 DB/키/산출물은 이 worktree의 무시 폴더에만 있다.

## P1-1: 접수 ID와 신분증 귀속

원인: 같은 요청 내부의 중복 ID를 검사하지 않았고, 기존 UPSERT는 credential을 유지하면서 다른 신분증에서 계산한 result만 덮어썼다. 입력 배열 길이만큼 저장 응답을 구성해 같은 DB 행이 saved에 중복 집계됐다. 쓰기 전 조회만으로는 동시 요청의 경쟁도 막을 수 없었다.

수정:

1. 같은 ID/같은 credential의 중복은 Map으로 하나로 합친다. 같은 ID/다른 credential이면 409로 요청 전체를 거절한다.
2. 기존 DB 행과 다른 credential도 쓰기 전에 409로 거절한다.
3. 새 마이그레이션의 `records_credential_immutable` 트리거가 DB 수준에서 credential 변경을 ABORT한다. 기존 PRIMARY KEY/NOT NULL과 테이블 구조는 유지했다. 동시 요청으로 사전 조회가 빗나가도 D1 batch 전체가 취소된다.
4. 쓰기 SQL이 settings의 현재 상태를 조회해 판정한다. 클라이언트 result는 저장 판정에 사용하지 않는다. stop과 sync의 순서에 따라 해당 쓰기 시점의 상태가 반영되며 이후 정지는 다음 복구 시 재확인한다.
5. UPSERT는 최초 created를 보존하고 상태 판정만 갱신한다. RETURNING의 실제 고유 저장/갱신 행으로 records와 saved를 구성한다. saved는 신규 INSERT 수가 아니라 이번 요청에서 확인한 고유 접수 행 수다.

기존 DB 사용자는 **`pnpm.cmd db:local`을 다시 실행**해야 한다. 마이그레이션은 데이터를 삭제하지 않는다. 과거 잘못된 판정은 정상 재동기화 시 현재 상태로 갱신된다. 원본 PC의 기존 DB에 임의로 마이그레이션/수정하지 않았다.

추가 검증:

- 정상 요청과 같은 요청 재전송: 한 행/동일 최초 시각 유지.
- 동일 ID/동일 신분증을 한 배치에서 두 번 전송: saved=1, 한 행 응답.
- 동일 ID/다른 신분증: 정지→정상 및 정상→정지 양쪽 순서 모두 409, 선행 정상 행까지 저장되지 않음.
- 기존 접수 ID의 귀속 충돌: 409, 앞의 새 행도 저장되지 않음.
- 정지 증명의 중복 요청: saved=1, 담당자 검토 판정 유지.
- 빈 배치: saved=0, records=[].
- 동시 충돌: 실제 Workers/D1에서 6회 반복, 매회 200/409 각 하나, 패자 배치의 다른 행도 저장되지 않음. 개발/빌드 서버에서 각각 통과.
- 메모리 SQLite에서 기존 데이터가 있는 DB에 마이그레이션 적용, 정상 result 갱신 허용, 직접 귀속 변경 차단, 충돌 UPSERT의 트랜잭션 전체 rollback 확인.

## P1-2: Windows Vite 파일 접근

Vite 8.0.13 → **8.0.16**으로만 직접 의존성을 갱신했다. [GHSA-fx2h-pf6j-xcff 공식 공지](https://github.com/vitejs/vite/security/advisories/GHSA-fx2h-pf6j-xcff)의 같은 메이저 최소 패치다. Cloudflare 플러그인/Vinext/React/Next의 직접 버전은 유지했다. 필수 Vite 전이 의존성인 Rolldown/OXC 계열 및 peer 참조는 잠금 파일에 함께 반영됐다.

package.json 선언, node_modules 설치 버전, 잠금 파일이 모두 8.0.16이며 잠금 파일의 vite@8.0.13 참조는 없다. `pnpm install --frozen-lockfile --offline`도 성공했다. dev의 `127.0.0.1:5173`, strictPort, remoteBindings:false 및 --local 실행 구성을 유지했다.

`tests/vite-security.mjs`는 무작위 이름의 **가짜 표식 .key 파일만** 만들어 아래 경로를 검사하고 finally에서 삭제한다. 실제 개인키 파일을 찾거나 읽지 않는다.

| 경로 | 결과 | 표식 노출 |
|---|---:|---|
| 직접 .key?raw | 403 | 없음 |
| .key::$DATA?raw | 403 | 없음 |
| .key::$DATA?import&raw | 403 | 없음 |
| 인코딩된 ADS 경로 | 404 | 없음 |

이 PC에서는 가짜 파일의 **8.3 별칭이 생성되지 않아 해당 경로의 실증 검사는 미검증**이다. 테스트 결과의 shortNameTested=false로 기록했다. ADS 재현 경로는 차단됐지만 모든 Windows 파일 별칭/보안 우회를 검증했다는 뜻은 아니다.

## 전체 검증 결과

환경: Windows PowerShell 5.1, Node 24.19.0, pnpm 11.25.0, Chrome 155.0.8059.85.

| 검사 | 결과 |
|---|---|
| 의존성 설치 및 frozen lockfile 재확인 | 통과 |
| 기존 proof 9 + clock 4 | 13개 통과 |
| 새 DB 제약 검사 | 4개 시나리오 통과 |
| TypeScript typecheck | 통과 |
| ESLint | 통과 |
| Windows build | 통과, 기존 Vinext 동적 import 경고 남음 |
| 새 로컬 D1 마이그레이션 | 0000 + 0001 적용 성공 |
| Workers/D1 통합 및 P1 동시 충돌 | 8787/5173 각각 통과 |
| Chrome 기본 시연 | 8787/5173 각각 통과 |
| Chrome offline 검증 | API 호출 0, 서명 6개 조건 통과, 재사용 차단 |
| 복구/정지 불일치/D1 조회 | 통과 |
| 새로고침/대기 기록 복원/새 브라우저 D1 조회 | 통과 |
| Windows ADS 파일 우회 차단 | 통과, 가짜 파일 사용 |
| 8.3 별칭·실제 회선 단절·팀원별 다른 PC | 미검증 |
| 기존 UI/CSS/서명/Worker/테이블 구조 | 수정하지 않음, Chrome 흐름 회귀 없음 |

Git diff --check도 통과했다. 설치의 첫 네트워크 시도는 샌드박스 차단 후 승인된 재시도로 성공했다. 보안 검사 cmd.exe의 최초 EPERM도 승인된 실행으로 통과했다. 이 도구 환경 제한을 앱 오류로 집계하지 않았다.

검사 증거는 무시 폴더 `.sites-runtime/api-test-result.json`, `.sites-runtime/qa/browser-built-result.json`, `.sites-runtime/qa/browser-result.json`, `.sites-runtime/qa/vite-security-result.json`에 있다. Chrome 데스크톱/모바일 캡처도 qa에 있다.

## 추가/수정 파일

| 파일 | 내용 |
|---|---|
| app/api/demo/route.ts | 중복/귀속 검증, DB 쓰기 시 상태 판정, 실제 저장 응답, 트리거 충돌 409 |
| drizzle/0001_record_credential_guard.sql | 접수 귀속 변경 방지 트리거 |
| drizzle/meta/_journal.json | 새 마이그레이션 등록 |
| package.json | Vite 패치 및 DB/보안 테스트 명령 |
| pnpm-lock.yaml | Vite와 필수 전이 의존성/peer 참조 갱신 |
| tests/local-api.mjs | 정상/중복/충돌/정지/동시성 회귀 검사 |
| tests/records-db.mjs | 메모리 DB 제약/마이그레이션/rollback 검사 |
| tests/vite-security.mjs | 가짜 파일로 Windows 차단 검사 |
| README.md | 이미 Push된 기본 버전과 미반영 P1 수정 구분, 명시적 브랜치 Clone, DB 재적용/검사 명령 |
| API.md | saved 및 충돌/트랜잭션 계약 갱신 |
| LOCAL_DEMO_RESULT.md | 과거 기록과 현재 상태 구분 |
| GITHUB_SHARING_REVIEW.md | 과거 Push 전 기록이라는 안내 |
| DEPENDENCY_REVIEW.md | 남은 76개 공지/17개 패키지의 사용 경로별 분류 |
| P1_FIX_RESULT.md | 이 결과 보고서 |

## 남은 취약점 및 공유 판단

`pnpm audit`: **Critical 3 / High 32 / Moderate 30 / Low 11**, 총 76건. 변경 전 78건에서 요청한 파일 우회 및 NTLMv2/UNC 공지가 제거됐다. [DEPENDENCY_REVIEW.md](DEPENDENCY_REVIEW.md)에 전체 항목을 분류했다. 취약점이 모두 없어졌다고 판단하지 않는다.

- React Server Functions/RSC 관련 DoS는 실제 사용하는 프레임워크 영역이므로 후속 우선순위다. 앱에 use server 함수는 없지만 프레임워크 단계 도달성을 검증하지 않았다. 공식 패치 및 호환성 검토가 남는다.
- Next Critical 3건은 OG/SVG/이미지 최적화/glibc Linux/use cache 조건과 연결된다. 현재 앱에서 해당 호출 경로는 찾지 못했으나 패키지 전체의 비영향을 보장하지 않는다. 일부 공식 공지는 기능 사용 여부와 관계없이 업데이트를 권고한다.
- Vite editor 관련 공지와 Wrangler/Miniflare 통신 계열도 잔존한다. 실제 편집기 실행·악성 패킷 실험은 하지 않았고 외부 공개용 안전성을 승인하지 않는다.
- 기존 API 인증 부재, 평문 테스트 기관 키, 신뢰 시각/다중 탭/오프라인 재기동 한계는 그대로다.
- 외부 Webhook/App의 자동 배포 연결은 기존 감사에서도 미확인이었으며 이번에는 운영 서비스에 접근해 확인하지 않았다.

**GitHub 반영 전 로컬 변경 검토는 가능한 상태**다. 실제 팀원 공유 시 main 대신 수정이 반영된 브랜치를 선택하고 각 PC에서 db:local을 실행해야 한다. 현재는 사용자의 다음 지시 전까지 이 worktree의 미커밋 변경으로 유지한다.

## Windows 실행 및 회귀 검사

현재 수정본을 직접 확인할 때는 **수정 worktree**에서 실행한다. 원본 main 폴더가 아니다.

```powershell
cd C:\Users\USER\Documents\GitHub\mobileid-sinbun-p1-fix
pnpm.cmd install --frozen-lockfile
pnpm.cmd db:local
pnpm.cmd test
pnpm.cmd typecheck
pnpm.cmd lint
pnpm.cmd build
pnpm.cmd start
```

빌드 시연 주소: http://127.0.0.1:8787/ . 개발: pnpm.cmd dev → http://127.0.0.1:5173/ . 개발 서버를 실행한 별도 터미널에서 pnpm.cmd test:vite-security 및 pnpm.cmd test:integration -- http://127.0.0.1:5173 을 실행할 수 있다. 시연은 단일 탭·동일 origin을 유지한다.
