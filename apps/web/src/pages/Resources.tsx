import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ResourceListItem } from '../api/core/types'
import { getPublishedResources } from '../api/resource/resourceService'
import { GlassCard, LiquidButton } from '../components/Kinematics'

const formatPublishedDate = (value: string | null) => {
  if (!value) {
    return null
  }
  return new Date(value).toLocaleDateString()
}

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

            return (
              <GlassCard key={resource.id} className="verdict-card">
                <div className="verdict-card-content">
                  <div>
                    <span className="stat-value">{resource.title}</span>
                  </div>
                  <div className="verdict-meta">
                    <span>{resource.summary}</span>
                    {resource.reading_time_minutes && (
                      <span>Reading time: {resource.reading_time_minutes} min</span>
                    )}
                    {formatPublishedDate(resource.published_at ?? resource.created_at) && (
                      <span>
                        Published:{' '}
                        {formatPublishedDate(resource.published_at ?? resource.created_at)}
                      </span>
                    )}
                    {Array.isArray(resource.tags) && resource.tags.length > 0 && (
                      <span>Tags: {resource.tags.join(', ')}</span>
                    )}
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
