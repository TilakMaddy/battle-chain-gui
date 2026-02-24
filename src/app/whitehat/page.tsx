"use client";

import { useState } from "react";
import Link from "next/link";
import { ChainGuard } from "@/components/web3/chain-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyableAddress } from "@/components/ui/copyable-address";
import { StateBadge } from "@/components/web3/state-badge";
import {
  useAgreementForContract,
  useIsUnderAttack,
  useAgreementState,
} from "@/lib/hooks/use-attack-registry";
import {
  useAgreementDetails,
  useIsContractInScope,
} from "@/lib/hooks/use-agreement";
import { ContractState } from "@/lib/contracts/types";
import {
  Search,
  Shield,
  DollarSign,
  Calculator,
  ExternalLink,
  CheckCircle,
  XCircle,
  AlertTriangle,
} from "lucide-react";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;

export default function WhitehatPage() {
  return (
    <ChainGuard>
      <WhitehatContent />
    </ChainGuard>
  );
}

function WhitehatContent() {
  // --- Scope Check State ---
  const [addressInput, setAddressInput] = useState("");
  const [checkedAddress, setCheckedAddress] = useState<`0x${string}` | undefined>();

  // --- Bounty Calculator State ---
  const [recoveredUsd, setRecoveredUsd] = useState("");
  const [calcPercentage, setCalcPercentage] = useState("");
  const [calcCap, setCalcCap] = useState("");

  // --- Scope Check Hooks ---
  const isValidAddress = checkedAddress ? ADDRESS_REGEX.test(checkedAddress) : false;

  const {
    data: agreementAddr,
    isLoading: agreementLoading,
  } = useAgreementForContract(isValidAddress ? checkedAddress : undefined);

  const {
    data: isUnderAttack,
    isLoading: attackLoading,
  } = useIsUnderAttack(isValidAddress ? checkedAddress : undefined);

  const hasAgreement =
    agreementAddr !== undefined &&
    agreementAddr !== ZERO_ADDRESS &&
    typeof agreementAddr === "string";

  const agreementAddress = hasAgreement
    ? (agreementAddr as `0x${string}`)
    : undefined;

  const {
    data: agreementDetails,
    isLoading: detailsLoading,
  } = useAgreementDetails(agreementAddress);

  const {
    data: isInScope,
    isLoading: scopeLoading,
  } = useIsContractInScope(agreementAddress, isValidAddress ? checkedAddress : undefined);

  const {
    data: stateRaw,
    isLoading: stateLoading,
  } = useAgreementState(agreementAddress);

  const isLoading =
    agreementLoading || attackLoading || detailsLoading || scopeLoading || stateLoading;

  // Extract bounty terms from the decoded AgreementDetails struct returned by getDetails()
  const bountyTerms = agreementDetails
    ? (agreementDetails as unknown as {
        bountyTerms: {
          bountyPercentage: bigint;
          bountyCapUsd: bigint;
          retainable: boolean;
          identity: number;
          diligenceRequirements: string;
          aggregateBountyCapUsd: bigint;
        };
      }).bountyTerms
    : undefined;

  const handleCheck = () => {
    const trimmed = addressInput.trim();
    if (ADDRESS_REGEX.test(trimmed)) {
      setCheckedAddress(trimmed as `0x${string}`);

      // Pre-fill calculator from agreement bounty terms if available
      // (will be filled after data loads via effect below)
    }
  };

  // Pre-fill calculator when bounty terms load
  const prefillFromTerms = () => {
    if (bountyTerms && !calcPercentage && !calcCap) {
      setCalcPercentage(bountyTerms.bountyPercentage.toString());
      setCalcCap(bountyTerms.bountyCapUsd.toString());
    }
  };
  // Run prefill on each render when bountyTerms changes
  if (bountyTerms && !calcPercentage && !calcCap && checkedAddress) {
    prefillFromTerms();
  }

  // Bounty calculation
  const recovered = parseFloat(recoveredUsd) || 0;
  const percentage = parseFloat(calcPercentage) || 0;
  const cap = parseFloat(calcCap) || 0;
  const calculatedBounty = (recovered * percentage) / 10000;
  const actualPayout = cap > 0 ? Math.min(calculatedBounty, cap) : calculatedBounty;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Whitehat Dashboard"
        description="Discover bounty opportunities and check contract scope"
      />

      {/* Section 1: Quick Scope Check */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Quick Scope Check
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex gap-3">
            <div className="flex-1">
              <Label htmlFor="scope-address">Contract Address</Label>
              <Input
                id="scope-address"
                placeholder="0x..."
                value={addressInput}
                onChange={(e) => setAddressInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleCheck()}
                className="font-mono mt-1.5"
              />
            </div>
            <div className="flex items-end">
              <Button
                onClick={handleCheck}
                disabled={!ADDRESS_REGEX.test(addressInput.trim())}
                className="bg-red-600 hover:bg-red-700"
              >
                <Search className="mr-2 h-4 w-4" />
                Check
              </Button>
            </div>
          </div>

          {/* Results */}
          {checkedAddress && (
            <div className="space-y-4 rounded-lg border p-4 bg-muted/50">
              {isLoading ? (
                <div className="space-y-3">
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-5 w-64" />
                  <Skeleton className="h-5 w-40" />
                </div>
              ) : (
                <>
                  {/* Scope Badge */}
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">In Scope:</span>
                      {hasAgreement ? (
                        isInScope ? (
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                            <CheckCircle className="mr-1 h-3.5 w-3.5" />
                            In Scope
                          </Badge>
                        ) : (
                          <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                            <XCircle className="mr-1 h-3.5 w-3.5" />
                            Not In Scope
                          </Badge>
                        )
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          No Agreement Found
                        </Badge>
                      )}
                    </div>

                    {/* Under Attack Badge */}
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Attack Status:</span>
                      {isUnderAttack ? (
                        <Badge className="bg-red-500/20 text-red-400 border-red-500/30">
                          <AlertTriangle className="mr-1 h-3.5 w-3.5" />
                          Under Attack
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground">
                          Not Under Attack
                        </Badge>
                      )}
                    </div>

                    {/* Agreement State */}
                    {stateRaw !== undefined && (
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium">State:</span>
                        <StateBadge state={Number(stateRaw) as ContractState} />
                      </div>
                    )}
                  </div>

                  {/* Linked Agreement */}
                  {hasAgreement && agreementAddress && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Linked Agreement:</span>
                      <CopyableAddress address={agreementAddress} />
                      <Link href={`/agreements/${agreementAddress}`}>
                        <Button variant="ghost" size="sm" className="h-7 px-2">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </Button>
                      </Link>
                    </div>
                  )}

                  {/* Bounty Summary */}
                  {bountyTerms && (
                    <div className="space-y-2 border-t pt-3">
                      <p className="text-sm font-medium flex items-center gap-1.5">
                        <DollarSign className="h-4 w-4" />
                        Bounty Terms
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground">Percentage:</span>{" "}
                          <span className="font-mono font-medium">
                            {(Number(bountyTerms.bountyPercentage) / 100).toFixed(2)}%
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Cap:</span>{" "}
                          <span className="font-mono font-medium">
                            ${Number(bountyTerms.bountyCapUsd).toLocaleString()} USD
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Retainable:</span>{" "}
                          <span className="font-medium">
                            {bountyTerms.retainable ? "Yes" : "No"}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {!hasAgreement && (
                    <p className="text-sm text-muted-foreground">
                      This contract is not linked to any Safe Harbor agreement in the AttackRegistry.
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 2: Bounty Calculator */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calculator className="h-5 w-5" />
            Bounty Calculator
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="recovered">Funds Recovered (USD)</Label>
              <Input
                id="recovered"
                type="number"
                placeholder="1000000"
                value={recoveredUsd}
                onChange={(e) => setRecoveredUsd(e.target.value)}
                className="font-mono"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="calc-pct">Bounty Percentage (basis points)</Label>
              <Input
                id="calc-pct"
                type="number"
                placeholder="1000 = 10%"
                value={calcPercentage}
                onChange={(e) => setCalcPercentage(e.target.value)}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                {percentage > 0 ? `${(percentage / 100).toFixed(2)}%` : "e.g. 1000 = 10%"}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="calc-cap">Bounty Cap (USD)</Label>
              <Input
                id="calc-cap"
                type="number"
                placeholder="500000"
                value={calcCap}
                onChange={(e) => setCalcCap(e.target.value)}
                className="font-mono"
              />
            </div>
          </div>

          {recovered > 0 && percentage > 0 && (
            <div className="rounded-lg border p-4 bg-muted/50 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Calculated Bounty:</span>
                  <p className="font-mono text-lg font-medium">
                    ${calculatedBounty.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Bounty Cap:</span>
                  <p className="font-mono text-lg font-medium">
                    {cap > 0 ? `$${cap.toLocaleString()}` : "No cap"}
                  </p>
                </div>
              </div>
              <div className="border-t pt-3">
                <span className="text-muted-foreground text-sm">Actual Payout:</span>
                <p className="font-mono text-2xl font-bold text-green-400">
                  ${actualPayout.toLocaleString(undefined, { maximumFractionDigits: 2 })}
                </p>
                {cap > 0 && calculatedBounty > cap && (
                  <p className="text-xs text-yellow-400 mt-1">
                    Capped at ${cap.toLocaleString()} USD (calculated amount exceeds cap)
                  </p>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 3: Active Bounties Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Active Bounties
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-yellow-400 mt-0.5 shrink-0" />
            <div className="space-y-2 text-sm">
              <p>
                Agreements in the{" "}
                <Badge className="bg-red-500/20 text-red-400 border-red-500/30 mx-1">
                  Under Attack
                </Badge>{" "}
                state have active bounties. Whitehats can recover funds and claim bounties according
                to the agreement terms.
              </p>
              <p className="text-muted-foreground">
                Monitor the Activity page for real-time state changes, or browse all agreements
                to find those currently under attack.
              </p>
            </div>
          </div>
          <div className="flex gap-3">
            <Link href="/activity">
              <Button variant="outline" size="sm">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Activity Feed
              </Button>
            </Link>
            <Link href="/agreements">
              <Button variant="outline" size="sm">
                <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                Browse Agreements
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Section 4: Contact Directory */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Contact Directory
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Contact details for each protocol are available on their agreement detail page.
            Browse agreements to find the protocol you are looking for and view their contact
            information, bounty terms, and scope details.
          </p>
          <Link href="/agreements">
            <Button variant="outline" size="sm">
              <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
              Browse Agreements
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
