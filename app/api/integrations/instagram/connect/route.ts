import { NextRequest, NextResponse } from "next/server";

import { createOAuthState, getInstagramAuthorizeUrl } from "@/lib/integrations";

export async function GET(req: NextRequest) {
  try {
    const state = createOAuthState();
    const response = NextResponse.redirect(getInstagramAuthorizeUrl(state), { status: 302 });
    const secure = new URL(req.url).protocol === "https:";
    response.cookies.set("flowpost_ig_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      maxAge: 600,
      path: "/",
    });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start Instagram connection";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
