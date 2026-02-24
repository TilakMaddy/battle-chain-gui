"use client";

import { useState } from "react";
import { useAccount } from "wagmi";
import { keccak256, encodePacked } from "viem";
import { ChainGuard } from "@/components/web3/chain-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateAgreement,
  useExtendCommitmentWindow,
  useAdoptSafeHarbor,
} from "@/lib/hooks/use-agreement";
import {
  ChildContractScope,
  IdentityRequirements,
  IDENTITY_LABELS,
  CHILD_SCOPE_LABELS,
} from "@/lib/contracts/types";
import { BATTLECHAIN_CAIP2 } from "@/lib/contracts/addresses";
import { toast } from "sonner";
import { ContractPicker } from "@/components/web3/contract-picker";
import {
  Loader2,
  CheckCircle,
  ArrowLeft,
  ArrowRight,
  Plus,
  Trash2,
} from "lucide-react";

type WizardStep = 0 | 1 | 2 | 3 | 4;

interface FormContact {
  name: string;
  contact: string;
}

interface FormScopeAccount {
  accountAddress: string;
  childContractScope: ChildContractScope;
}

interface FormState {
  protocolName: string;
  agreementURI: string;
  contacts: FormContact[];
  assetRecoveryAddress: string;
  accounts: FormScopeAccount[];
  bountyPercentage: string;
  bountyCapUsd: string;
  retainable: boolean;
  identity: IdentityRequirements;
  diligenceRequirements: string;
  aggregateBountyCapUsd: string;
  commitmentDays: string;
}

const STEP_LABELS = ["Protocol Info", "Contacts", "Scope", "Bounty Terms", "Review & Submit"];

export default function CreateAgreementPage() {
  return (
    <ChainGuard>
      <CreateAgreementContent />
    </ChainGuard>
  );
}

function CreateAgreementContent() {
  const { address } = useAccount();
  const [step, setStep] = useState<WizardStep>(0);
  const [submitting, setSubmitting] = useState(false);
  const [agreementAddr, setAgreementAddr] = useState("");

  const { createAgreement, isPending: creating } = useCreateAgreement();
  const { extend, isPending: extending } = useExtendCommitmentWindow();
  const { adopt, isPending: adopting } = useAdoptSafeHarbor();

  const [form, setForm] = useState<FormState>({
    protocolName: "",
    agreementURI: "",
    contacts: [{ name: "", contact: "" }],
    assetRecoveryAddress: "",
    accounts: [{ accountAddress: "", childContractScope: ChildContractScope.None }],
    bountyPercentage: "10",
    bountyCapUsd: "5000000",
    retainable: false,
    identity: IdentityRequirements.Anonymous,
    diligenceRequirements: "",
    aggregateBountyCapUsd: "10000000",
    commitmentDays: "30",
  });

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const handleSubmit = async () => {
    if (!address) return;
    setSubmitting(true);
    try {
      const salt = keccak256(
        encodePacked(["address", "uint256"], [address, BigInt(Date.now())])
      );

      // TX 1: Create agreement
      toast.info("Step 1/3: Creating agreement...");
      await createAgreement(
        {
          protocolName: form.protocolName,
          contactDetails: form.contacts,
          chains: [
            {
              caip2ChainId: BATTLECHAIN_CAIP2,
              assetRecoveryAddress: form.assetRecoveryAddress,
              accounts: form.accounts,
            },
          ],
          bountyTerms: {
            bountyPercentage: BigInt(Math.round(Number(form.bountyPercentage) * 100)),
            bountyCapUsd: BigInt(form.bountyCapUsd),
            retainable: form.retainable,
            identity: form.identity,
            diligenceRequirements: form.diligenceRequirements,
            aggregateBountyCapUsd: BigInt(form.aggregateBountyCapUsd),
          },
          agreementURI: form.agreementURI,
        },
        address,
        salt
      );

      // For the remaining TXs we need the agreement address from the event.
      // In a production app we'd parse the tx receipt logs. For now, prompt user.
      toast.info("Agreement created! Check your wallet for the next transactions.");
      setAgreementAddr("pending");
    } catch (err) {
      console.error(err);
      toast.error("Transaction failed");
    } finally {
      setSubmitting(false);
    }
  };

  const handlePostCreate = async () => {
    if (!agreementAddr || agreementAddr === "pending") return;
    const addr = agreementAddr as `0x${string}`;
    try {
      setSubmitting(true);

      // TX 2: Extend commitment window
      toast.info("Step 2/3: Extending commitment window...");
      const nowSec = BigInt(Math.floor(Date.now() / 1000));
      const days = BigInt(form.commitmentDays) * 86400n;
      await extend(addr, nowSec + days);

      // TX 3: Adopt Safe Harbor
      toast.info("Step 3/3: Adopting Safe Harbor...");
      await adopt(addr);

      toast.success("All 3 transactions complete!");
      setStep(4 as WizardStep);
    } catch (err) {
      console.error(err);
      toast.error("Transaction failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      <PageHeader
        title="Create Agreement"
        description="Set up a Safe Harbor agreement in 5 steps"
      />

      {/* Step indicators */}
      <div className="flex items-center gap-2 overflow-x-auto">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                i <= step ? "bg-red-600 text-white" : "bg-muted text-muted-foreground"
              }`}
            >
              {i + 1}
            </div>
            <span
              className={`text-sm whitespace-nowrap ${
                i <= step ? "font-medium" : "text-muted-foreground"
              }`}
            >
              {label}
            </span>
            {i < 4 && <Separator className="w-6" />}
          </div>
        ))}
      </div>

      {/* Step 0: Protocol Info */}
      {step === 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Protocol Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Protocol Name</Label>
              <Input
                placeholder="My DeFi Protocol"
                value={form.protocolName}
                onChange={(e) => update("protocolName", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Agreement URI (optional)</Label>
              <Input
                placeholder="https://example.com/agreement.pdf"
                value={form.agreementURI}
                onChange={(e) => update("agreementURI", e.target.value)}
              />
            </div>
            <Button
              onClick={() => setStep(1)}
              disabled={!form.protocolName}
              className="bg-red-600 hover:bg-red-700"
            >
              Next <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 1: Contacts */}
      {step === 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Contact Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {form.contacts.map((c, i) => (
              <div key={i} className="flex gap-3 items-end">
                <div className="flex-1 space-y-2">
                  <Label>Name</Label>
                  <Input
                    placeholder="Security Team"
                    value={c.name}
                    onChange={(e) => {
                      const contacts = [...form.contacts];
                      contacts[i] = { ...contacts[i], name: e.target.value };
                      update("contacts", contacts);
                    }}
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <Label>Contact</Label>
                  <Input
                    placeholder="security@protocol.com"
                    value={c.contact}
                    onChange={(e) => {
                      const contacts = [...form.contacts];
                      contacts[i] = { ...contacts[i], contact: e.target.value };
                      update("contacts", contacts);
                    }}
                  />
                </div>
                {form.contacts.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      update(
                        "contacts",
                        form.contacts.filter((_, j) => j !== i)
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() => update("contacts", [...form.contacts, { name: "", contact: "" }])}
            >
              <Plus className="mr-2 h-4 w-4" /> Add Contact
            </Button>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(0)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button onClick={() => setStep(2)} className="bg-red-600 hover:bg-red-700">
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Scope */}
      {step === 2 && (
        <Card>
          <CardHeader>
            <CardTitle>Scope Configuration</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ContractPicker
              label="Asset Recovery Address"
              value={form.assetRecoveryAddress}
              onChange={(addr) => update("assetRecoveryAddress", addr)}
            />
            <Separator />
            <Label className="text-base font-semibold">In-Scope Contracts</Label>
            {form.accounts.map((acc, i) => (
              <div key={i} className="flex gap-3 items-end">
                <div className="flex-1">
                  <ContractPicker
                    label="Contract Address"
                    value={acc.accountAddress}
                    onChange={(addr) => {
                      const accounts = [...form.accounts];
                      accounts[i] = { ...accounts[i], accountAddress: addr };
                      update("accounts", accounts);
                    }}
                  />
                </div>
                <div className="w-64 space-y-2">
                  <Label>Child Contract Scope</Label>
                  <Select
                    value={String(acc.childContractScope)}
                    onValueChange={(v) => {
                      const accounts = [...form.accounts];
                      accounts[i] = { ...accounts[i], childContractScope: Number(v) };
                      update("accounts", accounts);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(CHILD_SCOPE_LABELS).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {form.accounts.length > 1 && (
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() =>
                      update(
                        "accounts",
                        form.accounts.filter((_, j) => j !== i)
                      )
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button
              variant="outline"
              onClick={() =>
                update("accounts", [
                  ...form.accounts,
                  { accountAddress: "", childContractScope: ChildContractScope.None },
                ])
              }
            >
              <Plus className="mr-2 h-4 w-4" /> Add Contract
            </Button>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(1)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button onClick={() => setStep(3)} className="bg-red-600 hover:bg-red-700">
                Next <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 3: Bounty Terms */}
      {step === 3 && (
        <Card>
          <CardHeader>
            <CardTitle>Bounty Terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Bounty Percentage (%)</Label>
                <Input
                  type="number"
                  placeholder="10"
                  value={form.bountyPercentage}
                  onChange={(e) => update("bountyPercentage", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Bounty Cap (USD)</Label>
                <Input
                  type="number"
                  placeholder="5000000"
                  value={form.bountyCapUsd}
                  onChange={(e) => update("bountyCapUsd", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Aggregate Bounty Cap (USD)</Label>
                <Input
                  type="number"
                  placeholder="10000000"
                  value={form.aggregateBountyCapUsd}
                  onChange={(e) => update("aggregateBountyCapUsd", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Identity Requirement</Label>
                <Select
                  value={String(form.identity)}
                  onValueChange={(v) => update("identity", Number(v) as IdentityRequirements)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(IDENTITY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="retainable"
                checked={form.retainable}
                onChange={(e) => update("retainable", e.target.checked)}
                className="h-4 w-4"
              />
              <Label htmlFor="retainable">Bounty is retainable by whitehat</Label>
            </div>
            <div className="space-y-2">
              <Label>Diligence Requirements</Label>
              <Textarea
                placeholder="Describe any diligence requirements..."
                value={form.diligenceRequirements}
                onChange={(e) => update("diligenceRequirements", e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Commitment Window (days)</Label>
              <Input
                type="number"
                placeholder="30"
                value={form.commitmentDays}
                onChange={(e) => update("commitmentDays", e.target.value)}
              />
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(2)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button onClick={() => setStep(4)} className="bg-red-600 hover:bg-red-700">
                Review <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Step 4: Review & Submit */}
      {step === 4 && !agreementAddr && (
        <Card>
          <CardHeader>
            <CardTitle>Review & Submit</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold">Protocol</h3>
              <p className="text-sm">{form.protocolName}</p>
            </div>
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold">Contacts</h3>
              {form.contacts.map((c, i) => (
                <p key={i} className="text-sm">
                  {c.name}: {c.contact}
                </p>
              ))}
            </div>
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold">Scope</h3>
              <p className="text-sm">Recovery: <span className="font-mono">{form.assetRecoveryAddress}</span></p>
              {form.accounts.map((a, i) => (
                <p key={i} className="text-sm">
                  <span className="font-mono">{a.accountAddress}</span> — {CHILD_SCOPE_LABELS[a.childContractScope]}
                </p>
              ))}
            </div>
            <div className="rounded-lg border p-4 space-y-3">
              <h3 className="font-semibold">Bounty</h3>
              <p className="text-sm">{form.bountyPercentage}% (cap: ${Number(form.bountyCapUsd).toLocaleString()})</p>
              <p className="text-sm">Identity: {IDENTITY_LABELS[form.identity]}</p>
              <p className="text-sm">Commitment: {form.commitmentDays} days</p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setStep(3)}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={submitting || creating}
                className="bg-red-600 hover:bg-red-700"
              >
                {submitting ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : null}
                Submit Agreement (3 Transactions)
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Post-create: enter agreement address for remaining TXs */}
      {agreementAddr === "pending" && (
        <Card>
          <CardHeader>
            <CardTitle>Agreement Created - Complete Setup</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Select or enter the agreement address from the creation transaction to complete the setup (extend commitment window + adopt Safe Harbor).
            </p>
            <ContractPicker
              label="Agreement Address"
              value={agreementAddr === "pending" ? "" : agreementAddr}
              onChange={(addr) => {
                if (addr.startsWith("0x") && addr.length === 42) {
                  setAgreementAddr(addr);
                }
              }}
            />
            <Button
              onClick={handlePostCreate}
              disabled={!agreementAddr.startsWith("0x") || submitting || extending || adopting}
              className="bg-red-600 hover:bg-red-700"
            >
              {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
              Complete Setup (2 remaining TXs)
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Done */}
      {agreementAddr && agreementAddr !== "pending" && step === 4 && (
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12">
            <CheckCircle className="h-12 w-12 text-green-500" />
            <p className="text-lg font-medium">Agreement Setup Complete!</p>
            <p className="font-mono text-sm text-blue-400">{agreementAddr}</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
