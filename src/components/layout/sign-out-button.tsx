"use client";

import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";

export function SignOutButton() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const hostname = window.location.hostname;
    setVisible(
      hostname === "oatmilk.work" || hostname.endsWith(".oatmilk.work")
    );
  }, []);

  if (!visible) return null;

  return (
    <a
      href="https://auth.oatmilk.work/flows/-/default/invalidation/"
      className="fixed top-4 right-4 z-40 flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
    >
      <LogOut className="h-4 w-4" />
      <span>Sign Out</span>
    </a>
  );
}
