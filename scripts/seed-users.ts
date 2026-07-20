/**
 * Seed MongoDB demo users + optionally create the initial treasury DemoDeposit.
 * Safe to re-run (upserts; does not duplicate).
 *
 * Usage:
 *   npm run seed              (from monorepo root)
 *   npx tsx scripts/seed-users.ts
 *
 * Requires: MONGODB_URI, PARTY_CFO, PARTY_AGENT, PARTY_COMPLIANCE,
 *           PARTY_OPS, PARTY_RESERVE, LEDGER_API_URL, LEDGER_AUTH_MODE
 *           (+ LEDGER_STATIC_TOKEN or OIDC vars depending on mode)
 */

import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
import * as dotenv from "dotenv";
import { resolve } from "path";

// Load .env from project root.
dotenv.config({ path: resolve(__dirname, "../.env") });

const DEMO_PASSWORD = "cation-demo";
const SALT_ROUNDS = 10;

interface UserSeed {
  username: string;
  role: "cfo" | "agent" | "compliance" | "recipient";
  displayName: string;
  partyEnvKey: string;
}

const USERS: UserSeed[] = [
  {
    username: "cfo",
    role: "cfo",
    displayName: "CFO",
    partyEnvKey: "PARTY_CFO",
  },
  {
    username: "agent",
    role: "agent",
    displayName: "AI Agent Console",
    partyEnvKey: "PARTY_AGENT",
  },
  {
    username: "compliance",
    role: "compliance",
    displayName: "Compliance Officer",
    partyEnvKey: "PARTY_COMPLIANCE",
  },
  {
    username: "recipient",
    role: "recipient",
    displayName: "Ops Account (Recipient)",
    partyEnvKey: "PARTY_OPS",
  },
];

async function seedUsers(db: ReturnType<MongoClient["db"]>) {
  const users = db.collection("users");
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, SALT_ROUNDS);

  for (const u of USERS) {
    const party = process.env[u.partyEnvKey];
    if (!party) {
      console.warn(`[seed] WARN: ${u.partyEnvKey} not set — skipping ${u.username}`);
      continue;
    }

    await users.updateOne(
      { username: u.username },
      {
        $set: {
          username: u.username,
          passwordHash,
          role: u.role,
          party,
          displayName: u.displayName,
        },
      },
      { upsert: true }
    );
    console.log(`[seed] upserted user: ${u.username} → party ${party}`);
  }
}

async function seedTreasuryDeposit() {
  const ledgerUrl = process.env.LEDGER_API_URL;
  const cfoParty = process.env.PARTY_CFO;
  const agentParty = process.env.PARTY_AGENT;

  if (!ledgerUrl || !cfoParty || !agentParty) {
    console.log("[seed] Skipping treasury deposit (LEDGER_API_URL or PARTY_CFO/AGENT not set)");
    return;
  }

  // Dynamically import ledger client (requires env to be loaded first).
  const { createContract, queryAcs, tid } = await import(
    resolve(__dirname, "../apps/web/lib/ledger")
  );

  // Check if treasury deposit already exists.
  const existing = await queryAcs(cfoParty, tid("Cation.Asset", "DemoDeposit"));
  const ours = existing.filter((d) => d.payload["owner"] === cfoParty);
  if (ours.length > 0) {
    const total = ours.reduce((s, d) => s + Number(d.payload["amount"] ?? 0), 0);
    console.log(`[seed] Treasury deposit already exists (balance: ${total} USD). Skipping.`);
    return;
  }

  console.log("[seed] Creating initial treasury DemoDeposit ($10,000 USD)...");
  await createContract(
    tid("Cation.Asset", "DemoDeposit"),
    {
      issuer: cfoParty,
      owner: cfoParty,
      currency: "USD",
      amount: "10000.00",
      delegates: [agentParty], // Agent observes the treasury so it can reference it in RequestAction
    },
    { actAs: [cfoParty], commandId: "seed-treasury-deposit" }
  );
  console.log("[seed] Treasury deposit created.");
}

async function main() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error("[seed] MONGODB_URI is not set");
    process.exit(1);
  }

  const client = new MongoClient(uri);
  try {
    await client.connect();
    const db = client.db("cation");

    // Ensure indexes.
    await db.collection("users").createIndex({ username: 1 }, { unique: true });

    await seedUsers(db);
    await seedTreasuryDeposit();

    console.log("[seed] Done.");
  } finally {
    await client.close();
  }
}

main().catch((err) => {
  console.error("[seed] Fatal:", err);
  process.exit(1);
});
