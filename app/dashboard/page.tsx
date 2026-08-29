import Link from "next/link";

const stats = [
  { label: "Drafts", value: "0" },
  { label: "Scheduled", value: "0" },
  { label: "Published", value: "0" },
];

const steps = [
  {
    title: "Create a draft",
    description: "Start with text, image, or URL input.",
    action: "Create Post",
  },
  {
    title: "Shape the main draft",
    description: "Turn raw content into a reusable master draft.",
    action: "Open Draft",
  },
  {
    title: "Prepare distribution",
    description: "Generate platform versions and schedule publishing.",
    action: "Go to Publish",
  },
];

export default function DashboardPage() {
  return (
    <main className="workspace-shell">
      <aside className="workspace-sidebar">
        <Link href="/" className="workspace-brand">
          <span className="brand-mark" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
          <span>FlowPost</span>
        </Link>

        <Link href="/compose" className="workspace-new">
          + New
        </Link>

        <nav className="workspace-nav">
          <a className="active" href="/dashboard">Home</a>
          <Link href="/compose">Create</Link>
          <a href="#drafts">Drafts</a>
          <a href="#publish">Publish</a>
          <a href="#assets">Assets</a>
        </nav>
      </aside>

      <section className="workspace-main">
        <header className="workspace-hero">
          <div>
            <p className="eyebrow">Good Morning</p>
            <h1>Your content workspace</h1>
            <p>
              Create one master draft, then shape it into platform-ready versions.
            </p>
          </div>
          <Link href="/compose" className="hero-pill">
            Create Post
          </Link>
        </header>

        <section className="stat-row" aria-label="Workspace summary">
          {stats.map((stat) => (
            <article key={stat.label} className="stat-card">
              <strong>{stat.value}</strong>
              <span>{stat.label}</span>
            </article>
          ))}
        </section>

        <section className="banner-card">
          <span>Connect a channel to start publishing.</span>
        </section>

        <section className="step-grid" aria-label="First steps">
          {steps.map((step, index) => (
            <article key={step.title} className="step-card">
              <p className="step-index">0{index + 1}</p>
              <h2>{step.title}</h2>
              <p>{step.description}</p>
              <Link href="/compose" className="step-action">
                {step.action}
              </Link>
            </article>
          ))}
        </section>

        <section className="workspace-grid" id="drafts">
          <article className="empty-panel">
            <h2>Up next</h2>
            <p>No drafts yet.</p>
          </article>
          <article className="empty-panel">
            <h2>Comments</h2>
            <p>No comments yet.</p>
          </article>
        </section>
      </section>
    </main>
  );
}
