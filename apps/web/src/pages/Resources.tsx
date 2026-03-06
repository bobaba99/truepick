import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ResourceListItem } from '../api/core/types'
import { getPublishedResources } from '../api/resource/resourceService'
import { GlassCard, LiquidButton } from '../components/Kinematics'
import { useUserFormatting } from '../preferences/UserPreferencesContext'

type SafeLink = {
  href: string
  external: boolean
}

const getSafeLink = (value: string | null): SafeLink | null => {
  if (!value) {
    return null
  }

  try {
    const parsed = new URL(value, window.location.origin)
    const isHttp = parsed.protocol === 'http:' || parsed.protocol === 'https:'
    if (!isHttp) {
      return null
    }
    return {
      href: parsed.href,
      external: parsed.origin !== window.location.origin,
    }
  } catch {
    return null
  }
}

export default function Resources() {
  const { formatDate } = useUserFormatting()
  const [resources, setResources] = useState<ResourceListItem[]>([])
  const [status, setStatus] = useState('')

  const loadResources = useCallback(async () => {
    try {
      const data = await getPublishedResources()
      setResources(data)
      setStatus('')
    } catch (error) {
      setStatus(
        `Unable to load resources: ${error instanceof Error ? error.message : 'Unknown error'}`
      )
    }
  }, [])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadResources()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadResources])

  return (
    <section className="route-content">
      <h1>Resources</h1>
      <p>
        Educational articles on impulse buying, purchase psychology, and practical
        decision frameworks.
      </p>

      {status && <div className="status error">{status}</div>}

      {resources.length === 0 ? (
        <div className="empty-card">No published resources yet.</div>
      ) : (
        <div className="resources-grid">
          {resources.map((resource) => {
            const ctaLink = getSafeLink(resource.cta_url)
            const publishedDate = resource.published_at ?? resource.created_at

            return (
              <GlassCard key={resource.id} className="verdict-card resource-card">
                <div className="verdict-card-content">
                  {resource.cover_image_url && (
                    <img className="resource-cover" src={resource.cover_image_url} alt="" />
                  )}
                  <span className="stat-value resource-title">{resource.title}</span>
                  <p className="resource-summary">{resource.summary}</p>
                  <div className="meta-chips">
                    {resource.reading_time_minutes && (
                      <span className="meta-chip">{resource.reading_time_minutes} min read</span>
                    )}
                    {Array.isArray(resource.tags) && resource.tags.map((tag) => (
                      <span key={tag} className="meta-chip">{tag}</span>
                    ))}
                  </div>
                </div>
                <div className="verdict-actions">
                  <LiquidButton
                    as={Link}
                    to={`/resources/${resource.slug}`}
                    className="primary"
                    aria-label={`Read more about ${resource.title}`}
                  >
                    Read more
                  </LiquidButton>
                  {ctaLink && (
                    <LiquidButton
                      as="a"
                      href={ctaLink.href}
                      target={ctaLink.external ? '_blank' : undefined}
                      rel={ctaLink.external ? 'noopener noreferrer' : undefined}
                      className="ghost"
                    >
                      Try verdict tool
                    </LiquidButton>
                  )}
                </div>
              </GlassCard>
            )
          })}
        </div>
      )}
    </section>
  )
}
