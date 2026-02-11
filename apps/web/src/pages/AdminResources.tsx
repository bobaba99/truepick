import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { Session } from '@supabase/supabase-js'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'
import {
  createAdminResource,
  deleteAdminResource,
  getAdminResources,
  publishAdminResource,
  unpublishAdminResource,
  updateAdminResource,
  uploadAdminResourceImage,
} from '../api/adminResourceService'
import type { ResourceRow, ResourceUpsertInput } from '../api/types'
import { RECOMMENDED_TAGS } from '../constants/resourceTags'
import { GlassCard, LiquidButton, VolumetricInput } from '../components/Kinematics'

type AdminResourcesProps = {
  session: Session | null
}

type StatusMessage = {
  type: 'error' | 'success' | 'info'
  message: string
}

const buildSlug = (title: string) =>
  title
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')

const buildResourceUrl = (slugValue: string) => {
  if (!slugValue.trim()) return ''
  return `${window.location.origin}/resources/${slugValue.trim()}`
}

export default function AdminResources({ session }: AdminResourcesProps) {
  const editorContainerRef = useRef<HTMLDivElement | null>(null)
  const quillRef = useRef<Quill | null>(null)
  const accessTokenRef = useRef(session?.access_token ?? '')

  const [resources, setResources] = useState<ResourceRow[]>([])
  const [selectedResourceId, setSelectedResourceId] = useState<string | null>(null)
  const [status, setStatus] = useState<StatusMessage | null>(null)
  const [saving, setSaving] = useState(false)
  const [imageUploading, setImageUploading] = useState(false)

  const [slug, setSlug] = useState('')
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [newTagInput, setNewTagInput] = useState('')
  const [showTagDropdown, setShowTagDropdown] = useState(false)
  const tagDropdownRef = useRef<HTMLDivElement>(null)

  const [canonicalUrl, setCanonicalUrl] = useState('')
  const [coverImageUrl, setCoverImageUrl] = useState('')
  const [ctaUrl, setCtaUrl] = useState('')
  const [bodyMarkdown, setBodyMarkdown] = useState('')
  const [isPublished, setIsPublished] = useState(false)
  const [publishedAt, setPublishedAt] = useState<string | null>(null)

  const selectedResource = useMemo(
    () => resources.find((resource) => resource.id === selectedResourceId) ?? null,
    [resources, selectedResourceId]
  )

  const resetForm = useCallback(() => {
    setSelectedResourceId(null)
    setSlug('')
    setTitle('')
    setSummary('')
    setSelectedTags([])
    setNewTagInput('')

    setCanonicalUrl('')
    setCoverImageUrl('')
    setCtaUrl('')
    setBodyMarkdown('')
    setIsPublished(false)
    setPublishedAt(null)

    if (quillRef.current) {
      quillRef.current.root.innerHTML = ''
    }
  }, [])

  const hydrateForm = useCallback((resource: ResourceRow) => {
    setSelectedResourceId(resource.id)
    setSlug(resource.slug)
    setTitle(resource.title)
    setSummary(resource.summary)
    setSelectedTags(resource.tags)
    setNewTagInput('')

    setCanonicalUrl(resource.canonical_url ?? '')
    setCoverImageUrl(resource.cover_image_url ?? '')
    setCtaUrl(resource.cta_url ?? '')
    setBodyMarkdown(resource.body_markdown)
    setIsPublished(resource.is_published)
    setPublishedAt(resource.published_at ?? null)

    if (quillRef.current) {
      quillRef.current.root.innerHTML = resource.body_markdown
    }
  }, [])

  const loadResources = useCallback(async () => {
    if (!session?.access_token) {
      setStatus({ type: 'error', message: 'Sign in to access the admin editor.' })
      return
    }
    try {
      const data = await getAdminResources(session.access_token)
      setResources(data)
      setStatus(null)
    } catch (error) {
      setResources([])
      setStatus({
        type: 'error',
        message: `Unable to load articles: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    }
  }, [session])

  useEffect(() => {
    accessTokenRef.current = session?.access_token ?? ''
  }, [session])

  useEffect(() => {
    if (!editorContainerRef.current || quillRef.current) {
      return
    }

    const quill = new Quill(editorContainerRef.current, {
      theme: 'snow',
      modules: {
        toolbar: [
          [{ size: ['small', false, 'large', 'huge'] }],
          ['bold', 'italic', 'underline', 'strike'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['link', 'image'],
          ['clean'],
        ],
      },
      formats: ['size', 'bold', 'italic', 'underline', 'strike', 'list', 'bullet', 'link', 'image'],
    })

    quill.on('text-change', () => {
      setBodyMarkdown(quill.root.innerHTML)
    })

    quill.getModule('toolbar').addHandler('image', () => {
      const fileInput = document.createElement('input')
      fileInput.type = 'file'
      fileInput.accept = 'image/png,image/jpeg,image/gif'
      fileInput.click()

      fileInput.onchange = async () => {
        const file = fileInput.files?.[0]
        if (!file) {
          return
        }

        if (!accessTokenRef.current) {
          setStatus({
            type: 'error',
            message: 'Your session expired. Sign in again to upload images.',
          })
          return
        }

        setImageUploading(true)
        setStatus(null)
        try {
          const imageUrl = await uploadAdminResourceImage(accessTokenRef.current, file)
          const selection = quill.getSelection(true)
          const index = selection?.index ?? quill.getLength()
          quill.insertEmbed(index, 'image', imageUrl, 'user')
          quill.setSelection(index + 1)
        } catch (error) {
          setStatus({
            type: 'error',
            message: `Image upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          })
        } finally {
          setImageUploading(false)
        }
      }
    })

    quillRef.current = quill
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadResources()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadResources])

  // Close tag dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (tagDropdownRef.current && !tagDropdownRef.current.contains(event.target as Node)) {
        setShowTagDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Auto-populate canonical and CTA URLs based on slug
  const autoGeneratedUrl = useMemo(() => buildResourceUrl(slug || buildSlug(title)), [slug, title])

  useEffect(() => {
    if (!autoGeneratedUrl) return

    // Only auto-fill if the field is empty or matches a previously auto-generated URL
    const isCanonicalEmpty = !canonicalUrl.trim()
    const isCanonicalAutoGenerated = canonicalUrl.includes('/resources/')
    if (isCanonicalEmpty || isCanonicalAutoGenerated) {
      setCanonicalUrl(autoGeneratedUrl)
    }

    const isCtaEmpty = !ctaUrl.trim()
    const isCtaAutoGenerated = ctaUrl.includes('/resources/')
    if (isCtaEmpty || isCtaAutoGenerated) {
      setCtaUrl(autoGeneratedUrl)
    }
  }, [autoGeneratedUrl])

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    )
  }

  const addNewTag = () => {
    const trimmed = newTagInput.trim().toLowerCase().replace(/\s+/g, '-')
    if (trimmed && !selectedTags.includes(trimmed)) {
      setSelectedTags((prev) => [...prev, trimmed])
    }
    setNewTagInput('')
    setShowTagDropdown(false)
  }

  const removeTag = (tag: string) => {
    setSelectedTags((prev) => prev.filter((t) => t !== tag))
  }

  const availableTags = useMemo(() => {
    const unselectedTags = RECOMMENDED_TAGS.filter((tag) => !selectedTags.includes(tag))
    if (!newTagInput.trim()) {
      return unselectedTags
    }
    const searchTerm = newTagInput.trim().toLowerCase()
    return unselectedTags.filter((tag) => tag.toLowerCase().includes(searchTerm))
  }, [selectedTags, newTagInput])

  const handleSave = async () => {
    if (!session?.access_token) {
      setStatus({ type: 'error', message: 'Sign in to access the admin editor.' })
      return
    }

    const normalizedSlug = slug.trim() || buildSlug(title)
    if (!normalizedSlug || !title.trim() || !summary.trim()) {
      setStatus({ type: 'error', message: 'Slug, title, and summary are required.' })
      return
    }

    if (selectedTags.length === 0) {
      setStatus({ type: 'error', message: 'At least one tag is required.' })
      return
    }

    if (!bodyMarkdown || bodyMarkdown === '<p><br></p>') {
      setStatus({ type: 'error', message: 'Article body is required.' })
      return
    }

    const payload: ResourceUpsertInput = {
      slug: normalizedSlug,
      title: title.trim(),
      summary: summary.trim(),
      bodyMarkdown,
      tags: selectedTags,

      canonicalUrl: canonicalUrl.trim() || null,
      coverImageUrl: coverImageUrl.trim() || null,
      ctaUrl: ctaUrl.trim() || null,
      isPublished,
      publishedAt,
    }

    setSaving(true)
    setStatus(null)
    try {
      const savedResource = selectedResourceId
        ? await updateAdminResource(session.access_token, selectedResourceId, payload)
        : await createAdminResource(session.access_token, payload)

      await loadResources()
      hydrateForm(savedResource)
      setStatus({ type: 'success', message: 'Article saved.' })
    } catch (error) {
      setStatus({
        type: 'error',
        message: `Save failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    } finally {
      setSaving(false)
    }
  }

  const togglePublish = async () => {
    if (!session?.access_token || !selectedResourceId) {
      return
    }

    setSaving(true)
    setStatus(null)
    try {
      const updatedResource = isPublished
        ? await unpublishAdminResource(session.access_token, selectedResourceId)
        : await publishAdminResource(session.access_token, selectedResourceId)
      await loadResources()
      hydrateForm(updatedResource)
      setStatus({
        type: 'success',
        message: isPublished ? 'Article unpublished.' : 'Article published.',
      })
    } catch (error) {
      setStatus({
        type: 'error',
        message: `Publish action failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!session?.access_token || !selectedResourceId || !selectedResource) {
      return
    }
    const confirmed = window.confirm(
      `Delete "${selectedResource.title}"? This cannot be undone.`
    )
    if (!confirmed) {
      return
    }

    setSaving(true)
    setStatus(null)
    try {
      await deleteAdminResource(session.access_token, selectedResourceId)
      resetForm()
      await loadResources()
      setStatus({ type: 'success', message: 'Article deleted.' })
    } catch (error) {
      setStatus({
        type: 'error',
        message: `Delete failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <section className="route-content">
      <div className="section-header">
        <h1>Admin Article Editor</h1>
        <div className="header-actions">
          <LiquidButton className="ghost" type="button" onClick={resetForm}>
            New article
          </LiquidButton>
          <LiquidButton className="primary" type="button" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </LiquidButton>
          <LiquidButton
            className="ghost"
            type="button"
            onClick={togglePublish}
            disabled={!selectedResourceId || saving}
          >
            {isPublished ? 'Unpublish' : 'Publish'}
          </LiquidButton>
          <LiquidButton
            className="ghost"
            type="button"
            onClick={handleDelete}
            disabled={!selectedResourceId || saving}
          >
            Delete
          </LiquidButton>
        </div>
      </div>

      {status && <div className={`status ${status.type}`}>{status.message}</div>}
      {imageUploading && <div className="status info">Uploading image...</div>}

      <div className="dashboard-grid">
        <div className="verdict-result">
          <h2>Articles</h2>
          {resources.length === 0 ? (
            <div className="empty-card">No articles found.</div>
          ) : (
            <div className="verdict-list">
              {resources.map((resource) => (
                <GlassCard key={resource.id} className="verdict-card">
                  <div className="verdict-card-content">
                    <span className="stat-value">{resource.title}</span>
                    <div className="verdict-meta">
                      <span>Slug: {resource.slug}</span>
                      <span>Status: {resource.is_published ? 'Published' : 'Draft'}</span>
                    </div>
                  </div>
                  <div className="verdict-actions">
                    <LiquidButton
                      className="link"
                      type="button"
                      onClick={() => hydrateForm(resource)}
                    >
                      Edit
                    </LiquidButton>
                  </div>
                </GlassCard>
              ))}
            </div>
          )}
        </div>

        <div className="decision-section">
          <h2>{selectedResource ? `Editing: ${selectedResource.title}` : 'New article'}</h2>
          <form className="decision-form" onSubmit={(event) => event.preventDefault()}>
            <label>
              <span className="label-text">Slug <span className="required">*</span></span>
              <VolumetricInput
                as="input"
                value={slug}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setSlug(event.target.value)
                }
                placeholder="impulse-buying-framework"
              />
            </label>
            <label>
              <span className="label-text">Title <span className="required">*</span></span>
              <VolumetricInput
                as="input"
                value={title}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setTitle(event.target.value)
                }
                placeholder="A Practical Framework for Impulse Purchases"
                required
              />
            </label>
            <label>
              <span className="label-text">Summary <span className="required">*</span></span>
              <VolumetricInput
                as="textarea"
                value={summary}
                  onChange={(event: ChangeEvent<HTMLTextAreaElement>) =>
                  setSummary(event.target.value)
                }
                rows={3}
              />
            </label>
            <div className="form-group" ref={tagDropdownRef}>
              <label className="tags-label">
                <span className="label-text">Tags <span className="required">*</span></span>
              </label>
              <div className="tags-container">
                {selectedTags.map((tag) => (
                  <span key={tag} className="tag-pill">
                    {tag}
                    <button
                      type="button"
                      className="tag-remove"
                      onClick={() => removeTag(tag)}
                      aria-label={`Remove ${tag}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
                <div className="tag-input-wrapper">
                  <input
                    type="text"
                    className="tag-input"
                    value={newTagInput}
                    onChange={(e) => setNewTagInput(e.target.value)}
                    onFocus={() => setShowTagDropdown(true)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addNewTag()
                      }
                    }}
                    placeholder={selectedTags.length === 0 ? 'Select or type a tag...' : 'Add tag...'}
                  />
                  {showTagDropdown && (
                    <div className="tag-dropdown">
                      {newTagInput.trim() && !(RECOMMENDED_TAGS as readonly string[]).includes(newTagInput.trim().toLowerCase()) && (
                        <button
                          type="button"
                          className="tag-option create-new"
                          onClick={addNewTag}
                        >
                          + Create "{newTagInput.trim().toLowerCase().replace(/\s+/g, '-')}"
                        </button>
                      )}
                      {availableTags.length > 0 && (
                        <div className="tag-section">
                          <div className="tag-section-title">Recommended</div>
                          {availableTags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              className="tag-option"
                              onClick={() => toggleTag(tag)}
                            >
                              {tag}
                            </button>
                          ))}
                        </div>
                      )}
                      {selectedTags.length > 0 && (
                        <div className="tag-section">
                          <div className="tag-section-title">Selected</div>
                          {selectedTags.map((tag) => (
                            <button
                              key={tag}
                              type="button"
                              className="tag-option selected"
                              onClick={() => removeTag(tag)}
                            >
                              ✓ {tag}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
            <label>
              <span className="label-text">Canonical URL</span>
              <VolumetricInput
                as="input"
                value={canonicalUrl}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setCanonicalUrl(event.target.value)
                }
                placeholder="https://example.com/resources/article-slug"
              />
            </label>
            <label>
              Cover image URL
              <VolumetricInput
                as="input"
                value={coverImageUrl}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setCoverImageUrl(event.target.value)
                }
              />
            </label>
            <label>
              CTA URL
              <VolumetricInput
                as="input"
                value={ctaUrl}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setCtaUrl(event.target.value)
                }
                  placeholder="https://your-domain.com/auth"
              />
            </label>
            <div className="toggle-row">
              <input
                id="publish-toggle"
                type="checkbox"
                checked={isPublished}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setIsPublished(event.target.checked)
                }
              />
              <span className="toggle-label">Published</span>
            </div>
            <div className="editor-label">
              Body content <span className="required">*</span>
            </div>
            <div className="admin-editor-shell">
              <div ref={editorContainerRef} />
            </div>
          </form>
        </div>
      </div>
    </section>
  )
}
