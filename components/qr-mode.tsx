'use client';
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import QrScanner from 'qr-scanner';
import { acceptReceipt, readState, verifierId, writeState, type DeviceKeys } from '../lib/offline-store';
import { checkQr, encodeQr, makeRequest, parseQr, receiptToken, requestCurrent, respondQr, type QrRequest, type QrResponse } from '../lib/qr-proof';
import type { Check, CredentialPayload, DemoRecord, Signed, Trust } from '../lib/proof';

function QrDisplay({ text, label }: { text: string; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState(''), [rendered, setRendered] = useState(''), [copied, setCopied] = useState('');
  useEffect(() => {
    let active = true;
    const modules=QRCode.create(text,{errorCorrectionLevel:'M'}).modules.size+8;
    // Render whole pixels per QR module, including at responsive sizes. Scaling
    // the old 520px bitmap to an arbitrary width damaged dense response QRs.
    const fit=()=>{if(!canvas.current||!container.current)return;const size=modules*Math.max(1,Math.min(4,Math.floor(container.current.clientWidth/modules)));canvas.current.style.width=size+'px';canvas.current.style.height=size+'px';};
    const observer=new ResizeObserver(fit);if(container.current)observer.observe(container.current);
    if (canvas.current) QRCode.toCanvas(canvas.current, text, { errorCorrectionLevel: 'M', margin: 4, scale:4 }).then(() => { if(active){fit();setRendered(text);setError('');} }).catch(() => { if (active) setError('QR 생성 실패. 데이터 크기를 확인하세요.'); });
    return () => { active = false;observer.disconnect(); };
  }, [text]);
  function download(){if(!canvas.current||rendered!==text)return;const a=document.createElement('a');a.download=`ansim-${label==='요청 QR'?'request':'response'}-${Date.now()}.png`;a.href=canvas.current.toDataURL('image/png');a.click();}
  async function copy(){setCopied('');try{await navigator.clipboard.writeText(text);setCopied('QR 전체 데이터를 복사했습니다. 상대 기기의 같은 종류 입력칸에 붙여 넣으세요.');}catch{setCopied('자동 복사를 사용할 수 없습니다. 아래 QR 데이터 보기에서 중괄호 { }를 포함한 전체 데이터를 선택해 복사하세요.');}}
  return <div ref={container} className="qr-display"><canvas ref={canvas} aria-label={label} data-testid={label} />{error && <p role="alert">{error}</p>}<div className="actions"><button className="secondary" disabled={rendered!==text} onClick={download}>{label} 이미지 저장</button><button className="secondary" onClick={copy}>{label} 전체 데이터 복사</button></div><p className="qr-transfer-hint">{label==='요청 QR'?'이 이미지는 이용자 기기의 요청 QR 읽기에 넣습니다.':'이 이미지는 검증자 기기의 응답 QR 검증에 넣습니다.'} 신분증 카드 PNG와는 다른 파일입니다.</p>{copied&&<p className="qr-feedback" aria-live="polite">{copied}</p>}<details><summary>QR 데이터 보기 · 보조 전달</summary><p>세션 ID는 조회용입니다. 입력하려면 아래 중괄호 {'{ }'}를 포함한 <strong>전체 데이터</strong>를 복사하세요.</p><textarea aria-label={label + ' 데이터'} readOnly value={text} /></details></div>;
}
function QrInput({ type, onRead, onActivity }: { type: 'ansim-request' | 'ansim-response'; onRead: (text: string) => Promise<void>; onActivity:(busy:boolean)=>void }) {
  const video = useRef<HTMLVideoElement>(null), scanner = useRef<QrScanner | null>(null), handling = useRef(false), lastFile=useRef<File|null>(null);
  const mounted = useRef(true);
  const [text, setText] = useState(''), [error, setError] = useState(''), [running, setRunning] = useState(false), [reading,setReading]=useState(false), [fileName,setFileName]=useState(''), [feedback,setFeedback]=useState('');
  const kind=type==='ansim-request'?'요청':'응답';
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; scanner.current?.destroy(); }; }, []);
  async function read(load:()=>Promise<string>) {
    if (handling.current) return;
    handling.current = true;setReading(true);onActivity(true);setError('');setFeedback('QR을 읽고 검사하는 중입니다…');
    try { const value=await load();if(!mounted.current)return;await onRead(value);if(!mounted.current)return;scanner.current?.stop();setRunning(false);setFeedback(type==='ansim-request'?'요청 QR 읽기 완료. 아래에서 목적 확인 → 동의 → 응답 QR 생성을 진행하세요.':'응답 QR 검증 성공. 접수 기록을 이 기기에 저장했습니다.'); }
    catch (e) { if(mounted.current){setError(e instanceof Error ? e.message : 'QR 처리 실패. 다시 스캔하세요.');setFeedback('');} }
    finally { handling.current = false;if(mounted.current)setReading(false);onActivity(false); }
  }
  async function photo(file:File){lastFile.current=file;setFileName(file.name);await read(async()=>{if(file.size>5_000_000)throw Error('사진은 5MB 이하로 준비하세요.');try{return(await QrScanner.scanImage(file,{returnDetailedScanResult:true})).data;}catch{throw Error('사진에서 QR을 찾지 못했습니다. 신분증 카드 이미지가 아닌 요청·응답 QR 이미지인지, QR 전체와 여백이 포함됐는지 확인하세요. PNG/JPG 파일로 다시 시도할 수 있습니다.');}});}
  async function start() {
    try {
      if (!isSecureContext || !navigator.mediaDevices?.getUserMedia) throw Error('카메라는 신뢰된 HTTPS가 필요합니다. 다른 기기의 localhost는 이 서버를 가리키지 않습니다.');
      if (!video.current) return;
      scanner.current?.destroy();
      scanner.current = new QrScanner(video.current, result => { void read(async()=>result.data); }, { returnDetailedScanResult: true, preferredCamera: 'environment', maxScansPerSecond: 3 });
      const current = scanner.current;
      await current.start();
      if (!mounted.current || scanner.current !== current) { current.destroy(); return; }
      setRunning(true); setError('');
    } catch (e) {
      scanner.current?.destroy(); scanner.current = null; setRunning(false);
      setError(`카메라를 열지 못했습니다. 권한·사용 중인 앱·HTTPS 인증서를 확인하세요. ${e instanceof Error ? e.message : ''} 사진 파일 또는 보조 데이터로 재시도할 수 있습니다.`);
    }
  }
  return <div className="qr-input"><p className="qr-expected"><strong>여기는 {kind} QR만 읽는 곳입니다.</strong><br/>{type==='ansim-request'?'이용자 기기: 검증자가 만든 요청 QR을 넣으세요.':'검증자 기기: 이용자가 승인 후 만든 응답 QR을 넣으세요. 검증자가 만든 요청 QR은 여기에 넣지 않습니다.'}</p><div className="actions"><button disabled={reading} onClick={start}>카메라로 {kind} QR 스캔</button>{running && <button className="secondary" onClick={() => { scanner.current?.stop(); setRunning(false); }}>카메라 중지</button>}</div><video ref={video} muted playsInline className={running ? 'scanner-video' : 'scanner-video hidden'} /><label>QR 사진 파일 읽기 · {kind} QR<input aria-label={type + ' 사진'} type="file" accept="image/*" disabled={reading} onClick={e=>{e.currentTarget.value='';}} onChange={e=>{const f=e.currentTarget.files?.[0];if(f)void photo(f);}} /></label>{fileName&&<div><p className="qr-file-name" data-testid={type+'-file-name'}>선택한 사진: {fileName}</p><button className="secondary" disabled={reading} onClick={()=>{if(lastFile.current)void photo(lastFile.current);}}>선택한 사진 다시 읽기</button></div>}<details><summary>카메라 없이 QR 데이터 입력 · 검사/보조용</summary><p>상대 기기의 <strong>{kind} QR 전체 데이터 복사</strong>로 복사한 {'{ }'} 전체를 붙여 넣으세요. 세션 ID만으로는 인증할 수 없습니다.</p><textarea aria-label={type + ' 입력'} placeholder={'{ 로 시작하는 '+kind+' QR 전체 데이터'} value={text} maxLength={1600} disabled={reading} onChange={e => setText(e.target.value)} /><button className="secondary" disabled={reading} onClick={() => read(async()=>text)}>데이터 읽기</button></details>{feedback&&<p className="qr-feedback" data-testid={type+'-feedback'} aria-live="polite">{feedback}</p>}{error && <p role="alert">{error}</p>}</div>;
}
export function QrMode({ credential, device, trust, onRecord, onChecks, initialRole='verifier', onRoleChange, onBusyChange }: { onBusyChange?:(busy:boolean)=>void; initialRole?:'holder'|'verifier';onRoleChange?:(role:'holder'|'verifier')=>void; credential: Signed<CredentialPayload> | null; device: DeviceKeys | null; trust: Trust | null; onRecord: (r: DemoRecord) => void; onChecks: (checks: Check[]) => void }) {
  const [role, setRole] = useState<'verifier' | 'holder'>(initialRole), [request, setRequest] = useState<QrRequest | null>(null), [incoming, setIncoming] = useState<QrRequest | null>(null), [response, setResponse] = useState<QrResponse | null>(null), [consent, setConsent] = useState(false), [checks, setChecks] = useState<Check[]>([]), [message, setMessage] = useState('각 기기에서 역할을 선택하세요. 이용자는 발급, 검증자는 신뢰키 준비가 필요합니다.'), [busy, setBusy] = useState(false);
  const processing = useRef(false), inputReading = useRef(false);
  const [inputBusy,setInputBusy]=useState(false);
  function inputActivity(active:boolean){inputReading.current=active;setInputBusy(active);onBusyChange?.(active||processing.current);}
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { let live = true; Promise.all([readState<QrRequest>('qr-request'), readState<QrRequest>('holder-request'), readState<QrResponse>('qr-response')]).then(([r, i, s]) => { if (live) { if(r)setRequest(parseQr(encodeQr(r),'ansim-request')); if(i)setIncoming(parseQr(encodeQr(i),'ansim-request')); if(s)setResponse(parseQr(encodeQr(s),'ansim-response')); } }).catch(() => { if(live)setMessage('저장된 QR 세션을 복원하지 못했습니다. 새 요청을 생성/스캔하세요.'); }).finally(() => { if(live)setHydrated(true); }); return () => { live = false; }; }, []);
  async function run(fn: () => Promise<void>, propagate=false) {
    if (processing.current) {if(propagate)throw Error('다른 QR을 처리 중입니다. 잠시 후 다시 시도하세요.');return;}
    processing.current = true; setBusy(true); onBusyChange?.(true);
    try { await fn(); } catch(e) { setMessage(e instanceof Error ? e.message : 'QR 처리 실패');if(propagate)throw e; }
    finally { processing.current = false; setBusy(false); onBusyChange?.(inputReading.current); }
  }
  async function create() {
    if (!trust) throw Error('온라인에서 검증자 신뢰키를 먼저 준비하세요.');
    const value = makeRequest(await verifierId());
    await writeState('qr-request', value); setRequest(value); setChecks([]); onChecks([]); setMessage('요청 QR 생성 완료. 2분 안에 이용자 기기로 스캔하세요.');
  }
  async function receiveRequest(text: string) {
    const value = parseQr(text, 'ansim-request');
    if (!requestCurrent(value)) throw Error('만료된 요청입니다. 검증자에게 새 QR을 요청하세요.');
    await writeState('holder-request', value); await writeState('qr-response',null); setIncoming(value); setConsent(false); setResponse(null); setMessage('요청을 읽었습니다. 목적·검증자·세션을 확인하고 승인하세요.');
  }
  async function respond() {
    if (!incoming || !credential || !device || !consent) throw Error('발급된 신분증·요청 스캔·동의가 필요합니다.');
    const value = await respondQr(incoming, credential, device);
    await writeState('qr-response', value); setResponse(value); setMessage('응답 QR 생성 완료. 개인키는 포함하지 않습니다. 검증자 기기로 스캔하세요.');
  }
  async function receiveResponse(text: string) {
    if (!request || !trust) throw Error('이 검증자 기기의 준비 정보와 원래 요청이 필요합니다.');
    const value = parseQr(text, 'ansim-response');
    const result = await checkQr(request, value, trust);
    setChecks(result); onChecks(result);
    if (!result.every(c => c.ok)) { throw Error('QR 검증 차단. 만료·변조·다른 세션 여부를 확인하세요.'); }
    const r: DemoRecord = { id: crypto.randomUUID(), credential: value.credential.payload.id, result: '제한 접수 완료', created: Date.now(), synced: false };
    try { await acceptReceipt(receiptToken(request), r); }
    catch(e) { const blocked=[...result, { label:'기기 내 영구 재사용 차단', ok:false }]; setChecks(blocked); onChecks(blocked); throw e; }
    onRecord(r); setMessage('QR 오프라인 검증 성공. 기기에 접수 기록을 저장했습니다. 최신 정지 상태는 복구 후 확인하세요.');
  }
  if (!hydrated) return <article><p>이 기기의 QR 세션 저장소를 확인합니다…</p></article>;
  return <><article><h3>두 기기 QR 인증 · 프로토콜 v1</h3><div className="actions"><button className={role === 'verifier' ? '' : 'secondary'} disabled={busy||inputBusy} onClick={() => {setRole('verifier');onRoleChange?.('verifier')}}>이 기기는 검증자</button><button className={role === 'holder' ? '' : 'secondary'} disabled={busy||inputBusy} onClick={() => {setRole('holder');onRoleChange?.('holder')}}>이 기기는 이용자</button></div><div className="qr-route"><span>① 검증자: 요청 QR 생성</span><span>② 이용자: 요청 QR 읽기</span><span>③ 이용자: 응답 QR 생성</span><span>④ 검증자: 응답 QR 읽기</span></div><p>검증자는 자신이 만든 요청 QR을 스캔하지 않습니다. 요청 QR은 이용자에게 전달하고, 이용자가 만든 응답 QR을 받아 검증하세요.</p><p>각 기기는 같은 발급기관 서버에서 온라인 최초 준비 후, 네트워크 없이 QR만 교환합니다. 요청자 표시는 자체 생성 식별자이며 기관 신원 인증이 아닙니다.</p><p role="status" data-testid="qr-status">{message}</p></article>{role === 'verifier' ? <div className="twocol qr-columns"><article><h3>1 · 검증자 요청 QR</h3><button disabled={busy || inputBusy || !trust} onClick={() => run(create)}>새 요청 QR 생성</button>{request && <><p>세션 ID (조회용 · 입력용 아님): {request.sessionId}<br/>목적: 방문자 접수 · 만료 {new Date(request.expiresAt).toLocaleTimeString('ko-KR')}</p><QrDisplay text={encodeQr(request)} label="요청 QR" /></>}</article><article><h3>4 · 이용자 응답 QR 검증</h3><QrInput key={request?.sessionId??'new-request'} onActivity={inputActivity} type="ansim-response" onRead={async text => { await run(() => receiveResponse(text),true); }} />{checks.map(c => <div className="check" key={c.label}><span>{c.label}</span><b className={c.ok ? 'pass' : 'fail'}>{c.ok ? '확인' : '실패'}</b></div>)}</article></div> : <div className="twocol qr-columns"><article><h3>2 · 검증자 요청 QR 읽기</h3><QrInput onActivity={inputActivity} type="ansim-request" onRead={async text => { await run(() => receiveRequest(text),true); }} />{incoming && <><p>검증자 {incoming.verifierId}<br/>세션 {incoming.sessionId}<br/>목적: 방문자 접수<br/>만료 {new Date(incoming.expiresAt).toLocaleTimeString('ko-KR')}</p><label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> 이 요청의 테스트 정보 제공 및 서명에 동의합니다.</label><button disabled={busy || inputBusy || !consent || !device || !credential} onClick={() => run(respond)}>승인하고 응답 QR 생성</button></>}</article><article><h3>3 · 이용자 응답 QR</h3>{response ? <QrDisplay text={encodeQr(response)} label="응답 QR" /> : <p>요청 확인과 승인 후 표시됩니다.</p>}<p>가상 이름·식별자·공개키·서명만 전송합니다. 카메라 접근 실패 시 사진 파일 읽기를 사용할 수 있습니다. 실제 생체인증은 아닙니다.</p></article></div>}</>;
}
