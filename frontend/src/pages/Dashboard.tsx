import { useEffect, useState } from 'react'
import { Mic2, FileText, Clock, AlertCircle, TrendingUp, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { api } from '../api/client'
import { useAuthStore } from '../hooks/useAuth'
import { useVoiceStore, useGenerationStore } from '../hooks/useDataStores'
import { Card, CardContent, Badge, Button } from '../components/ui/basic'
import { VoiceProfileCard } from '../components/voices/VoiceProfileCard'

export const Dashboard = () => {
  const { user, isAuthenticated, checkAuth } = useAuthStore()
  const { profiles, setProfiles, isLoading: voicesLoading } = useVoiceStore()
  const { jobs, setJobs, isLoading: jobsLoading } = useGenerationStore()
  const [stats, setStats] = useState({
    totalVoices: 0,
    totalGenerations: 0,
    completedToday: 0,
    failedToday: 0,
  })
  const [health, setHealth] = useState<{ status: string; demo_mode: boolean } | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (isAuthenticated) {
      loadData()
    }
  }, [isAuthenticated])

  const loadData = async () => {
    setIsLoading(true)
    try {
      const [voicesRes, jobsRes, healthRes] = await Promise.all([
        api.listVoices({ page_size: 100 }),
        api.listJobs({ page_size: 100 }),
        api.health(),
      ])

      setProfiles(voicesRes.items)
      setJobs(jobsRes.items)
      setHealth(healthRes)

      // Calculate stats
      const today = new Date().toISOString().split('T')[0]
      const todayJobs = jobsRes.items.filter(j => j.created_at.startsWith(today))
      setStats({
        totalVoices: voicesRes.total,
        totalGenerations: jobsRes.total,
        completedToday: todayJobs.filter(j => j.status === 'completed').length,
        failedToday: todayJobs.filter(j => j.status === 'failed').length,
      })
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const STAT_CARDS = [
    { label: 'Voice Profiles', value: stats.totalVoices, icon: Mic2, color: 'primary', trend: '+12%' },
    { label: 'Total Generations', value: stats.totalGenerations, icon: FileText, color: 'success', trend: '+8%' },
    { label: 'Completed Today', value: stats.completedToday, icon: TrendingUp, color: 'info', trend: '+5%' },
    { label: 'Failed Today', value: stats.failedToday, icon: AlertCircle, color: 'error', trend: '-2%' },
  ]

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text">Dashboard</h1>
          <p className="text-muted mt-1">Welcome back, {user?.full_name || 'User'}</p>
        </div>
        <Button variant="primary" onClick={loadData}>
          <Loader2 className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {STAT_CARDS.map((stat) => (
          <Card key={stat.label} variant="default">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted">{stat.label}</p>
                  <p className="text-3xl font-bold text-text mt-1">{stat.value}</p>
                  <p className="text-xs text-success mt-1">{stat.trend} vs last week</p>
                </div>
                <div className={clsx('p-3 rounded-xl', `bg-${stat.color}-light`)}>
                  <stat.icon className={clsx('h-6 w-6', `text-${stat.color}`)} />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Health Status */}
      {health && (
        <Card variant="outlined" className="mb-6">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={clsx('p-2 rounded-lg', health.status === 'healthy' ? 'bg-green-100' : 'bg-amber-100')}>
                  <Clock className={clsx('h-5 w-5', health.status === 'healthy' ? 'text-green-600' : 'text-amber-600')} />
                </div>
                <div>
                  <p className="font-medium text-text">System Status</p>
                  <p className="text-sm text-muted">
                    {health.status === 'healthy' ? 'All systems operational' : 'Degraded performance'}
                    {health.demo_mode && ' • Demo mode enabled'}
                  </p>
                </div>
              </div>
              <Badge variant={health.status === 'healthy' ? 'success' : 'warning'}>
                {health.status}
              </Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recent Voice Profiles */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card variant="default">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text">Recent Voice Profiles</h2>
            <Button variant="ghost" size="sm" asChild>
              <a href="/voices">View All</a>
            </Button>
          </div>
          <CardContent className="p-0">
            {profiles.length === 0 ? (
              <div className="p-8 text-center text-muted">
                <Mic2 className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No voice profiles yet</p>
                <Button variant="outline" className="mt-4" asChild>
                  <a href="/voices">Create your first profile</a>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {profiles.slice(0, 5).map((profile) => (
                  <VoiceProfileCard
                    key={profile.id}
                    profile={profile}
                    showActions={false}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent Generation Jobs */}
        <Card variant="default">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="text-lg font-semibold text-text">Recent Generations</h2>
            <Button variant="ghost" size="sm" asChild>
              <a href="/jobs">View All</a>
            </Button>
          </div>
          <CardContent className="p-0">
            {jobs.length === 0 ? (
              <div className="p-8 text-center text-muted">
                <FileText className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No generations yet</p>
                <Button variant="outline" className="mt-4" asChild>
                  <a href="/generate">Generate your first speech</a>
                </Button>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {jobs.slice(0, 5).map((job) => (
                  <div key={job.id} className="p-4 hover:bg-slate-50">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-text truncate">{job.input_text}</p>
                        <p className="text-sm text-muted">
                          {new Date(job.created_at).toLocaleString()} • {job.detected_language || 'Unknown'}
                        </p>
                      </div>
                      <Badge
                        variant={
                          job.status === 'completed' ? 'success' :
                          job.status === 'failed' ? 'error' :
                          job.status === 'processing' ? 'info' : 'default'
                        }
                      >
                        {job.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}