# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Job listings dashboard for IT Project Management mentorship students. Built with React 19 + Vite 7, backed by Supabase, authenticated via Clerk. Deployed on Vercel, scraping managed via Apify (LinkedIn) + JSearch/RapidAPI (Google Jobs).

- **Live site**: https://jobs.primeitpm.com
- **Vercel URL**: https://job-dashboard-rho.vercel.app/
- **GitHub**: https://github.com/niksprojects/job-dashboard
- **Supabase project**: `nndmgfjldqyvmfcuezuj` (dedicated, separate from portal)

## Commands

- `npm run dev` — Start Vite dev server (http://localhost:5173)
- `npm run build` — Production build (outputs to `dist/`)
- `npm run lint` — ESLint
- `npm run preview` — Preview production build locally

## Data Sources & Scraping

### 1. Apify LinkedIn (daily, free)

Script: `scripts/scrape.py` → outputs JSON → `scripts/scrape-jobs.mjs` imports to Supabase.

```bash
# Full scrape (5 roles x 3 locations = 15 queries)
python3 scripts/scrape.py --all --count 100
node scripts/scrape-jobs.mjs --input /tmp/linkedin-jobs-$(date +%Y-%m-%d).json

# Single role + location
python3 scripts/scrape.py --location "United States" --role "Scrum Master" --count 100
```

- Actor: `curious_coder~linkedin-jobs-scraper` (free)
- Reads `APIFY_TOKEN` from env var or macOS Keychain (`apify-mcp-token`)

### 2. JSearch / RapidAPI (Mon/Wed/Fri, free tier 200 req/month)

Script: `scripts/scrape-jsearch.mjs` → outputs JSON → `scripts/scrape-jobs.mjs` imports to Supabase.

```bash
# Full scrape (5 roles x 3 locations = 15 queries)
node scripts/scrape-jsearch.mjs
node scripts/scrape-jobs.mjs --input /tmp/jsearch-jobs-$(date +%Y-%m-%d).json

# Single role + location
node scripts/scrape-jsearch.mjs --role "Scrum Master" --location "Canada"
```

- Pulls from Google Jobs (Indeed, LinkedIn, Glassdoor, ZipRecruiter, 50+ boards)
- Reads `RAPIDAPI_KEY` from env var or macOS Keychain (`rapidapi-jsearch-key`)

### 3. Supabase ingestion (shared)

Script: `scripts/scrape-jobs.mjs --input <file.json>`

- Normalizes fields, computes SHA-256 dedup hash (title + company + location)
- Upserts to Supabase (`ON CONFLICT dedup_hash DO NOTHING`)
- Reads `SUPABASE_SERVICE_ROLE_KEY` from env var or macOS Keychain (`supabase-job-dashboard-service-key`)

### Roles scraped
Scrum Master, Project Manager, Project Analyst, Project Coordinator, Project Administrator

### Locations scraped
United States, Canada, Remote

### Scheduling (Claude Code remote triggers)
- `job-dashboard-apify-daily` — daily 6am ET (10:00 UTC)
- `job-dashboard-jsearch-mwf` — Mon/Wed/Fri 6am ET (10:00 UTC)
- Manage at: https://claude.ai/code/scheduled

## Architecture

Single-page React app with four components and no router:

- **`src/App.jsx`** — All state (jobs, search, filters, sort). Loads from Supabase (last 15 days). Uses `useUser()` from Clerk for auth. Syncs filters bidirectionally with URL query params.
- **`src/supabase.js`** — Supabase client (anon key, read-only).
- **`src/components/Filters.jsx`** — Sidebar filter dropdowns. Filter cascade: Country → State/Province → City.
- **`src/components/JobCard.jsx`** — Job card with "NEW" badge (last 24h), source badge, expand/collapse description, HTML stripping.
- **`src/components/AccessGate.jsx`** — Clerk sign-in gate shown after 5 preview jobs for unauthenticated visitors.
- **`src/main.jsx`** — Wraps app with `ClerkProvider`.

**Data flow:** Supabase query (last 15 days) → `jobs` state → `useMemo` derives `filterOptions` + `filteredJobs` → if signed in show all, else show first 5 + AccessGate.

**URL query params:** `search`, `country`, `state`, `location`, `workType`, `experienceLevel`, `contractType`, `sector`, `sort`.

## Authentication

Uses Clerk (shared with prime-client-portal, same app: PRIME-PM-SIMULATION).

- **Production**: `pk_live_...` key in Vercel env var `VITE_CLERK_PUBLISHABLE_KEY`
- **Local dev**: `pk_test_...` key in `.env.local`
- Signed-in users see all jobs; unauthenticated see 5 previews + sign-in gate
- `UserButton` in header for signed-in users

## Database (Supabase)

- **Project URL**: https://nndmgfjldqyvmfcuezuj.supabase.co
- **Table**: `jobs` — unified schema for all sources
- **Dedup**: `dedup_hash` column (SHA-256 of normalized title+company+location)
- **RLS**: public read (anon key), service role write only
- **Retention**: pg_cron deletes jobs older than 30 days (runs 5am ET daily)
- **Dashboard shows**: last 15 days of data

### Key columns
`title`, `company_name`, `location_full`, `city`, `state`, `country`, `description`, `apply_url`, `posted_date`, `posted_relative`, `schedule`, `work_type`, `experience_level`, `sector`, `salary`, `source`, `search_role`, `search_location`

## Filters

| Filter | Column | Notes |
|---|---|---|
| Country | `country` | United States, Canada, Remote |
| State / Province | `state` | Cascades from country |
| City | `location_full` | Cascades from state |
| Job Category | `work_type` | Remote, Hybrid, On-site (inferred) |
| Experience Level | `experience_level` | Senior, Mid-Senior, Entry (inferred) |
| Contract Type | `schedule` | Full-time, Part-time, Contract |
| Sector | `sector` | |

## Environment Variables

### Local (`.env.local`, gitignored)
```
VITE_ACCESS_CODE=NIKSPM2026
VITE_SUPABASE_URL=https://nndmgfjldqyvmfcuezuj.supabase.co
VITE_SUPABASE_ANON_KEY=sb_publishable_...
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

### Vercel (Production)
- `VITE_ACCESS_CODE` — legacy, can be removed after Clerk auth confirmed
- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase publishable key
- `VITE_CLERK_PUBLISHABLE_KEY` — Clerk production key (`pk_live_...`)

### macOS Keychain (scrape scripts, local only)
- `apify-mcp-token` — Apify API token
- `rapidapi-jsearch-key` — RapidAPI JSearch key
- `supabase-job-dashboard-service-key` — Supabase service role key
- `supabase-job-dashboard-db-password` — Supabase DB password

## Styling

Plain CSS, no preprocessor. Global variables in `src/index.css`, layout in `src/App.css`. Primary blue `#317AE7`, bg `#EFF5FE` (matches niksprojectsacademy.com).
