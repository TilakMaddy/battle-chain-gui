"use client";

import { useReadContract, useWriteContract } from "wagmi";
import {
  agreementFactoryAbi,
  agreementAbi,
  safeHarborRegistryAbi,
} from "@/lib/contracts/abis";
import { CONTRACTS, BATTLECHAIN_CAIP2 } from "@/lib/contracts/addresses";
import { useCallback } from "react";
import { toast } from "sonner";
import type { AgreementDetails } from "@/lib/contracts/types";

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
