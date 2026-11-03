import type { DiscoveryCollection } from '../shared/contracts.ts'

export interface DiscoveryToken {
  accessToken: string
  expiresAt: number
}

export interface DiscoveryResponse<T> {
  value?: T
  etag?: string
  notModified: boolean
}

export class GatewayHttpError extends Error {
  readonly status: number
  readonly code: 'AUTH_REQUIRED' | 'RATE_LIMITED' | 'TEMPORARY' | 'INVALID_REQUEST' | 'UNAVAILABLE'
  readonly retryAfterSeconds?: number

  constructor(status: number, code: GatewayHttpError['code'], message: string, retryAfterSeconds?: number) {
    super(message)
    this.name = 'GatewayHttpError'
    this.status = status
    this.code = code
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export interface DiscoveryClientOptions {
  timeoutMs: number
  maxResponseBytes?: number
  fetcher?: typeof fetch
}

interface Envelope<T> {
  success?: boolean
  data?: T
  message?: string
}

function extract<T>(body: unknown): T | undefined {
  if (body !== null && typeof body === 'object' && 'data' in body) {
    return (body as Envelope<T>).data
  }
  return body as T | undefined
}

export function normalizeConsoleUrl(raw: string): string {
  const value = raw.trim()
  if (!value) throw new Error('management URL is required')
  const url = new URL(value)
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error('management URL must use http or https')
  if (url.username || url.password || url.search || url.hash) {
    throw new Error('management URL must not contain credentials, query, or fragment')
  }
  url.pathname = url.pathname.replace(/\/+$/, '')
  return url.toString().replace(/\/$/, '')
}

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, '')}/${path.replace(/^\/+/, '')}`
}

function safeError(status: number, retryAfter?: string | null): GatewayHttpError {
  const retry = retryAfter !== undefined && retryAfter !== null && /^\d+$/.test(retryAfter.trim())
    ? Number(retryAfter)
    : undefined
  if (status === 400) return new GatewayHttpError(status, 'INVALID_REQUEST', 'request is invalid')
  if (status === 401 || status === 403) return new GatewayHttpError(status, 'AUTH_REQUIRED', 'authentication failed')
  if (status === 429) return new GatewayHttpError(status, 'RATE_LIMITED', 'gateway discovery is rate limited', retry)
  if (status >= 500) return new GatewayHttpError(status, 'TEMPORARY', 'gateway discovery is temporarily unavailable')
  return new GatewayHttpError(status, 'UNAVAILABLE', 'gateway discovery request failed')
}

export class DiscoveryClient {
  readonly baseUrl: string
  private readonly timeoutMs: number
  private readonly maxResponseBytes: number
  private readonly fetcher: typeof fetch

  constructor(rawUrl: string, options: DiscoveryClientOptions) {
    this.baseUrl = normalizeConsoleUrl(rawUrl)
    this.timeoutMs = options.timeoutMs
    this.maxResponseBytes = options.maxResponseBytes ?? 1024 * 1024
    this.fetcher = options.fetcher ?? fetch
  }

  async exchange(credential: string, signal?: AbortSignal): Promise<DiscoveryToken> {
    const value = credential.trim()
    if (!value || value.length > 4096) throw new GatewayHttpError(400, 'INVALID_REQUEST', 'credential is invalid')
    const response = await this.request('/v1/ai/credential-discovery/exchange', {
      method: 'POST',
      headers: { authorization: `Bearer ${value}` },
      signal,
    })
    if (!response.ok) throw safeError(response.status, response.headers.get('retry-after'))
    const payload = extract<{ accessToken?: string; expiresAt?: number; expiresIn?: number }>(response.body)
    if (!payload?.accessToken || typeof payload.accessToken !== 'string') {
      throw new GatewayHttpError(502, 'UNAVAILABLE', 'gateway returned an invalid discovery token')
    }
    const expiresAt = typeof payload.expiresAt === 'number'
      ? payload.expiresAt
      : Date.now() + Math.max(300, Number(payload.expiresIn ?? 600)) * 1000
    return { accessToken: payload.accessToken, expiresAt }
  }

  async routes(token: string, etag?: string, signal?: AbortSignal): Promise<DiscoveryResponse<DiscoveryCollection>> {
    const response = await this.request('/v1/ai/credential-discovery/routes', {
      method: 'GET',
      headers: {
        authorization: `Bearer ${token}`,
        ...(etag ? { 'if-none-match': etag } : {}),
      },
      signal,
    })
    if (response.status === 304) return { notModified: true, etag: response.headers.get('etag') ?? etag }
    if (!response.ok) throw safeError(response.status, response.headers.get('retry-after'))
    const value = extract<DiscoveryCollection>(response.body)
    if (value === undefined || !Array.isArray(value.routes)) {
      throw new GatewayHttpError(502, 'UNAVAILABLE', 'gateway returned an invalid route collection')
    }
    return { value, notModified: false, etag: response.headers.get('etag') ?? undefined }
  }

  private async request(path: string, options: { method: 'GET' | 'POST'; headers: Record<string, string>; signal?: AbortSignal }): Promise<{ ok: boolean; status: number; headers: Headers; body: unknown }> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), this.timeoutMs)
    const signal = options.signal === undefined ? controller.signal : AbortSignal.any([controller.signal, options.signal])
    try {
      let response: Response
      try {
        response = await this.fetcher(joinUrl(this.baseUrl, path), {
          method: options.method,
          headers: { accept: 'application/json', ...options.headers },
          redirect: 'error',
          signal,
        })
      } catch (error) {
        if (signal.aborted) throw new GatewayHttpError(408, 'TEMPORARY', 'gateway request timed out or was cancelled')
        throw new GatewayHttpError(503, 'TEMPORARY', 'gateway could not be reached')
      }
      const contentLength = Number(response.headers.get('content-length') ?? 0)
      if (contentLength > this.maxResponseBytes) throw new GatewayHttpError(413, 'INVALID_REQUEST', 'gateway response is too large')
      const text = await response.text()
      if (Buffer.byteLength(text, 'utf8') > this.maxResponseBytes) throw new GatewayHttpError(413, 'INVALID_REQUEST', 'gateway response is too large')
      let body: unknown
      if (text.trim()) {
        try { body = JSON.parse(text) } catch { body = undefined }
      }
      return { ok: response.ok, status: response.status, headers: response.headers, body }
    } finally {
      clearTimeout(timer)
    }
  }
}
