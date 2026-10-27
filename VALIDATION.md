# 실행 및 검증 결과

검증일: 2026-10-27. 환경: Linux x64, Node.js 24.22.1, pnpm 11.25.0. Windows 10/11 직접 실행은 미검증입니다.

| 검사 | 결과 |
|---|---|
| 기준 소스 확보 | 원본 커밋 7b2275136f491cfe341fce95da35a072beaa3e07을 git archive로 추출 |
| 잠금 파일 기반 설치 | 별도 node_modules를 새로 생성하여 pnpm install --frozen-lockfile --offline 성공. 캐시에서 640개 재사용, 다운로드 0. 인터넷 신규 다운로드·Windows 패키지 설치는 미검증 |
| 기존 테스트 | pnpm test: 기존 9개 모두 통과 |
| 타입 검사 | pnpm typecheck: 통과. 원본 req.json()/response.json()의 unknown 오류만 타입 선언으로 보완 |
| 배포용 빌드 | pnpm build: 통과. 원본과 같은 Vinext/Vite/Worker 구조 |
| 로컬 D1 | 새 격리 DB에 초기 마이그레이션 적용 성공. 재실행 시 적용할 마이그레이션 없음 확인 |
| 빌드 서버 | 로컬 Wrangler/workerd의 HTTP 페이지 200, API 통합 확인 성공 |
| 개발 서버 | pnpm dev와 같은 Node 실행 경로에서 HTTP 페이지 200, API 통합 확인 성공 |
| 통합 확인 | 준비, 발급, 실제 기관 서명, 로컬 기기 응답 검증, active 조회, sync, stop, stopped 재조회, 미등록 unknown, 개인키 입력 거절, 미지원 action 거절 확인 |
| DB 저장 | 통합 실행에서 records 행 생성 확인. 테스트 DB/키는 ZIP에서 제외 |
| 원본 영향 | 원본 checkout 수정·commit·push·DB 변경·Site 재배포를 수행하지 않음 |

## 범위의 구분

- 테스트 중 로컬 API가 호출된 주소는 127.0.0.1의 개발 서버뿐입니다. 배포 API·운영 DB를 사용하지 않았습니다.
- 검증 함수의 단위 시험과 HTTP/API 통합 확인입니다. 이번 내보내기에서는 브라우저 클릭 E2E/시각 회귀를 새로 실행하지 않았습니다.
- CSS·UI JSX·검증 로직·API 처리 흐름은 원본과 비교했습니다. 화면 파일 변경은 JSON 반환값의 타입 선언 하나뿐입니다.
- 빌드의 라우트 분류 관련 Vinext 안내는 있었지만 빌드는 정상 종료했습니다.
- 운영용 Cloudflare 인증 없이 로컬 API가 동작했습니다. 의존성 설치에는 최초 레지스트리 인터넷 접근이 필요합니다.

## 추가 재확인

1. Windows 10/11의 Node/pnpm 설치, 네이티브 workerd 실행, PowerShell .cmd 명령.
2. 실제 브라우저에서 README 순서대로 준비·동의·검증·복구 완료.
3. 실제 외부 연결 단절 및 새로고침/재시작 한계 확인.
4. 분리된 두 기기 전송, 기기 키 보안, 신뢰 시간, 역할별 권한 등 미구현 범위.
5. 공모전 제출 전 기관 회신 원문·공식 연동 허가 조건.
