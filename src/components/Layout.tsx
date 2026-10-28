import { Link, NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import './Layout.css'

function monogram(meno: string): string {
  const casti = meno.trim().split(/\s+/).filter(Boolean)
  if (casti.length === 0) return '?'
  if (casti.length === 1) return casti[0].slice(0, 2).toUpperCase()
  return (casti[0][0] + casti[1][0]).toUpperCase()
}

const IkonaObjednavky = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="4" width="5" height="16" rx="1.5" />
    <rect x="10" y="4" width="5" height="11" rx="1.5" />
    <rect x="17" y="4" width="4" height="7" rx="1.5" />
  </svg>
)

const IkonaKalendar = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <rect x="3" y="5" width="18" height="16" rx="2" />
    <path d="M3 10h18M8 3v4M16 3v4" />
  </svg>
)

const IkonaTlac = () => (
  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M7 9V3h10v6" />
    <rect x="3" y="9" width="18" height="8" rx="2" />
    <path d="M7 14h10v7H7z" />
  </svg>
)

const IkonaOdhlasit = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h11" />
  </svg>
)

const IkonaPlus = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" aria-hidden="true">
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export default function Layout() {
  const { profile, isAdmin, signOut } = useAuth()
  const meno = profile?.full_name ?? ''

  return (
    <div className="shell">
      <aside className="sidebar" aria-label="Hlavné menu">
        <Link to="/" className="sidebar-logo" aria-label="Na koláče – domov">
          Nk
        </Link>
        <NavLink to="/" end className="navbtn" title="Objednávky">
          <IkonaObjednavky />
          <span className="navbtn-label">Objednávky</span>
        </NavLink>
        <NavLink to="/kalendar" className="navbtn" title="Kalendár">
          <IkonaKalendar />
          <span className="navbtn-label">Kalendár</span>
        </NavLink>
        <NavLink to="/tlac" className="navbtn" title="Tlač">
          <IkonaTlac />
          <span className="navbtn-label">Tlač</span>
        </NavLink>
        <div className="sidebar-bottom">
          <span className="avatar" title={`${meno} · ${isAdmin ? 'Administrátor' : 'Používateľ'}`}>
            {monogram(meno)}
          </span>
          <button type="button" className="navbtn" title="Odhlásiť sa" aria-label="Odhlásiť sa" onClick={() => void signOut()}>
            <IkonaOdhlasit />
          </button>
        </div>
      </aside>
      <main className="content">
        <Outlet />
      </main>
      {isAdmin && (
        <Link to="/nova" className="fab" aria-label="Nová objednávka">
          <IkonaPlus />
        </Link>
      )}
    </div>
  )
}
