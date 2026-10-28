import { check, sign, type CredentialPayload, type DevicePayload, type Signed, type Trust } from './proof.ts';
import type { DeviceKeys } from './offline-store.ts';

export const QR_MAX_BYTES = 1500;
export const REQUEST_TTL = 120000;
export type QrRequest = { v: 1; type: 'ansim-request'; sessionId: string; nonce: string; verifierId: string; purpose: 'visit'; issuedAt: number; expiresAt: number };
export type QrDevicePayload = DevicePayload & { sessionId: string; verifierId: string; purpose: 'visit'; requestIssued: number; requestExpires: number };
export type QrResponse = { v: 1; type: 'ansim-response'; credential: Signed<CredentialPayload>; response: Signed<QrDevicePayload> };
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const identifier = (v: unknown): v is string => typeof v === 'string' && /^[A-Za-z0-9_-]{1,128}$/.test(v);
const number = (v: unknown): v is number => Number.isSafeInteger(v);
const publicKey = (v: unknown) => object(v) && v.kty === 'EC' && v.crv === 'P-256' && typeof v.x === 'string' && typeof v.y === 'string' && /^[A-Za-z0-9_-]{43}$/.test(v.x) && /^[A-Za-z0-9_-]{43}$/.test(v.y) && Object.keys(v).every(k => ['kty','crv','x','y','ext','key_ops'].includes(k));
export function makeRequest(verifier: string, now = Date.now()): QrRequest {
  return { v: 1, type: 'ansim-request', sessionId: crypto.randomUUID(), nonce: crypto.randomUUID(), verifierId: verifier, purpose: 'visit', issuedAt: now, expiresAt: now + REQUEST_TTL };
}
export function validRequest(v: unknown): v is QrRequest {
  return object(v) && v.v === 1 && v.type === 'ansim-request' && Object.keys(v).length === 8 && identifier(v.sessionId) && identifier(v.nonce) && identifier(v.verifierId) && v.purpose === 'visit' && number(v.issuedAt) && number(v.expiresAt) && v.expiresAt > v.issuedAt && v.expiresAt - v.issuedAt <= REQUEST_TTL;
}
export function requestCurrent(v: QrRequest, now = Date.now()) { return validRequest(v) && now + 2000 >= v.issuedAt && now < v.expiresAt; }
function validResponse(v: unknown): v is QrResponse {
  if (!object(v) || v.v !== 1 || v.type !== 'ansim-response' || Object.keys(v).length !== 4 || !object(v.credential) || !object(v.response)) return false;
  const c = v.credential.payload, p = v.response.payload;
  return Object.keys(v.credential).length === 2 && Object.keys(v.response).length === 2 && typeof v.credential.signature === 'string' && typeof v.response.signature === 'string' && object(c) && Object.keys(c).length === 5 && identifier(c.id) && c.name === '테스트 방문자' && publicKey(c.deviceKey) && number(c.issued) && number(c.expires) && object(p) && Object.keys(p).length === 7 && identifier(p.id) && identifier(p.nonce) && identifier(p.sessionId) && identifier(p.verifierId) && p.purpose === 'visit' && number(p.requestIssued) && number(p.requestExpires);
}
export function encodeQr(value: QrRequest | QrResponse) {
  const text = JSON.stringify(value);
  if (new TextEncoder().encode(text).length > QR_MAX_BYTES) throw Error('QR 크기 제한(1500 bytes)을 초과했습니다. 다시 준비하세요.');
  return text;
}
export function parseQr(text: string, type: 'ansim-request'): QrRequest;
export function parseQr(text: string, type: 'ansim-response'): QrResponse;
export function parseQr(text: string, type: 'ansim-request' | 'ansim-response') {
  if(!text.trim())throw Error('QR 전체 데이터를 붙여 넣으세요. 세션 ID만으로는 인증할 수 없습니다.');
  if(identifier(text.trim()))throw Error('세션 ID만 입력했습니다. QR 전체 데이터 복사로 복사한 중괄호 { } 전체를 붙여 넣으세요. 세션 ID만으로는 인증할 수 없습니다.');
  if (new TextEncoder().encode(text).length > QR_MAX_BYTES) throw Error('QR 데이터가 너무 큽니다.');
  let value: unknown;
  try { value = JSON.parse(text); } catch { throw Error('올바른 안심 이어가기 QR이 아닙니다.'); }
  if(object(value)&&value.type==='ansim-request'&&type==='ansim-response')throw Error('검증자가 만든 요청 QR입니다. 이용자 기기의 요청 QR 읽기에 넣으세요. 여기는 이용자가 만든 응답 QR을 검증하는 곳입니다.');
  if(object(value)&&value.type==='ansim-response'&&type==='ansim-request')throw Error('이용자가 만든 응답 QR입니다. 검증자 기기의 응답 QR 검증에 넣으세요. 여기는 검증자가 만든 요청 QR을 읽는 곳입니다.');
  if (type === 'ansim-request' ? !validRequest(value) : !validResponse(value)) throw Error('QR 종류·버전·형식이 맞지 않습니다. 개인키가 포함된 QR은 허용하지 않습니다.');
  return value as QrRequest | QrResponse;
}
export async function respondQr(request: QrRequest, credential: Signed<CredentialPayload>, device: DeviceKeys) {
  if (!requestCurrent(request)) throw Error('요청이 만료됐거나 유효하지 않습니다. 새 요청을 스캔하세요.');
  if (Date.now() >= credential.payload.expires) throw Error('신분증이 만료됐습니다. 온라인에서 재발급하세요.');
  const response = await sign({ id: credential.payload.id, nonce: request.nonce, sessionId: request.sessionId, verifierId: request.verifierId, purpose: request.purpose, requestIssued: request.issuedAt, requestExpires: request.expiresAt }, device.privateKey);
  const result: QrResponse = { v: 1, type: 'ansim-response', credential, response };
  encodeQr(result);
  return result;
}
export async function checkQr(request: QrRequest, result: QrResponse, trust: Trust, now = Date.now()) {
  const p = result.response.payload;
  const checks = await check(result.credential, result.response, trust, request.nonce, now, new Set(), request.purpose);
  checks.push({ label: '요청 세션 · 검증자 · 목적 결합', ok: p.sessionId === request.sessionId && p.verifierId === request.verifierId && p.purpose === request.purpose && p.requestIssued === request.issuedAt && p.requestExpires === request.expiresAt });
  checks.push({ label: 'QR 요청 유효시간 (2분)', ok: requestCurrent(request, now) });
  return checks;
}
export const receiptToken = (r: QrRequest) => `qr:${r.verifierId}:${r.sessionId}:${r.nonce}`;
