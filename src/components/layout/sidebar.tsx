"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { cn } from "@/lib/utils";
import { useState } from "react";
import {
  LayoutDashboard,
  Rocket,
  FileText,
  Swords,
  Shield,
  Search,
  Vote,
  TrendingUp,
  Clock,
  Radio,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navGroups = [
  {
    label: "PROTOCOL",
    items: [
      { href: "/", label: "Dashboard", icon: LayoutDashboard },
      { href: "/deploy", label: "Deploy", icon: Rocket },
      { href: "/agreements", label: "Agreements", icon: FileText },
    ],
  },
  {
    label: "SECURITY",
    items: [
      { href: "/attack", label: "Attack Hub", icon: Swords },
      { href: "/whitehat", label: "Whitehat", icon: Shield },
      { href: "/inspector", label: "Inspector", icon: Search },
    ],
  },
  {
    label: "GOVERNANCE",
    items: [
      { href: "/dao", label: "DAO Review", icon: Vote },
      { href: "/promotion", label: "Promotion", icon: TrendingUp },
    ],
  },
  {
    label: "MONITOR",
    items: [
      { href: "/activity", label: "Activity", icon: Clock },
      { href: "/status", label: "Chain Status", icon: Radio },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

  return (
    <TooltipProvider delayDuration={0}>
      <aside
        className={cn(
          "sticky top-0 flex h-screen flex-col border-r border-border/40 bg-background/95 backdrop-blur-sm transition-all duration-200",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo */}
        <div className="flex h-16 items-center gap-2 border-b border-border/40 px-4">
          <Swords className="h-6 w-6 shrink-0 text-red-500" />
          {!collapsed && <span className="text-lg font-bold">BattleChain</span>}
        </div>

        {/* Nav Groups */}
        <nav className="flex-1 overflow-y-auto px-2 py-4">
          {navGroups.map((group) => (
            <div key={group.label} className="mb-4">
              {!collapsed && (
                <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60">
                  {group.label}
                </p>
              )}
              {collapsed && <div className="mb-1 border-t border-border/20" />}
              <div className="space-y-0.5">
                {group.items.map(({ href, label, icon: Icon }) => {
                  const isActive =
                    href === "/"
                      ? pathname === "/"
                      : pathname.startsWith(href);

                  const link = (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-accent text-accent-foreground"
                          : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                        collapsed && "justify-center px-0"
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>{label}</span>}
                    </Link>
                  );

                  if (collapsed) {
                    return (
                      <Tooltip key={href}>
                        <TooltipTrigger asChild>{link}</TooltipTrigger>
                        <TooltipContent side="right" sideOffset={8}>
                          {label}
                        </TooltipContent>
                      </Tooltip>
                    );
                  }

                  return link;
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Bottom Section */}
        <div className="border-t border-border/40 p-3 space-y-3">
          <div className={cn("flex", collapsed ? "justify-center" : "")}>
            <ConnectButton
              showBalance={false}
              chainStatus={collapsed ? "none" : "icon"}
              accountStatus={collapsed ? "avatar" : "address"}
            />
          </div>
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="flex w-full items-center justify-center rounded-md p-2 text-muted-foreground hover:bg-accent/50 hover:text-foreground transition-colors"
          >
            {collapsed ? (
              <PanelLeftOpen className="h-4 w-4" />
            ) : (
              <PanelLeftClose className="h-4 w-4" />
            )}
          </button>
        </div>
      </aside>
    </TooltipProvider>
  );
}
