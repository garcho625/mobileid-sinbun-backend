'use client';
import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import QrScanner from 'qr-scanner';
import { acceptReceipt, readState, verifierId, writeState, type DeviceKeys } from '../lib/offline-store';
import { checkQr, encodeQr, makeRequest, parseQr, receiptToken, requestCurrent, respondQr, type QrRequest, type QrResponse } from '../lib/qr-proof';
import type { Check, CredentialPayload, DemoRecord, Signed, Trust } from '../lib/proof';

function QrDisplay({ text, label }: { text: string; label: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    if (canvas.current) QRCode.toCanvas(canvas.current, text, { errorCorrectionLevel: 'M', margin: 4, width: 520 }).catch(() => { if (active) setError('QR 생성 실패. 데이터 크기를 확인하세요.'); });
    return () => { active = false; };
  }, [text]);
  return <div className="qr-display"><canvas ref={canvas} aria-label={label} data-testid={label} />{error && <p role="alert">{error}</p>}<details><summary>QR 데이터 보기 · 보조 전달</summary><textarea aria-label={label + ' 데이터'} readOnly value={text} /></details></div>;
}
function QrInput({ type, onRead }: { type: 'ansim-request' | 'ansim-response'; onRead: (text: string) => Promise<void> }) {
  const video = useRef<HTMLVideoElement>(null), scanner = useRef<QrScanner | null>(null), handling = useRef(false);
  const mounted = useRef(true);
  const [text, setText] = useState(''), [error, setError] = useState(''), [running, setRunning] = useState(false);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; scanner.current?.destroy(); }; }, []);
  async function read(value: string) {
    if (handling.current) return;
    handling.current = true;
    try { await onRead(value); scanner.current?.stop(); setRunning(false); setError(''); }
    catch (e) { setError(e instanceof Error ? e.message : 'QR 처리 실패. 다시 스캔하세요.'); }
    finally { handling.current = false; }
  }
  async function start() {
    try {
      if (!isSecureContext || !navigator.mediaDevices?.getUserMedia) throw Error('카메라는 신뢰된 HTTPS가 필요합니다. 다른 기기의 localhost는 이 서버를 가리키지 않습니다.');
      if (!video.current) return;
      scanner.current?.destroy();
      scanner.current = new QrScanner(video.current, result => { void read(result.data); }, { returnDetailedScanResult: true, preferredCamera: 'environment', maxScansPerSecond: 3 });
      const current = scanner.current;
      await current.start();
      if (!mounted.current || scanner.current !== current) { current.destroy(); return; }
      setRunning(true); setError('');
    } catch (e) {
      scanner.current?.destroy(); scanner.current = null; setRunning(false);
      setError(`카메라를 열지 못했습니다. 권한·사용 중인 앱·HTTPS 인증서를 확인하세요. ${e instanceof Error ? e.message : ''} 사진 파일 또는 보조 데이터로 재시도할 수 있습니다.`);
    }
  }
  return <div className="qr-input"><div className="actions"><button onClick={start}>카메라로 {type === 'ansim-request' ? '요청' : '응답'} QR 스캔</button>{running && <button className="secondary" onClick={() => { scanner.current?.stop(); setRunning(false); }}>카메라 중지</button>}</div><video ref={video} muted playsInline className={running ? 'scanner-video' : 'scanner-video hidden'} /><label>QR 사진 파일 읽기<input aria-label={type + ' 사진'} type="file" accept="image/*" onChange={async e => { const f = e.target.files?.[0]; if (!f) return; try { if (f.size > 5_000_000) throw Error('사진은 5MB 이하로 준비하세요.'); const result = await QrScanner.scanImage(f, { returnDetailedScanResult: true }); await read(result.data); } catch { setError('사진에서 QR을 읽지 못했습니다. 밝기·초점·전체 QR 포함 여부를 확인하세요.'); } e.target.value = ''; }} /></label><details><summary>카메라 없이 QR 데이터 입력 · 검사/보조용</summary><textarea aria-label={type + ' 입력'} value={text} maxLength={1600} onChange={e => setText(e.target.value)} /><button className="secondary" onClick={() => read(text)}>데이터 읽기</button></details>{error && <p role="alert">{error}</p>}</div>;
}
export function QrMode({ credential, device, trust, onRecord, onChecks }: { credential: Signed<CredentialPayload> | null; device: DeviceKeys | null; trust: Trust | null; onRecord: (r: DemoRecord) => void; onChecks: (checks: Check[]) => void }) {
  const [role, setRole] = useState<'verifier' | 'holder'>('verifier'), [request, setRequest] = useState<QrRequest | null>(null), [incoming, setIncoming] = useState<QrRequest | null>(null), [response, setResponse] = useState<QrResponse | null>(null), [consent, setConsent] = useState(false), [checks, setChecks] = useState<Check[]>([]), [message, setMessage] = useState('각 기기에서 역할을 선택하세요. 이용자는 발급, 검증자는 신뢰키 준비가 필요합니다.'), [busy, setBusy] = useState(false);
  const processing = useRef(false);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => { let live = true; Promise.all([readState<QrRequest>('qr-request'), readState<QrRequest>('holder-request'), readState<QrResponse>('qr-response')]).then(([r, i, s]) => { if (live) { if(r)setRequest(parseQr(encodeQr(r),'ansim-request')); if(i)setIncoming(parseQr(encodeQr(i),'ansim-request')); if(s)setResponse(parseQr(encodeQr(s),'ansim-response')); } }).catch(() => { if(live)setMessage('저장된 QR 세션을 복원하지 못했습니다. 새 요청을 생성/스캔하세요.'); }).finally(() => { if(live)setHydrated(true); }); return () => { live = false; }; }, []);
  async function run(fn: () => Promise<void>) {
    if (processing.current) return;
    processing.current = true; setBusy(true);
    try { await fn(); } catch(e) { setMessage(e instanceof Error ? e.message : 'QR 처리 실패'); }
    finally { processing.current = false; setBusy(false); }
  }
  async function create() {
    if (!trust) throw Error('온라인에서 검증자 신뢰키를 먼저 준비하세요.');
    const value = makeRequest(await verifierId());
    await writeState('qr-request', value); setRequest(value); setChecks([]); onChecks([]); setMessage('요청 QR 생성 완료. 2분 안에 이용자 기기로 스캔하세요.');
  }
  async function receiveRequest(text: string) {
    const value = parseQr(text, 'ansim-request');
    if (!requestCurrent(value)) throw Error('만료된 요청입니다. 검증자에게 새 QR을 요청하세요.');
    await writeState('holder-request', value); setIncoming(value); setConsent(false); setResponse(null); setMessage('요청을 읽었습니다. 목적·검증자·세션을 확인하고 승인하세요.');
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
    if (!result.every(c => c.ok)) { setMessage('QR 검증 차단. 만료·변조·다른 세션 여부를 확인하세요.'); return; }
    const r: DemoRecord = { id: crypto.randomUUID(), credential: value.credential.payload.id, result: '제한 접수 완료', created: Date.now(), synced: false };
    try { await acceptReceipt(receiptToken(request), r); }
    catch(e) { const blocked=[...result, { label:'기기 내 영구 재사용 차단', ok:false }]; setChecks(blocked); onChecks(blocked); throw e; }
    onRecord(r); setMessage('QR 오프라인 검증 성공. 기기에 접수 기록을 저장했습니다. 최신 정지 상태는 복구 후 확인하세요.');
  }
  if (!hydrated) return <article><p>이 기기의 QR 세션 저장소를 확인합니다…</p></article>;
  return <><article><h3>두 기기 QR 인증 · 프로토콜 v1</h3><div className="actions"><button className={role === 'verifier' ? '' : 'secondary'} onClick={() => setRole('verifier')}>이 기기는 검증자</button><button className={role === 'holder' ? '' : 'secondary'} onClick={() => setRole('holder')}>이 기기는 이용자</button></div><p>각 기기는 같은 발급기관 서버에서 온라인 최초 준비 후, 네트워크 없이 QR만 교환합니다. 요청자 표시는 자체 생성 식별자이며 기관 신원 인증이 아닙니다.</p><p role="status" data-testid="qr-status">{message}</p></article>{role === 'verifier' ? <div className="twocol"><article><h3>1 · 검증자 요청 QR</h3><button disabled={busy || !trust} onClick={() => run(create)}>새 요청 QR 생성</button>{request && <><p>세션 {request.sessionId}<br/>목적: 방문자 접수 · 만료 {new Date(request.expiresAt).toLocaleTimeString('ko-KR')}</p><QrDisplay text={encodeQr(request)} label="요청 QR" /></>}</article><article><h3>4 · 이용자 응답 QR 검증</h3><QrInput type="ansim-response" onRead={async text => { await run(() => receiveResponse(text)); }} />{checks.map(c => <div className="check" key={c.label}><span>{c.label}</span><b className={c.ok ? 'pass' : 'fail'}>{c.ok ? '확인' : '실패'}</b></div>)}</article></div> : <div className="twocol"><article><h3>2 · 검증자 요청 QR 읽기</h3><QrInput type="ansim-request" onRead={receiveRequest} />{incoming && <><p>검증자 {incoming.verifierId}<br/>세션 {incoming.sessionId}<br/>목적: 방문자 접수<br/>만료 {new Date(incoming.expiresAt).toLocaleTimeString('ko-KR')}</p><label><input type="checkbox" checked={consent} onChange={e => setConsent(e.target.checked)} /> 이 요청의 테스트 정보 제공 및 서명에 동의합니다.</label><button disabled={busy || !consent || !device || !credential} onClick={() => run(respond)}>승인하고 응답 QR 생성</button></>}</article><article><h3>3 · 이용자 응답 QR</h3>{response ? <QrDisplay text={encodeQr(response)} label="응답 QR" /> : <p>요청 확인과 승인 후 표시됩니다.</p>}<p>가상 이름·식별자·공개키·서명만 전송합니다. 카메라 접근 실패 시 사진 파일 읽기를 사용할 수 있습니다. 실제 생체인증은 아닙니다.</p></article></div>}</>;
}
