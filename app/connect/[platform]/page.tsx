"use client";

import Link from "next/link";
import { useParams } from "next/navigation";

const channelLabels: Record<string, string> = {
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
  const platform = params.platform;
  const label = channelLabels[platform] || platform;

  return (
    <main className="connect-page">
      <div className="connect-page-card">
        <p className="connect-page-kicker">Connect a New Channel</p>
        <h1>{label}</h1>
        <p>
          This is where the OAuth flow will live. For now it is a placeholder page so the channel picker has a real next
          step.
        </p>
        <div className="connect-page-actions">
          <Link href="/compose" className="connect-page-button connect-page-button-secondary">
            Back to compose
          </Link>
          <button type="button" className="connect-page-button">
            Start connection
          </button>
        </div>
      </div>
    </main>
  );
}

