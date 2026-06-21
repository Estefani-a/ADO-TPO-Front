import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { api, ApiError } from './api/client'
import { setSessionToken } from './authStorage'
import type { DemoAccount, LoginResponse, SessionUser } from './types'

type Props = {
  onLoggedIn: (user: SessionUser) => void
}

export function LoginView({ onLoggedIn }: Props) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [accounts, setAccounts] = useState<DemoAccount[]>([])

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const res = await api<{ accounts: DemoAccount[] }>('/api/auth/demo-accounts')
        if (!cancelled) setAccounts(res.accounts)
      } catch {
        if (!cancelled) setAccounts([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const submit = useCallback(
    (e: FormEvent) => {
      e.preventDefault()
      setError(null)
      setBusy(true)
      void (async () => {
        try {
          const res = await api<LoginResponse>('/api/auth/login', {
            method: 'POST',
            json: { mode: 'local', email: email.trim(), password },
          })
          setSessionToken(res.sessionToken)
          onLoggedIn(res.user)
        } catch (err) {
          setError(err instanceof ApiError ? err.message : String(err))
        } finally {
          setBusy(false)
        }
      })()
    },
    [email, password, onLoggedIn],
  )

  const fillDemo = useCallback((a: DemoAccount) => {
    setEmail(a.email)
    setPassword(a.password)
  }, [])

  return (
    <div className="login-screen">
      <div className="login-card">
        <div className="login-card__brand">
          <div className="topbar__logo" aria-hidden>
            eS
          </div>
          <div>
            <h1 className="login-card__title">eScrims</h1>
            <p className="login-card__subtitle">
              Ingresá con una cuenta demo para operar salas y notificaciones.
            </p>
          </div>
        </div>

        <form className="login-form" onSubmit={submit}>
          <div className="field">
            <span className="field__label">Correo</span>
            <input
              className="input"
              type="email"
              autoComplete="username"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              placeholder="nombre@ejemplo.com"
              required
            />
          </div>
          <div className="field">
            <span className="field__label">Contraseña</span>
            <input
              className="input"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              placeholder="••••••••"
              required
            />
          </div>
          {error && <div className="login-form__error">{error}</div>}
          <button type="submit" className="btn btn--primary login-form__submit" disabled={busy}>
            {busy ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>

        <p className="login-card__demo-title">Cuentas de demostración</p>
        <p className="login-card__demo-note">
          Contraseñas en texto plano solo para el laboratorio del TPO.
        </p>
        {accounts.length > 0 ? (
          <div className="table-wrap login-demo-table">
            <table className="table">
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Clave</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {accounts.map((a) => (
                  <tr key={a.email}>
                    <td>
                      <strong>{a.displayName}</strong>
                      <div className="sub">{a.email}</div>
                    </td>
                    <td>{a.role}</td>
                    <td className="mono">{a.password}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn--ghost btn--sm"
                        onClick={() => fillDemo(a)}
                      >
                        Usar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="empty-hint">No se pudieron cargar las cuentas demo.</p>
        )}
      </div>
    </div>
  )
}
