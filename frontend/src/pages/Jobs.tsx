import { useEffect, useState } from 'react'
import { Search, Filter, Loader2, FileText, ChevronLeft, ChevronRight, Download, Play, Trash2 } from 'lucide-react'
import { clsx } from 'clsx'
import { api } from '../api/client'
import { useGenerationStore } from '../hooks/useDataStores'
import { AudioPlayer } from '../components/tts/AudioPlayer'
import { Button, Input, Select, Card, CardContent, Badge } from '../components/ui/basic'

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export const Jobs = () => {
  const { jobs, setJobs, isLoading, setLoading, addJob, removeJob, updateJob } = useGenerationStore()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [showPlayer, setShowPlayer] = useState<any>(null)

  const fetchJobs = async () => {
    setLoading(true)
    try {
      const res = await api.listJobs({
        page,
        page_size: pageSize,
        status: status || undefined,
      })
      setJobs(res.items)
      setTotal(res.total)
    } catch (error) {
      console.error('Failed to load jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchJobs()
  }, [page, pageSize, status])

  const handlePlay = (job: any) => {
    setShowPlayer(job)
  }

  const handleDownload = async (job: any) => {
    try {
      const blob = await api.getJobAudio(job.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `generation_${job.id}.wav`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Download failed')
    }
  }

  const handleDelete = async (job: any) => {
    if (!confirm(`Delete generation "${job.input_text.slice(0, 30)}..."?`)) return
    try {
      await api.deleteJob(job.id)
      removeJob(job.id)
      setTotal(prev => prev - 1)
    } catch {
      alert('Failed to delete job')
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-text">Generation Jobs</h1>
          <p className="text-muted mt-1">View and manage your TTS generation history</p>
        </div>
      </div>

      {/* Filters */}
      <Card variant="outlined" className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[250px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <Input
              placeholder="Search by text..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value)
              setPage(1)
            }}
            options={STATUS_OPTIONS}
            className="w-48"
          />
        </div>
      </Card>

      {/* Jobs Table */}
      <Card variant="default">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="mt-2 text-muted">Loading jobs...</p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="p-12 text-center">
              <FileText className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-medium text-text mb-2">No generation jobs found</h3>
              <p className="text-muted mb-4">
                {search || status ? 'Try adjusting your filters' : 'Generate speech to see jobs here'}
              </p>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="bg-slate-50 border-b border-border">
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Text</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider hidden md:table-cell">Language</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider hidden lg:table-cell">Params</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Created</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-muted uppercase tracking-wider w-48">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {jobs
                      .filter(job => job.input_text.toLowerCase().includes(search.toLowerCase()))
                      .map((job) => (
                        <tr key={job.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4">
                            <p className="font-medium text-text truncate max-w-xs" title={job.input_text}>
                              {job.input_text}
                            </p>
                          </td>
                          <td className="px-6 py-4 hidden md:table-cell">
                            <span className="text-sm text-muted">{job.detected_language || 'Unknown'}</span>
                          </td>
                          <td className="px-6 py-4 hidden lg:table-cell">
                            <div className="flex items-center gap-2 text-xs text-muted">
                              {job.cfg_value && <span>CFG: {job.cfg_value}</span>}
                              {job.inference_timesteps && <span>Steps: {job.inference_timesteps}</span>}
                              {job.min_len && <span>Min: {job.min_len}</span>}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <Badge
                              variant={
                                job.status === 'completed' ? 'success' :
                                job.status === 'failed' ? 'error' :
                                job.status === 'processing' ? 'info' :
                                job.status === 'cancelled' ? 'warning' : 'default'
                              }
                            >
                              {job.status}
                            </Badge>
                          </td>
                          <td className="px-6 py-4 text-sm text-muted">
                            {new Date(job.created_at).toLocaleString()}
                          </td>
                          <td className="px-6 py-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              {job.status === 'completed' && job.output_audio_path && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handlePlay(job)}
                                    title="Play"
                                  >
                                    <Play className="h-4 w-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => handleDownload(job)}
                                    title="Download"
                                  >
                                    <Download className="h-4 w-4" />
                                  </Button>
                                </>
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-error hover:bg-red-50"
                                onClick={() => handleDelete(job)}
                                title="Delete"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {total > pageSize && (
                <div className="px-4 py-3 border-t border-border flex items-center justify-between">
                  <p className="text-sm text-muted">
                    Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, total)} of {total}
                  </p>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="px-3 text-sm text-muted">
                      Page {page} of {Math.ceil(total / pageSize)}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(Math.ceil(total / pageSize), p + 1))}
                      disabled={page >= Math.ceil(total / pageSize)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

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