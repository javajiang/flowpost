import { NextRequest, NextResponse } from "next/server";

import { createOAuthState, createPkceCodeVerifier, getXAuthorizeUrl } from "@/lib/integrations";

export async function GET(req: NextRequest) {
  try {
    const state = createOAuthState();
    const codeVerifier = createPkceCodeVerifier();
    const response = NextResponse.redirect(getXAuthorizeUrl(state, codeVerifier), { status: 302 });
    const secure = new URL(req.url).protocol === "https:";

    response.cookies.set("flowpost_x_state", state, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      maxAge: 600,
      path: "/",
    });

    response.cookies.set("flowpost_x_verifier", codeVerifier, {
      httpOnly: true,
      sameSite: "lax",
      secure,
      maxAge: 600,
      path: "/",
    });

    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to start X connection";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
