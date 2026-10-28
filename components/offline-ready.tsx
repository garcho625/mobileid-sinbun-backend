'use client';
import { useEffect, useState } from 'react';
import { shellReady } from '../lib/shell-ready';

export function OfflineReady({onReady}: {onReady?:(ready:boolean)=>void}) {
  const [status, setStatus] = useState('화면 오프라인 준비 전 · 빌드 서버에서 온라인 최초 준비가 필요합니다.');
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    let active = true;
    void shellReady().then(ready => {
      if (!active || !ready) return;
      setStatus('화면 오프라인 준비 완료 · 저장된 화면을 확인했습니다. 다시 연습해도 유지됩니다. 화면 저장과 신분증·검증자 준비는 별도입니다.');
      onReady?.(true);
    }).catch(() => {});
    return () => { active = false; };
  }, [onReady]);
  async function prepare() {
    setBusy(true);
    try {
      if (!isSecureContext || !('serviceWorker' in navigator)) throw Error('Service Worker는 HTTPS 또는 이 PC의 localhost에서 지원되는 브라우저가 필요합니다.');
      const manifest = await fetch('/offline-assets.json', { cache: 'no-store' });
      if (!manifest.ok || !manifest.headers.get('content-type')?.includes('json')) throw Error('build 후 start에서 화면을 준비하세요. 개발 서버는 오프라인 화면을 지원하지 않습니다.');
      const expected = await manifest.json() as { version: string; assets: string[] };
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
      await registration.update();
      const ready = await Promise.race([navigator.serviceWorker.ready, new Promise<never>((_, reject) => setTimeout(() => reject(Error('캐시 설치 시간 초과. 온라인 연결과 저장 공간을 확인하세요.')), 30000))]);
      if (!ready.active) throw Error('오프라인 화면 설치를 확인하지 못했습니다.');
      const deadline = Date.now() + 30000;
      while (true) {
        const cache = await caches.open('ansim-shell-' + expected.version);
        const saved = new Set((await cache.keys()).map(r => new URL(r.url).pathname));
        if (expected.assets.every(p => saved.has(p))) break;
        if (Date.now() > deadline) throw Error('새 버전 화면의 캐시가 완전하지 않습니다. 온라인 상태에서 다시 준비하세요.');
        await new Promise(resolve => setTimeout(resolve, 150));
      }
      onReady?.(true);
      const persistent = await navigator.storage?.persist?.().catch(() => false);
      setStatus(`화면 오프라인 준비 완료 · 이 주소를 다시 여세요. 기기 데이터는 발급/검증자 준비 때 별도 저장됩니다. 저장소 유지 요청: ${persistent ? '허용' : '브라우저 재량'}`);
    } catch (e) { onReady?.(false);setStatus(e instanceof Error ? e.message : '오프라인 준비 실패'); }
    finally { setBusy(false); }
  }
  return <article className="offline-ready"><h3>오프라인 화면 · 기기 저장</h3><p>Cache Storage는 화면만, IndexedDB는 테스트 신분증·CryptoKey·신뢰키·기록을 보관합니다. 최초 발급/준비는 온라인에서 완료하세요.</p><button id="offline-prepare-button" disabled={busy} onClick={prepare}>화면 오프라인 준비</button><p data-testid="offline-status" aria-live="polite">{status}</p><small>같은 브라우저·같은 주소에서 복원합니다. 저장소 삭제/시크릿 모드/기기 분실 시 복원 불가 · 하드웨어 키 보관 아님 · 재실행 시 만료/15분 정책을 다시 검사합니다.</small></article>;
}
