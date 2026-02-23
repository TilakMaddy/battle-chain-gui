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
  useApproveAttack,
  useRejectAttack,
  usePromote,
} from "@/lib/hooks/use-attack-registry";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { ContractState } from "@/lib/contracts/types";
import {
  Vote,
  CheckCircle,
  XCircle,
  Loader2,
  TrendingUp,
  Shield,
} from "lucide-react";
import Link from "next/link";

interface ReviewItem {
  address: `0x${string}`;
  state: ContractState;
}

export default function DaoReviewPage() {
  return (
    <ChainGuard>
      <DaoReviewContent />
    </ChainGuard>
  );
}

function DaoReviewContent() {
  const publicClient = usePublicClient();
  const [items, setItems] = useState<ReviewItem[]>([]);
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

        const map = new Map<`0x${string}`, ContractState>();
        for (const log of logs) {
          map.set(
            log.args.agreementAddress as `0x${string}`,
            Number(log.args.newState) as ContractState
          );
        }

        const reviewable: ReviewItem[] = [];
        for (const [addr, state] of map) {
          if (state === ContractState.ATTACK_REQUESTED) {
            reviewable.push({ address: addr, state });
          }
        }
        setItems(reviewable);
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
        title="DAO Review"
        description="Review and approve or reject attack mode requests"
      />

      {loading ? (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-32 w-full" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Vote className="h-12 w-12 text-muted-foreground" />
            <p className="text-lg text-muted-foreground">No pending review items</p>
            <p className="text-sm text-muted-foreground">
              Agreements requesting attack mode will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {items.map((item) => (
            <ReviewCard key={item.address} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}

function ReviewCard({ item }: { item: ReviewItem }) {
  const { data: details } = useAgreementDetails(item.address);
  const { approve, isPending: approvePending } = useApproveAttack();
  const { reject, isPending: rejectPending } = useRejectAttack();
  const { promote, isPending: promotePending } = usePromote();

  const d = details as { protocolName: string } | undefined;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-3">
            <Shield className="h-5 w-5 text-yellow-500" />
            {d?.protocolName || "Loading..."}
          </CardTitle>
          <StateBadge state={item.state} />
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

        <div className="flex gap-3">
          <Button
            onClick={() => approve(item.address)}
            disabled={approvePending || rejectPending}
            className="bg-green-600 hover:bg-green-700"
          >
            {approvePending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <CheckCircle className="mr-2 h-4 w-4" /> Approve
          </Button>
          <Button
            onClick={() => reject(item.address)}
            disabled={approvePending || rejectPending}
            variant="destructive"
          >
            {rejectPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <XCircle className="mr-2 h-4 w-4" /> Reject
          </Button>
          <Button
            onClick={() => promote(item.address)}
            disabled={promotePending}
            variant="outline"
          >
            {promotePending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <TrendingUp className="mr-2 h-4 w-4" /> Instant Promote
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
