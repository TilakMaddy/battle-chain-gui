"use client";

import { Badge } from "@/components/ui/badge";
import {
  ContractState,
  CONTRACT_STATE_LABELS,
} from "@/lib/contracts/types";

const stateVariants: Record<ContractState, string> = {
  [ContractState.NOT_DEPLOYED]: "bg-gray-500/20 text-gray-400 border-gray-500/30",
  [ContractState.NEW_DEPLOYMENT]: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  [ContractState.ATTACK_REQUESTED]: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  [ContractState.UNDER_ATTACK]: "bg-red-500/20 text-red-400 border-red-500/30",
  [ContractState.PROMOTION_REQUESTED]: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  [ContractState.PRODUCTION]: "bg-green-500/20 text-green-400 border-green-500/30",
  [ContractState.CORRUPTED]: "bg-red-900/20 text-red-300 border-red-900/30",
};

export function StateBadge({ state }: { state: ContractState }) {
  return (
    <Badge variant="outline" className={stateVariants[state]}>
      {CONTRACT_STATE_LABELS[state]}
    </Badge>
  );
}
