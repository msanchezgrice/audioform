import { PlatformError, type ApiKeyScope } from "./types";

export const TALKFORM_MCP_RESOURCE = "https://www.talkform.ai/api/mcp";
export const TALKFORM_MCP_SCOPES = ["handoffs:read", "handoffs:write", "handoffs:delete"] as const;
export type VerifiedMcpOAuth = { userId: string; clientId: string; scopes: ApiKeyScope[] };

/** Opaque tokens are verified by this product's Clerk instance; no unverified JWT claims are trusted. */
export async function verifyMcpOAuthToken(accessToken: string, options: { secretKey?: string; fetch?: typeof fetch } = {}): Promise<VerifiedMcpOAuth> {
  const secretKey = options.secretKey ?? process.env.CLERK_SECRET_KEY;
  if (!secretKey || !accessToken || accessToken.length > 10_000) {
    throw new PlatformError("invalid_oauth_token", 401, "Sign in to Talkform to continue.");
  }
  let response: Response;
  try {
    response = await (options.fetch ?? fetch)("https://api.clerk.com/v1/oauth_applications/access_tokens/verify", {
      method: "POST",
      headers: { authorization: `Bearer ${secretKey}`, "content-type": "application/json" },
      body: JSON.stringify({ access_token: accessToken }),
      signal: AbortSignal.timeout(5_000), cache: "no-store",
    });
  } catch {
    console.warn("[mcp-oauth] verification_unavailable", { reason: "network" });
    throw new PlatformError("oauth_unavailable", 503, "Account authorization is temporarily unavailable.");
  }
  if (response.status >= 500 || response.status === 429) {
    console.warn("[mcp-oauth] verification_unavailable", { reason: "provider", status: response.status });
    throw new PlatformError("oauth_unavailable", 503, "Account authorization is temporarily unavailable.");
  }
  if (!response.ok) {
    throw new PlatformError("invalid_oauth_token", 401, "Sign in to Talkform to continue.");
  }
  const data = await response.json().catch(() => null) as Record<string, unknown> | null;
  if (!data || data.object !== "clerk_idp_oauth_access_token" || data.revoked !== false || data.expired !== false
    || typeof data.subject !== "string" || !data.subject.startsWith("user_")
    || typeof data.client_id !== "string" || !data.client_id || !Array.isArray(data.scopes)
    || !Array.isArray(data.aud) || !data.aud.includes(TALKFORM_MCP_RESOURCE)) {
    throw new PlatformError("invalid_oauth_token", 401, "Sign in to Talkform to continue.");
  }
  return {
    userId: data.subject,
    clientId: data.client_id,
    scopes: [...new Set(data.scopes.filter((scope): scope is ApiKeyScope =>
      typeof scope === "string" && (TALKFORM_MCP_SCOPES as readonly string[]).includes(scope)))],
  };
}
