import { sign, verify, type CredentialPayload, type DemoRecord, type Signed, type Trust } from './proof.ts';

export type DeviceKeys = { privateKey: CryptoKey; publicKey: JsonWebKey };
export type Wallet = { device: DeviceKeys; credential: Signed<CredentialPayload> };
export const OFFLINE_POLICY = { version: 1, preparedMaxAgeMs: 900000, requestMaxAgeMs: 120000 } as const;
const DATABASE = 'ansim-offline-v1';
let opening: Promise<IDBDatabase> | undefined;
function database() {
  if (!globalThis.indexedDB) return Promise.reject(Error('IndexedDB를 사용할 수 없습니다. 브라우저 저장 설정을 확인하세요.'));
  opening ??= new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore('state');
      request.result.createObjectStore('records', { keyPath: 'id' });
      request.result.createObjectStore('used');
    };
    request.onsuccess = () => { request.result.onversionchange = () => { request.result.close(); opening = undefined; }; resolve(request.result); };
    request.onerror = () => { opening = undefined; reject(request.error); };
    request.onblocked = () => reject(Error('다른 탭을 닫고 저장소 준비를 재시도하세요.'));
  });
  return opening;
}
export async function readState<T>(key: string): Promise<T | undefined> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const r = db.transaction('state').objectStore('state').get(key);
    r.onsuccess = () => resolve(r.result as T | undefined);
    r.onerror = () => reject(r.error);
  });
}
export async function writeState(key: string, value: unknown) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('state', 'readwrite');
    tx.objectStore('state').put(value, key);
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error ?? Error('기기 저장 실패. 저장 공간과 브라우저 설정을 확인하세요.'));
  });
}
export async function deviceKeys(): Promise<DeviceKeys> {
  if (!globalThis.crypto?.subtle) throw Error('기기 키는 HTTPS 또는 이 PC의 localhost에서만 준비할 수 있습니다.');
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign', 'verify']);
  return { privateKey: pair.privateKey, publicKey: await crypto.subtle.exportKey('jwk', pair.publicKey) };
}
export async function validateWallet(wallet: Wallet) {
  if (!(wallet?.device?.privateKey instanceof CryptoKey) || wallet.device.privateKey.extractable || wallet.device.privateKey.type !== 'private') throw Error('저장된 기기 키를 복원할 수 없습니다. 온라인에서 재발급하세요.');
  const proof = await sign({ probe: crypto.randomUUID() }, wallet.device.privateKey);
  if (!await verify(proof, wallet.credential.payload.deviceKey)) throw Error('저장된 신분증과 기기 키가 맞지 않습니다. 온라인 재발급이 필요합니다.');
}
export async function saveWallet(wallet: Wallet) {
  try { await writeState('wallet', wallet); }
  catch { throw Error('이 브라우저에서 기기 CryptoKey 저장에 실패했습니다. 일반 모드 Chrome/Edge와 저장 공간을 확인하고 재발급하세요.'); }
  const restored = await readState<Wallet>('wallet');
  if (!restored) throw Error('이 브라우저에서 CryptoKey 저장을 확인하지 못했습니다.');
  await validateWallet(restored);
}
export async function saveTrust(trust: Trust) { await writeState('trust', { trust, policy: OFFLINE_POLICY }); }
export async function readTrust() {
  const stored = await readState<{ trust: Trust; policy: typeof OFFLINE_POLICY }>('trust');
  if (stored && JSON.stringify(stored.policy) !== JSON.stringify(OFFLINE_POLICY)) throw Error('저장된 정책 버전이 다릅니다. 온라인 준비를 다시 실행하세요.');
  return stored?.trust;
}
export async function getRecords(): Promise<DemoRecord[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const r = db.transaction('records').objectStore('records').getAll();
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
export async function saveRecords(records: DemoRecord[]) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction('records', 'readwrite');
    records.forEach(r => tx.objectStore('records').put(r));
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(tx.error);
  });
}
// Consumption and pending receipt are one durable transaction, shared by tabs.
export async function acceptReceipt(token: string, record: DemoRecord) {
  const db = await database();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(['used', 'records'], 'readwrite');
    let replay = false;
    const r = tx.objectStore('used').get(token);
    r.onsuccess = () => {
      if (r.result) { replay = true; tx.abort(); return; }
      tx.objectStore('used').put({ created: Date.now() }, token);
      tx.objectStore('records').add(record);
    };
    tx.oncomplete = () => resolve();
    tx.onabort = tx.onerror = () => reject(replay ? Error('이미 사용한 요청입니다. 재사용을 차단했습니다.') : tx.error ?? Error('기록 저장 실패. 접수를 완료하지 않았습니다.'));
  });
}
export async function verifierId() {
  const db = await database();
  return new Promise<string>((resolve, reject) => {
    const tx = db.transaction('state', 'readwrite'), store = tx.objectStore('state');
    let value: string;
    const r = store.get('verifier-id');
    r.onsuccess = () => { value = r.result || crypto.randomUUID(); store.put(value, 'verifier-id'); };
    tx.oncomplete = () => resolve(value);
    tx.onabort = tx.onerror = () => reject(tx.error);
  });
}

// Reset this device's current practice only. Keep receipts, replay protection,
// verifier identity and the app shell; never delete the database or server data.
export async function resetPractice(): Promise<string[]> {
  const db = await database();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(['state', 'records'], 'readwrite');
    const state = tx.objectStore('state');
    for (const key of ['wallet','trust','legacy-interaction','qr-request','holder-request','qr-response','guide-mode','guide-receipt']) state.delete(key);
    let history: string[] = [];
    const request = tx.objectStore('records').getAllKeys();
    request.onsuccess = () => {
      history = request.result.map(String);
      state.put(history, 'guide-history-ids');
    };
    tx.oncomplete = () => resolve(history);
    tx.onabort = tx.onerror = () => reject(tx.error ?? Error('초기화하지 못했습니다. 기존 기록은 유지됩니다.'));
  });
}
