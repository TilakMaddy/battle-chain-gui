"use client";

import { useState, useEffect } from "react";
import { usePublicClient } from "wagmi";
import { parseAbiItem } from "viem";
import Link from "next/link";
import { ChainGuard } from "@/components/web3/chain-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { ContractState, CONTRACT_STATE_LABELS } from "@/lib/contracts/types";
import { useDeployments } from "@/lib/hooks/use-deployments";
import { FileText, Search, Plus, ExternalLink, Rocket } from "lucide-react";

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
  const publicClient = usePublicClient();
  const [agreements, setAgreements] = useState<AgreementRow[]>([]);
  const { deployments } = useDeployments();
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stateFilter, setStateFilter] = useState<string>("all");

  useEffect(() => {
    async function fetchAgreements() {
      if (!publicClient) return;
      try {
        const logs = await publicClient.getLogs({
          address: CONTRACTS.AttackRegistry as `0x${string}`,
          event: parseAbiItem(
            "event AgreementStateChanged(address indexed agreementAddress, uint8 previousState, uint8 newState)"
          ),
          fromBlock: 0n,
          toBlock: "latest",
        });

        const map = new Map<`0x${string}`, AgreementRow>();
        for (const log of logs) {
          const addr = log.args.agreementAddress as `0x${string}`;
          map.set(addr, {
            address: addr,
            latestState: Number(log.args.newState) as ContractState,
            blockNumber: log.blockNumber,
          });
        }
        setAgreements(Array.from(map.values()).sort((a, b) => Number(b.blockNumber - a.blockNumber)));
      } catch (err) {
        console.error("Failed to fetch agreements:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchAgreements();
  }, [publicClient]);

  const filtered = agreements.filter((a) => {
    const matchesSearch = !search || a.address.toLowerCase().includes(search.toLowerCase());
    const matchesState = stateFilter === "all" || a.latestState === Number(stateFilter);
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

      {/* Filters */}
      <div className="flex gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by address..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10 font-mono"
          />
        </div>
        <Select value={stateFilter} onValueChange={setStateFilter}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Filter by state" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All States</SelectItem>
            {Object.entries(CONTRACT_STATE_LABELS).map(([k, v]) => (
              <SelectItem key={k} value={k}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
                      <Link href={`/agreements/${a.address}`}>
                        <Button variant="ghost" size="sm">
                          View <ExternalLink className="ml-1 h-3 w-3" />
                        </Button>
                      </Link>
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
