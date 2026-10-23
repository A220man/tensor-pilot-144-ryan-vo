import { useEffect, useState } from 'react'
import { Plus, Search, Filter, Loader2, Globe, ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'
import { api } from '../api/client'
import { useVoiceStore } from '../hooks/useDataStores'
import { VoiceProfileCard } from '../components/voices/VoiceProfileCard'
import { VoiceUploadModal } from '../components/voices/VoiceUploadModal'
import { Button, Input, Select, Card, CardContent, Badge } from '../components/ui/basic'

const LANGUAGE_OPTIONS = [
  { value: '', label: 'All Languages' },
  { value: 'en', label: 'English' },
  { value: 'zh', label: 'Chinese' },
  { value: 'pl', label: 'Polish' },
  { value: 'tr', label: 'Turkish' },
]

export const Voices = () => {
  const { profiles, setProfiles, isLoading, setLoading, addProfile, removeProfile, updateProfile } = useVoiceStore()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(12)
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState('')
  const [language, setLanguage] = useState('')
  const [showModal, setShowModal] = useState(false)
  const [sortBy, setSortBy] = useState<'created' | 'name'>('created')

  const fetchVoices = async () => {
    setLoading(true)
    try {
      const res = await api.listVoices({
        page,
        page_size: pageSize,
        language: language || undefined,
      })
      setProfiles(res.items)
      setTotal(res.total)
    } catch (error) {
      console.error('Failed to load voices:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchVoices()
  }, [page, pageSize, language])

  const handleCreate = (profile: any) => {
    addProfile(profile)
    setTotal(prev => prev + 1)
  }

  const handleDelete = (id: string) => {
    removeProfile(id)
    setTotal(prev => prev - 1)
  }

  const handleUpdate = (profile: any) => {
    updateProfile(profile)
  }

  const filteredProfiles = profiles.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase())
  )

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-text">Voice Profiles</h1>
          <p className="text-muted mt-1">Manage your reference voices for cloning</p>
        </div>
        <Button onClick={() => setShowModal(true)}>
          <Plus className="h-4 w-4" />
          Add Voice Profile
        </Button>
      </div>

      {/* Filters */}
      <Card variant="outlined" className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <Input
              placeholder="Search by name..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          <Select
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value)
              setPage(1)
            }}
            options={LANGUAGE_OPTIONS}
            className="w-48"
          />
          <Select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'created' | 'name')}
            options={[
              { value: 'created', label: 'Newest First' },
              { value: 'name', label: 'Name A-Z' },
            ]}
            className="w-40"
          />
        </div>
      </Card>

      {/* Voice Grid */}
      <Card variant="default">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="mt-2 text-muted">Loading voice profiles...</p>
            </div>
          ) : filteredProfiles.length === 0 ? (
            <div className="p-12 text-center">
              <Globe className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-medium text-text mb-2">No voice profiles found</h3>
              <p className="text-muted mb-4">
                {search || language ? 'Try adjusting your filters' : 'Create your first voice profile to get started'}
              </p>
              {!search && !language && (
                <Button onClick={() => setShowModal(true)}>
                  <Plus className="h-4 w-4" />
                  Create Voice Profile
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-4">
                {filteredProfiles.map((profile) => (
                  <VoiceProfileCard
                    key={profile.id}
                    profile={profile}
                    onEdit={handleUpdate}
                    onDelete={handleDelete}
                    isOwner={true}
                  />
                ))}
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
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage(p => Math.min(Math.ceil(total / pageSize), p + 1))}
                      disabled={page >= Math.ceil(total / pageSize)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Upload Modal */}
      <VoiceUploadModal
        isOpen={showModal}
        onClose={() => setShowModal(false)}
        onSuccess={handleCreate}
      />
    </div>
  )
}