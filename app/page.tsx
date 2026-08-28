import Link from "next/link";

const floatingItems = [
  { label: "X", className: "tile tile-left-top" },
  { label: "YT", className: "tile tile-left-mid" },
  { label: "in", className: "tile tile-left-low" },
  { label: "IG", className: "tile tile-bottom-left" },
  { label: "VID", className: "tile tile-top-right" },
  { label: "IMG", className: "tile tile-mid-right" },
  { label: "TXT", className: "tile tile-bottom-right" },
  { label: "AI", className: "tile tile-far-right" },
];

export default function Home() {
  return (
    <main className="page-shell">
      <header className="topbar">
        <Link href="/" className="brand" aria-label="FlowPost home">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span className="brand-name">FlowPost</span>
        </Link>

        <nav className="nav">
          <a href="#features">Features</a>
          <a href="#pricing">Pricing</a>
          <a href="#login">Log in</a>
          <Link href="/editor" className="cta-link">
            Get started
          </Link>
        </nav>
      </header>

      <section className="hero">
        {floatingItems.map((item) => (
          <div key={item.label} className={item.className} aria-hidden="true">
            <span>{item.label}</span>
          </div>
        ))}

        <h1>Create and distribute content in one place</h1>
        <p>Turn text, images, and video into publish-ready content.</p>

        <Link href="/editor" className="hero-cta">
          Get started
        </Link>
      </section>

      <section className="preview" aria-label="Product preview">
        <div className="preview-panel">
          <div className="preview-header">
            <span className="dot" />
            <span className="dot" />
            <span className="dot" />
          </div>
          <div className="preview-body">
            <div className="preview-line short" />
            <div className="preview-line" />
            <div className="preview-line medium" />
            <div className="preview-card-row">
              <div className="mini-card">
                <span>Import</span>
                <strong>Text</strong>
              </div>
              <div className="mini-card">
                <span>Import</span>
                <strong>Images</strong>
              </div>
              <div className="mini-card">
                <span>Generate</span>
                <strong>Drafts</strong>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="band" id="features">
        <span>Text import</span>
        <span>Image upload</span>
        <span>Main draft</span>
        <span>Platform variants</span>
        <span>Publish flow</span>
      </section>
    </main>
  );
}
