import { useState } from 'react'

export default function JobCard({ job }) {
  const [expanded, setExpanded] = useState(false)

  const applyLink = job.applyUrl && job.applyUrl !== 'N/A' ? job.applyUrl : job.jobUrl

  const getBadgeColor = (workType) => {
    if (!workType) return '#6b7280'
    if (workType.toLowerCase().includes('remote')) return '#059669'
    if (workType.toLowerCase().includes('hybrid')) return '#d97706'
    return '#2563eb'
  }

  return (
    <div className="job-card">
      <div className="job-card-header">
        <div className="job-title-row">
          <h3 className="job-title">{job.title}</h3>
          {job.workType && (
            <span className="badge" style={{ backgroundColor: getBadgeColor(job.workType) }}>
              {job.workType}
            </span>
          )}
        </div>
        <div className="company-row">
          <span className="company-name">🏢 {job.companyName}</span>
          <span className="location">📍 {job.location}</span>
        </div>
      </div>

      <div className="job-meta">
        {job.salary && job.salary !== 'N/A' && (
          <span className="meta-item">💰 {job.salary}</span>
        )}
        {job.experienceLevel && (
          <span className="meta-item">⭐ {job.experienceLevel}</span>
        )}
        {job.contractType && (
          <span className="meta-item">📄 {job.contractType}</span>
        )}
        {job.applicationsCount && (
          <span className="meta-item">👥 {job.applicationsCount} applicants</span>
        )}
        {job.postedTime && (
          <span className="meta-item">🕐 {job.postedTime}</span>
        )}
      </div>

      <div className="job-actions">
        <a
          href={applyLink}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-apply"
        >
          Apply Now →
        </a>
        <button
          className="btn-expand"
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? 'Hide Details ▲' : 'View Details ▼'}
        </button>
      </div>

      {expanded && job.description && (
        <div className="job-description">
          <p>{job.description.slice(0, 1000)}{job.description.length > 1000 ? '...' : ''}</p>
        </div>
      )}
    </div>
  )
}
