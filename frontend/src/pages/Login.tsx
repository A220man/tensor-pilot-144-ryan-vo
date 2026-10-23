import { useEffect, useState } from 'react'
import { Mic, Loader2, CheckCircle, AlertCircle, Github, ExternalLink } from 'lucide-react'
import { clsx } from 'clsx'
import { useAuthStore } from '../hooks/useAuth'
import { api } from '../api/client'
import { Button, Input, Card, CardContent } from '../components/ui/basic'

export const Login = () => {
  const { login, checkAuth, isAuthenticated } = useAuthStore()
  const [demoMode, setDemoMode] = useState(true)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [oidcConfig, setOidcConfig] = useState<{ issuer: string; client_id: string } | null>(null)

  useEffect(() => {
    checkAuth()
    api.getOidcConfig().then(setOidcConfig).catch(() => {})
  }, [checkAuth])

  useEffect(() => {
    if (isAuthenticated) {
      window.location.href = '/'
    }
  }, [isAuthenticated])

  const handleDemoLogin = async () => {
    setLoading(true)
    setError(null)
    try {
      const { access_token } = await api.getDemoToken()
      await login(access_token)
      window.location.href = '/'
    } catch (err) {
      setError('Demo login failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleOidcLogin = () => {
    const redirectUri = `${window.location.origin}/auth/callback`
    window.location.href = `${oidcConfig?.issuer}/protocol/openid-connect/auth?` +
      new URLSearchParams({
        client_id: oidcConfig?.client_id || 'tensorpilot-backend',
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: 'openid profile email',
        state: Math.random().toString(36).substring(7),
        code_challenge: 'challenge',
        code_challenge_method: 'S256',
      })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary mb-4">
            <Mic className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-text">TensorPilot</h1>
          <p className="text-muted mt-2">VoxCPM2 TTS Platform</p>
        </div>

        {/* Login Card */}
        <Card variant="elevated">
          <CardContent className="p-6 space-y-6">
            {demoMode ? (
              <> 
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold text-text">Welcome Back</h2>
                  <p className="text-muted mt-1">Sign in to access your voice profiles and generations</p>
                </div>

                <Button
                  variant="primary"
                  className="w-full"
                  size="lg"
                  onClick={handleDemoLogin}
                  loading={loading}
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {loading ? 'Signing in...' : 'Continue with Demo Account'}
                </Button>

                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-sm">
                    <span className="px-2 bg-surface text-muted">Or</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  className="w-full"
                  size="lg"
                  onClick={handleOidcLogin}
                  disabled={loading}
                >
                  <Github className="h-4 w-4" />
                  Continue with Keycloak OIDC
                </Button>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                  </div>
                )}

                <div className="pt-4 border-t border-border">
                  <p className="text-center text-sm text-muted">
                    Demo mode uses a local SQLite database and simulates TTS generation.
                    <br />
                    <a href="https://github.com/OpenBMB/VoxCPM" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                      View VoxCPM on GitHub
                    </a>
                  </p>
                </div>
              </>
            ) : (
              <> 
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold text-text">OIDC Authentication</h2>
                  <p className="text-muted mt-1">Configured for {oidcConfig?.issuer}</p>
                </div>

                <Button
                  variant="primary"
                  className="w-full"
                  size="lg"
                  onClick={handleOidcLogin}
                  loading={loading}
                >
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {loading ? 'Redirecting...' : 'Sign in with Keycloak'}
                </Button>

                {error && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    <AlertCircle className="h-5 w-5 flex-shrink-0" />
                    <p className="text-sm">{error}</p>
                  </div>
                )}
              </>
            )}

            <div className="text-center text-sm text-muted">
              <p>TensorPilot v1.0.0</p>
              <p>Built with VoxCPM2 • FastAPI • React • TypeScript</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}