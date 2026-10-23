import { useState, useRef, useEffect } from 'react'
import { X, Mic, MicOff, Volume2, VolumeX, Loader2, Play, Pause, Download } from 'lucide-react'
import { clsx } from 'clsx'
import type { GenerationJob } from '../../types'
import { api } from '../../api/client'
import { Button, Card, CardContent, Badge } from '../ui/basic'

interface AudioPlayerProps {
  job: GenerationJob
  onClose?: () => void
}

export const AudioPlayer = ({ job, onClose }: AudioPlayerProps) => {
  const [isPlaying, setIsPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1)
  const [isMuted, setIsMuted] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const audioRef = useRef<HTMLAudioElement>(null)
  const progressRef = useRef<number>(0)

  useEffect(() => {
    if (!job.output_audio_path) return

    const audio = new Audio(`/uploads/${job.output_audio_path.split('/').pop()}`)
    audioRef.current = audio

    const handleLoadedData = () => {
      setDuration(audio.duration)
      setIsLoading(false)
    }

    const handleTimeUpdate = () => {
      const prog = (audio.currentTime / audio.duration) * 100
      progressRef.current = prog
      setProgress(prog)
    }

    const handleEnded = () => {
      setIsPlaying(false)
      setProgress(0)
      audio.currentTime = 0
    }

    const handleError = () => {
      setError('Failed to load audio')
      setIsLoading(false)
    }

    audio.addEventListener('loadeddata', handleLoadedData)
    audio.addEventListener('timeupdate', handleTimeUpdate)
    audio.addEventListener('ended', handleEnded)
    audio.addEventListener('error', handleError)

    return () => {
      audio.removeEventListener('loadeddata', handleLoadedData)
      audio.removeEventListener('timeupdate', handleTimeUpdate)
      audio.removeEventListener('ended', handleEnded)
      audio.removeEventListener('error', handleError)
      audio.pause()
      audio.src = ''
    }
  }, [job.output_audio_path])

  const togglePlay = () => {
    if (!audioRef.current) return
    if (isPlaying) {
      audioRef.current.pause()
    } else {
      audioRef.current.play().catch(() => setError('Playback failed'))
    }
    setIsPlaying(!isPlaying)
  }

  const handleProgressChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value)
    if (audioRef.current) {
      audioRef.current.currentTime = (value / 100) * duration
      setProgress(value)
    }
  }

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value)
    setVolume(value)
    setIsMuted(value === 0)
    if (audioRef.current) {
      audioRef.current.volume = value
    }
  }

  const handleDownload = async () => {
    if (!job.output_audio_path) return
    try {
      const blob = await api.getJobAudio(job.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `generation_${job.id}.wav`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('Download failed')
    }
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  if (isLoading) {
    return (
      <Card variant="default" className="p-6 text-center">
        <Loader2 className="mx-auto h-8 w-8 animate-spin text-primary" />
        <p className="mt-2 text-muted">Loading audio...</p>
      </Card>
    )
  }

  if (error) {
    return (
      <Card variant="default" className="p-6 text-center">
        <p className="text-error">{error}</p>
        <Button variant="outline" className="mt-4" onClick={onClose}>
          Close
        </Button>
      </Card>
    )
  }

  return (
    <Card variant="default" className="w-full max-w-2xl">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-light rounded-lg">
            <Mic className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="font-medium text-text">Generated Audio</p>
            <p className="text-sm text-muted">{job.detected_language || 'Unknown'} • {formatTime(job.output_duration || duration)}</p>
          </div>
        </div>
        {onClose && (
          <Button variant="ghost" size="sm" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>

      <CardContent className="px-4 py-4 space-y-4">
        <div className="flex items-center gap-4">
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            onClick={togglePlay}
            disabled={isLoading}
          >
            {isPlaying ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5" />}
          </Button>

          <div className="flex-1 flex items-center gap-2">
            <span className="text-sm text-muted w-10 text-right">{formatTime(isPlaying && audioRef.current ? audioRef.current.currentTime : 0)}</span>
            <input
              type="range"
              min="0"
              max="100"
              value={progress}
              onChange={handleProgressChange}
              className="flex-1 h-2 appearance-none bg-slate-200 rounded-full cursor-pointer"
              style={{
                background: `linear-gradient(to right, var(--color-primary) ${progress}%, var(--color-border) ${progress}%)`,
              }}
            />
            <span className="text-sm text-muted w-10">{formatTime(duration)}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsMuted(!isMuted)}
            >
              {isMuted || volume === 0 ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
            </Button>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={isMuted ? 0 : volume}
              onChange={handleVolumeChange}
              className="w-24 h-2 appearance-none bg-slate-200 rounded-full cursor-pointer"
            />
          </div>

          <Button variant="outline" size="sm" onClick={handleDownload}>
            <Download className="h-4 w-4" />
          </Button>
        </div>

        <div className="flex items-center gap-4 text-sm text-muted">
          <span className="flex items-center gap-1">
            <Badge variant={job.status === 'completed' ? 'success' : job.status === 'failed' ? 'error' : 'warning'}>
              {job.status}
            </Badge>
          </span>
          {job.cfg_value && <span>CFG: {job.cfg_value}</span>}
          {job.inference_timesteps && <span>Steps: {job.inference_timesteps}</span>}
          {job.min_len && <span>Min Len: {job.min_len}</span>}
        </div>

        <div className="pt-2 border-t border-border">
          <p className="text-sm text-text font-medium">Input Text</p>
          <p className="text-sm text-muted mt-1 whitespace-pre-wrap">{job.input_text}</p>
        </div>
      </CardContent>
    </Card>
  )
}