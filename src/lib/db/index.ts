import Database from "better-sqlite3";
import { join } from "path";

const DB_PATH = join(process.cwd(), "db", "battlechain.db");

let _db: Database.Database | null = null;

function getDb() {
  if (!_db) {
    _db = new Database(DB_PATH);
    _db.pragma("journal_mode = WAL");
    _db.exec(`
      CREATE TABLE IF NOT EXISTS deployments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contract_address TEXT NOT NULL,
        tx_hash TEXT NOT NULL,
        deployer TEXT NOT NULL,
        label TEXT DEFAULT '',
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }
  return _db;
}

export interface Deployment {
  id: number;
  contract_address: string;
  tx_hash: string;
  deployer: string;
  label: string;
  created_at: string;
}

export function insertDeployment(d: Omit<Deployment, "id" | "created_at">) {
  const db = getDb();
  const stmt = db.prepare(
    "INSERT INTO deployments (contract_address, tx_hash, deployer, label) VALUES (?, ?, ?, ?)"
  );
  return stmt.run(d.contract_address, d.tx_hash, d.deployer, d.label || "");
}

export function getAllDeployments(): Deployment[] {
  const db = getDb();
  return db.prepare("SELECT * FROM deployments ORDER BY id DESC").all() as Deployment[];
}

export function getDeploymentByAddress(address: string): Deployment | undefined {
  const db = getDb();
  return db.prepare("SELECT * FROM deployments WHERE contract_address = ?").get(address) as Deployment | undefined;
}
