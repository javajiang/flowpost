"use client";

import Link from "next/link";
import type { ChangeEvent, DragEvent } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

const networks = ["X", "Facebook", "Instagram", "LinkedIn", "TikTok", "YouTube", "Threads", "Bluesky"];

export default function ComposePage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dropzoneRef = useRef<HTMLDivElement | null>(null);
  const [draftText, setDraftText] = useState("");
  const [copied, setCopied] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageName, setImageName] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    if (!copied) return undefined;
    const timer = window.setTimeout(() => setCopied(false), 1500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  useEffect(() => {
    return () => {
      if (imagePreview) URL.revokeObjectURL(imagePreview);
    };
  }, [imagePreview]);

  const previewText = useMemo(() => {
    const trimmed = draftText.trim();
    if (!trimmed) {
      return "See your post's preview here";
    }
    return trimmed.length > 180 ? `${trimmed.slice(0, 180)}...` : trimmed;
  }, [draftText]);

  const setFile = (file: File | null) => {
    if (!file) return;
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    const nextUrl = URL.createObjectURL(file);
    setImagePreview(nextUrl);
    setImageName(file.name);
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

  const handleUrlImport = () => {
    const url = window.prompt("Paste a URL to import");
    if (!url) return;
    setDraftText((current) => {
      const prefix = current.trim() ? `${current.trim()}\n\n` : "";
      return `${prefix}[Imported from URL]\n${url}\n`;
    });
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
            <div className="editor-mode-row">
              <button type="button" className="mode-pill active">
                Text
              </button>
              <button type="button" className="mode-pill" onClick={handleUrlImport}>
                URL
              </button>
              <button type="button" className="mode-pill" onClick={handleCopy}>
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <textarea
              className="draft-textarea"
              value={draftText}
              onChange={(event) => setDraftText(event.target.value)}
              placeholder="Start writing or get inspired with Templates"
            />

            <div className="editor-meta">
              <span>{draftText.length} chars</span>
              <span>{copied ? "Copied to clipboard" : "Ready to edit"}</span>
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
    </main>
  );
}
