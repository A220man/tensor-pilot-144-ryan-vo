import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import App from '../App'
import { useAuthStore } from '../hooks/useAuth'

// Mock the auth store
vi.mock('../hooks/useAuth', () => ({
  useAuthStore: vi.fn(),
}))

const mockUseAuthStore = useAuthStore as vi.Mock

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
})

const renderApp = (authState = { isAuthenticated: false, isLoading: false, user: null }) => {
  mockUseAuthStore.mockReturnValue({
    ...authState,
    login: vi.fn(),
    logout: vi.fn(),
    checkAuth: vi.fn(),
  })

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
  })

  it('shows loading state initially', () => {
    mockUseAuthStore.mockReturnValue({
      isAuthenticated: false,
      isLoading: true,
      user: null,
      login: vi.fn(),
      logout: vi.fn(),
      checkAuth: vi.fn(),
    })

    renderApp()
    // Loader2 doesn't have a role, check for the spinner element
    expect(document.querySelector('svg.animate-spin')).toBeInTheDocument()
  })

  it('redirects to login when not authenticated', () => {
    renderApp({ isAuthenticated: false, isLoading: false })
    expect(screen.getByText('Welcome Back')).toBeInTheDocument()
  })

  it('shows layout when authenticated', () => {
    renderApp({
      isAuthenticated: true,
      isLoading: false,
      user: { id: '1', email: 'test@test.com', full_name: 'Test User', username: 'test', roles: ['viewer'], is_active: true },
    })
    // In authenticated state, Layout is rendered with Sidebar
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Voice Profiles')).toBeInTheDocument()
  })
})