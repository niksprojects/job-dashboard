-- Job Dashboard: Create jobs table with indexes and RLS
-- Run this in Supabase Dashboard > SQL Editor

CREATE TABLE IF NOT EXISTS jobs (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  dedup_hash       TEXT UNIQUE NOT NULL,

  -- Core fields
  title            TEXT NOT NULL,
  company_name     TEXT,
  location_full    TEXT,
  city             TEXT,
  state            TEXT,
  country          TEXT,
  description      TEXT,
  apply_url        TEXT,

  -- Time
  posted_date      DATE,
  posted_relative  TEXT,
  scraped_at       TIMESTAMPTZ DEFAULT now(),

  -- Classification
  schedule         TEXT,
  work_type        TEXT,
  experience_level TEXT,
  sector           TEXT,
  salary           TEXT,

  -- Source tracking
  source           TEXT,
  search_role      TEXT,
  search_location  TEXT,

  -- Legacy fields (nullable, from old Apify data)
  job_url              TEXT,
  company_url          TEXT,
  applications_count   TEXT,
  poster_name          TEXT,
  poster_profile_url   TEXT,
  company_id           TEXT,
  apply_type           TEXT,
  benefits             TEXT,

  created_at       TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_jobs_dedup ON jobs (dedup_hash);
CREATE INDEX IF NOT EXISTS idx_jobs_posted ON jobs (posted_date DESC);
CREATE INDEX IF NOT EXISTS idx_jobs_country ON jobs (country);
CREATE INDEX IF NOT EXISTS idx_jobs_state ON jobs (state);

-- Row Level Security
ALTER TABLE jobs ENABLE ROW LEVEL SECURITY;

-- Anyone can read (access gate is client-side)
CREATE POLICY "Public read access" ON jobs
  FOR SELECT USING (true);

-- Only service role can write (scrape script)
CREATE POLICY "Service role write access" ON jobs
  FOR ALL USING (auth.role() = 'service_role');

-- 30-day cleanup function
CREATE OR REPLACE FUNCTION cleanup_old_jobs()
RETURNS void AS $$
BEGIN
  DELETE FROM jobs WHERE posted_date < CURRENT_DATE - INTERVAL '30 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
