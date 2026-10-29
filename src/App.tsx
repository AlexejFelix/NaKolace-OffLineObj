import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import Layout from './components/Layout'
import Prihlasenie from './pages/Prihlasenie'
import Objednavky from './pages/Objednavky'
import NovaObjednavka from './pages/NovaObjednavka'

function Chranene({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <p style={{ padding: 32 }}>Načítava sa…</p>
  if (!session) return <Navigate to="/prihlasenie" replace />
  return <>{children}</>
}

function LenAdmin({ children }: { children: ReactNode }) {
  const { isAdmin } = useAuth()
  if (!isAdmin) return <Navigate to="/" replace />
  return <>{children}</>
}

function Pripravuje({ nazov }: { nazov: string }) {
  return (
    <section>
      <h1>{nazov}</h1>
      <p style={{ color: 'var(--text-muted)' }}>Táto časť sa pripravuje.</p>
    </section>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/prihlasenie" element={<Prihlasenie />} />
          <Route
            element={
              <Chranene>
                <Layout />
              </Chranene>
            }
          >
            <Route path="/" element={<Objednavky />} />
            <Route path="/kalendar" element={<Pripravuje nazov="Kalendár" />} />
            <Route path="/tlac" element={<Pripravuje nazov="Tlač" />} />
            <Route
              path="/nova"
              element={
                <LenAdmin>
                  <NovaObjednavka />
                </LenAdmin>
              }
            />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
