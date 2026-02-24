import { defineChain } from "viem";

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing required env variable: ${name}`);
  return value;
}

const rpcUrl = requireEnv("NEXT_PUBLIC_RPC_URL");
const explorerUrl = requireEnv("NEXT_PUBLIC_EXPLORER_URL");
const chainId = Number(requireEnv("NEXT_PUBLIC_CHAIN_ID"));

export const battlechain = defineChain({
  id: chainId,
  name: "BattleChain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: [rpcUrl] },
  },
  blockExplorers: {
    default: { name: "BattleChain Explorer", url: explorerUrl },
  },
  testnet: true,
});
