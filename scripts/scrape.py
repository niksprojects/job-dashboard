#!/usr/bin/env python3
"""
LinkedIn job scraper for job-dashboard.
Uses Apify curious_coder~linkedin-jobs-scraper (free tier).
Scrapes 7 roles x 3 locations = 21 queries, outputs JSON for Supabase ingestion.

Usage:
  # Full scrape (all roles, all locations)
  python scripts/scrape.py --all

  # Single role, all locations
  python scripts/scrape.py --all --role "Scrum Master"

  # Single role, single location
  python scripts/scrape.py --location "United States" --role "Project Manager"

  # Then import to Supabase:
  node scripts/scrape-jobs.mjs --input /tmp/linkedin-jobs-YYYY-MM-DD.json

Reads APIFY_TOKEN from environment, or macOS Keychain if running locally.
"""

import argparse
import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.parse
from datetime import date
from pathlib import Path

ACTOR_ID = "curious_coder~linkedin-jobs-scraper"
BASE_URL = "https://api.apify.com/v2"
OUTPUT_DIR = Path("/tmp")

ROLES = [
    "Scrum Master",
    "Project Manager",
    "Project Analyst",
    "Project Coordinator",
    "Project Administrator",
]

LOCATIONS = {
    "United States": "United States",
    "Canada":        "Canada",
    "Remote":        "Remote",
}


def get_token():
    token = os.environ.get("APIFY_TOKEN")
    if token:
        return token
    try:
        result = subprocess.run(
            ["security", "find-generic-password", "-s", "apify-mcp-token", "-a", "nikkuclaw", "-w"],
            capture_output=True, text=True,
        )
        if result.returncode == 0:
            return result.stdout.strip()
    except FileNotFoundError:
        pass
    print("ERROR: APIFY_TOKEN not set and macOS Keychain not available.", file=sys.stderr)
    sys.exit(1)


def api_get(path, token, params=None, retries=3):
    query = {"token": token}
    if params:
        query.update(params)
    url = f"{BASE_URL}{path}?{urllib.parse.urlencode(query)}"
    for attempt in range(retries):
        try:
            with urllib.request.urlopen(url) as resp:
                return json.loads(resp.read())
        except urllib.error.HTTPError as e:
            if e.code in (502, 503, 504) and attempt < retries - 1:
                wait = 5 * (attempt + 1)
                print(f"\n  HTTP {e.code}, retrying in {wait}s...", end="", flush=True)
                time.sleep(wait)
            else:
                raise


def api_post(path, token, data):
    url = f"{BASE_URL}{path}?token={token}"
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def map_job(job, search_role, search_location):
    """Map Apify LinkedIn job to our unified schema."""
    benefits = job.get("benefits", "")
    if isinstance(benefits, list):
        benefits = ", ".join(benefits)

    location = job.get("location", "")

    return {
        "title":              job.get("title", ""),
        "location":           location,
        "postedTime":         job.get("postedAt", ""),
        "publishedAt":        job.get("postedAt", ""),
        "jobUrl":             job.get("link", ""),
        "companyName":        job.get("companyName", ""),
        "companyUrl":         job.get("companyLinkedinUrl", ""),
        "description":        job.get("descriptionText", ""),
        "applicationsCount":  job.get("applicantsCount", ""),
        "contractType":       job.get("employmentType", ""),
        "experienceLevel":    job.get("seniorityLevel", ""),
        "workType":           job.get("jobFunction", ""),
        "sector":             job.get("industries", ""),
        "salary":             job.get("salary", ""),
        "posterFullName":     job.get("jobPosterName", ""),
        "posterProfileUrl":   job.get("jobPosterProfileUrl", ""),
        "companyId":          job.get("id", ""),
        "applyUrl":           job.get("applyUrl", ""),
        "applyType":          "",
        "benefits":           benefits,
        "source":             "LinkedIn",
        "search_role":        search_role,
        "search_location":    search_location,
    }


def scrape_location(location_label, location_search, keywords, count, token):
    search_url = (
        "https://www.linkedin.com/jobs/search/?"
        f"keywords={urllib.parse.quote(keywords)}"
        f"&location={urllib.parse.quote(location_search)}"
        "&f_TPR=r604800"
    )
    print(f"\n[{keywords} | {location_label}] Starting scrape...")
    print(f"  URL: {search_url}")

    result = api_post(f"/acts/{ACTOR_ID}/runs", token, {"urls": [search_url], "count": count})
    run_id = result["data"]["id"]
    print(f"  Run ID: {run_id} — waiting", end="", flush=True)

    while True:
        time.sleep(8)
        status_data = api_get(f"/actor-runs/{run_id}", token)
        status = status_data["data"]["status"]
        print(".", end="", flush=True)
        if status == "SUCCEEDED":
            print(" done")
            break
        elif status in ("FAILED", "ABORTED", "TIMED-OUT"):
            print(f" FAILED ({status})")
            return []

    items_data = api_get(f"/actor-runs/{run_id}/dataset/items", token, {"limit": count})
    items = items_data if isinstance(items_data, list) else items_data.get("data", {}).get("items", [])
    print(f"  Got {len(items)} jobs")
    return [map_job(job, keywords, location_label) for job in items]


def main():
    parser = argparse.ArgumentParser(description="Scrape LinkedIn jobs via Apify (7 roles x 3 locations)")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--location", choices=list(LOCATIONS.keys()), help="Single location to scrape")
    group.add_argument("--all", action="store_true", help="Scrape all locations")
    parser.add_argument("--role", choices=ROLES, help="Single role (default: all roles)")
    parser.add_argument("--count", type=int, default=100, help="Max jobs per query (default: 100)")
    args = parser.parse_args()

    token = get_token()

    locations_to_scrape = LOCATIONS if args.all else {args.location: LOCATIONS[args.location]}
    roles_to_scrape = [args.role] if args.role else ROLES

    total_queries = len(roles_to_scrape) * len(locations_to_scrape)
    print(f"Running {total_queries} queries: {len(roles_to_scrape)} roles x {len(locations_to_scrape)} locations")

    all_jobs = []
    query_num = 0
    for role in roles_to_scrape:
        for label, search in locations_to_scrape.items():
            query_num += 1
            print(f"\n--- Query {query_num}/{total_queries} ---")
            jobs = scrape_location(label, search, role, args.count, token)
            all_jobs.extend(jobs)

    # Save to JSON file for scrape-jobs.mjs to import
    today = date.today().isoformat()
    output_file = OUTPUT_DIR / f"linkedin-jobs-{today}.json"
    with open(output_file, "w", encoding="utf-8") as f:
        json.dump(all_jobs, f, ensure_ascii=False)

    print(f"\n{'=' * 50}")
    print(f"Total: {len(all_jobs)} jobs from {total_queries} queries")
    print(f"Saved to: {output_file}")
    print(f"\nTo import into Supabase, run:")
    print(f"  node scripts/scrape-jobs.mjs --input {output_file}")


if __name__ == "__main__":
    main()
