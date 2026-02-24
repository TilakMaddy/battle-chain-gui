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
} from "lucide-react";

const RPC_URL = "https://testnet.battlechain.com:3051";

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

async function fetchMempoolTxs(): Promise<{
  txs: MempoolTx[];
  txpoolStatus: TxpoolStatus | null;
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
        for (const tx of Object.values(senderTxs as Record<string, Record<string, string>>)) {
          txs.push({
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
          });
        }
      }
    }

    if (txs.length > 0 || txpoolStatus) {
      return { txs, txpoolStatus, source: "txpool_content" };
    }
  } catch {
    // txpool_content not supported, fall through
  }

  // 3. Fallback: diff pending block vs latest block to find pending txs
  try {
    const [pendingBlock, latestBlock] = await Promise.all([
      rpc("eth_getBlockByNumber", ["pending", true]),
      rpc("eth_getBlockByNumber", ["latest", true]),
    ]);

    const minedHashes = new Set<string>(
      (latestBlock?.transactions ?? []).map((tx: { hash: string }) => tx.hash)
    );

    const pendingTxs = (pendingBlock?.transactions ?? []).filter(
      (tx: { hash: string }) => !minedHashes.has(tx.hash)
    );

    const txs: MempoolTx[] = pendingTxs.map(
      (tx: Record<string, string>) => ({
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
      })
    );

    return { txs, txpoolStatus, source: "pending_block" };
  } catch {
    // pending block not supported either
  }

  return { txs: [], txpoolStatus, source: "none" };
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

  // Tx lookup
  const [txInput, setTxInput] = useState("");
  const [txResult, setTxResult] = useState<TxLookup | null>(null);

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
    } catch {
      setMempoolSource("error");
    } finally {
      setMempoolLoading(false);
    }
  }, []);

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

  useEffect(() => {
    fetchHealth();
    fetchMempool();
    fetchBlocks();
    runLatencyProbe();
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
  }, [fetchHealth, fetchMempool, fetchBlocks, runLatencyProbe]);

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
          mempoolTxs.length > 0
            ? "border-yellow-500/30 bg-yellow-500/5"
            : ""
        }
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Inbox className="h-5 w-5" />
              Mempool
              {mempoolTxs.length > 0 && (
                <Badge
                  variant="outline"
                  className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30 animate-pulse ml-1"
                >
                  {mempoolTxs.length} pending
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
              <Inbox className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">
                {mempoolSource === "none" || mempoolSource === "error"
                  ? "Could not query mempool. The RPC node may not expose txpool or pending block data."
                  : "Mempool is empty. No pending transactions."}
              </p>
              {mempoolSource !== "none" && mempoolSource !== "error" && (
                <p className="text-xs text-muted-foreground/60 mt-1">
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
                    : mempoolSource === "pending_block"
                      ? "eth_getBlockByNumber(pending)"
                      : mempoolSource}
                </span>
              </div>
            </div>
          )}
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
                        <TxField label="From" value={txResult.from} mono />
                        {txResult.to && (
                          <TxField label="To" value={txResult.to} mono />
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
                  ],
                  ["Block Hash", health.blockInfo.hash],
                  [
                    "Timestamp",
                    new Date(
                      health.blockInfo.timestamp * 1000
                    ).toISOString(),
                  ],
                  ["Miner / Sequencer", health.blockInfo.miner],
                  ["Transactions", String(health.blockInfo.txCount)],
                  [
                    "Gas Used",
                    `${health.blockInfo.gasUsed.toLocaleString()} / ${health.blockInfo.gasLimit.toLocaleString()}`,
                  ],
                ] as [string, string][]
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="flex flex-col gap-0.5 rounded-lg border p-3"
                >
                  <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                    {label}
                  </span>
                  <span className="font-mono text-xs break-all">{value}</span>
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
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex gap-2">
      <span className="text-muted-foreground w-16 shrink-0 text-xs">
        {label}:
      </span>
      <span className={`break-all text-xs ${mono ? "font-mono" : ""}`}>
        {value}
      </span>
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
