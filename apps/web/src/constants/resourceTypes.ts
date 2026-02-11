/**
 * Resource/article types for educational content
 * Used by: adminResourceService, resourceService, AdminResources, Resources pages
 */

/**
 * Complete database row for a resource article
 */
export type ResourceRow = {
  id: string
  slug: string
  title: string
  summary: string
  body_markdown: string
  tags: string[]
  reading_time_minutes: number | null
  canonical_url: string | null
  cover_image_url: string | null
  cta_url: string | null
  is_published: boolean
  published_at: string | null
  created_at: string | null
  updated_at: string | null
}

/**
 * Subset of resource fields for list/preview display
 * Excludes body_markdown and updated_at to reduce payload size
 */
export type ResourceListItem = Pick<
  ResourceRow,
  | 'id'
  | 'slug'
  | 'title'
  | 'summary'
  | 'tags'
  | 'reading_time_minutes'
  | 'canonical_url'
  | 'cover_image_url'
  | 'cta_url'
  | 'published_at'
  | 'created_at'
>

/**
 * Input data for creating or updating a resource
 * Uses camelCase for frontend, converted to snake_case for database
 */
export type ResourceUpsertInput = {
  slug: string
  title: string
  summary: string
  bodyMarkdown: string
  tags: string[]
  canonicalUrl: string | null
  coverImageUrl: string | null
  ctaUrl: string | null
  isPublished: boolean
  publishedAt: string | null
}
