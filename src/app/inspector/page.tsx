"use client";

import { useState } from "react";
import { ChainGuard } from "@/components/web3/chain-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { ContractIdentityCard } from "@/components/inspector/contract-identity-card";
import { AgreementInfoDisplay } from "@/components/inspector/agreement-info-display";
import { MiniTimeline } from "@/components/timeline/mini-timeline";
import { useAgreementForContract, useIsUnderAttack } from "@/lib/hooks/use-attack-registry";
import { useAgreementDetails, useIsContractInScope, useIsAgreementContract } from "@/lib/hooks/use-agreement";
import {
  IDENTITY_LABELS,
  IdentityRequirements,
  CHILD_SCOPE_LABELS,
  ChildContractScope,
} from "@/lib/contracts/types";
import {
  Search,
  Shield,
  AlertTriangle,
  User,
  MapPin,
  DollarSign,
  CheckCircle,
  XCircle,
} from "lucide-react";

const ADDRESS_REGEX = /^0x[0-9a-fA-F]{40}$/;
const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

export default function InspectorPage() {
  return (
    <ChainGuard>
      <InspectorContent />
    </ChainGuard>
  );
}

function InspectorContent() {
  const [inputValue, setInputValue] = useState("");
  const [searchedAddress, setSearchedAddress] = useState<`0x${string}` | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);

  const handleSearch = () => {
    const trimmed = inputValue.trim();
    if (!ADDRESS_REGEX.test(trimmed)) {
      setInputError("Enter a valid address (0x followed by 40 hex characters).");
      setSearchedAddress(null);
      return;
    }
    setInputError(null);
    setSearchedAddress(trimmed as `0x${string}`);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleSearch();
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Contract Inspector"
        description="Enter any address to look up its on-chain state"
      />

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex gap-2">
            <Input
              placeholder="0x..."
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                if (inputError) setInputError(null);
              }}
              onKeyDown={handleKeyDown}
              className="font-mono"
            />
            <Button onClick={handleSearch}>
              <Search className="mr-2 h-4 w-4" /> Search
            </Button>
          </div>
          {inputError && (
            <p className="mt-2 text-sm text-destructive flex items-center gap-1">
              <AlertTriangle className="h-3.5 w-3.5" /> {inputError}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Results */}
      {searchedAddress && <InspectorResults contractAddress={searchedAddress} />}
    </div>
  );
}

function InspectorResults({ contractAddress }: { contractAddress: `0x${string}` }) {
  const { data: linkedAgreementRaw, isLoading: loadingAgreement } =
    useAgreementForContract(contractAddress);
  const { data: isAgreementItself, isLoading: loadingIsAgreement } =
    useIsAgreementContract(contractAddress);

  const agreementAddr = linkedAgreementRaw as `0x${string}` | undefined;
  const hasLinkedAgreement = agreementAddr && agreementAddr !== ZERO_ADDRESS;
  const isLoading = loadingAgreement || loadingIsAgreement;

  // Determine the effective agreement address:
  // 1. If this address IS an agreement contract, use it directly
  // 2. If it's linked to an agreement via the registry, use that
  const effectiveAgreement = isAgreementItself
    ? contractAddress
    : hasLinkedAgreement
      ? agreementAddr
      : null;

  return (
    <div className="space-y-6">
      {/* Address display */}
      <div className="rounded-lg border p-3 bg-muted/50">
        <span className="text-sm text-muted-foreground">Inspecting: </span>
        <span className="font-mono text-sm">{contractAddress}</span>
        {isAgreementItself && (
          <Badge variant="outline" className="ml-2 bg-blue-500/20 text-blue-400 border-blue-500/30">
            Agreement Contract
          </Badge>
        )}
      </div>

      {/* Contract Identity */}
      <ContractIdentityCard contractAddress={contractAddress} />

      {/* Agreement-linked sections */}
      {isLoading ? (
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : effectiveAgreement ? (
        <AgreementLinkedSection
          contractAddress={contractAddress}
          agreementAddress={effectiveAgreement}
        />
      ) : (
        <Card>
          <CardContent className="py-12 text-center space-y-2">
            <Shield className="mx-auto h-8 w-8 text-muted-foreground" />
            <p className="text-muted-foreground">
              This address is not linked to any agreement.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AgreementLinkedSection({
  contractAddress,
  agreementAddress,
}: {
  contractAddress: `0x${string}`;
  agreementAddress: `0x${string}`;
}) {
  const { data: details, isLoading: loadingDetails } = useAgreementDetails(agreementAddress);
  const { data: inScopeRaw, isLoading: loadingScope } = useIsContractInScope(
    agreementAddress,
    contractAddress
  );
  const { data: underAttackRaw } = useIsUnderAttack(contractAddress);

  const isInScope = inScopeRaw as boolean | undefined;
  const isUnderAttack = underAttackRaw as boolean | undefined;

  const d = details as
    | {
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
      }
    | undefined;

  return (
    <div className="space-y-6">
      {/* Scope and Attack Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" /> Contract Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">In Scope</span>
            {loadingScope ? (
              <Skeleton className="h-5 w-16" />
            ) : isInScope ? (
              <Badge
                variant="outline"
                className="bg-green-500/20 text-green-400 border-green-500/30"
              >
                <CheckCircle className="mr-1 h-3 w-3" /> Yes
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="bg-red-500/20 text-red-400 border-red-500/30"
              >
                <XCircle className="mr-1 h-3 w-3" /> No
              </Badge>
            )}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Under Attack</span>
            {isUnderAttack !== undefined ? (
              isUnderAttack ? (
                <Badge
                  variant="outline"
                  className="bg-red-500/20 text-red-400 border-red-500/30"
                >
                  <AlertTriangle className="mr-1 h-3 w-3" /> Yes
                </Badge>
              ) : (
                <Badge
                  variant="outline"
                  className="bg-green-500/20 text-green-400 border-green-500/30"
                >
                  No
                </Badge>
              )
            ) : (
              <Skeleton className="h-5 w-16" />
            )}
          </div>
        </CardContent>
      </Card>

      {/* Agreement Info */}
      <AgreementInfoDisplay agreementAddress={agreementAddress} />

      {/* Agreement Details */}
      {loadingDetails ? (
        <div className="space-y-6">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-48 w-full" />
        </div>
      ) : d ? (
        <>
          {/* Protocol & Contacts */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" /> {d.protocolName || "Protocol Details"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {d.contactDetails.length > 0 ? (
                d.contactDetails.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <span className="font-medium">{c.name}:</span>
                    <span className="text-muted-foreground">{c.contact}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No contacts listed.</p>
              )}
              {d.agreementURI && (
                <div className="pt-2">
                  <span className="text-sm text-muted-foreground">Agreement URI: </span>
                  <a
                    href={d.agreementURI}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-mono hover:underline"
                  >
                    {d.agreementURI}
                  </a>
                </div>
              )}
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
                    <span className="font-mono">
                      {chain.assetRecoveryAddress || "N/A"}
                    </span>
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
                    {(BigInt(d.bountyTerms.bountyPercentage) / 100n).toString()}%
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Cap (USD)</p>
                  <p className="text-lg font-bold">
                    ${BigInt(d.bountyTerms.bountyCapUsd).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Aggregate Cap</p>
                  <p className="text-lg font-bold">
                    ${BigInt(d.bountyTerms.aggregateBountyCapUsd).toLocaleString()}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Retainable</p>
                  <p className="text-lg font-bold">
                    {d.bountyTerms.retainable ? "Yes" : "No"}
                  </p>
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
                  <p className="text-sm text-muted-foreground">
                    Diligence Requirements
                  </p>
                  <p className="text-sm mt-1">{d.bountyTerms.diligenceRequirements}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}

      {/* Mini Timeline */}
      <MiniTimeline agreementAddress={agreementAddress} />
    </div>
  );
}
