import { useEffect, useState } from 'react'
import { Loader2, Mic, Headphones, CheckCircle, AlertCircle } from 'lucide-react'
import { clsx } from 'clsx'
import { api } from '../api/client'
import { useVoiceStore, useGenerationStore } from '../hooks/useDataStores'
import { useAuthStore } from '../hooks/useAuth'
import { GenerationForm } from '../components/tts/GenerationForm'
import { AudioPlayer } from '../components/tts/AudioPlayer'
import { Card, CardContent, Badge, Button } from '../components/ui/basic'

export const Generate = () => {
  const { profiles } = useVoiceStore()
  const { jobs, setJobs, currentJob, setCurrentJob, addJob } = useGenerationStore()
  const { isAuthenticated, checkAuth } = useAuthStore()
  const [showPlayer, setShowPlayer] = useState<GenerationJob | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    checkAuth()
  }, [checkAuth])

  useEffect(() => {
    if (isAuthenticated) {
      loadJobs()
    }
  }, [isAuthenticated])

  const loadJobs = async () => {
    try {
      const res = await api.listJobs({ page_size: 20 })
      setJobs(res.items)
    } catch (error) {
      console.error('Failed to load jobs:', error)
    }
  }

  const handleGenerate = async (job: any) => {
    setIsGenerating(false)
    setCurrentJob(job)
    setShowPlayer(job)
    addJob(job)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text">Generate Speech</h1>
          <p className="text-muted mt-1">Create speech from text using VoxCPM2</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Generation Form */}
        <div className="lg:col-span-2 space-y-6">
          <GenerationForm
            voices={profiles}
            onGenerate={handleGenerate}
            isGenerating={isGenerating}
          />

          {/* Recent Generations */}
          <Card variant="default">
            <div className="px-6 py-4 border-b border-border flex items-center justify-between">
              <h2 className="text-lg font-semibold text-text">Recent Generations</h2>
            </div>
            <CardContent className="p-0">
              {jobs.length === 0 ? (
                <div className="p-8 text-center text-muted">
                  <Mic className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No generations yet</p>
                  <p className="text-sm">Generate your first speech using the form on the left</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {jobs.map((job) => (
                    <div
                      key={job.id}
                      className="p-4 hover:bg-slate-50 cursor-pointer flex items-center justify-between"
                      onClick={() => setShowPlayer(job)}
                    >
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <div className={clsx('p-2 rounded-lg flex-shrink-0',
                          job.status === 'completed' ? 'bg-green-100' :
                          job.status === 'failed' ? 'bg-red-100' :
                          job.status === 'processing' ? 'bg-blue-100' : 'bg-slate-100'
                        )}>
                          {job.status === 'processing' ? (
                            <Loader2 className="h-5 w-5 animate-spin text-blue-600" />
                          ) : job.status === 'completed' ? (
                            <CheckCircle className="h-5 w-5 text-green-600" />
                          ) : job.status === 'failed' ? (
                            <AlertCircle className="h-5 w-5 text-red-600" />
                          ) : (
                            <Headphones className="h-5 w-5 text-slate-600" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-text truncate">{job.input_text}</p>
                          <p className="text-sm text-muted">
                            {new Date(job.created_at).toLocaleString()} • {job.detected_language || 'Unknown'}
                          </p>
                        </div>
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
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Audio Player Sidebar */}
        <div className="lg:col-span-1">
          {showPlayer ? (
            <AudioPlayer
              job={showPlayer}
              onClose={() => setShowPlayer(null)}
            />
          ) : (
            <Card variant="default">
              <CardContent className="p-8 text-center">
                <Headphones className="h-16 w-16 mx-auto mb-4 opacity-30" />
                <h3 className="text-lg font-medium text-text mb-2">No Audio Selected</h3>
                <p className="text-muted mb-4">
                  Generate speech or click a recent generation to play it here
                </p>
                <p className="text-sm text-muted">
                  Recent generations appear in the list on the left
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Modal Player */}
      {showPlayer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh]">
            <AudioPlayer
              job={showPlayer}
              onClose={() => setShowPlayer(null)}
            />
          </div>
        </div>
      )}
    </div>
  )
}