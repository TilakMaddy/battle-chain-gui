"use client";

import { useState, useEffect } from "react";

export interface Deployment {
  id: number;
  contract_address: string;
  tx_hash: string;
  deployer: string;
  label: string;
  created_at: string;
}

export function useDeployments() {
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/deployments")
      .then((r) => r.json())
      .then((data) => setDeployments(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  return { deployments, loading };
}
