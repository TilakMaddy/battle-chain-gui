import { NextResponse } from "next/server";
import { insertDeployment, getAllDeployments } from "@/lib/db";

export async function GET() {
  const deployments = getAllDeployments();
  return NextResponse.json(deployments);
}

export async function POST(req: Request) {
  const body = await req.json();

  const { contract_address, tx_hash, deployer, label } = body;

  if (!contract_address || !tx_hash || !deployer) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  insertDeployment({ contract_address, tx_hash, deployer, label: label || "" });
  return NextResponse.json({ ok: true });
}
