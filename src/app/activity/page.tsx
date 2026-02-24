"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { Clock, Radio, Filter } from "lucide-react";
import { ChainGuard } from "@/components/web3/chain-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { StateBadge } from "@/components/web3/state-badge";
import { CopyableAddress } from "@/components/ui/copyable-address";
import { useHistoricalEvents, useLiveEvents } from "@/lib/hooks/use-event-timeline";
import type { TimelineEvent } from "@/lib/hooks/use-event-timeline";
import {
  ContractState,
  CONTRACT_STATE_LABELS,
  CONTRACT_STATE_COLORS,
} from "@/lib/contracts/types";

const stateNodeColors: Record<ContractState, string> = {
  [ContractState.NOT_DEPLOYED]: "bg-gray-500",
  [ContractState.NEW_DEPLOYMENT]: "bg-blue-500",
  [ContractState.ATTACK_REQUESTED]: "bg-yellow-500",
  [ContractState.UNDER_ATTACK]: "bg-red-500",
  [ContractState.PROMOTION_REQUESTED]: "bg-purple-500",
  [ContractState.PRODUCTION]: "bg-green-500",
  [ContractState.CORRUPTED]: "bg-red-900",
};

const ALL_STATES = [
  ContractState.NOT_DEPLOYED,
  ContractState.NEW_DEPLOYMENT,
  ContractState.ATTACK_REQUESTED,
  ContractState.UNDER_ATTACK,
  ContractState.PROMOTION_REQUESTED,
  ContractState.PRODUCTION,
  ContractState.CORRUPTED,
];

export default function ActivityPage() {
  const [addressFilter, setAddressFilter] = useState("");
  const [selectedStates, setSelectedStates] = useState<ContractState[]>([]);
  const [liveMode, setLiveMode] = useState(false);

  const [appliedAddress, setAppliedAddress] = useState("");
  const [appliedStates, setAppliedStates] = useState<ContractState[]>([]);

  const {
    data: historicalEvents,
    isLoading,
    refetch,
  } = useHistoricalEvents({
    agreementAddress: appliedAddress || undefined,
    states: appliedStates.length > 0 ? appliedStates : undefined,
  });

  const liveEvents = useLiveEvents(liveMode);

  const toggleState = (state: ContractState) => {
    setSelectedStates((prev) =>
      prev.includes(state)
        ? prev.filter((s) => s !== state)
        : [...prev, state]
    );
  };

  const applyFilters = () => {
    setAppliedAddress(addressFilter);
    setAppliedStates([...selectedStates]);
    refetch();
  };

  const combinedEvents = useMemo(() => {
    const historical = historicalEvents ?? [];
    if (liveEvents.length === 0) return historical;

    const seen = new Set(
      historical.map((e) => `${e.transactionHash}-${e.blockNumber}`)
    );
    const uniqueLive = liveEvents.filter(
      (e) => !seen.has(`${e.transactionHash}-${e.blockNumber}`)
    );
    return [...uniqueLive, ...historical];
  }, [historicalEvents, liveEvents]);

  const stateCounts = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const state of ALL_STATES) {
      counts[state] = 0;
    }
    for (const event of combinedEvents) {
      counts[event.newState] = (counts[event.newState] || 0) + 1;
    }
    return counts;
  }, [combinedEvents]);

  return (
    <ChainGuard>
      <div className="space-y-6">
        <PageHeader
          title="Activity"
          description="Real-time and historical event stream"
        />

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Filter className="h-5 w-5" />
              Filters
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                Agreement Address
              </label>
              <Input
                placeholder="0x... (optional)"
                value={addressFilter}
                onChange={(e) => setAddressFilter(e.target.value)}
                className="font-mono"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-sm font-medium text-muted-foreground">
                State Filter
              </label>
              <div className="flex flex-wrap gap-2">
                {ALL_STATES.map((state) => (
                  <button
                    key={state}
                    onClick={() => toggleState(state)}
                    className={`transition-opacity ${
                      selectedStates.includes(state) ? "opacity-100" : "opacity-40"
                    }`}
                  >
                    <StateBadge state={state} />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant={liveMode ? "default" : "outline"}
                size="sm"
                onClick={() => setLiveMode(!liveMode)}
                className={liveMode ? "bg-green-600 hover:bg-green-700" : ""}
              >
                <Radio className="mr-1.5 h-4 w-4" />
                {liveMode ? "Live Mode On" : "Live Mode Off"}
              </Button>

              <Button onClick={applyFilters} size="sm">
                Apply
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Stats */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Event Statistics</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              <div className="rounded-lg border p-3 text-center">
                <p className="text-2xl font-bold">{combinedEvents.length}</p>
                <p className="text-xs text-muted-foreground">Total</p>
              </div>
              {ALL_STATES.map((state) => (
                <div key={state} className="rounded-lg border p-3 text-center">
                  <p className="text-2xl font-bold">{stateCounts[state]}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {CONTRACT_STATE_LABELS[state]}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Clock className="h-5 w-5" />
              Event Timeline
              {liveMode && (
                <Badge variant="outline" className="ml-2 border-green-500/30 bg-green-500/20 text-green-400">
                  Live
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex gap-4">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </div>
            ) : combinedEvents.length === 0 ? (
              <p className="py-8 text-center text-muted-foreground">
                No events found. Adjust filters or wait for new activity.
              </p>
            ) : (
              <div className="relative">
                {/* Vertical connector line */}
                <div className="absolute left-[19px] top-0 h-full w-0.5 bg-border" />

                <div className="space-y-6">
                  {combinedEvents.map((event, idx) => (
                    <TimelineEventCard key={`${event.transactionHash}-${event.blockNumber}-${idx}`} event={event} />
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </ChainGuard>
  );
}

function TimelineEventCard({ event }: { event: TimelineEvent }) {
  return (
    <div className="relative flex gap-4 pl-1">
      {/* Node dot */}
      <div
        className={`relative z-10 mt-1 h-[14px] w-[14px] flex-shrink-0 rounded-full border-2 border-background ${stateNodeColors[event.newState]}`}
      />

      {/* Card body */}
      <div
        className={`flex-1 rounded-lg border p-4 ${
          CONTRACT_STATE_COLORS[event.newState].replace("bg-", "border-l-4 border-l-")
        }`}
      >
        <div className="flex flex-wrap items-center gap-2">
          <StateBadge state={event.newState} />
          <Link
            href={`/agreements/${event.agreementAddress}`}
            className="hover:underline"
          >
            <CopyableAddress address={event.agreementAddress} />
          </Link>
        </div>

        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span className="font-mono">
            Block: {event.blockNumber.toString()}
          </span>
          <span className="font-mono">
            TX: {event.transactionHash.slice(0, 10)}...
          </span>
        </div>
      </div>
    </div>
  );
}
