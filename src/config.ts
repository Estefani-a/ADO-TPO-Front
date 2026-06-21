/**
 * Configuración en runtime: solo variables de entorno Vite (VITE_*).
 * No hay acoplamiento con rutas ni artefactos del backend Java.
 */
const rawBase = (import.meta.env.VITE_API_BASE as string | undefined)?.replace(/\/$/, '') ?? ''

export const apiBaseUrl = rawBase

/** Destino del proxy en dev (misma idea que el default de `vite.config.ts`). */
export const devProxyHint =
  (import.meta.env.VITE_PROXY_TARGET as string | undefined) ?? 'http://localhost:8080'
