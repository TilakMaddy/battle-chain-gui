#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: $0 <image-name> <tag>"
  echo "Example: $0 myorg/battle-chain v1.0"
  exit 1
fi

IMAGE="$1"
TAG="$2"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "Building ${IMAGE}:${TAG} ..."
docker build -t "${IMAGE}:${TAG}" "$PROJECT_DIR"
echo "Done. Image available locally as ${IMAGE}:${TAG}"
echo "Next: ./verify.sh ${IMAGE}:${TAG}"
