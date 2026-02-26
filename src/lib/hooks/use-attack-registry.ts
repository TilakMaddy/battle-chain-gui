"use client";

import { useReadContract, useWriteContract, useWatchContractEvent } from "wagmi";
import { attackRegistryAbi } from "@/lib/contracts/abis";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { ContractState } from "@/lib/contracts/types";
import type { AgreementInfo } from "@/lib/contracts/types";
import { useCallback, useState } from "react";
import { txToast } from "@/lib/utils";

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
      txToast("Attack mode requested", hash);
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
      txToast("Attack request approved", hash);
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
      txToast("Attack request rejected", hash);
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
      txToast("Promotion requested", hash);
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
      txToast("Agreement promoted", hash);
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
      txToast("Promotion cancelled", hash);
      return hash;
    },
    [writeContractAsync]
  );

  return { cancel, isPending };
}

export interface AgreementEvent {
  agreementAddress: `0x${string}`;
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

// --- New hooks ---

export function useAgreementInfo(agreementAddress: `0x${string}` | undefined) {
  const result = useReadContract({
    address: registryAddress,
    abi: attackRegistryAbi,
    functionName: "getAgreementInfo",
    args: agreementAddress ? [agreementAddress] : undefined,
    query: { enabled: !!agreementAddress, refetchInterval: 10_000 },
  });

  return {
    ...result,
    info: result.data as AgreementInfo | undefined,
  };
}

export function useAuthorizedOwner(contractAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: registryAddress,
    abi: attackRegistryAbi,
    functionName: "getAuthorizedOwner",
    args: contractAddress ? [contractAddress] : undefined,
    query: { enabled: !!contractAddress },
  });
}

export function useAttackModerator(agreementAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: registryAddress,
    abi: attackRegistryAbi,
    functionName: "getAttackModerator",
    args: agreementAddress ? [agreementAddress] : undefined,
    query: { enabled: !!agreementAddress },
  });
}

export function useContractDeployer(contractAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: registryAddress,
    abi: attackRegistryAbi,
    functionName: "getContractDeployer",
    args: contractAddress ? [contractAddress] : undefined,
    query: { enabled: !!contractAddress },
  });
}

export function useGoToProduction() {
  const { writeContractAsync, isPending } = useWriteContract();

  const goToProduction = useCallback(
    async (agreementAddress: `0x${string}`) => {
      const hash = await writeContractAsync({
        address: registryAddress,
        abi: attackRegistryAbi,
        functionName: "goToProduction",
        args: [agreementAddress],
      });
      txToast("Moved to production", hash);
      return hash;
    },
    [writeContractAsync]
  );

  return { goToProduction, isPending };
}

export function useMarkCorrupted() {
  const { writeContractAsync, isPending } = useWriteContract();

  const markCorrupted = useCallback(
    async (agreementAddress: `0x${string}`) => {
      const hash = await writeContractAsync({
        address: registryAddress,
        abi: attackRegistryAbi,
        functionName: "markCorrupted",
        args: [agreementAddress],
      });
      txToast("Agreement marked as corrupted", hash);
      return hash;
    },
    [writeContractAsync]
  );

  return { markCorrupted, isPending };
}

export function useTransferAttackModerator() {
  const { writeContractAsync, isPending } = useWriteContract();

  const transferModerator = useCallback(
    async (agreementAddress: `0x${string}`, newModerator: `0x${string}`) => {
      const hash = await writeContractAsync({
        address: registryAddress,
        abi: attackRegistryAbi,
        functionName: "transferAttackModerator",
        args: [agreementAddress, newModerator],
      });
      txToast("Attack moderator transferred", hash);
      return hash;
    },
    [writeContractAsync]
  );

  return { transferModerator, isPending };
}

export function useAuthorizeAgreementOwner() {
  const { writeContractAsync, isPending } = useWriteContract();

  const authorizeOwner = useCallback(
    async (contractAddress: `0x${string}`, newOwner: `0x${string}`) => {
      const hash = await writeContractAsync({
        address: registryAddress,
        abi: attackRegistryAbi,
        functionName: "authorizeAgreementOwner",
        args: [contractAddress, newOwner],
      });
      txToast("Agreement owner authorized", hash);
      return hash;
    },
    [writeContractAsync]
  );

  return { authorizeOwner, isPending };
}

export function useInstantPromote() {
  const { writeContractAsync, isPending } = useWriteContract();

  const instantPromote = useCallback(
    async (agreementAddress: `0x${string}`) => {
      const hash = await writeContractAsync({
        address: registryAddress,
        abi: attackRegistryAbi,
        functionName: "instantPromote",
        args: [agreementAddress],
      });
      txToast("Agreement instantly promoted", hash);
      return hash;
    },
    [writeContractAsync]
  );

  return { instantPromote, isPending };
}
