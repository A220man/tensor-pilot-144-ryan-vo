import { Mic, Globe, Settings, Trash2, Edit2, Play, ExternalLink, Copy } from 'lucide-react'
import { clsx } from 'clsx'
import type { VoiceProfile } from '../../types'
import { useVoiceStore } from '../../hooks/useDataStores'
import { api } from '../../api/client'
import { Button, Card, CardContent, Badge, Input } from '../ui/basic'

interface VoiceProfileCardProps {
  profile: VoiceProfile
  onSelect?: (profile: VoiceProfile) => void
  onEdit?: (profile: VoiceProfile) => void
  onDelete?: (id: string) => void
  showActions?: boolean
  isOwner?: boolean
}

export const VoiceProfileCard = ({
  profile,
  onSelect,
  onEdit,
  onDelete,
  showActions = true,
  isOwner = false,
}: VoiceProfileCardProps) => {
  const { updateProfile, removeProfile } = useVoiceStore()
  const [isPlaying, setIsPlaying] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editName, setEditName] = useState(profile.name)
  const audioRef = useRef<HTMLAudioElement>(null)

  const handlePlay = async () => {
    if (!profile.reference_audio_path) return

    if (isPlaying) {
      audioRef.current?.pause()
      setIsPlaying(false)
      return
    }

    try {
      const blob = await api.getJobAudio(profile.id) // This would need a different endpoint
      const url = URL.createObjectURL(blob)
      const audio = new Audio(url)
      audioRef.current = audio

      audio.onended = () => setIsPlaying(false)
      audio.onerror = () => setIsPlaying(false)
      await audio.play()
      setIsPlaying(true)
    } catch {
      console.error('Failed to play reference audio')
    }
  }

  const handleSaveEdit = async () => {
    if (editName !== profile.name) {
      try {
        await api.updateVoice(profile.id, { name: editName })
        updateProfile({ ...profile, name: editName })
      } catch {
        alert('Failed to update name')
      }
    }
    setIsEditing(false)
  }

  const handleDelete = async () => {
    if (!confirm(`Delete voice profile "${profile.name}"?`)) return
    try {
      await api.deleteVoice(profile.id)
      removeProfile(profile.id)
      onDelete?.(profile.id)
    } catch {
      alert('Failed to delete voice profile')
    }
  }

  const copyId = () => {
    navigator.clipboard.writeText(profile.id)
  }

  const formatDuration = (seconds?: number) => {
    if (!seconds) return 'Unknown'
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }

  return (
    <Card variant="outlined" className="group relative">
      <div className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="p-2 bg-primary-light rounded-lg flex-shrink-0">
              <Mic className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0 flex-1">
              {isEditing ? (
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                  onBlur={handleSaveEdit}
                  className="font-medium"
                  autoFocus
                />
              ) : (
                <h4 className="font-medium text-text truncate">{profile.name}</h4>
              )}
              <div className="flex items-center gap-3 mt-1 text-sm text-muted">
                <span className="flex items-center gap-1">
                  <Globe className="h-3 w-3" />
                  {profile.language.toUpperCase()}
                </span>
                <span className="flex items-center gap-1">
                  <Play className="h-3 w-3" />
                  {formatDuration(profile.reference_audio_duration)}
                </span>
                {profile.tags.length > 0 && (
                  <span className="flex items-center gap-1">
                    {profile.tags.slice(0, 3).map((tag) => (
                      <Badge key={tag} variant="default" className="text-xs">
                        {tag}
                      </Badge>
                    ))}
                    {profile.tags.length > 3 && (
                      <Badge variant="default" className="text-xs">
                        +{profile.tags.length - 3}
                      </Badge>
                    )}
                  </span>
                )}
              </div>
            </div>
          </div>

          {showActions && isOwner && (
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditing(!isEditing)}
              >
                {isEditing ? (
                  <Check className="h-4 w-4" />
                ) : (
                  <Edit2 className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onSelect?.(profile)}
              >
                <ExternalLink className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={copyId}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-error hover:bg-red-50"
                onClick={handleDelete}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        {profile.description && (
          <p className="mt-3 text-sm text-muted line-clamp-2">{profile.description}</p>
        )}

        {profile.reference_text && (
          <p className="mt-3 text-sm text-text font-mono bg-slate-50 p-2 rounded">
            "{profile.reference_text}"
          </p>
        )}

        <div className="mt-3 flex items-center gap-4 text-xs text-muted">
          <span>CFG: {profile.cfg_value}</span>
          <span>Steps: {profile.inference_timesteps}</span>
          <span>Min Len: {profile.min_len}</span>
          <span>SR: {profile.sample_rate}Hz</span>
          {profile.is_public && <Badge variant="info" className="text-xs">Public</Badge>}
        </div>
      </div>
    </Card>
  )
}

import { useState, useRef } from 'react'
import { Check } from 'lucide-react'