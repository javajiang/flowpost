import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export type AssetRecord = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  filePath: string;
  createdAt: string;
};

const storageDir = process.env.FLOWPOST_ASSET_DIR || path.join(process.cwd(), ".flowpost-assets");
const metadataFile = path.join(storageDir, "assets.json");

async function ensureStorage() {
  await mkdir(storageDir, { recursive: true });
  try {
    await readFile(metadataFile, "utf8");
  } catch {
    await writeFile(metadataFile, "[]", "utf8");
  }
}

async function readAssets(): Promise<AssetRecord[]> {
  await ensureStorage();
  const raw = await readFile(metadataFile, "utf8");
  const parsed = JSON.parse(raw) as AssetRecord[];
  return Array.isArray(parsed) ? parsed : [];
}

async function writeAssets(assets: AssetRecord[]) {
  await ensureStorage();
  await writeFile(metadataFile, JSON.stringify(assets, null, 2), "utf8");
}

function createAssetId() {
  return `asset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function extensionForMimeType(mimeType: string) {
  if (mimeType === "image/jpeg") return ".jpg";
  if (mimeType === "image/png") return ".png";
  if (mimeType === "image/gif") return ".gif";
  if (mimeType === "image/webp") return ".webp";
  if (mimeType === "image/avif") return ".avif";
  return "";
}

export async function saveAsset(file: File) {
  const id = createAssetId();
  const assets = await readAssets();
  const extension = extensionForMimeType(file.type);
  const filePath = path.join(storageDir, `${id}${extension}`);
  const buffer = Buffer.from(await file.arrayBuffer());

  await writeFile(filePath, buffer);

  const record: AssetRecord = {
    id,
    fileName: file.name || id,
    mimeType: file.type || "application/octet-stream",
    size: file.size,
    filePath,
    createdAt: new Date().toISOString(),
  };

  assets.push(record);
  await writeAssets(assets);

  return record;
}

export async function getAssetById(assetId: string) {
  const assets = await readAssets();
  return assets.find((asset) => asset.id === assetId) ?? null;
}

export async function getAssetByIds(assetIds: string[]) {
  const assets = await readAssets();
  const wanted = new Set(assetIds);
  return assets.filter((asset) => wanted.has(asset.id));
}

export function getAssetPublicUrl(assetId: string, baseUrl: string) {
  return new URL(`/api/assets/${assetId}`, baseUrl).toString();
}

export function getPublicBaseUrl() {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (siteUrl) {
    return siteUrl.startsWith("http://") || siteUrl.startsWith("https://") ? siteUrl : `https://${siteUrl}`;
  }

  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl) {
    return vercelUrl.startsWith("http://") || vercelUrl.startsWith("https://") ? vercelUrl : `https://${vercelUrl}`;
  }

  return "http://localhost:3000";
}
