import { signOut } from 'firebase/auth'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { auth } from '../firebase'
import { useAuth } from '../hooks/useAuth'
import { useTheme } from '../hooks/useTheme'
import scientaLogo from '../assets/scienta-logo.png'
import scientaLogoWhite from '../assets/scienta-logo-white.png'

export function Layout({ children }: { children: React.ReactNode }) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const { dark, toggle } = useTheme()

  async function handleSignOut() {
    await signOut(auth)
    navigate('/login', { replace: true })
  }

  const initials = user?.displayName
    ? user.displayName.split(' ').map((n) => n[0]).slice(0, 2).join('')
    : '?'

  return (
    <div className="min-h-screen bg-[#f7f7f5] dark:bg-[#111111] transition-colors duration-200">
      <nav className="bg-white dark:bg-[#1a1a1a] border-b border-gray-200 dark:border-gray-800 sticky top-0 z-40 transition-colors duration-200">
        <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Left: logo + title */}
          <div className="flex items-center gap-3">
            <Link to="/">
              <img src={dark ? scientaLogoWhite : scientaLogo} alt="Scienta" className="h-5 w-auto" />
            </Link>
            <span className="text-gray-300 dark:text-gray-700 font-light text-lg select-none">|</span>
            <span className="text-xs font-medium text-gray-400 dark:text-gray-500 tracking-widest uppercase">Konsulent Admin</span>
          </div>

          {/* Right: nav links + theme toggle + user */}
          <div className="flex items-center gap-6">
            <Link
              to="/"
              className={`text-sm font-medium transition-colors pb-0.5 ${
                location.pathname === '/'
                  ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Dashboard
            </Link>
            <Link
              to="/consultants"
              className={`text-sm font-medium transition-colors pb-0.5 ${
                location.pathname === '/consultants' || location.pathname.startsWith('/consultant/')
                  ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Konsulenter
            </Link>
            <Link
              to="/clients"
              className={`text-sm font-medium transition-colors pb-0.5 ${
                location.pathname.startsWith('/clients')
                  ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Kunder
            </Link>
            <Link
              to="/admins"
              className={`text-sm font-medium transition-colors pb-0.5 ${
                location.pathname === '/admins'
                  ? 'text-gray-900 dark:text-white border-b-2 border-gray-900 dark:border-white'
                  : 'text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              Admins
            </Link>

            <div className="flex items-center gap-3 pl-4 border-l border-gray-100 dark:border-gray-800">
              {/* Dark mode toggle */}
              <button
                onClick={toggle}
                className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-400 hover:text-gray-700 dark:text-gray-500 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                title={dark ? 'Lysmodus' : 'Mørk modus'}
              >
                {dark ? (
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
                  </svg>
                )}
              </button>

              <div
                title={user?.displayName ?? ''}
                className="w-7 h-7 rounded-full bg-gray-900 dark:bg-white flex items-center justify-center text-white dark:text-gray-900 text-xs font-semibold select-none"
              >
                {initials}
              </div>
              <button
                onClick={handleSignOut}
                className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
              >
                Logg ut
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {children}
      </main>
    </div>
  )
}
