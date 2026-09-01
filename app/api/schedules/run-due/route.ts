import { NextResponse } from "next/server";

import { runDueScheduledPosts } from "@/lib/scheduled-posts";

export async function POST() {
  const items = await runDueScheduledPosts();
  return NextResponse.json({ items });
}

