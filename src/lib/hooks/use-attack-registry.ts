"use client";

import { useReadContract, useWriteContract, useWatchContractEvent } from "wagmi";
import { attackRegistryAbi } from "@/lib/contracts/abis";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { ContractState } from "@/lib/contracts/types";
import { useCallback, useState } from "react";
import { toast } from "sonner";

const registryAddress = CONTRACTS.AttackRegistry as `0x${string}`;

export function useAgreementState(agreementAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: registryAddress,
    abi: attackRegistryAbi,
    functionName: "getAgreementState",
    args: agreementAddress ? [agreementAddress] : undefined,
    query: { enabled: !!agreementAddress, refetchInterval: 10_000 },
  });
}

export function useAgreementStatePolling(
  agreementAddress: `0x${string}` | undefined,
  interval = 5_000
) {
  const result = useReadContract({
    address: registryAddress,
    abi: attackRegistryAbi,
    functionName: "getAgreementState",
    args: agreementAddress ? [agreementAddress] : undefined,
    query: { enabled: !!agreementAddress, refetchInterval: interval },
  });

  return {
    ...result,
    state: result.data as ContractState | undefined,
  };
}

export function useRequestAttackMode() {
  const { writeContractAsync, isPending } = useWriteContract();

  const requestAttack = useCallback(
    async (agreementAddress: `0x${string}`) => {
      const hash = await writeContractAsync({
        address: registryAddress,
        abi: attackRegistryAbi,
        functionName: "requestUnderAttack",
        args: [agreementAddress],
      });
      toast.success("Attack mode requested", {
        description: `TX: ${hash.slice(0, 10)}...`,
      });
      return hash;
    },
    [writeContractAsync]
  );

  return { requestAttack, isPending };
}

export function useApproveAttack() {
  const { writeContractAsync, isPending } = useWriteContract();

  const approve = useCallback(
    async (agreementAddress: `0x${string}`) => {
      const hash = await writeContractAsync({
        address: registryAddress,
        abi: attackRegistryAbi,
        functionName: "approveAttackRequest",
        args: [agreementAddress],
      });
      toast.success("Attack request approved", {
        description: `TX: ${hash.slice(0, 10)}...`,
      });
      return hash;
    },
    [writeContractAsync]
  );

  return { approve, isPending };
}

export function useRejectAttack() {
  const { writeContractAsync, isPending } = useWriteContract();

  const reject = useCallback(
    async (agreementAddress: `0x${string}`) => {
      const hash = await writeContractAsync({
        address: registryAddress,
        abi: attackRegistryAbi,
        functionName: "rejectAttackRequest",
        args: [agreementAddress],
      });
      toast.success("Attack request rejected", {
        description: `TX: ${hash.slice(0, 10)}...`,
      });
      return hash;
    },
    [writeContractAsync]
  );

  return { reject, isPending };
}

export function useRequestPromotion() {
  const { writeContractAsync, isPending } = useWriteContract();

  const requestPromotion = useCallback(
    async (agreementAddress: `0x${string}`) => {
      const hash = await writeContractAsync({
        address: registryAddress,
        abi: attackRegistryAbi,
        functionName: "requestPromotion",
        args: [agreementAddress],
      });
      toast.success("Promotion requested", {
        description: `TX: ${hash.slice(0, 10)}...`,
      });
      return hash;
    },
    [writeContractAsync]
  );

  return { requestPromotion, isPending };
}

export function usePromote() {
  const { writeContractAsync, isPending } = useWriteContract();

  const promote = useCallback(
    async (agreementAddress: `0x${string}`) => {
      const hash = await writeContractAsync({
        address: registryAddress,
        abi: attackRegistryAbi,
        functionName: "promote",
        args: [agreementAddress],
      });
      toast.success("Agreement promoted", {
        description: `TX: ${hash.slice(0, 10)}...`,
      });
      return hash;
    },
    [writeContractAsync]
  );

  return { promote, isPending };
}

export function useCancelPromotion() {
  const { writeContractAsync, isPending } = useWriteContract();

  const cancel = useCallback(
    async (agreementAddress: `0x${string}`) => {
      const hash = await writeContractAsync({
        address: registryAddress,
        abi: attackRegistryAbi,
        functionName: "cancelPromotion",
        args: [agreementAddress],
      });
      toast.success("Promotion cancelled", {
        description: `TX: ${hash.slice(0, 10)}...`,
      });
      return hash;
    },
    [writeContractAsync]
  );

  return { cancel, isPending };
}

export interface AgreementEvent {
  agreementAddress: `0x${string}`;
  previousState: ContractState;
  newState: ContractState;
  blockNumber: bigint;
}

export function useAgreementEvents() {
  const [events, setEvents] = useState<AgreementEvent[]>([]);

  useWatchContractEvent({
    address: registryAddress,
    abi: attackRegistryAbi,
    eventName: "AgreementStateChanged",
    onLogs(logs) {
      const newEvents = logs.map((log) => ({
        agreementAddress: log.args.agreementAddress as `0x${string}`,
        previousState: Number(log.args.previousState) as ContractState,
        newState: Number(log.args.newState) as ContractState,
        blockNumber: log.blockNumber,
      }));
      setEvents((prev) => [...newEvents, ...prev]);
    },
  });

  return events;
}

export function useIsUnderAttack(contractAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: registryAddress,
    abi: attackRegistryAbi,
    functionName: "isTopLevelContractUnderAttack",
    args: contractAddress ? [contractAddress] : undefined,
    query: { enabled: !!contractAddress },
  });
}

export function useAgreementForContract(contractAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: registryAddress,
    abi: attackRegistryAbi,
    functionName: "getAgreementForContract",
    args: contractAddress ? [contractAddress] : undefined,
    query: { enabled: !!contractAddress },
  });
}
