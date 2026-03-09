# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LinkedIn job listings dashboard for IT Project Management mentorship students. Built with React 19 + Vite 7, using PapaParse to load job data from a static CSV file. Deployed on Vercel, scraping managed via Apify + GitHub Actions.

- **Live site**: https://job-dashboard-rho.vercel.app/
- **GitHub**: https://github.com/niksprojects/job-dashboard
- **Notion workflow doc**: https://www.notion.so/31d2480d211c813fafe9c02dc209018a

## Commands

- `npm run dev` — Start Vite dev server (http://localhost:5173)
- `npm run build` — Production build (outputs to `dist/`)
- `npm run lint` — ESLint
- `npm run preview` — Preview production build locally

## Scraping

Script: `scripts/scrape.py` (stdlib only, no pip installs needed)

```bash
# Single location + role
python3 scripts/scrape.py --location "New York, NY" --keywords "Project Manager"

# All locations, single role
python3 scripts/scrape.py --all --keywords "Scrum Master"

# All locations, all roles (run twice)
python3 scripts/scrape.py --all --keywords "Project Manager"
python3 scripts/scrape.py --all --keywords "Scrum Master"
```

**Locations available:** `United States`, `New York, NY`, `Maryland`, `Canada`

**Behavior:**
- Reads `APIFY_TOKEN` from env var (CI) or macOS Keychain (local)
- Merges results into `public/jobs.csv` by LinkedIn job ID — no duplicates
- `remove_old_jobs()` purges listings older than 30 days on every save
- Default `--count 200` per location (safe for Apify free tier)
- Actor: `curious_coder~linkedin-jobs-scraper` (free)

**GitHub Actions trigger (no terminal needed):**
Go to https://github.com/niksprojects/job-dashboard/actions → Refresh Job Listings → Run workflow → pick location + role

**Weekly auto-refresh:** Every Monday 7am ET — all locations + all roles, automatic.

## Architecture

Single-page React app with three components and no router:

- **`src/App.jsx`** — All state (jobs, search, filters, sort). Loads `public/jobs.csv` via PapaParse. Syncs bidirectionally with URL query params. Contains `detectCountry()` for Canada/US grouping.
- **`src/components/Filters.jsx`** — Sidebar filter dropdowns. Country filter resets city/state on change.
- **`src/components/JobCard.jsx`** — Single job listing card with expand/collapse for description.

**Data flow:** CSV → PapaParse → `jobs` state → `useMemo` derives `filterOptions` + `filteredJobs` → rendered by components.

**URL query params:** `search`, `country`, `location`, `workType`, `experienceLevel`, `contractType`, `sector`, `sort`. Used to create shareable student-specific links.

## Data

`public/jobs.csv` — ~590 jobs across US + Canada, roles: Project Manager + Scrum Master.

CSV fields: `title`, `location`, `postedTime`, `publishedAt`, `jobUrl`, `companyName`, `companyUrl`, `description`, `applicationsCount`, `contractType`, `experienceLevel`, `workType`, `sector`, `salary`, `posterFullName`, `posterProfileUrl`, `companyId`, `applyUrl`, `applyType`, `benefits`

## Filters

| Filter | Source | Notes |
|---|---|---|
| Country | Derived via `detectCountry()` | `CANADA_PATTERN` checks province codes + "canada" |
| City / State | `location` CSV field | Options narrow based on country selection |
| Job Category | `workType` CSV field | |
| Experience Level | `experienceLevel` CSV field | |
| Contract Type | `contractType` CSV field | |
| Sector | `sector` CSV field | |

## Styling

Plain CSS, no preprocessor. Global variables in `src/index.css`, layout in `src/App.css`. Primary blue `#317AE7`, bg `#EFF5FE` (matches niksprojectsacademy.com).
