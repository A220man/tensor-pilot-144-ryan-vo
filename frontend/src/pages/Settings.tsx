import { useState, useEffect } from 'react'
import { User, Shield, Database, Server, Bell, Save, Loader2, CheckCircle } from 'lucide-react'
import { clsx } from 'clsx'
import { api } from '../api/client'
import { useAuthStore } from '../hooks/useAuth'
import { Button, Input, Select, Card, CardContent, CardHeader } from '../components/ui/basic'

export const Settings = () => {
  const { user } = useAuthStore()
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'notifications' | 'system'>('profile')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  // Profile form
  const [profile, setProfile] = useState({
    full_name: user?.full_name || '',
    email: user?.email || '',
    username: user?.username || '',
  })

  // Preferences
  const [preferences, setPreferences] = useState({
    theme: 'system',
    language: 'en',
    auto_play: true,
    show_waveform: true,
  })

  const handleSaveProfile = async () => {
    setSaving(true)
    try {
      // In real implementation, call API
      await new Promise(r => setTimeout(r, 500))
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch {
      alert('Failed to save profile')
    } finally {
      setSaving(false)
    }
  }

  const TABS = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'security', label: 'Security', icon: Shield },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'system', label: 'System', icon: Server },
  ]

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-semibold text-text">Settings</h1>
        <p className="text-muted mt-1">Manage your account and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sidebar Tabs */}
        <Card variant="default" className="lg:col-span-1 h-fit sticky top-24">
          <nav className="p-2 space-y-1" aria-label="Settings sections">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as typeof activeTab)}
                className={clsx(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition',
                  activeTab === tab.id
                    ? 'bg-primary-light text-primary'
                    : 'text-text hover:bg-slate-100 dark:hover:bg-slate-800'
                )}
                aria-current={activeTab === tab.id ? 'page' : undefined}
              >
                <tab.icon className="h-5 w-5 flex-shrink-0" aria-hidden="true" />
                {tab.label}
              </button>
            ))}
          </nav>
        </Card>

        {/* Tab Content */}
        <div className="lg:col-span-3 space-y-6">
          {/* Profile Tab */}
          {activeTab === 'profile' && (
            <Card variant="default">
              <CardHeader>
                <h2 className="text-lg font-semibold text-text">Profile Information</h2>
                <p className="text-sm text-muted mt-1">Update your personal information</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Input
                    label="Full Name"
                    value={profile.full_name}
                    onChange={(e) => setProfile({ ...profile, full_name: e.target.value })}
                  />
                  <Input
                    label="Username"
                    value={profile.username}
                    onChange={(e) => setProfile({ ...profile, username: e.target.value })}
                  />
                </div>
                <Input
                  label="Email"
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                />
                <div className="flex items-center gap-3 pt-4 border-t border-border">
                  <Button variant="primary" onClick={handleSaveProfile} loading={saving}>
                    <Save className="h-4 w-4" />
                    {saving ? 'Saving...' : 'Save Changes'}
                  </Button>
                  {saved && (
                    <span className="flex items-center gap-1 text-sm text-success">
                      <CheckCircle className="h-4 w-4" />
                      Saved
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Security Tab */}
          {activeTab === 'security' && (
            <Card variant="default">
              <CardHeader>
                <h2 className="text-lg font-semibold text-text">Security</h2>
                <p className="text-sm text-muted mt-1">Manage authentication and access</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="p-4 bg-slate-50 rounded-lg border border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-text">Demo Mode Active</p>
                      <p className="text-sm text-muted">
                        You are using demo authentication. In production, this would connect to Keycloak OIDC.
                      </p>
                    </div>
                    <Badge variant="info">Demo Mode</Badge>
                  </div>
                </div>

                <div className="space-y-4">
                  <h3 className="text-md font-medium text-text">API Access</h3>
                  <p className="text-sm text-muted">
                    Your API token is stored in localStorage and sent with each request.
                    <Button variant="outline" size="sm" onClick={() => localStorage.clear()}>
                      Clear Token
                    </Button>
                  </p>
                </div>

                <div className="pt-4 border-t border-border">
                  <h3 className="text-md font-medium text-text">Session Management</h3>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                    <div className="p-4 bg-surface border border-border rounded-lg">
                      <p className="text-sm text-muted">Access Token Expires</p>
                      <p className="font-mono text-text">30 minutes</p>
                    </div>
                    <div className="p-4 bg-surface border border-border rounded-lg">
                      <p className="text-sm text-muted">Refresh Token Expires</p>
                      <p className="font-mono text-text">7 days</p>
                    </div>
                    <div className="p-4 bg-surface border border-border rounded-lg">
                      <p className="text-sm text-muted">Algorithm</p>
                      <p className="font-mono text-text">RS256 (OIDC)</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Notifications Tab */}
          {activeTab === 'notifications' && (
            <Card variant="default">
              <CardHeader>
                <h2 className="text-lg font-semibold text-text">Notifications</h2>
                <p className="text-sm text-muted mt-1">Configure notification preferences</p>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <label className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-text">Generation Complete</p>
                      <p className="text-sm text-muted">Notify when TTS generation finishes</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={true}
                      onChange={() => {}}
                      className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-text">Fine-tuning Complete</p>
                      <p className="text-sm text-muted">Notify when training job finishes</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={true}
                      onChange={() => {}}
                      className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                    />
                  </label>
                  <label className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-text">Error Notifications</p>
                      <p className="text-sm text-muted">Notify on generation or training failures</p>
                    </div>
                    <input
                      type="checkbox"
                      checked={true}
                      onChange={() => {}}
                      className="w-5 h-5 rounded border-border text-primary focus:ring-primary"
                    />
                  </label>
                </div>
              </CardContent>
            </Card>
          )}

          {/* System Tab */}
          {activeTab === 'system' && (
            <div className="space-y-6">
              <Card variant="default">
                <CardHeader>
                  <h2 className="text-lg font-semibold text-text flex items-center gap-2">
                    <Database className="h-5 w-5" />
                    System Information
                  </h2>
                </CardHeader>
                <CardContent>
                  <dl className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <dt className="text-muted">Environment</dt>
                      <dd className="font-mono text-text">Development</dd>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <dt className="text-muted">Version</dt>
                      <dd className="font-mono text-text">1.0.0</dd>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <dt className="text-muted">API Base URL</dt>
                      <dd className="font-mono text-text truncate">/api</dd>
                    </div>
                    <div className="p-4 bg-slate-50 rounded-lg">
                      <dt className="text-muted">Demo Mode</dt>
                      <dd className="font-mono text-text">Enabled</dd>
                    </div>
                  </dl>
                </CardContent>
              </Card>

              <Card variant="default">
                <CardHeader>
                  <h2 className="text-lg font-semibold text-text flex items-center gap-2">
                    <Server className="h-5 w-5" />
                    Backend Health
                  </h2>
                </CardHeader>
                <CardContent>
                  <div id="health-status" className="p-4 bg-slate-50 rounded-lg">
                    <p className="text-sm text-muted">Checking...</p>
                  </div>
                </CardContent>
              </Card>

              <Card variant="outlined" className="border-amber-200">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Server className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                    <div className="text-sm text-text">
                      <p className="font-medium">Demo Mode Limitations</p>
                      <ul className="list-disc list-inside mt-2 space-y-1 text-muted">
                        <li>Uses in-memory authentication (no real Keycloak)</li>
                        <li>TTS generation creates silent placeholder audio</li>
                        <li>Fine-tuning jobs are simulated</li>
                        <li>Data persists only in SQLite database</li>
                      </ul>
                      <p className="mt-2">
                        <a href="#" className="text-primary underline">Configure Keycloak for production</a>
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

import { CheckCircle } from 'lucide-react'