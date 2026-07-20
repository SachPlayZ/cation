import { SignJWT, jwtVerify } from "jose";
import bcrypt from "bcryptjs";
import { getCollection } from "./mongo";

export type Role = "cfo" | "agent" | "compliance" | "recipient";

export interface JwtPayload {
  sub: string;
  role: Role;
  party: string;
}

export interface UserDoc {
  username: string;
  passwordHash: string;
  role: Role;
  party: string;
  displayName: string;
}

function jwtSecret(): Uint8Array {
  const s = process.env.JWT_SECRET;
  if (!s) throw new Error("JWT_SECRET is not set");
  return new TextEncoder().encode(s);
}

export async function signToken(payload: JwtPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(jwtSecret());
}

export async function verifyToken(token: string): Promise<JwtPayload> {
  const { payload } = await jwtVerify(token, jwtSecret());
  return payload as unknown as JwtPayload;
}

export async function loginUser(
  username: string,
  password: string
): Promise<UserDoc | null> {
  const users = await getCollection<UserDoc>("users");
  const user = await users.findOne({ username });
  if (!user) return null;
  const ok = await bcrypt.compare(password, user.passwordHash);
  return ok ? user : null;
}

/** Extract and verify Bearer token from Authorization header. */
export async function requireAuth(
  req: Request,
  allowedRoles?: Role[]
): Promise<JwtPayload> {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) throw new AuthError(401, "UNAUTHENTICATED", "Missing token");

  let payload: JwtPayload;
  try {
    payload = await verifyToken(token);
  } catch {
    throw new AuthError(401, "UNAUTHENTICATED", "Invalid token");
  }

  if (allowedRoles && !allowedRoles.includes(payload.role)) {
    throw new AuthError(403, "FORBIDDEN", "Insufficient role");
  }

  return payload;
}

export class AuthError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "AuthError";
  }
}
