import { NextResponse } from "next/server";

type ImportResult = {
  sourceUrl: string;
  finalUrl: string;
  title: string;
  description: string;
  content: string;
  imageUrl: string;
};

function decodeEntities(input: string) {
  const named: Record<string, string> = {
    amp: "&",
    lt: "<",
    gt: ">",
    quot: '"',
    apos: "'",
    nbsp: " ",
    hellip: "...",
  };

  return input
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&([a-zA-Z]+);/g, (_, name: string) => named[name] ?? `&${name};`);
}

function normalizeEscapedText(input: string) {
  return decodeEntities(input)
    .replace(/\\x0a/gi, "\n")
    .replace(/\\x0d/gi, "\n")
    .replace(/\\r\\n|\\n|\\r/g, "\n")
    .replace(/\r\n?/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function stripTags(html: string) {
  return normalizeEscapedText(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg[\s\S]*?<\/svg>/gi, " ")
      .replace(/<iframe[\s\S]*?<\/iframe>/gi, " ")
      .replace(/<(br|hr)\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|section|article|main|li|h[1-6]|blockquote|tr)>/gi, "\n\n")
      .replace(/<[^>]+>/g, " ")
  );
}

function getMeta(html: string, names: string[]) {
  for (const name of names) {
    const pattern = new RegExp(
      `<meta[^>]+(?:name|property)=["']${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}["'][^>]+content=["']([^"']+)["'][^>]*>`,
      "i"
    );
    const match = html.match(pattern);
    if (match?.[1]) return normalizeEscapedText(match[1].trim());
  }
  return "";
}

function getTitle(html: string) {
  const ogTitle = getMeta(html, ["og:title"]);
  if (ogTitle) return ogTitle;
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return titleMatch?.[1] ? normalizeEscapedText(titleMatch[1].trim()) : "";
}

function getImageUrl(html: string) {
  return getMeta(html, ["og:image", "twitter:image"]);
}

function isXUrl(url: URL) {
  return ["x.com", "www.x.com", "twitter.com", "www.twitter.com"].includes(url.hostname);
}

function getMainHtml(html: string) {
  const candidates = [
    ...html.matchAll(/<article\b[^>]*>([\s\S]*?)<\/article>/gi),
    ...html.matchAll(/<main\b[^>]*>([\s\S]*?)<\/main>/gi),
    ...html.matchAll(/<div\b[^>]*role=["']?main["']?[^>]*>([\s\S]*?)<\/div>/gi),
  ];

  if (candidates.length > 0) {
    return candidates
      .map((match) => match[1] ?? "")
      .sort((a, b) => b.length - a.length)[0];
  }

  const bodyMatch = html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i);
  return bodyMatch?.[1] ?? html;
}

function limitParagraphs(text: string, maxParagraphs = 10) {
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return paragraphs.slice(0, maxParagraphs).join("\n\n");
}

function splitParagraphs(text: string) {
  return normalizeEscapedText(text)
    .split(/\n\s*\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function dedupeParagraphs(paragraphs: string[]) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const paragraph of paragraphs) {
    const key = normalizeEscapedText(paragraph).toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(paragraph);
  }

  return result;
}

function getWeChatArticle(html: string) {
  const fullText = getMeta(html, ["og:title", "twitter:title"]);
  const paragraphs = splitParagraphs(fullText);

  if (paragraphs.length < 2) return null;

  return {
    title: paragraphs[0],
    content: paragraphs.slice(1).join("\n\n"),
  };
}

function isNoiseLine(line: string) {
  const normalized = line.trim();
  if (!normalized) return true;
  if (/^\d+$/.test(normalized)) return true;
  if (/^\d+(\.\d+)?[KMB]?$/i.test(normalized)) return true;
  if (/^\d+(\.\d+)?[KMB]?\s+Views?$/i.test(normalized)) return true;
  if (/^\d{1,2}:\d{2}\s?(AM|PM)?\s·\s/i.test(normalized)) return true;
  if (/^(Reply|Repost|Like|Views?)$/i.test(normalized)) return true;
  return false;
}

function getXPost(html: string) {
  const metaParts = [
    getMeta(html, ["og:title"]),
    getMeta(html, ["og:description"]),
    getMeta(html, ["twitter:title"]),
    getMeta(html, ["twitter:description"]),
  ]
    .filter(Boolean)
    .map((part) => part.replace(/\s+/g, " ").trim());

  const metaContent = metaParts.join("\n\n");
  const metaParagraphs = dedupeParagraphs(splitParagraphs(metaContent).filter((line) => !isNoiseLine(line)));

  const imageUrl = getImageUrl(html);
  const mainHtml = getMainHtml(html);
  const fallbackContent = limitParagraphs(
    dedupeParagraphs(splitParagraphs(stripTags(mainHtml)))
      .filter((line) => !isNoiseLine(line))
      .join("\n\n"),
    8
  );

  const title = metaParagraphs[0] || getTitle(html);
  const content = dedupeParagraphs(metaParagraphs.slice(1)).join("\n\n") || fallbackContent || title;

  return {
    title,
    content,
    imageUrl,
    description: metaParagraphs.length > 1 ? metaParagraphs.slice(1).join(" ") : getMeta(html, ["og:description", "twitter:description"]),
  };
}

export async function POST(req: Request) {
  let body: { url?: string } = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rawUrl = body.url?.trim();
  if (!rawUrl) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    return NextResponse.json({ error: "Only http and https URLs are supported" }, { status: 400 });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url.toString(), {
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "user-agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    if (!response.ok) {
      return NextResponse.json(
        { error: `Failed to fetch URL: ${response.status} ${response.statusText}` },
        { status: 400 }
      );
    }

    const html = await response.text();
    const finalUrl = response.url || url.toString();
    const weChatArticle = url.hostname === "mp.weixin.qq.com" ? getWeChatArticle(html) : null;
    const xPost = !weChatArticle && isXUrl(url) ? getXPost(html) : null;
    const title = weChatArticle?.title || xPost?.title || getTitle(html);
    const description = weChatArticle
      ? ""
      : xPost?.description || getMeta(html, ["description", "og:description", "twitter:description"]);
    const imageUrl = xPost?.imageUrl || getImageUrl(html);
    const mainHtml = getMainHtml(html);
    const content = weChatArticle?.content || xPost?.content || limitParagraphs(stripTags(mainHtml), 12);

    const result: ImportResult = {
      sourceUrl: url.toString(),
      finalUrl,
      title,
      description,
      content,
      imageUrl,
    };

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: `Failed to import URL: ${message}` }, { status: 500 });
  } finally {
    clearTimeout(timer);
  }
}
