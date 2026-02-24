"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

interface CopyableAddressProps {
  address: string;
  truncate?: boolean;
  className?: string;
}

export function CopyableAddress({ address, truncate = true, className }: CopyableAddressProps) {
  const [copied, setCopied] = useState(false);

  const display = truncate && address.length > 16
    ? `${address.slice(0, 6)}...${address.slice(-4)}`
    : address;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <button
      onClick={handleCopy}
      className={cn(
        "inline-flex items-center gap-1.5 font-mono text-sm hover:text-foreground transition-colors",
        className
      )}
      title={address}
    >
      <span>{display}</span>
      {copied ? (
        <Check className="h-3.5 w-3.5 text-green-400" />
      ) : (
        <Copy className="h-3.5 w-3.5 text-muted-foreground" />
      )}
    </button>
  );
}
