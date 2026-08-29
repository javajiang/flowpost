import Link from "next/link";

const networks = ["X", "Facebook", "Instagram", "LinkedIn", "TikTok", "YouTube", "Threads", "Bluesky"];

export default function ComposePage() {
  return (
    <main className="compose-shell">
      <header className="compose-header">
        <div className="compose-title-group">
          <h1>Create Post</h1>
          <button className="tag-chip" type="button">Tags</button>
        </div>

        <div className="compose-header-actions">
          <button type="button">Templates</button>
          <button type="button">AI Assistant</button>
          <button type="button" className="preview-chip">Preview</button>
          <button type="button" aria-label="Expand">↗</button>
          <Link href="/dashboard" aria-label="Close">×</Link>
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

          <div className="editor-panel">
            <p className="editor-placeholder">Start writing or get inspired with Templates</p>
            <div className="upload-card">
              <span>Drag & drop or select a file</span>
            </div>
            <div className="editor-tools">
              <button type="button">emoji</button>
              <button type="button">#</button>
              <button type="button">URL</button>
            </div>
          </div>
        </section>

        <aside className="compose-preview">
          <h2>Post Previews</h2>
          <div className="preview-empty" />
          <p>See your post&apos;s preview here</p>
        </aside>
      </section>

      <footer className="compose-footer">
        <button type="button" className="publish-button">Connect a Channel to Post</button>
      </footer>
    </main>
  );
}
