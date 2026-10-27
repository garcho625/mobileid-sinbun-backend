import { env } from 'cloudflare:workers';
import { keys, sign, type DemoRecord } from '../../../lib/proof';

type KeyPair = Awaited<ReturnType<typeof keys>>;
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: { 'Cache-Control': 'no-store' } });
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const id = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v) && v !== 'issuer';
async function issuer(db: D1Database): Promise<KeyPair> {
  let r = await db.prepare('SELECT value FROM settings WHERE id=?').bind('issuer').first<{ value: string }>();
  if (!r) {
    await db.prepare('INSERT OR IGNORE INTO settings(id,value) VALUES(?,?)').bind('issuer', JSON.stringify(await keys())).run();
    r = await db.prepare('SELECT value FROM settings WHERE id=?').bind('issuer').first<{ value: string }>();
  }
  if (!r) throw Error('issuer unavailable');
  return JSON.parse(r.value) as KeyPair;
}
const resultFor = (status?: string) => status === 'active' ? '복구 확인 · 상태 일치' : status === 'stopped' ? '상태 불일치 · 담당자 검토' : '상태 미확인 · 담당자 검토';

export async function POST(req: Request) {
  try {
    // Drain the request before returning any response. Vinext/Workers otherwise
    // may continue reading a rejected request after its response has been sent.
    const raw = await req.text();
    const origin = req.headers.get('Origin');
    if (origin && origin !== new URL(req.url).origin) return json({ error: '같은 출처에서 요청하세요.' }, 403);
    if (new TextEncoder().encode(raw).length > 131072) return json({ error: '요청이 너무 큽니다.' }, 413);
    let b: unknown;
    try { b = JSON.parse(raw); } catch { return json({ error: 'JSON 요청이 필요합니다.' }, 400); }
    if (!object(b)) return json({ error: '객체 요청이 필요합니다.' }, 400);
    const db = env.DB;
    if (!db) throw Error('DB binding unavailable');
    if (b.action === 'prepare') {
      const k = await issuer(db);
      return json({ publicKey: k.publicKey, prepared: Date.now() });
    }
    if (b.action === 'issue') {
      if (!object(b.deviceKey) || b.deviceKey.kty !== 'EC' || b.deviceKey.crv !== 'P-256' || 'd' in b.deviceKey) return json({ error: 'P-256 공개 기기 키가 필요합니다.' }, 400);
      const deviceKey = b.deviceKey as JsonWebKey;
      try { await crypto.subtle.importKey('jwk', deviceKey, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']); }
      catch { return json({ error: '유효한 공개 기기 키가 필요합니다.' }, 400); }
      const k = await issuer(db), now = Date.now();
      const credential = await sign({ id: crypto.randomUUID(), name: '테스트 방문자', deviceKey, issued: now, expires: now + 3600000 }, k.privateKey);
      await db.prepare('INSERT INTO settings(id,value) VALUES(?,?)').bind(credential.payload.id, 'active').run();
      return json({ credential });
    }
    if (b.action === 'status' || b.action === 'stop') {
      if (!id(b.id)) return json({ error: '유효한 ID가 필요합니다.' }, 400);
      if (b.action === 'stop') await db.prepare('UPDATE settings SET value=? WHERE id=? AND id<>?').bind('stopped', b.id, 'issuer').run();
      const r = await db.prepare('SELECT value FROM settings WHERE id=? AND id<>?').bind(b.id, 'issuer').first<{ value: string }>();
      return json({ status: r?.value ?? 'unknown', checked: Date.now() });
    }
    if (b.action === 'records') {
      const rows = await db.prepare('SELECT id,credential,result,created FROM records ORDER BY created DESC, id LIMIT 501').all<DemoRecord>();
      return json({ records: rows.results.slice(0, 500), hasMore: rows.results.length > 500 });
    }
    if (b.action === 'sync') {
      if (!Array.isArray(b.records) || b.records.length > 100 || !b.records.every(r => object(r) && id(r.id) && id(r.credential) && typeof r.result === 'string' && r.result.length <= 200)) return json({ error: '접수 배열은 유효한 기록 최대 100건이어야 합니다.' }, 400);
      const records: DemoRecord[] = [];
      for (const r of b.records as { id: string; credential: string }[]) {
        const s = await db.prepare('SELECT value FROM settings WHERE id=? AND id<>?').bind(r.credential, 'issuer').first<{ value: string }>();
        if (!s) return json({ error: '발급 이력이 없는 접수입니다.' }, 400);
        const existing = await db.prepare('SELECT credential FROM records WHERE id=?').bind(r.id).first<{ credential: string }>();
        if (existing && existing.credential !== r.credential) return json({ error: '접수 ID가 다른 증명정보에 사용됐습니다.' }, 409);
        records.push({ id: r.id, credential: r.credential, result: resultFor(s.value), created: Date.now() });
      }
      // Validate all rows before the transactional D1 write batch.
      if (records.length) await db.batch(records.map(r => db.prepare('INSERT INTO records(id,credential,result,created) VALUES(?,?,?,?) ON CONFLICT(id) DO UPDATE SET result=excluded.result').bind(r.id, r.credential, r.result, r.created)));
      const saved: DemoRecord[] = [];
      for (const r of records) {
        const stored = await db.prepare('SELECT id,credential,result,created FROM records WHERE id=?').bind(r.id).first<DemoRecord>();
        if (stored) saved.push(stored);
      }
      return json({ saved: saved.length, records: saved });
    }
    return json({ error: '지원하지 않는 요청' }, 400);
  } catch {
    return json({ error: '서버 처리 실패. 로컬 DB 초기화와 준비 상태를 확인하세요.' }, 500);
  }
}
