import { defineChain } from "viem";

const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL ?? "https://testnet.battlechain.com:3051";
const explorerUrl = process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://explorer.testnet.battlechain.com";
const chainId = Number(process.env.NEXT_PUBLIC_CHAIN_ID ?? 627);

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
