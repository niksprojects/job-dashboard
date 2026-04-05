export default function Filters({ filters, setFilters, filterOptions, onClear }) {
  const update = (key, val) => setFilters((f) => ({ ...f, [key]: val }))
  const updateCountry = (val) => setFilters((f) => ({ ...f, country: val, state: '', location: '' }))
  const updateState = (val) => setFilters((f) => ({ ...f, state: val, location: '' }))
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
        <label>Country</label>
        <select value={filters.country} onChange={(e) => updateCountry(e.target.value)}>
          <option value="">All Countries</option>
          <option value="United States">United States</option>
          <option value="Canada">Canada</option>
          <option value="Remote">Remote</option>
        </select>
      </div>

      <div className="filter-group">
        <label>State / Province</label>
        <select value={filters.state} onChange={(e) => updateState(e.target.value)}>
          <option value="">All States</option>
          {filterOptions.state.map((v) => <option key={v} value={v}>{v}</option>)}
        </select>
      </div>

      <div className="filter-group">
        <label>City</label>
        <select value={filters.location} onChange={(e) => update('location', e.target.value)}>
          <option value="">All Cities</option>
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
