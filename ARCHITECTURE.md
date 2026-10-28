# 로컬 독립 실행 구조

> 아래는 기반 P1 버전의 범위/구축 기록입니다. 2026-10-28 기능 브랜치는 IndexedDB CryptoKey 저장·Service Worker 재실행·두 기기 QR을 추가했습니다. 최신 동작/지원 제한은 OFFLINE_QR_GUIDE.md와 OFFLINE_QR_RESULT.md를 기준으로 보세요.


React/TypeScript 화면과 기존 Worker/D1을 재사용합니다. Python 백엔드와 별도 프런트엔드를 추가하지 않았습니다. 하나의 브라우저가 발급기관·지갑·검증자·복구 역할을 전환합니다.

```text
pnpm dev   → scripts/run-local.mjs → vite.local.config.ts → 127.0.0.1:5173
pnpm build → 같은 설정 → dist/client + dist/server
pnpm start → 로컬 빌드 검사 → Wrangler dev --local → 127.0.0.1:8787

브라우저 → /api/demo → worker/index.ts → Vinext → app/api/demo/route.ts → env.DB
브라우저 → lib/proof.ts → Web Crypto 로컬 서명/검증 (네트워크 호출 없음)
```

`wrangler.local.json`은 DB 바인딩과 placeholder UUID만 가집니다. remote:false, remoteBindings:false로 원격 바인딩을 사용하지 않습니다. 기본 dev/build는 원본 Sites 플러그인·인증·connector preview를 로드하지 않습니다. 원본 `vite.config.ts` 및 실행 도구는 보존했습니다. `.openai/hosting.json`에는 project_id·운영 DB ID가 없으며 로컬 실행은 이 파일을 읽지 않습니다.

`scripts/local-db.mjs`는 빌드와 독립적으로 기존 drizzle SQL을 마이그레이션합니다. DB는 checkout별 `.wrangler/state`에 생성되며 각 PC에서 서로 다른 기관 테스트 키를 생성합니다. dev/start가 같은 DB를 사용합니다.

| 테이블 | 내용 |
|---|---|
| settings(id,value) | issuer 행에 가상 기관 키 JWK JSON, 발급 UUID별 active/stopped |
| records(id,credential,result,created) | 접수 ID, 가상 발급 ID, 서버 복구 판정, 최초 동기화 시각 |

기관 개인키는 로컬 테스트 DB에 평문으로 남습니다. 브라우저 기기 개인키는 추출 가능한 JWK로 메모리에만 있으며 서버로 전송하지 않습니다. 운영 수준의 키 보호는 아닙니다.

검증 시 기관 서명, 요청별 기기 서명·ID·nonce·seen, 만료, 양측 준비 15분, visit 업무, 시험 시각을 확인합니다. 로컬 Worker/Node 간 수 ms 차이가 재현돼 발급·준비 시각의 미래 오차만 최대 2초 허용합니다. 만료와 15분 최대 경과 제한은 엄격히 유지합니다. 신뢰 시간 확보를 구현한 것은 아닙니다.

접수 기록은 localStorage의 ansim-demo-records-v1에 저장하며 개인키·증명정보·요청값은 저장하지 않습니다. 페이지 로드 시 로컬 대기열과 서버 최근 500건을 합칩니다. 복구는 100건씩 서버에 보내고 각 배치 저장 응답을 확인한 후 synced로 표시합니다. 재발급으로 기록을 삭제하지 않습니다. 새로고침 후에도 신분증 없이 대기 기록 동기화가 가능합니다.

브라우저 저장은 origin별입니다. 개발/빌드 포트와 localhost/127.0.0.1 간에는 대기열을 공유하지 않습니다. 동기화된 D1 기록은 같은 checkout의 두 서버에서 조회할 수 있습니다. 여러 탭의 동시 대기열 편집·OS 시계 조작·키 회전·정지 목록의 오프라인 배포는 지원하지 않습니다.
