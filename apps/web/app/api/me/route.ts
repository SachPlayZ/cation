import { NextRequest } from "next/server";
import { requireAuth } from "@/lib/auth";
import { ok, handleError } from "@/lib/apiResponse";
import { getCollection } from "@/lib/mongo";
import type { UserDoc } from "@/lib/auth";

export async function GET(req: NextRequest) {
  try {
    const jwt = await requireAuth(req);
    const users = await getCollection<UserDoc>("users");
    const user = await users.findOne({ username: jwt.sub });
    return ok({
      role: jwt.role,
      party: jwt.party,
      displayName: user?.displayName ?? jwt.sub,
    });
  } catch (err) {
    return handleError(err);
  }
}
