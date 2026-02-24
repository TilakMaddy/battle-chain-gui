import { NextResponse } from "next/server";
import { writeFile, mkdir, rm } from "fs/promises";
import { execFile } from "child_process";
import { randomUUID } from "crypto";
import { tmpdir } from "os";
import { join } from "path";

const MAX_SOURCE_LENGTH = 50_000;
const COMPILE_TIMEOUT_MS = 30_000;

function forge(args: string[], cwd: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile("forge", args, { cwd, timeout: COMPILE_TIMEOUT_MS }, (err, stdout, stderr) => {
      if (err) reject(new Error(stderr || err.message));
      else resolve(stdout.trim());
    });
  });
}

export async function POST(req: Request) {
  let workDir: string | null = null;

  try {
    const { source, contractName } = await req.json();

    if (!source || typeof source !== "string") {
      return NextResponse.json({ error: "Missing source code" }, { status: 400 });
    }

    if (source.length > MAX_SOURCE_LENGTH) {
      return NextResponse.json({ error: "Source code too large" }, { status: 400 });
    }

    if (!contractName || typeof contractName !== "string" || !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(contractName)) {
      return NextResponse.json({ error: "Invalid contract name" }, { status: 400 });
    }

    // Create isolated temp directory
    const id = randomUUID();
    workDir = join(tmpdir(), `bc-compile-${id}`);
    const srcDir = join(workDir, "src");
    await mkdir(srcDir, { recursive: true });

    // Write foundry.toml (minimal config, no dependencies)
    await writeFile(
      join(workDir, "foundry.toml"),
      `[profile.default]\nsrc = "src"\nout = "out"\nlibs = []\n`
    );

    // Write source file
    await writeFile(join(srcDir, `${contractName}.sol`), source);

    // Compile and extract bytecode
    const bytecode = await forge(
      ["inspect", contractName, "bytecode", "--root", workDir],
      workDir
    );

    if (!bytecode.startsWith("0x")) {
      return NextResponse.json({ error: "Compilation produced no bytecode" }, { status: 422 });
    }

    return NextResponse.json({ bytecode });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Compilation failed";
    return NextResponse.json({ error: message }, { status: 422 });
  } finally {
    if (workDir) {
      rm(workDir, { recursive: true, force: true }).catch(() => {});
    }
  }
}
