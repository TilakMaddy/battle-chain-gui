"use client";

import { useWriteContract, usePublicClient, useReadContract } from "wagmi";
import { decodeEventLog } from "viem";
import { battleChainDeployerAbi } from "@/lib/contracts/abis";
import { attackRegistryAbi } from "@/lib/contracts/abis";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { useCallback } from "react";

const deployerAddress = CONTRACTS.BattleChainDeployer as `0x${string}`;
const registryAddress = CONTRACTS.AttackRegistry as `0x${string}`;

/** Parse the deployed contract address from AgreementStateChanged logs in the receipt. */
function parseDeployedAddress(
  logs: { address: string; topics: string[]; data: string }[]
): `0x${string}` | null {
  for (const log of logs) {
    if (log.address.toLowerCase() !== registryAddress.toLowerCase()) continue;
    try {
      const decoded = decodeEventLog({
        abi: attackRegistryAbi,
        data: log.data as `0x${string}`,
        topics: log.topics as [`0x${string}`, ...`0x${string}`[]],
      });
      if (decoded.eventName === "AgreementStateChanged") {
        return (decoded.args as { agreementAddress: `0x${string}` }).agreementAddress;
      }
    } catch {
      // not the event we're looking for
    }
  }
  return null;
}

export interface DeployResult {
  hash: `0x${string}`;
  deployedAddress: `0x${string}` | null;
  status: "success" | "reverted";
}

export function useDeployCreate() {
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient();

  const deploy = useCallback(
    async (bytecode: `0x${string}`): Promise<DeployResult> => {
      const hash = await writeContractAsync({
        address: deployerAddress,
        abi: battleChainDeployerAbi,
        functionName: "deployCreate",
        args: [bytecode],
      });

      if (!publicClient) throw new Error("No public client");

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const deployedAddress = parseDeployedAddress(receipt.logs as never[]);

      return {
        hash,
        deployedAddress,
        status: receipt.status === "success" ? "success" : "reverted",
      };
    },
    [writeContractAsync, publicClient]
  );

  return { deploy, isPending };
}

export function useDeployCreate2() {
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient();

  const deploy = useCallback(
    async (salt: `0x${string}`, bytecode: `0x${string}`): Promise<DeployResult> => {
      const hash = await writeContractAsync({
        address: deployerAddress,
        abi: battleChainDeployerAbi,
        functionName: "deployCreate2",
        args: [salt, bytecode],
      });

      if (!publicClient) throw new Error("No public client");

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const deployedAddress = parseDeployedAddress(receipt.logs as never[]);

      return {
        hash,
        deployedAddress,
        status: receipt.status === "success" ? "success" : "reverted",
      };
    },
    [writeContractAsync, publicClient]
  );

  return { deploy, isPending };
}

// --- New hooks ---

export function useDeployCreate3() {
  const { writeContractAsync, isPending } = useWriteContract();
  const publicClient = usePublicClient();

  const deploy = useCallback(
    async (salt: `0x${string}`, bytecode: `0x${string}`): Promise<DeployResult> => {
      const hash = await writeContractAsync({
        address: deployerAddress,
        abi: battleChainDeployerAbi,
        functionName: "deployCreate3",
        args: [salt, bytecode],
      });

      if (!publicClient) throw new Error("No public client");

      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const deployedAddress = parseDeployedAddress(receipt.logs as never[]);

      return {
        hash,
        deployedAddress,
        status: receipt.status === "success" ? "success" : "reverted",
      };
    },
    [writeContractAsync, publicClient]
  );

  return { deploy, isPending };
}

export function useComputeCreateAddress(nonce: bigint | undefined) {
  return useReadContract({
    address: deployerAddress,
    abi: battleChainDeployerAbi,
    functionName: "computeCreateAddress",
    args: nonce !== undefined ? [nonce] : undefined,
    query: { enabled: nonce !== undefined },
  });
}

export function useComputeCreate2Address(
  salt: `0x${string}` | undefined,
  initCodeHash: `0x${string}` | undefined
) {
  return useReadContract({
    address: deployerAddress,
    abi: battleChainDeployerAbi,
    functionName: "computeCreate2Address",
    args: salt && initCodeHash ? [salt, initCodeHash] : undefined,
    query: { enabled: !!salt && !!initCodeHash },
  });
}

export function useComputeCreate3Address(salt: `0x${string}` | undefined) {
  return useReadContract({
    address: deployerAddress,
    abi: battleChainDeployerAbi,
    functionName: "computeCreate3Address",
    args: salt ? [salt] : undefined,
    query: { enabled: !!salt },
  });
}
