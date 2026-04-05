#!/usr/bin/env node
/**
 * One-time migration: reads existing public/jobs.csv and inserts into Supabase.
 * Run from project root: node scripts/migrate-csv.mjs
 */

import { createClient } from '@supabase/supabase-js'
import { createHash } from 'crypto'
import { readFileSync } from 'fs'
import { execSync } from 'child_process'
import { parse } from 'path'

const SUPABASE_URL = 'https://nndmgfjldqyvmfcuezuj.supabase.co'
const CSV_PATH = new URL('../public/jobs.csv', import.meta.url).pathname

const CANADA_PATTERN = /\bcanada\b|,\s*(ON|BC|AB|QC|MB|SK|NS|NB|NL|PE|NT|NU|YT)\b/i

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

function detectCountry(location) {
  if (!location) return 'United States'
  if (CANADA_PATTERN.test(location)) return 'Canada'
  return 'United States'
}

function parseLocation(location) {
  if (!location) return { city: '', state: '', country: 'United States' }
  const country = detectCountry(location)
  // Try to extract city, state from "City, ST" or "City, State" format
  const parts = location.split(',').map(s => s.trim())
  if (parts.length >= 2) {
    return { city: parts[0], state: parts[1], country }
  }
  return { city: '', state: location, country }
}

function parseCSV(text) {
  const rows = []
  let current = ''
  let inQuotes = false
  const lines = text.split('\n')

  for (const line of lines) {
    if (inQuotes) {
      current += '\n' + line
      if (line.includes('"')) {
        const quoteCount = (current.match(/"/g) || []).length
        if (quoteCount % 2 === 0) {
          inQuotes = false
          rows.push(current)
          current = ''
        }
      }
    } else {
      current = line
      const quoteCount = (current.match(/"/g) || []).length
      if (quoteCount % 2 === 1) {
        inQuotes = true
      } else {
        if (current.trim()) rows.push(current)
        current = ''
      }
    }
  }
  if (current.trim()) rows.push(current)

  if (rows.length === 0) return []

  const headers = parseCSVRow(rows[0])
  return rows.slice(1).map(row => {
    const values = parseCSVRow(row)
    const obj = {}
    headers.forEach((h, i) => { obj[h] = values[i] || '' })
    return obj
  })
}

function parseCSVRow(row) {
  const fields = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < row.length; i++) {
    const ch = row[i]
    if (inQuotes) {
      if (ch === '"' && row[i + 1] === '"') {
        current += '"'
        i++
      } else if (ch === '"') {
        inQuotes = false
      } else {
        current += ch
      }
    } else {
      if (ch === '"') {
        inQuotes = true
      } else if (ch === ',') {
        fields.push(current)
        current = ''
      } else {
        current += ch
      }
    }
  }
  fields.push(current)
  return fields
}

async function main() {
  const serviceKey = getServiceKey()
  const supabase = createClient(SUPABASE_URL, serviceKey)

  console.log(`Reading CSV from ${CSV_PATH}...`)
  const csvText = readFileSync(CSV_PATH, 'utf8')
  const rows = parseCSV(csvText)
  console.log(`Parsed ${rows.length} rows from CSV`)

  // Filter jobs from last 30 days
  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - 30)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  const jobs = rows
    .filter(r => r.publishedAt && r.publishedAt >= cutoffStr)
    .map(r => {
      const { city, state, country } = parseLocation(r.location)
      return {
        dedup_hash: computeHash(r.title, r.companyName, r.location),
        title: r.title || '',
        company_name: r.companyName || '',
        location_full: r.location || '',
        city,
        state,
        country,
        description: (r.description || '').slice(0, 5000),
        apply_url: r.applyUrl || '',
        posted_date: r.publishedAt || null,
        posted_relative: r.postedTime || '',
        schedule: r.contractType || null,
        work_type: r.workType || null,
        experience_level: r.experienceLevel || null,
        sector: r.sector || null,
        salary: r.salary || null,
        source: 'LinkedIn',
        search_role: '',
        search_location: '',
        job_url: r.jobUrl || null,
        company_url: r.companyUrl || null,
        applications_count: r.applicationsCount || null,
        poster_name: r.posterFullName || null,
        poster_profile_url: r.posterProfileUrl || null,
        company_id: r.companyId || null,
        apply_type: r.applyType || null,
        benefits: r.benefits || null,
      }
    })
    .filter(j => j.title)

  console.log(`${jobs.length} jobs within last 30 days to migrate`)

  // Batch insert in chunks of 100
  let inserted = 0
  let errors = 0
  const chunkSize = 100

  for (let i = 0; i < jobs.length; i += chunkSize) {
    const chunk = jobs.slice(i, i + chunkSize)
    const { data, error } = await supabase
      .from('jobs')
      .upsert(chunk, { onConflict: 'dedup_hash', ignoreDuplicates: true })
      .select('id')

    if (error) {
      console.error(`Error in chunk ${Math.floor(i / chunkSize) + 1}:`, error.message)
      errors += chunk.length
    } else {
      inserted += data.length
    }
    process.stdout.write(`\r  Progress: ${Math.min(i + chunkSize, jobs.length)}/${jobs.length}`)
  }

  console.log(`\n\nMigration complete: ${inserted} inserted, ${errors} errors, ${jobs.length} total`)
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
