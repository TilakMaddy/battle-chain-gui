"use client";

import { useWriteContract } from "wagmi";
import { battleChainDeployerAbi } from "@/lib/contracts/abis";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { useCallback } from "react";
import { toast } from "sonner";

const deployerAddress = CONTRACTS.BattleChainDeployer as `0x${string}`;

export function useDeployCreate() {
  const { writeContractAsync, isPending } = useWriteContract();

  const deploy = useCallback(
    async (bytecode: `0x${string}`) => {
      const hash = await writeContractAsync({
        address: deployerAddress,
        abi: battleChainDeployerAbi,
        functionName: "deployCreate",
        args: [bytecode],
      });
      toast.success("Contract deployed via CREATE", {
        description: `TX: ${hash.slice(0, 10)}...`,
      });
      return hash;
    },
    [writeContractAsync]
  );

  return { deploy, isPending };
}

export function useDeployCreate2() {
  const { writeContractAsync, isPending } = useWriteContract();

  const deploy = useCallback(
    async (salt: `0x${string}`, bytecode: `0x${string}`) => {
      const hash = await writeContractAsync({
        address: deployerAddress,
        abi: battleChainDeployerAbi,
        functionName: "deployCreate2",
        args: [salt, bytecode],
      });
      toast.success("Contract deployed via CREATE2", {
        description: `TX: ${hash.slice(0, 10)}...`,
      });
      return hash;
    },
    [writeContractAsync]
  );

  return { deploy, isPending };
}
