"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CountdownTimer } from "@/components/ui/countdown-timer";
import { useCommitmentWindowEnd, useExtendCommitmentWindow } from "@/lib/hooks/use-agreement";
import { Lock, Unlock, Loader2 } from "lucide-react";

interface CommitmentWindowBarProps {
  agreementAddress: `0x${string}`;
}

export function CommitmentWindowBar({ agreementAddress }: CommitmentWindowBarProps) {
  const { data: windowEnd, isLoading } = useCommitmentWindowEnd(agreementAddress);
  const { extend, isPending } = useExtendCommitmentWindow();
  const [showForm, setShowForm] = useState(false);
  const [dateValue, setDateValue] = useState("");

  const timestamp = windowEnd ? BigInt(windowEnd as bigint) : 0n;
  const nowSec = BigInt(Math.floor(Date.now() / 1000));
  const isActive = timestamp > nowSec;

  const handleExtend = async () => {
    if (!dateValue) return;
    const newTimestamp = BigInt(Math.floor(new Date(dateValue).getTime() / 1000));
    await extend(agreementAddress, newTimestamp);
    setShowForm(false);
    setDateValue("");
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading commitment window...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div className="flex items-center gap-3">
            {isActive ? (
              <Lock className="h-5 w-5 text-yellow-400" />
            ) : (
              <Unlock className="h-5 w-5 text-muted-foreground" />
            )}
            <div>
              <p className="text-sm font-medium">
                Commitment Window
              </p>
              {timestamp > 0n ? (
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-muted-foreground">
                    {isActive ? "Locked until:" : "Expired"}
                  </span>
                  {isActive && (
                    <CountdownTimer targetTimestamp={timestamp} />
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No commitment window set</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2">
            {!showForm ? (
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowForm(true)}
              >
                Extend Window
              </Button>
            ) : (
              <div className="flex items-center gap-2">
                <Input
                  type="datetime-local"
                  value={dateValue}
                  onChange={(e) => setDateValue(e.target.value)}
                  className="w-auto text-sm"
                />
                <Button
                  size="sm"
                  disabled={isPending || !dateValue}
                  onClick={handleExtend}
                >
                  {isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                  Confirm
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setShowForm(false);
                    setDateValue("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
