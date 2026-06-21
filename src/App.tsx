import { useCallback, useEffect, useState } from 'react'
import { devProxyHint, apiBaseUrl } from './config'
import { api, ApiError } from './api/client'
import { clearSessionToken, getSessionToken } from './authStorage'
import { LoginView } from './LoginView'
import type {
  NotificacionRow,
  NotificationStats,
  ScrimSnapshot,
  SessionResponse,
  SessionUser,
  Usuario,
} from './types'
import './App.css'

type ChannelName = 'EMAIL' | 'DISCORD' | 'PUSH'

const ESTADO_LABEL: Record<string, string> = {
  BUSCANDO_JUGADORES: 'Buscando jugadores',
  LOBBY_ARMADO: 'Lobby armado',
  CONFIRMADO: 'Confirmado',
  EN_JUEGO: 'En juego',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
}

/** Oculta confirmar, cancelar e iniciar una vez en juego o en estados finales. */
function muestraAccionesPrePartida(estado: string): boolean {
  return !['EN_JUEGO', 'FINALIZADO', 'CANCELADO'].includes(estado)
}

/** Oculta confirmar asistencia cuando ya no aplica (todos confirmados o sin jugadores). */
function muestraBotonConfirmarAsistencia(room: ScrimSnapshot): boolean {
  if (!muestraAccionesPrePartida(room.estado)) return false
  if (room.postuladosCount === 0) return false
  if (room.confirmacionesCount >= room.postuladosCount) return false
  return true
}

/** Sala en partida o cerrada: solo resumen, sin matchmaking / roles / tabla. */
function muestraResumenCompactoSala(estado: string): boolean {
  return ['EN_JUEGO', 'FINALIZADO', 'CANCELADO'].includes(estado)
}

function statusPillClass(estado: string): string {
  const map: Record<string, string> = {
    BUSCANDO_JUGADORES: 'status-pill--search',
    LOBBY_ARMADO: 'status-pill--lobby',
    CONFIRMADO: 'status-pill--ready',
    EN_JUEGO: 'status-pill--live',
    FINALIZADO: 'status-pill--done',
    CANCELADO: 'status-pill--cancel',
  }
  return map[estado] ?? 'status-pill--default'
}

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null)
  const [sessionChecked, setSessionChecked] = useState(
    () => getSessionToken() === null,
  )
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [users, setUsers] = useState<Usuario[]>([])
  const [room, setRoom] = useState<ScrimSnapshot | null>(null)
  const [notifications, setNotifications] = useState<NotificacionRow[]>([])
  const [stats, setStats] = useState<NotificationStats | null>(null)
  const [channels, setChannels] = useState<string[]>([])

  const [juego, setJuego] = useState('Valorant')
  const [maxJugadores, setMaxJugadores] = useState(4)
  const [strategy, setStrategy] = useState<'MMR' | 'LATENCY' | 'HISTORY'>('MMR')
  const [roleUserId, setRoleUserId] = useState('')
  const [roleName, setRoleName] = useState('duelista')

  useEffect(() => {
    const token = getSessionToken()
    if (!token) {
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const res = await api<SessionResponse>('/api/auth/session')
        if (!cancelled && res.authenticated && res.user) {
          setUser(res.user)
        }
      } catch {
        if (!cancelled) {
          clearSessionToken()
        }
      } finally {
        if (!cancelled) setSessionChecked(true)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const handleLogout = useCallback(() => {
    void (async () => {
      try {
        await api('/api/auth/logout', { method: 'POST' })
      } catch {
        /* sesión ya inválida */
      }
      clearSessionToken()
      setUser(null)
      setMessage('Sesión cerrada')
    })()
  }, [])

  const run = useCallback(async (fn: () => Promise<void>) => {
    setError(null)
    setMessage(null)
    setBusy(true)
    try {
      await fn()
    } catch (e) {
      setError(e instanceof ApiError ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }, [])

  const loadUsers = useCallback(() => {
    void run(async () => {
      const data = await api<Usuario[]>('/api/users')
      setUsers(data)
      setMessage('Lista de jugadores actualizada')
    })
  }, [run])

  const loadRoom = useCallback(() => {
    void run(async () => {
      try {
        const data = await api<ScrimSnapshot>('/api/scrims/current')
        setRoom(data)
        setMessage('Sala sincronizada')
      } catch (e) {
        if (e instanceof ApiError && e.status === 404) {
          setRoom(null)
          setMessage('Todavía no hay sala activa')
          return
        }
        throw e
      }
    })
  }, [run])

  const loadNotifications = useCallback(() => {
    void run(async () => {
      const [list, st, ch] = await Promise.all([
        api<NotificacionRow[]>('/api/notifications'),
        api<NotificationStats>('/api/notifications/stats'),
        api<{ active: string[] }>('/api/notification-channels'),
      ])
      setNotifications(list)
      setStats(st)
      setChannels(ch.active)
      setMessage('Centro de notificaciones actualizado')
    })
  }, [run])

  if (!sessionChecked) {
    return (
      <div className="app-shell app-shell--boot">
        <p className="boot-msg">Cargando sesión…</p>
      </div>
    )
  }

  if (!user) {
    return <LoginView onLoggedIn={setUser} />
  }

  return (
    <div className={`app-shell${busy ? ' is-busy' : ''}`}>
      <header className="topbar">
        <div className="topbar__brand">
          <div className="topbar__logo" aria-hidden>
            eS
          </div>
          <div className="topbar__titles">
            <h1>eScrims · panel de sala</h1>
            <p>
              Hola, <strong>{user.displayName}</strong> ({user.role}) · Variables{' '}
              <code>VITE_API_BASE</code> y <code>VITE_PROXY_TARGET</code> en{' '}
              <code>.env</code>.
            </p>
          </div>
        </div>
        <div className="topbar__actions">
          <span className="user-chip" title={user.email}>
            <span className="user-chip__dot" aria-hidden />
            {user.email}
          </span>
          <button
            type="button"
            className="btn btn--ghost btn--sm"
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await api('/api/health')
                setMessage('Conexión con la API verificada')
              })
            }
          >
            Comprobar API
          </button>
          <button
            type="button"
            className="btn btn--secondary btn--sm"
            onClick={handleLogout}
          >
            Salir
          </button>
        </div>
      </header>

      {(error || message) && (
        <div
          className={`toast ${error ? 'toast--err' : 'toast--ok'}`}
          role="status"
        >
          {error ?? message}
        </div>
      )}

      <div className="layout">
        <aside className="layout__sidebar">
          <section className="card">
            <div className="card__head">
              <div>
                <h2 className="card__title">Jugadores de prueba</h2>
                <p className="card__hint">
                  Pool mock del backend. Verificá email antes del matchmaking si
                  el estado lo exige.
                </p>
              </div>
            </div>
            <div className="card__body">
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={busy}
                  onClick={loadUsers}
                >
                  Cargar jugadores
                </button>
              </div>
              {users.length === 0 ? (
                <p className="empty-hint">Sin datos · pulsá “Cargar jugadores”</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>ID</th>
                        <th>Jugador</th>
                        <th>Estado</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map((u) => (
                        <tr key={u.id}>
                          <td className="mono">{u.id}</td>
                          <td>
                            <strong>{u.username}</strong>
                            <div className="sub">{u.email}</div>
                          </td>
                          <td>{u.estadoVerificacion}</td>
                          <td>
                            <button
                              type="button"
                              className="btn btn--ghost btn--sm"
                              disabled={busy}
                              onClick={() =>
                                void run(async () => {
                                  await api(`/api/users/${u.id}/verify-email`, {
                                    method: 'POST',
                                  })
                                  await loadUsers()
                                })
                              }
                            >
                              Verificar
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </aside>

        <div className="layout__main">
          <section className="card">
            <div className="card__head">
              <div>
                <h2 className="card__title">Sala de scrim</h2>
                <p className="card__hint">
                  Creá una sala, ejecutá matchmaking y avanzá el estado como en el
                  flujo del TPO.
                </p>
              </div>
            </div>
            <div className="card__body">
              <div className="form-row">
                <div className="field">
                  <span className="field__label">Juego</span>
                  <input
                    className="input"
                    value={juego}
                    onChange={(e) => setJuego(e.target.value)}
                    placeholder="Ej. Valorant"
                  />
                </div>
                <div className="field">
                  <span className="field__label">Cupo</span>
                  <input
                    className="input"
                    type="number"
                    min={1}
                    value={maxJugadores}
                    onChange={(e) => setMaxJugadores(Number(e.target.value))}
                  />
                </div>
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={busy}
                  onClick={() =>
                    void run(async () => {
                      const snap = await api<ScrimSnapshot>('/api/scrims', {
                        method: 'POST',
                        json: { juego, maxJugadores },
                      })
                      setRoom(snap)
                      setMessage('Sala creada correctamente')
                    })
                  }
                >
                  Crear sala
                </button>
                <button
                  type="button"
                  className="btn btn--secondary"
                  disabled={busy}
                  onClick={loadRoom}
                >
                  Sincronizar
                </button>
              </div>

              {room && (
                <>
                  {muestraResumenCompactoSala(room.estado) ? (
                    <div className="room-summary">
                      <div className="room-summary__head">
                        <span
                          className={`status-pill ${statusPillClass(room.estado)}`}
                          title={room.estado}
                        >
                          {ESTADO_LABEL[room.estado] ?? room.estado}
                        </span>
                        <h3 className="room-summary__title">{room.juego}</h3>
                        <p className="room-summary__id">Sala · {room.scrimId}</p>
                      </div>
                      <dl className="room-summary__dl">
                        <div>
                          <dt>Jugadores en la sala</dt>
                          <dd>
                            <strong>{room.postuladosCount}</strong>
                            {room.maxJugadores > 0 ? (
                              <span className="room-summary__muted">
                                {' '}
                                / cupo {room.maxJugadores}
                              </span>
                            ) : null}
                          </dd>
                        </div>
                        <div>
                          <dt>Confirmaron asistencia</dt>
                          <dd>
                            <strong>{room.confirmacionesCount}</strong>
                          </dd>
                        </div>
                        {room.formato ? (
                          <div>
                            <dt>Formato</dt>
                            <dd>{room.formato}</dd>
                          </div>
                        ) : null}
                        <div>
                          <dt>Rango MMR scrim</dt>
                          <dd>
                            {room.rangoMin} – {room.rangoMax}
                          </dd>
                        </div>
                        <div>
                          <dt>Latencia máx. admitida</dt>
                          <dd>{room.latenciaMax} ms</dd>
                        </div>
                      </dl>
                      {room.estado === 'EN_JUEGO' ? (
                        <div className="room-summary__actions">
                          <button
                            type="button"
                            className="btn btn--secondary"
                            disabled={busy}
                            onClick={() =>
                              void run(async () => {
                                const snap = await api<ScrimSnapshot>(
                                  '/api/scrims/current/finish',
                                  { method: 'POST' },
                                )
                                setRoom(snap)
                                setMessage('Partida finalizada')
                              })
                            }
                          >
                            Finalizar partida
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <>
                  <div className="room-hero">
                    <div>
                      <span
                        className={`status-pill ${statusPillClass(room.estado)}`}
                        title={room.estado}
                      >
                        {ESTADO_LABEL[room.estado] ?? room.estado}
                      </span>
                      <h3 className="room-hero__game">{room.juego}</h3>
                      <p className="room-hero__id">Sala · {room.scrimId}</p>
                    </div>
                    <div className="metrics">
                      <div className="metric">
                        <strong>
                          {room.postuladosCount}/{room.maxJugadores}
                        </strong>
                        <span>Postulados</span>
                      </div>
                      <div className="metric">
                        <strong>{room.confirmacionesCount}</strong>
                        <span>Confirmados</span>
                      </div>
                    </div>
                  </div>

                  <p className="section-label">Matchmaking</p>
                  <p className="card__hint card__hint--tight">
                    Buscar jugadores arma la lista de <strong>candidatos</strong> según la estrategia. No
                    llenan la sala solos: elegís uno en Roles, un rol, y <strong>Asignar</strong> para
                    sumarlo al cupo.
                  </p>
                  <div className="form-row">
                    <div className="field">
                      <span className="field__label">Estrategia</span>
                      <select
                        className="select"
                        value={strategy}
                        onChange={(e) =>
                          setStrategy(e.target.value as typeof strategy)
                        }
                      >
                        <option value="MMR">Por MMR / rango</option>
                        <option value="LATENCY">Por latencia</option>
                        <option value="HISTORY">Por historial</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      className="btn btn--primary"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const snap = await api<ScrimSnapshot>(
                            '/api/scrims/current/matchmaking',
                            { method: 'POST', json: { strategy } },
                          )
                          setRoom(snap)
                          const n = snap.candidatosSugeridos?.length ?? 0
                          setMessage(
                            n > 0
                              ? `Candidatos listados: ${n}. Elegí rol y Asignar para sumar.`
                              : 'Sin candidatos que cumplan el criterio (o todos ya en la sala)',
                          )
                        })
                      }
                    >
                      Buscar jugadores
                    </button>
                  </div>

                  <div className="divider" />

                  <p className="section-label">Roles (Command)</p>
                  <div className="form-row">
                    <div className="field">
                      <span className="field__label">Jugador</span>
                      <select
                        className="select"
                        value={roleUserId}
                        onChange={(e) => setRoleUserId(e.target.value)}
                      >
                        <option value="">Seleccionar…</option>
                        <optgroup label="En la sala">
                          {room.postulados.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.username}
                            </option>
                          ))}
                        </optgroup>
                        {(room.candidatosSugeridos ?? []).filter(
                          (c) => !room.postulados.some((p) => p.id === c.id),
                        ).length > 0 ? (
                          <optgroup label="Candidatos (matchmaking)">
                            {(room.candidatosSugeridos ?? [])
                              .filter((c) => !room.postulados.some((p) => p.id === c.id))
                              .map((c) => (
                                <option key={`sug-${c.id}`} value={c.id}>
                                  {c.username}
                                </option>
                              ))}
                          </optgroup>
                        ) : null}
                      </select>
                    </div>
                    <div className="field">
                      <span className="field__label">Rol</span>
                      <select
                        className="select"
                        value={roleName}
                        onChange={(e) => setRoleName(e.target.value)}
                      >
                        <option value="duelista">Duelista</option>
                        <option value="controlador">Controlador</option>
                        <option value="soporte">Soporte</option>
                        <option value="flex">Flex</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      className="btn btn--secondary"
                      disabled={busy || !roleUserId}
                      onClick={() =>
                        void run(async () => {
                          const snap = await api<ScrimSnapshot>(
                            `/api/scrims/current/players/${roleUserId}/role`,
                            { method: 'PATCH', json: { role: roleName } },
                          )
                          setRoom(snap)
                          setMessage('Rol actualizado')
                        })
                      }
                    >
                      Asignar rol
                    </button>
                    <button
                      type="button"
                      className="btn btn--ghost"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const snap = await api<ScrimSnapshot>(
                            '/api/scrims/current/roles/undo',
                            { method: 'POST' },
                          )
                          setRoom(snap)
                          setMessage('Último cambio de rol deshecho')
                        })
                      }
                    >
                      Deshacer
                    </button>
                  </div>

                  <p className="section-label">Ciclo de vida (State)</p>
                  <div className="btn-row">
                    {muestraBotonConfirmarAsistencia(room) ? (
                      <button
                        type="button"
                        className="btn btn--secondary"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            const snap = await api<ScrimSnapshot>(
                              '/api/scrims/current/confirm',
                              { method: 'POST' },
                            )
                            setRoom(snap)
                            setMessage('Asistencia confirmada')
                          })
                        }
                      >
                        Confirmar asistencia
                      </button>
                    ) : null}
                    {muestraAccionesPrePartida(room.estado) ? (
                      <button
                        type="button"
                        className="btn btn--primary"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            const snap = await api<ScrimSnapshot>(
                              '/api/scrims/current/start',
                              { method: 'POST' },
                            )
                            setRoom(snap)
                            setMessage('Partida en curso')
                          })
                        }
                      >
                        Iniciar partida
                      </button>
                    ) : null}
                    <button
                      type="button"
                      className="btn btn--secondary"
                      disabled={busy}
                      onClick={() =>
                        void run(async () => {
                          const snap = await api<ScrimSnapshot>(
                            '/api/scrims/current/finish',
                            { method: 'POST' },
                          )
                          setRoom(snap)
                          setMessage('Partida finalizada')
                        })
                      }
                    >
                      Finalizar
                    </button>
                    {muestraAccionesPrePartida(room.estado) ? (
                      <button
                        type="button"
                        className="btn btn--danger"
                        disabled={busy}
                        onClick={() =>
                          void run(async () => {
                            const snap = await api<ScrimSnapshot>(
                              '/api/scrims/current/cancel',
                              { method: 'POST' },
                            )
                            setRoom(snap)
                            setMessage('Sala cancelada')
                          })
                        }
                      >
                        Cancelar sala
                      </button>
                    ) : null}
                  </div>

                  {room.postulados.length > 0 ? (
                    <div className="table-wrap">
                      <table className="table">
                        <thead>
                          <tr>
                            <th>Jugador</th>
                            <th>Rol</th>
                            <th>MMR</th>
                            <th>Ping</th>
                          </tr>
                        </thead>
                        <tbody>
                          {room.postulados.map((p) => (
                            <tr key={p.id}>
                              <td>
                                <span className="mono">{p.id}</span> ·{' '}
                                {p.username}
                                {user.id === p.id ? (
                                  <span className="pill pill--you" title="Tu cuenta en esta sala">
                                    {' '}
                                    Vos
                                  </span>
                                ) : null}
                              </td>
                              <td>{p.rol ?? '—'}</td>
                              <td>{p.mmr}</td>
                              <td>{p.latenciaMs} ms</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="empty-hint">
                      Aún no hay postulados · ejecutá matchmaking
                    </p>
                  )}
                    </>
                  )}
                </>
              )}

              {!room && (
                <p className="empty-hint">
                  Creá una sala para ver estado, métricas y acciones de partida.
                </p>
              )}
            </div>
          </section>

          <section className="card">
            <div className="card__head">
              <div>
                <h2 className="card__title">Notificaciones</h2>
                <p className="card__hint">
                  Historial y canales activos (EMAIL, DISCORD, PUSH).
                </p>
              </div>
            </div>
            <div className="card__body">
              <div className="btn-row">
                <button
                  type="button"
                  className="btn btn--primary"
                  disabled={busy}
                  onClick={loadNotifications}
                >
                  Actualizar centro de avisos
                </button>
              </div>

              {stats && (
                <div className="stats-grid">
                  <div className="stat-card">
                    <div className="stat-card__value">{stats.total}</div>
                    <div className="stat-card__label">Total</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card__value">{stats.pendientes}</div>
                    <div className="stat-card__label">Pendientes</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card__value">{stats.enviadas}</div>
                    <div className="stat-card__label">Enviadas</div>
                  </div>
                  <div className="stat-card">
                    <div className="stat-card__value">{stats.fallidas}</div>
                    <div className="stat-card__label">Fallidas</div>
                  </div>
                </div>
              )}

              <div className="channel-grid">
                {(['EMAIL', 'DISCORD', 'PUSH'] as ChannelName[]).map((c) => (
                  <label key={c} className="channel-pill">
                    <input
                      type="checkbox"
                      checked={channels.includes(c)}
                      disabled={busy}
                      onChange={(e) => {
                        const on = e.target.checked
                        void run(async () => {
                          await api('/api/notification-channels', {
                            method: 'PUT',
                            json: { channel: c, active: on },
                          })
                          await loadNotifications()
                        })
                      }}
                    />
                    {c}
                  </label>
                ))}
              </div>

              <p className="section-label section-label--spaced">
                Últimas notificaciones
              </p>
              {notifications.length > 0 ? (
                <ul className="notif-list">
                  {notifications
                    .slice()
                    .reverse()
                    .slice(0, 14)
                    .map((n) => (
                      <li key={n.id}>
                        <span className={`pill pill-${n.estado}`}>{n.estado}</span>
                        <strong>{n.tipo}</strong> — {n.mensaje}
                      </li>
                    ))}
                </ul>
              ) : stats ? (
                <p className="empty-hint">No hay notificaciones en cola</p>
              ) : null}
            </div>
          </section>
        </div>
      </div>

      <footer className="app-footer">
        {apiBaseUrl ? (
          <>
            API base <code>{apiBaseUrl}</code>
          </>
        ) : (
          <>
            Desarrollo · proxy <code>/api</code> → <code>{devProxyHint}</code>
          </>
        )}
      </footer>
    </div>
  )
}
