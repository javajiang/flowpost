import { NextResponse } from "next/server";

import { createScheduledPost, listScheduledPosts } from "@/lib/scheduled-posts";

type ScheduleRequestBody = {
  platform?: string;
  content?: string;
  assetIds?: string[];
  scheduleAt?: string;
};

export async function GET() {
  const jobs = await listScheduledPosts();
  return NextResponse.json({ items: jobs });
}

export async function POST(req: Request) {
  let body: ScheduleRequestBody = {};

  try {
    body = (await req.json()) as ScheduleRequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const platform = body.platform?.trim().toLowerCase();
  const content = body.content?.trim();
  const scheduleAt = body.scheduleAt?.trim();

  if (!platform) {
    return NextResponse.json({ error: "platform is required" }, { status: 400 });
  }

  if (platform !== "instagram") {
    return NextResponse.json({ error: `Unsupported platform: ${platform}` }, { status: 400 });
  }

  if (!content) {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  if (!scheduleAt) {
    return NextResponse.json({ error: "scheduleAt is required" }, { status: 400 });
  }

  const assetIds = Array.isArray(body.assetIds) ? body.assetIds.map((assetId) => assetId.trim()).filter(Boolean) : [];
  if (assetIds.length === 0) {
    return NextResponse.json({ error: "assetIds is required for scheduled Instagram publishing" }, { status: 400 });
  }

  const scheduledTime = Date.parse(scheduleAt);
  if (Number.isNaN(scheduledTime)) {
    return NextResponse.json({ error: "scheduleAt must be a valid ISO timestamp" }, { status: 400 });
  }

  if (scheduledTime <= Date.now()) {
    return NextResponse.json({ error: "scheduleAt must be in the future" }, { status: 400 });
  }

  const job = await createScheduledPost({
    platform,
    content,
    assetIds,
    scheduleAt: new Date(scheduledTime).toISOString(),
  });

  return NextResponse.json({
    id: job.id,
    status: job.status,
    platform: job.platform,
    scheduleAt: job.scheduleAt,
  });
}
