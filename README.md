# Battle Chain

Web interface for the Battle Chain Safe Harbor protocol. Browse, create, and manage Safe Harbor agreements, view registered attacks, and compile Solidity contracts.

### Self-Hosting

```yaml
services:
  battle-chain:
    image: tfeoatmilk/battle-chain-gui
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

Visit `http://localhost:3000` to access Battle Chain!
