#!/usr/bin/env node
/**
 * JSearch (RapidAPI) job scraper.
 * Searches Google Jobs via JSearch API for 5 roles x 3 locations.
 * Outputs JSON for scrape-jobs.mjs to import into Supabase.
 *
 * Usage:
 *   node scripts/scrape-jsearch.mjs
 *   node scripts/scrape-jsearch.mjs --role "Scrum Master" --location "Canada"
 *
 * Reads RAPIDAPI_KEY from environment or macOS Keychain.
 * Free tier: 200 requests/month. Runs Mon/Wed/Fri = ~180 requests/month.
 */

import { execSync } from 'child_process'
import { writeFileSync } from 'fs'

const JSEARCH_HOST = 'jsearch.p.rapidapi.com'
const JSEARCH_URL = 'https://jsearch.p.rapidapi.com/search'

const ROLES = [
  'Scrum Master',
  'Project Manager',
  'Project Analyst',
  'Project Coordinator',
  'Project Administrator',
]

const LOCATIONS = {
  'United States': 'United States',
  'Canada': 'Canada',
  'Remote': 'Remote',
}

function getApiKey() {
  if (process.env.RAPIDAPI_KEY) return process.env.RAPIDAPI_KEY
  try {
    return execSync(
      'security find-generic-password -s "rapidapi-jsearch-key" -a "nikkuclaw" -w',
      { encoding: 'utf8' }
    ).trim()
  } catch {
    console.error('ERROR: RAPIDAPI_KEY not set and Keychain lookup failed.')
    process.exit(1)
  }
}

function normalizeCountry(country) {
  if (!country) return null
  const c = country.toLowerCase()
  if (c === 'us' || c.includes('united states')) return 'United States'
  if (c === 'ca' || c.includes('canada')) return 'Canada'
  if (c.includes('remote') || c === 'anywhere') return 'Remote'
  return country
}

function mapJob(job, searchRole, searchLocation) {
  const posted = job.job_posted_at_datetime_utc
  let postedDate = null
  if (posted) {
    postedDate = posted.split('T')[0]
  }

  const minSalary = job.job_min_salary
  const maxSalary = job.job_max_salary
  let salary = null
  if (minSalary && maxSalary) {
    salary = `$${minSalary.toLocaleString()} - $${maxSalary.toLocaleString()}`
  } else if (minSalary) {
    salary = `$${minSalary.toLocaleString()}+`
  } else if (maxSalary) {
    salary = `Up to $${maxSalary.toLocaleString()}`
  }

  const locationParts = [job.job_city, job.job_state].filter(Boolean)
  const locationFull = locationParts.join(', ') || searchLocation

  return {
    'Job Title': job.job_title || '',
    'Company': job.employer_name || '',
    'City': job.job_city || '',
    'State/Province': job.job_state || '',
    'Country': normalizeCountry(job.job_country) || searchLocation,
    'Full Location': locationFull,
    'Source': job.job_publisher || '',
    'Posted': postedDate || '',
    'Schedule': job.job_employment_type || '',
    'Description': (job.job_description || '').slice(0, 5000),
    'Apply URL': job.job_apply_link || '',
    'Search Role': searchRole,
    'Search Location': searchLocation,
    salary: salary,
    sector: job.job_job_title_seniority || null,
  }
}

async function searchJobs(query, apiKey) {
  const params = new URLSearchParams({
    query,
    num_pages: '1',
    date_posted: 'week',
  })

  const url = `${JSEARCH_URL}?${params}`
  const resp = await fetch(url, {
    headers: {
      'x-rapidapi-host': JSEARCH_HOST,
      'x-rapidapi-key': apiKey,
    },
  })

  if (!resp.ok) {
    const text = await resp.text()
    console.error(`  API error ${resp.status}: ${text.slice(0, 200)}`)
    return []
  }

  const data = await resp.json()
  return data.data || []
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  const args = process.argv.slice(2)
  const roleIdx = args.indexOf('--role')
  const locIdx = args.indexOf('--location')

  const rolesToSearch = roleIdx !== -1 ? [args[roleIdx + 1]] : ROLES
  const locsToSearch = locIdx !== -1
    ? { [args[locIdx + 1]]: LOCATIONS[args[locIdx + 1]] || args[locIdx + 1] }
    : LOCATIONS

  const apiKey = getApiKey()
  const totalQueries = rolesToSearch.length * Object.keys(locsToSearch).length
  console.log(`JSearch: ${totalQueries} queries (${rolesToSearch.length} roles x ${Object.keys(locsToSearch).length} locations)`)

  const allJobs = []
  let queryNum = 0

  for (const role of rolesToSearch) {
    for (const [label, location] of Object.entries(locsToSearch)) {
      queryNum++
      const query = `${role} in ${location}`
      console.log(`[${queryNum}/${totalQueries}] "${query}"...`)

      const jobs = await searchJobs(query, apiKey)
      const mapped = jobs.map(j => mapJob(j, role, label))
      allJobs.push(...mapped)
      console.log(`  Got ${jobs.length} jobs`)

      // Throttle to stay under rate limits
      if (queryNum < totalQueries) await sleep(1500)
    }
  }

  // Save to JSON
  const today = new Date().toISOString().split('T')[0]
  const outputFile = `/tmp/jsearch-jobs-${today}.json`
  writeFileSync(outputFile, JSON.stringify(allJobs, null, 2))

  console.log(`\n${'='.repeat(50)}`)
  console.log(`Total: ${allJobs.length} jobs from ${totalQueries} queries`)
  console.log(`Saved to: ${outputFile}`)
  console.log(`\nTo import into Supabase, run:`)
  console.log(`  node scripts/scrape-jobs.mjs --input ${outputFile}`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
