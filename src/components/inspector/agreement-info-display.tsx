"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StateBadge } from "@/components/web3/state-badge";
import { CountdownTimer } from "@/components/ui/countdown-timer";
import { CopyableAddress } from "@/components/ui/copyable-address";
import {
  useAgreementInfo,
  useAgreementState,
} from "@/lib/hooks/use-attack-registry";
import { ContractState } from "@/lib/contracts/types";
import { Info } from "lucide-react";

interface AgreementInfoDisplayProps {
  agreementAddress: `0x${string}`;
}

function BoolBadge({ label, value }: { label: string; value: boolean }) {
  return (
    <Badge
      variant="outline"
      className={
        value
          ? "bg-green-500/20 text-green-400 border-green-500/30"
          : "bg-red-500/20 text-red-400 border-red-500/30"
      }
    >
      {label}: {value ? "Yes" : "No"}
    </Badge>
  );
}

export function AgreementInfoDisplay({ agreementAddress }: AgreementInfoDisplayProps) {
  const { info, isLoading: loadingInfo } = useAgreementInfo(agreementAddress);
  const { data: stateRaw, isLoading: loadingState } = useAgreementState(agreementAddress);

  const state = stateRaw as ContractState | undefined;

  if (loadingInfo || loadingState) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" /> Agreement Info
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-5 w-24" />
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-5 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (!info) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Info className="h-5 w-5" /> Agreement Info
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No agreement info available.
          </p>
        </CardContent>
      </Card>
    );
  }

  const hasDeadline = info.deadlineTimestamp > 0n;
  const hasPromotionTs = info.promotionRequestedTimestamp > 0n;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5" /> Agreement Info
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current State */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Current State</span>
          {state !== undefined ? (
            <StateBadge state={state} />
          ) : (
            <span className="text-sm text-muted-foreground">Unknown</span>
          )}
        </div>

        {/* Attack Moderator */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Attack Moderator</span>
          <CopyableAddress address={info.attackModerator} />
        </div>

        {/* Deadline Timestamp */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Deadline</span>
          {hasDeadline ? (
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">
                {new Date(Number(info.deadlineTimestamp) * 1000).toLocaleString()}
              </span>
              <CountdownTimer targetTimestamp={info.deadlineTimestamp} />
            </div>
          ) : (
            <span className="text-sm text-muted-foreground">Not set</span>
          )}
        </div>

        {/* Promotion Timestamp */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Promotion Requested</span>
          {hasPromotionTs ? (
            <span className="font-mono text-sm">
              {new Date(Number(info.promotionRequestedTimestamp) * 1000).toLocaleString()}
            </span>
          ) : (
            <span className="text-sm text-muted-foreground">Not requested</span>
          )}
        </div>

        {/* Boolean Flags */}
        <div className="flex flex-wrap gap-2 pt-2">
          <BoolBadge label="Attack Requested" value={info.attackRequested} />
          <BoolBadge label="Attack Approved" value={info.attackApproved} />
          <BoolBadge label="Promoted" value={info.promoted} />
          <BoolBadge label="Corrupted" value={info.corrupted} />
          <BoolBadge label="Registered" value={info.isRegistered} />
        </div>
      </CardContent>
    </Card>
  );
}
