"use client";

import Link from "next/link";
import type { ChangeEvent, DragEvent, FormEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

const networks = ["X", "Facebook", "Instagram", "LinkedIn", "TikTok", "YouTube", "Threads", "Bluesky"];

type ImportResponse = {
  sourceUrl: string;
  finalUrl: string;
  title: string;
  description: string;
  content: string;
  imageUrl: string;
};

function buildImportedDraft(result: ImportResponse) {
  return [result.title, result.description, result.content].filter(Boolean).join("\n\n").trim();
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
  const importTextRef = useRef<HTMLTextAreaElement | null>(null);
  const importUrlRef = useRef<HTMLInputElement | null>(null);
  const dropzoneRef = useRef<HTMLDivElement | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const [draftText, setDraftText] = useState("");
  const [copied, setCopied] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [importMode, setImportMode] = useState<"text" | "url" | null>(null);
  const [importValue, setImportValue] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState("");
  const [importSource, setImportSource] = useState("");

  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    return () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
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

  const previewText = useMemo(() => {
    const trimmed = draftText.trim();
    if (!trimmed) {
      return "See your post's preview here";
    }
    return trimmed.length > 180 ? `${trimmed.slice(0, 180)}...` : trimmed;
  }, [draftText]);

  const setFile = (file: File | null) => {
    if (!file) return;
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    const nextUrl = URL.createObjectURL(file);
    objectUrlRef.current = nextUrl;
    setImagePreview(nextUrl);
    setImageName(file.name);
  };

  const clearImportedImage = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    setFile(event.target.files?.[0] ?? null);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragging(false);
    setFile(event.dataTransfer.files?.[0] ?? null);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(draftText);
    setCopied(true);
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
          clearImportedImage();
          setImagePreview(data.imageUrl);
          setImageName("Imported image");
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
              <span>{draftText.length} chars</span>
              <span>
                {copied ? "Copied to clipboard" : importSource ? `Imported from ${formatSourceLabel(importSource)}` : "Ready to edit"}
              </span>
            </div>

            <button
              type="button"
              className="upload-card"
              onClick={() => fileInputRef.current?.click()}
            >
              {imagePreview ? (
                <>
                  <img src={imagePreview} alt={imageName ?? "Uploaded image"} />
                  <strong>{imageName}</strong>
                  <span>Replace image</span>
                </>
              ) : (
                <>
                  <span className="upload-icon">▣</span>
                  <strong>Drag & drop or select a file</strong>
                  <span>Image upload area</span>
                </>
              )}
            </button>

            <div className="editor-tools">
              <button type="button">emoji</button>
              <button type="button">#</button>
            </div>

            <input
              ref={fileInputRef}
              className="sr-only-file"
              type="file"
              accept="image/*"
              onChange={handleFileChange}
            />
          </div>
        </section>

        <aside className="compose-preview">
          <h2>Post Previews</h2>
          <div className="preview-shell">
            {imagePreview ? <img src={imagePreview} alt={imageName ?? "Preview"} /> : <div className="preview-empty" />}
            <p>{previewText}</p>
          </div>
        </aside>
      </section>

      <footer className="compose-footer">
        <button type="button" className="publish-button">
          Connect a Channel to Post
        </button>
      </footer>

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
