function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env variable: ${name}`);
  return value;
}

export const CONTRACTS = {
  AttackRegistry: requireEnv("NEXT_PUBLIC_ATTACK_REGISTRY"),
  SafeHarborRegistry: requireEnv("NEXT_PUBLIC_SAFE_HARBOR_REGISTRY"),
  AgreementFactory: requireEnv("NEXT_PUBLIC_AGREEMENT_FACTORY"),
  BattleChainDeployer: requireEnv("NEXT_PUBLIC_BATTLECHAIN_DEPLOYER"),
} as const;

export const BATTLECHAIN_CAIP2 = "eip155:627";
