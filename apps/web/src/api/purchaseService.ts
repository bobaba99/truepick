import { supabase } from './supabaseClient'
import type { PurchaseRow } from './types'

export async function getPurchaseHistory(
  userId: string,
  limit = 10
): Promise<PurchaseRow[]> {
  const { data, error } = await supabase
    .from('purchases')
    .select('id, title, price, vendor, category, purchase_date, source, created_at')
    .eq('user_id', userId)
    .order('purchase_date', { ascending: false })
    .limit(limit)

  if (error) {
    throw new Error(error.message)
  }

  return (data ?? []) as PurchaseRow[]
}

export type CreatePurchaseInput = {
  title: string
  price: number
  vendor: string | null
  category: string | null
  purchaseDate: string
  source?: string
  orderId?: string | null
  isPastPurchase?: boolean
}

export async function createPurchase(
  input: CreatePurchaseInput
): Promise<{ error: string | null }> {
  const { error } = await supabase.rpc('add_purchase', {
    p_title: input.title,
    p_price: input.price,
    p_vendor: input.vendor,
    p_category: input.category,
    p_purchase_date: input.purchaseDate,
    p_source: input.source ?? 'manual',
    p_order_id: input.orderId ?? null,
    p_is_past_purchase: input.isPastPurchase ?? false,
  })

  return { error: error?.message ?? null }
}

export async function updatePurchase(
  userId: string,
  purchaseId: string,
  input: CreatePurchaseInput
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from('purchases')
    .update({
      title: input.title,
      price: input.price,
      vendor: input.vendor,
      category: input.category,
      purchase_date: input.purchaseDate,
      source: input.source ?? 'manual',
    })
    .eq('id', purchaseId)
    .eq('user_id', userId)

  return { error: error?.message ?? null }
}

export async function deletePurchase(
  userId: string,
  purchaseId: string
): Promise<{ error: string | null }> {
  // First fetch the purchase to check if it came from a verdict
  const { data: purchase, error: fetchError } = await supabase
    .from('purchases')
    .select('verdict_id')
    .eq('id', purchaseId)
    .eq('user_id', userId)
    .single()

  if (fetchError) {
    return { error: fetchError.message }
  }

  // If this purchase is linked to a verdict, update the verdict to 'pass'
  if (purchase.verdict_id) {
    const { error: verdictError } = await supabase
      .from('verdicts')
      .update({
        user_decision: 'skip',
        user_hold_until: null,
      })
      .eq('id', purchase.verdict_id)
      .eq('user_id', userId)

    if (verdictError) {
      return { error: verdictError.message }
    }
  }

  const { error } = await supabase
    .from('purchases')
    .delete()
    .eq('id', purchaseId)
    .eq('user_id', userId)

  return { error: error?.message ?? null }
}
