import { NextRequest, NextResponse } from "next/server";

import { getInstagramRedirectUri, saveInstagramIntegration } from "@/lib/integrations";

type TokenExchangeResponse = {
  access_token?: string;
  user_id?: string | number;
  expires_in?: number;
};

type ProfileResponse = {
  id?: string;
  username?: string;
};

async function readJsonError(response: Response) {
  try {
    const payload = (await response.json()) as { error?: { message?: string } };
    return payload.error?.message || response.statusText || "Unknown error";
  } catch {
    return response.statusText || "Unknown error";
  }
}

async function exchangeForLongLivedToken(accessToken: string) {
  const clientSecret = process.env.META_APP_SECRET?.trim();
  if (!clientSecret) return null;

  const params = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: clientSecret,
    access_token: accessToken,
  });

  const response = await fetch(`https://graph.instagram.com/access_token?${params.toString()}`, {
    method: "GET",
  });

  if (!response.ok) {
    return null;
  }

  const data = (await response.json()) as { access_token?: string; token_type?: string; expires_in?: number };
  if (!data.access_token) return null;

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in ?? 60 * 24 * 60 * 60,
  };
}

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error_message") || url.searchParams.get("error");
  const returnedState = url.searchParams.get("state");
  const storedState = req.cookies.get("flowpost_ig_state")?.value;

  if (error) {
    return NextResponse.redirect(new URL(`/connect/instagram?error=${encodeURIComponent(error)}`, req.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL("/connect/instagram?error=Missing+authorization+code", req.url));
  }

  if (!storedState || storedState !== returnedState) {
    return NextResponse.redirect(new URL("/connect/instagram?error=Invalid+OAuth+state", req.url));
  }

  const clientId = process.env.META_APP_ID?.trim();
  const clientSecret = process.env.META_APP_SECRET?.trim();
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL("/connect/instagram?error=Missing+Meta+credentials", req.url));
  }

  const exchangeBody = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    redirect_uri: getInstagramRedirectUri(),
    code,
  });

  const exchangeResponse = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
    },
    body: exchangeBody,
  });

  if (!exchangeResponse.ok) {
    const message = await readJsonError(exchangeResponse);
    return NextResponse.redirect(new URL(`/connect/instagram?error=${encodeURIComponent(message)}`, req.url));
  }

  const shortLived = (await exchangeResponse.json()) as TokenExchangeResponse;
  const shortToken = shortLived.access_token;
  const userId = shortLived.user_id ? String(shortLived.user_id) : "";
  if (!shortToken || !userId) {
    return NextResponse.redirect(new URL("/connect/instagram?error=Missing+token+response", req.url));
  }

  const longLived = await exchangeForLongLivedToken(shortToken);
  const tokenToStore = longLived?.accessToken || shortToken;
  const expiresAt = longLived ? new Date(Date.now() + longLived.expiresIn * 1000).toISOString() : undefined;

  let username: string | undefined;
  try {
    const profileResponse = await fetch(`https://graph.instagram.com/me?fields=id,username&access_token=${encodeURIComponent(tokenToStore)}`);
    if (profileResponse.ok) {
      const profile = (await profileResponse.json()) as ProfileResponse;
      username = profile.username;
    }
  } catch {
    username = undefined;
  }

  await saveInstagramIntegration({
    platform: "instagram",
    userId,
    username,
    accessToken: tokenToStore,
    tokenExpiresAt: expiresAt,
    scopes: ["instagram_business_basic", "instagram_business_content_publish"],
    connectedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  const redirectUrl = new URL("/connect/instagram?connected=1", req.url);
  if (username) redirectUrl.searchParams.set("username", username);
  const response = NextResponse.redirect(redirectUrl);
  response.cookies.delete("flowpost_ig_state");
  return response;
}

