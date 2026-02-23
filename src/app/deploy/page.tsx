"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { ChainGuard } from "@/components/web3/chain-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useDeployCreate, useDeployCreate2 } from "@/lib/hooks/use-deployer";
import { Rocket, CheckCircle, Loader2 } from "lucide-react";

type Step = "configure" | "deploy" | "complete";

export default function DeployPage() {
  return (
    <ChainGuard>
      <DeployContent />
    </ChainGuard>
  );
}

function DeployContent() {
  const { address } = useAccount();
  const [step, setStep] = useState<Step>("configure");
  const [bytecode, setBytecode] = useState("");
  const [salt, setSalt] = useState("");
  const [useCreate2, setUseCreate2] = useState(false);
  const [txHash, setTxHash] = useState("");

  const deployCreate = useDeployCreate();
  const deployCreate2 = useDeployCreate2();
  const isPending = deployCreate.isPending || deployCreate2.isPending;

  const handleDeploy = async () => {
    try {
      setStep("deploy");
      let hash: string;
      if (useCreate2 && salt) {
        hash = await deployCreate2.deploy(
          salt as `0x${string}`,
          bytecode as `0x${string}`
        );
      } else {
        hash = await deployCreate.deploy(bytecode as `0x${string}`);
      }
      setTxHash(hash);
      setStep("complete");
    } catch (err) {
      console.error(err);
      setStep("configure");
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Deploy Contract"
        description="Deploy contracts through BattleChainDeployer for automatic AttackRegistry registration"
      />

      {/* Step Indicator */}
      <div className="flex items-center gap-4">
        {["Configure", "Deploy", "Complete"].map((label, i) => {
          const stepMap: Step[] = ["configure", "deploy", "complete"];
          const idx = stepMap.indexOf(step);
          return (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                  i <= idx
                    ? "bg-red-600 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </div>
              <span className={i <= idx ? "font-medium" : "text-muted-foreground"}>
                {label}
              </span>
              {i < 2 && <Separator className="w-12" />}
            </div>
          );
        })}
      </div>

      {step === "configure" && (
        <Card>
          <CardHeader>
            <CardTitle>Contract Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="space-y-2">
              <Label>Contract Bytecode</Label>
              <textarea
                className="flex min-h-[120px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                placeholder="0x608060405234801561001057..."
                value={bytecode}
                onChange={(e) => setBytecode(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Paste compiled contract bytecode (with constructor args encoded if needed).
              </p>
            </div>

            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="create2"
                checked={useCreate2}
                onChange={(e) => setUseCreate2(e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="create2">Use CREATE2 (deterministic address)</Label>
            </div>

            {useCreate2 && (
              <div className="space-y-2">
                <Label>Salt (bytes32)</Label>
                <Input
                  placeholder="0x0000000000000000000000000000000000000000000000000000000000000001"
                  value={salt}
                  onChange={(e) => setSalt(e.target.value)}
                  className="font-mono"
                />
              </div>
            )}

            <div className="rounded-lg border p-4 bg-muted/50">
              <p className="text-sm font-medium">Deploying as:</p>
              <p className="font-mono text-sm text-muted-foreground mt-1">{address}</p>
            </div>

            <Button
              onClick={handleDeploy}
              disabled={!bytecode.startsWith("0x") || isPending}
              className="w-full bg-red-600 hover:bg-red-700"
            >
              <Rocket className="mr-2 h-4 w-4" />
              Deploy via BattleChainDeployer
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "deploy" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-12 w-12 animate-spin text-red-500" />
            <p className="text-lg font-medium">Deploying contract...</p>
            <p className="text-sm text-muted-foreground">
              Confirm the transaction in your wallet.
            </p>
          </CardContent>
        </Card>
      )}

      {step === "complete" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <p className="text-lg font-medium">Contract Deployed!</p>
            <div className="rounded-lg border p-4 bg-muted/50 w-full max-w-lg">
              <p className="text-sm font-medium mb-1">Transaction Hash:</p>
              <p className="font-mono text-sm break-all text-blue-400">{txHash}</p>
            </div>
            <p className="text-sm text-muted-foreground">
              Your contract is now registered with the AttackRegistry.
            </p>
            <Button variant="outline" onClick={() => { setStep("configure"); setBytecode(""); setTxHash(""); }}>
              Deploy Another
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
