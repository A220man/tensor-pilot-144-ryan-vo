import { Sun, Moon, Bell, HelpCircle, Github, ExternalLink } from 'lucide-react'
import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import { useAuthStore } from '../../hooks/useAuth'

export const Header = ({ sidebarCollapsed }: { sidebarCollapsed: boolean }) => {
  const [darkMode, setDarkMode] = useState(false)
  const [notificationsOpen, setNotificationsOpen] = useState(false)
  const { user } = useAuthStore()

  useEffect(() => {
    const saved = localStorage.getItem('darkMode')
    if (saved) {
      setDarkMode(saved === 'true')
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setDarkMode(true)
    }
  }, [])

  useEffect(() => {
    localStorage.setItem('darkMode', darkMode.toString())
    document.documentElement.classList.toggle('dark', darkMode)
  }, [darkMode])

  return (
    <header
      className={clsx(
        'fixed top-0 right-0 h-16 bg-surface/80 backdrop-blur-sm border-b border-border z-30 flex items-center px-4 transition-all duration-200',
        sidebarCollapsed ? 'left-16' : 'left-64'
      )}
    >
      <div className="flex-1" />

      <div className="flex items-center gap-4">
        {/* Theme Toggle */}
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </button>

        {/* Notifications */}
        <div className="relative">
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition relative"
            aria-label="Notifications"
          >
            <Bell className="h-5 w-5" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full" />
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 bg-surface border border-border rounded-lg shadow-lg py-2">
              <div className="px-4 py-2 border-b border-border font-medium">Notifications</div>
              <div className="px-4 py-4 text-center text-muted text-sm">
                No new notifications
              </div>
            </div>
          )}
        </div>

        {/* User Menu */}
        <div className="relative">
          <button
            className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="User menu"
          >
            <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center">
              <span className="text-sm font-medium text-primary">
                {user?.full_name?.charAt(0) || 'U'}
              </span>
            </div>
          </button>
        </div>

        {/* Help Links */}
        <div className="flex items-center gap-2">
          <a
            href="https://github.com/OpenBMB/VoxCPM"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="VoxCPM GitHub"
          >
            <Github className="h-5 w-5" />
          </a>
          <a
            href="/docs"
            target="_blank"
            rel="noopener noreferrer"
            className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition"
            aria-label="Documentation"
          >
            <HelpCircle className="h-5 w-5" />
          </a>
        </div>
      </div>
    </header>
  )
}