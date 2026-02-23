import { defineChain } from "viem";

export const battlechain = defineChain({
  id: 627,
  name: "BattleChain Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet.battlechain.com:3051"] },
  },
  blockExplorers: {
    default: { name: "BattleChain Explorer", url: "https://testnet.battlechain.com" },
  },
  testnet: true,
});
