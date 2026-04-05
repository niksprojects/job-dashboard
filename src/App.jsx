import { useState, useEffect, useMemo } from 'react'
import { useUser, UserButton } from '@clerk/clerk-react'
import { supabase } from './supabase'
import JobCard from './components/JobCard'
import Filters from './components/Filters'
import AccessGate, { PREVIEW_COUNT } from './components/AccessGate'
import './App.css'

function getInitialFilters() {
  const params = new URLSearchParams(window.location.search)
  return {
    country: params.get('country') || '',
    state: params.get('state') || '',
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
  const { isSignedIn } = useUser()
  const unlocked = isSignedIn
  const [search, setSearch] = useState(new URLSearchParams(window.location.search).get('search') || '')
  const [filters, setFilters] = useState(getInitialFilters)
  const [sortBy, setSortBy] = useState(new URLSearchParams(window.location.search).get('sort') || 'postedTime')

  // Sync filters to URL
  useEffect(() => {
    const params = new URLSearchParams()
    if (search) params.set('search', search)
    if (filters.country) params.set('country', filters.country)
    if (filters.state) params.set('state', filters.state)
    if (filters.location) params.set('location', filters.location)
    if (filters.workType) params.set('workType', filters.workType)
    if (filters.experienceLevel) params.set('experienceLevel', filters.experienceLevel)
    if (filters.contractType) params.set('contractType', filters.contractType)
    if (filters.sector) params.set('sector', filters.sector)
    if (sortBy !== 'postedTime') params.set('sort', sortBy)
    const newUrl = params.toString() ? `?${params.toString()}` : window.location.pathname
    window.history.replaceState({}, '', newUrl)
  }, [search, filters, sortBy])

  // Load jobs from Supabase (last 15 days)
  useEffect(() => {
    const fifteenDaysAgo = new Date()
    fifteenDaysAgo.setDate(fifteenDaysAgo.getDate() - 15)
    const cutoff = fifteenDaysAgo.toISOString().split('T')[0]

    supabase
      .from('jobs')
      .select('*')
      .gte('posted_date', cutoff)
      .order('posted_date', { ascending: false })
      .limit(5000)
      .then(({ data, error }) => {
        if (error) {
          console.error('Supabase error:', error)
          setLoading(false)
          return
        }
        setJobs(data || [])
        setLoading(false)
      })
  }, [])

  const filterOptions = useMemo(() => {
    const unique = (key) => [...new Set(jobs.map((j) => j[key]).filter(Boolean))].sort()

    const countryJobs = filters.country
      ? jobs.filter((j) => j.country === filters.country)
      : jobs

    const stateJobs = filters.state
      ? countryJobs.filter((j) => j.state === filters.state)
      : countryJobs

    return {
      state: [...new Set(countryJobs.map((j) => j.state).filter(Boolean))].sort(),
      location: [...new Set(stateJobs.map((j) => j.location_full).filter(Boolean))].sort(),
      workType: unique('work_type'),
      experienceLevel: unique('experience_level'),
      contractType: unique('schedule'),
      sector: unique('sector'),
    }
  }, [jobs, filters.country, filters.state])

  const filteredJobs = useMemo(() => {
    let result = jobs.filter((job) => {
      const q = search.toLowerCase()
      const matchSearch =
        !q ||
        job.title?.toLowerCase().includes(q) ||
        job.company_name?.toLowerCase().includes(q)
      const matchCountry = !filters.country || job.country === filters.country
      const matchState = !filters.state || job.state === filters.state
      const matchLocation = !filters.location || job.location_full === filters.location
      const matchWorkType = !filters.workType || job.work_type === filters.workType
      const matchExpLevel = !filters.experienceLevel || job.experience_level === filters.experienceLevel
      const matchContract = !filters.contractType || job.schedule === filters.contractType
      const matchSector = !filters.sector || job.sector === filters.sector
      return matchSearch && matchCountry && matchState && matchLocation &&
        matchWorkType && matchExpLevel && matchContract && matchSector
    })

    if (sortBy === 'postedTime') {
      result = [...result].sort((a, b) => new Date(b.posted_date) - new Date(a.posted_date))
    } else if (sortBy === 'applicationsCount') {
      result = [...result].sort(
        (a, b) => (parseInt(a.applications_count) || 999) - (parseInt(b.applications_count) || 999)
      )
    }
    return result
  }, [jobs, search, filters, sortBy])

  const clearFilters = () => {
    setSearch('')
    setFilters({ country: '', state: '', location: '', workType: '', experienceLevel: '', contractType: '', sector: '' })
    setSortBy('postedTime')
  }

  const shareableLink = useMemo(() => {
    return window.location.href
  }, [search, filters, sortBy])

  const copyLink = () => {
    navigator.clipboard.writeText(shareableLink)
    alert('Link copied! Share this with your student.')
  }

  if (loading) return <div className="loading">Loading jobs...</div>

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div>
            <h1>Niks Projects — Job Board</h1>
            <p className="subtitle">Project Management Jobs · {jobs.length} total listings</p>
          </div>
          <div className="header-actions">
            <button className="btn-share" onClick={copyLink} title="Copy shareable link">
              Share This View
            </button>
            {isSignedIn && <UserButton />}
          </div>
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
              <>
                {(unlocked ? filteredJobs : filteredJobs.slice(0, PREVIEW_COUNT)).map((job) => (
                  <JobCard key={job.id} job={job} />
                ))}
                {!unlocked && filteredJobs.length > PREVIEW_COUNT && (
                  <AccessGate />
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}

export default App
