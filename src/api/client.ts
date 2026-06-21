import { apiBaseUrl } from '../config'
import { getSessionToken } from '../authStorage'

const base = apiBaseUrl

/** En dev siempre; en build solo si VITE_API_DEBUG=true. Desactivar con VITE_API_DEBUG=false. */
function shouldLogApi(): boolean {
  if (import.meta.env.VITE_API_DEBUG === 'false') return false
  return import.meta.env.DEV || import.meta.env.VITE_API_DEBUG === 'true'
}

function headersForLog(headers: Headers): Record<string, string> {
  const out: Record<string, string> = {}
  headers.forEach((value, key) => {
    if (key.toLowerCase() === 'authorization') {
      const m = value.match(/^Bearer\s+(.+)$/i)
      out[key] = m
        ? `Bearer <token oculto, longitud=${m[1].length}>`
        : '<redacted>'
    } else {
      out[key] = value
    }
  })
  return out
}

function requestPayloadForLog(
  init: (RequestInit & { json?: unknown }) | undefined,
  body: BodyInit | null | undefined,
): unknown {
  if (init?.json !== undefined) return init.json
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as unknown
    } catch {
      return body
    }
  }
  if (body == null || body === '') return null
  return `[cuerpo no JSON: ${Object.prototype.toString.call(body)}]`
}

async function parseBody(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

export async function api<T = unknown>(
  path: string,
  init?: RequestInit & { json?: unknown },
): Promise<T> {
  const headers = new Headers(init?.headers)
  const token = getSessionToken()
  if (token && !headers.has('Authorization')) {
    headers.set('Authorization', `Bearer ${token}`)
  }
  let body = init?.body
  if (init?.json !== undefined) {
    headers.set('Content-Type', 'application/json')
    body = JSON.stringify(init.json)
  } else if (body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }

  const method = (init?.method ?? 'GET').toUpperCase()
  const url = `${base}${path}`
  const log = shouldLogApi()

  if (log) {
    console.groupCollapsed(`[API] ${method} ${path}`)
    console.log('URL completa', url)
    console.log('Cabeceras enviadas', headersForLog(headers))
    console.log('Payload (request)', requestPayloadForLog(init, body))
  }

  let res: Response
  try {
    res = await fetch(url, { ...init, headers, body })
  } catch (err) {
    if (log) {
      console.error('Error de red (fetch falló)', err)
      console.groupEnd()
    }
    throw err
  }

  const data = await parseBody(res)

  if (log) {
    console.log('Respuesta', { status: res.status, statusText: res.statusText, body: data })
    if (!res.ok) {
      console.warn('HTTP no OK — el cliente lanzará ApiError después de este log')
    }
    console.groupEnd()
  }

  if (!res.ok) {
    const msg =
      typeof data === 'object' && data !== null && 'error' in data
        ? String((data as { error: unknown }).error)
        : res.statusText
    throw new ApiError(res.status, msg || `HTTP ${res.status}`)
  }
  return data as T
}
