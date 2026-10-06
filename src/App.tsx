import type { ReactNode } from 'react'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './lib/auth'
import Prihlasenie from './pages/Prihlasenie'
import Objednavky from './pages/Objednavky'

function Chranene({ children }: { children: ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) return <p style={{ fontFamily: 'system-ui, sans-serif', padding: 32 }}>Načítava sa…</p>
  if (!session) return <Navigate to="/prihlasenie" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/prihlasenie" element={<Prihlasenie />} />
          <Route
            path="/"
            element={
              <Chranene>
                <Objednavky />
              </Chranene>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
