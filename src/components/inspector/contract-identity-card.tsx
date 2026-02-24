"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CopyableAddress } from "@/components/ui/copyable-address";
import {
  useContractDeployer,
  useAuthorizedOwner,
  useAgreementForContract,
} from "@/lib/hooks/use-attack-registry";
import { Fingerprint } from "lucide-react";
import Link from "next/link";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";

interface ContractIdentityCardProps {
  contractAddress: `0x${string}`;
}

export function ContractIdentityCard({ contractAddress }: ContractIdentityCardProps) {
  const { data: deployer, isLoading: loadingDeployer } = useContractDeployer(contractAddress);
  const { data: authorizedOwner, isLoading: loadingOwner } = useAuthorizedOwner(contractAddress);
  const { data: linkedAgreement, isLoading: loadingAgreement } = useAgreementForContract(contractAddress);

  const deployerAddr = deployer as `0x${string}` | undefined;
  const ownerAddr = authorizedOwner as `0x${string}` | undefined;
  const agreementAddr = linkedAgreement as `0x${string}` | undefined;
  const hasAgreement = agreementAddr && agreementAddr !== ZERO_ADDRESS;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Fingerprint className="h-5 w-5" /> Contract Identity
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Deployer */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Deployer</span>
          {loadingDeployer ? (
            <Skeleton className="h-5 w-32" />
          ) : deployerAddr && deployerAddr !== ZERO_ADDRESS ? (
            <CopyableAddress address={deployerAddr} />
          ) : (
            <span className="text-sm text-muted-foreground">Unknown</span>
          )}
        </div>

        {/* Authorized Owner */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Authorized Owner</span>
          {loadingOwner ? (
            <Skeleton className="h-5 w-32" />
          ) : ownerAddr && ownerAddr !== ZERO_ADDRESS ? (
            <CopyableAddress address={ownerAddr} />
          ) : (
            <span className="text-sm text-muted-foreground">None</span>
          )}
        </div>

        {/* Linked Agreement */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Linked Agreement</span>
          {loadingAgreement ? (
            <Skeleton className="h-5 w-32" />
          ) : hasAgreement ? (
            <Link
              href={`/agreements/${agreementAddr}`}
              className="hover:underline"
            >
              <CopyableAddress address={agreementAddr} />
            </Link>
          ) : (
            <span className="text-sm text-muted-foreground">None</span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
