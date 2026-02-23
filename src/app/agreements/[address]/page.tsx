"use client";

import { use } from "react";
import { useAccount } from "wagmi";
import { ChainGuard } from "@/components/web3/chain-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { StateBadge } from "@/components/web3/state-badge";
import {
  useAgreementDetails,
  useAgreementOwner,
  useIsAgreementValid,
  useAssetRecoveryAddress,
} from "@/lib/hooks/use-agreement";
import {
  useAgreementState,
  useRequestAttackMode,
  useRequestPromotion,
} from "@/lib/hooks/use-attack-registry";
import {
  ContractState,
  IDENTITY_LABELS,
  IdentityRequirements,
  CHILD_SCOPE_LABELS,
  ChildContractScope,
} from "@/lib/contracts/types";
import {
  Shield,
  User,
  MapPin,
  DollarSign,
  Swords,
  TrendingUp,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";
import Link from "next/link";

export default function AgreementDetailPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address: agreementAddress } = use(params);
  return (
    <ChainGuard>
      <AgreementDetailContent address={agreementAddress as `0x${string}`} />
    </ChainGuard>
  );
}

function AgreementDetailContent({ address }: { address: `0x${string}` }) {
  const { address: wallet } = useAccount();
  const { data: details, isLoading: loadingDetails } = useAgreementDetails(address);
  const { data: owner } = useAgreementOwner(address);
  const { data: stateRaw, isLoading: loadingState } = useAgreementState(address);
  const { data: isValid } = useIsAgreementValid(address);
  const { data: recoveryAddr } = useAssetRecoveryAddress(address);

  const { requestAttack, isPending: attackPending } = useRequestAttackMode();
  const { requestPromotion, isPending: promotionPending } = useRequestPromotion();

  const state = stateRaw as ContractState | undefined;
  const isOwner = wallet && owner && wallet.toLowerCase() === (owner as string).toLowerCase();

  if (loadingDetails || loadingState) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const d = details as {
    protocolName: string;
    contactDetails: { name: string; contact: string }[];
    chains: {
      caip2ChainId: string;
      assetRecoveryAddress: string;
      accounts: { accountAddress: string; childContractScope: number }[];
    }[];
    bountyTerms: {
      bountyPercentage: bigint;
      bountyCapUsd: bigint;
      retainable: boolean;
      identity: number;
      diligenceRequirements: string;
      aggregateBountyCapUsd: bigint;
    };
    agreementURI: string;
  } | undefined;

  return (
    <div className="space-y-8">
      <PageHeader title={d?.protocolName || "Agreement"}>
        <div className="flex items-center gap-3">
          {state !== undefined && <StateBadge state={state} />}
          {isValid ? (
            <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30">
              <CheckCircle className="mr-1 h-3 w-3" /> Valid
            </Badge>
          ) : (
            <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/30">
              <XCircle className="mr-1 h-3 w-3" /> Not Valid
            </Badge>
          )}
        </div>
      </PageHeader>

      <div className="rounded-lg border p-3 bg-muted/50">
        <span className="text-sm text-muted-foreground">Address: </span>
        <span className="font-mono text-sm">{address}</span>
      </div>

      {!d ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Could not load agreement details. The contract may not exist.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Contact Details */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" /> Contact Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {d.contactDetails.map((c, i) => (
                <div key={i} className="flex items-center gap-2">
                  <span className="font-medium">{c.name}:</span>
                  <span className="text-muted-foreground">{c.contact}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Scope */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" /> Scope
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {d.chains.map((chain, i) => (
                <div key={i} className="rounded-lg border p-4 space-y-2">
                  <p className="text-sm">
                    <span className="font-medium">Chain:</span>{" "}
                    <span className="font-mono">{chain.caip2ChainId}</span>
                  </p>
                  <p className="text-sm">
                    <span className="font-medium">Recovery Address:</span>{" "}
                    <span className="font-mono">{chain.assetRecoveryAddress || (recoveryAddr as string) || "N/A"}</span>
                  </p>
                  <Separator />
                  {chain.accounts.map((acc, j) => (
                    <div key={j} className="flex items-center gap-2 text-sm">
                      <span className="font-mono">{acc.accountAddress}</span>
                      <Badge variant="secondary">
                        {CHILD_SCOPE_LABELS[acc.childContractScope as ChildContractScope]}
                      </Badge>
                    </div>
                  ))}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Bounty Terms */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" /> Bounty Terms
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
                <div>
                  <p className="text-sm text-muted-foreground">Bounty %</p>
                  <p className="text-lg font-bold">
                    {Number(d.bountyTerms.bountyPercentage) / 100}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cap (USD)</p>
                  <p className="text-lg font-bold">
                    ${Number(d.bountyTerms.bountyCapUsd).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Aggregate Cap</p>
                  <p className="text-lg font-bold">
                    ${Number(d.bountyTerms.aggregateBountyCapUsd).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Retainable</p>
                  <p className="text-lg font-bold">{d.bountyTerms.retainable ? "Yes" : "No"}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Identity</p>
                  <p className="text-lg font-bold">
                    {IDENTITY_LABELS[d.bountyTerms.identity as IdentityRequirements]}
                  </p>
                </div>
              </div>
              {d.bountyTerms.diligenceRequirements && (
                <div className="mt-4">
                  <p className="text-sm text-muted-foreground">Diligence Requirements</p>
                  <p className="text-sm mt-1">{d.bountyTerms.diligenceRequirements}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" /> Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {state === ContractState.NEW_DEPLOYMENT && isOwner && (
                <Button
                  onClick={() => requestAttack(address)}
                  disabled={attackPending}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {attackPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <Swords className="mr-2 h-4 w-4" /> Request Attack Mode
                </Button>
              )}
              {state === ContractState.UNDER_ATTACK && (
                <Link href={`/attack/${address}`}>
                  <Button variant="destructive">
                    <Swords className="mr-2 h-4 w-4" /> View Attack Panel
                  </Button>
                </Link>
              )}
              {state === ContractState.UNDER_ATTACK && isOwner && (
                <Button
                  onClick={() => requestPromotion(address)}
                  disabled={promotionPending}
                  variant="outline"
                >
                  {promotionPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  <TrendingUp className="mr-2 h-4 w-4" /> Request Promotion
                </Button>
              )}
              {state === ContractState.ATTACK_REQUESTED && (
                <Link href="/dao">
                  <Button variant="outline">Awaiting DAO Review</Button>
                </Link>
              )}
              {state === ContractState.PRODUCTION && (
                <Badge variant="outline" className="bg-green-500/20 text-green-400 border-green-500/30 text-base px-4 py-2">
                  Production
                </Badge>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
