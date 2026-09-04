import { createHash, randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getPublicBaseUrl } from "@/lib/assets";

export type IntegrationPlatform = "instagram";

export type XIntegrationRecord = {
  platform: "x";
  userId: string;
  username?: string;
  accessToken: string;
  refreshToken?: string;
  tokenExpiresAt?: string;
  scopes: string[];
  connectedAt: string;
  updatedAt: string;
};

export type InstagramIntegrationRecord = {
  platform: "instagram";
  userId: string;
  username?: string;
  accessToken: string;
  tokenExpiresAt?: string;
  scopes: string[];
  connectedAt: string;
  updatedAt: string;
};

type IntegrationStore = {
  x?: XIntegrationRecord;
  instagram?: InstagramIntegrationRecord;
};

const storageDir = process.env.FLOWPOST_INTEGRATION_DIR || path.join(process.cwd(), ".flowpost-integrations");
const storageFile = path.join(storageDir, "integrations.json");

async function ensureStorageFile() {
  await mkdir(storageDir, { recursive: true });

  try {
    await readFile(storageFile, "utf8");
  } catch {
    await writeFile(storageFile, "{}", "utf8");
  }
}

async function readStore(): Promise<IntegrationStore> {
  await ensureStorageFile();
  const raw = await readFile(storageFile, "utf8");

  try {
    const parsed = JSON.parse(raw) as IntegrationStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function writeStore(store: IntegrationStore) {
  await ensureStorageFile();
  await writeFile(storageFile, JSON.stringify(store, null, 2), "utf8");
}

export function createOAuthState() {
  return randomBytes(24).toString("hex");
}

export function createPkceCodeVerifier() {
  return randomBytes(64).toString("base64url");
}

export function createPkceCodeChallenge(verifier: string) {
  return createHash("sha256").update(verifier).digest("base64url");
}

export function getInstagramRedirectUri() {
  return new URL("/api/integrations/instagram/callback", getPublicBaseUrl()).toString();
}

export function getInstagramAuthorizeUrl(state: string) {
  const appId = process.env.META_APP_ID?.trim();
  if (!appId) {
    throw new Error("META_APP_ID is required.");
  }

  const redirectUri = getInstagramRedirectUri();
  const params = new URLSearchParams({
    client_id: appId,
    redirect_uri: redirectUri,
    response_type: "code",
    scope: "instagram_business_basic,instagram_business_content_publish",
    state,
  });

  return `https://www.instagram.com/oauth/authorize?${params.toString()}`;
}

export function getXRedirectUri() {
  return new URL("/api/integrations/x/callback", getPublicBaseUrl()).toString();
}

export function getXAuthorizeUrl(state: string, codeVerifier: string) {
  const clientId = process.env.X_CLIENT_ID?.trim();
  if (!clientId) {
    throw new Error("X_CLIENT_ID is required.");
  }

  const redirectUri = getXRedirectUri();
  const codeChallenge = createPkceCodeChallenge(codeVerifier);
  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: "tweet.read tweet.write users.read offline.access media.write",
    state,
    code_challenge: codeChallenge,
    code_challenge_method: "S256",
  });

  return `https://x.com/i/oauth2/authorize?${params.toString()}`;
}

export async function saveInstagramIntegration(record: InstagramIntegrationRecord) {
  const store = await readStore();
  store.instagram = record;
  await writeStore(store);
  return record;
}

export async function saveXIntegration(record: XIntegrationRecord) {
  const store = await readStore();
  store.x = record;
  await writeStore(store);
  return record;
}

export async function getInstagramIntegration() {
  const store = await readStore();
  return store.instagram ?? null;
}

export async function getXIntegration() {
  const store = await readStore();
  return store.x ?? null;
}

export async function deleteInstagramIntegration() {
  const store = await readStore();
  delete store.instagram;
  await writeStore(store);
}

export async function deleteXIntegration() {
  const store = await readStore();
  delete store.x;
  await writeStore(store);
}

function makeBasicAuth(clientId: string, clientSecret: string) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

async function exchangeXToken(params: Record<string, string>) {
  const clientId = process.env.X_CLIENT_ID?.trim();
  const clientSecret = process.env.X_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("X_CLIENT_ID and X_CLIENT_SECRET are required.");
  }

  const response = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: makeBasicAuth(clientId, clientSecret),
    },
    body: new URLSearchParams({
      client_id: clientId,
      ...params,
    }),
  });

  if (!response.ok) {
    let message = response.statusText || "Unknown X OAuth error";
    try {
      const payload = (await response.json()) as { error?: string; error_description?: string; detail?: string };
      message = payload.error_description || payload.detail || payload.error || message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }

  return (await response.json()) as {
    token_type?: string;
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  };
}

export async function refreshXIntegrationToken(record: XIntegrationRecord) {
  if (!record.refreshToken) return record;

  const tokenResponse = await exchangeXToken({
    grant_type: "refresh_token",
    refresh_token: record.refreshToken,
  });

  if (!tokenResponse.access_token) {
    return record;
  }

  const updated: XIntegrationRecord = {
    ...record,
    accessToken: tokenResponse.access_token,
    refreshToken: tokenResponse.refresh_token || record.refreshToken,
    tokenExpiresAt: tokenResponse.expires_in ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString() : record.tokenExpiresAt,
    scopes: tokenResponse.scope ? tokenResponse.scope.split(" ").filter(Boolean) : record.scopes,
    updatedAt: new Date().toISOString(),
  };

  await saveXIntegration(updated);
  return updated;
}

function isTokenExpired(expiresAt?: string) {
  if (!expiresAt) return false;
  const time = Date.parse(expiresAt);
  if (Number.isNaN(time)) return false;
  return time <= Date.now() + 60 * 1000;
}

export async function resolveInstagramCredentials() {
  const integration = await getInstagramIntegration();
  if (integration) {
    return {
      accessToken: integration.accessToken,
      instagramUserId: integration.userId,
      username: integration.username,
      source: "connected" as const,
    };
  }

  const accessToken = process.env.INSTAGRAM_ACCESS_TOKEN?.trim();
  const instagramUserId = process.env.INSTAGRAM_USER_ID?.trim();
  if (accessToken && instagramUserId) {
    return {
      accessToken,
      instagramUserId,
      source: "env" as const,
    };
  }

  return null;
}

export async function resolveXCredentials() {
  const integration = await getXIntegration();
  if (integration) {
    if (isTokenExpired(integration.tokenExpiresAt) && integration.refreshToken) {
      const refreshed = await refreshXIntegrationToken(integration);
      return {
        accessToken: refreshed.accessToken,
        xUserId: refreshed.userId,
        username: refreshed.username,
        source: "connected" as const,
      };
    }

    return {
      accessToken: integration.accessToken,
      xUserId: integration.userId,
      username: integration.username,
      source: "connected" as const,
    };
  }

  const accessToken = process.env.X_ACCESS_TOKEN?.trim();
  const xUserId = process.env.X_USER_ID?.trim();
  if (accessToken && xUserId) {
    return {
      accessToken,
      xUserId,
      source: "env" as const,
    };
  }

  return null;
}
