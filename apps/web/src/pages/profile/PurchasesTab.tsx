import type { PurchaseRow } from '../../api/core/types'
import type { FilterState } from '../../components/ListFilters.model'
import { GlassCard, LiquidButton } from '../../components/Kinematics'
import ListFilters from '../../components/ListFilters'
import { analytics } from '../../hooks/useAnalytics'
import { PURCHASE_PAGE_SIZE } from './profileConstants'

type PurchasesTabProps = {
  purchases: PurchaseRow[]
  filteredPurchases: PurchaseRow[]
  purchaseVisibleCount: number
  purchaseSaving: boolean
  purchaseSearch: string
  purchaseFilters: FilterState
  purchaseFiltersOpen: boolean
  onSearchChange: (value: string) => void
  onFilterChange: (filters: FilterState) => void
  onToggleFilters: () => void
  onOpenEmailImport: () => void
  onAddPurchase: () => void
  onEditPurchase: (purchase: PurchaseRow) => void
  onDeletePurchase: (purchaseId: string) => void
  onLoadMore: () => void
  formatCurrency: (value: number) => string
  formatDate: (value: string) => string
}

export default function PurchasesTab({
  purchases,
  filteredPurchases,
  purchaseVisibleCount,
  purchaseSaving,
  purchaseSearch,
  purchaseFilters,
  purchaseFiltersOpen,
  onSearchChange,
  onFilterChange,
  onToggleFilters,
  onOpenEmailImport,
  onAddPurchase,
  onEditPurchase,
  onDeletePurchase,
  onLoadMore,
  formatCurrency,
  formatDate,
}: PurchasesTabProps) {
  const visiblePurchases = filteredPurchases.slice(0, purchaseVisibleCount)
  const hasMorePurchases = filteredPurchases.length > purchaseVisibleCount

  return (
    <div className="verdict-result" style={{ marginTop: 0 }}>
      <div className="section-header">
        <h2>Purchase history</h2>
        <div className="header-actions">
          <LiquidButton
            type="button"
            className="ghost"
            onClick={onToggleFilters}
          >
            {purchaseFiltersOpen ? 'Hide filters' : 'Filter / Search'}
          </LiquidButton>
          <LiquidButton
            type="button"
            className="ghost"
            onClick={() => {
              analytics.trackEmailImportModalOpened()
              onOpenEmailImport()
            }}
          >
            Import from email
          </LiquidButton>
          <LiquidButton
            type="button"
            className="ghost"
            onClick={onAddPurchase}
          >
            Add
          </LiquidButton>
        </div>
      </div>
      <div className={`collapsible ${purchaseFiltersOpen ? 'open' : ''}`}>
        <ListFilters
          search={purchaseSearch}
          onSearchChange={onSearchChange}
          filters={purchaseFilters}
          onFilterChange={onFilterChange}
          type="purchase"
        />
      </div>
      {filteredPurchases.length === 0 ? (
        <div className="empty-card">
          {purchases.length === 0 ? 'No purchases logged yet.' : 'No purchases match your filters.'}
        </div>
      ) : (
        <>
          <div className="verdict-list">
            {visiblePurchases.map((purchase) => (
              <GlassCard key={purchase.id} className="verdict-card">
                <div className="verdict-card-content">
                  <div>
                    <span className="stat-label">Item </span>
                    <span className="stat-value">{purchase.title}</span>
                  </div>
                  <div className="meta-chips">
                    <span className="meta-chip meta-chip--price">{formatCurrency(Number(purchase.price))}</span>
                    {purchase.category && <span className="meta-chip">{purchase.category}</span>}
                    <span className="meta-chip">{formatDate(purchase.purchase_date)}</span>
                    {purchase.vendor && <span className="meta-chip meta-chip--secondary">{purchase.vendor}</span>}
                  </div>
                </div>
                <div className="verdict-actions">
                  <LiquidButton
                    className="link"
                    type="button"
                    onClick={() => onEditPurchase(purchase)}
                  >
                    Edit
                  </LiquidButton>
                  <LiquidButton
                    className="link danger"
                    type="button"
                    onClick={() => onDeletePurchase(purchase.id)}
                    disabled={purchaseSaving}
                  >
                    Delete
                  </LiquidButton>
                </div>
              </GlassCard>
            ))}
          </div>
          {hasMorePurchases && (
            <div className="load-more-row">
              <LiquidButton
                type="button"
                className="ghost"
                onClick={onLoadMore}
              >
                Load more ({filteredPurchases.length - purchaseVisibleCount} remaining)
              </LiquidButton>
            </div>
          )}
        </>
      )}
    </div>
  )
}
