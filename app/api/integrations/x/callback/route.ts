import { NextRequest, NextResponse } from "next/server";

import { getXRedirectUri, saveXIntegration } from "@/lib/integrations";

type TokenExchangeResponse = {
  token_type?: string;
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
};

type ProfileResponse = {
  data?: {
    id?: string;
    username?: string;
  };
};

async function readJsonError(response: Response) {
  try {
    const payload = (await response.json()) as {
      detail?: string;
      title?: string;
      errors?: Array<{ detail?: string; message?: string }>;
    };
    return payload.detail || payload.title || payload.errors?.[0]?.detail || payload.errors?.[0]?.message || response.statusText || "Unknown error";
  } catch {
    return response.statusText || "Unknown error";
  }
}

function makeBasicAuth(clientId: string, clientSecret: string) {
  return `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`;
}

async function exchangeToken(code: string, codeVerifier: string) {
  const clientId = process.env.X_CLIENT_ID?.trim();
  const clientSecret = process.env.X_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new Error("X_CLIENT_ID and X_CLIENT_SECRET are required.");
  }

  const response = await fetch("https://api.x.com/2/oauth2/token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      authorization: makeBasicAuth(clientId, clientSecret),
    },
    body: new URLSearchParams({
      client_id: clientId,
      grant_type: "authorization_code",
      code,
      redirect_uri: getXRedirectUri(),
      code_verifier: codeVerifier,
    }),
  });

  if (!response.ok) {
    throw new Error(await readJsonError(response));
  }

  return (await response.json()) as TokenExchangeResponse;
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error") || url.searchParams.get("error_description");
  const returnedState = url.searchParams.get("state");
  const storedState = req.cookies.get("flowpost_x_state")?.value;
  const codeVerifier = req.cookies.get("flowpost_x_verifier")?.value;

  if (error) {
    return NextResponse.redirect(new URL(`/connect/x?error=${encodeURIComponent(error)}`, req.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/connect/x?error=Missing+authorization+code", req.url));
  }

  if (!storedState || storedState !== returnedState) {
    return NextResponse.redirect(new URL("/connect/x?error=Invalid+OAuth+state", req.url));
  }

  if (!codeVerifier) {
    return NextResponse.redirect(new URL("/connect/x?error=Missing+PKCE+verifier", req.url));
  }

  try {
    const tokenResponse = await exchangeToken(code, codeVerifier);
    const accessToken = tokenResponse.access_token;
    if (!accessToken) {
      throw new Error("Missing token response");
    }

    let userId = "";
    let username: string | undefined;

    const profileResponse = await fetch("https://api.x.com/2/users/me", {
      headers: {
        authorization: `Bearer ${accessToken}`,
      },
    });

    if (profileResponse.ok) {
      const profile = (await profileResponse.json()) as ProfileResponse;
      userId = profile.data?.id || "";
      username = profile.data?.username;
    }

    if (!userId) {
      throw new Error("Could not read X profile.");
    }

    await saveXIntegration({
      platform: "x",
      userId,
      username,
      accessToken,
      refreshToken: tokenResponse.refresh_token,
      tokenExpiresAt: tokenResponse.expires_in ? new Date(Date.now() + tokenResponse.expires_in * 1000).toISOString() : undefined,
      scopes: tokenResponse.scope ? tokenResponse.scope.split(" ").filter(Boolean) : ["tweet.read", "tweet.write", "users.read", "offline.access", "media.write"],
      connectedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    const redirectUrl = new URL("/connect/x?connected=1", req.url);
    if (username) redirectUrl.searchParams.set("username", username);
    const response = NextResponse.redirect(redirectUrl);
    response.cookies.delete("flowpost_x_state");
    response.cookies.delete("flowpost_x_verifier");
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "X connection failed";
    return NextResponse.redirect(new URL(`/connect/x?error=${encodeURIComponent(message)}`, req.url));
  }
}
