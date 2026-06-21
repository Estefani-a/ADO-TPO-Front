export interface Usuario {
  id: string
  username: string
  email: string
  mmr: number
  latenciaMs: number
  abandonos: number
  estadoVerificacion: string
  puedeInscribirse: boolean
  rol?: string | null
}

export interface ScrimSnapshot {
  scrimId: string
  juego: string
  formato?: string
  rangoMin: number
  rangoMax: number
  latenciaMax: number
  maxJugadores: number
  fechaHora?: string
  estado: string
  postuladosCount: number
  confirmacionesCount: number
  postulados: Usuario[]
  /** Candidatos del último "Buscar jugadores" aún no en la sala (elegí rol y Asignar para sumarlos). */
  candidatosSugeridos?: Usuario[]
  roles: { userId: string; rol: string }[]
}

export interface NotificacionRow {
  id: string
  usuarioId: string
  scrimId: string
  tipo: string
  mensaje: string
  fechaCreacion: string
  estado: string
  canal: string
}

export interface NotificationStats {
  total: number
  pendientes: number
  enviadas: number
  fallidas: number
  canalesActivos: string[]
}

export interface SessionUser {
  id: string
  email: string
  displayName: string
  role: string
}

export interface LoginResponse {
  success: boolean
  sessionToken: string
  user: SessionUser
}

export interface SessionResponse {
  authenticated: boolean
  user?: SessionUser
  error?: string
}

export interface DemoAccount {
  email: string
  password: string
  displayName: string
  role: string
}
