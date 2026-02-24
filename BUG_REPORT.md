# Bug Report: BattleChain Testnet — Block Production Halted

**Date:** 2026-02-23
**Reporter:** 0x72598c4c5cfd3685e2f908fc3d3b9df7320149d4
**Severity:** Critical — Testnet is unusable
**RPC Endpoint:** `https://testnet.battlechain.com:3051`
**Chain ID:** 627 (`0x273`)

---

## Summary

The BattleChain testnet has stopped producing blocks. Transactions are accepted into the mempool by the RPC node but are never included in a block. The chain has been stalled at block #33 since `2026-02-23T17:12:28Z`. The node reports `eth_syncing: false`, indicating it believes it is fully synced — yet no new blocks are being created.

---

## Impact

- All submitted transactions remain permanently pending
- No contract deployments, state changes, or transfers can be executed
- The testnet is completely non-functional for any user

---

## Evidence

### 1. Chain is stuck at block #33

The latest block has not changed in over 30 minutes. Repeated queries 5 seconds apart return the same block number.

```bash
curl -s -X POST https://testnet.battlechain.com:3051 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'
```

**Response:**
```json
{"jsonrpc":"2.0","id":1,"result":"0x21"}
```

Block `0x21` = **33 in decimal**. This has not incremented.

---

### 2. Latest block details

```bash
curl -s -X POST https://testnet.battlechain.com:3051 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getBlockByNumber","params":["latest",false],"id":1}'
```

**Key fields:**
| Field | Value |
|-------|-------|
| `number` | `0x21` (33) |
| `timestamp` | `0x699c8a7c` (2026-02-23T17:12:28Z) |
| `miner` | `0x36615cf349d7f6344891b1e7ca7c72883f5dc049` |
| `gasUsed` | `0x2f617` |
| `gasLimit` | `0x5f5e100` (100,000,000) |
| `transactions` | 1 |
| `hash` | `0x49d88c2a6f52647bc8e6de2a2e14cbe2af34d9c1f701f19a6da0719a18ac45f6` |

---

### 3. Example stuck transaction

Transaction `0x7975dd90be5bb772bab617352e3fa1b0f18b02372c2c87ddeb5ce46032ac506b` was submitted to the BattleChainDeployer contract and accepted by the RPC but never mined.

```bash
curl -s -X POST https://testnet.battlechain.com:3051 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getTransactionByHash","params":["0x7975dd90be5bb772bab617352e3fa1b0f18b02372c2c87ddeb5ce46032ac506b"],"id":1}'
```

**Key fields:**
| Field | Value |
|-------|-------|
| `hash` | `0x7975dd...ac506b` |
| `from` | `0x72598c4c5cfd3685e2f908fc3d3b9df7320149d4` |
| `to` | `0x8f57054cba2021bee15631067dd7b7e0b43f17dc` (BattleChainDeployer) |
| `nonce` | `0xa` (10) |
| `gas` | `0x3fcc0` (261,312) |
| `maxFeePerGas` | `0x5865a38` |
| **`blockHash`** | **`null`** |
| **`blockNumber`** | **`null`** |
| **`transactionIndex`** | **`null`** |

All three block-related fields are `null`, confirming the transaction is in the mempool but has **never been included in a block**.

---

### 4. Transaction receipt does not exist

```bash
curl -s -X POST https://testnet.battlechain.com:3051 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getTransactionReceipt","params":["0x7975dd90be5bb772bab617352e3fa1b0f18b02372c2c87ddeb5ce46032ac506b"],"id":1}'
```

**Response:**
```json
{"jsonrpc":"2.0","id":1,"result":null}
```

No receipt = the transaction was never executed.

---

### 5. Nonce gap confirms 10 stuck transactions

```bash
# Confirmed nonce (mined transactions)
curl -s -X POST https://testnet.battlechain.com:3051 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getTransactionCount","params":["0x72598c4c5cfd3685e2f908fc3d3b9df7320149d4","latest"],"id":1}'

# Pending nonce (includes mempool)
curl -s -X POST https://testnet.battlechain.com:3051 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_getTransactionCount","params":["0x72598c4c5cfd3685e2f908fc3d3b9df7320149d4","pending"],"id":1}'
```

| Nonce Type | Value | Decimal |
|------------|-------|---------|
| `latest` (confirmed) | `0x1` | 1 |
| `pending` (mempool) | `0xb` | 11 |
| **Stuck transactions** | — | **10** |

The wallet has submitted 11 transactions total. Only 1 has ever been confirmed on-chain. 10 remain stuck in the mempool.

---

### 6. Node is not syncing

```bash
curl -s -X POST https://testnet.battlechain.com:3051 \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_syncing","params":[],"id":1}'
```

**Response:**
```json
{"jsonrpc":"2.0","id":1,"result":false}
```

The node reports it is **not syncing**, meaning it believes it is at the chain tip. This rules out the node being behind — the chain itself is not producing blocks.

---

## Reproduction Steps

1. Connect a wallet to BattleChain Testnet (Chain ID 627, RPC `https://testnet.battlechain.com:3051`)
2. Submit any transaction (e.g., contract deployment via BattleChainDeployer at `0x8f57054CBa2021bEE15631067dd7B7E0B43F17Dc`)
3. Transaction is accepted by the RPC and a hash is returned
4. Transaction is never mined — `eth_getTransactionByHash` shows `blockHash: null`
5. `eth_getTransactionReceipt` returns `null`
6. `eth_blockNumber` remains at `0x21` (33) indefinitely

---

## Expected Behavior

- New blocks should be produced regularly (every few seconds for a testnet)
- Submitted transactions should be included in the next available block
- `eth_getTransactionReceipt` should return a receipt within a reasonable time

---

## Likely Root Cause

The validator/sequencer node (`0x36615cf349d7f6344891b1e7ca7c72883f5dc049`) responsible for producing blocks appears to have stopped. The RPC node is alive and accepting transactions into its mempool, but no entity is sealing those transactions into new blocks.

---

## Requested Action

1. Restart the validator/sequencer for the testnet
2. Confirm that the 10 pending transactions in the mempool are processed once block production resumes
3. Consider adding monitoring/alerting for block production stalls
