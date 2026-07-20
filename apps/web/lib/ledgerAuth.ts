/**
 * Pluggable ledger token provider.
 * Mode is chosen by LEDGER_AUTH_MODE env var.
 * Tokens NEVER leave the server.
 */

type AuthMode = "oidc" | "token" | "external-party";

// Cache tokens by party to avoid repeated OIDC round-trips within a request window.
// Simple in-memory map; fine for single-instance EC2 deploy.
const tokenCache = new Map<string, { token: string; expiresAt: number }>();

async function fetchOidcToken(party: string): Promise<string> {
  const cached = tokenCache.get(party);
  if (cached && cached.expiresAt > Date.now() + 30_000) return cached.token;

  const issuer = process.env.LEDGER_OIDC_ISSUER!;
  const clientId = process.env.LEDGER_OIDC_CLIENT_ID!;
  const clientSecret = process.env.LEDGER_OIDC_CLIENT_SECRET!;

  // 5N/Authentik-style issuers are the token endpoint itself (".../o/token/").
  // LEDGER_OIDC_TOKEN_URL overrides; otherwise use the issuer verbatim when it
  // already looks like a token endpoint, else append the conventional path.
  const tokenUrl =
    process.env.LEDGER_OIDC_TOKEN_URL ??
    (/\/token\/?$/.test(issuer)
      ? issuer
      : issuer.endsWith("/")
        ? `${issuer}oauth2/token`
        : `${issuer}/oauth2/token`);

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
    scope: process.env.LEDGER_OIDC_SCOPE ?? "daml_ledger_api",
    ...(process.env.LEDGER_OIDC_AUDIENCE
      ? { audience: process.env.LEDGER_OIDC_AUDIENCE }
      : {}),
  });

  const res = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OIDC token fetch failed: ${res.status} ${text}`);
  }

  const json = (await res.json()) as {
    access_token: string;
    expires_in?: number;
  };
  const expiresIn = json.expires_in ?? 3600;
  tokenCache.set(party, {
    token: json.access_token,
    expiresAt: Date.now() + expiresIn * 1000,
  });

  return json.access_token;
}

export async function getLedgerToken(party: string): Promise<string> {
  const mode = (process.env.LEDGER_AUTH_MODE ?? "token") as AuthMode;

  switch (mode) {
    case "oidc":
      return fetchOidcToken(party);

    case "token": {
      const t = process.env.LEDGER_STATIC_TOKEN;
      if (!t) throw new Error("LEDGER_STATIC_TOKEN is not set");
      return t;
    }

    case "external-party":
      // TODO: Implement external-party JWT signing using CANTON_PRIVATE_KEY.
      // This requires constructing a Canton-format JWT signed with the node's
      // participant private key. Blocked on receiving validator credentials.
      throw new Error(
        "LEDGER_AUTH_MODE=external-party is not yet implemented. " +
          "Set LEDGER_AUTH_MODE=token with a static bearer token from the validator, " +
          "or LEDGER_AUTH_MODE=oidc with client credentials."
      );

    default:
      throw new Error(`Unknown LEDGER_AUTH_MODE: ${mode}`);
  }
}
