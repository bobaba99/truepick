import type { ResourceRow } from './types'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

type ResourceUpsertInput = {
  slug: string
  title: string
  summary: string
  bodyMarkdown: string
  category: string
  tags: string[]
  canonicalUrl: string | null
  coverImageUrl: string | null
  ctaUrl: string | null
  isPublished: boolean
  publishedAt: string | null
}

const WORDS_PER_MINUTE = 200

const stripHtml = (html: string): string => {
  const tmp = document.createElement('div')
  tmp.innerHTML = html
  return tmp.textContent || tmp.innerText || ''
}

const calculateReadingTime = (title: string, summary: string, bodyMarkdown: string): number => {
  const text = `${title} ${summary} ${stripHtml(bodyMarkdown)}`
  const wordCount = text.trim().split(/\s+/).filter(word => word.length > 0).length
  return Math.max(1, Math.ceil(wordCount / WORDS_PER_MINUTE))
}

const withAuthHeaders = (accessToken: string, extraHeaders?: Record<string, string>) => ({
  Authorization: `Bearer ${accessToken}`,
  ...(extraHeaders ?? {}),
})

const assertOk = async (response: Response) => {
  if (response.ok) return
  let message = `Request failed with status ${response.status}`
  try {
    const payload = (await response.json()) as { error?: string }
    if (payload.error) {
      message = payload.error
    }
  } catch {
    // no-op fallback for non-json responses
  }
  throw new Error(message)
}

export async function getAdminResources(accessToken: string): Promise<ResourceRow[]> {
  const response = await fetch(`${API_BASE_URL}/admin/resources`, {
    headers: withAuthHeaders(accessToken),
  })
  await assertOk(response)
  const payload = (await response.json()) as { data: ResourceRow[] }
  return payload.data ?? []
}

export async function createAdminResource(
  accessToken: string,
  input: ResourceUpsertInput
): Promise<ResourceRow> {
  const readingTimeMinutes = calculateReadingTime(input.title, input.summary, input.bodyMarkdown)
  const response = await fetch(`${API_BASE_URL}/admin/resources`, {
    method: 'POST',
    headers: withAuthHeaders(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ...input, readingTimeMinutes }),
  })
  await assertOk(response)
  const payload = (await response.json()) as { data: ResourceRow }
  return payload.data
}

export async function updateAdminResource(
  accessToken: string,
  resourceId: string,
  input: ResourceUpsertInput
): Promise<ResourceRow> {
  const readingTimeMinutes = calculateReadingTime(input.title, input.summary, input.bodyMarkdown)
  const response = await fetch(`${API_BASE_URL}/admin/resources/${resourceId}`, {
    method: 'PUT',
    headers: withAuthHeaders(accessToken, { 'Content-Type': 'application/json' }),
    body: JSON.stringify({ ...input, readingTimeMinutes }),
  })
  await assertOk(response)
  const payload = (await response.json()) as { data: ResourceRow }
  return payload.data
}

export async function publishAdminResource(
  accessToken: string,
  resourceId: string
): Promise<ResourceRow> {
  const response = await fetch(`${API_BASE_URL}/admin/resources/${resourceId}/publish`, {
    method: 'POST',
    headers: withAuthHeaders(accessToken),
  })
  await assertOk(response)
  const payload = (await response.json()) as { data: ResourceRow }
  return payload.data
}

export async function unpublishAdminResource(
  accessToken: string,
  resourceId: string
): Promise<ResourceRow> {
  const response = await fetch(`${API_BASE_URL}/admin/resources/${resourceId}/unpublish`, {
    method: 'POST',
    headers: withAuthHeaders(accessToken),
  })
  await assertOk(response)
  const payload = (await response.json()) as { data: ResourceRow }
  return payload.data
}

export async function deleteAdminResource(
  accessToken: string,
  resourceId: string
): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/admin/resources/${resourceId}`, {
    method: 'DELETE',
    headers: withAuthHeaders(accessToken),
  })
  await assertOk(response)
}

export async function uploadAdminResourceImage(
  accessToken: string,
  image: File
): Promise<string> {
  const formData = new FormData()
  formData.append('image', image)

  const response = await fetch(`${API_BASE_URL}/admin/resources/upload-image`, {
    method: 'POST',
    headers: withAuthHeaders(accessToken),
    body: formData,
  })
  await assertOk(response)
  const payload = (await response.json()) as { url: string }
  return payload.url
}

export type { ResourceUpsertInput }
