export type SocialPlatformId = "x" | "linkedin" | "threads" | "bluesky";

export type SocialPlatformRule = {
  id: SocialPlatformId;
  label: string;
  tone: string;
  length: string;
  hook: string;
  format: string;
  cta: string;
};

export const SOCIAL_PLATFORM_RULES: SocialPlatformRule[] = [
  {
    id: "x",
    label: "X",
    tone: "sharp, direct",
    length: "short",
    hook: "strong first line",
    format: "1-3 short paragraphs",
    cta: "optional",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    tone: "professional, clear",
    length: "medium",
    hook: "insight or lesson",
    format: "structured paragraphs",
    cta: "subtle",
  },
  {
    id: "threads",
    label: "Threads",
    tone: "casual, conversational",
    length: "short to medium",
    hook: "relatable opening",
    format: "short chunks",
    cta: "light",
  },
  {
    id: "bluesky",
    label: "Bluesky",
    tone: "natural, lightweight",
    length: "short",
    hook: "plain and direct",
    format: "simple paragraphs",
    cta: "usually none",
  },
];

export const DEFAULT_PLATFORM_ID: SocialPlatformId = "x";

export function getSocialPlatformRule(platformId: SocialPlatformId) {
  return SOCIAL_PLATFORM_RULES.find((platform) => platform.id === platformId) ?? SOCIAL_PLATFORM_RULES[0];
}

