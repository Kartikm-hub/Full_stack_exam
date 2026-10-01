const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1').replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

export async function apiRequest(path, options = {}) {
  const token = sessionStorage.getItem('focus-mode-token')
  const headers = new Headers(options.headers)

  if (options.body && !(options.body instanceof FormData)) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) headers.set('Authorization', `Bearer ${token}`)

  let response
  try {
    response = await fetch(`${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`, {
      ...options,
      headers,
    })
  } catch {
    throw new ApiError('Could not reach the Focus Mode server. Check your connection and API URL.')
  }

  const body = await response.json().catch(() => null)
  if (!response.ok || body?.success === false) {
    throw new ApiError(
      body?.error?.message || body?.message || `Request failed (${response.status})`,
      response.status,
      body?.error?.code,
    )
  }

  return body?.data ?? body
}

export const api = {
  get: (path, options) => apiRequest(path, { ...options, method: 'GET' }),
  post: (path, data, options) => apiRequest(path, {
    ...options,
    method: 'POST',
    body: data === undefined ? undefined : JSON.stringify(data),
  }),
  put: (path, data, options) => apiRequest(path, {
    ...options,
    method: 'PUT',
    body: JSON.stringify(data),
  }),
  patch: (path, data, options) => apiRequest(path, {
    ...options,
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  delete: (path, options) => apiRequest(path, { ...options, method: 'DELETE' }),
}

export function getApiBaseUrl() {
  return API_BASE_URL
}