"use client";

import { useState, useEffect } from "react";
import { useDeployments } from "@/lib/hooks/use-deployments";
import { CONTRACTS } from "@/lib/contracts/addresses";
import { ContractState, CONTRACT_STATE_LABELS } from "@/lib/contracts/types";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://testnet.battlechain.com:3051";

const SIG_STATE_CHANGED =
  "0xf7e4eae80290e2a6acfee094f30d26c550648115112acc13da4e0efb47a7d5cd";
const SIG_REGISTERED =
  "0x768fb430a0d4b201cb764ab221c316dd14d8babf2e4b2348e05964c6565318b6";

interface RegistryContract {
  address: string;
  state: ContractState;
  label: string;
}

async function fetchRegistryContracts(): Promise<RegistryContract[]> {
  try {
    const res = await fetch(RPC_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        method: "eth_getLogs",
        params: [
          {
            address: CONTRACTS.AttackRegistry,
            fromBlock: "0x0",
            toBlock: "latest",
          },
        ],
        id: 1,
      }),
    });
    const json = await res.json();
    if (json.error || !json.result) return [];

    const map = new Map<string, ContractState>();
    for (const log of json.result) {
      const topics = log.topics;
      if (!topics || topics.length < 2) continue;
      const sig = topics[0];

      if (sig === SIG_REGISTERED) {
        const addr = ("0x" + topics[1].slice(26)).toLowerCase();
        if (!map.has(addr)) {
          map.set(addr, ContractState.NEW_DEPLOYMENT);
        }
      } else if (sig === SIG_STATE_CHANGED) {
        const addr = ("0x" + topics[1].slice(26)).toLowerCase();
        const data: string = log.data ?? "0x";
        let newState = 0;
        if (data.length >= 66) {
          newState = parseInt(data.slice(2, 66), 16);
        }
        if (newState >= 0 && newState <= 6) {
          map.set(addr, newState as ContractState);
        }
      }
    }

    return Array.from(map.entries()).map(([address, state]) => ({
      address,
      state,
      label: CONTRACT_STATE_LABELS[state] ?? "",
    }));
  } catch {
    return [];
  }
}

interface ContractPickerProps {
  value: string;
  onChange: (address: string) => void;
  label?: string;
  placeholder?: string;
}

export function ContractPicker({
  value,
  onChange,
  label = "Contract Address",
  placeholder = "0x...",
}: ContractPickerProps) {
  const { deployments } = useDeployments();
  const [registryContracts, setRegistryContracts] = useState<
    RegistryContract[]
  >([]);

  useEffect(() => {
    fetchRegistryContracts().then(setRegistryContracts);
  }, []);

  // Merge: registry contracts + local deployments (deduped)
  const seen = new Set<string>();
  const options: { address: string; label: string }[] = [];

  for (const rc of registryContracts) {
    const addr = rc.address.toLowerCase();
    if (seen.has(addr)) continue;
    seen.add(addr);
    const localMatch = deployments.find(
      (d) => d.contract_address.toLowerCase() === addr
    );
    const name = localMatch?.label || rc.label;
    options.push({
      address: rc.address,
      label: name
        ? `${name} — ${rc.address.slice(0, 10)}...${rc.address.slice(-6)}`
        : `${rc.address.slice(0, 10)}...${rc.address.slice(-6)}`,
    });
  }

  for (const d of deployments) {
    const addr = d.contract_address.toLowerCase();
    if (seen.has(addr)) continue;
    seen.add(addr);
    options.push({
      address: d.contract_address,
      label: d.label
        ? `${d.label} — ${d.contract_address.slice(0, 10)}...${d.contract_address.slice(-6)}`
        : `${d.contract_address.slice(0, 10)}...${d.contract_address.slice(-6)}`,
    });
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {options.length > 0 ? (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className="w-full font-mono">
            <SelectValue placeholder="Select a contract..." />
          </SelectTrigger>
          <SelectContent>
            {options.map((o) => (
              <SelectItem key={o.address} value={o.address}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <p className="text-xs text-muted-foreground">
          Loading contracts from registry...
        </p>
      )}
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono"
      />
    </div>
  );
}
