#!/usr/bin/env node
/**
 * Job scrape ingestion script.
 * Reads a JSON file of scraped jobs, normalizes fields, computes dedup hashes,
 * and upserts into Supabase.
 *
 * Usage:
 *   node scripts/scrape-jobs.mjs --input /tmp/jobs-2026-04-04.json
 *
 * Reads SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY from environment,
 * or macOS Keychain for local runs.
 */

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import { execSync } from 'child_process'

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://nndmgfjldqyvmfcuezuj.supabase.co'

const STATE_ABBR = {
  'AL':'Alabama','AK':'Alaska','AZ':'Arizona','AR':'Arkansas','CA':'California',
  'CO':'Colorado','CT':'Connecticut','DE':'Delaware','FL':'Florida','GA':'Georgia',
  'HI':'Hawaii','ID':'Idaho','IL':'Illinois','IN':'Indiana','IA':'Iowa',
  'KS':'Kansas','KY':'Kentucky','LA':'Louisiana','ME':'Maine','MD':'Maryland',
  'MA':'Massachusetts','MI':'Michigan','MN':'Minnesota','MS':'Mississippi','MO':'Missouri',
  'MT':'Montana','NE':'Nebraska','NV':'Nevada','NH':'New Hampshire','NJ':'New Jersey',
  'NM':'New Mexico','NY':'New York','NC':'North Carolina','ND':'North Dakota','OH':'Ohio',
  'OK':'Oklahoma','OR':'Oregon','PA':'Pennsylvania','RI':'Rhode Island','SC':'South Carolina',
  'SD':'South Dakota','TN':'Tennessee','TX':'Texas','UT':'Utah','VT':'Vermont',
  'VA':'Virginia','WA':'Washington','WV':'West Virginia','WI':'Wisconsin','WY':'Wyoming',
  'DC':'District of Columbia',
  // Canadian provinces
  'AB':'Alberta','BC':'British Columbia','MB':'Manitoba','NB':'New Brunswick',
  'NL':'Newfoundland and Labrador','NS':'Nova Scotia','NT':'Northwest Territories',
  'NU':'Nunavut','ON':'Ontario','PE':'Prince Edward Island','QC':'Quebec',
  'SK':'Saskatchewan','YT':'Yukon',
}

function normalizeState(state) {
  if (!state) return ''
  const trimmed = state.trim()
  // If it's an abbreviation, expand it
  const upper = trimmed.toUpperCase()
  if (STATE_ABBR[upper]) return STATE_ABBR[upper]
  // If it's a country name, not a state
  if (['united states', 'canada', 'remote'].includes(trimmed.toLowerCase())) return ''
  return trimmed
}

function getServiceKey() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) return process.env.SUPABASE_SERVICE_ROLE_KEY
  try {
    return execSync(
      'security find-generic-password -s "supabase-job-dashboard-service-key" -a "nikkuclaw" -w',
      { encoding: 'utf8' }
    ).trim()
  } catch {
    console.error('ERROR: SUPABASE_SERVICE_ROLE_KEY not set and Keychain lookup failed.')
    process.exit(1)
  }
}

function computeHash(title, company, location) {
  const normalized = [title, company, location]
    .map(s => (s || '').toLowerCase().trim().replace(/\s+/g, ' '))
    .join('|')
  return createHash('sha256').update(normalized).digest('hex')
}

function parseRelativeDate(relativeStr) {
  if (!relativeStr) return null
  const now = new Date()
  const match = relativeStr.match(/(\d+)\s*(day|hour|minute|week|month)s?\s*ago/i)
  if (!match) {
    // Try parsing as absolute date
    const d = new Date(relativeStr)
    if (!isNaN(d)) return d.toISOString().split('T')[0]
    return null
  }
  const num = parseInt(match[1])
  const unit = match[2].toLowerCase()
  if (unit === 'hour' || unit === 'minute') {
    return now.toISOString().split('T')[0] // today
  }
  if (unit === 'day') now.setDate(now.getDate() - num)
  else if (unit === 'week') now.setDate(now.getDate() - num * 7)
  else if (unit === 'month') now.setMonth(now.getMonth() - num)
  return now.toISOString().split('T')[0]
}

function inferWorkType(locationFull, description, title) {
  const text = `${locationFull} ${title} ${(description || '').slice(0, 500)}`.toLowerCase()
  if (text.includes('remote')) return 'Remote'
  if (text.includes('hybrid')) return 'Hybrid'
  if (text.includes('on-site') || text.includes('onsite') || text.includes('in-office')) return 'On-site'
  return null
}

function inferExperienceLevel(title) {
  const t = (title || '').toLowerCase()
  if (t.includes('senior') || t.includes('sr.') || t.includes('sr ') || t.includes('lead') || t.includes('principal')) return 'Senior'
  if (t.includes('junior') || t.includes('jr.') || t.includes('jr ') || t.includes('entry')) return 'Entry level'
  if (t.includes('director') || t.includes('vp ') || t.includes('vice president')) return 'Director'
  if (t.includes('manager') || t.includes('mid')) return 'Mid-Senior level'
  return null
}

function normalizeCountry(country) {
  if (!country) return null
  const c = country.toLowerCase().trim()
  if (c === 'us' || c === 'usa' || c.includes('united states')) return 'United States'
  if (c === 'ca' || c.includes('canada')) return 'Canada'
  if (c.includes('remote') || c === 'anywhere') return 'Remote'
  if (c.includes('united kingdom') || c === 'uk') return 'United Kingdom'
  return country.trim()
}

function parseStateFromLocation(location) {
  if (!location) return ''
  // Match patterns like "Charlotte, NC" or "New York, NY" or "Toronto, Ontario, Canada"
  const parts = location.split(',').map(s => s.trim())
  if (parts.length >= 2) {
    // Last part might be country, second-to-last might be state
    // Try the last part first, then second-to-last
    for (let i = parts.length - 1; i >= 1; i--) {
      const candidate = parts[i].trim()
      const upper = candidate.toUpperCase()
      if (STATE_ABBR[upper]) return STATE_ABBR[upper]
      // Check if it's already a full state name
      if (Object.values(STATE_ABBR).includes(candidate)) return candidate
    }
  }
  return ''
}

function parseCityFromLocation(location) {
  if (!location) return ''
  const parts = location.split(',').map(s => s.trim())
  return parts[0] || ''
}

function mapJob(raw) {
  const locationFull = raw['Full Location'] || raw.location_full || raw.location || ''
  const title = raw['Job Title'] || raw.title || ''
  const company = raw['Company'] || raw.company_name || raw.companyName || ''
  const rawCity = raw['City'] || raw.city || ''
  const rawState = raw['State/Province'] || raw.state || ''
  const city = rawCity || parseCityFromLocation(locationFull)
  const state = normalizeState(rawState) || parseStateFromLocation(locationFull)
  const country = normalizeCountry(raw['Country'] || raw.country || '')
  const source = raw['Source'] || raw.source || ''
  const postedRelative = raw['Posted'] || raw.posted_relative || raw.postedTime || ''
  const schedule = raw['Schedule'] || raw.schedule || raw.contractType || ''
  const description = raw['Description'] || raw.description || ''
  const applyUrl = raw['Apply URL'] || raw.apply_url || raw.applyUrl || ''
  const searchRole = raw['Search Role'] || raw.search_role || ''
  const searchLocation = raw['Search Location'] || raw.search_location || ''

  return {
    dedup_hash: computeHash(title, company, locationFull),
    title,
    company_name: company,
    location_full: locationFull,
    city,
    state,
    country,
    description: description.slice(0, 5000),
    apply_url: applyUrl,
    posted_date: parseRelativeDate(postedRelative),
    posted_relative: postedRelative,
    schedule: schedule || null,
    work_type: inferWorkType(locationFull, description, title),
    experience_level: inferExperienceLevel(title),
    sector: raw.sector || null,
    salary: raw.salary || null,
    source,
    search_role: searchRole,
    search_location: searchLocation,
    job_url: raw.jobUrl || raw.job_url || null,
    company_url: raw.companyUrl || raw.company_url || null,
    applications_count: raw.applicationsCount || raw.applications_count || null,
    poster_name: raw.posterFullName || raw.poster_name || null,
    poster_profile_url: raw.posterProfileUrl || raw.poster_profile_url || null,
    company_id: raw.companyId || raw.company_id || null,
    apply_type: raw.applyType || raw.apply_type || null,
    benefits: raw.benefits || null,
  }
}

async function main() {
  const args = process.argv.slice(2)
  const inputIdx = args.indexOf('--input')
  if (inputIdx === -1 || !args[inputIdx + 1]) {
    console.error('Usage: node scrape-jobs.mjs --input <file.json>')
    process.exit(1)
  }
  const inputFile = args[inputIdx + 1]

  const serviceKey = getServiceKey()
  const supabase = createClient(SUPABASE_URL, serviceKey)

  const rawJobs = JSON.parse(readFileSync(inputFile, 'utf8'))
  console.log(`Processing ${rawJobs.length} jobs...`)

  const mapped = rawJobs.map(mapJob).filter(j => j.title && j.dedup_hash)

  // Batch upsert in chunks of 100
  let inserted = 0
  let skipped = 0
  const chunkSize = 100

  for (let i = 0; i < mapped.length; i += chunkSize) {
    const chunk = mapped.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('jobs')
      .upsert(chunk, { onConflict: 'dedup_hash', ignoreDuplicates: true })
      .select('id')

    if (error) {
      console.error(`Error inserting chunk ${i / chunkSize + 1}:`, error.message)
      skipped += chunk.length
    } else {
      inserted += data.length
      skipped += chunk.length - data.length
    }
  }

  const result = { inserted, skipped, total: mapped.length }
  console.log(`Done: ${result.inserted} inserted, ${result.skipped} skipped, ${result.total} total`)
  console.log(JSON.stringify(result))
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
