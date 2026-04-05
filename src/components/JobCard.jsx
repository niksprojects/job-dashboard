import { useState } from 'react'

function stripHtml(html) {
  if (!html) return ''
  const doc = new DOMParser().parseFromString(html, 'text/html')
  return doc.body.textContent || ''
}

function isNewJob(postedDate) {
  if (!postedDate) return false
  const posted = new Date(postedDate)
  const oneDayAgo = new Date()
  oneDayAgo.setDate(oneDayAgo.getDate() - 1)
  return posted >= oneDayAgo
}

export default function JobCard({ job }) {
  const [expanded, setExpanded] = useState(false)

  const applyLink = job.apply_url && job.apply_url !== 'N/A' ? job.apply_url : job.job_url

  const getBadgeColor = (workType) => {
    if (!workType) return '#808080'
    if (workType.toLowerCase().includes('remote')) return '#059669'
    if (workType.toLowerCase().includes('hybrid')) return '#FFA46B'
    return '#317AE7'
  }

  const isNew = isNewJob(job.posted_date)

  return (
    <div className="job-card">
      <div className="job-card-header">
        <div className="job-title-row">
          <h3 className="job-title">
            {job.title}
            {isNew && <span className="badge-new">NEW</span>}
          </h3>
          {job.work_type && (
            <span className="badge" style={{ backgroundColor: getBadgeColor(job.work_type) }}>
              {job.work_type}
            </span>
          )}
        </div>
        <div className="company-row">
          <span className="company-name">{job.company_name}</span>
          <span className="location">{job.location_full}</span>
          {job.source && (
            <span className="source-badge">via {job.source}</span>
          )}
        </div>
      </div>

      <div className="job-meta">
        {job.salary && job.salary !== 'N/A' && (
          <span className="meta-item">{job.salary}</span>
        )}
        {job.experience_level && (
          <span className="meta-item">{job.experience_level}</span>
        )}
        {job.schedule && (
          <span className="meta-item">{job.schedule}</span>
        )}
        {job.applications_count && (
          <span className="meta-item">{job.applications_count} applicants</span>
        )}
        {job.posted_relative && (
          <span className="meta-item">{job.posted_relative}</span>
        )}
        {!job.posted_relative && job.posted_date && (
          <span className="meta-item">{job.posted_date}</span>
        )}
      </div>

      <div className="job-actions">
        {applyLink && (
          <a
            href={applyLink}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-apply"
          >
            Apply Now
          </a>
        )}
        <button
          className="btn-expand"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Hide Details' : 'View Details'}
        </button>
      </div>

      {expanded && job.description && (
        <div className="job-description">
          <p>{stripHtml(job.description)}</p>
        </div>
      )}
    </div>
  )
}
