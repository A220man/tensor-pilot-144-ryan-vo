export interface User {
  id: string
  email: string
  username: string
  full_name: string
  roles: string[]
  is_active: boolean
  created_at: string
  updated_at: string
  last_login?: string
}

export interface VoiceProfile {
  id: string
  owner_id: string
  name: string
  description?: string
  language: string
  reference_audio_path: string
  reference_audio_duration?: number
  reference_text?: string
  sample_rate: number
  cfg_value: number
  inference_timesteps: number
  min_len: number
  is_public: boolean
  tags: string[]
  created_at: string
  updated_at: string
}

export interface GenerationJob {
  id: string
  user_id: string
  voice_profile_id?: string
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'cancelled'
  input_text: string
  detected_language?: string
  cfg_value?: number
  inference_timesteps?: number
  min_len?: number
  output_audio_path?: string
  output_duration?: number
  output_sample_rate?: number
  error_message?: string
  created_at: string
  started_at?: string
  completed_at?: string
}

export interface TTSGenerationRequest {
  text: string
  voice_profile_id?: string
  reference_audio_path?: string
  reference_text?: string
  language?: string
  cfg_value: number
  inference_timesteps: number
  min_len: number
  stream: boolean
}

export interface TTSGenerationResponse {
  job_id: string
  status: string
  message: string
  audio_url?: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  page_size: number
  total_pages: number
}

export interface HealthResponse {
  status: string
  version: string
  environment: string
  demo_mode: boolean
  database: string
  timestamp: string
}

export interface FineTuningConfig {
  pretrained_path: string
  train_manifest: string
  val_manifest?: string
  sample_rate: number
  out_sample_rate: number
  batch_size: number
  grad_accum_steps: number
  num_workers: number
  num_iters: number
  log_interval: number
  valid_interval: number
  save_interval: number
  learning_rate: number
  weight_decay: number
  warmup_steps: number
  max_steps: number
  max_batch_tokens: number
  max_grad_norm: number
  save_path: string
  tensorboard?: string
  lambdas: Record<string, number>
  lora: {
    enable_lm: boolean
    enable_dit: boolean
    enable_proj: boolean
    r: number
    alpha: number
    dropout: number
  }
}

export interface FineTuningJob {
  id: string
  user_id: string
  config: FineTuningConfig
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'
  current_step: number
  total_steps: number
  current_loss?: number
  log_path?: string
  checkpoint_path?: string
  created_at: string
  started_at?: string
  completed_at?: string
}

export interface AuditLog {
  id: string
  user_id?: string
  action: string
  resource_type: string
  resource_id?: string
  details: Record<string, unknown>
  ip_address?: string
  user_agent?: string
  created_at: string
}