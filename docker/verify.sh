#!/usr/bin/env bash
set -euo pipefail

IMAGE="${1:-battle-chain:latest}"

echo "Running ${IMAGE} on port 3000 ..."
docker run --rm -p 3000:3000 \
  -e RPC_URL=https://testnet.battlechain.com:3051 \
  -e CHAIN_ID=627 \
  -e EXPLORER_URL=https://explorer.testnet.battlechain.com \
  -e ATTACK_REGISTRY=0x9E62988ccA776ff6613Fa68D34c9AB5431Ce57e1 \
  -e SAFE_HARBOR_REGISTRY=0xCb2A561395118895e2572A04C2D8AB8eCA8d7E5D \
  -e AGREEMENT_FACTORY=0x0EbBEeB3aBeF51801a53Fdd1fb263Ac0f2E3Ed36 \
  -e BATTLECHAIN_DEPLOYER=0x8f57054CBa2021bEE15631067dd7B7E0B43F17Dc \
  "$IMAGE"

NAME="${IMAGE%%:*}"
TAG="${IMAGE#*:}"
echo "Next: ./push.sh ${NAME} ${TAG}"
