export enum ContractState {
  NOT_DEPLOYED = 0,
  NEW_DEPLOYMENT = 1,
  ATTACK_REQUESTED = 2,
  UNDER_ATTACK = 3,
  PROMOTION_REQUESTED = 4,
  PRODUCTION = 5,
  CORRUPTED = 6,
}

export const CONTRACT_STATE_LABELS: Record<ContractState, string> = {
  [ContractState.NOT_DEPLOYED]: "Not Deployed",
  [ContractState.NEW_DEPLOYMENT]: "New Deployment",
  [ContractState.ATTACK_REQUESTED]: "Attack Requested",
  [ContractState.UNDER_ATTACK]: "Under Attack",
  [ContractState.PROMOTION_REQUESTED]: "Promotion Requested",
  [ContractState.PRODUCTION]: "Production",
  [ContractState.CORRUPTED]: "Corrupted",
};

export const CONTRACT_STATE_COLORS: Record<ContractState, string> = {
  [ContractState.NOT_DEPLOYED]: "bg-gray-500",
  [ContractState.NEW_DEPLOYMENT]: "bg-blue-500",
  [ContractState.ATTACK_REQUESTED]: "bg-yellow-500",
  [ContractState.UNDER_ATTACK]: "bg-red-500",
  [ContractState.PROMOTION_REQUESTED]: "bg-purple-500",
  [ContractState.PRODUCTION]: "bg-green-500",
  [ContractState.CORRUPTED]: "bg-red-900",
};

export enum ChildContractScope {
  None = 0,
  ExistingOnly = 1,
  All = 2,
  FutureOnly = 3,
}

export enum IdentityRequirements {
  Anonymous = 0,
  Pseudonymous = 1,
  Named = 2,
}

export const IDENTITY_LABELS: Record<IdentityRequirements, string> = {
  [IdentityRequirements.Anonymous]: "Anonymous",
  [IdentityRequirements.Pseudonymous]: "Pseudonymous",
  [IdentityRequirements.Named]: "Named",
};

export const CHILD_SCOPE_LABELS: Record<ChildContractScope, string> = {
  [ChildContractScope.None]: "None",
  [ChildContractScope.ExistingOnly]: "Existing Only",
  [ChildContractScope.All]: "All",
  [ChildContractScope.FutureOnly]: "Future Only",
};

export interface Contact {
  name: string;
  contact: string;
}

export interface ScopeAccount {
  accountAddress: string;
  childContractScope: ChildContractScope;
}

export interface ScopeChain {
  assetRecoveryAddress: string;
  accounts: ScopeAccount[];
  caip2ChainId: string;
}

export interface BountyTerms {
  bountyPercentage: bigint;
  bountyCapUsd: bigint;
  retainable: boolean;
  identity: IdentityRequirements;
  diligenceRequirements: string;
  aggregateBountyCapUsd: bigint;
}

export interface AgreementDetails {
  protocolName: string;
  contactDetails: Contact[];
  chains: ScopeChain[];
  bountyTerms: BountyTerms;
  agreementURI: string;
}
