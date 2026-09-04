"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

const channelLabels: Record<string, string> = {
  x: "X",
  instagram: "Instagram",
  threads: "Threads",
  linkedin: "LinkedIn",
  facebook: "Facebook",
  bluesky: "Bluesky",
  youtube: "YouTube",
  tiktok: "TikTok",
};

export default function ConnectChannelPage() {
  const params = useParams<{ platform: string }>();
  const searchParams = useSearchParams();
  const platform = params.platform;
  const label = channelLabels[platform] || platform;
  const [status, setStatus] = useState<"loading" | "connected" | "empty">("loading");
  const [username, setUsername] = useState("");
  const error = searchParams.get("error") || "";
  const connected = searchParams.get("connected") === "1";

  useEffect(() => {
    if (platform !== "instagram" && platform !== "x") {
      setStatus("empty");
      return;
    }

    void (async () => {
      const response = await fetch(`/api/integrations/${platform}`);
      if (!response.ok) {
        setStatus("empty");
        return;
      }

      const data = (await response.json()) as { connected?: boolean; integration?: { username?: string } };
      if (data.connected) {
        setStatus("connected");
        setUsername(data.integration?.username || "");
      } else {
        setStatus("empty");
      }
    })();
  }, [platform]);

  return (
    <main className="connect-page">
      <div className="connect-page-card">
        <p className="connect-page-kicker">Connect a New Channel</p>
        <h1>{label}</h1>
        <p>
          {platform === "instagram"
            ? "Connect your Instagram professional account with Meta OAuth."
            : platform === "x"
              ? "Connect your X account with OAuth."
              : "This channel is not wired yet."}
        </p>
        {error ? <p className="connect-page-error">{error}</p> : null}
        {connected || status === "connected" ? (
          <p className="connect-page-success">
            Connected{username ? ` as ${username}` : ""}
          </p>
        ) : null}
        <div className="connect-page-actions">
          <Link href="/compose" className="connect-page-button connect-page-button-secondary">
            Back to compose
          </Link>
          {platform === "instagram" || platform === "x" ? (
            <a href={`/api/integrations/${platform}/connect`} className="connect-page-button">
              {status === "connected" ? `Reconnect ${label}` : "Start connection"}
            </a>
          ) : (
            <button type="button" className="connect-page-button" disabled>
              Coming soon
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
