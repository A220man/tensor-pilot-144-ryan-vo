import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

// Mock the api client BEFORE any imports
vi.mock('../api/client', () => ({
  api: {
    setToken: vi.fn(),
    clearToken: vi.fn(),
    loadTokenFromStorage: vi.fn(),
    getMe: vi.fn().mockResolvedValue({ id: '1', email: 'test@test.com', full_name: 'Test User', username: 'test', roles: ['viewer'], is_active: true }),
    validateToken: vi.fn().mockResolvedValue({ id: '1', email: 'test@test.com', full_name: 'Test User', username: 'test', roles: ['viewer'], is_active: true }),
    getDemoToken: vi.fn().mockResolvedValue({ access_token: 'demo-token', expires_in: 3600 }),
    logout: vi.fn().mockResolvedValue(undefined),
    getOidcConfig: vi.fn().mockResolvedValue({ issuer: 'test', authorization_endpoint: 'test', token_endpoint: 'test' }),
    health: vi.fn().mockResolvedValue({ status: 'healthy', version: '1.0.0', environment: 'test', demo_mode: true, database: 'connected', timestamp: new Date().toISOString() }),
    listVoices: vi.fn().mockResolvedValue({ items: [], total: 0, page: 1, page_size: 20, total_pages: 0 }),
  },
}))

// Mock auth store BEFORE importing App
const mockAuthState = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
  setUser: vi.fn(),
  setLoading: vi.fn(),
  setError: vi.fn(),
  login: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn().mockResolvedValue(undefined),
  checkAuth: vi.fn().mockResolvedValue(undefined),
}

vi.mock('../hooks/useAuth', () => ({
  useAuthStore: () => mockAuthState,
}))

import App from '../App'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
})

const renderApp = (authOverrides: Record<string, unknown> = {}) => {
  // Update mock state
  Object.assign(mockAuthState, authOverrides)

  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  )
}

describe('App', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    // Reset to defaults
    Object.assign(mockAuthState, {
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
    })
  })

  it('shows loading state initially', () => {
    renderApp({ isAuthenticated: false, isLoading: true })
    expect(document.querySelector('svg.animate-spin')).toBeInTheDocument()
  })

  it('redirects to login when not authenticated', () => {
    renderApp({ isAuthenticated: false, isLoading: false })
    expect(screen.getByText('Welcome Back')).toBeInTheDocument()
  })

  // Note: Testing authenticated layout requires lazy-loaded pages which
  // use dynamic imports that bypass vi.mock. This is a known limitation.
  // The authenticated state is tested via integration tests or e2e tests.
})
