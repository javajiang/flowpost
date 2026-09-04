import { NextResponse } from "next/server";

import { getAssetByIds, getAssetPublicUrl, getPublicBaseUrl } from "@/lib/assets";
import { publishInstagramImage } from "@/lib/instagram-publish";
import { createScheduledPost } from "@/lib/scheduled-posts";
import { publishXPost } from "@/lib/x-publish";
import { resolveInstagramCredentials, resolveXCredentials } from "@/lib/integrations";

type PublishRequestBody = {
  platform?: string;
  content?: string;
  assetIds?: string[];
  scheduleAt?: string | null;
  accessToken?: string;
  instagramUserId?: string;
  graphApiVersion?: string;
};

function getFirstString(...values: Array<string | undefined>) {
  return values.map((value) => value?.trim()).find((value): value is string => Boolean(value));
}

export async function POST(req: Request) {
  let body: PublishRequestBody = {};

  try {
    body = (await req.json()) as PublishRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const platform = body.platform?.trim().toLowerCase();
  if (!platform) {
    return NextResponse.json({ error: "platform is required" }, { status: 400 });
  }

  if (platform !== "instagram" && platform !== "x") {
    return NextResponse.json({ error: `Unsupported platform: ${platform}` }, { status: 400 });
  }

  const caption = body.content?.trim() || "";
  const assetIds = Array.isArray(body.assetIds) ? body.assetIds.map((assetId) => assetId.trim()).filter(Boolean) : [];

  if (body.scheduleAt) {
    const scheduledTime = Date.parse(body.scheduleAt);
    if (Number.isNaN(scheduledTime)) {
      return NextResponse.json({ error: "scheduleAt must be a valid ISO timestamp" }, { status: 400 });
    }

    if (scheduledTime <= Date.now()) {
      return NextResponse.json({ error: "scheduleAt must be in the future" }, { status: 400 });
    }

    if (platform === "instagram" && assetIds.length === 0) {
      return NextResponse.json({ error: "assetIds is required for scheduled Instagram publishing" }, { status: 400 });
    }

    const job = await createScheduledPost({
      platform,
      content: body.content?.trim() || "",
      assetIds,
      scheduleAt: new Date(scheduledTime).toISOString(),
    });

    return NextResponse.json({
      platform: "instagram",
      status: job.status,
      scheduleAt: job.scheduleAt,
      jobId: job.id,
    });
  }

  try {
    if (platform === "instagram") {
      if (assetIds.length === 0) {
        return NextResponse.json({ error: "assetIds is required for Instagram publishing" }, { status: 400 });
      }

      const credentials = await resolveInstagramCredentials();
      const accessToken = getFirstString(body.accessToken, credentials?.accessToken);
      const instagramUserId = getFirstString(body.instagramUserId, credentials?.instagramUserId);
      const graphApiVersion = getFirstString(body.graphApiVersion, process.env.META_GRAPH_API_VERSION) || "v22.0";

      if (!accessToken) {
        return NextResponse.json({ error: "Instagram access token is required" }, { status: 400 });
      }

      if (!instagramUserId) {
        return NextResponse.json({ error: "Connect Instagram first." }, { status: 400 });
      }

      const assets = await getAssetByIds(assetIds);
      const asset = assets[0];
      if (!asset) {
        return NextResponse.json({ error: "Could not resolve uploaded image asset" }, { status: 400 });
      }

      const imageUrl = getAssetPublicUrl(asset.id, getPublicBaseUrl());

      const result = await publishInstagramImage({
        accessToken,
        instagramUserId,
        imageUrl,
        caption,
        graphApiVersion,
      });

      return NextResponse.json({
        platform: "instagram",
        creationId: result.creationId,
        mediaId: result.mediaId,
      });
    }

    const credentials = await resolveXCredentials();
    const accessToken = getFirstString(body.accessToken, credentials?.accessToken);
    if (!accessToken) {
      return NextResponse.json({ error: "X access token is required" }, { status: 400 });
    }

    const result = await publishXPost({
      accessToken,
      text: caption,
      assetIds,
    });

    return NextResponse.json({
      platform: "x",
      tweetId: result.tweetId,
      mediaIds: result.mediaIds,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Publish failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
