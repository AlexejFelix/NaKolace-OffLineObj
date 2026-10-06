import { useEffect, useState } from 'react'

export default function App() {
  const [status, setStatus] = useState('Pripájanie…')

  useEffect(() => {
    const url = import.meta.env.VITE_SUPABASE_URL as string
    const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string
    fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } })
      .then((r) => setStatus(r.ok ? 'Pripojenie k Supabase je v poriadku' : `Chyba: HTTP ${r.status}`))
      .catch((e: unknown) => setStatus(`Chyba: ${String(e)}`))
  }, [])

  return (
    <main style={{ fontFamily: 'system-ui, sans-serif', padding: 32 }}>
      <h1>Na Koláče – telefonické objednávky</h1>
      <p>{status}</p>
    </main>
  )
}
