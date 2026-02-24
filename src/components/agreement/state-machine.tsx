"use client";

import { ContractState, CONTRACT_STATE_LABELS } from "@/lib/contracts/types";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

const stateVariants: Record<ContractState, { bg: string; ring: string; text: string }> = {
  [ContractState.NOT_DEPLOYED]: {
    bg: "bg-gray-500/20",
    ring: "ring-gray-500",
    text: "text-gray-400",
  },
  [ContractState.NEW_DEPLOYMENT]: {
    bg: "bg-blue-500/20",
    ring: "ring-blue-500",
    text: "text-blue-400",
  },
  [ContractState.ATTACK_REQUESTED]: {
    bg: "bg-yellow-500/20",
    ring: "ring-yellow-500",
    text: "text-yellow-400",
  },
  [ContractState.UNDER_ATTACK]: {
    bg: "bg-red-500/20",
    ring: "ring-red-500",
    text: "text-red-400",
  },
  [ContractState.PROMOTION_REQUESTED]: {
    bg: "bg-purple-500/20",
    ring: "ring-purple-500",
    text: "text-purple-400",
  },
  [ContractState.PRODUCTION]: {
    bg: "bg-green-500/20",
    ring: "ring-green-500",
    text: "text-green-400",
  },
  [ContractState.CORRUPTED]: {
    bg: "bg-red-900/20",
    ring: "ring-red-900",
    text: "text-red-300",
  },
};

/** The main linear flow path (top row). */
const mainFlow: ContractState[] = [
  ContractState.NOT_DEPLOYED,
  ContractState.NEW_DEPLOYMENT,
  ContractState.ATTACK_REQUESTED,
  ContractState.UNDER_ATTACK,
  ContractState.PROMOTION_REQUESTED,
  ContractState.PRODUCTION,
];

/** Actions available per state (only shown if isOwner). */
const stateActions: Partial<Record<ContractState, { label: string; action: string; variant?: "default" | "destructive" | "outline" }[]>> = {
  [ContractState.NEW_DEPLOYMENT]: [
    { label: "Request Attack", action: "requestAttack" },
    { label: "Go to Production", action: "goToProduction", variant: "outline" },
  ],
  [ContractState.UNDER_ATTACK]: [
    { label: "Request Promotion", action: "requestPromotion", variant: "outline" },
    { label: "Mark Corrupted", action: "markCorrupted", variant: "destructive" },
  ],
  [ContractState.PROMOTION_REQUESTED]: [
    { label: "Cancel Promotion", action: "cancelPromotion", variant: "outline" },
    { label: "Promote", action: "promote" },
  ],
};

interface StateMachineProps {
  currentState: ContractState;
  isOwner: boolean;
  onAction: (action: string) => void;
  isPending?: boolean;
}

function StateNode({
  state,
  isCurrent,
}: {
  state: ContractState;
  isCurrent: boolean;
}) {
  const v = stateVariants[state];
  return (
    <div className="flex flex-col items-center gap-1">
      <div
        className={`
          rounded-lg px-3 py-2 text-xs font-medium text-center whitespace-nowrap
          ${v.bg} ${v.text}
          ${isCurrent ? `ring-2 ${v.ring} shadow-lg shadow-${v.ring}/20` : "opacity-50"}
        `}
      >
        {CONTRACT_STATE_LABELS[state]}
      </div>
    </div>
  );
}

function Connector({ active }: { active: boolean }) {
  return (
    <div className="flex items-center">
      <div
        className={`h-0.5 w-6 ${active ? "bg-muted-foreground" : "bg-muted-foreground/30"}`}
      />
      <div
        className={`h-0 w-0 border-y-[4px] border-y-transparent border-l-[6px] ${
          active ? "border-l-muted-foreground" : "border-l-muted-foreground/30"
        }`}
      />
    </div>
  );
}

export function StateMachine({
  currentState,
  isOwner,
  onAction,
  isPending = false,
}: StateMachineProps) {
  const currentIndex = mainFlow.indexOf(currentState);
  const actions = isOwner ? stateActions[currentState] : undefined;

  return (
    <div className="space-y-4">
      {/* Main flow row */}
      <div className="flex items-center overflow-x-auto pb-2">
        {mainFlow.map((state, i) => (
          <div key={state} className="flex items-center">
            <StateNode state={state} isCurrent={currentState === state} />
            {i < mainFlow.length - 1 && (
              <Connector active={i < currentIndex} />
            )}
          </div>
        ))}
      </div>

      {/* Corrupted branch (shown below UNDER_ATTACK) */}
      <div className="flex items-center pl-2">
        {/* Spacer to align under UNDER_ATTACK node */}
        <div className="flex items-center">
          {mainFlow.slice(0, 3).map((state, i) => (
            <div key={state} className="flex items-center">
              <div className="px-3 py-2 invisible text-xs whitespace-nowrap">
                {CONTRACT_STATE_LABELS[state]}
              </div>
              {i < 2 && (
                <div className="flex items-center invisible">
                  <div className="h-0.5 w-6" />
                  <div className="h-0 w-0 border-y-[4px] border-l-[6px]" />
                </div>
              )}
            </div>
          ))}
          {/* Vertical connector from UNDER_ATTACK */}
          <div className="flex flex-col items-center">
            <div
              className={`w-0.5 h-4 ${
                currentState === ContractState.CORRUPTED
                  ? "bg-muted-foreground"
                  : "bg-muted-foreground/30"
              }`}
            />
            <StateNode
              state={ContractState.CORRUPTED}
              isCurrent={currentState === ContractState.CORRUPTED}
            />
          </div>
        </div>
      </div>

      {/* Action buttons */}
      {actions && actions.length > 0 && (
        <div className="flex flex-wrap gap-2 pt-1">
          {actions.map((a) => (
            <Button
              key={a.action}
              variant={a.variant ?? "default"}
              size="sm"
              disabled={isPending}
              onClick={() => onAction(a.action)}
            >
              {isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
              {a.label}
            </Button>
          ))}
        </div>
      )}

      {/* Informational labels for waiting states */}
      {currentState === ContractState.ATTACK_REQUESTED && (
        <p className="text-xs text-yellow-400">Awaiting DAO review...</p>
      )}
      {currentState === ContractState.CORRUPTED && (
        <p className="text-xs text-red-400">Terminal state -- this agreement is corrupted.</p>
      )}
    </div>
  );
}
