import { NextResponse } from "next/server";

import { publishInstagramImage } from "@/lib/instagram-publish";
import { createScheduledPost } from "@/lib/scheduled-posts";

type PublishRequestBody = {
  platform?: string;
  content?: string;
  imageUrl?: string;
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

  if (platform !== "instagram") {
    return NextResponse.json({ error: `Unsupported platform: ${platform}` }, { status: 400 });
  }

  const caption = body.content?.trim() || "";
  const imageUrl = getFirstString(body.imageUrl);

  if (body.scheduleAt) {
    const scheduledTime = Date.parse(body.scheduleAt);
    if (Number.isNaN(scheduledTime)) {
      return NextResponse.json({ error: "scheduleAt must be a valid ISO timestamp" }, { status: 400 });
    }

    if (scheduledTime <= Date.now()) {
      return NextResponse.json({ error: "scheduleAt must be in the future" }, { status: 400 });
    }

    if (!imageUrl) {
      return NextResponse.json({ error: "imageUrl is required for scheduled Instagram publishing" }, { status: 400 });
    }

    const job = await createScheduledPost({
      platform,
      content: body.content?.trim() || "",
      imageUrl,
      scheduleAt: new Date(scheduledTime).toISOString(),
    });

    return NextResponse.json({
      platform: "instagram",
      status: job.status,
      scheduleAt: job.scheduleAt,
      jobId: job.id,
    });
  }

  if (!imageUrl) {
    return NextResponse.json({ error: "imageUrl is required for Instagram publishing" }, { status: 400 });
  }

  const accessToken = getFirstString(body.accessToken, process.env.INSTAGRAM_ACCESS_TOKEN);
  const instagramUserId = getFirstString(body.instagramUserId, process.env.INSTAGRAM_USER_ID);
  const graphApiVersion = getFirstString(body.graphApiVersion, process.env.META_GRAPH_API_VERSION) || "v22.0";

  if (!accessToken) {
    return NextResponse.json({ error: "Instagram access token is required" }, { status: 400 });
  }

  if (!instagramUserId) {
    return NextResponse.json({ error: "Instagram user id is required" }, { status: 400 });
  }

  try {
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
  } catch (error) {
    const message = error instanceof Error ? error.message : "Publish failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
