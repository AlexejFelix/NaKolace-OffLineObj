import { useAuth } from '../lib/auth'

export default function Objednavky() {
  const { profile, isAdmin, signOut } = useAuth()

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 32 }}>
      <h1>Objednávky</h1>
      <p>
        Prihlásený: <strong>{profile?.full_name ?? '—'}</strong> ({isAdmin ? 'administrátor' : 'používateľ'})
      </p>
      <button onClick={() => void signOut()}>Odhlásiť sa</button>
    </main>
  )
}
