const createSession = `POST /v3/organizations/{org_id}/sessions

{
  "prompt": "Audit the service and return a fix plan",
  "repos": [{ "repo": "org/api", "branch": "main" }],
  "attachment_urls": ["https://…/context.csv"],
  "secret_ids": ["sec_…"],
  "max_acu_limit": 5,
  "devin_mode": "normal",
  "structured_output_schema": { "type": "object", "…": "…" },
  "structured_output_required": true
}`;

const parameters = [
  "prompt",
  "attachment_urls",
  "repos",
  "knowledge_ids",
  "playbook_id",
  "child_playbook_id",
  "secret_ids",
  "session_secrets",
  "max_acu_limit",
  "platform",
  "session_links",
  "tags",
  "title",
  "structured_output_schema",
  "structured_output_required",
  "bypass_approval",
  "devin_mode",
];

const lifecycle = [
  ["01", "Upload", "Give Devin files, code, data, or docs."],
  ["02", "Create", "Start a prepared session with one request."],
  ["03", "Monitor", "Poll state and stream messages into your UI."],
  ["04", "Continue", "Send follow-up instructions to the same worker."],
  ["05", "Collect", "Retrieve validated JSON and generated files."],
];

const capabilities = [
  {
    number: "01",
    title: "Shell + filesystem",
    text: "Run project commands, scripts, tests, package managers, and any CLI installed in the VM.",
    tag: "Arbitrary programs",
  },
  {
    number: "02",
    title: "Browser + desktop",
    text: "Operate Chrome, desktop apps, terminal UIs, forms, authenticated sessions, and visual workflows.",
    tag: "Computer Use",
  },
  {
    number: "03",
    title: "APIs + credentials",
    text: "Use org secrets or temporary session secrets to reach databases, backends, and remote services.",
    tag: "Authenticated",
  },
  {
    number: "04",
    title: "Custom MCP tools",
    text: "Expose typed actions over STDIO, SSE, or HTTP—from inspect_object() to verify_result().",
    tag: "Agent-native",
  },
];

const endpoints = [
  ["Create session", "POST", "/sessions"],
  ["Get session", "GET", "/sessions/{id}"],
  ["Send message", "POST", "/sessions/{id}/messages"],
  ["List messages", "GET", "/sessions/{id}/messages"],
  ["List attachments", "GET", "/sessions/{id}/attachments"],
  ["Terminate / archive", "POST", "/sessions/{id}/…"],
];

const sources = [
  ["API overview", "https://docs.devin.ai/api-reference/overview"],
  ["Create session", "https://docs.devin.ai/api-reference/v3/sessions/post-organizations-sessions"],
  ["Session tools", "https://docs.devin.ai/work-with-devin/devin-session-tools"],
  ["Blueprints", "https://docs.devin.ai/onboard-devin/environment/blueprints"],
  ["MCP", "https://docs.devin.ai/work-with-devin/mcp"],
  ["Computer Use", "https://docs.devin.ai/work-with-devin/computer-use"],
];

function Arrow() {
  return <span className="arrow" aria-hidden="true">→</span>;
}

export default function Home() {
  return (
    <main>
      <nav className="topbar" aria-label="Page navigation">
        <a className="wordmark" href="#top" aria-label="Devin API Cheatsheet home">
          <span className="wordmark-mark">D</span>
          <span>DEVIN API</span>
        </a>
        <div className="nav-links">
          <a href="#quickstart">Quickstart</a>
          <a href="#capabilities">Capabilities</a>
          <a href="#reference">Reference</a>
        </div>
        <a className="docs-link" href="https://docs.devin.ai/api-reference/overview" target="_blank" rel="noreferrer">
          Official docs <span aria-hidden="true">↗</span>
        </a>
      </nav>

      <section className="hero" id="top">
        <div className="eyebrow"><span className="pulse" /> V3 RECOMMENDED <span className="muted">/ AUG 22, 2026</span></div>
        <h1>Control a worker.<br /><span>Not just a model.</span></h1>
        <p className="hero-copy">
          The Devin API starts and steers a real autonomous session with a VM, shell, browser, desktop, files, credentials, and custom tools.
        </p>

        <div className="mental-model" aria-label="Devin API mental model">
          <div className="model-node primary-node">
            <span className="node-kicker">YOUR PRODUCT</span>
            <strong>UI + Backend</strong>
          </div>
          <Arrow />
          <div className="model-node agent-node">
            <span className="node-kicker">REST API</span>
            <strong>Devin session</strong>
            <span className="node-detail">Agent inside a prepared VM</span>
          </div>
          <Arrow />
          <div className="model-node result-node">
            <span className="node-kicker">OUTPUT</span>
            <strong>JSON + files</strong>
          </div>
        </div>

        <div className="boundary-callout">
          <span className="callout-label">KEY DISTINCTION</span>
          <p>Your backend instructs the <strong>agent</strong>. Devin chooses how to use its shell, browser, desktop, and tools. The REST API is not a low-level remote-control API.</p>
        </div>
      </section>

      <section className="section" id="quickstart">
        <div className="section-heading">
          <span>01 / CORE LOOP</span>
          <h2>The 90% path</h2>
          <p>The smallest useful integration for a hackathon.</p>
        </div>
        <div className="lifecycle">
          {lifecycle.map(([number, title, detail], index) => (
            <article className="lifecycle-step" key={title}>
              <span className="step-number">{number}</span>
              <h3>{title}</h3>
              <p>{detail}</p>
              {index < lifecycle.length - 1 && <span className="step-line" aria-hidden="true" />}
            </article>
          ))}
        </div>

        <div className="code-layout">
          <div className="code-panel">
            <div className="code-header">
              <span>CREATE SESSION</span>
              <span className="method post">POST</span>
            </div>
            <pre><code>{createSession}</code></pre>
          </div>
          <aside className="parameter-panel">
            <div className="mini-label">SESSION INPUTS</div>
            <h3>Prepare the worker in one call.</h3>
            <div className="chip-grid">
              {parameters.map((parameter) => <code key={parameter}>{parameter}</code>)}
            </div>
          </aside>
        </div>
      </section>

      <section className="section capabilities-section" id="capabilities">
        <div className="section-heading inline-heading">
          <div>
            <span>02 / RUNTIME</span>
            <h2>What the worker can use</h2>
          </div>
          <p>Devin’s capability boundary is roughly the boundary of the programs, services, and tools available in its environment.</p>
        </div>
        <div className="capability-grid">
          {capabilities.map((capability) => (
            <article className="capability-card" key={capability.number}>
              <div className="card-top"><span>{capability.number}</span><span className="card-tag">{capability.tag}</span></div>
              <h3>{capability.title}</h3>
              <p>{capability.text}</p>
            </article>
          ))}
        </div>

        <div className="tool-choice">
          <div>
            <span className="option-label">OPTION A</span>
            <strong>Agent <Arrow /> Shell <Arrow /> CLI / script</strong>
            <p>Fastest when your capability already has a command-line interface.</p>
          </div>
          <div className="versus">OR</div>
          <div>
            <span className="option-label">OPTION B</span>
            <strong>Agent <Arrow /> MCP <Arrow /> Backend</strong>
            <p>Best for explicit, typed tools the agent can discover and call.</p>
          </div>
        </div>
      </section>

      <section className="section" id="reference">
        <div className="section-heading inline-heading">
          <div>
            <span>03 / REFERENCE</span>
            <h2>Session controls</h2>
          </div>
          <p>Create once, then monitor, message, resume, collect, and close the same autonomous worker.</p>
        </div>

        <div className="reference-grid">
          <div className="endpoint-table" role="table" aria-label="Essential session endpoints">
            <div className="endpoint-row table-head" role="row">
              <span role="columnheader">Action</span><span role="columnheader">Method</span><span role="columnheader">Path</span>
            </div>
            {endpoints.map(([name, method, path]) => (
              <div className="endpoint-row" role="row" key={name}>
                <strong role="cell">{name}</strong>
                <span role="cell" className={`method ${method.toLowerCase()}`}>{method}</span>
                <code role="cell">{path}</code>
              </div>
            ))}
          </div>

          <div className="status-panel">
            <div className="mini-label">STATUS</div>
            <h3>Map agent state directly into your UI.</h3>
            <div className="status-list">
              <span><i className="dot running" /> working</span>
              <span><i className="dot waiting" /> waiting_for_user</span>
              <span><i className="dot approval" /> waiting_for_approval</span>
              <span><i className="dot finished" /> finished</span>
              <span><i className="dot error" /> error</span>
            </div>
            <p className="status-note">Sending a message can automatically resume a suspended session.</p>
          </div>
        </div>

        <div className="guardrail-grid">
          <article>
            <span className="mini-label">STRUCTURED OUTPUT</span>
            <h3>Return product-ready JSON</h3>
            <p>Supply a JSON Schema Draft 7 definition and set <code>structured_output_required</code> to require a validated final result.</p>
          </article>
          <article>
            <span className="mini-label">COST CONTROL</span>
            <h3>Bound every run</h3>
            <p>Use <code>max_acu_limit</code> and record <code>acus_consumed</code>. Normal and Fast are confirmed modes; verify Lite against your account before relying on it.</p>
          </article>
          <article>
            <span className="mini-label">PREPARED ENVIRONMENT</span>
            <h3>Blueprint → Build → Snapshot</h3>
            <p>Preinstall runtimes, dependencies, tools, files, and configuration so each session starts from a fresh, ready VM.</p>
          </article>
        </div>
      </section>

      <section className="section scale-section">
        <div className="section-heading inline-heading">
          <div>
            <span>04 / BEYOND THE LOOP</span>
            <h2>Scale when the demo works</h2>
          </div>
          <p>V3 also covers the infrastructure around sessions.</p>
        </div>
        <div className="scale-strip">
          {["Knowledge", "Playbooks", "Blueprints", "Schedules", "Automations", "Repositories", "Secrets", "Insights", "Metrics", "Audit logs"].map((item) => <span key={item}>{item}</span>)}
        </div>
      </section>

      <footer>
        <div>
          <span className="footer-mark">D</span>
          <p><strong>Devin API v3 cheatsheet</strong><br />Built for fast product decisions.</p>
        </div>
        <div className="source-links" aria-label="Official Devin documentation sources">
          {sources.map(([label, href]) => <a href={href} target="_blank" rel="noreferrer" key={href}>{label} ↗</a>)}
        </div>
        <p className="footnote">Reference snapshot: Aug 22, 2026. Verify account-specific features and current API behavior before production use.</p>
      </footer>
    </main>
  );
}
