export function loadConfig(env = process.env) {
  const appOrigin = env.APP_ORIGIN || 'http://localhost:3080'
  const origins = [appOrigin, ...(env.ALLOWED_ORIGINS || '').split(',')].filter(Boolean)
  for (const origin of origins) {
    const url = new URL(origin)
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== origin) {
      throw new Error('APP_ORIGIN/ALLOWED_ORIGINS에는 경로 없는 정확한 웹 주소를 입력하세요.')
    }
  }
  if (!env.MONGODB_URI) throw new Error('MONGODB_URI가 필요합니다. .env.example을 확인하세요.')
  if (!env.SESSION_SECRET || env.SESSION_SECRET.length < 32) {
    throw new Error('SESSION_SECRET은 32자 이상이어야 합니다.')
  }
  const port = Number(env.PORT || 3080)
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT 값이 올바르지 않습니다.')
  return {
    port,
    host: env.HOST || '127.0.0.1',
    mongodbUri: env.MONGODB_URI,
    mongodbDb: env.MONGODB_DB || 'consulting_manager',
    appOrigin,
    allowedOrigins: origins,
    sessionSecret: env.SESSION_SECRET,
    cookieSecure: env.COOKIE_SECURE === 'true',
    trustProxy: !env.TRUST_PROXY || env.TRUST_PROXY === 'false' ? false : env.TRUST_PROXY === '1' ? 1 : env.TRUST_PROXY,
    sessionMaxAge: 12 * 60 * 60 * 1000,
    loginRateLimit: 10,
    logRequests: env.LOG_REQUESTS === 'true',
  }
}
