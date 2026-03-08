#!/usr/bin/env python3
"""
LinkedIn job scraper for job-dashboard.
Uses Apify curious_coder~linkedin-jobs-scraper (free tier).

Usage:
  python scripts/scrape.py --location "New York, NY"
  python scripts/scrape.py --location "Canada"
  python scripts/scrape.py --all
  python scripts/scrape.py --location "United States" --keywords "IT Project Manager" --count 100

Reads APIFY_TOKEN from environment, or macOS Keychain if running locally.
Saves/merges results into public/jobs.csv (deduplicates by LinkedIn job ID).
"""

import argparse
import csv
import json
import os
import subprocess
import sys
import time
import urllib.request
import urllib.parse
from pathlib import Path

ACTOR_ID = "curious_coder~linkedin-jobs-scraper"
BASE_URL = "https://api.apify.com/v2"
CSV_PATH = Path(__file__).parent.parent / "public" / "jobs.csv"

LOCATIONS = {
    "United States":        "United States",
    "New York, NY":         "New York, New York, United States",
    "Maryland":             "Maryland, United States",
    "Canada":               "Canada",
}

CSV_FIELDS = [
    "title", "location", "postedTime", "publishedAt", "jobUrl", "companyName",
    "companyUrl", "description", "applicationsCount", "contractType",
    "experienceLevel", "workType", "sector", "salary", "posterFullName",
    "posterProfileUrl", "companyId", "applyUrl", "applyType", "benefits",
]


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


def api_get(path, token, params=None):
    query = {"token": token}
    if params:
        query.update(params)
    url = f"{BASE_URL}{path}?{urllib.parse.urlencode(query)}"
    with urllib.request.urlopen(url) as resp:
        return json.loads(resp.read())


def api_post(path, token, data):
    url = f"{BASE_URL}{path}?token={token}"
    body = json.dumps(data).encode()
    req = urllib.request.Request(url, data=body, headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req) as resp:
        return json.loads(resp.read())


def map_job(job):
    benefits = job.get("benefits", "")
    if isinstance(benefits, list):
        benefits = ", ".join(benefits)
    return {
        "title":              job.get("title", ""),
        "location":           job.get("location", ""),
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
    }


def scrape_location(location_label, location_search, keywords, count, token):
    search_url = (
        "https://www.linkedin.com/jobs/search/?"
        f"keywords={urllib.parse.quote(keywords)}"
        f"&location={urllib.parse.quote(location_search)}"
        "&f_TPR=r604800"
    )
    print(f"\n[{location_label}] Starting scrape...")
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
    return [map_job(job) for job in items]


def load_existing_csv():
    if not CSV_PATH.exists():
        return {}
    jobs = {}
    with open(CSV_PATH, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            job_id = row.get("companyId") or row.get("jobUrl", "")
            if job_id:
                jobs[job_id] = row
    return jobs


def save_csv(jobs_dict):
    CSV_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(CSV_PATH, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(jobs_dict.values())
    print(f"\nSaved {len(jobs_dict)} total jobs to {CSV_PATH}")


def merge_jobs(existing, new_jobs):
    merged = dict(existing)
    added = updated = 0
    for job in new_jobs:
        key = job.get("companyId") or job.get("jobUrl", "")
        if not key:
            continue
        if key in merged:
            updated += 1
        else:
            added += 1
        merged[key] = job
    print(f"  Merged: {added} new, {updated} updated, {len(merged)} total")
    return merged


def main():
    parser = argparse.ArgumentParser(description="Scrape LinkedIn jobs via Apify")
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument("--location", choices=list(LOCATIONS.keys()), help="Single location to scrape")
    group.add_argument("--all", action="store_true", help="Scrape all configured locations")
    parser.add_argument("--keywords", default="Project Manager", help="Job search keywords")
    parser.add_argument("--count", type=int, default=100, help="Max jobs per location (default: 100)")
    args = parser.parse_args()

    token = get_token()
    existing = load_existing_csv()
    print(f"Loaded {len(existing)} existing jobs from CSV")

    locations_to_scrape = LOCATIONS if args.all else {args.location: LOCATIONS[args.location]}

    all_new_jobs = []
    for label, search in locations_to_scrape.items():
        jobs = scrape_location(label, search, args.keywords, args.count, token)
        all_new_jobs.extend(jobs)

    merged = merge_jobs(existing, all_new_jobs)
    save_csv(merged)


if __name__ == "__main__":
    main()
