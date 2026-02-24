"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ChainGuard } from "@/components/web3/chain-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { StateBadge } from "@/components/web3/state-badge";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { ContractState } from "@/lib/contracts/types";
import { useDeployments } from "@/lib/hooks/use-deployments";
import { FileText, Search, Plus, ExternalLink, Rocket } from "lucide-react";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL ?? "https://testnet.battlechain.com:3051";

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

interface AgreementRow {
  address: `0x${string}`;
  latestState: ContractState;
  blockNumber: bigint;
}


export default function AgreementsPage() {
  return (
    <ChainGuard>
      <AgreementsContent />
    </ChainGuard>
  );
}

function AgreementsContent() {
  const [agreements, setAgreements] = useState<AgreementRow[]>([]);
  const { deployments } = useDeployments();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeStates, setActiveStates] = useState<Set<ContractState>>(new Set());

  const toggleState = (state: ContractState) => {
    setActiveStates((prev) => {
      const next = new Set(prev);
      if (next.has(state)) next.delete(state);
      else next.add(state);
      return next;
    });
  };

  const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://explorer.testnet.battlechain.com";

  useEffect(() => {
    async function fetchAgreements() {
      try {
        const logs = await rpc("eth_getLogs", [
          {
            address: CONTRACTS.AttackRegistry,
            fromBlock: "0x0",
            toBlock: "latest",
          },
        ]);

        // Known event signatures from AttackRegistry
        const SIG_STATE_CHANGED = "0xf7e4eae80290e2a6acfee094f30d26c550648115112acc13da4e0efb47a7d5cd";
        const SIG_REGISTERED = "0x768fb430a0d4b201cb764ab221c316dd14d8babf2e4b2348e05964c6565318b6";

        const map = new Map<`0x${string}`, AgreementRow>();
        for (const log of logs) {
          const topics = log.topics;
          if (!topics || topics.length < 2) continue;
          const sig = topics[0];
          const blockNumber = BigInt(log.blockNumber);

          if (sig === SIG_REGISTERED) {
            // ContractRegistered(address indexed contractAddress, address indexed agreementAddress)
            const addr = ("0x" + topics[1].slice(26)) as `0x${string}`;
            if (!map.has(addr)) {
              map.set(addr, {
                address: addr,
                latestState: ContractState.NEW_DEPLOYMENT,
                blockNumber,
              });
            }
          } else if (sig === SIG_STATE_CHANGED) {
            // AgreementStateChanged(address indexed agreementAddress, ContractState newState)
            const addr = ("0x" + topics[1].slice(26)) as `0x${string}`;
            const data: string = log.data ?? "0x";
            let newState = 0;
            if (data.length >= 66) {
              newState = parseInt(data.slice(2, 66), 16);
            }
            if (newState >= 0 && newState <= 6) {
              map.set(addr, {
                address: addr,
                latestState: newState as ContractState,
                blockNumber,
              });
            }
          }
        }
        setAgreements(
          Array.from(map.values()).sort((a, b) => Number(b.blockNumber - a.blockNumber))
        );
      } catch (err) {
        console.error("Failed to fetch agreements:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAgreements();
  }, []);

  const filtered = agreements.filter((a) => {
    const matchesSearch = !search || a.address.toLowerCase().includes(search.toLowerCase());
    const matchesState = activeStates.size === 0 || activeStates.has(a.latestState);
    return matchesSearch && matchesState;
  });

  return (
    <div className="space-y-8">
      <PageHeader title="Browse Agreements" description="All Safe Harbor agreements on BattleChain">
        <Link href="/agreements/create">
          <Button className="bg-red-600 hover:bg-red-700">
            <Plus className="mr-2 h-4 w-4" /> Create Agreement
          </Button>
        </Link>
      </PageHeader>

      {/* State badges + search */}
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          {[
            ContractState.NEW_DEPLOYMENT,
            ContractState.ATTACK_REQUESTED,
            ContractState.UNDER_ATTACK,
            ContractState.PROMOTION_REQUESTED,
            ContractState.PRODUCTION,
            ContractState.CORRUPTED,
          ].map((state) => {
            const count = agreements.filter((a) => a.latestState === state).length;
            const isActive = activeStates.has(state);
            return (
              <button
                key={state}
                onClick={() => toggleState(state)}
                className={`flex items-center gap-1.5 transition-opacity ${
                  activeStates.size > 0 && !isActive ? "opacity-30" : ""
                } ${count === 0 && !isActive ? "opacity-40" : ""}`}
              >
                <StateBadge state={state} />
                <span className="text-xs font-mono font-bold">{count}</span>
              </button>
            );
          })}
          {activeStates.size > 0 && (
            <button
              onClick={() => setActiveStates(new Set())}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors ml-2"
            >
              Clear filters
            </button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 font-mono"
          />
        </div>
      </div>

      {/* My Deployed Contracts */}
      {deployments.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="flex items-center gap-2 px-6 pt-5 pb-3">
              <Rocket className="h-5 w-5 text-blue-400" />
              <h3 className="text-sm font-semibold">My Deployed Contracts</h3>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Contract Address</TableHead>
                  <TableHead>Label</TableHead>
                  <TableHead>Deployed</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {deployments.map((d) => (
                  <TableRow key={d.id}>
                    <TableCell className="font-mono text-sm">
                      {d.contract_address.slice(0, 10)}...{d.contract_address.slice(-8)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {d.label || "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {new Date(d.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Link href={`/agreements/${d.contract_address}`}>
                        <Button variant="ghost" size="sm">
                          View <ExternalLink className="ml-1 h-3 w-3" />
                        </Button>
                      </Link>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="space-y-3 p-6">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-4 py-12">
              <FileText className="h-12 w-12 text-muted-foreground" />
              <p className="text-muted-foreground">No agreements found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Agreement Address</TableHead>
                  <TableHead>State</TableHead>
                  <TableHead>Block</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((a) => (
                  <TableRow key={a.address}>
                    <TableCell className="font-mono text-sm">
                      {a.address.slice(0, 10)}...{a.address.slice(-8)}
                    </TableCell>
                    <TableCell>
                      <StateBadge state={a.latestState} />
                    </TableCell>
                    <TableCell className="font-mono text-sm text-muted-foreground">
                      {a.blockNumber.toString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={`${EXPLORER_URL}/address/${a.address}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="ghost" size="sm">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </Button>
                        </a>
                        <Link href={`/agreements/${a.address}`}>
                          <Button variant="ghost" size="sm">
                            Inspect
                          </Button>
                        </Link>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
