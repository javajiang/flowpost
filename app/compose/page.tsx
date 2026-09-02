"use client";

import Link from "next/link";
import type { ChangeEvent, DragEvent, FormEvent } from "react";
import { useEffect, useRef, useState } from "react";

import { buildPlatformCopyPreview } from "@/lib/social-copy";
import {
  DEFAULT_PLATFORM_ID,
  SOCIAL_PLATFORM_RULES,
  getSocialPlatformRule,
  type SocialPlatformId,
} from "@/lib/social-platforms";

const networks = ["X", "Facebook", "Instagram", "LinkedIn", "TikTok", "YouTube", "Threads", "Bluesky"];

const connectChannels = [
  { id: "instagram", label: "Instagram", detail: "Business or Creator", accent: "ig" },
  { id: "threads", label: "Threads", detail: "Profile", accent: "threads" },
  { id: "linkedin", label: "LinkedIn", detail: "Page or Profile", accent: "linkedin" },
  { id: "facebook", label: "Facebook", detail: "Page or Group", accent: "facebook" },
  { id: "bluesky", label: "Bluesky", detail: "Profile", accent: "bluesky" },
  { id: "youtube", label: "YouTube", detail: "Channel", accent: "youtube" },
  { id: "tiktok", label: "TikTok", detail: "Account", accent: "tiktok" },
];

type ImportResponse = {
  sourceUrl: string;
  finalUrl: string;
  title: string;
  description: string;
  content: string;
  imageUrl: string;
};

type DraftImage = {
  id: string;
  url: string;
  name: string;
  isObjectUrl: boolean;
  assetId?: string;
  uploadState?: "uploading" | "ready" | "failed";
  error?: string;
};

function buildImportedDraft(result: ImportResponse) {
  const segments = [result.title, result.description, result.content]
    .map((part) => part.trim())
    .filter(Boolean);
  const uniqueSegments: string[] = [];
  const seen = new Set<string>();

  for (const segment of segments) {
    const key = segment.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    uniqueSegments.push(segment);
  }

  return uniqueSegments.join("\n\n").trim();
}

function formatSourceLabel(input: string) {
  if (!input) return "";
  try {
    return new URL(input).hostname;
  } catch {
    return input;
  }
}

export default function ComposePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const replaceFileInputRef = useRef<HTMLInputElement | null>(null);
  const importTextRef = useRef<HTMLTextAreaElement | null>(null);
  const importUrlRef = useRef<HTMLInputElement | null>(null);
  const dropzoneRef = useRef<HTMLDivElement | null>(null);
  const objectUrlsRef = useRef<Set<string>>(new Set());
  const replaceImageIdRef = useRef<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [copied, setCopied] = useState(false);
  const [images, setImages] = useState<DraftImage[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [importMode, setImportMode] = useState<"text" | "url" | null>(null);
  const [importValue, setImportValue] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSource, setImportSource] = useState("");
  const [selectedAiPlatform, setSelectedAiPlatform] = useState<SocialPlatformId>(DEFAULT_PLATFORM_ID);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResult, setAiResult] = useState("");
  const [aiCopied, setAiCopied] = useState(false);
  const [scheduleAt, setScheduleAt] = useState("");
  const [publishMessage, setPublishMessage] = useState("");
  const [publishError, setPublishError] = useState("");
  const [isPublishing, setIsPublishing] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isConnectOpen, setIsConnectOpen] = useState(false);
  const [selectedConnectChannel, setSelectedConnectChannel] = useState(connectChannels[0]);
  const selectedAiRule = getSocialPlatformRule(selectedAiPlatform);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    if (!aiCopied) return undefined;
    const timer = window.setTimeout(() => setAiCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [aiCopied]);

  useEffect(() => {
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      objectUrlsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    if (!importMode) return;
    window.setTimeout(() => {
      if (importMode === "url") {
        importUrlRef.current?.focus();
      } else {
        importTextRef.current?.focus();
      }
    }, 0);
  }, [importMode]);

  const updateImage = (imageId: string, updater: (image: DraftImage) => DraftImage) => {
    setImages((current) => current.map((image) => (image.id === imageId ? updater(image) : image)));
  };

  const uploadImageFile = async (imageId: string, file: File) => {
    const formData = new FormData();
    formData.set("file", file);

    try {
      const response = await fetch("/api/assets/upload", {
        method: "POST",
        body: formData,
      });

      const data = (await response.json()) as { id?: string; url?: string; error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Upload failed.");
      }

      if (!data.id || !data.url) {
        throw new Error("Upload did not return an asset.");
      }

      const assetId = data.id;
      const assetUrl = data.url;

      updateImage(imageId, (image) => {
        if (image.isObjectUrl) {
          URL.revokeObjectURL(image.url);
          objectUrlsRef.current.delete(image.url);
        }

        return {
          ...image,
          url: assetUrl,
          assetId,
          isObjectUrl: false,
          uploadState: "ready",
          error: undefined,
        };
      });
    } catch (error) {
      updateImage(imageId, (image) => ({
        ...image,
        uploadState: "failed",
        error: error instanceof Error ? error.message : "Upload failed.",
      }));
    }
  };

  const appendFiles = (fileList: FileList | File[]) => {
    const files = Array.from(fileList).filter((file) => file.type.startsWith("image/"));
    if (files.length === 0) return;

    const nextImages = files.map((file) => {
      const url = URL.createObjectURL(file);
      objectUrlsRef.current.add(url);

      return {
        id: `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`,
        url,
        name: file.name,
        isObjectUrl: true,
        uploadState: "uploading" as const,
      };
    });

    setImages((current) => [...current, ...nextImages]);

    nextImages.forEach((entry, index) => {
      void uploadImageFile(entry.id, files[index]);
    });
  };

  const replaceImage = (file: File | null) => {
    const imageId = replaceImageIdRef.current;
    if (!file || !imageId || !file.type.startsWith("image/")) return;

    const nextImageId = `${file.name}-${file.lastModified}-${Math.random().toString(36).slice(2)}`;
    const nextUrl = URL.createObjectURL(file);
    objectUrlsRef.current.add(nextUrl);

    setImages((current) =>
      current.map((image) => {
        if (image.id !== imageId) return image;

        if (image.isObjectUrl) {
          URL.revokeObjectURL(image.url);
          objectUrlsRef.current.delete(image.url);
        }

        return {
          id: nextImageId,
          url: nextUrl,
          name: file.name,
          isObjectUrl: true,
          uploadState: "uploading",
        };
      })
    );

    void uploadImageFile(nextImageId, file);
  };

  const appendImportedImage = (url: string) => {
    setImages((current) => [
      ...current,
      {
        id: `imported-${Date.now()}`,
        url,
        name: "Imported image",
        isObjectUrl: false,
      },
    ]);
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) appendFiles(event.target.files);
    event.target.value = "";
  };

  const handleReplaceFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    replaceImage(event.target.files?.[0] ?? null);
    replaceImageIdRef.current = null;
    event.target.value = "";
  };

  const handleRemoveImage = (imageId: string) => {
    setImages((current) => {
      const image = current.find((item) => item.id === imageId);
      if (image?.isObjectUrl) {
        URL.revokeObjectURL(image.url);
        objectUrlsRef.current.delete(image.url);
      }

      return current.filter((item) => item.id !== imageId);
    });
  };

  const handleReplaceImage = (imageId: string) => {
    replaceImageIdRef.current = imageId;
    replaceFileInputRef.current?.click();
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    appendFiles(event.dataTransfer.files);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(draftText);
    setCopied(true);
  };

  const handleUseCurrentDraft = () => {
    setAiPrompt(draftText.trim());
  };

  const handleGenerateAiCopy = () => {
    const source = aiPrompt.trim();
    if (!source) return;

    setAiResult(buildPlatformCopyPreview(selectedAiPlatform, source));
  };

  const handleCopyAiResult = async () => {
    if (!aiResult.trim()) return;
    await navigator.clipboard.writeText(aiResult);
    setAiCopied(true);
  };

  const handleUseAiResultAsDraft = () => {
    if (!aiResult.trim()) return;
    setDraftText(aiResult);
  };

  const getPublishableAssetIds = () =>
    images.filter((image) => image.uploadState === "ready" && image.assetId).map((image) => image.assetId as string);

  const handlePublishRequest = async (scheduleTime?: string) => {
    const assetIds = getPublishableAssetIds();
    const content = draftText.trim();

    if (!content) {
      setPublishError("Write or import content first.");
      return;
    }

    if (assetIds.length === 0) {
      setPublishError("Upload at least one image before publishing.");
      return;
    }

    if (images.some((image) => image.uploadState === "uploading")) {
      setPublishError("Wait for image uploads to finish.");
      return;
    }

    setPublishError("");
    setPublishMessage("");

    try {
      if (scheduleTime) {
        setIsScheduling(true);
      } else {
        setIsPublishing(true);
      }

      const response = await fetch("/api/publish", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          platform: "instagram",
          content,
          assetIds,
          scheduleAt: scheduleTime || null,
        }),
      });

      const data = (await response.json()) as { error?: string; mediaId?: string; jobId?: string; scheduleAt?: string };
      if (!response.ok) {
        throw new Error(data.error || "Publish failed.");
      }

      if (data.jobId) {
        setPublishMessage(`Scheduled for ${data.scheduleAt || scheduleTime}`);
      } else {
        setPublishMessage(`Published to Instagram${data.mediaId ? ` (${data.mediaId})` : ""}.`);
      }
    } catch (error) {
      setPublishError(error instanceof Error ? error.message : "Publish failed.");
    } finally {
      setIsPublishing(false);
      setIsScheduling(false);
    }
  };

  const openConnectModal = () => {
    setSelectedConnectChannel(connectChannels[0]);
    setIsConnectOpen(true);
  };

  const openImport = (mode: "text" | "url") => {
    setImportMode(mode);
    setImportError("");
    setImportValue("");
  };

  const handleImportSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextValue = importValue.trim();
    if (!nextValue) {
      setImportError(importMode === "url" ? "Paste a URL first." : "Paste some text first.");
      return;
    }

    setIsImporting(true);
    setImportError("");

    try {
      if (importMode === "text") {
        setDraftText(nextValue);
        setImportSource("Text import");
      } else {
        const response = await fetch("/api/import-url", {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({ url: nextValue }),
        });

        const data = (await response.json()) as Partial<ImportResponse> & { error?: string };

        if (!response.ok) {
          throw new Error(data.error || "Import failed.");
        }

        const importedDraft = buildImportedDraft(data as ImportResponse);
        setDraftText(importedDraft || data.finalUrl || data.sourceUrl || "");
        setImportSource(data.finalUrl || data.sourceUrl || "");

        if (data.imageUrl) {
          appendImportedImage(data.imageUrl);
        }
      }

      setImportMode(null);
      setImportValue("");
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Import failed.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <main className="compose-shell">
      <header className="compose-header">
        <div className="compose-title-group">
          <h1>Create Post</h1>
          <button className="tag-chip" type="button">
            Tags
          </button>
        </div>

        <div className="compose-header-actions">
          <button type="button">Templates</button>
          <button type="button">AI Assistant</button>
          <button type="button" className="preview-chip">
            Preview
          </button>
          <button type="button" aria-label="Expand">
            ↗
          </button>
          <Link href="/dashboard" aria-label="Close">
            ×
          </Link>
        </div>
      </header>

      <section className="compose-body">
        <section className="compose-editor">
          <div className="network-row" aria-label="Platform tabs">
            {networks.map((item) => (
              <button key={item} type="button" className="network-pill">
                {item}
              </button>
            ))}
          </div>

          <div className="editor-entry-row" aria-label="Content import actions">
            <div className="editor-entry-group">
              <button type="button" className="entry-pill" onClick={() => openImport("text")}>
                Import
              </button>
              <button type="button" className="entry-pill" onClick={() => openImport("url")}>
                URL
              </button>
            </div>
            <button type="button" className="entry-pill entry-pill-muted" onClick={handleCopy}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>

          <div
            ref={dropzoneRef}
            className={`editor-panel${isDragging ? " is-dragging" : ""}`}
            onDragEnter={() => setIsDragging(true)}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={(event) => {
              if (dropzoneRef.current?.contains(event.relatedTarget as Node)) return;
              setIsDragging(false);
            }}
            onDrop={handleDrop}
          >
            <textarea
              className="draft-textarea"
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              placeholder="Start writing or get inspired with Templates"
            />

            <div className="editor-meta">
              <span>{draftText.length > 0 ? `${draftText.length} chars` : ""}</span>
              <span>{copied ? "Copied to clipboard" : importSource ? `Imported from ${formatSourceLabel(importSource)}` : ""}</span>
            </div>

            <div className="media-row" aria-label="Uploaded images">
              {images.map((image) => (
                <div className="image-thumb" key={image.id}>
                  <img src={image.url} alt={image.name} />
                  {image.uploadState === "uploading" ? <span className="image-thumb-state">Uploading</span> : null}
                  {image.uploadState === "failed" ? <span className="image-thumb-error">{image.error || "Upload failed"}</span> : null}
                  <button
                    type="button"
                    className="image-thumb-action image-thumb-remove"
                    aria-label={`Remove ${image.name}`}
                    onClick={() => handleRemoveImage(image.id)}
                  >
                    ×
                  </button>
                  <button
                    type="button"
                    className="image-thumb-action image-thumb-replace"
                    aria-label={`Replace ${image.name}`}
                    onClick={() => handleReplaceImage(image.id)}
                  >
                    ✎
                  </button>
                </div>
              ))}
              <button
                type="button"
                className="upload-card"
                onClick={() => fileInputRef.current?.click()}
              >
                <span className="upload-icon">▣</span>
                <strong>Drag & drop or select a file</strong>
                <span>Image upload area</span>
              </button>
            </div>

            <div className="editor-tools">
              <button type="button">emoji</button>
              <button type="button">#</button>
            </div>

            <input
              ref={fileInputRef}
              className="sr-only-file"
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileChange}
            />
            <input
              ref={replaceFileInputRef}
              className="sr-only-file"
              type="file"
              accept="image/*"
              onChange={handleReplaceFileChange}
            />
          </div>
        </section>

        <aside className="compose-preview">
          <h2 className="ai-title">✦ AI Assistant</h2>

          <div className="ai-composer">
            <div className="ai-platform-row" aria-label="AI target platform">
              {SOCIAL_PLATFORM_RULES.map((platform) => (
                <button
                  key={platform.id}
                  type="button"
                  className={`ai-platform-pill${selectedAiPlatform === platform.id ? " active" : ""}`}
                  onClick={() => setSelectedAiPlatform(platform.id)}
                >
                  {platform.label}
                </button>
              ))}
            </div>

            <div className="ai-platform-summary" aria-live="polite">
              <span>{selectedAiRule.tone}</span>
              <span>{selectedAiRule.length}</span>
              <span>{selectedAiRule.format}</span>
            </div>

            <textarea
              className="ai-prompt-input"
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              placeholder="Create a post for the selected platform"
            />

            <div className="ai-composer-actions">
              <button type="button" onClick={handleUseCurrentDraft} disabled={!draftText.trim()}>
                Use current draft
              </button>
              <button type="button" className="ai-generate-button" onClick={handleGenerateAiCopy} disabled={!aiPrompt.trim()}>
                Generate
              </button>
            </div>
          </div>

          <div className="ai-result-section">
            <h3>Result</h3>
            <div className="ai-result-card">
              <p className={aiResult ? undefined : "ai-result-placeholder"}>
                {aiResult || "Generated platform copy will appear here."}
              </p>
              <div className="ai-result-actions">
                <button type="button" onClick={handleCopyAiResult} disabled={!aiResult.trim()}>
                  {aiCopied ? "Copied" : "Copy"}
                </button>
                <button type="button" onClick={handleUseAiResultAsDraft} disabled={!aiResult.trim()}>
                  Use as draft
                </button>
              </div>
            </div>
          </div>
        </aside>
      </section>

      <footer className="compose-footer">
        <div className="publish-panel">
          <div className="publish-status">
            <span>{publishError || publishMessage || "Instagram only for now"}</span>
          </div>
          <div className="publish-controls">
            <button type="button" className="publish-button publish-button-secondary" onClick={openConnectModal}>
              Connect a New Channel
            </button>
            <input
              className="publish-schedule-input"
              type="datetime-local"
              value={scheduleAt}
              onChange={(event) => setScheduleAt(event.target.value)}
            />
            <button
              type="button"
              className="publish-button publish-button-secondary"
              onClick={() => void handlePublishRequest(scheduleAt ? new Date(scheduleAt).toISOString() : undefined)}
              disabled={isPublishing || isScheduling || !scheduleAt}
            >
              {isScheduling ? "Scheduling..." : "Schedule"}
            </button>
            <button
              type="button"
              className="publish-button"
              onClick={() => void handlePublishRequest()}
              disabled={isPublishing || isScheduling}
            >
              {isPublishing ? "Publishing..." : "Publish now"}
            </button>
          </div>
        </div>
      </footer>

      {isConnectOpen ? (
        <div className="connect-modal-backdrop" role="presentation" onClick={() => setIsConnectOpen(false)}>
          <div className="connect-modal" role="dialog" aria-modal="true" aria-label="Connect a New Channel" onClick={(event) => event.stopPropagation()}>
            <div className="connect-modal-header">
              <h3>Connect a New Channel</h3>
              <button type="button" className="connect-close" aria-label="Close" onClick={() => setIsConnectOpen(false)}>
                ×
              </button>
            </div>

            <div className="connect-grid" aria-label="Available channels">
              {connectChannels.map((channel) => (
                <button
                  key={channel.id}
                  type="button"
                  className={`connect-card${selectedConnectChannel.id === channel.id ? " active" : ""}`}
                  onClick={() => setSelectedConnectChannel(channel)}
                >
                  <span className={`connect-icon connect-${channel.accent}`}>{channel.label.slice(0, 2)}</span>
                  <strong>{channel.label}</strong>
                  <span>{channel.detail}</span>
                </button>
              ))}
            </div>

            <div className="connect-modal-footer">
              <p>
                Selected channel: <strong>{selectedConnectChannel.label}</strong>
              </p>
              <Link href={`/connect/${selectedConnectChannel.id}`} className="connect-continue">
                Continue
              </Link>
            </div>
          </div>
        </div>
      ) : null}

      {importMode ? (
        <div className="import-modal-backdrop" role="presentation" onClick={() => setImportMode(null)}>
          <form
            className="import-modal"
            onSubmit={handleImportSubmit}
            onClick={(event) => event.stopPropagation()}
          >
            <h3>{importMode === "url" ? "Import from URL" : "Import text"}</h3>
            <p>
              {importMode === "url"
                ? "Paste a public article link and we will pull the text and image into the draft."
                : "Paste plain text and it will fill the draft directly."}
            </p>
            {importMode === "url" ? (
              <input
                ref={importUrlRef}
                type="url"
                value={importValue}
                onChange={(event) => setImportValue(event.target.value)}
                placeholder="https://example.com/article"
              />
            ) : (
              <textarea
                ref={importTextRef}
                value={importValue}
                onChange={(event) => setImportValue(event.target.value)}
                placeholder="Paste your text here"
              />
            )}
            {importError ? <div className="import-error">{importError}</div> : null}
            <div className="import-actions">
              <button type="button" onClick={() => setImportMode(null)}>
                Cancel
              </button>
              <button type="submit" disabled={isImporting}>
                {isImporting ? "Importing..." : "Import"}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </main>
  );
}
