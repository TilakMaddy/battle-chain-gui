"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface CountdownTimerProps {
  targetTimestamp: bigint;
  className?: string;
  expiredLabel?: string;
}

function formatDuration(seconds: number): string {
  if (seconds <= 0) return "0s";
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;

  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0) parts.push(`${m}m`);
  if (s > 0 || parts.length === 0) parts.push(`${s}s`);
  return parts.join(" ");
}

export function CountdownTimer({ targetTimestamp, className, expiredLabel = "Expired" }: CountdownTimerProps) {
  const [remaining, setRemaining] = useState<number>(() => {
    const now = Math.floor(Date.now() / 1000);
    return Math.max(0, Number(targetTimestamp) - now);
  });

  useEffect(() => {
    const tick = () => {
      const now = Math.floor(Date.now() / 1000);
      setRemaining(Math.max(0, Number(targetTimestamp) - now));
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [targetTimestamp]);

  const isExpired = remaining === 0;

  return (
    <span
      className={cn(
        "font-mono text-sm",
        isExpired ? "text-muted-foreground" : "text-yellow-400",
        className
      )}
    >
      {isExpired ? expiredLabel : formatDuration(remaining)}
    </span>
  );
}
