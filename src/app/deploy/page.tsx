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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDeployCreate, useDeployCreate2 } from "@/lib/hooks/use-deployer";
import { SAMPLE_CONTRACTS } from "@/lib/contracts/samples";
import { Rocket, CheckCircle, Loader2, Code, FileCode, Terminal, ExternalLink } from "lucide-react";
import Link from "next/link";

type Step = "configure" | "signing" | "confirming" | "complete" | "failed";

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
  const [deployedAddress, setDeployedAddress] = useState("");
  const [deployError, setDeployError] = useState("");

  // Sample contract state
  const [selectedSample, setSelectedSample] = useState("");
  const [sampleSource, setSampleSource] = useState("");

  // Custom Solidity state
  const [customSource, setCustomSource] = useState("");
  const [contractName, setContractName] = useState("");
  const [compiling, setCompiling] = useState(false);
  const [compileError, setCompileError] = useState("");

  const deployCreate = useDeployCreate();
  const deployCreate2 = useDeployCreate2();
  const isPending = deployCreate.isPending || deployCreate2.isPending;

  const handleSelectSample = (sampleId: string) => {
    const sample = SAMPLE_CONTRACTS.find((s) => s.id === sampleId);
    if (!sample) return;
    setSelectedSample(sampleId);
    setSampleSource(sample.source);
    setBytecode(sample.bytecode);
  };

  const handleCompile = async () => {
    if (!customSource.trim() || !contractName.trim()) return;
    setCompiling(true);
    setCompileError("");
    try {
      const res = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source: customSource, contractName }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCompileError(data.error || "Compilation failed");
        return;
      }
      setBytecode(data.bytecode);
    } catch {
      setCompileError("Failed to reach compile server");
    } finally {
      setCompiling(false);
    }
  };

  const handleDeploy = async () => {
    try {
      setDeployError("");
      setStep("signing");

      const result = useCreate2 && salt
        ? await deployCreate2.deploy(salt as `0x${string}`, bytecode as `0x${string}`)
        : await deployCreate.deploy(bytecode as `0x${string}`);

      // If we get here, wallet signed and receipt came back
      setTxHash(result.hash);

      if (result.status === "reverted") {
        setDeployError("Transaction reverted on-chain");
        setStep("failed");
        return;
      }

      setDeployedAddress(result.deployedAddress ?? "");

      // Save to local DB
      if (result.deployedAddress && address) {
        const sampleName = SAMPLE_CONTRACTS.find((s) => s.id === selectedSample)?.name;
        fetch("/api/deployments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contract_address: result.deployedAddress,
            tx_hash: result.hash,
            deployer: address,
            label: sampleName || contractName || "",
          }),
        }).catch(console.error);
      }

      setStep("complete");
    } catch (err) {
      console.error(err);
      setDeployError(err instanceof Error ? err.message : "Transaction failed");
      setStep("failed");
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
        {["Configure", "Deploying", "Complete"].map((label, i) => {
          const stepIdx = step === "configure" ? 0
            : step === "signing" || step === "confirming" ? 1
            : step === "complete" ? 2
            : step === "failed" ? 1
            : 0;
          return (
            <div key={label} className="flex items-center gap-2">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold ${
                  i <= stepIdx
                    ? step === "failed" && i === 1 ? "bg-red-900 text-white" : "bg-red-600 text-white"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {i + 1}
              </div>
              <span className={i <= stepIdx ? "font-medium" : "text-muted-foreground"}>
                {label}
              </span>
              {i < 2 && <Separator className="w-12" />}
            </div>
          );
        })}
      </div>

      {step === "configure" && (
        <div className="space-y-6">
          {/* Bytecode Source Tabs */}
          <Card>
            <CardHeader>
              <CardTitle>Contract Source</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="samples" onValueChange={() => setCompileError("")}>
                <TabsList>
                  <TabsTrigger value="samples">
                    <FileCode className="mr-1.5 h-3.5 w-3.5" />
                    Samples
                  </TabsTrigger>
                  <TabsTrigger value="custom">
                    <Code className="mr-1.5 h-3.5 w-3.5" />
                    Custom Solidity
                  </TabsTrigger>
                  <TabsTrigger value="raw">
                    <Terminal className="mr-1.5 h-3.5 w-3.5" />
                    Raw Bytecode
                  </TabsTrigger>
                </TabsList>

                {/* Sample Contracts Tab */}
                <TabsContent value="samples" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Choose a sample contract</Label>
                    <Select value={selectedSample} onValueChange={handleSelectSample}>
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Select a contract..." />
                      </SelectTrigger>
                      <SelectContent>
                        {SAMPLE_CONTRACTS.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name} — {s.description}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {sampleSource && (
                    <div className="space-y-2">
                      <Label>Source Code</Label>
                      <pre className="max-h-[400px] overflow-auto rounded-md border bg-muted/50 p-4 text-xs font-mono">
                        {sampleSource}
                      </pre>
                    </div>
                  )}

                  {bytecode && selectedSample && (
                    <div className="space-y-2">
                      <Label>Bytecode (auto-populated)</Label>
                      <div className="max-h-[100px] overflow-auto rounded-md border bg-muted/50 p-3 text-xs font-mono break-all text-muted-foreground">
                        {bytecode}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Custom Solidity Tab */}
                <TabsContent value="custom" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Contract Name</Label>
                    <Input
                      placeholder="MyContract"
                      value={contractName}
                      onChange={(e) => setContractName(e.target.value)}
                      className="font-mono"
                    />
                    <p className="text-xs text-muted-foreground">
                      Must match the contract name in your Solidity code.
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label>Solidity Source</Label>
                    <textarea
                      className="flex min-h-[300px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      placeholder={`// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\ncontract MyContract {\n    // ...\n}`}
                      value={customSource}
                      onChange={(e) => setCustomSource(e.target.value)}
                    />
                  </div>

                  {compileError && (
                    <div className="rounded-md border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400 font-mono whitespace-pre-wrap">
                      {compileError}
                    </div>
                  )}

                  <Button
                    onClick={handleCompile}
                    disabled={!customSource.trim() || !contractName.trim() || compiling}
                    variant="outline"
                    className="w-full"
                  >
                    {compiling ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Code className="mr-2 h-4 w-4" />
                    )}
                    {compiling ? "Compiling..." : "Compile with Forge"}
                  </Button>

                  {bytecode && !compileError && customSource && (
                    <div className="space-y-2">
                      <Label>Compiled Bytecode</Label>
                      <div className="max-h-[100px] overflow-auto rounded-md border bg-muted/50 p-3 text-xs font-mono break-all text-green-400">
                        {bytecode}
                      </div>
                    </div>
                  )}
                </TabsContent>

                {/* Raw Bytecode Tab */}
                <TabsContent value="raw" className="space-y-4 mt-4">
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
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Deploy Options */}
          <Card>
            <CardHeader>
              <CardTitle>Deploy Options</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
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
        </div>
      )}

      {step === "signing" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <Loader2 className="h-12 w-12 animate-spin text-red-500" />
            <p className="text-lg font-medium">Sign in your wallet...</p>
            <p className="text-sm text-muted-foreground">
              Confirm the transaction in your wallet. Waiting for on-chain confirmation after signing.
            </p>
          </CardContent>
        </Card>
      )}

      {step === "failed" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-900 text-white text-2xl font-bold">!</div>
            <p className="text-lg font-medium">Deployment Failed</p>
            {deployError && (
              <div className="rounded-md border border-red-500/50 bg-red-500/10 p-3 text-sm text-red-400 font-mono whitespace-pre-wrap max-w-lg w-full">
                {deployError}
              </div>
            )}
            {txHash && (
              <div className="rounded-lg border p-4 bg-muted/50 w-full max-w-lg">
                <p className="text-sm font-medium mb-1">Transaction Hash:</p>
                <p className="font-mono text-sm break-all text-muted-foreground">{txHash}</p>
              </div>
            )}
            <Button variant="outline" onClick={() => { setStep("configure"); setTxHash(""); setDeployError(""); }}>
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {step === "complete" && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <p className="text-lg font-medium">Contract Deployed!</p>

            {deployedAddress && (
              <div className="rounded-lg border border-green-500/30 bg-green-500/10 p-4 w-full max-w-lg">
                <p className="text-sm font-medium mb-1">Deployed Contract Address:</p>
                <p className="font-mono text-sm break-all text-green-400">{deployedAddress}</p>
              </div>
            )}

            <div className="rounded-lg border p-4 bg-muted/50 w-full max-w-lg">
              <p className="text-sm font-medium mb-1">Transaction Hash:</p>
              <p className="font-mono text-sm break-all text-blue-400">{txHash}</p>
            </div>

            <p className="text-sm text-muted-foreground">
              Your contract is now registered with the AttackRegistry.
            </p>

            <div className="flex gap-3">
              {deployedAddress && (
                <Link href={`/agreements/${deployedAddress}`}>
                  <Button className="bg-red-600 hover:bg-red-700">
                    View in Agreements <ExternalLink className="ml-1.5 h-3.5 w-3.5" />
                  </Button>
                </Link>
              )}
              <Button variant="outline" onClick={() => { setStep("configure"); setBytecode(""); setTxHash(""); setDeployedAddress(""); setSelectedSample(""); setSampleSource(""); }}>
                Deploy Another
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
