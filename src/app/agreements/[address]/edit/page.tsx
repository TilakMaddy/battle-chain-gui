"use client";

import { use, useState, useEffect } from "react";
import { useAccount } from "wagmi";
import Link from "next/link";
import { ChainGuard } from "@/components/web3/chain-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { CountdownTimer } from "@/components/ui/countdown-timer";
import {
  ChildContractScope,
  CHILD_SCOPE_LABELS,
  IdentityRequirements,
  IDENTITY_LABELS,
} from "@/lib/contracts/types";
import type { Contact, ScopeChain, ScopeAccount, BountyTerms } from "@/lib/contracts/types";
import {
  useAgreementDetails,
  useAgreementOwner,
  useCommitmentWindowEnd,
  useSetProtocolName,
  useSetContactDetails,
  useSetBountyTerms,
  useSetAgreementURI,
  useAddOrSetChains,
  useAddAccounts,
  useRemoveAccounts,
  useRemoveChains,
  useTransferOwnership,
  useRenounceOwnership,
  useExtendCommitmentWindow,
} from "@/lib/hooks/use-agreement";
import {
  Loader2,
  Save,
  Plus,
  Trash2,
  ArrowLeft,
  Lock,
  Unlock,
  AlertTriangle,
  Shield,
} from "lucide-react";

// ---------------------------------------------------------------------------
// Page entry point
// ---------------------------------------------------------------------------

export default function EditAgreementPage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = use(params);
  return (
    <ChainGuard>
      <EditAgreementContent address={address as `0x${string}`} />
    </ChainGuard>
  );
}

// ---------------------------------------------------------------------------
// Main content — ownership gate + tabs
// ---------------------------------------------------------------------------

function EditAgreementContent({ address }: { address: `0x${string}` }) {
  const { address: wallet } = useAccount();
  const { data: owner, isLoading: loadingOwner } = useAgreementOwner(address);
  const { data: details, isLoading: loadingDetails } = useAgreementDetails(address);
  const { data: commitmentEnd } = useCommitmentWindowEnd(address);

  if (loadingOwner || loadingDetails) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  const ownerAddr = owner as string | undefined;
  const isOwner =
    !!wallet && !!ownerAddr && wallet.toLowerCase() === ownerAddr.toLowerCase();

  if (!isOwner) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
              <Shield className="h-8 w-8 text-red-500" />
            </div>
            <CardTitle className="text-2xl">Unauthorized</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">
              Only the agreement owner can access this editor.
            </p>
            <Button variant="outline" asChild>
              <Link href={`/agreements/${address}`}>
                <ArrowLeft className="mr-2 h-4 w-4" /> Back to Agreement
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const d = details as {
    protocolName: string;
    contactDetails: { name: string; contact: string }[];
    chains: {
      assetRecoveryAddress: string;
      accounts: { accountAddress: string; childContractScope: number }[];
      caip2ChainId: string;
    }[];
    bountyTerms: {
      bountyPercentage: bigint;
      bountyCapUsd: bigint;
      retainable: boolean;
      identity: number;
      diligenceRequirements: string;
      aggregateBountyCapUsd: bigint;
    };
    agreementURI: string;
  } | undefined;

  const commitmentEndBigint = commitmentEnd as bigint | undefined;
  const isCommitted =
    !!commitmentEndBigint &&
    commitmentEndBigint > 0n &&
    commitmentEndBigint > BigInt(Math.floor(Date.now() / 1000));

  return (
    <div className="space-y-8">
      <PageHeader title="Edit Agreement">
        <Button variant="outline" asChild>
          <Link href={`/agreements/${address}`}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back
          </Link>
        </Button>
      </PageHeader>

      <div className="rounded-lg border p-3 bg-muted/50">
        <span className="text-sm text-muted-foreground">Address: </span>
        <span className="font-mono text-sm">{address}</span>
      </div>

      <Tabs defaultValue="protocol">
        <TabsList className="w-full">
          <TabsTrigger value="protocol">Protocol Details</TabsTrigger>
          <TabsTrigger value="scope">Scope Management</TabsTrigger>
          <TabsTrigger value="commitment">Commitment Window</TabsTrigger>
          <TabsTrigger value="ownership">Ownership</TabsTrigger>
        </TabsList>

        <TabsContent value="protocol" className="mt-6">
          <ProtocolDetailsTab address={address} details={d} />
        </TabsContent>

        <TabsContent value="scope" className="mt-6">
          <ScopeManagementTab
            address={address}
            details={d}
            isCommitted={isCommitted}
            commitmentEnd={commitmentEndBigint}
          />
        </TabsContent>

        <TabsContent value="commitment" className="mt-6">
          <CommitmentWindowTab
            address={address}
            commitmentEnd={commitmentEndBigint}
          />
        </TabsContent>

        <TabsContent value="ownership" className="mt-6">
          <OwnershipTab address={address} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 1: Protocol Details
// ---------------------------------------------------------------------------

interface ProtocolDetailsTabProps {
  address: `0x${string}`;
  details:
    | {
        protocolName: string;
        contactDetails: { name: string; contact: string }[];
        bountyTerms: {
          bountyPercentage: bigint;
          bountyCapUsd: bigint;
          retainable: boolean;
          identity: number;
          diligenceRequirements: string;
          aggregateBountyCapUsd: bigint;
        };
        agreementURI: string;
      }
    | undefined;
}

function ProtocolDetailsTab({ address, details }: ProtocolDetailsTabProps) {
  return (
    <div className="space-y-6">
      <ProtocolNameSection address={address} currentName={details?.protocolName ?? ""} />
      <AgreementURISection address={address} currentURI={details?.agreementURI ?? ""} />
      <ContactDetailsSection
        address={address}
        currentContacts={
          details?.contactDetails?.map((c) => ({ name: c.name, contact: c.contact })) ?? []
        }
      />
      <BountyTermsSection address={address} currentTerms={details?.bountyTerms} />
    </div>
  );
}

// -- Protocol Name --

function ProtocolNameSection({
  address,
  currentName,
}: {
  address: `0x${string}`;
  currentName: string;
}) {
  const [name, setName] = useState(currentName);
  const { setProtocolName, isPending } = useSetProtocolName();

  useEffect(() => {
    setName(currentName);
  }, [currentName]);

  const handleSave = async () => {
    try {
      await setProtocolName(address, name);
    } catch {
      // toast is handled inside the hook
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Protocol Name</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="protocol-name">Name</Label>
          <Input
            id="protocol-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Uniswap"
          />
        </div>
        <Button onClick={handleSave} disabled={isPending || name === currentName}>
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save
        </Button>
      </CardContent>
    </Card>
  );
}

// -- Agreement URI --

function AgreementURISection({
  address,
  currentURI,
}: {
  address: `0x${string}`;
  currentURI: string;
}) {
  const [uri, setUri] = useState(currentURI);
  const { setAgreementURI, isPending } = useSetAgreementURI();

  useEffect(() => {
    setUri(currentURI);
  }, [currentURI]);

  const handleSave = async () => {
    try {
      await setAgreementURI(address, uri);
    } catch {
      // toast is handled inside the hook
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Agreement URI</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="agreement-uri">URI</Label>
          <Input
            id="agreement-uri"
            value={uri}
            onChange={(e) => setUri(e.target.value)}
            placeholder="https://example.com/agreement.pdf"
          />
        </div>
        <Button onClick={handleSave} disabled={isPending || uri === currentURI}>
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save
        </Button>
      </CardContent>
    </Card>
  );
}

// -- Contact Details --

function ContactDetailsSection({
  address,
  currentContacts,
}: {
  address: `0x${string}`;
  currentContacts: Contact[];
}) {
  const [contacts, setContacts] = useState<Contact[]>(currentContacts);
  const { setContactDetails, isPending } = useSetContactDetails();

  useEffect(() => {
    setContacts(currentContacts.length > 0 ? currentContacts : [{ name: "", contact: "" }]);
  }, [currentContacts]);

  const addContact = () => setContacts((prev) => [...prev, { name: "", contact: "" }]);

  const removeContact = (index: number) =>
    setContacts((prev) => prev.filter((_, i) => i !== index));

  const updateContact = (index: number, field: keyof Contact, value: string) =>
    setContacts((prev) =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    );

  const handleSave = async () => {
    const valid = contacts.filter((c) => c.name.trim() && c.contact.trim());
    if (valid.length === 0) return;
    try {
      await setContactDetails(address, valid);
    } catch {
      // toast is handled inside the hook
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Contact Details</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {contacts.map((c, i) => (
          <div key={i} className="flex items-end gap-3">
            <div className="flex-1 space-y-2">
              <Label>Name</Label>
              <Input
                value={c.name}
                onChange={(e) => updateContact(i, "name", e.target.value)}
                placeholder="Security Team"
              />
            </div>
            <div className="flex-1 space-y-2">
              <Label>Contact</Label>
              <Input
                value={c.contact}
                onChange={(e) => updateContact(i, "contact", e.target.value)}
                placeholder="security@example.com"
              />
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeContact(i)}
              disabled={contacts.length <= 1}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        ))}
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={addContact}>
            <Plus className="mr-2 h-4 w-4" /> Add Contact
          </Button>
          <Button onClick={handleSave} disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Save All
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// -- Bounty Terms --

interface RawBountyTerms {
  bountyPercentage: bigint;
  bountyCapUsd: bigint;
  retainable: boolean;
  identity: number;
  diligenceRequirements: string;
  aggregateBountyCapUsd: bigint;
}

function BountyTermsSection({
  address,
  currentTerms,
}: {
  address: `0x${string}`;
  currentTerms: RawBountyTerms | undefined;
}) {
  const [bountyPercentage, setBountyPercentage] = useState("");
  const [bountyCapUsd, setBountyCapUsd] = useState("");
  const [aggregateBountyCapUsd, setAggregateBountyCapUsd] = useState("");
  const [retainable, setRetainable] = useState(false);
  const [identity, setIdentity] = useState<IdentityRequirements>(IdentityRequirements.Anonymous);
  const [diligenceRequirements, setDiligenceRequirements] = useState("");
  const { setBountyTerms, isPending } = useSetBountyTerms();

  useEffect(() => {
    if (currentTerms) {
      setBountyPercentage(currentTerms.bountyPercentage.toString());
      setBountyCapUsd(currentTerms.bountyCapUsd.toString());
      setAggregateBountyCapUsd(currentTerms.aggregateBountyCapUsd.toString());
      setRetainable(currentTerms.retainable);
      setIdentity(currentTerms.identity as IdentityRequirements);
      setDiligenceRequirements(currentTerms.diligenceRequirements);
    }
  }, [currentTerms]);

  const handleSave = async () => {
    try {
      const terms: BountyTerms = {
        bountyPercentage: BigInt(bountyPercentage || "0"),
        bountyCapUsd: BigInt(bountyCapUsd || "0"),
        aggregateBountyCapUsd: BigInt(aggregateBountyCapUsd || "0"),
        retainable,
        identity,
        diligenceRequirements,
      };
      await setBountyTerms(address, terms);
    } catch {
      // toast is handled inside the hook
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Bounty Terms</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="space-y-2">
            <Label htmlFor="bounty-percentage">Bounty Percentage (basis points)</Label>
            <Input
              id="bounty-percentage"
              value={bountyPercentage}
              onChange={(e) => setBountyPercentage(e.target.value)}
              placeholder="1000 = 10%"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bounty-cap">Bounty Cap (USD)</Label>
            <Input
              id="bounty-cap"
              value={bountyCapUsd}
              onChange={(e) => setBountyCapUsd(e.target.value)}
              placeholder="e.g. 100000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="aggregate-cap">Aggregate Bounty Cap (USD)</Label>
            <Input
              id="aggregate-cap"
              value={aggregateBountyCapUsd}
              onChange={(e) => setAggregateBountyCapUsd(e.target.value)}
              placeholder="e.g. 500000"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label>Identity Requirement</Label>
            <Select
              value={identity.toString()}
              onValueChange={(v) => setIdentity(Number(v) as IdentityRequirements)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(IDENTITY_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-3 pt-6">
            <input
              type="checkbox"
              id="retainable"
              checked={retainable}
              onChange={(e) => setRetainable(e.target.checked)}
              className="h-4 w-4 rounded border-gray-600 bg-transparent"
            />
            <Label htmlFor="retainable">Retainable</Label>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="diligence">Diligence Requirements</Label>
          <Textarea
            id="diligence"
            value={diligenceRequirements}
            onChange={(e) => setDiligenceRequirements(e.target.value)}
            placeholder="Describe any due diligence requirements..."
            rows={3}
          />
        </div>

        <Button onClick={handleSave} disabled={isPending}>
          {isPending ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="mr-2 h-4 w-4" />
          )}
          Save
        </Button>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tab 2: Scope Management
// ---------------------------------------------------------------------------

interface ScopeManagementTabProps {
  address: `0x${string}`;
  details:
    | {
        chains: {
          assetRecoveryAddress: string;
          accounts: { accountAddress: string; childContractScope: number }[];
          caip2ChainId: string;
        }[];
      }
    | undefined;
  isCommitted: boolean;
  commitmentEnd: bigint | undefined;
}

function ScopeManagementTab({
  address,
  details,
  isCommitted,
  commitmentEnd,
}: ScopeManagementTabProps) {
  const chains = details?.chains ?? [];

  return (
    <div className="space-y-6">
      {isCommitted && commitmentEnd && (
        <div className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
          <AlertTriangle className="h-5 w-5 text-yellow-500 shrink-0" />
          <div>
            <p className="text-sm font-medium text-yellow-400">
              Commitment window is active
            </p>
            <p className="text-xs text-muted-foreground">
              Remove operations are disabled until the commitment window expires.
              Remaining: <CountdownTimer targetTimestamp={commitmentEnd} />
            </p>
          </div>
        </div>
      )}

      {chains.map((chain, i) => (
        <ChainCard
          key={`${chain.caip2ChainId}-${i}`}
          address={address}
          chain={chain}
          isCommitted={isCommitted}
        />
      ))}

      <Separator />
      <AddChainForm address={address} />
    </div>
  );
}

// -- Chain card --

function ChainCard({
  address,
  chain,
  isCommitted,
}: {
  address: `0x${string}`;
  chain: {
    assetRecoveryAddress: string;
    accounts: { accountAddress: string; childContractScope: number }[];
    caip2ChainId: string;
  };
  isCommitted: boolean;
}) {
  const { removeChains, isPending: removingChain } = useRemoveChains();
  const { removeAccounts, isPending: removingAccount } = useRemoveAccounts();

  const [newAccountAddr, setNewAccountAddr] = useState("");
  const [newAccountScope, setNewAccountScope] = useState<ChildContractScope>(
    ChildContractScope.None
  );
  const { addAccounts, isPending: addingAccount } = useAddAccounts();

  const handleRemoveChain = async () => {
    try {
      await removeChains(address, [chain.caip2ChainId]);
    } catch {
      // toast handled in hook
    }
  };

  const handleRemoveAccount = async (accountAddress: string) => {
    try {
      await removeAccounts(address, chain.caip2ChainId, [accountAddress]);
    } catch {
      // toast handled in hook
    }
  };

  const handleAddAccount = async () => {
    if (!newAccountAddr.trim()) return;
    try {
      await addAccounts(address, chain.caip2ChainId, [
        {
          accountAddress: newAccountAddr.trim(),
          childContractScope: newAccountScope,
        },
      ]);
      setNewAccountAddr("");
      setNewAccountScope(ChildContractScope.None);
    } catch {
      // toast handled in hook
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="text-base font-mono">{chain.caip2ChainId}</CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Recovery: <span className="font-mono">{chain.assetRecoveryAddress}</span>
          </p>
        </div>
        <Button
          variant="destructive"
          size="sm"
          onClick={handleRemoveChain}
          disabled={isCommitted || removingChain}
        >
          {removingChain ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2 className="mr-2 h-4 w-4" />
          )}
          Remove Chain
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm font-medium">
          Accounts ({chain.accounts.length})
        </p>
        {chain.accounts.map((acc, j) => (
          <div
            key={`${acc.accountAddress}-${j}`}
            className="flex items-center justify-between rounded-lg border p-3"
          >
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm">{acc.accountAddress}</span>
              <Badge variant="secondary">
                {CHILD_SCOPE_LABELS[acc.childContractScope as ChildContractScope]}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleRemoveAccount(acc.accountAddress)}
              disabled={isCommitted || removingAccount}
            >
              {removingAccount ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="h-4 w-4 text-red-500" />
              )}
            </Button>
          </div>
        ))}

        <Separator />

        <p className="text-sm font-medium">Add Account</p>
        <div className="flex items-end gap-3">
          <div className="flex-1 space-y-2">
            <Label>Account Address</Label>
            <Input
              value={newAccountAddr}
              onChange={(e) => setNewAccountAddr(e.target.value)}
              placeholder="0x..."
            />
          </div>
          <div className="w-48 space-y-2">
            <Label>Child Scope</Label>
            <Select
              value={newAccountScope.toString()}
              onValueChange={(v) => setNewAccountScope(Number(v) as ChildContractScope)}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CHILD_SCOPE_LABELS).map(([val, label]) => (
                  <SelectItem key={val} value={val}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button onClick={handleAddAccount} disabled={addingAccount || !newAccountAddr.trim()}>
            {addingAccount ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Add
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// -- Add Chain form --

function AddChainForm({ address }: { address: `0x${string}` }) {
  const [caip2ChainId, setCaip2ChainId] = useState("");
  const [assetRecoveryAddress, setAssetRecoveryAddress] = useState("");
  const [accounts, setAccounts] = useState<ScopeAccount[]>([
    { accountAddress: "", childContractScope: ChildContractScope.None },
  ]);
  const { addOrSetChains, isPending } = useAddOrSetChains();

  const addAccountRow = () =>
    setAccounts((prev) => [
      ...prev,
      { accountAddress: "", childContractScope: ChildContractScope.None },
    ]);

  const removeAccountRow = (index: number) =>
    setAccounts((prev) => prev.filter((_, i) => i !== index));

  const updateAccountRow = (
    index: number,
    field: keyof ScopeAccount,
    value: string | ChildContractScope
  ) =>
    setAccounts((prev) =>
      prev.map((a, i) => (i === index ? { ...a, [field]: value } : a))
    );

  const handleSubmit = async () => {
    if (!caip2ChainId.trim() || !assetRecoveryAddress.trim()) return;
    const validAccounts = accounts.filter((a) => a.accountAddress.trim());
    if (validAccounts.length === 0) return;

    try {
      const chain: ScopeChain = {
        assetRecoveryAddress: assetRecoveryAddress.trim(),
        accounts: validAccounts.map((a) => ({
          accountAddress: a.accountAddress.trim(),
          childContractScope: a.childContractScope,
        })),
        caip2ChainId: caip2ChainId.trim(),
      };
      await addOrSetChains(address, [chain]);
      setCaip2ChainId("");
      setAssetRecoveryAddress("");
      setAccounts([
        { accountAddress: "", childContractScope: ChildContractScope.None },
      ]);
    } catch {
      // toast handled in hook
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add Chain</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="new-chain-id">CAIP-2 Chain ID</Label>
            <Input
              id="new-chain-id"
              value={caip2ChainId}
              onChange={(e) => setCaip2ChainId(e.target.value)}
              placeholder="eip155:1"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-recovery">Asset Recovery Address</Label>
            <Input
              id="new-recovery"
              value={assetRecoveryAddress}
              onChange={(e) => setAssetRecoveryAddress(e.target.value)}
              placeholder="0x..."
            />
          </div>
        </div>

        <Separator />
        <p className="text-sm font-medium">Accounts</p>

        {accounts.map((acc, i) => (
          <div key={i} className="flex items-end gap-3">
            <div className="flex-1 space-y-2">
              <Label>Account Address</Label>
              <Input
                value={acc.accountAddress}
                onChange={(e) => updateAccountRow(i, "accountAddress", e.target.value)}
                placeholder="0x..."
              />
            </div>
            <div className="w-48 space-y-2">
              <Label>Child Scope</Label>
              <Select
                value={acc.childContractScope.toString()}
                onValueChange={(v) =>
                  updateAccountRow(i, "childContractScope", Number(v) as ChildContractScope)
                }
              >
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(CHILD_SCOPE_LABELS).map(([val, label]) => (
                    <SelectItem key={val} value={val}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => removeAccountRow(i)}
              disabled={accounts.length <= 1}
            >
              <Trash2 className="h-4 w-4 text-red-500" />
            </Button>
          </div>
        ))}

        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={addAccountRow}>
            <Plus className="mr-2 h-4 w-4" /> Add Account
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Add Chain
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Tab 3: Commitment Window
// ---------------------------------------------------------------------------

function CommitmentWindowTab({
  address,
  commitmentEnd,
}: {
  address: `0x${string}`;
  commitmentEnd: bigint | undefined;
}) {
  const { extend, isPending } = useExtendCommitmentWindow();
  const [newDate, setNewDate] = useState("");

  const nowSeconds = BigInt(Math.floor(Date.now() / 1000));
  const isLocked =
    !!commitmentEnd && commitmentEnd > 0n && commitmentEnd > nowSeconds;

  const handleExtend = async () => {
    if (!newDate) return;
    const timestamp = BigInt(Math.floor(new Date(newDate).getTime() / 1000));
    try {
      await extend(address, timestamp);
      setNewDate("");
    } catch {
      // toast handled in hook
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {isLocked ? (
              <Lock className="h-5 w-5 text-yellow-500" />
            ) : (
              <Unlock className="h-5 w-5 text-green-500" />
            )}
            Commitment Window Status
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className={
                isLocked
                  ? "bg-yellow-500/20 text-yellow-400 border-yellow-500/30"
                  : "bg-green-500/20 text-green-400 border-green-500/30"
              }
            >
              {isLocked ? "Locked" : "Unlocked"}
            </Badge>
            {isLocked && commitmentEnd && (
              <div className="text-sm text-muted-foreground">
                Expires in: <CountdownTimer targetTimestamp={commitmentEnd} />
              </div>
            )}
          </div>

          {commitmentEnd !== undefined && commitmentEnd > 0n && (
            <div className="text-sm text-muted-foreground">
              Window end:{" "}
              <span className="font-mono">
                {new Date(Number(commitmentEnd) * 1000).toLocaleString()}
              </span>
            </div>
          )}

          {commitmentEnd !== undefined && commitmentEnd === 0n && (
            <p className="text-sm text-muted-foreground">
              No commitment window has been set. The agreement scope can be modified freely.
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Extend Commitment Window</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Set a new end date for the commitment window. The new timestamp must be later
            than the current window end.
          </p>
          <div className="space-y-2">
            <Label htmlFor="new-commitment-date">New End Date</Label>
            <Input
              id="new-commitment-date"
              type="datetime-local"
              value={newDate}
              onChange={(e) => setNewDate(e.target.value)}
            />
          </div>
          <Button onClick={handleExtend} disabled={isPending || !newDate}>
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            Extend Window
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tab 4: Ownership
// ---------------------------------------------------------------------------

function OwnershipTab({ address }: { address: `0x${string}` }) {
  return (
    <div className="space-y-6">
      <TransferOwnershipSection address={address} />
      <RenounceOwnershipSection address={address} />
    </div>
  );
}

// -- Transfer Ownership --

function TransferOwnershipSection({ address }: { address: `0x${string}` }) {
  const [newOwner, setNewOwner] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { transferOwnership, isPending } = useTransferOwnership();

  const handleTransfer = async () => {
    if (!newOwner.trim()) return;
    try {
      await transferOwnership(address, newOwner.trim() as `0x${string}`);
      setNewOwner("");
      setDialogOpen(false);
    } catch {
      // toast handled in hook
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Transfer Ownership</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Transfer ownership of this agreement to a new address. This action cannot be
          undone.
        </p>
        <div className="space-y-2">
          <Label htmlFor="new-owner">New Owner Address</Label>
          <Input
            id="new-owner"
            value={newOwner}
            onChange={(e) => setNewOwner(e.target.value)}
            placeholder="0x..."
          />
        </div>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" disabled={!newOwner.trim()}>
              Transfer Ownership
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Ownership Transfer</DialogTitle>
              <DialogDescription>
                You are about to transfer ownership of this agreement to:
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border p-3 bg-muted/50">
              <span className="font-mono text-sm break-all">{newOwner}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              After this transaction is confirmed, you will no longer be able to edit
              this agreement. This action cannot be undone.
            </p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleTransfer} disabled={isPending}>
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Shield className="mr-2 h-4 w-4" />
                )}
                Confirm Transfer
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}

// -- Renounce Ownership --

function RenounceOwnershipSection({ address }: { address: `0x${string}` }) {
  const [confirmation, setConfirmation] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const { renounceOwnership, isPending } = useRenounceOwnership();

  const isConfirmed = confirmation === "RENOUNCE";

  const handleRenounce = async () => {
    if (!isConfirmed) return;
    try {
      await renounceOwnership(address);
      setConfirmation("");
      setDialogOpen(false);
    } catch {
      // toast handled in hook
    }
  };

  return (
    <Card className="border-red-500/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-red-500">
          <AlertTriangle className="h-5 w-5" />
          Renounce Ownership
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Permanently renounce ownership of this agreement. The agreement will become
          immutable and no further changes can be made by anyone.
        </p>

        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="destructive">Renounce Ownership</Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="text-red-500">
                Renounce Ownership
              </DialogTitle>
              <DialogDescription>
                This is a destructive and irreversible operation. The agreement will
                become permanently immutable.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              <Label htmlFor="renounce-confirm">
                Type <span className="font-mono font-bold">RENOUNCE</span> to confirm
              </Label>
              <Input
                id="renounce-confirm"
                value={confirmation}
                onChange={(e) => setConfirmation(e.target.value)}
                placeholder="RENOUNCE"
              />
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setDialogOpen(false);
                  setConfirmation("");
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleRenounce}
                disabled={isPending || !isConfirmed}
              >
                {isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <AlertTriangle className="mr-2 h-4 w-4" />
                )}
                Renounce Forever
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
