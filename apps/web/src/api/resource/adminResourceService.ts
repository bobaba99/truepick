import type { ResourceRow, ResourceUpsertInput } from '../core/types'
import { calculateReadingTime } from '../core/utils'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000'

const withAuthHeaders = (accessToken: string, extraHeaders?: Record<string, string>) => ({
  Authorization: `Bearer ${accessToken}`,
  ...(extraHeaders ?? {}),
})

const assertOk = async (response: Response): Promise<void> => {
  if (response.ok) return

  let message = `Request failed with status ${response.status}`
  try {
    const payload = (await response.json()) as { error?: string }
    if (payload.error) {
      message = payload.error
    }
  } catch {
    // Fallback for non-JSON responses
  }
  throw new Error(message)
}

/**
 * Fetches all resources for admin management
 * @param accessToken - Supabase JWT token with admin privileges
 * @returns Array of resource rows with full metadata
 * @throws Error if request fails or user lacks permissions
 */
export async function getAdminResources(accessToken: string): Promise<ResourceRow[]> {
  const response = await fetch(`${API_BASE_URL}/admin/resources`, {
    headers: withAuthHeaders(accessToken),
  })
  await assertOk(response)
  const payload = (await response.json()) as { data: ResourceRow[] }
  return payload.data ?? []
}

/**
 * Creates a new admin resource article
 * Automatically calculates reading time based on content length
 * @param accessToken - Supabase JWT token with admin privileges
 * @param input - Resource data to create (slug, title, summary, body, tags, etc.)
 * @returns The newly created resource with server-generated fields
 * @throws Error if creation fails or validation errors occur
 */
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

/**
 * Updates an existing admin resource article
 * Automatically recalculates reading time based on updated content
 * @param accessToken - Supabase JWT token with admin privileges
 * @param resourceId - UUID of the resource to update
 * @param input - Updated resource data
 * @returns The updated resource with all current fields
 * @throws Error if update fails, resource not found, or validation errors occur
 */
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

/**
 * Publishes an admin resource article, making it visible to public users
 * Sets is_published to true and updates published_at timestamp
 * @param accessToken - Supabase JWT token with admin privileges
 * @param resourceId - UUID of the resource to publish
 * @returns The published resource with updated status
 * @throws Error if publish fails or resource not found
 */
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

/**
 * Unpublishes an admin resource article, hiding it from public users
 * Sets is_published to false (preserves original published_at for history)
 * @param accessToken - Supabase JWT token with admin privileges
 * @param resourceId - UUID of the resource to unpublish
 * @returns The unpublished resource with updated status
 * @throws Error if unpublish fails or resource not found
 */
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

/**
 * Permanently deletes an admin resource article
 * WARNING: This action cannot be undone
 * @param accessToken - Supabase JWT token with admin privileges
 * @param resourceId - UUID of the resource to delete
 * @throws Error if deletion fails or resource not found
 */
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

/**
 * Uploads an image file for use in admin resource articles
 * Images are stored in cloud storage and a public URL is returned
 * @param accessToken - Supabase JWT token with admin privileges
 * @param image - Image file to upload (PNG, JPEG, or GIF)
 * @returns Public URL of the uploaded image for embedding in articles
 * @throws Error if upload fails, file type invalid, or size exceeds limits
 */
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
