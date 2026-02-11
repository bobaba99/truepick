import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import type { ResourceRow } from '../api/types'
import { getResourceBySlug } from '../api/resourceService'
import { GlassCard } from '../components/Kinematics'

const formatPublishedDate = (value: string | null): string | null => {
  if (!value) {
    return null
  }
  return new Date(value).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function ResourceDetail() {
  const { slug } = useParams<{ slug: string }>()
  const [resource, setResource] = useState<ResourceRow | null>(null)
  const [status, setStatus] = useState<'loading' | 'error' | 'not_found' | 'ready'>('loading')
  const [errorMessage, setErrorMessage] = useState('')

  const loadResource = useCallback(async () => {
    if (!slug) {
      setStatus('not_found')
      return
    }

    setStatus('loading')
    try {
      const data = await getResourceBySlug(slug)
      if (!data) {
        setStatus('not_found')
        return
      }
      setResource(data)
      setStatus('ready')
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : 'Unknown error')
      setStatus('error')
    }
  }, [slug])

  useEffect(() => {
    void loadResource()
  }, [loadResource])

  if (status === 'loading') {
    return (
      <section className="route-content">
        <div className="loading-state">Loading article...</div>
      </section>
    )
  }

  if (status === 'not_found') {
    return (
      <section className="route-content">
        <GlassCard className="empty-card">
          <h2>Article not found</h2>
          <p>The article you're looking for doesn't exist or hasn't been published yet.</p>
          <Link to="/resources" className="back-link">
            Back to Resources
          </Link>
        </GlassCard>
      </section>
    )
  }

  if (status === 'error') {
    return (
      <section className="route-content">
        <div className="status error">Unable to load article: {errorMessage}</div>
        <Link to="/resources" className="back-link">
          Back to Resources
        </Link>
      </section>
    )
  }

  if (!resource) {
    return null
  }

  const publishedDate = formatPublishedDate(resource.published_at ?? resource.created_at)

  return (
    <section className="route-content resource-detail">
      <nav className="breadcrumb">
        <Link to="/resources">Resources</Link>
        <span className="separator">/</span>
        <span className="current">{resource.title}</span>
      </nav>

      <article className="article-content">
        {resource.cover_image_url && (
          <div className="cover-image">
            <img src={resource.cover_image_url} alt={resource.title} />
          </div>
        )}

        <header className="article-header">
          <h1>{resource.title}</h1>
          <div className="article-meta">
            {publishedDate && <span className="published-date">{publishedDate}</span>}
            {resource.reading_time_minutes && (
              <span className="reading-time">{resource.reading_time_minutes} min read</span>
            )}
          </div>
          {resource.tags.length > 0 && (
            <div className="article-tags">
              {resource.tags.map((tag) => (
                <span key={tag} className="tag-pill">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </header>

        <div className="article-summary">
          <p>{resource.summary}</p>
        </div>

        <div
          className="article-body"
          dangerouslySetInnerHTML={{ __html: resource.body_markdown }}
        />
      </article>

      <footer className="article-footer">
        <Link to="/resources" className="back-link">
          Back to Resources
        </Link>
      </footer>
    </section>
  )
}
