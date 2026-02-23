"use client";

import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { battlechain } from "@/lib/wagmi/chains";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Wifi } from "lucide-react";

export function ChainGuard({ children }: { children: React.ReactNode }) {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();

  if (!isConnected) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
              <Shield className="h-8 w-8 text-red-500" />
            </div>
            <CardTitle className="text-2xl">Connect Wallet</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Connect your wallet to interact with BattleChain.
            </p>
            <ConnectButton />
          </CardContent>
        </Card>
      </div>
    );
  }

  if (chainId !== battlechain.id) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-yellow-500/10">
              <Wifi className="h-8 w-8 text-yellow-500" />
            </div>
            <CardTitle className="text-2xl">Wrong Network</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Please switch to the BattleChain Testnet (Chain ID: {battlechain.id}).
            </p>
            <Button
              onClick={() => switchChain({ chainId: battlechain.id })}
              className="bg-red-600 hover:bg-red-700"
            >
              Switch to BattleChain
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}
