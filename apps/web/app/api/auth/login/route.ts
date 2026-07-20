import { NextRequest } from "next/server";
import { loginUser, signToken } from "@/lib/auth";
import { ok, apiError } from "@/lib/apiResponse";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      username?: string;
      password?: string;
    };
    const { username, password } = body;
    if (!username || !password) {
      return apiError(400, "BAD_REQUEST", "username and password required");
    }

    const user = await loginUser(username, password);
    if (!user) {
      return apiError(401, "INVALID_CREDENTIALS", "Bad username or password");
    }

    const token = await signToken({
      sub: user.username,
      role: user.role,
      party: user.party,
    });

    return ok({ token, role: user.role, displayName: user.displayName });
  } catch (err) {
    console.error("[login]", err);
    return apiError(500, "INTERNAL", "Internal server error");
  }
}
