import { Routes, Route, Navigate } from 'react-router-dom'
import { Suspense, lazy, useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { Sidebar } from '@/components/layout/Sidebar'
import { Header } from '@/components/layout/Header'
import { useAuthStore } from '@/hooks/useAuth'
import { Login } from '@/pages/Login'
import { Callback } from '@/pages/Callback'

const Dashboard = lazy(() => import('@/pages/Dashboard'))
const Voices = lazy(() => import('@/pages/Voices'))
const Generate = lazy(() => import('@/pages/Generate'))
const Jobs = lazy(() => import('@/pages/Jobs'))
const Finetune = lazy(() => import('@/pages/Finetune'))
const Settings = lazy(() => import('@/pages/Settings'))

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, checkAuth } = useAuthStore()

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

const Layout = () => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const { isAuthenticated } = useAuthStore()

  return (
    <div className="min-h-screen bg-background">
      {isAuthenticated && <Sidebar />}
      {isAuthenticated && <Header sidebarCollapsed={sidebarCollapsed} />}
      <main
        className={clsx(
          'pt-16 min-h-screen transition-all duration-200',
          isAuthenticated ? (sidebarCollapsed ? 'ml-16' : 'ml-64') : 'ml-0'
        )}
      >
        <div className="p-6">
          <Suspense fallback={
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          }>
            <Routes>
              <Route path="/" element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              } />
              <Route path="/voices" element={
                <ProtectedRoute>
                  <Voices />
                </ProtectedRoute>
              } />
              <Route path="/generate" element={
                <ProtectedRoute>
                  <Generate />
                </ProtectedRoute>
              } />
              <Route path="/jobs" element={
                <ProtectedRoute>
                  <Jobs />
                </ProtectedRoute>
              } />
              <Route path="/finetune" element={
                <ProtectedRoute>
                  <Finetune />
                </ProtectedRoute>
              } />
              <Route path="/settings" element={
                <ProtectedRoute>
                  <Settings />
                </ProtectedRoute>
              } />
            </Routes>
          </Suspense>
        </div>
      </main>
    </div>
  )
}

const App = () => {
  const { isAuthenticated, isLoading } = useAuthStore()

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/auth/callback" element={<Callback />} />
      <Route path="/*" element={<Layout />} />
    </Routes>
  )
}

export default App
