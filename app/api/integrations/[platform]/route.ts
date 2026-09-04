import { NextResponse } from "next/server";

import { getInstagramIntegration, getXIntegration } from "@/lib/integrations";

type RouteContext = {
  params: Promise<{ platform: string }>;
};

export async function GET(_req: Request, context: RouteContext) {
  const { platform } = await context.params;
  const normalized = platform.toLowerCase();

  if (normalized === "instagram") {
    const integration = await getInstagramIntegration();
    return NextResponse.json({
      connected: Boolean(integration),
      integration,
    });
  }

  if (normalized === "x") {
    const integration = await getXIntegration();
    return NextResponse.json({
      connected: Boolean(integration),
      integration,
    });
  }

  return NextResponse.json({ error: "Unsupported platform" }, { status: 404 });
}
