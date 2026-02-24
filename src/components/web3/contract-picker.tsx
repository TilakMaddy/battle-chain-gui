"use client";

import { useDeployments } from "@/lib/hooks/use-deployments";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

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

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {deployments.length > 0 && (
        <Select
          value={value}
          onValueChange={onChange}
        >
          <SelectTrigger className="w-full font-mono">
            <SelectValue placeholder="Select a deployed contract..." />
          </SelectTrigger>
          <SelectContent>
            {deployments.map((d) => (
              <SelectItem key={d.id} value={d.contract_address}>
                {d.label ? `${d.label} — ` : ""}
                {d.contract_address.slice(0, 10)}...{d.contract_address.slice(-8)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Input
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono"
      />
      {deployments.length === 0 && (
        <p className="text-xs text-muted-foreground">
          No deployed contracts found. Deploy one first.
        </p>
      )}
    </div>
  );
}
