import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { X, Mic, Upload, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'
import { api } from '../../api/client'
import { Button, Input, Textarea, Select, Card, CardContent, Badge } from '../ui/basic'

const uploadSchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  language: z.string().min(2, 'Language is required'),
  description: z.string().optional(),
  reference_text: z.string().optional(),
  cfg_value: z.number().min(0.1).max(10).default(2.0),
  inference_timesteps: z.number().min(1).max(100).default(10),
  min_len: z.number().min(1).max(100).default(2),
  is_public: z.boolean().default(false),
  tags: z.string().optional(),
})

type UploadFormData = z.infer<typeof uploadSchema>

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: 'Chinese' },
  { value: 'pl', label: 'Polish' },
  { value: 'tr', label: 'Turkish' },
  { value: 'other', label: 'Other' },
]

const PRESET_CONFIGS = {
  en: { cfg_value: 2.0, inference_timesteps: 10, min_len: 2 },
  zh: { cfg_value: 2.0, inference_timesteps: 10, min_len: 2 },
  pl: { cfg_value: 2.3, inference_timesteps: 12, min_len: 3 },
  tr: { cfg_value: 2.2, inference_timesteps: 12, min_len: 2 },
  other: { cfg_value: 2.0, inference_timesteps: 10, min_len: 2 },
}

interface VoiceUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess: (profile: any) => void
}

export const VoiceUploadModal = ({ isOpen, onClose, onSuccess }: VoiceUploadModalProps) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<UploadFormData>({
    resolver: zodResolver(uploadSchema),
    defaultValues: {
      cfg_value: 2.0,
      inference_timesteps: 10,
      min_len: 2,
      is_public: false,
    },
  })

  const watchedLanguage = watch('language')

  // Apply preset when language changes
  const applyPreset = (lang: string) => {
    const preset = PRESET_CONFIGS[lang as keyof typeof PRESET_CONFIGS] || PRESET_CONFIGS.other
    setValue('cfg_value', preset.cfg_value)
    setValue('inference_timesteps', preset.inference_timesteps)
    setValue('min_len', preset.min_len)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      // Validate file type
      const validTypes = ['audio/wav', 'audio/mp3', 'audio/flac', 'audio/ogg', 'audio/m4a']
      if (!validTypes.includes(file.type)) {
        alert('Invalid file type. Please select WAV, MP3, FLAC, OGG, or M4A.')
        return
      }
      // Validate file size (50MB)
      if (file.size > 50 * 1024 * 1024) {
        alert('File too large. Maximum size is 50MB.')
        return
      }
      setSelectedFile(file)
    }
  }

  const onSubmit = async (data: UploadFormData) => {
    if (!selectedFile) {
      alert('Please select a reference audio file')
      return
    }

    setIsUploading(true)
    setUploadProgress(0)

    try {
      // Create FormData
      const formData = new FormData()
      formData.append('reference_audio', selectedFile)
      formData.append('name', data.name)
      formData.append('language', data.language)
      if (data.description) formData.append('description', data.description)
      if (data.reference_text) formData.append('reference_text', data.reference_text)
      formData.append('cfg_value', data.cfg_value.toString())
      formData.append('inference_timesteps', data.inference_timesteps.toString())
      formData.append('min_len', data.min_len.toString())
      formData.append('is_public', data.is_public.toString())
      if (data.tags) formData.append('tags', data.tags)

      // Simulate upload progress
      const progressInterval = setInterval(() => {
        setUploadProgress((prev) => Math.min(prev + 10, 90))
      }, 100)

      const profile = await api.createVoice(formData)

      clearInterval(progressInterval)
      setUploadProgress(100)

      onSuccess(profile)
      onClose()
    } catch (error) {
      console.error('Upload failed:', error)
      alert('Upload failed. Please try again.')
    } finally {
      setIsUploading(false)
      setUploadProgress(0)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-surface rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-primary-light rounded-lg">
              <Mic className="h-5 w-5 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-text">Create Voice Profile</h3>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} disabled={isUploading}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {/* File Upload */}
            <div>
              <label className="block text-sm font-medium text-text mb-2 flex items-center gap-2">
                <Upload className="h-4 w-4" />
                Reference Audio
              </label>
              <div className={clsx(
                'border-2 border-dashed rounded-lg p-6 text-center transition',
                selectedFile ? 'border-primary bg-primary-light' : 'border-border hover:border-primary'
              )}>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={handleFileChange}
                  className="sr-only"
                  id="voice-upload"
                  disabled={isUploading}
                />
                <label htmlFor="voice-upload" className="cursor-pointer">
                  {selectedFile ? (
                    <div className="flex items-center justify-center gap-3">
                      <div className="p-2 bg-primary rounded-lg">
                        <Mic className="h-5 w-5 text-white" />
                      </div>
                      <div className="text-left">
                        <p className="font-medium text-text">{selectedFile.name}</p>
                        <p className="text-sm text-muted">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </div>
                    </div>
                  ) : (
                    <>
                      <Mic className="h-10 w-10 text-muted mx-auto mb-2" />
                      <p className="text-text">Drag & drop or click to select audio file</p>
                      <p className="text-sm text-muted mt-1">
                        WAV, MP3, FLAC, OGG, M4A • Max 50MB
                      </p>
                    </>
                  )}
                </label>
              </div>
              {isUploading && (
                <div className="mt-2">
                  <div className="flex justify-between text-sm text-muted mb-1">
                    <span>Uploading...</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary transition-all"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Name */}
            <Input
              {...register('name')}
              label="Profile Name"
              placeholder="My Voice Profile"
              error={errors.name?.message}
            />

            {/* Language */}
            <Select
              {...register('language')}
              label="Language"
              placeholder="Select language"
              options={LANGUAGE_OPTIONS}
              error={errors.language?.message}
              onChange={(e) => applyPreset(e.target.value)}
            />

            {/* Description */}
            <Textarea
              {...register('description')}
              label="Description (Optional)"
              placeholder="Describe this voice profile..."
              rows={2}
            />

            {/* Reference Text */}
            <Textarea
              {...register('reference_text')}
              label="Reference Text (Optional)"
              placeholder="Transcript of the reference audio"
              rows={2}
            />

            {/* Advanced Settings */}
            <details className="group">
              <summary className="flex items-center justify-between cursor-pointer text-sm font-medium text-text">
                <span>Advanced Settings</span>
                <span className="text-muted transition-transform group-open:rotate-180">▼</span>
              </summary>
              <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border">
                <Input
                  type="number"
                  label="CFG Value"
                  helperText="Guidance scale (0.1-10)"
                  min={0.1}
                  max={10}
                  step={0.1}
                  {...register('cfg_value', { valueAsNumber: true })}
                />
                <Input
                  type="number"
                  label="Inference Steps"
                  helperText="Diffusion steps (1-100)"
                  min={1}
                  max={100}
                  step={1}
                  {...register('inference_timesteps', { valueAsNumber: true })}
                />
                <Input
                  type="number"
                  label="Min Length"
                  helperText="Minimum length (1-100)"
                  min={1}
                  max={100}
                  step={1}
                  {...register('min_len', { valueAsNumber: true })}
                />
              </div>

              <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="is_public"
                    {...register('is_public')}
                    className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                  />
                  <label htmlFor="is_public" className="text-sm text-text">
                    Make this profile public
                  </label>
                </div>

                <Input
                  {...register('tags')}
                  label="Tags (comma-separated)"
                  placeholder="tag1, tag2, tag3"
                />
              </div>
            </details>
          </form>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-4 border-t border-border">
          <Button variant="secondary" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="voice-upload-form"
            variant="primary"
            loading={isUploading}
            disabled={isUploading || !selectedFile}
          >
            <Loader2 className="h-4 w-4 animate-spin" />
            {isUploading ? 'Creating...' : 'Create Profile'}
          </Button>
        </div>
      </div>
    </div>
  )
}