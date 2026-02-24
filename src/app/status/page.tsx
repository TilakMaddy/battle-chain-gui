"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Activity,
  Boxes,
  Clock,
  Fuel,
  Loader2,
  Radio,
  RefreshCw,
  Search,
  Waypoints,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Timer,
  Inbox,
  Layers,
  ListChecks,
  Shield,
  ExternalLink,
} from "lucide-react";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { ContractState } from "@/lib/contracts/types";
import { StateBadge } from "@/components/web3/state-badge";

const RPC_URL = "https://testnet.battlechain.com:3051";
const EXPLORER_URL = "https://explorer.testnet.battlechain.com";

// ---------------------------------------------------------------------------
// RPC helpers
// ---------------------------------------------------------------------------

async function rpc(method: string, params: unknown[] = []) {
  const res = await fetch(RPC_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", method, params, id: 1 }),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message);
  return json.result;
}

function hexToNumber(hex: string): number {
  return parseInt(hex, 16);
}

function hexToBigInt(hex: string): bigint {
  return BigInt(hex);
}

function formatAge(seconds: number): string {
  if (seconds < 0) return "in the future";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600)
    return `${Math.floor(seconds / 60)}m ${seconds % 60}s ago`;
  if (seconds < 86400)
    return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m ago`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h ago`;
}

function formatGwei(hex: string): string {
  const wei = BigInt(hex);
  const gwei = Number(wei) / 1e9;
  return gwei < 0.01 ? "<0.01" : gwei.toFixed(2);
}

function formatEth(wei: bigint): string {
  const eth = Number(wei) / 1e18;
  if (eth === 0) return "0";
  if (eth < 0.0001) return "<0.0001";
  return eth.toFixed(4);
}

function truncateHash(hash: string, chars = 6): string {
  if (hash.length <= chars * 2 + 2) return hash;
  return `${hash.slice(0, chars + 2)}...${hash.slice(-chars)}`;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface BlockInfo {
  number: number;
  timestamp: number;
  hash: string;
  miner: string;
  gasUsed: number;
  gasLimit: number;
  txCount: number;
  baseFeePerGas: string | null;
}

interface ChainHealth {
  status: "operational" | "degraded" | "down" | "loading";
  blockAge: number;
  blockInfo: BlockInfo | null;
  syncing: boolean | { currentBlock: number; highestBlock: number };
  chainId: number | null;
  pendingTxCount: number;
  blockTime: number | null;
}

interface MempoolTx {
  hash: string;
  from: string;
  to: string | null;
  value: bigint;
  nonce: number;
  gas: number;
  maxFeePerGas: string | null;
  maxPriorityFeePerGas: string | null;
  gasPrice: string | null;
  input: string;
}

interface TxpoolStatus {
  pending: number;
  queued: number;
}

interface TxLookup {
  hash: string;
  status: "pending" | "mined" | "failed" | "not_found" | "loading";
  blockNumber: number | null;
  from: string | null;
  to: string | null;
  gasUsed: number | null;
  nonce: number | null;
}

interface NonceDiff {
  address: string;
  confirmed: number;
  pending: number;
  stuck: number;
}

interface RecentBlock {
  number: number;
  timestamp: number;
  hash: string;
  txCount: number;
  gasUsed: number;
  gasLimit: number;
  miner: string;
  timeSincePrev: number | null;
}

interface RpcLatency {
  method: string;
  latency: number;
  success: boolean;
  timestamp: number;
}

// ---------------------------------------------------------------------------
// Mempool fetcher — tries multiple approaches
// ---------------------------------------------------------------------------

function parseTxObject(tx: Record<string, string>): MempoolTx {
  return {
    hash: tx.hash,
    from: tx.from,
    to: tx.to || null,
    value: tx.value ? hexToBigInt(tx.value) : 0n,
    nonce: hexToNumber(tx.nonce),
    gas: hexToNumber(tx.gas),
    maxFeePerGas: tx.maxFeePerGas ?? null,
    maxPriorityFeePerGas: tx.maxPriorityFeePerGas ?? null,
    gasPrice: tx.gasPrice ?? null,
    input: tx.input ?? "0x",
  };
}

async function fetchMempoolTxs(): Promise<{
  txs: MempoolTx[];
  txpoolStatus: TxpoolStatus | null;
  stuckCount: number;
  source: string;
}> {
  let txpoolStatus: TxpoolStatus | null = null;

  // 1. Try txpool_status for counts
  try {
    const status = await rpc("txpool_status");
    txpoolStatus = {
      pending: hexToNumber(status.pending),
      queued: hexToNumber(status.queued),
    };
  } catch {
    // Node may not support txpool namespace
  }

  // 2. Try txpool_content for full mempool dump
  try {
    const content = await rpc("txpool_content");
    const txs: MempoolTx[] = [];

    for (const bucket of [content.pending, content.queued]) {
      if (!bucket) continue;
      for (const senderTxs of Object.values(bucket)) {
        for (const tx of Object.values(
          senderTxs as Record<string, Record<string, string>>
        )) {
          txs.push(parseTxObject(tx));
        }
      }
    }

    if (txs.length > 0 || txpoolStatus) {
      return { txs, txpoolStatus, stuckCount: txs.length, source: "txpool_content" };
    }
  } catch {
    // txpool_content not supported, fall through
  }

  // 3. Compute global stuck count from pending vs latest block tx count.
  //    On ZKSync nodes where txpool is unavailable, the nonce gap from
  //    eth_getBlockTransactionCountByNumber gives us a real stuck count.
  let globalStuck = 0;
  try {
    const [pendingCountHex, latestCountHex] = await Promise.all([
      rpc("eth_getBlockTransactionCountByNumber", ["pending"]),
      rpc("eth_getBlockTransactionCountByNumber", ["latest"]),
    ]);
    const pendingCount = hexToNumber(pendingCountHex);
    const latestCount = hexToNumber(latestCountHex);
    // pending block includes already-mined txs + mempool txs
    globalStuck = Math.max(0, pendingCount - latestCount);
  } catch {
    // ignore
  }

  // 4. Probe pending block by index, filtering out already-mined txs
  try {
    const latestBlock = await rpc("eth_getBlockByNumber", ["latest", false]);
    const minedHashes = new Set<string>(latestBlock?.transactions ?? []);

    const txs: MempoolTx[] = [];
    const MAX_SCAN = 200;
    for (let i = 0; i < MAX_SCAN; i++) {
      const tx = await rpc("eth_getTransactionByBlockNumberAndIndex", [
        "pending",
        "0x" + i.toString(16),
      ]);
      if (!tx) break;
      // Skip txs that are already mined in the latest block
      if (minedHashes.has(tx.hash)) continue;
      txs.push(parseTxObject(tx));
    }
    if (txs.length > 0) {
      return {
        txs,
        txpoolStatus,
        stuckCount: Math.max(globalStuck, txs.length),
        source: "pending_block_index_scan",
      };
    }
  } catch {
    // not supported, fall through
  }

  // 5. If we detected a stuck count > 0 from step 3 but found no enumerable txs,
  //    report the count honestly
  if (globalStuck > 0) {
    return {
      txs: [],
      txpoolStatus,
      stuckCount: globalStuck,
      source: "nonce_gap_detected",
    };
  }

  return { txs: [], txpoolStatus, stuckCount: 0, source: "none" };
}

// ---------------------------------------------------------------------------
// Per-address stuck tx scanner — discovers actual tx hashes from nonce gap
// ---------------------------------------------------------------------------

async function scanAddressStuckTxs(
  address: string
): Promise<{ txs: MempoolTx[]; confirmed: number; pending: number }> {
  const [confirmedHex, pendingHex] = await Promise.all([
    rpc("eth_getTransactionCount", [address, "latest"]),
    rpc("eth_getTransactionCount", [address, "pending"]),
  ]);
  const confirmed = hexToNumber(confirmedHex);
  const pending = hexToNumber(pendingHex);

  if (pending <= confirmed) {
    return { txs: [], confirmed, pending };
  }

  // The node knows about txs with nonces [confirmed .. pending-1].
  // We can't query by sender+nonce directly, but we CAN get the pending block
  // with full tx objects and filter by sender.
  const txs: MempoolTx[] = [];

  try {
    const pendingBlock = await rpc("eth_getBlockByNumber", ["pending", true]);
    const pendingTxObjects = pendingBlock?.transactions ?? [];
    const addrLower = address.toLowerCase();

    for (const tx of pendingTxObjects) {
      if (typeof tx === "string") continue; // hash-only, skip
      if (tx.from?.toLowerCase() === addrLower && tx.blockHash === null) {
        txs.push(parseTxObject(tx));
      }
    }
  } catch {
    // ignore
  }

  // Also scan by index to catch txs the pending block might expose
  try {
    const addrLower = address.toLowerCase();
    const seen = new Set(txs.map((t) => t.hash));
    for (let i = 0; i < 300; i++) {
      const tx = await rpc("eth_getTransactionByBlockNumberAndIndex", [
        "pending",
        "0x" + i.toString(16),
      ]);
      if (!tx) break;
      if (
        tx.from?.toLowerCase() === addrLower &&
        !seen.has(tx.hash) &&
        tx.blockHash === null
      ) {
        txs.push(parseTxObject(tx));
        seen.add(tx.hash);
      }
    }
  } catch {
    // ignore
  }

  return { txs, confirmed, pending };
}

// ---------------------------------------------------------------------------
// Recent blocks fetcher
// ---------------------------------------------------------------------------

async function fetchRecentBlocks(latestNum: number, count = 10): Promise<RecentBlock[]> {
  const start = Math.max(0, latestNum - count + 1);
  const nums = Array.from({ length: latestNum - start + 1 }, (_, i) => start + i);

  const blocks = await Promise.all(
    nums.map((n) =>
      rpc("eth_getBlockByNumber", ["0x" + n.toString(16), false]).catch(() => null)
    )
  );

  const result: RecentBlock[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (!b) continue;
    const prev = i > 0 ? blocks[i - 1] : null;
    result.push({
      number: hexToNumber(b.number),
      timestamp: hexToNumber(b.timestamp),
      hash: b.hash,
      txCount: b.transactions?.length ?? 0,
      gasUsed: hexToNumber(b.gasUsed),
      gasLimit: hexToNumber(b.gasLimit),
      miner: b.miner,
      timeSincePrev: prev ? hexToNumber(b.timestamp) - hexToNumber(prev.timestamp) : null,
    });
  }
  return result.reverse(); // newest first
}

// ---------------------------------------------------------------------------
// RPC latency probe
// ---------------------------------------------------------------------------

async function probeRpcLatency(): Promise<RpcLatency[]> {
  const methods: [string, unknown[]][] = [
    ["eth_blockNumber", []],
    ["eth_chainId", []],
    ["eth_gasPrice", []],
    ["eth_syncing", []],
    ["net_version", []],
  ];

  const results: RpcLatency[] = [];

  for (const [method, params] of methods) {
    const start = performance.now();
    let success = true;
    try {
      await rpc(method, params);
    } catch {
      success = false;
    }
    const latency = Math.round(performance.now() - start);
    results.push({ method, latency, success, timestamp: Date.now() });
  }

  return results;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function StatusPage() {
  const [health, setHealth] = useState<ChainHealth>({
    status: "loading",
    blockAge: 0,
    blockInfo: null,
    syncing: false,
    chainId: null,
    pendingTxCount: 0,
    blockTime: null,
  });
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  // Mempool
  const [mempoolTxs, setMempoolTxs] = useState<MempoolTx[]>([]);
  const [txpoolStatus, setTxpoolStatus] = useState<TxpoolStatus | null>(null);
  const [mempoolSource, setMempoolSource] = useState("loading");
  const [mempoolLoading, setMempoolLoading] = useState(true);
  const [globalStuckCount, setGlobalStuckCount] = useState(0);

  // Address mempool scanner
  const [mempoolScanAddr, setMempoolScanAddr] = useState("");
  const [mempoolScanResult, setMempoolScanResult] = useState<{
    txs: MempoolTx[];
    confirmed: number;
    pending: number;
    stuck: number;
  } | null>(null);
  const [mempoolScanLoading, setMempoolScanLoading] = useState(false);

  // Tx lookup
  const [txInput, setTxInput] = useState("");
  const [txResult, setTxResult] = useState<TxLookup | null>(null);

  // Batch hash checker
  const [batchHashInput, setBatchHashInput] = useState("");
  const [batchResults, setBatchResults] = useState<TxLookup[]>([]);
  const [batchLoading, setBatchLoading] = useState(false);

  // Nonce diff
  const [nonceInput, setNonceInput] = useState("");
  const [nonceResult, setNonceResult] = useState<NonceDiff | null>(null);
  const [nonceLoading, setNonceLoading] = useState(false);

  // Block history for sparkline
  const [blockAgeHistory, setBlockAgeHistory] = useState<number[]>([]);

  // Recent blocks
  const [recentBlocks, setRecentBlocks] = useState<RecentBlock[]>([]);
  const [recentBlocksLoading, setRecentBlocksLoading] = useState(true);

  // RPC latency
  const [rpcLatencies, setRpcLatencies] = useState<RpcLatency[]>([]);
  const [rpcLatencyHistory, setRpcLatencyHistory] = useState<number[]>([]);
  const [rpcProbing, setRpcProbing] = useState(false);

  // Contract state scanner
  const [scanAddress, setScanAddress] = useState("");
  const [scanResult, setScanResult] = useState<{
    code: string;
    balance: string;
    nonce: number;
    isContract: boolean;
    storageRoot: string | null;
  } | null>(null);
  const [scanLoading, setScanLoading] = useState(false);

  // Contract registry
  const [registryContracts, setRegistryContracts] = useState<
    { address: string; state: ContractState }[]
  >([]);
  const [registryLoading, setRegistryLoading] = useState(true);

  // Pulse counter for the live dot
  const pulseRef = useRef(0);
  const [, forceRender] = useState(0);

  const fetchHealth = useCallback(async () => {
    setRefreshing(true);
    try {
      const [blockHex, syncResult, chainIdHex, pendingCountHex] =
        await Promise.all([
          rpc("eth_getBlockByNumber", ["latest", false]),
          rpc("eth_syncing"),
          rpc("eth_chainId"),
          rpc("eth_getBlockTransactionCountByNumber", ["pending"]).catch(
            () => "0x0"
          ),
        ]);

      const block: BlockInfo = {
        number: hexToNumber(blockHex.number),
        timestamp: hexToNumber(blockHex.timestamp),
        hash: blockHex.hash,
        miner: blockHex.miner,
        gasUsed: hexToNumber(blockHex.gasUsed),
        gasLimit: hexToNumber(blockHex.gasLimit),
        txCount: blockHex.transactions?.length ?? 0,
        baseFeePerGas: blockHex.baseFeePerGas ?? null,
      };

      let blockTime: number | null = null;
      if (block.number > 0) {
        try {
          const prevHex = await rpc("eth_getBlockByNumber", [
            "0x" + (block.number - 1).toString(16),
            false,
          ]);
          blockTime = block.timestamp - hexToNumber(prevHex.timestamp);
        } catch {
          // ignore
        }
      }

      const now = Math.floor(Date.now() / 1000);
      const blockAge = now - block.timestamp;

      let status: ChainHealth["status"] = "operational";
      if (blockAge > 300) status = "down";
      else if (blockAge > 60) status = "degraded";

      setHealth({
        status,
        blockAge,
        blockInfo: block,
        syncing: syncResult === false ? false : syncResult,
        chainId: hexToNumber(chainIdHex),
        pendingTxCount: hexToNumber(pendingCountHex),
        blockTime,
      });

      setBlockAgeHistory((prev) => [...prev.slice(-29), blockAge]);
      setLastRefresh(new Date());
    } catch {
      setHealth((h) => ({ ...h, status: "down" }));
    } finally {
      setRefreshing(false);
    }
  }, []);

  const fetchMempool = useCallback(async () => {
    setMempoolLoading(true);
    try {
      const result = await fetchMempoolTxs();
      setMempoolTxs(result.txs);
      setTxpoolStatus(result.txpoolStatus);
      setMempoolSource(result.source);
      setGlobalStuckCount(result.stuckCount);
    } catch {
      setMempoolSource("error");
    } finally {
      setMempoolLoading(false);
    }
  }, []);

  const runMempoolScan = async () => {
    const addr = mempoolScanAddr.trim();
    if (!addr.startsWith("0x") || addr.length !== 42) return;
    setMempoolScanLoading(true);
    setMempoolScanResult(null);
    try {
      const result = await scanAddressStuckTxs(addr);
      setMempoolScanResult({
        ...result,
        stuck: result.pending - result.confirmed,
      });
    } catch {
      setMempoolScanResult(null);
    } finally {
      setMempoolScanLoading(false);
    }
  };

  const fetchBlocks = useCallback(async (latestNum?: number) => {
    setRecentBlocksLoading(true);
    try {
      let num = latestNum;
      if (num === undefined) {
        const hex = await rpc("eth_blockNumber");
        num = hexToNumber(hex);
      }
      const blocks = await fetchRecentBlocks(num, 15);
      setRecentBlocks(blocks);
    } catch {
      // ignore
    } finally {
      setRecentBlocksLoading(false);
    }
  }, []);

  const runLatencyProbe = useCallback(async () => {
    setRpcProbing(true);
    try {
      const results = await probeRpcLatency();
      setRpcLatencies(results);
      const avg = Math.round(
        results.reduce((s, r) => s + r.latency, 0) / results.length
      );
      setRpcLatencyHistory((prev) => [...prev.slice(-29), avg]);
    } catch {
      // ignore
    } finally {
      setRpcProbing(false);
    }
  }, []);

  // Contract/address scanner
  const scanContract = async () => {
    const addr = scanAddress.trim();
    if (!addr.startsWith("0x") || addr.length !== 42) return;
    setScanLoading(true);
    setScanResult(null);
    try {
      const [code, balanceHex, nonceHex] = await Promise.all([
        rpc("eth_getCode", [addr, "latest"]),
        rpc("eth_getBalance", [addr, "latest"]),
        rpc("eth_getTransactionCount", [addr, "latest"]),
      ]);

      // Try to get storage at slot 0 for contracts
      let storageRoot: string | null = null;
      if (code !== "0x") {
        try {
          storageRoot = await rpc("eth_getStorageAt", [addr, "0x0", "latest"]);
        } catch {
          // ignore
        }
      }

      setScanResult({
        code,
        balance: formatEth(BigInt(balanceHex)),
        nonce: hexToNumber(nonceHex),
        isContract: code !== "0x",
        storageRoot,
      });
    } catch {
      setScanResult(null);
    } finally {
      setScanLoading(false);
    }
  };

  // Fetch contracts from AttackRegistry via event logs
  const fetchRegistry = useCallback(async () => {
    setRegistryLoading(true);
    try {
      // Query all logs from AttackRegistry — the contract address narrows it enough.
      // Event: AgreementStateChanged(address indexed agreementAddress, uint8 previousState, uint8 newState)
      // topic[1] = agreementAddress (indexed), data = abi.encode(uint8 prevState, uint8 newState)
      const logs = await rpc("eth_getLogs", [
        {
          address: CONTRACTS.AttackRegistry,
          fromBlock: "0x0",
          toBlock: "latest",
        },
      ]);

      const map = new Map<string, ContractState>();
      for (const log of logs) {
        try {
          const topics = log.topics;
          if (!topics || topics.length < 2) continue;
          // topic[1] = indexed agreementAddress (left-padded to 32 bytes)
          const addr = "0x" + topics[1].slice(26);
          // data contains two uint8s encoded as 32-byte words:
          //   bytes 0-31: previousState, bytes 32-63: newState
          const data: string = log.data;
          let newState: number;
          if (data.length >= 130) {
            // Full 64 bytes (0x + 128 hex chars): parse second word
            newState = parseInt(data.slice(66, 130), 16);
          } else if (data.length >= 66) {
            // Single word
            newState = parseInt(data.slice(2, 66), 16);
          } else {
            newState = parseInt(data.slice(-2), 16);
          }
          if (newState >= 0 && newState <= 6) {
            map.set(addr.toLowerCase(), newState as ContractState);
          }
        } catch {
          // skip malformed log
        }
      }

      const contracts = Array.from(map.entries()).map(([address, state]) => ({
        address,
        state,
      }));
      setRegistryContracts(contracts);
    } catch {
      // ignore
    } finally {
      setRegistryLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchHealth();
    fetchMempool();
    fetchBlocks();
    runLatencyProbe();
    fetchRegistry();
    const healthInterval = setInterval(fetchHealth, 10_000);
    const mempoolInterval = setInterval(fetchMempool, 12_000);
    const latencyInterval = setInterval(runLatencyProbe, 15_000);
    const pulseInterval = setInterval(() => {
      pulseRef.current++;
      forceRender((n) => n + 1);
    }, 1000);
    return () => {
      clearInterval(healthInterval);
      clearInterval(mempoolInterval);
      clearInterval(latencyInterval);
      clearInterval(pulseInterval);
    };
  }, [fetchHealth, fetchMempool, fetchBlocks, runLatencyProbe, fetchRegistry]);

  // Re-fetch blocks whenever latest block changes
  useEffect(() => {
    if (health.blockInfo) {
      fetchBlocks(health.blockInfo.number);
    }
  }, [health.blockInfo?.number, fetchBlocks]);

  // Tx lookup handler
  const lookupTx = async () => {
    const hash = txInput.trim();
    if (!hash.startsWith("0x") || hash.length !== 66) return;
    setTxResult({
      hash,
      status: "loading",
      blockNumber: null,
      from: null,
      to: null,
      gasUsed: null,
      nonce: null,
    });

    try {
      const [tx, receipt] = await Promise.all([
        rpc("eth_getTransactionByHash", [hash]),
        rpc("eth_getTransactionReceipt", [hash]),
      ]);

      if (!tx) {
        setTxResult({
          hash,
          status: "not_found",
          blockNumber: null,
          from: null,
          to: null,
          gasUsed: null,
          nonce: null,
        });
        return;
      }

      if (!receipt) {
        setTxResult({
          hash,
          status: "pending",
          blockNumber: null,
          from: tx.from,
          to: tx.to,
          gasUsed: null,
          nonce: hexToNumber(tx.nonce),
        });
        return;
      }

      setTxResult({
        hash,
        status: receipt.status === "0x1" ? "mined" : "failed",
        blockNumber: hexToNumber(receipt.blockNumber),
        from: tx.from,
        to: tx.to,
        gasUsed: hexToNumber(receipt.gasUsed),
        nonce: hexToNumber(tx.nonce),
      });
    } catch {
      setTxResult({
        hash,
        status: "not_found",
        blockNumber: null,
        from: null,
        to: null,
        gasUsed: null,
        nonce: null,
      });
    }
  };

  // Batch hash lookup — paste multiple hashes (comma, newline, or space separated)
  const lookupBatch = async () => {
    const raw = batchHashInput.trim();
    if (!raw) return;
    const hashes = raw
      .split(/[\s,\n]+/)
      .map((h) => h.trim())
      .filter((h) => h.startsWith("0x") && h.length === 66);
    if (hashes.length === 0) return;

    setBatchLoading(true);
    setBatchResults([]);

    const results: TxLookup[] = [];
    // Process in batches of 5 to avoid overwhelming the RPC
    for (let i = 0; i < hashes.length; i += 5) {
      const batch = hashes.slice(i, i + 5);
      const batchRes = await Promise.all(
        batch.map(async (hash) => {
          try {
            const [tx, receipt] = await Promise.all([
              rpc("eth_getTransactionByHash", [hash]),
              rpc("eth_getTransactionReceipt", [hash]),
            ]);

            if (!tx) {
              return {
                hash,
                status: "not_found" as const,
                blockNumber: null,
                from: null,
                to: null,
                gasUsed: null,
                nonce: null,
              };
            }

            if (!receipt) {
              return {
                hash,
                status: "pending" as const,
                blockNumber: null,
                from: tx.from,
                to: tx.to,
                gasUsed: null,
                nonce: hexToNumber(tx.nonce),
              };
            }

            return {
              hash,
              status: (receipt.status === "0x1" ? "mined" : "failed") as
                | "mined"
                | "failed",
              blockNumber: hexToNumber(receipt.blockNumber),
              from: tx.from,
              to: tx.to,
              gasUsed: hexToNumber(receipt.gasUsed),
              nonce: hexToNumber(tx.nonce),
            };
          } catch {
            return {
              hash,
              status: "not_found" as const,
              blockNumber: null,
              from: null,
              to: null,
              gasUsed: null,
              nonce: null,
            };
          }
        })
      );
      results.push(...batchRes);
    }

    setBatchResults(results);
    setBatchLoading(false);
  };

  // Nonce diff handler
  const checkNonce = async () => {
    const addr = nonceInput.trim();
    if (!addr.startsWith("0x") || addr.length !== 42) return;
    setNonceLoading(true);
    try {
      const [confirmedHex, pendingHex] = await Promise.all([
        rpc("eth_getTransactionCount", [addr, "latest"]),
        rpc("eth_getTransactionCount", [addr, "pending"]),
      ]);
      const confirmed = hexToNumber(confirmedHex);
      const pending = hexToNumber(pendingHex);
      setNonceResult({
        address: addr,
        confirmed,
        pending,
        stuck: pending - confirmed,
      });
    } catch {
      setNonceResult(null);
    } finally {
      setNonceLoading(false);
    }
  };

  const statusConfig = {
    operational: {
      border: "border-green-500/30",
      bg: "bg-green-500/10",
      text: "text-green-400",
      label: "Operational",
      icon: CheckCircle,
      pulse: "animate-pulse",
      glow: "shadow-green-500/20 shadow-lg",
    },
    degraded: {
      border: "border-yellow-500/30",
      bg: "bg-yellow-500/10",
      text: "text-yellow-400",
      label: "Degraded",
      icon: AlertTriangle,
      pulse: "animate-pulse",
      glow: "shadow-yellow-500/20 shadow-lg",
    },
    down: {
      border: "border-red-500/30",
      bg: "bg-red-500/10",
      text: "text-red-400",
      label: "Down",
      icon: XCircle,
      pulse: "",
      glow: "shadow-red-500/20 shadow-lg",
    },
    loading: {
      border: "border-gray-500/30",
      bg: "bg-gray-500/10",
      text: "text-gray-400",
      label: "Checking...",
      icon: Loader2,
      pulse: "animate-spin",
      glow: "",
    },
  };

  const sc = statusConfig[health.status];
  const StatusIcon = sc.icon;
  const liveDot = pulseRef.current % 2 === 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Chain Status"
        description="Live health monitor for BattleChain Testnet"
      >
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className={`inline-block h-2 w-2 rounded-full transition-opacity duration-500 ${
                liveDot ? "opacity-100" : "opacity-30"
              } ${health.status === "operational" ? "bg-green-500" : health.status === "degraded" ? "bg-yellow-500" : health.status === "down" ? "bg-red-500" : "bg-gray-500"}`}
            />
            LIVE
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              fetchHealth();
              fetchMempool();
            }}
            disabled={refreshing}
          >
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </PageHeader>

      {/* ------------------------------------------------------------------ */}
      {/* Hero Status Banner                                                  */}
      {/* ------------------------------------------------------------------ */}
      <Card className={`${sc.border} ${sc.bg} ${sc.glow}`}>
        <CardContent className="flex items-center justify-between py-6">
          <div className="flex items-center gap-4">
            <div className="relative">
              <StatusIcon className={`h-12 w-12 ${sc.text} ${sc.pulse}`} />
              {health.status === "operational" && (
                <span className="absolute -top-0.5 -right-0.5 flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
                </span>
              )}
            </div>
            <div>
              <h2 className={`text-3xl font-black tracking-tight ${sc.text}`}>
                {sc.label}
              </h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                {health.status === "operational" &&
                  "Chain is producing blocks normally."}
                {health.status === "degraded" &&
                  "Block production is slow. Transactions may be delayed."}
                {health.status === "down" &&
                  "Block production has stalled. Transactions are stuck in the mempool."}
                {health.status === "loading" &&
                  "Connecting to RPC endpoint..."}
              </p>
            </div>
          </div>
          <div className="text-right text-sm text-muted-foreground hidden sm:block">
            <p className="font-mono">
              Chain ID: {health.chainId ?? "---"}
            </p>
            {lastRefresh && (
              <p className="text-xs mt-0.5">
                {lastRefresh.toLocaleTimeString()}
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Stat Cards                                                          */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          label="Latest Block"
          icon={<Boxes className="h-4 w-4 text-muted-foreground" />}
          value={
            health.blockInfo
              ? `#${health.blockInfo.number.toLocaleString()}`
              : null
          }
          sub={
            health.blockInfo
              ? `${health.blockInfo.txCount} tx${health.blockInfo.txCount !== 1 ? "s" : ""}`
              : undefined
          }
        />
        <StatCard
          label="Block Age"
          icon={<Clock className="h-4 w-4 text-muted-foreground" />}
          value={health.blockInfo ? formatAge(health.blockAge) : null}
          valueClass={
            health.blockAge > 300
              ? "text-red-400"
              : health.blockAge > 60
                ? "text-yellow-400"
                : "text-green-400"
          }
          sub={
            health.blockInfo
              ? new Date(
                  health.blockInfo.timestamp * 1000
                ).toLocaleTimeString()
              : undefined
          }
        />
        <StatCard
          label="Last Block Time"
          icon={<Timer className="h-4 w-4 text-muted-foreground" />}
          value={
            health.blockTime !== null
              ? `${health.blockTime}s`
              : health.blockInfo
                ? "\u2014"
                : null
          }
          sub={
            health.blockTime !== null && health.blockInfo
              ? `#${health.blockInfo.number - 1} \u2192 #${health.blockInfo.number}`
              : undefined
          }
        />
        <StatCard
          label="Gas Usage"
          icon={<Fuel className="h-4 w-4 text-muted-foreground" />}
          value={
            health.blockInfo
              ? `${((health.blockInfo.gasUsed / health.blockInfo.gasLimit) * 100).toFixed(1)}%`
              : null
          }
          sub={
            health.blockInfo
              ? `${(health.blockInfo.gasUsed / 1e6).toFixed(2)}M / ${(health.blockInfo.gasLimit / 1e6).toFixed(0)}M`
              : undefined
          }
        />
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Block Age Sparkline                                                 */}
      {/* ------------------------------------------------------------------ */}
      {blockAgeHistory.length > 1 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-sm font-medium">
              <Activity className="h-4 w-4" />
              Block Freshness
              <span className="text-xs font-normal text-muted-foreground">
                (sampled every 10s)
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-[3px] h-16">
              {blockAgeHistory.map((age, i) => {
                const maxAge = Math.max(...blockAgeHistory, 60);
                const height = Math.max(3, (age / maxAge) * 64);
                const color =
                  age > 300
                    ? "bg-red-500"
                    : age > 60
                      ? "bg-yellow-500"
                      : "bg-green-500";
                const isLatest = i === blockAgeHistory.length - 1;
                return (
                  <div
                    key={i}
                    className={`${color} rounded-sm flex-1 min-w-[3px] transition-all duration-500 ${isLatest ? "opacity-100" : "opacity-70"}`}
                    style={{ height: `${height}px` }}
                    title={`${age}s`}
                  />
                );
              })}
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[10px] text-muted-foreground">
                {blockAgeHistory.length * 10}s ago
              </span>
              <div className="flex gap-3 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-green-500" />
                  &lt;1m
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-500" />
                  1-5m
                </span>
                <span className="flex items-center gap-1">
                  <span className="inline-block h-1.5 w-1.5 rounded-full bg-red-500" />
                  &gt;5m
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground">now</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* MEMPOOL VIEWER                                                      */}
      {/* ------------------------------------------------------------------ */}
      <Card
        className={
          mempoolTxs.length > 0 || globalStuckCount > 0
            ? "border-yellow-500/30 bg-yellow-500/5"
            : ""
        }
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              Mempool
              {(mempoolTxs.length > 0 || globalStuckCount > 0) && (
                <Badge
                  variant="outline"
                  className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 animate-pulse ml-1"
                >
                  {mempoolTxs.length > 0
                    ? `${mempoolTxs.length} visible`
                    : `${globalStuckCount} stuck`}
                </Badge>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              {txpoolStatus && (
                <div className="flex gap-3 text-xs text-muted-foreground">
                  <span>
                    Pending:{" "}
                    <span className="font-mono font-medium text-yellow-400">
                      {txpoolStatus.pending}
                    </span>
                  </span>
                  <span>
                    Queued:{" "}
                    <span className="font-mono font-medium text-orange-400">
                      {txpoolStatus.queued}
                    </span>
                  </span>
                </div>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchMempool}
                disabled={mempoolLoading}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${mempoolLoading ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {mempoolLoading && mempoolTxs.length === 0 ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : mempoolTxs.length === 0 ? (
            <div className="text-center py-8">
              {mempoolSource === "nonce_gap_detected" ? (
                <>
                  <AlertTriangle className="h-10 w-10 text-red-500/60 mx-auto mb-2" />
                  <p className="text-sm text-red-300">
                    {globalStuckCount} stuck transaction{globalStuckCount !== 1 ? "s" : ""} detected
                    via nonce gap analysis.
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    The RPC node does not support txpool methods and its pending block is stale.
                    Enter a wallet address below to scan for that address&apos;s stuck transactions.
                  </p>
                </>
              ) : mempoolSource === "pending_block_stale" ||
              mempoolSource === "pending_count_only" ? (
                <>
                  <AlertTriangle className="h-10 w-10 text-yellow-500/60 mx-auto mb-2" />
                  <p className="text-sm text-yellow-300">
                    {txpoolStatus
                      ? `${txpoolStatus.pending} pending + ${txpoolStatus.queued} queued transactions detected, but the RPC node does not expose individual transaction data.`
                      : "Pending transactions detected, but the RPC node does not expose individual transaction data."}
                  </p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Enter a wallet address below to scan for stuck transactions.
                  </p>
                </>
              ) : mempoolSource === "none" || mempoolSource === "error" ? (
                <>
                  <Inbox className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Could not query mempool. The RPC node may not expose txpool or pending block data.
                  </p>
                </>
              ) : (
                <>
                  <Inbox className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">
                    Mempool is empty. No pending transactions.
                  </p>
                </>
              )}
              {mempoolSource !== "none" && mempoolSource !== "error" && (
                <p className="text-[10px] text-muted-foreground/50 mt-2">
                  Source: {mempoolSource}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-1">
              {/* Header row */}
              <div className="grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-1">
                <div className="col-span-3">Tx Hash</div>
                <div className="col-span-3">From</div>
                <div className="col-span-2">To</div>
                <div className="col-span-1 text-right">Nonce</div>
                <div className="col-span-1 text-right">Value</div>
                <div className="col-span-1 text-right">Gas</div>
                <div className="col-span-1 text-right">Fee</div>
              </div>
              <Separator />

              {/* Tx rows */}
              <div className="max-h-[400px] overflow-y-auto space-y-0.5">
                {mempoolTxs.map((tx) => {
                  const isContractDeploy = !tx.to;
                  return (
                    <div
                      key={tx.hash}
                      className="grid grid-cols-12 gap-2 items-center rounded-md px-3 py-2 text-xs font-mono hover:bg-muted/50 transition-colors group"
                    >
                      <div className="col-span-3 flex items-center gap-1.5">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse shrink-0" />
                        <span
                          className="truncate cursor-pointer hover:text-foreground"
                          title={tx.hash}
                          onClick={() => {
                            setTxInput(tx.hash);
                            setTxResult(null);
                          }}
                        >
                          {truncateHash(tx.hash, 8)}
                        </span>
                      </div>
                      <div
                        className="col-span-3 truncate text-muted-foreground"
                        title={tx.from}
                      >
                        {truncateHash(tx.from)}
                      </div>
                      <div
                        className="col-span-2 truncate text-muted-foreground"
                        title={tx.to ?? "Contract Creation"}
                      >
                        {isContractDeploy ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] py-0 px-1 bg-blue-500/10 text-blue-400 border-blue-500/30"
                          >
                            CREATE
                          </Badge>
                        ) : (
                          truncateHash(tx.to!)
                        )}
                      </div>
                      <div className="col-span-1 text-right text-muted-foreground">
                        {tx.nonce}
                      </div>
                      <div className="col-span-1 text-right">
                        {formatEth(tx.value)}
                      </div>
                      <div className="col-span-1 text-right text-muted-foreground">
                        {(tx.gas / 1000).toFixed(0)}k
                      </div>
                      <div className="col-span-1 text-right text-muted-foreground">
                        {tx.maxFeePerGas
                          ? formatGwei(tx.maxFeePerGas)
                          : tx.gasPrice
                            ? formatGwei(tx.gasPrice)
                            : "—"}
                      </div>
                    </div>
                  );
                })}
              </div>

              <Separator />
              <div className="flex items-center justify-between px-3 pt-2 text-[10px] text-muted-foreground">
                <span>
                  {mempoolTxs.length} transaction
                  {mempoolTxs.length !== 1 ? "s" : ""} in mempool
                </span>
                <span>
                  via{" "}
                  {mempoolSource === "txpool_content"
                    ? "txpool_content"
                    : mempoolSource === "pending_block_index_scan"
                      ? "eth_getTransactionByBlockNumberAndIndex(pending)"
                      : mempoolSource === "pending_block"
                        ? "eth_getBlockByNumber(pending)"
                        : mempoolSource === "nonce_gap_detected"
                          ? "eth_getTransactionCount(pending) nonce gap"
                          : mempoolSource}
                </span>
              </div>
            </div>
          )}

          {/* Address mempool scanner */}
          <div className="mt-4 pt-4 border-t border-border/50">
            <p className="text-sm font-medium mb-1">Scan Address for Stuck Transactions</p>
            <p className="text-xs text-muted-foreground mb-3">
              Enter a wallet address to detect its stuck transactions via nonce gap analysis
              and enumerate any visible pending txs.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="0x... wallet address"
                value={mempoolScanAddr}
                onChange={(e) => setMempoolScanAddr(e.target.value)}
                className="font-mono text-sm"
                onKeyDown={(e) => e.key === "Enter" && runMempoolScan()}
              />
              <Button
                onClick={runMempoolScan}
                disabled={
                  !mempoolScanAddr.startsWith("0x") ||
                  mempoolScanAddr.length !== 42 ||
                  mempoolScanLoading
                }
                variant="outline"
              >
                {mempoolScanLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            {mempoolScanResult && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-3 gap-2">
                  <NonceStat label="Confirmed" value={mempoolScanResult.confirmed} />
                  <NonceStat label="Pending" value={mempoolScanResult.pending} />
                  <NonceStat
                    label="Stuck"
                    value={mempoolScanResult.stuck}
                    variant={mempoolScanResult.stuck > 0 ? "danger" : "success"}
                  />
                </div>

                {mempoolScanResult.stuck > 0 && mempoolScanResult.txs.length === 0 && (
                  <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3 text-sm text-yellow-300">
                    {mempoolScanResult.stuck} transaction
                    {mempoolScanResult.stuck !== 1 ? "s are" : " is"} stuck in the mempool
                    (nonces {mempoolScanResult.confirmed} through {mempoolScanResult.pending - 1}).
                    The RPC node does not expose individual pending transaction data for enumeration.
                  </div>
                )}

                {mempoolScanResult.stuck === 0 && (
                  <div className="rounded-md border border-green-500/30 bg-green-500/5 p-3 text-sm text-green-300">
                    No stuck transactions for this address.
                  </div>
                )}

                {mempoolScanResult.txs.length > 0 && (
                  <div className="space-y-0.5 max-h-[300px] overflow-y-auto">
                    {mempoolScanResult.txs.map((tx) => (
                      <div
                        key={tx.hash}
                        className="flex items-center gap-3 rounded-md px-3 py-2 text-xs font-mono hover:bg-muted/50 transition-colors"
                      >
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-yellow-500 animate-pulse shrink-0" />
                        <span
                          className="truncate cursor-pointer hover:text-foreground"
                          title={tx.hash}
                          onClick={() => {
                            setTxInput(tx.hash);
                            setTxResult(null);
                          }}
                        >
                          {truncateHash(tx.hash, 10)}
                        </span>
                        <span className="text-muted-foreground">nonce:{tx.nonce}</span>
                        <span className="text-muted-foreground">
                          {tx.to ? truncateHash(tx.to) : "CREATE"}
                        </span>
                        <span className="ml-auto">{formatEth(tx.value)} ETH</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Node Status                                                         */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Radio className="h-5 w-5" />
            Node
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-lg border p-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
                Sync Status
              </p>
              {health.syncing === false ? (
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-400" />
                  <span className="font-medium text-green-400">Synced</span>
                </div>
              ) : typeof health.syncing === "object" ? (
                <div>
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-yellow-400" />
                    <span className="font-medium text-yellow-400">
                      Syncing
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Block {health.syncing.currentBlock} /{" "}
                    {health.syncing.highestBlock}
                  </p>
                </div>
              ) : (
                <Skeleton className="h-5 w-20" />
              )}
            </div>

            <div className="rounded-lg border p-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
                RPC Endpoint
              </p>
              <p className="font-mono text-xs break-all">{RPC_URL}</p>
            </div>

            <div className="rounded-lg border p-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
                Block Producer
              </p>
              {health.blockInfo ? (
                <p className="font-mono text-xs break-all">
                  {health.blockInfo.miner}
                </p>
              ) : (
                <Skeleton className="h-4 w-full" />
              )}
            </div>
          </div>

          {health.blockInfo?.baseFeePerGas && (
            <div className="mt-3 rounded-lg border p-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1.5">
                Base Fee
              </p>
              <p className="font-medium">
                {formatGwei(health.blockInfo.baseFeePerGas)} Gwei
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Recent Blocks                                                        */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Recent Blocks
            </CardTitle>
            <Badge variant="outline" className="text-xs font-mono">
              {recentBlocks.length > 0
                ? `#${recentBlocks[recentBlocks.length - 1]?.number} — #${recentBlocks[0]?.number}`
                : "—"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {recentBlocksLoading && recentBlocks.length === 0 ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : recentBlocks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No blocks found.
            </p>
          ) : (
            <div className="space-y-0.5">
              {/* Header */}
              <div className="grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-1">
                <div className="col-span-2">Block</div>
                <div className="col-span-3">Hash</div>
                <div className="col-span-2">Age</div>
                <div className="col-span-1 text-right">Txs</div>
                <div className="col-span-2 text-right">Gas</div>
                <div className="col-span-2 text-right">Block Time</div>
              </div>
              <Separator />
              <div className="max-h-[340px] overflow-y-auto space-y-0.5">
                {recentBlocks.map((block) => {
                  const now = Math.floor(Date.now() / 1000);
                  const age = now - block.timestamp;
                  const gasPercent = (
                    (block.gasUsed / block.gasLimit) *
                    100
                  ).toFixed(1);
                  return (
                    <div
                      key={block.number}
                      className="grid grid-cols-12 gap-2 items-center rounded-md px-3 py-2 text-xs font-mono hover:bg-muted/50 transition-colors"
                    >
                      <div className="col-span-2 font-bold">
                        #{block.number}
                      </div>
                      <div
                        className="col-span-3 text-muted-foreground truncate"
                        title={block.hash}
                      >
                        {truncateHash(block.hash, 8)}
                      </div>
                      <div className="col-span-2 text-muted-foreground">
                        {formatAge(age)}
                      </div>
                      <div className="col-span-1 text-right">
                        {block.txCount > 0 ? (
                          <span className="text-foreground">{block.txCount}</span>
                        ) : (
                          <span className="text-muted-foreground/50">0</span>
                        )}
                      </div>
                      <div className="col-span-2 text-right">
                        <div className="flex items-center gap-1.5 justify-end">
                          <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                            <div
                              className="h-full rounded-full bg-blue-500"
                              style={{
                                width: `${Math.min(100, parseFloat(gasPercent))}%`,
                              }}
                            />
                          </div>
                          <span className="text-muted-foreground w-10 text-right">
                            {gasPercent}%
                          </span>
                        </div>
                      </div>
                      <div className="col-span-2 text-right text-muted-foreground">
                        {block.timeSincePrev !== null ? (
                          <span
                            className={
                              block.timeSincePrev > 30
                                ? "text-yellow-400"
                                : ""
                            }
                          >
                            {block.timeSincePrev}s
                          </span>
                        ) : (
                          "—"
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* RPC Latency + Address Scanner                                        */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* RPC Latency Monitor */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Activity className="h-5 w-5" />
                RPC Latency
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={runLatencyProbe}
                disabled={rpcProbing}
              >
                <RefreshCw
                  className={`h-3.5 w-3.5 ${rpcProbing ? "animate-spin" : ""}`}
                />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {rpcLatencies.length === 0 ? (
              <div className="space-y-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-8 w-full" />
                ))}
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  {rpcLatencies.map((r) => {
                    const color =
                      !r.success
                        ? "text-red-400"
                        : r.latency > 1000
                          ? "text-red-400"
                          : r.latency > 500
                            ? "text-yellow-400"
                            : "text-green-400";
                    const barWidth = Math.min(
                      100,
                      (r.latency / Math.max(...rpcLatencies.map((x) => x.latency), 100)) * 100
                    );
                    return (
                      <div
                        key={r.method}
                        className="flex items-center gap-3 text-xs"
                      >
                        <span className="font-mono w-28 shrink-0 text-muted-foreground">
                          {r.method}
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-500 ${
                              !r.success
                                ? "bg-red-500"
                                : r.latency > 1000
                                  ? "bg-red-500"
                                  : r.latency > 500
                                    ? "bg-yellow-500"
                                    : "bg-green-500"
                            }`}
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                        <span className={`font-mono w-14 text-right font-medium ${color}`}>
                          {r.success ? `${r.latency}ms` : "FAIL"}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Avg latency sparkline */}
                {rpcLatencyHistory.length > 1 && (
                  <div className="pt-2">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                      Average Latency Over Time
                    </p>
                    <div className="flex items-end gap-[2px] h-10">
                      {rpcLatencyHistory.map((ms, i) => {
                        const maxMs = Math.max(...rpcLatencyHistory, 200);
                        const height = Math.max(2, (ms / maxMs) * 40);
                        const color =
                          ms > 1000
                            ? "bg-red-500"
                            : ms > 500
                              ? "bg-yellow-500"
                              : "bg-green-500";
                        return (
                          <div
                            key={i}
                            className={`${color} rounded-sm flex-1 min-w-[2px] transition-all duration-300`}
                            style={{ height: `${height}px` }}
                            title={`${ms}ms`}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Address / Contract Scanner */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Address Scanner
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Query any address on BattleChain to check if it is an EOA or
              contract, view its balance, and inspect bytecode presence.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="0x... address (42 chars)"
                value={scanAddress}
                onChange={(e) => setScanAddress(e.target.value)}
                className="font-mono text-sm"
                onKeyDown={(e) => e.key === "Enter" && scanContract()}
              />
              <Button
                onClick={scanContract}
                disabled={
                  !scanAddress.startsWith("0x") ||
                  scanAddress.length !== 42 ||
                  scanLoading
                }
                variant="outline"
              >
                {scanLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            {scanResult && (
              <div className="space-y-3">
                <Separator />
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">Type:</span>
                  {scanResult.isContract ? (
                    <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                      Contract
                    </Badge>
                  ) : (
                    <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                      EOA
                    </Badge>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                      Balance
                    </p>
                    <p className="font-mono text-sm font-medium">
                      {scanResult.balance} ETH
                    </p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                      Nonce
                    </p>
                    <p className="font-mono text-sm font-medium">
                      {scanResult.nonce}
                    </p>
                  </div>
                </div>

                {scanResult.isContract && (
                  <div className="rounded-lg border p-3">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">
                      Bytecode
                    </p>
                    <div className="max-h-[80px] overflow-auto text-[10px] font-mono text-muted-foreground break-all leading-relaxed">
                      {scanResult.code.length > 200
                        ? `${scanResult.code.slice(0, 200)}... (${Math.floor(scanResult.code.length / 2)} bytes)`
                        : scanResult.code}
                    </div>
                  </div>
                )}

                {scanResult.storageRoot &&
                  scanResult.storageRoot !==
                    "0x0000000000000000000000000000000000000000000000000000000000000000" && (
                    <div className="rounded-lg border p-3">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">
                        Storage Slot 0
                      </p>
                      <p className="font-mono text-[10px] break-all text-muted-foreground">
                        {scanResult.storageRoot}
                      </p>
                    </div>
                  )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Tools row: Tx Lookup + Stuck Tx Detector                            */}
      {/* ------------------------------------------------------------------ */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Transaction Lookup */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="h-5 w-5" />
              Transaction Lookup
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Check if a transaction is pending, mined, or reverted.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="0x... tx hash (66 chars)"
                value={txInput}
                onChange={(e) => setTxInput(e.target.value)}
                className="font-mono text-sm"
                onKeyDown={(e) => e.key === "Enter" && lookupTx()}
              />
              <Button
                onClick={lookupTx}
                disabled={
                  !txInput.startsWith("0x") || txInput.length !== 66
                }
                variant="outline"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>

            {txResult && (
              <div className="space-y-3">
                <Separator />
                {txResult.status === "loading" ? (
                  <div className="flex items-center gap-2 py-4 justify-center">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    <span className="text-sm text-muted-foreground">
                      Looking up...
                    </span>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Status:</span>
                      {txResult.status === "mined" && (
                        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                          Mined
                        </Badge>
                      )}
                      {txResult.status === "pending" && (
                        <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 animate-pulse">
                          Pending in Mempool
                        </Badge>
                      )}
                      {txResult.status === "failed" && (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                          Reverted
                        </Badge>
                      )}
                      {txResult.status === "not_found" && (
                        <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">
                          Not Found
                        </Badge>
                      )}
                    </div>

                    {txResult.status === "pending" && (
                      <div className="rounded-md border border-yellow-500/30 bg-yellow-500/5 p-3 text-sm text-yellow-300">
                        This transaction is in the mempool and has not been
                        included in any block.
                        {health.status === "down" &&
                          " The chain is not producing blocks \u2014 it will remain stuck until the sequencer restarts."}
                      </div>
                    )}

                    {txResult.from && (
                      <div className="space-y-1 text-sm">
                        <TxField label="From" value={txResult.from} mono explorerPath={`/address/${txResult.from}`} />
                        {txResult.to && (
                          <TxField label="To" value={txResult.to} mono explorerPath={`/address/${txResult.to}`} />
                        )}
                        {txResult.nonce !== null && (
                          <TxField
                            label="Nonce"
                            value={String(txResult.nonce)}
                            mono
                          />
                        )}
                        {txResult.blockNumber !== null && (
                          <TxField
                            label="Block"
                            value={`#${txResult.blockNumber.toLocaleString()}`}
                            mono
                            explorerPath={`/block/${txResult.blockNumber}`}
                          />
                        )}
                        {txResult.gasUsed !== null && (
                          <TxField
                            label="Gas"
                            value={txResult.gasUsed.toLocaleString()}
                            mono
                          />
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Nonce Gap / Stuck Tx Detector */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Waypoints className="h-5 w-5" />
              Stuck Transaction Detector
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Compare confirmed vs pending nonce for any address. A gap =
              stuck mempool transactions.
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="0x... wallet address"
                value={nonceInput}
                onChange={(e) => setNonceInput(e.target.value)}
                className="font-mono text-sm"
                onKeyDown={(e) => e.key === "Enter" && checkNonce()}
              />
              <Button
                onClick={checkNonce}
                disabled={
                  !nonceInput.startsWith("0x") ||
                  nonceInput.length !== 42 ||
                  nonceLoading
                }
                variant="outline"
              >
                {nonceLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Search className="h-4 w-4" />
                )}
              </Button>
            </div>

            {nonceResult && (
              <div className="space-y-3">
                <Separator />
                <div className="grid grid-cols-3 gap-2">
                  <NonceStat
                    label="Confirmed"
                    value={nonceResult.confirmed}
                  />
                  <NonceStat label="Pending" value={nonceResult.pending} />
                  <NonceStat
                    label="Stuck"
                    value={nonceResult.stuck}
                    variant={nonceResult.stuck > 0 ? "danger" : "success"}
                  />
                </div>

                {nonceResult.stuck > 0 ? (
                  <div className="rounded-md border border-red-500/30 bg-red-500/5 p-3 text-sm text-red-300">
                    {nonceResult.stuck} transaction
                    {nonceResult.stuck !== 1 ? "s" : ""} submitted but never
                    mined.
                    {health.status === "down" &&
                      " The chain is not producing blocks \u2014 stuck until the sequencer restarts."}
                  </div>
                ) : (
                  <div className="rounded-md border border-green-500/30 bg-green-500/5 p-3 text-sm text-green-300">
                    No stuck transactions.
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ------------------------------------------------------------------ */}
      {/* Batch Hash Checker                                                   */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ListChecks className="h-5 w-5" />
            Batch Transaction Checker
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Paste multiple transaction hashes (one per line, comma or space separated) to check
            their status in bulk. Useful for verifying a set of stuck transactions.
          </p>
          <textarea
            className="flex min-h-[100px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            placeholder={"0xabc123...\n0xdef456...\n0x789abc..."}
            value={batchHashInput}
            onChange={(e) => setBatchHashInput(e.target.value)}
          />
          <Button
            onClick={lookupBatch}
            disabled={!batchHashInput.trim() || batchLoading}
            variant="outline"
            className="w-full"
          >
            {batchLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Search className="mr-2 h-4 w-4" />
            )}
            {batchLoading ? "Checking..." : "Check All Hashes"}
          </Button>

          {batchResults.length > 0 && (
            <div className="space-y-1">
              <Separator />
              {/* Summary */}
              <div className="flex gap-3 py-2 text-xs">
                <span className="text-green-400">
                  {batchResults.filter((r) => r.status === "mined").length} mined
                </span>
                <span className="text-yellow-400">
                  {batchResults.filter((r) => r.status === "pending").length} pending
                </span>
                <span className="text-red-400">
                  {batchResults.filter((r) => r.status === "failed").length} failed
                </span>
                <span className="text-gray-400">
                  {batchResults.filter((r) => r.status === "not_found").length} not found
                </span>
              </div>

              {/* Results */}
              <div className="max-h-[400px] overflow-y-auto space-y-0.5">
                {batchResults.map((r) => {
                  const statusColor =
                    r.status === "mined"
                      ? "text-green-400"
                      : r.status === "pending"
                        ? "text-yellow-400"
                        : r.status === "failed"
                          ? "text-red-400"
                          : "text-gray-400";
                  const dotColor =
                    r.status === "mined"
                      ? "bg-green-500"
                      : r.status === "pending"
                        ? "bg-yellow-500"
                        : r.status === "failed"
                          ? "bg-red-500"
                          : "bg-gray-500";
                  return (
                    <div
                      key={r.hash}
                      className="flex items-center gap-3 rounded-md px-3 py-2 text-xs font-mono hover:bg-muted/50 transition-colors"
                    >
                      <span
                        className={`inline-block h-2 w-2 rounded-full shrink-0 ${dotColor} ${r.status === "pending" ? "animate-pulse" : ""}`}
                      />
                      <span
                        className="truncate flex-1 cursor-pointer hover:text-foreground"
                        title={r.hash}
                        onClick={() => {
                          setTxInput(r.hash);
                          setTxResult(null);
                        }}
                      >
                        {truncateHash(r.hash, 10)}
                      </span>
                      <span className={`uppercase text-[10px] font-bold w-16 text-right ${statusColor}`}>
                        {r.status === "not_found" ? "N/A" : r.status}
                      </span>
                      {r.nonce !== null && (
                        <span className="text-muted-foreground w-16 text-right">
                          nonce:{r.nonce}
                        </span>
                      )}
                      {r.from && (
                        <span className="text-muted-foreground hidden lg:inline">
                          {truncateHash(r.from)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Contract Registry                                                    */}
      {/* ------------------------------------------------------------------ */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              AttackRegistry Contracts
            </CardTitle>
            {!registryLoading && (
              <Badge variant="outline" className="text-xs font-mono">
                {registryContracts.length} total
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {registryLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : registryContracts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No contracts found in the AttackRegistry, or the node could not return event logs.
            </p>
          ) : (
            <div className="space-y-4">
              {/* State distribution */}
              <div className="flex flex-wrap gap-2">
                {[
                  ContractState.NOT_DEPLOYED,
                  ContractState.NEW_DEPLOYMENT,
                  ContractState.ATTACK_REQUESTED,
                  ContractState.UNDER_ATTACK,
                  ContractState.PROMOTION_REQUESTED,
                  ContractState.PRODUCTION,
                  ContractState.CORRUPTED,
                ].map((state) => {
                  const count = registryContracts.filter(
                    (c) => c.state === state
                  ).length;
                  if (count === 0) return null;
                  return (
                    <div key={state} className="flex items-center gap-1.5">
                      <StateBadge state={state} />
                      <span className="text-xs font-mono font-bold">{count}</span>
                    </div>
                  );
                })}
              </div>

              <Separator />

              {/* Contract list */}
              <div className="grid grid-cols-12 gap-2 text-[10px] uppercase tracking-wider text-muted-foreground px-3 py-1">
                <div className="col-span-5">Agreement Address</div>
                <div className="col-span-3">State</div>
                <div className="col-span-4 text-right">Actions</div>
              </div>
              <div className="max-h-[400px] overflow-y-auto space-y-0.5">
                {registryContracts
                  .sort((a, b) => b.state - a.state)
                  .map((c) => (
                    <div
                      key={c.address}
                      className="grid grid-cols-12 gap-2 items-center rounded-md px-3 py-2 text-xs font-mono hover:bg-muted/50 transition-colors"
                    >
                      <div className="col-span-5 truncate" title={c.address}>
                        {c.address}
                      </div>
                      <div className="col-span-3">
                        <StateBadge state={c.state} />
                      </div>
                      <div className="col-span-4 flex items-center justify-end gap-1">
                        <a
                          href={`${EXPLORER_URL}/address/${c.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-[10px] px-2"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </Button>
                        </a>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-[10px] px-2"
                          onClick={() => {
                            setScanAddress(c.address);
                            setScanResult(null);
                          }}
                        >
                          Inspect
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ------------------------------------------------------------------ */}
      {/* Latest Block Details                                                */}
      {/* ------------------------------------------------------------------ */}
      {health.blockInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Layers className="h-5 w-5" />
              Latest Block Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 text-sm">
              {(
                [
                  [
                    "Block Number",
                    `#${health.blockInfo.number.toLocaleString()}`,
                    `${EXPLORER_URL}/block/${health.blockInfo.number}`,
                  ],
                  ["Block Hash", health.blockInfo.hash, `${EXPLORER_URL}/block/${health.blockInfo.hash}`],
                  [
                    "Timestamp",
                    new Date(
                      health.blockInfo.timestamp * 1000
                    ).toISOString(),
                    null,
                  ],
                  ["Miner / Sequencer", health.blockInfo.miner, `${EXPLORER_URL}/address/${health.blockInfo.miner}`],
                  ["Transactions", String(health.blockInfo.txCount), null],
                  [
                    "Gas Used",
                    `${health.blockInfo.gasUsed.toLocaleString()} / ${health.blockInfo.gasLimit.toLocaleString()}`,
                    null,
                  ],
                ] as [string, string, string | null][]
              ).map(([label, value, link]) => (
                <div
                  key={label}
                  className="flex flex-col gap-0.5 rounded-lg border p-3"
                >
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {label}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono text-xs break-all flex-1">{value}</span>
                    {link && (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Small helper components
// ---------------------------------------------------------------------------

function StatCard({
  label,
  icon,
  value,
  valueClass,
  sub,
}: {
  label: string;
  icon: React.ReactNode;
  value: string | null;
  valueClass?: string;
  sub?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-xs font-medium text-muted-foreground">
          {label}
        </CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {value !== null ? (
          <>
            <p className={`text-2xl font-bold ${valueClass ?? ""}`}>{value}</p>
            {sub && (
              <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
            )}
          </>
        ) : (
          <Skeleton className="h-8 w-24" />
        )}
      </CardContent>
    </Card>
  );
}

function TxField({
  label,
  value,
  mono,
  explorerPath,
}: {
  label: string;
  value: string;
  mono?: boolean;
  explorerPath?: string;
}) {
  return (
    <div className="flex gap-2 items-center">
      <span className="text-muted-foreground w-16 shrink-0 text-xs">
        {label}:
      </span>
      <span className={`break-all text-xs flex-1 ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
      {explorerPath && (
        <a
          href={`${EXPLORER_URL}${explorerPath}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

function NonceStat({
  label,
  value,
  variant,
}: {
  label: string;
  value: number;
  variant?: "danger" | "success";
}) {
  const border =
    variant === "danger"
      ? "border-red-500/30 bg-red-500/5"
      : variant === "success"
        ? "border-green-500/30 bg-green-500/5"
        : "";
  const text =
    variant === "danger"
      ? "text-red-400"
      : variant === "success"
        ? "text-green-400"
        : "";
  return (
    <div className={`rounded-lg border p-3 text-center ${border}`}>
      <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
      <p className={`text-xl font-bold font-mono ${text}`}>{value}</p>
    </div>
  );
}
