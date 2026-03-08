# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LinkedIn job listings dashboard for IT Project Management mentorship students. Built with React 19 + Vite 7, using PapaParse to load job data from a static CSV file.

## Commands

- `npm run dev` — Start Vite dev server
- `npm run build` — Production build (outputs to `dist/`)
- `npm run lint` — ESLint (flat config with react-hooks and react-refresh plugins)
- `npm run preview` — Preview production build locally

## Architecture

Single-page React app with three components and no router:

- **`src/App.jsx`** — All application state lives here (jobs, search, filters, sort). Loads `public/jobs.csv` via PapaParse on mount. Syncs state bidirectionally with URL query parameters so filtered views are shareable.
- **`src/components/Filters.jsx`** — Stateless sidebar filter dropdowns. Receives filter state and options from App.
- **`src/components/JobCard.jsx`** — Displays a single job listing. Only local state is the expand/collapse toggle for job descriptions.

**Data flow:** CSV → PapaParse → `jobs` state → `useMemo` derives filter options (unique values) and `filteredJobs` (search + filter + sort) → rendered by components.

**URL query params:** `search`, `location`, `workType`, `experienceLevel`, `contractType`, `sector`, `sort`. Used to create shareable student-specific links.

## Data

Job listings come from `public/jobs.csv`. CSV fields: title, location, postedTime, publishedAt, jobUrl, companyName, companyUrl, description, applicationsCount, contractType, experienceLevel, workType, sector, salary, posterFullName, posterProfileUrl, companyId, applyUrl, applyType, benefits.

To update listings, replace `public/jobs.csv` with a new file using the same column headers.

## Lint Rules

- ESLint flat config (`eslint.config.js`)
- `no-unused-vars` ignores PascalCase names (React components) and names starting with `_`
- Ignores `dist/` directory

## Styling

Plain CSS with no preprocessor. Global variables in `src/index.css`, app layout in `src/App.css`. WorkType badge colors are computed inline in JobCard (remote=green, hybrid=orange, on-site=blue).
