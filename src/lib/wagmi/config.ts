"use client";

import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { battlechain } from "./chains";

export const config = getDefaultConfig({
  appName: "BattleChain GUI",
  projectId: "battlechain-gui-local",
  chains: [battlechain],
  ssr: true,
});
