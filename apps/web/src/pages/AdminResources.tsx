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
  type ResourceUpsertInput,
} from '../api/adminResourceService'
import type { ResourceRow } from '../api/types'
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
  const [category, setCategory] = useState('')
  const [tagsText, setTagsText] = useState('')

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
    setCategory('')
    setTagsText('')

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
    setCategory(resource.category ?? '')
    setTagsText(resource.tags.join(', '))

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

    if (!category.trim()) {
      setStatus({ type: 'error', message: 'Category is required.' })
      return
    }

    const tags = tagsText
      .split(',')
      .map((tag) => tag.trim())
      .filter((tag) => tag.length > 0)
    if (tags.length === 0) {
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
      category: category.trim(),
      tags,

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
            <label>
              <span className="label-text">Category <span className="required">*</span></span>
              <VolumetricInput
                as="input"
                value={category}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setCategory(event.target.value)
                }
              />
            </label>
            <label>
              <span className="label-text">Tags (comma separated) <span className="required">*</span></span>
              <VolumetricInput
                as="input"
                value={tagsText}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setTagsText(event.target.value)
                }
                placeholder="impulse, framework, psychology"
              />
            </label>
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
