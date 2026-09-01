import { getSocialPlatformRule, type SocialPlatformId } from "@/lib/social-platforms";

function splitSentences(input: string) {
  return input
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);
}

function splitParagraphs(input: string) {
  return input
    .split(/\n\s*\n/)
    .map((part) => part.trim())
    .filter(Boolean);
}

function fallbackHook(source: string) {
  const firstLine = source.split("\n").map((line) => line.trim()).find(Boolean) ?? source.trim();
  return firstLine.slice(0, 120);
}

function takeLeadSentences(sentences: string[], count: number) {
  return sentences.slice(0, count).join(" ").trim();
}

export function buildPlatformGenerationPrompt(platformId: SocialPlatformId, sourceDraft: string) {
  const rule = getSocialPlatformRule(platformId);

  return [
    `Create a post for ${rule.label}.`,
    "",
    "Platform rules:",
    `- Tone: ${rule.tone}`,
    `- Length: ${rule.length}`,
    `- Hook: ${rule.hook}`,
    `- Format: ${rule.format}`,
    `- CTA: ${rule.cta}`,
    "",
    "Source draft:",
    sourceDraft.trim(),
  ]
    .join("\n")
    .trim();
}

export function buildPlatformCopyPreview(platformId: SocialPlatformId, sourceDraft: string) {
  const rule = getSocialPlatformRule(platformId);
  const paragraphs = splitParagraphs(sourceDraft);
  const sentences = splitSentences(sourceDraft);
  const hook = fallbackHook(sourceDraft);

  if (platformId === "x") {
    const body = takeLeadSentences(sentences, 2) || sourceDraft.trim();
    return [hook, body, "What do you think?"].filter(Boolean).join("\n\n").trim();
  }

  if (platformId === "linkedin") {
    const first = takeLeadSentences(sentences, 2) || sourceDraft.trim();
    const second = paragraphs.slice(1, 3).join("\n\n") || "";
    return [hook, first, second, "Share your thoughts below."].filter(Boolean).join("\n\n").trim();
  }

  if (platformId === "threads") {
    const parts = paragraphs.length > 0 ? paragraphs : [sourceDraft.trim()];
    const shortFlow = parts.slice(0, 4).join("\n\n");
    return [hook, shortFlow, "Curious what you would add."].filter(Boolean).join("\n\n").trim();
  }

  const first = takeLeadSentences(sentences, 1) || sourceDraft.trim();
  return [first, "Thoughts?"].filter(Boolean).join("\n\n").trim();
}

