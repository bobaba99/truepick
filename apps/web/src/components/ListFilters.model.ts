export type FilterState = {
  category: string
  vendor: string
  priceMin: string
  priceMax: string
  date: string
  recommendation: string
  decision: string
  source: string
}

export const INITIAL_FILTERS: FilterState = {
  category: '',
  vendor: '',
  priceMin: '',
  priceMax: '',
  date: '',
  recommendation: '',
  decision: '',
  source: '',
}
