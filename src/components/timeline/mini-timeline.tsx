"use client";

import { usePublicClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { StateBadge } from "@/components/web3/state-badge";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { ContractState } from "@/lib/contracts/types";
import { Clock } from "lucide-react";

const registryAddress = CONTRACTS.AttackRegistry as `0x${string}`;

interface MiniTimelineProps {
  agreementAddress: `0x${string}`;
  limit?: number;
}

interface TimelineEvent {
  blockNumber: bigint;
  newState: ContractState;
}

export function MiniTimeline({ agreementAddress, limit = 20 }: MiniTimelineProps) {
  const publicClient = usePublicClient();

  const { data: events, isLoading } = useQuery({
    queryKey: ["mini-timeline", agreementAddress],
    queryFn: async (): Promise<TimelineEvent[]> => {
      if (!publicClient) return [];

      const logs = await publicClient.getLogs({
        address: registryAddress,
        event: {
          type: "event" as const,
          name: "AgreementStateChanged" as const,
          inputs: [
            { name: "agreementAddress", type: "address", indexed: true, internalType: "address" },
            { name: "newState", type: "uint8", indexed: false, internalType: "enum IAttackRegistry.ContractState" },
          ],
        },
        args: {
          agreementAddress,
        },
        fromBlock: 0n,
        toBlock: "latest",
      });

      return logs
        .map((log) => ({
          blockNumber: log.blockNumber,
          newState: Number(log.args.newState) as ContractState,
        }))
        .slice(-limit);
    },
    enabled: !!publicClient && !!agreementAddress,
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" /> Event Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-3 w-3 rounded-full" />
                <Skeleton className="h-5 w-full" />
              </div>
            ))}
          </div>
        ) : !events || events.length === 0 ? (
          <p className="text-sm text-muted-foreground">No state change events found.</p>
        ) : (
          <div className="relative space-y-0">
            {events.map((event, i) => (
              <div key={i} className="relative flex items-start gap-3 pb-4 last:pb-0">
                {/* Connecting line */}
                {i < events.length - 1 && (
                  <div className="absolute left-[5px] top-3 h-full w-px bg-border" />
                )}
                {/* Dot */}
                <div className="relative z-10 mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full border-2 border-primary bg-background" />
                {/* Content */}
                <div className="flex flex-1 items-center justify-between gap-2">
                  <StateBadge state={event.newState} />
                  <span className="font-mono text-xs text-muted-foreground">
                    Block #{event.blockNumber.toString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
