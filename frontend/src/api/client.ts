import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios'
import type { User, VoiceProfile, GenerationJob, TTSGenerationRequest, TTSGenerationResponse, PaginatedResponse, HealthResponse, FineTuningConfig, FineTuningJob, AuditLog } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '/api'

class ApiClient {
  private client: AxiosInstance
  private accessToken: string | null = null

  constructor() {
    this.client = axios.create({
      baseURL: API_BASE_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000,
    })

    // Request interceptor for auth
    this.client.interceptors.request.use(
      (config: InternalAxiosRequestConfig) => {
        if (this.accessToken) {
          config.headers.Authorization = `Bearer ${this.accessToken}`
        }
        return config
      },
      (error) => Promise.reject(error)
    )

    // Response interceptor for error handling
    this.client.interceptors.response.use(
      (response) => response,
      (error: AxiosError) => {
        if (error.response?.status === 401) {
          this.clearToken()
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }
    )
  }

  setToken(token: string | null) {
    this.accessToken = token
    if (token) {
      localStorage.setItem('access_token', token)
    } else {
      localStorage.removeItem('access_token')
    }
  }

  clearToken() {
    this.accessToken = null
    localStorage.removeItem('access_token')
  }

  loadTokenFromStorage() {
    const token = localStorage.getItem('access_token')
    if (token) {
      this.accessToken = token
    }
  }

  // Health
  async health(): Promise<HealthResponse> {
    const response = await this.client.get<HealthResponse>('/v1/healthz')
    return response.data
  }

  // Auth
  async getOidcConfig() {
    const response = await this.client.get('/v1/auth/config')
    return response.data
  }

  async login(redirectUri: string) {
    const response = await this.client.get('/v1/auth/login', { params: { redirect_uri: redirectUri } })
    return response.data
  }

  async getMe(): Promise<User> {
    const response = await this.client.get<User>('/v1/auth/me')
    return response.data
  }

  async validateToken(token: string): Promise<User> {
    const response = await this.client.post<User>('/v1/auth/validate-token', { token })
    return response.data
  }

  async getDemoToken(): Promise<{ access_token: string; expires_in: number }> {
    const response = await this.client.post('/v1/auth/demo-token')
    return response.data
  }

  async logout() {
    await this.client.post('/v1/auth/logout')
    this.clearToken()
  }

  // Voices
  async listVoices(params?: {
    page?: number
    page_size?: number
    language?: string
    public_only?: boolean
  }): Promise<PaginatedResponse<VoiceProfile>> {
    const response = await this.client.get<PaginatedResponse<VoiceProfile>>('/v1/voices', { params })
    return response.data
  }

  async getVoice(id: string): Promise<VoiceProfile> {
    const response = await this.client.get<VoiceProfile>(`/v1/voices/${id}`)
    return response.data
  }

  async createVoice(
    data: FormData
  ): Promise<VoiceProfile> {
    const response = await this.client.post<VoiceProfile>('/v1/voices', data, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return response.data
  }

  async updateVoice(id: string, data: Partial<VoiceProfile>): Promise<VoiceProfile> {
    const response = await this.client.patch<VoiceProfile>(`/v1/voices/${id}`, data)
    return response.data
  }

  async deleteVoice(id: string): Promise<void> {
    await this.client.delete(`/v1/voices/${id}`)
  }

  // TTS Generation
  async generateSpeech(request: TTSGenerationRequest): Promise<TTSGenerationResponse> {
    const response = await this.client.post<TTSGenerationResponse>('/v1/tts/generate', request)
    return response.data
  }

  async generateSpeechSync(request: TTSGenerationRequest): Promise<GenerationJob> {
    const response = await this.client.post<GenerationJob>('/v1/tts/generate-sync', request)
    return response.data
  }

  async listJobs(params?: {
    page?: number
    page_size?: number
    status?: string
  }): Promise<PaginatedResponse<GenerationJob>> {
    const response = await this.client.get<PaginatedResponse<GenerationJob>>('/v1/tts/jobs', { params })
    return response.data
  }

  async getJob(id: string): Promise<GenerationJob> {
    const response = await this.client.get<GenerationJob>(`/v1/tts/jobs/${id}`)
    return response.data
  }

  async getJobAudio(id: string): Promise<Blob> {
    const response = await this.client.get(`/v1/tts/jobs/${id}/audio`, {
      responseType: 'blob',
    })
    return response.data
  }

  async deleteJob(id: string): Promise<void> {
    await this.client.delete(`/v1/tts/jobs/${id}`)
  }

  // Fine-tuning
  async listFinetuneJobs(params?: {
    page?: number
    page_size?: number
    status?: string
  }): Promise<PaginatedResponse<FineTuningJob>> {
    const response = await this.client.get<PaginatedResponse<FineTuningJob>>('/v1/finetune/jobs', { params })
    return response.data
  }

  async getFinetuneJob(id: string): Promise<FineTuningJob> {
    const response = await this.client.get<FineTuningJob>(`/v1/finetune/jobs/${id}`)
    return response.data
  }

  async createFinetuneJob(config: FineTuningConfig): Promise<FineTuningJob> {
    const response = await this.client.post<FineTuningJob>('/v1/finetune/jobs', config)
    return response.data
  }

  async cancelFinetuneJob(id: string): Promise<FineTuningJob> {
    const response = await this.client.post<FineTuningJob>(`/v1/finetune/jobs/${id}/cancel`)
    return response.data
  }

  // Audit
  async listAuditLogs(params?: {
    page?: number
    page_size?: number
    action?: string
    resource_type?: string
  }): Promise<PaginatedResponse<AuditLog>> {
    const response = await this.client.get<PaginatedResponse<AuditLog>>('/v1/audit', { params })
    return response.data
  }
}

export const api = new ApiClient()