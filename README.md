# Battle Chain

Web interface for the Battle Chain Safe Harbor protocol. Browse, create, and manage Safe Harbor agreements, view registered attacks, and compile Solidity contracts.

## Self-Hosting

### Prerequisites

- Docker and Docker Compose

### 1. Create a `docker-compose.yaml`

```yaml
services:
  battle-chain:
    image: ${IMAGE:-battle-chain:latest}
    ports:
      - "3000:3000"
    volumes:
      - ./db:/app/db
    environment:
      - RPC_URL=${RPC_URL:-https://testnet.battlechain.com:3051}
      - CHAIN_ID=${CHAIN_ID:-627}
      - EXPLORER_URL=${EXPLORER_URL:-https://explorer.testnet.battlechain.com}
      - ATTACK_REGISTRY=${ATTACK_REGISTRY:-0x9E62988ccA776ff6613Fa68D34c9AB5431Ce57e1}
      - SAFE_HARBOR_REGISTRY=${SAFE_HARBOR_REGISTRY:-0xCb2A561395118895e2572A04C2D8AB8eCA8d7E5D}
      - AGREEMENT_FACTORY=${AGREEMENT_FACTORY:-0x0EbBEeB3aBeF51801a53Fdd1fb263Ac0f2E3Ed36}
      - BATTLECHAIN_DEPLOYER=${BATTLECHAIN_DEPLOYER:-0x8f57054CBa2021bEE15631067dd7B7E0B43F17Dc}
    restart: unless-stopped
```

### 2. Start

```bash
docker compose up -d
```

### Troubleshooting

**App shows blank page or broken links** — Check that all environment variables are set. Missing or incorrect values will cause the client to fail silently.

**SQLite errors** — Ensure `db/` is writable by UID 1001: `sudo chown -R 1001:1001 ./db`
