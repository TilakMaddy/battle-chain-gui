"use client";

import { useState, useEffect } from "react";
import { usePublicClient } from "wagmi";
import { parseAbiItem } from "viem";
import { ChainGuard } from "@/components/web3/chain-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StateBadge } from "@/components/web3/state-badge";
import { useAgreementDetails } from "@/lib/hooks/use-agreement";
import {
  usePromote,
  useCancelPromotion,
  useAgreementState,
} from "@/lib/hooks/use-attack-registry";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { ContractState } from "@/lib/contracts/types";
import {
  TrendingUp,
  Timer,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import Link from "next/link";

const PROMOTION_PERIOD_SECS = 3 * 24 * 60 * 60; // 3 days

interface PromotionItem {
  address: `0x${string}`;
  blockNumber: bigint;
}

export default function PromotionPage() {
  return (
    <ChainGuard>
      <PromotionContent />
    </ChainGuard>
  );
}

function PromotionContent() {
  const publicClient = usePublicClient();
  const [items, setItems] = useState<PromotionItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetch() {
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

        const map = new Map<`0x${string}`, PromotionItem>();
        for (const log of logs) {
          const newState = Number(log.args.newState) as ContractState;
          const addr = log.args.agreementAddress as `0x${string}`;
          if (newState === ContractState.PROMOTION_REQUESTED) {
            map.set(addr, { address: addr, blockNumber: log.blockNumber });
          } else {
            map.delete(addr);
          }
        }
        setItems(Array.from(map.values()));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    fetch();
  }, [publicClient]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Promotion Tracker"
        description="Track active promotions with live countdown timers"
      />

      {loading ? (
        <div className="space-y-3">
          {[...Array(2)].map((_, i) => (
            <Skeleton key={i} className="h-40 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <TrendingUp className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg text-muted-foreground">No active promotions</p>
            <p className="text-sm text-muted-foreground">
              Agreements requesting promotion will appear here with live countdowns.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <PromotionCard key={item.address} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function PromotionCard({ item }: { item: PromotionItem }) {
  const { data: details } = useAgreementDetails(item.address);
  const { data: currentState } = useAgreementState(item.address);
  const { promote, isPending: promotePending } = usePromote();
  const { cancel, isPending: cancelPending } = useCancelPromotion();
  const publicClient = usePublicClient();

  const [countdown, setCountdown] = useState<string>("Calculating...");
  const [canPromote, setCanPromote] = useState(false);

  const d = details as { protocolName: string } | undefined;

  useEffect(() => {
    let interval: NodeJS.Timeout;

    async function startCountdown() {
      if (!publicClient) return;
      try {
        const block = await publicClient.getBlock({ blockNumber: item.blockNumber });
        const promotionStart = Number(block.timestamp);
        const promotionEnd = promotionStart + PROMOTION_PERIOD_SECS;

        interval = setInterval(() => {
          const now = Math.floor(Date.now() / 1000);
          const remaining = promotionEnd - now;

          if (remaining <= 0) {
            setCountdown("Ready to promote!");
            setCanPromote(true);
            clearInterval(interval);
          } else {
            const days = Math.floor(remaining / 86400);
            const hours = Math.floor((remaining % 86400) / 3600);
            const minutes = Math.floor((remaining % 3600) / 60);
            const seconds = remaining % 60;
            setCountdown(
              `${days}d ${hours.toString().padStart(2, "0")}h ${minutes
                .toString()
                .padStart(2, "0")}m ${seconds.toString().padStart(2, "0")}s`
            );
          }
        }, 1000);
      } catch (err) {
        console.error(err);
        setCountdown("Could not calculate");
      }
    }

    startCountdown();
    return () => clearInterval(interval);
  }, [publicClient, item.blockNumber]);

  const state = currentState as ContractState | undefined;
  if (state !== undefined && state !== ContractState.PROMOTION_REQUESTED) {
    return null;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-purple-500" />
            {d?.protocolName || "Loading..."}
          </CardTitle>
          <StateBadge state={ContractState.PROMOTION_REQUESTED} />
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border p-3 bg-muted/50">
          <span className="text-sm text-muted-foreground">Agreement: </span>
          <Link
            href={`/agreements/${item.address}`}
            className="font-mono text-sm text-blue-400 hover:underline"
          >
            {item.address}
          </Link>
        </div>

        {/* Countdown Timer */}
        <div className="rounded-lg border p-6 text-center bg-purple-500/10">
          <Timer className="mx-auto h-8 w-8 text-purple-400 mb-2" />
          <p className="text-sm text-muted-foreground mb-1">3-Day Promotion Period</p>
          <p className="text-3xl font-bold font-mono text-purple-400">{countdown}</p>
        </div>

        <div className="flex gap-3">
          <Button
            onClick={() => promote(item.address)}
            disabled={!canPromote || promotePending}
            className="bg-green-600 hover:bg-green-700"
          >
            {promotePending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <CheckCircle className="mr-2 h-4 w-4" /> Promote to Production
          </Button>
          <Button
            onClick={() => cancel(item.address)}
            disabled={cancelPending}
            variant="destructive"
          >
            {cancelPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <XCircle className="mr-2 h-4 w-4" /> Cancel Promotion
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
