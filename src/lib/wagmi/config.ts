"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { battlechain } from "./chains";

export const config = getDefaultConfig({
  appName: "BattleChain GUI",
  projectId: "battlechain-gui-local",
  chains: [battlechain],
  transports: {
    [battlechain.id]: http(process.env.NEXT_PUBLIC_RPC_URL, {
      batch: true,
      retryCount: 3,
      timeout: 10_000,
    }),
  },
  ssr: true,
});
