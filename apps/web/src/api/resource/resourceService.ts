import { supabase } from '../core/supabaseClient'
import type { ResourceListItem, ResourceRow } from '../core/types'

export async function getResourceBySlug(slug: string): Promise<ResourceRow | null> {
  const { data, error } = await supabase
    .from('resources')
    .select(
      'id, slug, title, summary, body_markdown, tags, reading_time_minutes, canonical_url, cover_image_url, cta_url, is_published, published_at, created_at, updated_at'
    )
    .eq('slug', slug)
    .eq('is_published', true)
    .maybeSingle()

  if (error) {
    throw new Error(error.message)
  }

  return (data as ResourceRow) ?? null
}

export async function getPublishedResources(limit = 50): Promise<ResourceListItem[]> {
  const { data, error } = await supabase
    .from('resources')
    .select(
      'id, slug, title, summary, tags, reading_time_minutes, canonical_url, cover_image_url, cta_url, published_at, created_at'
    )
    .eq('is_published', true)
    .order('published_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false, nullsFirst: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as ResourceListItem[]
}
