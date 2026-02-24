"use client";

import { usePublicClient, useWatchContractEvent } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { attackRegistryAbi } from "@/lib/contracts/abis";
import { ContractState } from "@/lib/contracts/types";
import { useState } from "react";

const registryAddress = CONTRACTS.AttackRegistry as `0x${string}`;

export interface TimelineEvent {
  agreementAddress: `0x${string}`;
  newState: ContractState;
  blockNumber: bigint;
  transactionHash: `0x${string}`;
}

interface HistoricalEventFilters {
  agreementAddress?: string;
  states?: ContractState[];
  fromBlock?: bigint;
  toBlock?: bigint;
}

export function useHistoricalEvents(filters: HistoricalEventFilters = {}) {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: [
      "historical-events",
      filters.agreementAddress,
      filters.states,
      filters.fromBlock?.toString(),
      filters.toBlock?.toString(),
    ],
    queryFn: async () => {
      if (!publicClient) throw new Error("Public client not available");

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
        args: filters.agreementAddress
          ? { agreementAddress: filters.agreementAddress as `0x${string}` }
          : undefined,
        fromBlock: filters.fromBlock ?? 0n,
        toBlock: filters.toBlock ?? "latest",
      });

      let events: TimelineEvent[] = logs.map((log) => ({
        agreementAddress: log.args.agreementAddress as `0x${string}`,
        newState: Number(log.args.newState) as ContractState,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash as `0x${string}`,
      }));

      if (filters.states && filters.states.length > 0) {
        events = events.filter((event) => filters.states!.includes(event.newState));
      }

      events.sort((a, b) => {
        if (b.blockNumber > a.blockNumber) return 1;
        if (b.blockNumber < a.blockNumber) return -1;
        return 0;
      });

      return events;
    },
    enabled: !!publicClient,
  });
}

export function useLiveEvents(enabled: boolean) {
  const [events, setEvents] = useState<TimelineEvent[]>([]);

  useWatchContractEvent({
    address: registryAddress,
    abi: attackRegistryAbi,
    eventName: "AgreementStateChanged",
    enabled,
    onLogs(logs) {
      const newEvents: TimelineEvent[] = logs.map((log) => ({
        agreementAddress: log.args.agreementAddress as `0x${string}`,
        newState: Number(log.args.newState) as ContractState,
        blockNumber: log.blockNumber,
        transactionHash: log.transactionHash as `0x${string}`,
      }));
      setEvents((prev) => [...newEvents, ...prev]);
    },
  });

  return events;
}
