"use client";

import { useState, useEffect } from "react";
import { usePublicClient } from "wagmi";
import { parseAbiItem } from "viem";
import Link from "next/link";
import { ChainGuard } from "@/components/web3/chain-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { StateBadge } from "@/components/web3/state-badge";
import { useRequestAttackMode, useAgreementStatePolling } from "@/lib/hooks/use-attack-registry";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { ContractState, CONTRACT_STATE_LABELS } from "@/lib/contracts/types";
import { ContractPicker } from "@/components/web3/contract-picker";
import { Swords, ExternalLink, Loader2, RefreshCw } from "lucide-react";

interface AttackableAgreement {
  address: `0x${string}`;
  state: ContractState;
}

export default function AttackHubPage() {
  return (
    <ChainGuard>
      <AttackHubContent />
    </ChainGuard>
  );
}

function AttackHubContent() {
  const publicClient = usePublicClient();
  const [agreements, setAgreements] = useState<AttackableAgreement[]>([]);
  const [loading, setLoading] = useState(true);

  // Manual attack mode request
  const [manualAddress, setManualAddress] = useState("");
  const { requestAttack, isPending: attackPending } = useRequestAttackMode();

  // State checker
  const [checkAddress, setCheckAddress] = useState("");
  const { state: polledState } = useAgreementStatePolling(
    checkAddress.startsWith("0x") && checkAddress.length === 42
      ? (checkAddress as `0x${string}`)
      : undefined
  );

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

        const underAttack: AttackableAgreement[] = [];
        for (const [addr, state] of map) {
          if (state === ContractState.UNDER_ATTACK) {
            underAttack.push({ address: addr, state });
          }
        }
        setAgreements(underAttack);
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
        title="Attack Hub"
        description="Browse contracts under attack and manage attack requests"
      />

      {/* Request Attack Mode */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Swords className="h-5 w-5 text-red-500" />
            Request Attack Mode
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select a deployed contract to request attack mode (transitions from NEW_DEPLOYMENT to ATTACK_REQUESTED).
          </p>
          <ContractPicker
            label="Agreement Address"
            value={manualAddress}
            onChange={setManualAddress}
            placeholder="0x... agreement address"
          />
          <Button
            onClick={() => requestAttack(manualAddress as `0x${string}`)}
            disabled={!manualAddress.startsWith("0x") || manualAddress.length !== 42 || attackPending}
            className="bg-red-600 hover:bg-red-700 w-full"
          >
            {attackPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Request Attack
          </Button>
        </CardContent>
      </Card>

      {/* State Checker */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            State Checker (Auto-Polling)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Select a deployed contract to auto-poll its current state every 5 seconds.
          </p>
          <ContractPicker
            label="Agreement Address"
            value={checkAddress}
            onChange={setCheckAddress}
            placeholder="0x... agreement address"
          />
          {polledState !== undefined && (
            <div className="flex items-center gap-2">
              <StateBadge state={polledState} />
            </div>
          )}
          {polledState !== undefined && (
            <p className="text-sm text-muted-foreground">
              Current state: <strong>{CONTRACT_STATE_LABELS[polledState]}</strong> (polling every 5s)
            </p>
          )}
        </CardContent>
      </Card>

      {/* Under Attack Agreements */}
      <Card>
        <CardHeader>
          <CardTitle>Contracts Under Attack</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          ) : agreements.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              No contracts currently under attack.
            </p>
          ) : (
            <div className="space-y-3">
              {agreements.map((a) => (
                <div
                  key={a.address}
                  className="flex items-center justify-between rounded-lg border p-4"
                >
                  <div className="flex items-center gap-3">
                    <Swords className="h-5 w-5 text-red-500" />
                    <span className="font-mono text-sm">{a.address}</span>
                    <StateBadge state={a.state} />
                  </div>
                  <Link href={`/attack/${a.address}`}>
                    <Button variant="outline" size="sm">
                      Attack Panel <ExternalLink className="ml-1 h-3 w-3" />
                    </Button>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
