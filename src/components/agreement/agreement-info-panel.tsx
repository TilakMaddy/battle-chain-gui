"use client";

import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyableAddress } from "@/components/ui/copyable-address";
import { useAgreementInfo } from "@/lib/hooks/use-attack-registry";
import { ChevronDown, ChevronUp, Loader2 } from "lucide-react";

interface AgreementInfoPanelProps {
  agreementAddress: `0x${string}`;
}

export function AgreementInfoPanel({ agreementAddress }: AgreementInfoPanelProps) {
  const { info, isLoading } = useAgreementInfo(agreementAddress);
  const [expanded, setExpanded] = useState(false);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading agreement info...
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!info) return null;

  return (
    <Card>
      <CardContent className="py-4 space-y-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded((prev) => !prev)}
          className="w-full justify-between"
        >
          <span className="text-sm font-medium">
            {expanded ? "Hide Debug Info" : "Show Debug Info"}
          </span>
          {expanded ? (
            <ChevronUp className="h-4 w-4" />
          ) : (
            <ChevronDown className="h-4 w-4" />
          )}
        </Button>

        {expanded && (
          <div className="rounded-lg border bg-muted/50 p-4 space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              AgreementInfo Struct
            </h4>

            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <span className="font-mono text-muted-foreground w-56 shrink-0">
                  attackModerator:
                </span>
                <CopyableAddress address={info.attackModerator} truncate={false} />
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-muted-foreground w-56 shrink-0">
                  deadlineTimestamp:
                </span>
                <pre className="font-mono text-sm">
                  {info.deadlineTimestamp.toString()}
                  {info.deadlineTimestamp > 0n && (
                    <span className="text-muted-foreground ml-2">
                      ({new Date(Number(info.deadlineTimestamp) * 1000).toISOString()})
                    </span>
                  )}
                </pre>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-muted-foreground w-56 shrink-0">
                  promotionRequestedTimestamp:
                </span>
                <pre className="font-mono text-sm">
                  {info.promotionRequestedTimestamp.toString()}
                  {info.promotionRequestedTimestamp > 0n && (
                    <span className="text-muted-foreground ml-2">
                      ({new Date(Number(info.promotionRequestedTimestamp) * 1000).toISOString()})
                    </span>
                  )}
                </pre>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-muted-foreground w-56 shrink-0">
                  attackRequested:
                </span>
                <pre className="font-mono text-sm">
                  {info.attackRequested.toString()}
                </pre>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-muted-foreground w-56 shrink-0">
                  attackApproved:
                </span>
                <pre className="font-mono text-sm">
                  {info.attackApproved.toString()}
                </pre>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-muted-foreground w-56 shrink-0">
                  promoted:
                </span>
                <pre className="font-mono text-sm">
                  {info.promoted.toString()}
                </pre>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-muted-foreground w-56 shrink-0">
                  corrupted:
                </span>
                <pre className="font-mono text-sm">
                  {info.corrupted.toString()}
                </pre>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-muted-foreground w-56 shrink-0">
                  isRegistered:
                </span>
                <pre className="font-mono text-sm">
                  {info.isRegistered.toString()}
                </pre>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
