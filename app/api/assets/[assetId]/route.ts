import { readFile } from "node:fs/promises";

import { NextResponse } from "next/server";

import { getAssetById } from "@/lib/assets";

type RouteContext = {
  params: Promise<{ assetId: string }>;
};

export async function GET(_req: Request, context: RouteContext) {
  const { assetId } = await context.params;
  const asset = await getAssetById(assetId);

  if (!asset) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  const bytes = await readFile(asset.filePath);
  return new NextResponse(bytes, {
    headers: {
      "content-type": asset.mimeType,
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}

