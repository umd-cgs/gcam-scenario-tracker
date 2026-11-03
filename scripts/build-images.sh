#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
release="${1:-1.0.0}"
if [[ ! "$release" =~ ^[A-Za-z0-9_][A-Za-z0-9_.-]*$ ]]; then
  echo "Use a Docker-compatible release tag, for example 1.0.0." >&2
  exit 1
fi
platform="${PLATFORM:-linux/amd64}"
mkdir -p artifacts
docker build --platform "$platform" -f backend/Dockerfile -t "gcam-tracker-backend:$release" .
docker build --platform "$platform" -t "gcam-tracker-frontend:$release" frontend
docker save "gcam-tracker-backend:$release" "gcam-tracker-frontend:$release" | gzip > "artifacts/gcam-tracker-$release.tar.gz"
echo "Images exported to artifacts/gcam-tracker-$release.tar.gz ($platform)."
