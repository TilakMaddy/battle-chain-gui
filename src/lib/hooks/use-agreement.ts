"use client";

import { useReadContract, useWriteContract, usePublicClient } from "wagmi";
import { useQuery } from "@tanstack/react-query";
import { decodeFunctionData } from "viem";
import {
  agreementFactoryAbi,
  agreementAbi,
  safeHarborRegistryAbi,
} from "@/lib/contracts/abis";
import { CONTRACTS, BATTLECHAIN_CAIP2 } from "@/lib/contracts/addresses";
import { useCallback } from "react";
import { toast } from "sonner";
import type { AgreementDetails, Contact, BountyTerms, ScopeChain, ScopeAccount } from "@/lib/contracts/types";

const factoryAddress = CONTRACTS.AgreementFactory as `0x${string}`;
const registryAddress = CONTRACTS.SafeHarborRegistry as `0x${string}`;

export function useAgreementDetails(agreementAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: agreementAddress,
    abi: agreementAbi,
    functionName: "getDetails",
    query: { enabled: !!agreementAddress },
  });
}

export function useAgreementOwner(agreementAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: agreementAddress,
    abi: agreementAbi,
    functionName: "owner",
    query: { enabled: !!agreementAddress },
  });
}

export function useIsAgreementValid(agreementAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: registryAddress,
    abi: safeHarborRegistryAbi,
    functionName: "isAgreementValid",
    args: agreementAddress ? [agreementAddress] : undefined,
    query: { enabled: !!agreementAddress },
  });
}

export function useAssetRecoveryAddress(
  agreementAddress: `0x${string}` | undefined,
  caip2ChainId = BATTLECHAIN_CAIP2
) {
  return useReadContract({
    address: agreementAddress,
    abi: agreementAbi,
    functionName: "getAssetRecoveryAddress",
    args: [caip2ChainId],
    query: { enabled: !!agreementAddress },
  });
}

export function useCreateAgreement() {
  const { writeContractAsync, isPending } = useWriteContract();

  const createAgreement = useCallback(
    async (details: AgreementDetails, owner: `0x${string}`, salt: `0x${string}`) => {
      const hash = await writeContractAsync({
        address: factoryAddress,
        abi: agreementFactoryAbi,
        functionName: "create",
        args: [
          {
            protocolName: details.protocolName,
            contactDetails: details.contactDetails.map((c) => ({
              name: c.name,
              contact: c.contact,
            })),
            chains: details.chains.map((chain) => ({
              caip2ChainId: chain.caip2ChainId,
              assetRecoveryAddress: chain.assetRecoveryAddress,
              accounts: chain.accounts.map((a) => ({
                accountAddress: a.accountAddress,
                childContractScope: a.childContractScope,
              })),
            })),
            bountyTerms: {
              bountyPercentage: details.bountyTerms.bountyPercentage,
              bountyCapUsd: details.bountyTerms.bountyCapUsd,
              retainable: details.bountyTerms.retainable,
              identity: details.bountyTerms.identity,
              diligenceRequirements: details.bountyTerms.diligenceRequirements,
              aggregateBountyCapUsd: details.bountyTerms.aggregateBountyCapUsd,
            },
            agreementURI: details.agreementURI,
          },
          owner,
          salt,
        ],
      });
      toast.success("Agreement created", {
        description: `TX: ${hash.slice(0, 10)}...`,
      });
      return hash;
    },
    [writeContractAsync]
  );

  return { createAgreement, isPending };
}

export function useExtendCommitmentWindow() {
  const { writeContractAsync, isPending } = useWriteContract();

  const extend = useCallback(
    async (agreementAddress: `0x${string}`, newCantChangeUntil: bigint) => {
      const hash = await writeContractAsync({
        address: agreementAddress,
        abi: agreementAbi,
        functionName: "extendCommitmentWindow",
        args: [newCantChangeUntil],
      });
      toast.success("Commitment window extended", {
        description: `TX: ${hash.slice(0, 10)}...`,
      });
      return hash;
    },
    [writeContractAsync]
  );

  return { extend, isPending };
}

export function useAdoptSafeHarbor() {
  const { writeContractAsync, isPending } = useWriteContract();

  const adopt = useCallback(
    async (agreementAddress: `0x${string}`) => {
      const hash = await writeContractAsync({
        address: registryAddress,
        abi: safeHarborRegistryAbi,
        functionName: "adoptSafeHarbor",
        args: [agreementAddress],
      });
      toast.success("Safe Harbor adopted", {
        description: `TX: ${hash.slice(0, 10)}...`,
      });
      return hash;
    },
    [writeContractAsync]
  );

  return { adopt, isPending };
}

export function useIsAgreementContract(address: `0x${string}` | undefined) {
  return useReadContract({
    address: factoryAddress,
    abi: agreementFactoryAbi,
    functionName: "isAgreementContract",
    args: address ? [address] : undefined,
    query: { enabled: !!address },
  });
}

/**
 * Fallback: fetch agreement details from the factory's AgreementCreated event logs
 * and decode the create() transaction input. Used when getDetails() fails.
 */
export function useAgreementDetailsFromLogs(
  agreementAddress: `0x${string}` | undefined,
  enabled = false
) {
  const client = usePublicClient();

  return useQuery({
    queryKey: ["agreement-details-logs", agreementAddress],
    queryFn: async () => {
      if (!client || !agreementAddress) return null;

      const logs = await client.getLogs({
        address: factoryAddress,
        event: {
          type: "event" as const,
          name: "AgreementCreated" as const,
          inputs: [
            { name: "agreementAddress", type: "address", indexed: true },
            { name: "owner", type: "address", indexed: true },
          ],
        },
        args: { agreementAddress },
        fromBlock: 0n,
        toBlock: "latest",
      });

      if (logs.length === 0) return null;

      const tx = await client.getTransaction({
        hash: logs[0].transactionHash,
      });

      const { args } = decodeFunctionData({
        abi: agreementFactoryAbi,
        data: tx.input,
      });

      // create(details, owner, salt)
      return { details: args[0], owner: args[1] as `0x${string}` };
    },
    enabled: enabled && !!agreementAddress && !!client,
  });
}

// --- New read hooks ---

export function useIsContractInScope(
  agreementAddress: `0x${string}` | undefined,
  contractAddress: `0x${string}` | undefined
) {
  return useReadContract({
    address: agreementAddress,
    abi: agreementAbi,
    functionName: "isContractInScope",
    args: contractAddress ? [contractAddress] : undefined,
    query: { enabled: !!agreementAddress && !!contractAddress },
  });
}

export function useCommitmentWindowEnd(agreementAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: agreementAddress,
    abi: agreementAbi,
    functionName: "getCantChangeUntil",
    query: { enabled: !!agreementAddress },
  });
}

export function useChainIds(agreementAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: agreementAddress,
    abi: agreementAbi,
    functionName: "getChainIds",
    query: { enabled: !!agreementAddress },
  });
}

export function useBattleChainScopeAddresses(agreementAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: agreementAddress,
    abi: agreementAbi,
    functionName: "getBattleChainScopeAddresses",
    query: { enabled: !!agreementAddress },
  });
}

export function useBattleChainScopeCount(agreementAddress: `0x${string}` | undefined) {
  return useReadContract({
    address: agreementAddress,
    abi: agreementAbi,
    functionName: "getBattleChainScopeCount",
    query: { enabled: !!agreementAddress },
  });
}

// --- New write hooks ---

export function useSetProtocolName() {
  const { writeContractAsync, isPending } = useWriteContract();

  const setProtocolName = useCallback(
    async (agreementAddress: `0x${string}`, name: string) => {
      const hash = await writeContractAsync({
        address: agreementAddress,
        abi: agreementAbi,
        functionName: "setProtocolName",
        args: [name],
      });
      toast.success("Protocol name updated", {
        description: `TX: ${hash.slice(0, 10)}...`,
      });
      return hash;
    },
    [writeContractAsync]
  );

  return { setProtocolName, isPending };
}

export function useSetContactDetails() {
  const { writeContractAsync, isPending } = useWriteContract();

  const setContactDetails = useCallback(
    async (agreementAddress: `0x${string}`, contacts: Contact[]) => {
      const hash = await writeContractAsync({
        address: agreementAddress,
        abi: agreementAbi,
        functionName: "setContactDetails",
        args: [contacts.map((c) => ({ name: c.name, contact: c.contact }))],
      });
      toast.success("Contact details updated", {
        description: `TX: ${hash.slice(0, 10)}...`,
      });
      return hash;
    },
    [writeContractAsync]
  );

  return { setContactDetails, isPending };
}

export function useSetBountyTerms() {
  const { writeContractAsync, isPending } = useWriteContract();

  const setBountyTerms = useCallback(
    async (agreementAddress: `0x${string}`, terms: BountyTerms) => {
      const hash = await writeContractAsync({
        address: agreementAddress,
        abi: agreementAbi,
        functionName: "setBountyTerms",
        args: [
          {
            bountyPercentage: terms.bountyPercentage,
            bountyCapUsd: terms.bountyCapUsd,
            retainable: terms.retainable,
            identity: terms.identity,
            diligenceRequirements: terms.diligenceRequirements,
            aggregateBountyCapUsd: terms.aggregateBountyCapUsd,
          },
        ],
      });
      toast.success("Bounty terms updated", {
        description: `TX: ${hash.slice(0, 10)}...`,
      });
      return hash;
    },
    [writeContractAsync]
  );

  return { setBountyTerms, isPending };
}

export function useSetAgreementURI() {
  const { writeContractAsync, isPending } = useWriteContract();

  const setAgreementURI = useCallback(
    async (agreementAddress: `0x${string}`, uri: string) => {
      const hash = await writeContractAsync({
        address: agreementAddress,
        abi: agreementAbi,
        functionName: "setAgreementURI",
        args: [uri],
      });
      toast.success("Agreement URI updated", {
        description: `TX: ${hash.slice(0, 10)}...`,
      });
      return hash;
    },
    [writeContractAsync]
  );

  return { setAgreementURI, isPending };
}

export function useAddOrSetChains() {
  const { writeContractAsync, isPending } = useWriteContract();

  const addOrSetChains = useCallback(
    async (agreementAddress: `0x${string}`, chains: ScopeChain[]) => {
      const hash = await writeContractAsync({
        address: agreementAddress,
        abi: agreementAbi,
        functionName: "addOrSetChains",
        args: [
          chains.map((c) => ({
            assetRecoveryAddress: c.assetRecoveryAddress,
            accounts: c.accounts.map((a) => ({
              accountAddress: a.accountAddress,
              childContractScope: a.childContractScope,
            })),
            caip2ChainId: c.caip2ChainId,
          })),
        ],
      });
      toast.success("Chains updated", {
        description: `TX: ${hash.slice(0, 10)}...`,
      });
      return hash;
    },
    [writeContractAsync]
  );

  return { addOrSetChains, isPending };
}

export function useAddAccounts() {
  const { writeContractAsync, isPending } = useWriteContract();

  const addAccounts = useCallback(
    async (
      agreementAddress: `0x${string}`,
      caip2ChainId: string,
      accounts: ScopeAccount[]
    ) => {
      const hash = await writeContractAsync({
        address: agreementAddress,
        abi: agreementAbi,
        functionName: "addAccounts",
        args: [
          caip2ChainId,
          accounts.map((a) => ({
            accountAddress: a.accountAddress,
            childContractScope: a.childContractScope,
          })),
        ],
      });
      toast.success("Accounts added", {
        description: `TX: ${hash.slice(0, 10)}...`,
      });
      return hash;
    },
    [writeContractAsync]
  );

  return { addAccounts, isPending };
}

export function useRemoveAccounts() {
  const { writeContractAsync, isPending } = useWriteContract();

  const removeAccounts = useCallback(
    async (
      agreementAddress: `0x${string}`,
      caip2ChainId: string,
      accountAddresses: string[]
    ) => {
      const hash = await writeContractAsync({
        address: agreementAddress,
        abi: agreementAbi,
        functionName: "removeAccounts",
        args: [caip2ChainId, accountAddresses],
      });
      toast.success("Accounts removed", {
        description: `TX: ${hash.slice(0, 10)}...`,
      });
      return hash;
    },
    [writeContractAsync]
  );

  return { removeAccounts, isPending };
}

export function useRemoveChains() {
  const { writeContractAsync, isPending } = useWriteContract();

  const removeChains = useCallback(
    async (agreementAddress: `0x${string}`, caip2ChainIds: string[]) => {
      const hash = await writeContractAsync({
        address: agreementAddress,
        abi: agreementAbi,
        functionName: "removeChains",
        args: [caip2ChainIds],
      });
      toast.success("Chains removed", {
        description: `TX: ${hash.slice(0, 10)}...`,
      });
      return hash;
    },
    [writeContractAsync]
  );

  return { removeChains, isPending };
}

export function useTransferOwnership() {
  const { writeContractAsync, isPending } = useWriteContract();

  const transferOwnership = useCallback(
    async (agreementAddress: `0x${string}`, newOwner: `0x${string}`) => {
      const hash = await writeContractAsync({
        address: agreementAddress,
        abi: agreementAbi,
        functionName: "transferOwnership",
        args: [newOwner],
      });
      toast.success("Ownership transfer initiated", {
        description: `TX: ${hash.slice(0, 10)}...`,
      });
      return hash;
    },
    [writeContractAsync]
  );

  return { transferOwnership, isPending };
}

export function useRenounceOwnership() {
  const { writeContractAsync, isPending } = useWriteContract();

  const renounceOwnership = useCallback(
    async (agreementAddress: `0x${string}`) => {
      const hash = await writeContractAsync({
        address: agreementAddress,
        abi: agreementAbi,
        functionName: "renounceOwnership",
      });
      toast.success("Ownership renounced", {
        description: `TX: ${hash.slice(0, 10)}...`,
      });
      return hash;
    },
    [writeContractAsync]
  );

  return { renounceOwnership, isPending };
}
