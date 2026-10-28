'use client';
import {useEffect,useState} from 'react';
import {IdentityCard,type IssuerStatus} from './identity-card';
import {OfflineReady} from './offline-ready';
import type {DemoMode} from './demo-guide';
import type {Check,CredentialPayload,DemoRecord,Signed,Trust} from '../lib/proof';

const titles=['신분증 발급','검증 준비','장애 체험','요청 만들기','이용자 동의','서명 검증','복구 · 저장'];
type Props={mode:DemoMode|null;onMode:(mode:DemoMode)=>void;credential:Signed<CredentialPayload>|null;status:IssuerStatus|null;trust:Trust|null;cached:boolean;onCached:(ready:boolean)=>void;offline:boolean;setOffline:(offline:boolean)=>void;nonce:string;response:boolean;consent:boolean;onConsent:(value:boolean)=>void;checks:Check[];records:DemoRecord[];receivedReceipt:boolean;recovered:boolean;busy:boolean;preservedPending:number;issue:()=>void;prepare:()=>void;request:()=>void;respond:()=>void;verify:()=>void;recover:()=>void;navigate:(tab:number)=>void};
export function PracticeFlow(p:Props){
 const [now,setNow]=useState(0);
 useEffect(()=>{const tick=()=>setNow(Date.now());tick();const timer=setInterval(tick,1000);return()=>clearInterval(timer)},[]);
 const issued=!!p.credential&&now<p.credential.payload.expires&&now-p.credential.payload.issued<=900000;
 const prepared=!!p.trust&&now-p.trust.prepared<=900000;
 const pending=p.records.filter(r=>!r.synced).length;
 // Only a durable receipt completes verification, never successful checks alone.
 const accepted=p.receivedReceipt||pending>0;
 const current=accepted?(p.recovered&&pending===0?7:6):!issued?0:!prepared||!p.cached?1:!p.nonce?(p.offline?3:2):!p.response?4:5;
 const active=p.mode==='single';
 const role=['이용자 · 발급기관','검증자','상황 체험','검증자','이용자','검증자','복구 담당자','연습 완료'][current];
 const instruction=[
  p.credential?'신분증 또는 준비 시간이 지났습니다. 온라인 상태에서 새 테스트 신분증을 발급하세요.':'버튼을 누르면 가상 발급기관이 테스트 신분증을 발급합니다. 오른쪽에 카드가 나타납니다.',
  !prepared?'신분증 서명을 확인할 발급기관 공개키를 받습니다. 그다음 이 화면을 오프라인용으로 저장합니다.':'아래 화면 오프라인 준비를 누르세요. 이미 저장한 화면은 다시 저장하지 않아도 됩니다.',
  '이제 준비가 끝났습니다. 연결 장애를 모의한 뒤, 서버 없이 요청·동의·서명 검증을 해봅니다.',
  '검증자 역할입니다. 이번 방문자 접수에만 사용할 일회성 요청을 만듭니다.',
  '이용자 역할입니다. 목적과 제공 정보를 읽고 동의한 뒤 서명 응답을 만드세요.',
  '검증자 역할입니다. 이용자의 서명과 요청 일치 여부를 이 브라우저에서 검사합니다.',
  p.offline?'오프라인 접수 기록이 이 기기에 저장됐습니다. 먼저 연결을 복구하고 서버 저장을 진행하세요.':'연결이 복구됐습니다. 최신 정지 상태를 확인하고 접수 기록을 로컬 서버에 저장하세요.',
  '발급부터 복구 후 서버 저장까지 마쳤습니다. 다시 하려면 화면 상단의 주황색 처음부터 다시 시작을 누르세요.'
 ][current];
 return <section className="practice-flow" data-testid="practice-flow" aria-label="한 화면 순서 연습">
  <div className="practice-intro"><span className="eyebrow">ONE SCREEN / STEP BY STEP</span><h2>메뉴 이동 없이, 이 화면에서 끝까지</h2><p>아래 순서대로 버튼만 누르세요. 이용자와 검증자 역할은 단계에 맞춰 바뀝니다.</p></div>
  <ol className="practice-track" aria-label="전체 연습 순서">{titles.map((title,i)=><li key={title} aria-current={active&&current===i?'step':undefined} data-complete={active&&i<current}><span>{active&&i<current?'✓':i+1}</span><strong>{title}</strong><small>{!active?'진행 순서':i<current?'완료':i===current?'지금 할 일':'다음'}</small></li>)}</ol>
  {!active?<div className="practice-start"><h3>처음이라면 ‘한 화면 연습’을 시작하세요</h3><p>발급기관·지갑·검증자 메뉴를 따로 찾을 필요가 없습니다. 중간에 멈춰도 같은 브라우저에서 이어갈 수 있습니다.</p><button className="practice-primary" disabled={p.busy} onClick={()=>p.onMode('single')}>한 화면 연습 시작 →</button><details><summary>두 기기로 QR 교환하기</summary><p>실제 두 기기 시연은 각 기기에서 역할을 선택합니다.</p><div className="actions"><button className="secondary" disabled={p.busy} onClick={()=>{p.onMode('holder');p.navigate(5)}}>이용자로 시작</button><button className="secondary" disabled={p.busy} onClick={()=>{p.onMode('verifier');p.navigate(5)}}>검증자로 시작</button></div></details></div>:<div className="practice-workspace">
   <article className="practice-step" data-testid="practice-step"><div className="practice-step-heading"><span className="practice-number">{current===7?'✓':current+1}</span><div><span className="practice-role">지금 역할 · {role}</span><h3>{current===7?'이번 연습을 완료했어요':`${current+1} / 7 · ${titles[current]}`}</h3></div></div><p className="practice-instruction" data-testid="practice-instruction">{instruction}</p>
   {current===0&&<><button className="practice-primary" disabled={p.busy||p.offline} onClick={p.issue}>테스트 신분증 발급</button>{p.offline&&<div className="warning">새 발급은 온라인에서만 가능합니다.<button className="secondary" disabled={p.busy} onClick={()=>p.setOffline(false)}>온라인으로 전환</button><p>실제 인터넷도 끊겼다면 네트워크를 먼저 연결하세요.</p></div>}</>}
   {current===1&&(!prepared?<><button className="practice-primary" disabled={p.busy||p.offline} onClick={p.prepare}>검증 준비하기 · 공개키 받기</button>{p.offline&&<button className="secondary" disabled={p.busy} onClick={()=>p.setOffline(false)}>온라인으로 전환</button>}</>:<OfflineReady onReady={p.onCached}/>)}
   {current===2&&<><button className="practice-primary" disabled={p.busy} onClick={()=>p.setOffline(true)}>장애 체험 시작 · 연결 차단 모의</button><p className="muted">앱의 API 호출을 막는 시뮬레이션입니다. PC의 실제 인터넷은 끊지 않습니다.</p></>}
   {current===3&&<button className="practice-primary" disabled={p.busy} onClick={p.request}>새 검증 요청 만들기</button>}
   {current===4&&<><div className="practice-purpose"><strong>가상 시설 · 방문자 접수</strong><p>제공 정보: 테스트 이름 · 식별자 · 기기 공개키<br/>요청: {p.nonce.slice(0,8)}… · 이번 요청에만 서명합니다.</p></div><label className="practice-consent"><input type="checkbox" checked={p.consent} onChange={e=>p.onConsent(e.target.checked)}/> 위 목적의 테스트 정보 제공에 동의합니다.</label><button className="practice-primary" disabled={p.busy||!p.consent} onClick={p.respond}>동의하고 서명 응답 만들기</button></>}
   {current===5&&<><button className="practice-primary" disabled={p.busy} onClick={p.verify}>오프라인 서명 검증하기</button><p className="muted">이 버튼은 서버 API를 호출하지 않습니다. 최신 분실·정지 상태와 출입 승인은 별도입니다.</p></>}
   {current===6&&<><div className="practice-success">✓ 오프라인 접수 완료 · 서버 저장 대기 {pending}건</div><button className="practice-primary" disabled={p.busy} onClick={p.offline?()=>p.setOffline(false):p.recover}>{p.offline?'연결 복구하기 · 온라인 전환':'상태 확인하고 기록 저장하기'}</button><p className="muted">실제 인터넷을 끊었다면 먼저 네트워크를 다시 연결하세요.</p></>}
   {current===7&&<><div className="practice-success">✓ 이번 연습 접수 기록 {p.records.length}건 · 서버 저장 확인</div>{p.records.map(r=><div className="check" key={r.id}><span>복구 후 최종 판정</span><b>{r.result}</b></div>)}<button className="secondary" onClick={()=>p.navigate(4)}>전체 접수 기록 보기</button></>}
   {(current===5||current===6||current===7)&&p.checks.length>0&&<details className="practice-checks" open={p.checks.some(c=>!c.ok)}><summary>{p.checks.every(c=>c.ok)?'✓ 서명 검증 항목 모두 확인 · 자세히 보기':'검증 실패 항목 확인'}</summary>{p.checks.map(c=><div className="check" key={c.label}><span>{c.label}</span><b className={c.ok?'pass':'fail'}>{c.ok?'확인':'실패'}</b></div>)}</details>}
   </article><article className="practice-wallet"><h3>내 테스트 신분증</h3>{p.credential?<IdentityCard credential={p.credential} status={p.status} onIssue={p.issue}/>:<div className="practice-empty"><span>◈</span><strong>1단계에서 발급하면<br/>여기에 카드가 표시돼요</strong><p>실제 개인정보를 입력하지 않습니다.</p></div>}<div className="practice-storage-state"><span>화면 저장 <b>{p.cached?'완료 · 다시 연습해도 유지':'준비 전'}</b></span><span>현재 연결 <b>{p.offline?'차단 모의 / 오프라인':'온라인'}</b></span></div></article>
  </div>}
  {p.preservedPending>0&&<p className="preserved-records">이전 연습의 미동기화 기록 {p.preservedPending}건을 보존 중입니다. 새 연습에는 영향을 주지 않으며 연결 복구 후 함께 저장합니다.</p>}
  <p className="restart-note">상단의 <strong>↺ 처음부터 다시 시작</strong>은 현재 신분증·준비 정보·요청·동의·결과를 초기화합니다. 접수 기록과 저장된 화면, 재사용 차단 이력은 남깁니다.</p>
  {(!active||current!==1||!prepared)&&<details className="practice-storage"><summary>오프라인 화면 저장 설정</summary><OfflineReady onReady={p.onCached}/></details>}
  <details className="practice-details"><summary>역할별 화면과 추가 실험 · 사용 범위</summary><p>공모전용 가상 신분증 PoC이며 공식 앱과 연동하지 않습니다. 왼쪽 메뉴는 각 역할을 따로 보거나 변조·만료 등 추가 조건을 시험할 때 사용합니다. 기본 연습은 위 버튼만으로 끝납니다. 준비 정보는 최대 15분 시험값이며, 저장소 삭제나 기기 변경 시 복원되지 않습니다. 기기 키는 브라우저 IndexedDB에 저장되며 운영용 하드웨어 키 보관 수준이 아닙니다.</p><button className="secondary" onClick={()=>p.navigate(5)}>두 기기 QR 인증 화면</button></details>
 </section>;
}
