#!/usr/bin/env bash
set -euo pipefail

if [ $# -lt 2 ]; then
  echo "Usage: $0 <image-name> <tag>"
  echo "Example: $0 myorg/battle-chain v1.0"
  exit 1
fi

IMAGE="$1"
TAG="$2"

echo "Push ${IMAGE}:${TAG} and ${IMAGE}:latest? [y/N]"
read -r CONFIRM
if [ "$CONFIRM" != "y" ] && [ "$CONFIRM" != "Y" ]; then
  echo "Aborted."
  exit 0
fi

echo "Tagging ${IMAGE}:latest ..."
docker tag "${IMAGE}:${TAG}" "${IMAGE}:latest"

echo "Pushing ${IMAGE}:${TAG} ..."
docker push "${IMAGE}:${TAG}"

echo "Pushing ${IMAGE}:latest ..."
docker push "${IMAGE}:latest"

echo "Done. Pushed ${IMAGE}:${TAG} and ${IMAGE}:latest"
