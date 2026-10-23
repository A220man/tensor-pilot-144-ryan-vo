import { useEffect } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { Loader2, CheckCircle, AlertCircle, ArrowRight } from 'lucide-react'
import { clsx } from 'clsx'
import { useAuthStore } from '../hooks/useAuth'
import { api } from '../api/client'
import { Card, CardContent } from '../components/ui/basic'

export const Callback = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('Completing sign in...')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const completeAuth = async () => {
      const token = searchParams.get('token')
      const oauthError = searchParams.get('error')
      const oauthErrorDescription = searchParams.get('error_description')

      if (oauthError) {
        setStatus('error')
        setError(oauthErrorDescription || oauthError)
        setMessage('Authentication failed')
        return
      }

      if (token) {
        try {
          await login(token)
          setStatus('success')
          setMessage('Successfully signed in!')
          // Redirect to dashboard after short delay
          setTimeout(() => navigate('/'), 1500)
        } catch (err) {
          setStatus('error')
          setError('Invalid token received')
          setMessage('Authentication failed')
        }
      } else {
        // Handle OIDC callback (code exchange would happen on backend)
        setStatus('error')
        setError('No token received')
        setMessage('Authentication failed')
      }
    }

    completeAuth()
  }, [searchParams, login, navigate])

  const getStatusIcon = () => {
    switch (status) {
      case 'loading':
        return <Loader2 className="h-8 w-8 animate-spin text-primary" />
      case 'success':
        return <CheckCircle className="h-8 w-8 text-success" />
      case 'error':
        return <AlertCircle className="h-8 w-8 text-error" />
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <Card variant="elevated" className="w-full max-w-md">
        <CardContent className="p-8 text-center space-y-6">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary-light">
            {getStatusIcon()}
          </div>

          <div>
            <h2 className="text-xl font-semibold text-text">{message}</h2>
            {error && (
              <p className="text-sm text-error mt-2">{error}</p>
            )}
          </div>

          {status === 'loading' && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Completing authentication...</span>
            </div>
          )}

          {status === 'success' && (
            <div className="flex items-center justify-center gap-2 text-sm text-success">
              <ArrowRight className="h-4 w-4" />
              <span>Redirecting to dashboard...</span>
            </div>
          )}

          {status === 'error' && (
            <Button variant="primary" onClick={() => navigate('/login')}>
              Return to Login
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

import { useState } from 'react'
import { Button } from '../components/ui/basic'