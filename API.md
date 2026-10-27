# API

모든 기능은 `POST /api/demo`의 JSON `action`으로 구분합니다. `Content-Type: application/json`을 사용합니다. 아래는 가상 데이터 예시이며 호출마다 생성되는 키나 서명은 파일에 저장하지 않습니다.

| action | 요청의 추가 필드 | 성공 응답 |
|---|---|---|
| `prepare` | 없음 | `{publicKey: JWK, prepared: epochMs}` |
| `issue` | `deviceKey`: ECDSA 기기 공개 JWK | `{credential: {payload, signature}}` |
| `status` | `id`: 테스트 증명정보 ID | `{status: "active" 또는 "stopped" 또는 "unknown", checked: epochMs}` |
| `stop` | `id`: 테스트 증명정보 ID | 정지 처리 후 status와 동일한 형식 |
| `sync` | `records`: 접수 배열 | `{saved: number}` |

## 필드

`credential.payload`: `id`(서버 생성 UUID), `name`("테스트 방문자"), `deviceKey`(기기 공개 JWK), `issued`(ms), `expires`(발급 1시간 후 ms).

`signature`: JSON.stringify(payload)의 UTF-8 바이트를 ECDSA P-256/SHA-256으로 서명한 바이트의 Base64. JWT/JWS나 공식 모바일신분증 포맷이 아닙니다.

`sync.records`의 각 행: `{id: "가상-접수-ID", credential: "가상-증명-ID", result: "제한 접수 완료"}`. 최대 100개만 처리하고, 각 필드가 문자열인 행만 INSERT OR IGNORE 합니다. `saved`는 입력에서 잘라낸 행 수이므로 실제 신규 삽입 건수와 다를 수 있습니다. 이 부분은 원본 동작을 보존했습니다.

## PowerShell API 확인 예시

먼저 로컬 서버를 실행하고, 출력 포트가 다르면 주소를 수정합니다.

```powershell
$body = @{ action = 'prepare' } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://127.0.0.1:8787/api/demo' -Method Post -ContentType 'application/json' -Body $body
```

`issue`는 키 생성을 포함하므로 이용자 화면에서 발급하는 것이 쉽습니다. 테스트에 사용한 가상 ID를 `status`로 조회하면 미등록 시 `unknown`이 나옵니다.

## 오류 및 보안 범위

- 400: 미지원 action, 기기 공개키의 기초 조건 미충족, 상태 조회 ID가 문자열이 아님.
- 500: JSON 처리·키 import·DB 등 서버 오류. 원본은 세부 오류를 공개하지 않습니다.
- 서버 자체의 사용자/역할별 권한 검사, 입력 크기 제한, 상세 JSON 스키마 검증, rate limit은 없습니다. 배포 Site의 외곽 로그인 보호와 API 자체 권한은 구분해야 합니다.
- `sync`는 클라이언트 제출 결과를 신뢰하고 서명을 재검증하지 않습니다. 감사 증거로 쓸 수 없습니다.
- 로컬 개발 API를 인터넷에 공개하지 마세요. 운영으로 확장하기 전 기관/이용자/검증자 권한 분리와 로그 무결성을 재검토해야 합니다.
