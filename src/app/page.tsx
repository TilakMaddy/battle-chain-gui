"use client";

import { useAccount } from "wagmi";
import { ChainGuard } from "@/components/web3/chain-guard";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StateBadge } from "@/components/web3/state-badge";
import { useAgreementEvents } from "@/lib/hooks/use-attack-registry";

import Link from "next/link";
import {
  Rocket,
  FileText,
  Swords,
  Vote,
  TrendingUp,
  Activity,
} from "lucide-react";

const quickActions = [
  { href: "/deploy", label: "Deploy Contract", icon: Rocket, color: "text-blue-400" },
  { href: "/agreements/create", label: "Create Agreement", icon: FileText, color: "text-green-400" },
  { href: "/attack", label: "Attack Hub", icon: Swords, color: "text-red-400" },
  { href: "/dao", label: "DAO Review", icon: Vote, color: "text-purple-400" },
  { href: "/promotion", label: "Promotions", icon: TrendingUp, color: "text-yellow-400" },
];

export default function DashboardPage() {
  return (
    <ChainGuard>
      <DashboardContent />
    </ChainGuard>
  );
}

function DashboardContent() {
  const { address } = useAccount();
  const events = useAgreementEvents();

  return (
    <div className="space-y-8">
      <PageHeader
        title="Dashboard"
        description={`Connected as ${address?.slice(0, 6)}...${address?.slice(-4)}`}
      />

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {quickActions.map(({ href, label, icon: Icon, color }) => (
          <Link key={href} href={href}>
            <Card className="cursor-pointer transition-colors hover:bg-accent/50">
              <CardContent className="flex flex-col items-center gap-2 p-6">
                <Icon className={`h-8 w-8 ${color}`} />
                <span className="text-sm font-medium">{label}</span>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Activity Feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            Live Activity Feed
          </CardTitle>
        </CardHeader>
        <CardContent>
          {events.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">
              Listening for on-chain events... State changes will appear here in real-time.
            </p>
          ) : (
            <div className="space-y-3">
              {events.slice(0, 20).map((event, i) => (
                <div
                  key={`${event.agreementAddress}-${event.blockNumber}-${i}`}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <Link
                      href={`/agreements/${event.agreementAddress}`}
                      className="font-mono text-sm text-blue-400 hover:underline"
                    >
                      {event.agreementAddress.slice(0, 10)}...{event.agreementAddress.slice(-6)}
                    </Link>
                    <span className="text-muted-foreground text-sm">&rarr;</span>
                    <StateBadge state={event.newState} />
                  </div>
                  <span className="text-xs text-muted-foreground font-mono">
                    Block #{event.blockNumber.toString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
