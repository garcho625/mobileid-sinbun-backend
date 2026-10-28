'use client';
import { useEffect, useState } from 'react';
import type { Check, CredentialPayload, DemoRecord, Signed, Trust } from '../lib/proof';
export type DemoMode = 'single' | 'holder' | 'verifier';
export function DemoGuide({ mode, onMode, credential, trust, cached, nonce, response, checks, records, receivedReceipt, recovered, busy, navigate, preservedPending }: {
  preservedPending:number; mode: DemoMode | null; onMode: (m: DemoMode) => void; credential: Signed<CredentialPayload> | null; trust: Trust | null; cached: boolean; nonce: string; response: boolean; checks: Check[]; records: DemoRecord[]; receivedReceipt:boolean; recovered: boolean; busy: boolean; navigate: (tab: number, target?: string) => void;
}) {
  const [now, setNow] = useState(0);
  useEffect(() => { const tick=()=>setNow(Date.now());tick();const timer=setInterval(tick,1000);return()=>clearInterval(timer); }, []);
  const issued = !!credential && now < credential.payload.expires && now - credential.payload.issued <= 900000;
  const prepared = !!trust && now - trust.prepared <= 900000;
  const ready = mode === 'holder' ? issued : mode === 'verifier' ? prepared : issued && prepared;
  const pending=records.filter(r=>!r.synced).length;
  const passed=checks.length>0&&checks.every(c=>c.ok);
  const verified=passed||pending>0||receivedReceipt;
  const current=!mode?0:pending>0?4:!ready?1:!cached?2:verified?4:3;
  const done=[!!mode,ready,cached,verified,verified&&recovered&&pending===0];
  const titles=['시연 방식 선택','온라인 준비','오프라인 화면 준비','요청 · 동의 · 검증','연결 복구 · 동기화'];
  let instruction='',action='',tab=0,target='';
  if(current===0){instruction='처음에는 한 기기 연습을 추천합니다. 두 기기 시연은 각 기기에서 역할을 선택하세요.';action='';}
  else if(current===1){tab=1;if(mode!=='verifier'&&!issued){instruction=credential?'준비 시간이 지났습니다. 온라인에서 테스트 신분증을 다시 발급하세요.':'온라인 상태에서 테스트 신분증을 발급하세요. 발급 후 지갑에 카드가 표시됩니다.';action='발급기관으로 이동';target='issue-button';}else{instruction='신뢰키는 발급기관 서명을 확인하는 공개키입니다. 발급 버튼 옆의 검증자 신뢰키 · 정책 준비를 누르세요. 유효시간은 15분입니다.';action='검증자 준비로 이동';target='prepare-button';}}
  else if(current===2){instruction='아래 화면 오프라인 준비 버튼을 눌러 화면을 저장하세요. 준비 완료가 표시되면 다음 단계로 넘어갑니다. 이미 저장했다면 이 단계는 자동으로 확인됩니다.';action='화면 저장 단계로 이동';target='offline-prepare-button';}
  else if(current===3&&mode==='single'){if(!nonce){instruction='검증자 화면에서 새 요청을 만드세요. 그다음 이용자 지갑에서 동의합니다.';action='검증 요청 만들러 가기';tab=3;target='request-button';}else if(!response){instruction='이용자 지갑에서 정보 제공에 동의하고 기기 응답을 생성하세요.';action='이용자 동의 단계로 이동';tab=2;target='consent-control';}else{instruction='검증자 화면에서 정상 조건을 선택하고 서명·업무 조건을 검증하세요. 상단 연결 스위치로 장애를 모의할 수 있습니다.';action='서명 검증하러 가기';tab=3;target='verify-button';}}
  else if(current===3){instruction=mode==='holder'?'검증자의 요청 QR 스캔 → 목적 확인·동의 → 응답 QR 생성 → 검증자에게 보여주기 순서입니다. 성공 여부는 검증자 화면에서 확인하세요.':'새 요청 QR 생성 → 이용자 스캔·승인 → 응답 QR 스캔 → 검증 결과 확인 순서입니다.';action='QR 인증 화면으로 이동';tab=5;}
  else{instruction=verified&&recovered&&pending===0?'이번 연습의 기록을 서버에 저장했습니다. 기록 목록에서 최종 판정을 확인하거나 상단의 처음부터 다시 시작을 누르세요.':`상단이 연결 차단 중이면 눌러 온라인으로 바꾸세요. 복구·기록에서 상태 재확인 · 기록 동기화를 누르세요. 대기 기록 ${pending}건입니다.`;action=verified&&recovered&&pending===0?'동기화 결과 보기':'복구 · 기록으로 이동';tab=4;target='recover-button';}
  return <section className="demo-guide" aria-label="시연 단계 안내" data-testid="demo-guide"><div className="guide-heading"><div><span className="eyebrow">START HERE / STEP BY STEP</span><h2>지금 무엇을 하면 되나요?</h2></div><div className="guide-tools"><span className="guide-counter">{mode?`${current+1} / 5 단계`:'시작 전'}</span></div></div><div className="mode-options"><button aria-pressed={mode==='single'} onClick={()=>onMode('single')}><strong>한 기기에서 연습</strong><small>처음 사용한다면 상단 한 화면 연습을 추천</small></button><div className="qr-mode-choice"><strong>두 기기로 QR 교환</strong><small>각 기기에서 자신의 역할을 선택</small><div><button aria-pressed={mode==='holder'} onClick={()=>onMode('holder')}>이용자로 시작</button><button aria-pressed={mode==='verifier'} onClick={()=>onMode('verifier')}>검증자로 시작</button></div></div></div><ol className="guide-steps">{titles.map((title,i)=><li key={title} aria-current={current===i?'step':undefined} data-complete={done[i]}><span>{done[i]?'✓':i+1}</span><div><strong>{title}</strong><small>{done[i]?'확인됨':current===i?'지금 진행':'다음 순서'}</small></div></li>)}</ol><div className="guide-next"><div><strong>{verified&&recovered&&pending===0?'접수 흐름 완료':`다음 할 일 · ${titles[current]}`}</strong><p data-testid="guide-instruction">{instruction}</p></div>{action&&<button disabled={busy} onClick={()=>navigate(tab,target)}>{action} →</button>}</div><p className="restart-note">다시 연습하면 현재 신분증·준비 정보·요청·동의·결과만 초기화합니다. 기존 접수 기록과 오프라인 화면, 재사용 차단 이력은 지우지 않습니다.</p>{preservedPending>0&&<p className="preserved-records">이전 연습의 미동기화 기록 {preservedPending}건을 보존 중입니다. 새 연습과 별개로 복구·기록에서 온라인 동기화할 수 있습니다.</p>}<small className="guide-note">카드 발급과 화면 저장은 별도입니다. 준비는 15분 시험값이며, 두 기기는 같은 가상 기관에서 준비해야 합니다. QR 이용자는 응답 표시 후 검증자 기기의 결과를 확인하세요.</small></section>;
}
