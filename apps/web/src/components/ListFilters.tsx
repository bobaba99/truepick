import { PURCHASE_CATEGORIES } from '../api/core/types'
import type { FilterState } from './ListFilters.model'

type ListFiltersProps = {
    search: string
    onSearchChange: (value: string) => void
    filters: FilterState
    onFilterChange: (filters: FilterState) => void
    type: 'verdict' | 'purchase'
}

export default function ListFilters({
    search,
    onSearchChange,
    filters,
    onFilterChange,
    type,
}: ListFiltersProps) {
    const handleChange = (key: keyof FilterState, value: string) => {
        onFilterChange({ ...filters, [key]: value })
    }

    return (
        <div className="list-filters">
            <div className="search-row">
                <input
                    type="text"
                    placeholder={`Search ${type === 'verdict' ? 'verdicts' : 'purchases'}...`}
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    className="filter-search"
                />
            </div>

            <div className="filter-grid">
                <div className="filter-group">
                    <input
                        type="text"
                        placeholder="Vendor"
                        value={filters.vendor}
                        onChange={(e) => handleChange('vendor', e.target.value)}
                        className="filter-input"
                    />
                </div>

                <div className="filter-group">
                    <select
                        value={filters.category}
                        onChange={(e) => handleChange('category', e.target.value)}
                        className="filter-select"
                    >
                        <option value="">All Categories</option>
                        {PURCHASE_CATEGORIES.map((cat) => (
                            <option key={cat.value} value={cat.value}>
                                {cat.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="filter-group price-range">
                    <input
                        type="number"
                        placeholder="Min $"
                        value={filters.priceMin}
                        onChange={(e) => handleChange('priceMin', e.target.value)}
                        className="filter-input-sm"
                    />
                    <span className="separator">-</span>
                    <input
                        type="number"
                        placeholder="Max $"
                        value={filters.priceMax}
                        onChange={(e) => handleChange('priceMax', e.target.value)}
                        className="filter-input-sm"
                    />
                </div>

                <div className="filter-group">
                    <input
                        type="date"
                        value={filters.date}
                        onChange={(e) => handleChange('date', e.target.value)}
                        className="filter-input"
                    />
                </div>

                {type === 'verdict' && (
                    <>
                        <div className="filter-group">
                            <select
                                value={filters.recommendation}
                                onChange={(e) => handleChange('recommendation', e.target.value)}
                                className="filter-select"
                            >
                                <option value="">All Recs</option>
                                <option value="buy">Buy</option>
                                <option value="hold">Hold</option>
                                <option value="skip">Skip</option>
                            </select>
                        </div>
                        <div className="filter-group">
                            <select
                                value={filters.decision}
                                onChange={(e) => handleChange('decision', e.target.value)}
                                className="filter-select"
                            >
                                <option value="">All Decisions</option>
                                <option value="bought">Bought</option>
                                <option value="hold">Hold</option>
                                <option value="skip">Skip</option>
                            </select>
                        </div>
                    </>
                )}

                {type === 'purchase' && (
                    <div className="filter-group">
                        <select
                            value={filters.source}
                            onChange={(e) => handleChange('source', e.target.value)}
                            className="filter-select"
                        >
                            <option value="">All Sources</option>
                            <option value="manual">Manual</option>
                            <option value="verdict">Verdict</option>
                        </select>
                    </div>
                )}
            </div>
        </div>
    )
}
