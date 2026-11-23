import { createRemoteJWKSet, jwtVerify } from "jose";

export interface Env {
  OPENAI_API_KEY?: string;
  ENABLE_LIVE_GENERATION?: string;
  LIVE_ACCESS_TEAM_DOMAIN?: string;
  LIVE_ACCESS_AUDIENCE?: string;
}

export const openAIModel = {
  id: "gpt-4.1-mini-2025-04-14",
  label: "GPT-4.1 mini",
} as const;

const keySets = new Map<string, ReturnType<typeof createRemoteJWKSet>>();

function getAccessIssuer(configuredDomain: string | undefined) {
  if (!configuredDomain) return undefined;

  try {
    const url = new URL(configuredDomain);
    if (url.href !== `${url.origin}/` ||
        url.protocol !== "https:" ||
        !/^[a-z0-9-]+\.cloudflareaccess\.com$/.test(url.host)) return undefined;

    return url.origin;
  } catch {
    return undefined;
  }
}

async function verifyAccess(request: Request, env: Env) {
  const token = request.headers.get("Cf-Access-Jwt-Assertion");
  const audience = env.LIVE_ACCESS_AUDIENCE?.trim();
  const issuer = getAccessIssuer(env.LIVE_ACCESS_TEAM_DOMAIN?.trim());

  if (!token || !audience || !issuer) return false;

  try {
    let keySet = keySets.get(issuer);
    if (!keySet) {
      keySet = createRemoteJWKSet(new URL("/cdn-cgi/access/certs", issuer), { timeoutDuration: 3000 });
      keySets.set(issuer, keySet);
    }

    await jwtVerify(token, keySet, {
      issuer,
      audience,
      algorithms: ["RS256"],
      requiredClaims: ["exp", "iss", "aud", "sub"],
    });
    return true;
  } catch {
    return false;
  }
}

export async function getOpenAIKey(request: Request, env: Env) {
  const key = env.OPENAI_API_KEY?.trim();
  if (!key || env.ENABLE_LIVE_GENERATION !== "true") return undefined;

  const { hostname } = new URL(request.url);
  if (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]") return key;

  return (await verifyAccess(request, env)) ? key : undefined;
}
