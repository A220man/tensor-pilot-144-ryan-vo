import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Send, Loader2, Mic, Globe } from 'lucide-react'
import { clsx } from 'clsx'
import type { VoiceProfile, GenerationJob } from '../../types'
import { api } from '../../api/client'
import { useGenerationStore } from '../../hooks/useDataStores'
import { Button, Input, Textarea, Select, Card, CardContent, Badge } from '../ui/basic'

const generationSchema = z.object({
  text: z.string().min(1, 'Text is required').max(5000, 'Text too long (max 5000 characters)'),
  voice_profile_id: z.string().optional(),
  reference_audio_path: z.string().optional(),
  reference_text: z.string().optional(),
  language: z.string().optional(),
  cfg_value: z.number().min(0.1).max(10).default(2.0),
  inference_timesteps: z.number().min(1).max(100).default(10),
  min_len: z.number().min(1).max(100).default(2),
  stream: z.boolean().default(false),
})

type GenerationFormData = z.infer<typeof generationSchema>

interface GenerationFormProps {
  voices: VoiceProfile[]
  onGenerate: (job: GenerationJob) => void
  isGenerating?: boolean
}

const LANGUAGE_OPTIONS = [
  { value: 'en', label: 'English' },
  { value: 'zh', label: 'Chinese' },
  { value: 'pl', label: 'Polish' },
  { value: 'tr', label: 'Turkish' },
  { value: 'auto', label: 'Auto-detect' },
]

const PRESET_CONFIGS = {
  en: { cfg_value: 2.0, inference_timesteps: 10, min_len: 2 },
  zh: { cfg_value: 2.0, inference_timesteps: 10, min_len: 2 },
  pl: { cfg_value: 2.3, inference_timesteps: 12, min_len: 3 },
  tr: { cfg_value: 2.2, inference_timesteps: 12, min_len: 2 },
  auto: { cfg_value: 2.0, inference_timesteps: 10, min_len: 2 },
}

export const GenerationForm = ({ voices, onGenerate, isGenerating }: GenerationFormProps) => {
  const { addJob } = useGenerationStore()
  const [selectedLanguage, setSelectedLanguage] = useState('auto')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<GenerationFormData>({
    resolver: zodResolver(generationSchema),
    defaultValues: {
      cfg_value: 2.0,
      inference_timesteps: 10,
      min_len: 2,
      stream: false,
    },
  })

  const watchedLanguage = watch('language')

  // Auto-update language when voice profile changes
  const watchedVoiceId = watch('voice_profile_id')

  // Apply preset when language changes
  const applyPreset = (lang: string) => {
    const preset = PRESET_CONFIGS[lang as keyof typeof PRESET_CONFIGS] || PRESET_CONFIGS.auto
    setValue('cfg_value', preset.cfg_value)
    setValue('inference_timesteps', preset.inference_timesteps)
    setValue('min_len', preset.min_len)
  }

  // Update language when voice profile selected
  useState(() => {
    if (watchedVoiceId) {
      const voice = voices.find(v => v.id === watchedVoiceId)
      if (voice) {
        setSelectedLanguage(voice.language)
        applyPreset(voice.language)
        setValue('language', voice.language)
      }
    }
  })

  const onSubmit = async (data: GenerationFormData) => {
    try {
      const response = await api.generateSpeechSync(data)
      addJob(response)
      onGenerate(response)
    } catch (error) {
      console.error('Generation failed:', error)
      alert('Generation failed. Please try again.')
    }
  }

  return (
    <Card variant="default" className="w-full max-w-3xl">
      <div className="px-6 py-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary-light rounded-lg">
            <Send className="h-5 w-5 text-primary" />
          </div>
          <h3 className="text-lg font-semibold text-text">Generate Speech</h3>
        </div>
      </div>

      <CardContent className="px-6 py-4 space-y-6">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Text Input */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Text to Synthesize
            </label>
            <Textarea
              {...register('text')}
              placeholder="Enter text to convert to speech..."
              rows={4}
              error={errors.text?.message}
              className="font-mono text-sm"
            />
            <p className="mt-1 text-sm text-muted text-right">
              {watch('text')?.length || 0} / 5000 characters
            </p>
          </div>

          {/* Voice Profile Selection */}
          <div>
            <label className="block text-sm font-medium text-text mb-2">
              Voice Profile (Optional)
            </label>
            <Select
              {...register('voice_profile_id')}
              placeholder="Select a voice profile or use reference audio below"
              options={[
                { value: '', label: 'No voice profile (use reference audio)' },
                ...voices.map(v => ({ value: v.id, label: `${v.name} (${v.language})` })),
              ]}
            />
          </div>

          {/* Language Selection */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Language
              </label>
              <Select
                {...register('language')}
                value={selectedLanguage}
                onChange={(e) => {
                  const lang = e.target.value
                  setSelectedLanguage(lang)
                  applyPreset(lang)
                }}
                options={LANGUAGE_OPTIONS}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text mb-2">
                Reference Text (Optional)
              </label>
              <Input
                {...register('reference_text')}
                placeholder="Transcript of reference audio (if using custom reference)"
              />
            </div>
          </div>

          {/* Reference Audio Upload */}
          <div>
            <label className="block text-sm font-medium text-text mb-2 flex items-center gap-2">
              <Mic className="h-4 w-4" />
              Reference Audio (Optional)
            </label>
            <Input
              type="file"
              accept="audio/*"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) {
                  // In real implementation, upload file first
                  setValue('reference_audio_path', file.name)
                }
              }}
              className="px-3 py-2 border border-border rounded bg-surface"
            />
            <p className="mt-1 text-sm text-muted">
              Upload a reference audio file (WAV, MP3, FLAC, OGG, M4A) for voice cloning
            </p>
          </div>

          {/* Advanced Settings */}
          <details className={clsx('group', showAdvanced && 'open')}>
            <summary className="flex items-center justify-between cursor-pointer text-sm font-medium text-text">
              <span>Advanced Settings</span>
              <span className="text-muted transition-transform group-open:rotate-180">▼</span>
            </summary>
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border">
              <Input
                type="number"
                label="CFG Value"
                helperText="Classifier-free guidance scale (0.1-10)"
                min={0.1}
                max={10}
                step={0.1}
                {...register('cfg_value', { valueAsNumber: true })}
                error={errors.cfg_value?.message}
              />
              <Input
                type="number"
                label="Inference Steps"
                helperText="Number of diffusion steps (1-100)"
                min={1}
                max={100}
                step={1}
                {...register('inference_timesteps', { valueAsNumber: true })}
                error={errors.inference_timesteps?.message}
              />
              <Input
                type="number"
                label="Min Length"
                helperText="Minimum generation length (1-100)"
                min={1}
                max={100}
                step={1}
                {...register('min_len', { valueAsNumber: true })}
                error={errors.min_len?.message}
              />
            </div>
          </details>

          {/* Generate Button */}
          <Button
            type="submit"
            variant="primary"
            size="lg"
            className="w-full"
            loading={isGenerating}
            disabled={isGenerating}
          >
            <Send className="h-4 w-4" />
            {isGenerating ? 'Generating...' : 'Generate Speech'}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}