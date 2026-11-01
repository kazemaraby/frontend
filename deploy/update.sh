#!/usr/bin/env bash
# Builds the frontend on the server. Run as the sss user from /opt/sss-hr/frontend: ./deploy/update.sh
# nginx serves dist/ directly, so the new version is live as soon as the build ends (no restart).
set -euo pipefail
cd "$(dirname "$0")/.."
git pull --ff-only
npm ci
npm run build
echo "Frontend built into dist/."
