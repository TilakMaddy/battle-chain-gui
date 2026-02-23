"use client";

import { use } from "react";
import { ChainGuard } from "@/components/web3/chain-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { StateBadge } from "@/components/web3/state-badge";
import {
  useAgreementDetails,
  useAssetRecoveryAddress,
} from "@/lib/hooks/use-agreement";
import { useAgreementStatePolling } from "@/lib/hooks/use-attack-registry";
import { IDENTITY_LABELS, IdentityRequirements } from "@/lib/contracts/types";
import { useState } from "react";
import { MapPin, Calculator, Shield } from "lucide-react";

export default function AttackPanelPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = use(params);
  return (
    <ChainGuard>
      <AttackPanelContent address={address as `0x${string}`} />
    </ChainGuard>
  );
}

function AttackPanelContent({ address }: { address: `0x${string}` }) {
  const { data: details, isLoading } = useAgreementDetails(address);
  const { data: recoveryAddr } = useAssetRecoveryAddress(address);
  const { state } = useAgreementStatePolling(address, 5000);

  const [fundsRecovered, setFundsRecovered] = useState("");

  const d = details as {
    protocolName: string;
    bountyTerms: {
      bountyPercentage: bigint;
      bountyCapUsd: bigint;
      retainable: boolean;
      identity: number;
      aggregateBountyCapUsd: bigint;
    };
  } | undefined;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const bountyPct = d ? Number(d.bountyTerms.bountyPercentage) / 100 : 0;
  const bountyCap = d ? Number(d.bountyTerms.bountyCapUsd) : 0;
  const recovered = Number(fundsRecovered) || 0;
  const rawBounty = recovered * (bountyPct / 100);
  const bountyAmount = bountyCap > 0 ? Math.min(rawBounty, bountyCap) : rawBounty;
  const returnAmount = recovered - bountyAmount;

  return (
    <div className="space-y-8">
      <PageHeader title={`Attack Panel: ${d?.protocolName || "Unknown"}`}>
        {state !== undefined && <StateBadge state={state} />}
      </PageHeader>

      <div className="rounded-lg border p-3 bg-muted/50">
        <span className="text-sm text-muted-foreground">Agreement: </span>
        <span className="font-mono text-sm">{address}</span>
      </div>

      {/* Recovery Address */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="h-5 w-5" /> Recovery Address
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border p-4 bg-green-500/10">
            <p className="text-sm text-muted-foreground mb-1">Send recovered funds to:</p>
            <p className="font-mono text-lg font-bold text-green-400">
              {(recoveryAddr as string) || "Loading..."}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Bounty Calculator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" /> Bounty Calculator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Total Funds Recovered (USD)</Label>
            <Input
              type="number"
              placeholder="1000000"
              value={fundsRecovered}
              onChange={(e) => setFundsRecovered(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Bounty Rate</p>
              <p className="text-2xl font-bold">{bountyPct}%</p>
            </div>
            <div className="rounded-lg border p-4">
              <p className="text-sm text-muted-foreground">Bounty Cap</p>
              <p className="text-2xl font-bold">${bountyCap.toLocaleString()}</p>
            </div>
            <div className="rounded-lg border p-4 bg-green-500/10">
              <p className="text-sm text-muted-foreground">Whitehat Bounty</p>
              <p className="text-2xl font-bold text-green-400">
                ${bountyAmount.toLocaleString()}
              </p>
            </div>
            <div className="rounded-lg border p-4 bg-blue-500/10">
              <p className="text-sm text-muted-foreground">Return to Protocol</p>
              <p className="text-2xl font-bold text-blue-400">
                ${returnAmount.toLocaleString()}
              </p>
            </div>
          </div>

          <Separator />

          <div className="rounded-lg border p-4">
            <h3 className="font-semibold mb-2 flex items-center gap-2">
              <Shield className="h-4 w-4" /> Fund Distribution Guidance
            </h3>
            <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
              <li>
                Drain vulnerable contracts and secure all at-risk funds
              </li>
              <li>
                Calculate your bounty: {bountyPct}% of recovered funds (capped at ${bountyCap.toLocaleString()})
              </li>
              <li>
                Retain your bounty portion: <strong className="text-green-400">${bountyAmount.toLocaleString()}</strong>
              </li>
              <li>
                Send remaining funds to recovery address:{" "}
                <strong className="text-blue-400">${returnAmount.toLocaleString()}</strong>
              </li>
              <li>
                Identity requirement: <strong>{d ? IDENTITY_LABELS[d.bountyTerms.identity as IdentityRequirements] : "N/A"}</strong>
              </li>
            </ol>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
