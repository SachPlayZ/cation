import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, handleError } from "@/lib/apiResponse";
import { queryAcs, tid } from "@/lib/ledger";

export async function GET(req: NextRequest) {
  try {
    const jwt = await requireAuth(req, ["cfo"]);
    const cfoParty = process.env.PARTY_CFO!;

    // Sum all DemoDeposits owned by the cfo party (treasury holdings).
    // The cfo is the issuer/signatory of all DemoDeposits, so it sees them all.
    const deposits = await queryAcs(
      cfoParty,
      tid("Cation.Asset", "DemoDeposit")
    );

    const treasuryDeposits = deposits.filter(
      (d) => d.payload["owner"] === cfoParty
    );

    const total = treasuryDeposits.reduce(
      (sum, d) => sum + Number(d.payload["amount"] ?? 0),
      0
    );

    const currency =
      treasuryDeposits.length > 0
        ? String(treasuryDeposits[0].payload["currency"] ?? "USD")
        : "USD";

    return ok({ balance: total.toFixed(2), currency });
  } catch (err) {
    return handleError(err);
  }
}
