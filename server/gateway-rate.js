import { createHmac, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { ipKeyGenerator } from 'express-rate-limit';

// Direct clients keep their original rate limit. When any gateway header is
// present, all signed fields must validate so a misconfigured gateway cannot
// silently merge its clients into the same rate-limit bucket.
export function loginRateKey(req, secret, now = Date.now()) {
  const ip = req.get('x-ewh-gateway-ip');
  const timestamp = req.get('x-ewh-gateway-time');
  const signature = req.get('x-ewh-gateway-signature');
  if ([ip, timestamp, signature].every(value => value === undefined)) return ipKeyGenerator(req.ip);
  const invalid = () => { throw Object.assign(new Error('로그인 연결을 확인할 수 없습니다. 잠시 후 다시 시도해 주세요.'), { status: 503 }); };
  if (!secret || typeof ip !== 'string' || !isIP(ip) || typeof timestamp !== 'string' || !/^\d{10}$/.test(timestamp)
      || typeof signature !== 'string' || !/^[a-f0-9]{64}$/.test(signature)
      || Math.abs(Math.floor(now / 1000) - Number(timestamp)) > 60) return invalid();
  const expected = createHmac('sha256', secret).update(`ewh-gateway-v1\n${timestamp}\n${ip}`).digest();
  const actual = Buffer.from(signature, 'hex');
  if (!timingSafeEqual(expected, actual)) return invalid();
  return ipKeyGenerator(ip);
}
