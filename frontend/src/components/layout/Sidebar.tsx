import { NavLink, useLocation } from 'react-router-dom'
import { Home, Mic, Mic2, Settings, FlaskConical, FileText, LogOut, Menu, X, ChevronLeft, User } from 'lucide-react'
import { useState } from 'react'
import { clsx } from 'clsx'
import { useAuthStore } from '../../hooks/useAuth'

const NAV_ITEMS = [
  { path: '/', label: 'Dashboard', icon: Home },
  { path: '/voices', label: 'Voice Profiles', icon: Mic2 },
  { path: '/generate', label: 'Generate', icon: Mic },
  { path: '/jobs', label: 'Generation Jobs', icon: FileText },
  { path: '/finetune', label: 'Fine-tuning', icon: FlaskConical },
  { path: '/settings', label: 'Settings', icon: Settings },
]

export const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false)
  const location = useLocation()
  const { user, logout } = useAuthStore()

  return (
    <aside
      className={clsx(
        'fixed left-0 top-0 h-full bg-surface border-r border-border transition-all duration-200 z-40 flex flex-col',
        collapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-border">
        <div className={clsx('flex items-center gap-3 overflow-hidden', collapsed && 'justify-center')}>
          <div className="p-2 bg-primary rounded-lg flex-shrink-0">
            <Mic className="h-5 w-5 text-white" />
          </div>
          {!collapsed && (
            <span className="font-semibold text-lg text-text whitespace-nowrap">
              TensorPilot
            </span>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setCollapsed(!collapsed)}
          className="flex-shrink-0"
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronLeft className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        </Button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = location.pathname === item.path ||
            (item.path !== '/' && location.pathname.startsWith(item.path))

          return (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive: active }) => clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition',
                'hover:bg-primary-light text-text',
                active && 'bg-primary-light text-primary font-medium',
                collapsed && 'justify-center'
              )}
              title={collapsed ? item.label : undefined}
              aria-current={isActive ? 'page' : undefined}
            >
              <item.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </NavLink>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-border">
        {!collapsed ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3 px-3 py-2">
              <div className="w-8 h-8 rounded-full bg-primary-light flex items-center justify-center flex-shrink-0">
                <User className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-text truncate">{user?.full_name || 'User'}</p>
                <p className="text-xs text-muted truncate">{user?.email}</p>
              </div>
            </div>
            <Button
              variant="outline"
              className="w-full justify-start gap-2"
              onClick={logout}
            >
              <LogOut className="h-4 w-4" />
              <span>Logout</span>
            </Button>
          </div>
        ) : (
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-center"
            onClick={logout}
            title="Logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>
        )}
      </div>
    </aside>
  )
}

import { Button } from '../ui/basic'