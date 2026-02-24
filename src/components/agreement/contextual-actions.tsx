"use client";

import { useState } from "react";
import { ContractState } from "@/lib/contracts/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useRequestAttackMode,
  useGoToProduction,
  useRequestPromotion,
  useMarkCorrupted,
  useCancelPromotion,
  usePromote,
  useTransferAttackModerator,
  useAuthorizeAgreementOwner,
} from "@/lib/hooks/use-attack-registry";
import {
  Loader2,
  Swords,
  TrendingUp,
  Shield,
  AlertTriangle,
  ArrowRight,
  UserPlus,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

interface ContextualActionsProps {
  agreementAddress: `0x${string}`;
  state: ContractState;
  isOwner: boolean;
}

export function ContextualActions({
  agreementAddress,
  state,
  isOwner,
}: ContextualActionsProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" /> Actions
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {state === ContractState.NEW_DEPLOYMENT && (
          <NewDeploymentActions
            agreementAddress={agreementAddress}
            isOwner={isOwner}
          />
        )}
        {state === ContractState.ATTACK_REQUESTED && (
          <AttackRequestedActions />
        )}
        {state === ContractState.UNDER_ATTACK && (
          <UnderAttackActions
            agreementAddress={agreementAddress}
            isOwner={isOwner}
          />
        )}
        {state === ContractState.PROMOTION_REQUESTED && (
          <PromotionRequestedActions
            agreementAddress={agreementAddress}
            isOwner={isOwner}
          />
        )}
        {state === ContractState.PRODUCTION && (
          <ProductionActions
            agreementAddress={agreementAddress}
            isOwner={isOwner}
          />
        )}
        {state === ContractState.CORRUPTED && <CorruptedActions />}
        {state === ContractState.NOT_DEPLOYED && (
          <p className="text-sm text-muted-foreground">
            This agreement has not been deployed yet.
          </p>
        )}
      </CardContent>
    </Card>
  );
}

/* ------------------------------------------------------------------ */
/* NEW_DEPLOYMENT                                                      */
/* ------------------------------------------------------------------ */

function NewDeploymentActions({
  agreementAddress,
  isOwner,
}: {
  agreementAddress: `0x${string}`;
  isOwner: boolean;
}) {
  const { requestAttack, isPending: attackPending } = useRequestAttackMode();
  const { goToProduction, isPending: prodPending } = useGoToProduction();
  const { authorizeOwner, isPending: authPending } = useAuthorizeAgreementOwner();
  const [authAddress, setAuthAddress] = useState("");

  if (!isOwner) {
    return (
      <p className="text-sm text-muted-foreground">
        Only the agreement owner can perform actions in this state.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <Button
          onClick={() => requestAttack(agreementAddress)}
          disabled={attackPending}
          className="bg-red-600 hover:bg-red-700"
        >
          {attackPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <Swords className="mr-2 h-4 w-4" />
          Request Attack Mode
        </Button>
        <Button
          variant="outline"
          onClick={() => goToProduction(agreementAddress)}
          disabled={prodPending}
        >
          {prodPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          <ArrowRight className="mr-2 h-4 w-4" />
          Go to Production
        </Button>
      </div>

      <div className="border-t pt-4">
        <p className="text-sm font-medium mb-2">Authorize Owner</p>
        <div className="flex items-center gap-2">
          <Input
            placeholder="0x... owner address"
            value={authAddress}
            onChange={(e) => setAuthAddress(e.target.value)}
            className="font-mono text-sm"
          />
          <Button
            size="sm"
            disabled={authPending || !authAddress.startsWith("0x")}
            onClick={() =>
              authorizeOwner(
                agreementAddress,
                authAddress as `0x${string}`,
              )
            }
          >
            {authPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
            <UserPlus className="mr-2 h-4 w-4" />
            Authorize
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* ATTACK_REQUESTED                                                    */
/* ------------------------------------------------------------------ */

function AttackRequestedActions() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-4">
      <Loader2 className="h-5 w-5 text-yellow-400 animate-spin" />
      <div>
        <p className="text-sm font-medium text-yellow-400">
          Awaiting DAO Review
        </p>
        <p className="text-xs text-muted-foreground">
          The attack request is pending approval from the DAO moderator.
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* UNDER_ATTACK                                                        */
/* ------------------------------------------------------------------ */

function UnderAttackActions({
  agreementAddress,
  isOwner,
}: {
  agreementAddress: `0x${string}`;
  isOwner: boolean;
}) {
  const { requestPromotion, isPending: promoPending } = useRequestPromotion();
  const { markCorrupted, isPending: corruptPending } = useMarkCorrupted();
  const { transferModerator, isPending: transferPending } = useTransferAttackModerator();
  const [moderatorAddress, setModeratorAddress] = useState("");
  const [corruptDialogOpen, setCorruptDialogOpen] = useState(false);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link href={`/attack/${agreementAddress}`}>
          <Button variant="destructive">
            <Swords className="mr-2 h-4 w-4" />
            View Attack Panel
          </Button>
        </Link>
      </div>

      {isOwner && (
        <>
          <div className="flex flex-wrap gap-3">
            <Button
              variant="outline"
              onClick={() => requestPromotion(agreementAddress)}
              disabled={promoPending}
            >
              {promoPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <TrendingUp className="mr-2 h-4 w-4" />
              Request Promotion
            </Button>

            <Dialog open={corruptDialogOpen} onOpenChange={setCorruptDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="destructive">
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  Mark Corrupted
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Mark Agreement as Corrupted</DialogTitle>
                  <DialogDescription>
                    This action is irreversible. The agreement will be permanently
                    marked as corrupted and cannot be recovered. Are you sure you
                    want to proceed?
                  </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                  <Button
                    variant="outline"
                    onClick={() => setCorruptDialogOpen(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    variant="destructive"
                    disabled={corruptPending}
                    onClick={async () => {
                      await markCorrupted(agreementAddress);
                      setCorruptDialogOpen(false);
                    }}
                  >
                    {corruptPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    Confirm -- Mark Corrupted
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <div className="border-t pt-4">
            <p className="text-sm font-medium mb-2">Transfer Attack Moderator</p>
            <div className="flex items-center gap-2">
              <Input
                placeholder="0x... new moderator address"
                value={moderatorAddress}
                onChange={(e) => setModeratorAddress(e.target.value)}
                className="font-mono text-sm"
              />
              <Button
                size="sm"
                disabled={transferPending || !moderatorAddress.startsWith("0x")}
                onClick={() =>
                  transferModerator(
                    agreementAddress,
                    moderatorAddress as `0x${string}`,
                  )
                }
              >
                {transferPending && (
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                )}
                <RefreshCw className="mr-2 h-4 w-4" />
                Transfer
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PROMOTION_REQUESTED                                                 */
/* ------------------------------------------------------------------ */

function PromotionRequestedActions({
  agreementAddress,
  isOwner,
}: {
  agreementAddress: `0x${string}`;
  isOwner: boolean;
}) {
  const { cancel, isPending: cancelPending } = useCancelPromotion();
  const { promote, isPending: promotePending } = usePromote();

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-lg border border-purple-500/30 bg-purple-500/10 p-4">
        <TrendingUp className="h-5 w-5 text-purple-400" />
        <div>
          <p className="text-sm font-medium text-purple-400">
            Promotion Requested
          </p>
          <p className="text-xs text-muted-foreground">
            The agreement is awaiting promotion to production.
          </p>
        </div>
      </div>

      {isOwner && (
        <div className="flex flex-wrap gap-3">
          <Button
            variant="outline"
            onClick={() => cancel(agreementAddress)}
            disabled={cancelPending}
          >
            {cancelPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Cancel Promotion
          </Button>
          <Button
            onClick={() => promote(agreementAddress)}
            disabled={promotePending}
          >
            {promotePending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <TrendingUp className="mr-2 h-4 w-4" />
            Promote
          </Button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* PRODUCTION                                                          */
/* ------------------------------------------------------------------ */

function ProductionActions({
  agreementAddress,
  isOwner,
}: {
  agreementAddress: `0x${string}`;
  isOwner: boolean;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3 rounded-lg border border-green-500/30 bg-green-500/10 p-4">
        <Shield className="h-5 w-5 text-green-400" />
        <div>
          <p className="text-sm font-medium text-green-400">In Production</p>
          <p className="text-xs text-muted-foreground">
            This agreement is live and active in production.
          </p>
        </div>
      </div>

      {isOwner && (
        <Link href={`/agreements/${agreementAddress}/edit`}>
          <Button variant="outline">
            Edit Agreement
          </Button>
        </Link>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* CORRUPTED                                                           */
/* ------------------------------------------------------------------ */

function CorruptedActions() {
  return (
    <div className="flex items-center gap-3 rounded-lg border border-red-900/30 bg-red-900/10 p-4">
      <AlertTriangle className="h-5 w-5 text-red-400" />
      <div>
        <p className="text-sm font-medium text-red-400">Corrupted</p>
        <p className="text-xs text-muted-foreground">
          This agreement has been permanently marked as corrupted. No further
          actions are available.
        </p>
      </div>
    </div>
  );
}
