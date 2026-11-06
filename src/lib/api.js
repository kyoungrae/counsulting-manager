export class ApiError extends Error {
  constructor(message, code, status = 0) {
    super(message)
    this.name = 'ApiError'
    this.code = code
    this.status = status
  }
}

const API_BASE_URL = (import.meta.env?.VITE_API_BASE_URL || '/api').replace(/\/+$/, '')
const TOKEN_KEY = 'ewha_analytics_api_token'
const TOKEN_PATTERN = /^[A-Za-z0-9_-]{32,512}$/

function getSessionToken() {
  try {
    const token = sessionStorage.getItem(TOKEN_KEY)
    if (typeof token === 'string' && TOKEN_PATTERN.test(token)) return token
    if (token) sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // Browsers that block session storage can still display the login page.
  }
  return null
}

export function hasSessionToken() {
  return getSessionToken() !== null
}

export function setSessionToken(token) {
  if (typeof token !== 'string' || !TOKEN_PATTERN.test(token)) {
    throw new ApiError('로그인 정보를 확인할 수 없습니다. 다시 시도해주세요.', 'auth/invalid-session')
  }
  try {
    sessionStorage.setItem(TOKEN_KEY, token)
  } catch {
    throw new ApiError('로그인 정보를 저장할 수 없습니다. 브라우저의 저장소 설정을 확인해주세요.', 'auth/storage-unavailable')
  }
}

export function clearSessionToken() {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
  } catch {
    // An inaccessible session store cannot supply a token to future requests.
  }
}

export async function apiRequest(path, { body, signal, ...options } = {}) {
  const controller = new AbortController()
  const abort = () => controller.abort()
  if (signal?.aborted) abort()
  signal?.addEventListener('abort', abort, { once: true })
  let timedOut = false
  const timeout = setTimeout(() => {
    timedOut = true
    abort()
  }, 45000)

  try {
    const token = getSessionToken()
    const isWrite = !['GET', 'HEAD', 'OPTIONS'].includes((options.method || 'GET').toUpperCase())
    const response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(isWrite ? { 'X-Requested-With': 'XMLHttpRequest' } : {}),
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'omit',
      cache: 'no-store',
      signal: controller.signal,
    })
    if (response.status === 204) return null

    let result
    try {
      result = await response.json()
    } catch (error) {
      if (controller.signal.aborted) throw error
      throw new ApiError('서버 응답을 확인할 수 없습니다. 잠시 후 다시 시도해주세요.', 'api/invalid-response', response.status)
    }
    if (!response.ok) {
      throw new ApiError(
        result?.error?.message || '요청에 실패했습니다. 잠시 후 다시 시도해주세요.',
        result?.error?.code || 'api/request-failed',
        response.status,
      )
    }
    return result
  } catch (error) {
    if (signal?.aborted) throw error
    if (timedOut) {
      throw new ApiError('로그인 서버의 응답이 늦어지고 있습니다. 잠시 후 다시 시도해주세요.', 'api/timeout')
    }
    if (error instanceof ApiError) throw error
    throw new ApiError('로그인 서버에 연결할 수 없습니다. 연결 상태를 확인하고 다시 시도해주세요.', 'api/unavailable')
  } finally {
    clearTimeout(timeout)
    signal?.removeEventListener('abort', abort)
  }
}
