export default function Filters({ filters, setFilters, filterOptions, onClear }) {
  const update = (key, val) => setFilters((f) => ({ ...f, [key]: val }))
  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <div className="filters">
      <div className="filters-header">
        <h2>Filters</h2>
        {hasFilters && (
          <button className="btn-clear" onClick={onClear}>Clear All</button>
        )}
      </div>

      <div className="filter-group">
        <label>Location</label>
        <select value={filters.location} onChange={(e) => update('location', e.target.value)}>
          <option value="">All Locations</option>
          {filterOptions.location.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>

      <div className="filter-group">
        <label>Job Category</label>
        <select value={filters.workType} onChange={(e) => update('workType', e.target.value)}>
          <option value="">All Categories</option>
          {filterOptions.workType.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>

      <div className="filter-group">
        <label>Experience Level</label>
        <select value={filters.experienceLevel} onChange={(e) => update('experienceLevel', e.target.value)}>
          <option value="">All Levels</option>
          {filterOptions.experienceLevel.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>

      <div className="filter-group">
        <label>Contract Type</label>
        <select value={filters.contractType} onChange={(e) => update('contractType', e.target.value)}>
          <option value="">All Contracts</option>
          {filterOptions.contractType.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>

      <div className="filter-group">
        <label>Sector</label>
        <select value={filters.sector} onChange={(e) => update('sector', e.target.value)}>
          <option value="">All Sectors</option>
          {filterOptions.sector.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>
    </div>
  )
}
