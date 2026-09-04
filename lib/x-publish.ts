import { readFile } from "node:fs/promises";

import { getAssetByIds } from "@/lib/assets";

export type XPublishInput = {
  accessToken: string;
  text?: string;
  assetIds?: string[];
};

export type XPublishResult = {
  tweetId: string;
  mediaIds: string[];
};

function getXApiBaseUrl() {
  return "https://api.x.com/2";
}

async function readXError(response: Response) {
  try {
    const payload = (await response.json()) as {
      title?: string;
      detail?: string;
      errors?: Array<{ detail?: string; message?: string }>;
    };
    return (
      payload.detail ||
      payload.title ||
      payload.errors?.[0]?.detail ||
      payload.errors?.[0]?.message ||
      response.statusText ||
      "Unknown X API error"
    );
  } catch {
    return response.statusText || "Unknown X API error";
  }
}

async function uploadXMedia(accessToken: string, assetId: string) {
  const assets = await getAssetByIds([assetId]);
  const asset = assets[0];

  if (!asset) {
    throw new Error(`Could not resolve uploaded asset ${assetId}`);
  }

  if (!asset.mimeType.startsWith("image/")) {
    throw new Error(`X upload only supports images for now: ${asset.fileName}`);
  }

  const media = await readFile(asset.filePath);
  const response = await fetch(`${getXApiBaseUrl()}/media/upload`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({
      media: media.toString("base64"),
      media_category: "tweet_image",
    }),
  });

  if (!response.ok) {
    throw new Error(`X media upload failed: ${await readXError(response)}`);
  }

  const data = (await response.json()) as { data?: { id?: string }; media_id?: string; id?: string };
  const mediaId = data.data?.id || data.media_id || data.id;
  if (!mediaId) {
    throw new Error("X media upload did not return a media id.");
  }

  return mediaId;
}

export async function publishXPost(input: XPublishInput): Promise<XPublishResult> {
  const accessToken = input.accessToken.trim();
  if (!accessToken) {
    throw new Error("X access token is required.");
  }

  const text = input.text?.trim() || "";
  const assetIds = (input.assetIds ?? []).map((assetId) => assetId.trim()).filter(Boolean);

  if (!text && assetIds.length === 0) {
    throw new Error("X posts need text or at least one image.");
  }

  if (assetIds.length > 4) {
    throw new Error("X posts support up to 4 images.");
  }

  const mediaIds: string[] = [];
  for (const assetId of assetIds) {
    mediaIds.push(await uploadXMedia(accessToken, assetId));
  }

  const payload: {
    text: string;
    media?: { media_ids: string[] };
  } = {
    text: text || " ",
  };

  if (mediaIds.length > 0) {
    payload.media = { media_ids: mediaIds };
  }

  const response = await fetch(`${getXApiBaseUrl()}/tweets`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`X publish failed: ${await readXError(response)}`);
  }

  const data = (await response.json()) as { data?: { id?: string } };
  const tweetId = data.data?.id;
  if (!tweetId) {
    throw new Error("X publish did not return a tweet id.");
  }

  return { tweetId, mediaIds };
}
