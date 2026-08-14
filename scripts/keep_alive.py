"""Pings the production /health endpoint to prevent Render's free tier from
sleeping after inactivity. Run on a schedule by .github/workflows/keep-alive.yml.
Exits non-zero on failure so GitHub emails the repo owner (default Actions
notification behavior) — no extra notification channel needed.
"""
import json
import sys
import urllib.request

HEALTH_URL = "https://pintrade-uwg9.onrender.com/health"
TIMEOUT_SECONDS = 30


def main():
    try:
        with urllib.request.urlopen(HEALTH_URL, timeout=TIMEOUT_SECONDS) as resp:
            body = json.loads(resp.read())
    except Exception as e:
        print(f"FAILED: could not reach {HEALTH_URL}: {e}")
        sys.exit(1)

    if body.get("status") != "ok" or body.get("db") != "connected":
        print(f"FAILED: unhealthy response: {body}")
        sys.exit(1)

    print(f"OK: {body}")


if __name__ == "__main__":
    main()
