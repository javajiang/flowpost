import { NextResponse } from "next/server";

import { getInstagramIntegration } from "@/lib/integrations";

type RouteContext = {
  params: Promise<{ platform: string }>;
};

export async function GET(_req: Request, context: RouteContext) {
  const { platform } = await context.params;
  const normalized = platform.toLowerCase();

  if (normalized !== "instagram") {
    return NextResponse.json({ error: "Unsupported platform" }, { status: 404 });
  }

  const integration = await getInstagramIntegration();
  return NextResponse.json({
    connected: Boolean(integration),
    integration,
  });
}

