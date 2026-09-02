import { randomBytes } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { getPublicBaseUrl } from "@/lib/assets";

export type IntegrationPlatform = "instagram";

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

export async function saveInstagramIntegration(record: InstagramIntegrationRecord) {
  const store = await readStore();
  store.instagram = record;
  await writeStore(store);
  return record;
}

export async function getInstagramIntegration() {
  const store = await readStore();
  return store.instagram ?? null;
}

export async function deleteInstagramIntegration() {
  const store = await readStore();
  delete store.instagram;
  await writeStore(store);
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

