"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { keccak256 } from "viem";
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
import {
  useDeployCreate,
  useDeployCreate2,
  useDeployCreate3,
  useComputeCreateAddress,
  useComputeCreate2Address,
  useComputeCreate3Address,
} from "@/lib/hooks/use-deployer";
import { SAMPLE_CONTRACTS } from "@/lib/contracts/samples";
import { CopyableAddress } from "@/components/ui/copyable-address";
import {
  Rocket,
  CheckCircle,
  Loader2,
  Code,
  FileCode,
  Terminal,
  ExternalLink,
  Calculator,
} from "lucide-react";
import Link from "next/link";

type Step = "configure" | "signing" | "confirming" | "complete" | "failed";
type DeployMethod = "create" | "create2" | "create3";

const EXPLORER_URL = process.env.NEXT_PUBLIC_EXPLORER_URL ?? "https://explorer.testnet.battlechain.com";

export default function DeployPage() {
  return (
    <ChainGuard>
      <DeployPageContent />
    </ChainGuard>
  );
}

function DeployPageContent() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Deploy Contract"
        description="Deploy contracts through BattleChainDeployer for automatic AttackRegistry registration"
      />
      <Tabs defaultValue="deploy">
        <TabsList>
          <TabsTrigger value="deploy">
            <Rocket className="mr-1.5 h-3.5 w-3.5" />
            Deploy
          </TabsTrigger>
          <TabsTrigger value="calculator">
            <Calculator className="mr-1.5 h-3.5 w-3.5" />
            Address Calculator
          </TabsTrigger>
        </TabsList>

        <TabsContent value="deploy" className="mt-6">
          <DeployContent />
        </TabsContent>

        <TabsContent value="calculator" className="mt-6">
          <AddressCalculator />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function DeployContent() {
  const { address } = useAccount();
  const [step, setStep] = useState<Step>("configure");
  const [bytecode, setBytecode] = useState("");
  const [salt, setSalt] = useState("");
  const [deployMethod, setDeployMethod] = useState<DeployMethod>("create");
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
  const deployCreate3 = useDeployCreate3();
  const isPending = deployCreate.isPending || deployCreate2.isPending || deployCreate3.isPending;

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

      let result;
      if (deployMethod === "create2" && salt) {
        result = await deployCreate2.deploy(salt as `0x${string}`, bytecode as `0x${string}`);
      } else if (deployMethod === "create3" && salt) {
        result = await deployCreate3.deploy(salt as `0x${string}`, bytecode as `0x${string}`);
      } else {
        result = await deployCreate.deploy(bytecode as `0x${string}`);
      }

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
    <div className="space-y-6">
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
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
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
              <div className="space-y-3">
                <Label>Deploy Method</Label>
                <div className="flex gap-4">
                  {(["create", "create2", "create3"] as DeployMethod[]).map((method) => (
                    <label
                      key={method}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <input
                        type="radio"
                        name="deploy-method"
                        value={method}
                        checked={deployMethod === method}
                        onChange={() => setDeployMethod(method)}
                        className="h-4 w-4"
                      />
                      <span className="text-sm font-medium">
                        {method === "create" ? "CREATE" : method === "create2" ? "CREATE2" : "CREATE3"}
                      </span>
                    </label>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {deployMethod === "create"
                    ? "Standard deployment using the deployer's nonce."
                    : deployMethod === "create2"
                    ? "Deterministic address based on salt and init code."
                    : "Deterministic address based on salt only (init code independent)."}
                </p>
              </div>

              {(deployMethod === "create2" || deployMethod === "create3") && (
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
                <p className="text-sm font-medium mb-1">Deployed Contract</p>
                <a
                  href={`${EXPLORER_URL}/address/${deployedAddress}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-sm break-all text-green-400 hover:underline"
                >
                  {deployedAddress}
                </a>
              </div>
            )}

            <div className="rounded-lg border p-4 bg-muted/50 w-full max-w-lg">
              <p className="text-sm font-medium mb-1">Transaction</p>
              <a
                href={`${EXPLORER_URL}/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm break-all text-blue-400 hover:underline"
              >
                {txHash}
              </a>
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

function AddressCalculator() {
  const { address } = useAccount();

  // CREATE state
  const [createNonce, setCreateNonce] = useState("");
  const nonceValue = createNonce !== "" && !isNaN(Number(createNonce))
    ? BigInt(createNonce)
    : undefined;
  const {
    data: createAddr,
    isLoading: createLoading,
  } = useComputeCreateAddress(nonceValue);

  // CREATE2 state
  const [create2Salt, setCreate2Salt] = useState("");
  const [create2InitCode, setCreate2InitCode] = useState("");
  const [create2InitCodeHash, setCreate2InitCodeHash] = useState("");
  const validCreate2Salt = /^0x[0-9a-fA-F]{64}$/.test(create2Salt)
    ? (create2Salt as `0x${string}`)
    : undefined;
  const validCreate2Hash = /^0x[0-9a-fA-F]{64}$/.test(create2InitCodeHash)
    ? (create2InitCodeHash as `0x${string}`)
    : undefined;
  const {
    data: create2Addr,
    isLoading: create2Loading,
  } = useComputeCreate2Address(validCreate2Salt, validCreate2Hash);

  const handleHashInitCode = () => {
    if (!create2InitCode.startsWith("0x")) return;
    try {
      const hash = keccak256(create2InitCode as `0x${string}`);
      setCreate2InitCodeHash(hash);
    } catch {
      // invalid bytecode
    }
  };

  // CREATE3 state
  const [create3Salt, setCreate3Salt] = useState("");
  const validCreate3Salt = /^0x[0-9a-fA-F]{64}$/.test(create3Salt)
    ? (create3Salt as `0x${string}`)
    : undefined;
  const {
    data: create3Addr,
    isLoading: create3Loading,
  } = useComputeCreate3Address(validCreate3Salt);

  return (
    <div className="space-y-6">
      {/* CREATE */}
      <Card>
        <CardHeader>
          <CardTitle>CREATE Address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Deployer Address</Label>
            <Input
              value={address ?? ""}
              disabled
              className="font-mono bg-muted/50"
            />
            <p className="text-xs text-muted-foreground">
              Auto-filled from your connected wallet.
            </p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="create-nonce">Nonce</Label>
            <Input
              id="create-nonce"
              type="number"
              placeholder="0"
              value={createNonce}
              onChange={(e) => setCreateNonce(e.target.value)}
              className="font-mono"
            />
          </div>
          {createLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Computing...
            </div>
          )}
          {createAddr && (
            <div className="rounded-lg border p-3 bg-muted/50">
              <Label className="text-xs text-muted-foreground">Computed Address</Label>
              <div className="mt-1">
                <CopyableAddress address={createAddr as string} truncate={false} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CREATE2 */}
      <Card>
        <CardHeader>
          <CardTitle>CREATE2 Address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create2-salt">Salt (bytes32)</Label>
            <Input
              id="create2-salt"
              placeholder="0x0000000000000000000000000000000000000000000000000000000000000001"
              value={create2Salt}
              onChange={(e) => setCreate2Salt(e.target.value)}
              className="font-mono"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="create2-initcode">Init Code (bytecode)</Label>
            <textarea
              id="create2-initcode"
              className="flex min-h-[80px] w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm font-mono placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              placeholder="0x608060405234801561001057..."
              value={create2InitCode}
              onChange={(e) => setCreate2InitCode(e.target.value)}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleHashInitCode}
              disabled={!create2InitCode.startsWith("0x")}
            >
              Hash It
            </Button>
          </div>
          {create2InitCodeHash && (
            <div className="space-y-2">
              <Label className="text-xs text-muted-foreground">Init Code Hash (keccak256)</Label>
              <div className="rounded-md border bg-muted/50 p-2 font-mono text-xs break-all">
                {create2InitCodeHash}
              </div>
            </div>
          )}
          {create2Loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Computing...
            </div>
          )}
          {create2Addr && (
            <div className="rounded-lg border p-3 bg-muted/50">
              <Label className="text-xs text-muted-foreground">Computed Address</Label>
              <div className="mt-1">
                <CopyableAddress address={create2Addr as string} truncate={false} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* CREATE3 */}
      <Card>
        <CardHeader>
          <CardTitle>CREATE3 Address</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="create3-salt">Salt (bytes32)</Label>
            <Input
              id="create3-salt"
              placeholder="0x0000000000000000000000000000000000000000000000000000000000000001"
              value={create3Salt}
              onChange={(e) => setCreate3Salt(e.target.value)}
              className="font-mono"
            />
          </div>
          {create3Loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Computing...
            </div>
          )}
          {create3Addr && (
            <div className="rounded-lg border p-3 bg-muted/50">
              <Label className="text-xs text-muted-foreground">Computed Address</Label>
              <div className="mt-1">
                <CopyableAddress address={create3Addr as string} truncate={false} />
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
