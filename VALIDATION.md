# Windows 로컬 검증 결과

검증일: 2026-10-27. Windows PowerShell 5.1.26100.8875, Node 24.19.0, npm 11.17.0, pnpm 11.25.0, Chrome 155.0.8059.85. 기존 Linux 내보내기 검증과 별도로 직접 실행했습니다.

| 검사 | 결과 |
|---|---|
| main 보존 | d6e4ee0fa1d22b0f68ad32a0025321e2a5fc098b 유지 |
| 작업 브랜치 | codex/review-and-improve |
| 최초 Windows 설치 | pnpm install --frozen-lockfile 성공, 639개 설치 및 Windows 네이티브 모듈 설치 확인 |
| 기존 서명 테스트 | tests/proof.mjs 기존 9개 통과, 원본 테스트 수정 없음 |
| 시각 경계 테스트 | tests/clock.mjs 4개 통과: 작은 오차, 미래 발급 차단, 엄격한 만료, 준비 경과 |
| 타입 검사 / Lint | 모두 exit 0 |
| 빌드 | 클라이언트·Worker·SSR 생성 성공, exit 0 |
| 개발 서버 | 127.0.0.1:5173, HTTP 200, API 통합 및 Chrome 시연 검사 통과 |
| 빌드 서버 | 127.0.0.1:8787, HTTP/API 및 Chrome 시연 검사 통과 |
| D1 | 새 로컬 마이그레이션 성공. 재실행 시 No migrations to apply. db:inspect로 실제 행 확인 |
| 기록 영속성 | 새로고침 시 대기/동기화 기록 복원. 신분증 재발급 후 기존 기록 유지. 새 브라우저 세션에서 D1 조회. 서버 종료/재기동 후 이전 행 존재 확인 |
| 원본 영향 | Work 사이트·운영 Workers/D1 조회/수정·배포 없음. Commit/Push 없음 |

## 실제 API 통합 검사

tests/local-api.mjs가 로컬 HTTP 서버를 호출했습니다. 메모리 DB 모의 검사가 아닙니다. 발급·기관 서명·요청별 기기 응답·변조/재사용 차단·active/stop/stopped·sync·기존 판정 갱신·records 조회를 확인했습니다. 불완전 키·개인키 제출·잘못된 JSON 객체·null 행·100건 초과·미등록 발급 ID·다른 Origin을 거절했습니다. 잘못된 행을 포함한 배치가 앞선 정상 행을 부분 저장하지 않는지, 오류 응답 이후 HTML과 API가 계속 동작하는지도 확인했습니다.

## 실제 브라우저 검사

tests/local-browser.mjs와 임시 Chrome 프로필로 기존 UI 버튼을 조작했습니다.

1. 가상 발급 → 신뢰키 준비 → 모의 연결 차단.
2. 브라우저 네트워크를 Offline으로 설정하고 요청·동의·기기 응답·로컬 검증 성공 확인.
3. 해당 구간의 /api/demo 요청 0건, 검증 항목 6개 통과, 같은 응답 재사용 차단 확인.
4. 연결 복구 → 동기화 → active 판정이 실제 D1 조회와 일치.
5. 정지 → 재동기화 → 담당자 검토 판정이 D1에도 갱신됨.
6. 새로고침 및 재발급 후 기록 유지, 미동기화 기록의 새로고침 복원 및 신분증 없이 재전송 확인.
7. 비어 있는 새 브라우저 세션에서도 D1 기록 복원.
8. 1440px 데스크톱과 390px 모바일 캡처 확인. 페이지 JavaScript 오류 0건.

결과와 화면 캡처는 .sites-runtime/qa에 있으며 Git에서 제외됩니다. 물리적인 인터넷 선 제거 시험은 아닙니다. 오프라인 새로고침은 지원하지 않습니다.

## 처음 Clone한 상태에 준하는 검사

Git 공유 대상 파일만 .sites-runtime/clean-checkout에 복사했습니다. 시작 시 .git, node_modules, dist, .wrangler, DB, 키, 실제 환경파일이 없는 상태였습니다. 로컬 미커밋 변경을 검증하기 위한 사본이며 원격 GitHub에서 변경을 Clone한 것은 아닙니다.

이 새 사본에서 잠금 파일 기반 설치(639개 캐시 재사용), 기존 테스트, 타입 검사, Lint, 빌드, 새 D1 생성, 빌드 서버, 실제 API, 실제 Chrome 시연 흐름을 확인했습니다. 같은 Windows PC에서 수행했으며 다른 팀원 PC 네 대를 직접 검증한 것은 아닙니다. 최초 원본 사본의 Windows 설치에서는 레지스트리에서 실제 패키지 다운로드도 수행했습니다.

## 발견 후 해결한 문제 및 남은 관찰

- 필수 숨김 설정 누락: 독립 로컬 설정 추가 및 타입 검사 호환용 최소 hosting.json 복원으로 해결.
- 로컬 Worker 발급 시각이 Node 시각보다 3ms 앞서 정상 검증 실패: 미래 발급/준비 시각만 2초 허용. 만료·15분 최대 경과는 유지. 경계 테스트와 실제 API 재검사 통과.
- Codex 샌드박스의 레지스트리/자식 프로세스 차단: ENOTCACHED/ECONNREFUSED/EPERM을 확인하고 승인된 로컬 재실행으로 검증. 일반 Windows 실행 실패로 혼동하지 않음.
- API 오류 검사 후 Wrangler 종료: 처음에는 병행 빌드와 관련된 것으로 의심했지만 순차 실행에서도 재현됨. 진단 로그에서 TypeError: Can't read from request stream after response has been sent 확인. 다른 Origin을 본문 소비 전에 거절하던 경로를 수정해 모든 응답 전에 본문을 읽도록 함. 이후 오류 응답 후 HTML/API가 계속 동작하는 회귀 검사와 Chrome 전체 흐름이 통과함. 진단 로그는 무시 폴더에만 남겼고 Cloudflare 오류 보고는 보내지 않음.
- Vinext/Vite의 ineffective dynamic import 및 개발 의존성 최적화 경고는 관찰됨. 빌드 exit 0과 시연 통과를 확인했으며 라이브러리 대규모 교체는 하지 않음.

실제 Work 배포·공식 앱·두 기기·물리적 회선 단절·운영 보안 동등성·Git 과거 이력 전체 비밀정보 감사·의존성 CVE 전체 감사는 수행하지 않았습니다.
