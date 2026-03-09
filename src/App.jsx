import { useState, useEffect, useMemo } from 'react'
import Papa from 'papaparse'
import JobCard from './components/JobCard'
import Filters from './components/Filters'
import './App.css'

const CANADA_PATTERN = /\bcanada\b|,\s*(ON|BC|AB|QC|MB|SK|NS|NB|NL|PE|NT|NU|YT)\b/i

function detectCountry(location) {
  return CANADA_PATTERN.test(location) ? 'Canada' : 'United States'
}

function getInitialFilters() {
  const params = new URLSearchParams(window.location.search)
  return {
    country: params.get('country') || '',
    location: params.get('location') || '',
    workType: params.get('workType') || '',
    experienceLevel: params.get('experienceLevel') || '',
    contractType: params.get('contractType') || '',
    sector: params.get('sector') || '',
  }
}

function App() {
  const [jobs, setJobs] = useState([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState(new URLSearchParams(window.location.search).get('search') || '')
  const [filters, setFilters] = useState(getInitialFilters)
  const [sortBy, setSortBy] = useState(new URLSearchParams(window.location.search).get('sort') || 'postedTime')

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filters.country) params.set('country', filters.country)
    if (filters.location) params.set('location', filters.location)
    if (filters.workType) params.set('workType', filters.workType)
    if (filters.experienceLevel) params.set('experienceLevel', filters.experienceLevel)
    if (filters.contractType) params.set('contractType', filters.contractType)
    if (filters.sector) params.set('sector', filters.sector)
    if (sortBy !== 'postedTime') params.set('sort', sortBy)
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname
    window.history.replaceState({}, '', newUrl)
  }, [search, filters, sortBy])

  useEffect(() => {
    Papa.parse('/jobs.csv', {
      download: true,
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        setJobs(result.data)
        setLoading(false)
      },
    })
  }, [])

  const filterOptions = useMemo(() => {
    const unique = (key) => [...new Set(jobs.map((j) => j[key]).filter(Boolean))].sort()
    const countryJobs = filters.country
      ? jobs.filter((j) => detectCountry(j.location) === filters.country)
      : jobs
    return {
      location: [...new Set(countryJobs.map((j) => j.location).filter(Boolean))].sort(),
      workType: unique('workType'),
      experienceLevel: unique('experienceLevel'),
      contractType: unique('contractType'),
      sector: unique('sector'),
    }
  }, [jobs, filters.country])

  const filteredJobs = useMemo(() => {
    let result = jobs.filter((job) => {
      const q = search.toLowerCase()
      const matchSearch =
        !q ||
        job.title?.toLowerCase().includes(q) ||
        job.companyName?.toLowerCase().includes(q)
      const matchCountry = !filters.country || detectCountry(job.location) === filters.country
      const matchFilters = Object.entries(filters).every(
        ([key, val]) => !val || key === 'country' || job[key] === val
      )
      return matchSearch && matchCountry && matchFilters
    })

    if (sortBy === 'postedTime') {
      result = [...result].sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
    } else if (sortBy === 'applicationsCount') {
      result = [...result].sort(
        (a, b) => (parseInt(a.applicationsCount) || 999) - (parseInt(b.applicationsCount) || 999)
      )
    }
    return result
  }, [jobs, search, filters, sortBy])

  const clearFilters = () => {
    setSearch('')
    setFilters({ country: '', location: '', workType: '', experienceLevel: '', contractType: '', sector: '' })
    setSortBy('postedTime')
  }

  // Build a shareable link based on current filters
  const shareableLink = useMemo(() => {
    return window.location.href
  }, [search, filters, sortBy])

  const copyLink = () => {
    navigator.clipboard.writeText(shareableLink)
    alert('Link copied! Share this with your student.')
  }

  if (loading) return <div className="loading">Loading jobs... ⏳</div>

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div>
            <h1>🎯 Niks Projects — Job Board</h1>
            <p className="subtitle">Project Management Jobs · {jobs.length} total listings</p>
          </div>
          <button className="btn-share" onClick={copyLink} title="Copy shareable link">
            🔗 Share This View
          </button>
        </div>
      </header>

      <div className="main">
        <aside className="sidebar">
          <Filters
            filters={filters}
            setFilters={setFilters}
            filterOptions={filterOptions}
            onClear={clearFilters}
          />
        </aside>

        <section className="content">
          <div className="toolbar">
            <input
              className="search"
              type="text"
              placeholder="Search by title or company..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className="sort-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="postedTime">Newest First</option>
              <option value="applicationsCount">Least Applicants First</option>
            </select>
          </div>

          <div className="results-count">
            {filteredJobs.length} job{filteredJobs.length !== 1 ? 's' : ''} found
            {filteredJobs.length !== jobs.length && (
              <button className="clear-link" onClick={clearFilters}>Clear filters</button>
            )}
          </div>

          <div className="job-list">
            {filteredJobs.length === 0 ? (
              <div className="no-results">No jobs match your filters. Try adjusting them!</div>
            ) : (
              filteredJobs.map((job, i) => <JobCard key={i} job={job} />)
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

export default App
