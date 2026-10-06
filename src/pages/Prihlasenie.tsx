import { useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'

export default function Prihlasenie() {
  const { session, loading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  if (!loading && session) return <Navigate to="/" replace />

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setBusy(true)
    setError(null)
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) setError('Nesprávny e-mail alebo heslo.')
    setBusy(false)
  }

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', maxWidth: 360, margin: '64px auto', padding: 16 }}>
      <h1>Na Koláče</h1>
      <p>Telefonické objednávky – prihlásenie</p>
      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <label>
          E-mail
          <input
            type="email"
            autoComplete="username"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{ display: 'block', width: '100%', padding: 8, fontSize: 16 }}
          />
        </label>
        <label>
          Heslo
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{ display: 'block', width: '100%', padding: 8, fontSize: 16 }}
          />
        </label>
        {error && <p role="alert" style={{ color: '#b00020', margin: 0 }}>{error}</p>}
        <button type="submit" disabled={busy} style={{ padding: 10, fontSize: 16 }}>
          {busy ? 'Prihlasovanie…' : 'Prihlásiť sa'}
        </button>
      </form>
    </main>
  )
}
