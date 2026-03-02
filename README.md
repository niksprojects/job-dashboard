# 🎯 Niks Projects — Job Dashboard

A LinkedIn job listings dashboard built for IT Project Management mentorship students.

## Features
- Search by job title or company
- Filter by location, job category, experience level, contract type, sector
- Sort by newest or least applicants
- One-click Apply Now links
- Shareable filtered URLs for each student

## Tech Stack
- React + Vite
- PapaParse (CSV parsing)
- Plain CSS

## Local Development
```bash
npm install
npm run dev
```

## Data
Drop an updated `jobs.csv` into the `public/` folder to refresh job listings.

## Student Links
Create custom URLs with pre-set filters:
```
https://yoursite.vercel.app/?location=Virginia+Beach%2C+VA&contractType=Full-time
```
