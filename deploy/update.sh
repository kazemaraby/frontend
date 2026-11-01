#!/usr/bin/env bash
# Updates the frontend on the server: ./deploy/update.sh (from the repository folder).
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
docker compose up -d --build
