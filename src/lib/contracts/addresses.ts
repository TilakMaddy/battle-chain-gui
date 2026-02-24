export const CONTRACTS = {
  AttackRegistry: process.env.NEXT_PUBLIC_ATTACK_REGISTRY!,
  SafeHarborRegistry: process.env.NEXT_PUBLIC_SAFE_HARBOR_REGISTRY!,
  AgreementFactory: process.env.NEXT_PUBLIC_AGREEMENT_FACTORY!,
  BattleChainDeployer: process.env.NEXT_PUBLIC_BATTLECHAIN_DEPLOYER!,
} as const;

export const BATTLECHAIN_CAIP2 = "eip155:627";
