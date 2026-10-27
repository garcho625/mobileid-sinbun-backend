# 로컬 API

Windows 로컬 시연용 `POST /api/demo`입니다. Content-Type은 application/json이며 Origin이 있으면 요청 주소와 같아야 합니다. 실제 서비스용 인증/권한 분리는 없습니다. 서버는 기본 127.0.0.1에만 연결됩니다.

| action | 입력 | 응답 |
|---|---|---|
| prepare | 없음 | publicKey(JWK), prepared(ms) |
| issue | deviceKey: 유효한 P-256 공개 JWK. d 속성 금지 | credential: payload + signature |
| status | id: 발급 ID | status: active/stopped/unknown, checked(ms) |
| stop | id: 발급 ID | 정지 후 status와 같은 응답 |
| sync | records: 최대 100개, 각 id/credential/result | saved: 확인한 건수, records: 저장된 행 |
| records | 없음 | records: 최근 최대 500개, hasMore |

credential.payload는 id, 가상 name, deviceKey, issued, expires를 포함합니다. 서명은 JSON.stringify(payload)의 UTF-8 바이트에 대한 ECDSA P-256/SHA-256 서명 Base64이며 공식 신분증 포맷이 아닙니다.

sync는 배열 전체를 검증한 후 D1 batch로 기록합니다. 미등록 발급 ID를 거절하고, 기존 접수 ID를 다른 발급 ID로 바꾸는 요청도 거절합니다. 클라이언트 result를 복구 판정으로 신뢰하지 않고 각 발급 ID의 현재 상태를 조회해 결과를 저장합니다. 같은 ID의 재동기화는 결과를 갱신하고 최초 저장 시각을 유지합니다. 클라이언트 서명 증거 자체를 서버가 재검증하는 기능은 없으므로 운영용 감사 기록이 아닙니다.

records의 created는 최초 서버 동기화 시각입니다. 원래 현장 접수 시각은 별도 영구 보관하지 않습니다. 기록 조회 응답에 개인키는 포함하지 않습니다.

- 400: JSON/스키마/키/ID 오류, 알 수 없는 action, 미등록 발급 기록, 100건 초과.
- 403: 다른 Origin 요청.
- 409: 같은 접수 ID의 발급 ID 변경.
- 413: 요청 본문 128KiB 초과.
- 500: DB 등 서버 처리 실패. 응답에는 상세 내부 오류를 포함하지 않습니다.

```powershell
$body = @{ action = 'records' } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://127.0.0.1:8787/api/demo' -Method Post -ContentType 'application/json' -Body $body
```

운영 확장 시 API 인증/인가, rate limit, 요청 스트림의 선제적 크기 제한, 감사 증거 및 오류 관측을 추가해야 합니다. 현재 본문 크기 검사는 본문을 읽은 후 적용됩니다.
