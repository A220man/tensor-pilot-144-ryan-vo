import { FlaskConical, Plus, Loader2, Play, Pause, StopCircle, Trash2, Download, Settings, FileText } from 'lucide-react'
import { useState, useEffect } from 'react'
import { clsx } from 'clsx'
import { api } from '../api/client'
import { useFinetuneStore } from '../hooks/useDataStores'
import { Button, Input, Textarea, Select, Card, CardContent, Badge } from '../components/ui/basic'

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'running', label: 'Running' },
  { value: 'completed', label: 'Completed' },
  { value: 'failed', label: 'Failed' },
  { value: 'cancelled', label: 'Cancelled' },
]

export const Finetune = () => {
  const { jobs, setJobs, isLoading, setLoading, addJob, removeJob, updateJob } = useFinetuneStore()
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [status, setStatus] = useState('')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [creating, setCreating] = useState(false)

  // Form state for create modal
  const [formData, setFormData] = useState({
    name: '',
    pretrained_path: 'openbmb/VoxCPM2',
    train_manifest: '',
    val_manifest: '',
    sample_rate: 16000,
    out_sample_rate: 48000,
    batch_size: 1,
    grad_accum_steps: 2,
    num_workers: 8,
    num_iters: 1000,
    learning_rate: 0.0001,
    weight_decay: 0.01,
    warmup_steps: 100,
    max_steps: 1000,
    max_batch_tokens: 8192,
    max_grad_norm: 1.0,
    save_path: 'checkpoints/finetune_lora',
    lora_r: 64,
    lora_alpha: 128,
    lora_dropout: 0.0,
    enable_lm: true,
    enable_dit: true,
    enable_proj: false,
  })

  const fetchJobs = async () => {
    setLoading(true)
    try {
      const res = await api.listFinetuneJobs({
        page,
        page_size: pageSize,
        status: status || undefined,
      })
      setJobs(res.items)
      setTotal(res.total)
    } catch (error) {
      console.error('Failed to load fine-tuning jobs:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchJobs()
  }, [page, pageSize, status])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreating(true)
    try {
      const config = {
        pretrained_path: formData.pretrained_path,
        train_manifest: formData.train_manifest,
        val_manifest: formData.val_manifest || undefined,
        sample_rate: formData.sample_rate,
        out_sample_rate: formData.out_sample_rate,
        batch_size: formData.batch_size,
        grad_accum_steps: formData.grad_accum_steps,
        num_workers: formData.num_workers,
        num_iters: formData.num_iters,
        learning_rate: formData.learning_rate,
        weight_decay: formData.weight_decay,
        warmup_steps: formData.warmup_steps,
        max_steps: formData.max_steps,
        max_batch_tokens: formData.max_batch_tokens,
        max_grad_norm: formData.max_grad_norm,
        save_path: formData.save_path,
        lambdas: { 'loss/diff': 1.0, 'loss/stop': 1.0 },
        lora: {
          enable_lm: formData.enable_lm,
          enable_dit: formData.enable_dit,
          enable_proj: formData.enable_proj,
          r: formData.lora_r,
          alpha: formData.lora_alpha,
          dropout: formData.lora_dropout,
        },
      }

      const job = await api.createFinetuneJob(config)
      addJob(job)
      setTotal(prev => prev + 1)
      setShowCreateModal(false)
    } catch (error) {
      console.error('Failed to create job:', error)
      alert('Failed to create fine-tuning job')
    } finally {
      setCreating(false)
    }
  }

  const handleCancel = async (job: any) => {
    if (!confirm(`Cancel fine-tuning job "${job.id}"?`)) return
    try {
      const updated = await api.cancelFinetuneJob(job.id)
      updateJob(updated)
    } catch {
      alert('Failed to cancel job')
    }
  }

  const handleDelete = async (job: any) => {
    if (!confirm(`Delete fine-tuning job "${job.id}"?`)) return
    try {
      // In real implementation, call delete API
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
          <h1 className="text-2xl font-semibold text-text flex items-center gap-2">
            <FlaskConical className="h-6 w-6 text-primary" />
            Fine-tuning
          </h1>
          <p className="text-muted mt-1">Manage LoRA fine-tuning jobs for VoxCPM2</p>
        </div>
        <Button onClick={() => setShowCreateModal(true)}>
          <Plus className="h-4 w-4" />
          New Fine-tuning Job
        </Button>
      </div>

      {/* Info Card */}
      <Card variant="outlined" className="p-4">
        <div className="flex items-start gap-4">
          <Settings className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
          <div className="text-sm text-muted space-y-1">
            <p>
              <strong>LoRA Fine-tuning</strong> allows you to adapt VoxCPM2 to new voices, languages, or styles
              using Low-Rank Adaptation. This is much faster and requires less data than full fine-tuning.
            </p>
            <p>
              <strong>Requirements:</strong> Training manifest (JSONL) with audio paths and transcripts.
              Reference: <a href="https://github.com/OpenBMB/VoxCPM" target="_blank" rel="noopener" className="text-primary underline">
                OpenBMB/VoxCPM
              </a>
            </p>
            <p>
              <strong>Hardware:</strong> Recommended 24GB+ VRAM for 1B model. Use gradient accumulation for lower VRAM.
            </p>
          </div>
        </div>
      </Card>

      {/* Filters */}
      <Card variant="outlined" className="p-4">
        <div className="flex flex-wrap items-center gap-4">
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

      {/* Jobs List */}
      <Card variant="default">
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
              <p className="mt-2 text-muted">Loading fine-tuning jobs...</p>
            </div>
          ) : jobs.length === 0 ? (
            <div className="p-12 text-center">
              <FlaskConical className="h-16 w-16 mx-auto mb-4 opacity-30" />
              <h3 className="text-lg font-medium text-text mb-2">No fine-tuning jobs</h3>
              <p className="text-muted mb-4">
                {status ? 'Try adjusting your filters' : 'Create your first fine-tuning job to get started'}
              </p>
              {!status && (
                <Button onClick={() => setShowCreateModal(true)}>
                  <Plus className="h-4 w-4" />
                  Create Fine-tuning Job
                </Button>
              )}
            </div>
          ) : (
            <>
              <div className="divide-y divide-border">
                {jobs.map((job) => (
                  <div key={job.id} className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <Badge
                            variant={
                              job.status === 'completed' ? 'success' :
                              job.status === 'failed' ? 'error' :
                              job.status === 'running' ? 'info' :
                              job.status === 'cancelled' ? 'warning' : 'default'
                            }
                          >
                            {job.status}
                          </Badge>
                          <span className="text-sm text-muted font-mono">{job.id}</span>
                        </div>
                        <p className="text-sm text-muted mb-1">
                          Base: {job.config.pretrained_path} • LoRA r={job.config.lora.r} α={job.config.lora.alpha}
                        </p>
                        <p className="text-sm text-muted">
                          Train: {job.config.train_manifest} • Steps: {job.current_step}/{job.total_steps}
                          {job.current_loss !== undefined && ` • Loss: ${job.current_loss.toFixed(4)}`}
                        </p>
                        {job.status === 'running' && (
                          <div className="mt-2 h-2 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-primary transition-all"
                              style={{ width: `${(job.current_step / job.total_steps) * 100}%` }}
                            />
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {job.status === 'running' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleCancel(job)}
                          >
                            <StopCircle className="h-4 w-4" />
                            Cancel
                          </Button>
                        )}
                        {job.status === 'completed' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              // Download checkpoint
                            }}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-error hover:bg-red-50"
                          onClick={() => handleDelete(job)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
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

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-surface rounded-xl shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-primary-light rounded-lg">
                  <FlaskConical className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-text">Create Fine-tuning Job</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setShowCreateModal(false)} disabled={creating}>
                <X className="h-5 w-5" />
              </Button>
            </div>

            <form onSubmit={handleCreate} className="flex-1 overflow-y-auto p-4 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Job Name"
                  placeholder="my-finetune-job"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
                <Input
                  type="number"
                  label="Max Steps"
                  value={formData.max_steps}
                  onChange={(e) => setFormData({ ...formData, max_steps: parseInt(e.target.value) })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Pretrained Model Path"
                  value={formData.pretrained_path}
                  onChange={(e) => setFormData({ ...formData, pretrained_path: e.target.value })}
                />
                <Input
                  label="Train Manifest (JSONL)"
                  value={formData.train_manifest}
                  onChange={(e) => setFormData({ ...formData, train_manifest: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Validation Manifest (Optional)"
                  value={formData.val_manifest}
                  onChange={(e) => setFormData({ ...formData, val_manifest: e.target.value })}
                />
                <Input
                  label="Save Path"
                  value={formData.save_path}
                  onChange={(e) => setFormData({ ...formData, save_path: e.target.value })}
                />
              </div>

              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer text-sm font-medium text-text">
                  <span>LoRA Configuration</span>
                  <span className="text-muted transition-transform group-open:rotate-180">▼</span>
                </summary>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border">
                  <Input
                    type="number"
                    label="LoRA Rank (r)"
                    value={formData.lora_r}
                    onChange={(e) => setFormData({ ...formData, lora_r: parseInt(e.target.value) })}
                  />
                  <Input
                    type="number"
                    label="LoRA Alpha"
                    value={formData.lora_alpha}
                    onChange={(e) => setFormData({ ...formData, lora_alpha: parseInt(e.target.value) })}
                  />
                  <Input
                    type="number"
                    step="0.1"
                    label="LoRA Dropout"
                    value={formData.lora_dropout}
                    onChange={(e) => setFormData({ ...formData, lora_dropout: parseFloat(e.target.value) })}
                  />
                  <div className="flex items-center gap-2 mt-6">
                    <input
                      type="checkbox"
                      id="enable_lm"
                      checked={formData.enable_lm}
                      onChange={(e) => setFormData({ ...formData, enable_lm: e.target.checked })}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <label htmlFor="enable_lm" className="text-sm text-text">Enable LM</label>
                  </div>
                  <div className="flex items-center gap-2 mt-6">
                    <input
                      type="checkbox"
                      id="enable_dit"
                      checked={formData.enable_dit}
                      onChange={(e) => setFormData({ ...formData, enable_dit: e.target.checked })}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <label htmlFor="enable_dit" className="text-sm text-text">Enable DiT</label>
                  </div>
                  <div className="flex items-center gap-2 mt-6">
                    <input
                      type="checkbox"
                      id="enable_proj"
                      checked={formData.enable_proj}
                      onChange={(e) => setFormData({ ...formData, enable_proj: e.target.checked })}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary"
                    />
                    <label htmlFor="enable_proj" className="text-sm text-text">Enable Proj</label>
                  </div>
                </div>
              </details>

              <details className="group">
                <summary className="flex items-center justify-between cursor-pointer text-sm font-medium text-text">
                  <span>Training Parameters</span>
                  <span className="text-muted transition-transform group-open:rotate-180">▼</span>
                </summary>
                <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border">
                  <Input
                    type="number"
                    label="Batch Size"
                    value={formData.batch_size}
                    onChange={(e) => setFormData({ ...formData, batch_size: parseInt(e.target.value) })}
                  />
                  <Input
                    type="number"
                    label="Grad Accum Steps"
                    value={formData.grad_accum_steps}
                    onChange={(e) => setFormData({ ...formData, grad_accum_steps: parseInt(e.target.value) })}
                  />
                  <Input
                    type="number"
                    label="Learning Rate"
                    step="0.00001"
                    value={formData.learning_rate}
                    onChange={(e) => setFormData({ ...formData, learning_rate: parseFloat(e.target.value) })}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    label="Weight Decay"
                    value={formData.weight_decay}
                    onChange={(e) => setFormData({ ...formData, weight_decay: parseFloat(e.target.value) })}
                  />
                  <Input
                    type="number"
                    label="Warmup Steps"
                    value={formData.warmup_steps}
                    onChange={(e) => setFormData({ ...formData, warmup_steps: parseInt(e.target.value) })}
                  />
                  <Input
                    type="number"
                    step="0.1"
                    label="Max Grad Norm"
                    value={formData.max_grad_norm}
                    onChange={(e) => setFormData({ ...formData, max_grad_norm: parseFloat(e.target.value) })}
                  />
                </div>
              </details>
            </form>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-border">
              <Button variant="secondary" onClick={() => setShowCreateModal(false)} disabled={creating}>
                Cancel
              </Button>
              <Button type="submit" form="finetune-form" variant="primary" loading={creating} disabled={creating}>
                <Loader2 className="h-4 w-4 animate-spin" />
                {creating ? 'Creating...' : 'Create Job'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

import { X } from 'lucide-react'