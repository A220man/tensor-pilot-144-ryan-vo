import { create } from 'zustand'
import type { VoiceProfile, GenerationJob, FineTuningJob } from '../types'

interface VoiceState {
  profiles: VoiceProfile[]
  selectedProfile: VoiceProfile | null
  isLoading: boolean
  setProfiles: (profiles: VoiceProfile[]) => void
  addProfile: (profile: VoiceProfile) => void
  updateProfile: (profile: VoiceProfile) => void
  removeProfile: (id: string) => void
  setSelectedProfile: (profile: VoiceProfile | null) => void
  setLoading: (loading: boolean) => void
}

export const useVoiceStore = create<VoiceState>((set) => ({
  profiles: [],
  selectedProfile: null,
  isLoading: false,

  setProfiles: (profiles) => set({ profiles, isLoading: false }),
  addProfile: (profile) => set((state) => ({ profiles: [profile, ...state.profiles] })),
  updateProfile: (profile) =>
    set((state) => ({
      profiles: state.profiles.map((p) => (p.id === profile.id ? profile : p)),
      selectedProfile: state.selectedProfile?.id === profile.id ? profile : state.selectedProfile,
    })),
  removeProfile: (id) =>
    set((state) => ({
      profiles: state.profiles.filter((p) => p.id !== id),
      selectedProfile: state.selectedProfile?.id === id ? null : state.selectedProfile,
    })),
  setSelectedProfile: (profile) => set({ selectedProfile: profile }),
  setLoading: (isLoading) => set({ isLoading }),
}))

interface GenerationState {
  jobs: GenerationJob[]
  currentJob: GenerationJob | null
  isLoading: boolean
  setJobs: (jobs: GenerationJob[]) => void
  addJob: (job: GenerationJob) => void
  updateJob: (job: GenerationJob) => void
  removeJob: (id: string) => void
  setCurrentJob: (job: GenerationJob | null) => void
  setLoading: (loading: boolean) => void
}

export const useGenerationStore = create<GenerationState>((set) => ({
  jobs: [],
  currentJob: null,
  isLoading: false,

  setJobs: (jobs) => set({ jobs, isLoading: false }),
  addJob: (job) => set((state) => ({ jobs: [job, ...state.jobs] })),
  updateJob: (job) =>
    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === job.id ? job : j)),
      currentJob: state.currentJob?.id === job.id ? job : state.currentJob,
    })),
  removeJob: (id) =>
    set((state) => ({
      jobs: state.jobs.filter((j) => j.id !== id),
      currentJob: state.currentJob?.id === id ? null : state.currentJob,
    })),
  setCurrentJob: (job) => set({ currentJob: job }),
  setLoading: (isLoading) => set({ isLoading }),
}))

interface FinetuneState {
  jobs: FineTuningJob[]
  isLoading: boolean
  setJobs: (jobs: FineTuningJob[]) => void
  addJob: (job: FineTuningJob) => void
  updateJob: (job: FineTuningJob) => void
  removeJob: (id: string) => void
  setLoading: (loading: boolean) => void
}

export const useFinetuneStore = create<FinetuneState>((set) => ({
  jobs: [],
  isLoading: false,

  setJobs: (jobs) => set({ jobs, isLoading: false }),
  addJob: (job) => set((state) => ({ jobs: [job, ...state.jobs] })),
  updateJob: (job) =>
    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === job.id ? job : j)),
    })),
  removeJob: (id) =>
    set((state) => ({
      jobs: state.jobs.filter((j) => j.id !== id),
    })),
  setLoading: (isLoading) => set({ isLoading }),
}))