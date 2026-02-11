/**
 * Purchase-related types and constants
 * Used by: purchaseService, Dashboard, Profile, ListFilters
 */

/**
 * Database row representing a purchase record
 */
export type PurchaseRow = {
  id: string
  title: string
  price: number
  vendor: string | null
  category: string | null
  purchase_date: string
  source?: string | null
  verdict_id?: string | null
  created_at?: string | null
}

/**
 * Input data for creating a new purchase
 */
export type PurchaseInput = {
  title: string
  price: number | null
  category: string | null
  vendor: string | null
  justification: string | null
  isImportant: boolean
}

/**
 * Vendor quality assessment levels
 */
export type VendorQuality = 'low' | 'medium' | 'high'

/**
 * Vendor reliability assessment levels
 */
export type VendorReliability = 'low' | 'medium' | 'high'

/**
 * Vendor price tier classification
 */
export type VendorPriceTier = 'budget' | 'mid_range' | 'premium' | 'luxury'

/**
 * Vendor match result from database lookup
 */
export type VendorMatch = {
  vendor_id: number
  vendor_name: string
  vendor_category: string
  vendor_quality: VendorQuality
  vendor_reliability: VendorReliability
  vendor_price_tier: VendorPriceTier
}

/**
 * Available purchase categories with labels for UI display
 */
export const PURCHASE_CATEGORIES = [
  { value: 'electronics', label: 'Electronics' },
  { value: 'fashion', label: 'Fashion' },
  { value: 'home goods', label: 'Home goods' },
  { value: 'health & wellness', label: 'Health & wellness' },
  { value: 'travel', label: 'Travel' },
  { value: 'experiences', label: 'Experiences' },
  { value: 'subscriptions', label: 'Subscriptions' },
  { value: 'food & beverage', label: 'Food & beverage' },
  { value: 'services', label: 'Services' },
  { value: 'education', label: 'Education' },
  { value: 'other', label: 'Other' },
] as const

/**
 * Type-safe purchase category value
 */
export type PurchaseCategory = (typeof PURCHASE_CATEGORIES)[number]['value']
