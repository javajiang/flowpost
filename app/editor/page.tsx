import Link from "next/link";

export default function EditorPage() {
  return (
    <main className="editor-shell">
      <div className="editor-card">
        <p className="editor-kicker">FlowPost editor</p>
        <h1>Start with text and images</h1>
        <p>
          This is the first working surface for turning raw content into a
          main draft.
        </p>
        <Link href="/" className="hero-cta">
          Back home
        </Link>
      </div>
    </main>
  );
}
