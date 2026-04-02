#!/usr/bin/env python3
"""
serve-token-tracker.py

Reads Claude Code session data from ~/.claude/projects/**/*.jsonl,
aggregates token usage, writes token-tracker-data.json, then serves
the directory on port 8765 and opens token-tracker.html in the browser.
"""

import json
import os
import glob
import webbrowser
import threading
import http.server
import socketserver
from datetime import datetime, timezone, timedelta
from pathlib import Path
from collections import defaultdict

SCRIPT_DIR = Path(__file__).parent.resolve()
OUTPUT_FILE = SCRIPT_DIR / "token-tracker-data.json"
PORT = 8765
RESET_HOUR_UTC = 19  # tokens reset at 19:00 UTC daily


def find_jsonl_files() -> list[Path]:
    """Find all JSONL files in ~/.claude/projects/"""
    claude_dir = Path.home() / ".claude" / "projects"
    if not claude_dir.exists():
        return []
    return list(claude_dir.rglob("*.jsonl"))


def parse_entries(files: list[Path]) -> list[dict]:
    """Parse all JSONL files and return assistant usage entries."""
    entries = []
    for filepath in files:
        try:
            with open(filepath, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line:
                        continue
                    try:
                        obj = json.loads(line)
                    except json.JSONDecodeError:
                        continue

                    # Only care about assistant messages with usage data
                    if obj.get("type") != "assistant":
                        continue

                    usage = None
                    # Usage can be at top level or nested under message
                    if "usage" in obj:
                        usage = obj["usage"]
                    elif isinstance(obj.get("message"), dict):
                        usage = obj["message"].get("usage")

                    if not usage:
                        continue

                    input_t = usage.get("input_tokens", 0) or 0
                    output_t = usage.get("output_tokens", 0) or 0
                    cache_read = usage.get("cache_read_input_tokens", 0) or 0
                    cache_create = usage.get("cache_creation_input_tokens", 0) or 0

                    # Skip entries with no meaningful data
                    if input_t + output_t + cache_read + cache_create == 0:
                        continue

                    ts_raw = obj.get("timestamp")
                    if not ts_raw:
                        continue

                    try:
                        # Parse ISO 8601 timestamp
                        ts = datetime.fromisoformat(ts_raw.replace("Z", "+00:00"))
                        ts = ts.astimezone(timezone.utc)
                    except (ValueError, AttributeError):
                        continue

                    entries.append({
                        "ts": ts,
                        "input": input_t,
                        "output": output_t,
                        "cache_read": cache_read,
                        "cache_create": cache_create,
                        "total": input_t + output_t + cache_read + cache_create,
                    })
        except (OSError, PermissionError):
            continue

    entries.sort(key=lambda e: e["ts"])
    return entries


def get_today_window_start(now: datetime) -> datetime:
    """
    Return the start of the current 'day' window.
    The window resets at RESET_HOUR_UTC each day.
    If current time is before RESET_HOUR_UTC today, window started at RESET_HOUR_UTC yesterday.
    If current time is at or after RESET_HOUR_UTC today, window started at RESET_HOUR_UTC today.
    """
    today_reset = now.replace(hour=RESET_HOUR_UTC, minute=0, second=0, microsecond=0)
    if now < today_reset:
        # We're before today's reset, so window started yesterday
        return today_reset - timedelta(days=1)
    return today_reset


def compute_hourly_patterns(entries: list[dict]) -> list[int]:
    """Sum total tokens per UTC hour-of-day (0-23) across all history."""
    hourly = [0] * 24
    for e in entries:
        h = e["ts"].hour
        hourly[h] += e["total"]
    return hourly


def compute_today_tokens(entries: list[dict], now: datetime) -> dict:
    """Sum tokens for the current reset window."""
    window_start = get_today_window_start(now)
    totals = {"input": 0, "output": 0, "cache_read": 0, "cache_create": 0}
    for e in entries:
        if e["ts"] >= window_start:
            totals["input"] += e["input"]
            totals["output"] += e["output"]
            totals["cache_read"] += e["cache_read"]
            totals["cache_create"] += e["cache_create"]
    return totals


def compute_daily_history(entries: list[dict], now: datetime, days: int = 14) -> list[dict]:
    """
    Compute per-day totals for the last `days` days.
    Each 'day' runs from RESET_HOUR_UTC on date D to RESET_HOUR_UTC on date D+1.
    The label is the calendar date when the window *starts*.
    """
    # Build windows: day_label -> (window_start, window_end)
    windows = []
    today_window_start = get_today_window_start(now)
    for i in range(days - 1, -1, -1):
        ws = today_window_start - timedelta(days=i)
        we = ws + timedelta(days=1)
        label = ws.strftime("%Y-%m-%d")
        windows.append((label, ws, we))

    # Bucket entries
    daily: dict[str, int] = {label: 0 for label, _, _ in windows}
    for e in entries:
        for label, ws, we in windows:
            if ws <= e["ts"] < we:
                daily[label] += e["total"]
                break

    return [{"date": label, "total": daily[label]} for label, _, _ in windows]


def compute_sessions(entries: list[dict], gap_minutes: int = 30) -> list[dict]:
    """
    Group entries into sessions. A new session starts when the gap between
    consecutive entries exceeds `gap_minutes`.
    """
    if not entries:
        return []

    sessions = []
    session_start = entries[0]["ts"]
    session_end = entries[0]["ts"]
    session_total = entries[0]["total"]

    for e in entries[1:]:
        gap = (e["ts"] - session_end).total_seconds() / 60
        if gap > gap_minutes:
            sessions.append({
                "start": session_start.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "end": session_end.strftime("%Y-%m-%dT%H:%M:%SZ"),
                "total_tokens": session_total,
            })
            session_start = e["ts"]
            session_total = 0
        session_end = e["ts"]
        session_total += e["total"]

    sessions.append({
        "start": session_start.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "end": session_end.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "total_tokens": session_total,
    })

    # Return most recent 50 sessions, newest first
    return list(reversed(sessions[-50:]))


def build_data() -> dict:
    now = datetime.now(timezone.utc)

    print("Scanning for JSONL files in ~/.claude/projects/ ...")
    files = find_jsonl_files()
    print(f"  Found {len(files)} file(s).")

    entries = parse_entries(files)
    print(f"  Parsed {len(entries)} token usage entries.")

    data = {
        "generated_at": now.strftime("%Y-%m-%dT%H:%M:%SZ"),
        "reset_hour_utc": RESET_HOUR_UTC,
        "hourly_patterns": compute_hourly_patterns(entries),
        "today_tokens": compute_today_tokens(entries, now),
        "daily_history": compute_daily_history(entries, now),
        "sessions": compute_sessions(entries),
    }
    return data


def write_data(data: dict):
    with open(OUTPUT_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
    print(f"  Written to {OUTPUT_FILE}")


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(SCRIPT_DIR), **kwargs)

    def log_message(self, format, *args):
        # Only log non-200 responses to keep output clean
        if args and len(args) >= 2 and not str(args[1]).startswith("2"):
            super().log_message(format, *args)


def run_server():
    with socketserver.TCPServer(("", PORT), QuietHandler) as httpd:
        httpd.allow_reuse_address = True
        print(f"\nServing on http://localhost:{PORT}/")
        print(f"Dashboard: http://localhost:{PORT}/token-tracker.html")
        print("Press Ctrl+C to stop.\n")
        httpd.serve_forever()


def main():
    print("=== Claude Code Token Tracker ===\n")

    data = build_data()
    write_data(data)

    # Open browser after a short delay to let server start
    url = f"http://localhost:{PORT}/token-tracker.html"
    threading.Timer(1.2, lambda: webbrowser.open(url)).start()

    run_server()


if __name__ == "__main__":
    main()
