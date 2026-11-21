import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import Layout from './components/Layout'
import Prihlasenie from './pages/Prihlasenie'
import Objednavky from './pages/Objednavky'
import NovaObjednavka from './pages/NovaObjednavka'
import Kalendar from './pages/Kalendar'
import Tlac from './pages/Tlac'
import Protokol from './pages/Protokol'

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
            <Route path="/kalendar" element={<Kalendar />} />
            <Route path="/tlac" element={<Tlac />} />
            <Route path="/protokol/:id" element={<Protokol />} />
            <Route
              path="/upravit/:id"
              element={
                <LenAdmin>
                  <NovaObjednavka />
                </LenAdmin>
              }
            />
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
