import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import Logo from '../../components/ui/Logo'
import { getPublicOverview } from '../../api'
import { useAuth } from '../../context/AuthContext'

/** Static fallback so the marketing site renders even when the API is offline. */
const FALLBACK = {
  totalFrameworks: 6,
  totalControls: 20,
  totalChecks: 47,
  signalContractSize: 44,
  frameworks: [
    { code: 'GDPR', name: 'EU General Data Protection Regulation', region: 'European Union', version: '2016/679', checkCount: 8, summary: 'Protection of natural persons with regard to the processing of personal data.' },
    { code: 'DPDP', name: 'Digital Personal Data Protection Act', region: 'India', version: '2023', checkCount: 5, summary: 'Notice, consent and the duties of a data fiduciary.' },
    { code: 'HIPAA', name: 'HIPAA Security Rule', region: 'United States', version: '45 CFR Part 164', checkCount: 6, summary: 'Safeguards for electronic protected health information.' },
    { code: 'SOC2', name: 'SOC 2 Trust Services Criteria', region: 'Global', version: '2017 (rev. 2022)', checkCount: 11, summary: 'Security, availability and confidentiality of a service organisation.' },
    { code: 'ISO27001', name: 'ISO/IEC 27001 Annex A', region: 'Global', version: '2022', checkCount: 8, summary: 'Information security controls for an ISMS.' },
    { code: 'EUAIACT', name: 'EU Artificial Intelligence Act', region: 'European Union', version: '2024/1689', checkCount: 9, summary: 'Risk-based obligations for providers and deployers of AI systems.' },
  ],
}

const PILLARS = [
  {
    index: 'Layer 01',
    title: 'Regulation intelligence engine',
    body:
      'Tracks obligations across jurisdictions, including AI governance rules, and compiles each one into a machine-evaluable check bound to a single configuration signal. When a regulation changes, the check library changes with it.',
  },
  {
    index: 'Layer 02',
    title: 'Read-only estate agent',
    body:
      'A collector runs inside your perimeter and reports configuration state and telemetry. It holds no database credential, opens no inbound port and has no route to customer records. Every value it sends is a declared scalar.',
  },
  {
    index: 'Layer 03',
    title: 'Remediation orchestration',
    body:
      'A failing control becomes work in the tools your team already runs: a Jira issue, a GitHub issue, a Slack alert, each carrying the control reference, the observed value and the fix. Violations close inside their deadline.',
  },
]

const CONNECT_STEPS = [
  {
    title: 'Create your workspace',
    body:
      'Register the organisation and pick the frameworks that apply to you. Lopsin never asks for a database credential, an API key into your systems, or a data export, because it has no use for one.',
    aside: 'Takes about two minutes. No procurement review needed - there is no data flow to assess.',
  },
  {
    title: 'Enrol a collector',
    body:
      'Generate an enrolment secret in the console and run the agent inside your estate as a container, a systemd unit, or a scheduled CI job. Lopsin stores only a SHA-256 digest of that secret, so the platform can verify your agent without ever being able to reproduce its credential.',
    aside: 'Outbound HTTPS to api.lopsin.io:443 only. No inbound firewall rule, no VPN, no bastion.',
  },
  {
    title: 'The agent pulls its manifest',
    body:
      'The collector asks which signals to observe and receives a list of key names and types. It reads configuration state from your cloud, identity and CI providers, reduces each observation to one scalar, and posts the batch.',
    aside: 'The manifest is a list of keys. It contains no query, no path and no credential.',
  },
  {
    title: 'Findings and fixes flow back',
    body:
      'Each observation is evaluated against the control library, findings appear in the console with the evidence that produced them, and anything failing is pushed into Jira, GitHub or Slack with an SLA attached to its severity.',
    aside: 'Continuous, not annual. The posture updates on every collection cycle.',
  },
]

const NEVER_SEEN = [
  'Customer records, rows, files or documents',
  'Database contents, backups or exports',
  'Personal data of your users or employees',
  'Source code, secrets or private keys',
  'Credentials into any of your systems',
  'Inbound network access of any kind',
]

const ALWAYS_SEEN = [
  'Whether MFA is enforced on admin accounts (true/false)',
  'How many object stores are publicly readable (a count)',
  'The lowest TLS version your listeners accept (a string)',
  'Days since your last verified restore test (a number)',
  'Whether audit logging is switched on (true/false)',
  'Retention configured on personal data stores (a number)',
]

export default function Landing() {
  const [overview, setOverview] = useState(FALLBACK)
  const navigate = useNavigate()
  const { user } = useAuth()
  const connectRef = useRef(null)
  const frameworksRef = useRef(null)
  const securityRef = useRef(null)

  useEffect(() => {
    let active = true
    getPublicOverview()
      .then((data) => {
        if (active && data?.frameworks?.length) setOverview(data)
      })
      .catch(() => {
        // The marketing site stays useful without the API.
      })
    return () => {
      active = false
    }
  }, [])

  const scrollTo = (ref) => ref.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  return (
    <div className="site">
      <header className="site-header">
        <div className="site-header-inner">
          <div className="site-brand">
            <Logo size={28} />
            <div>
              <div className="site-brand-text">Lopsin</div>
              <div className="site-brand-sub">Compliance without exposure</div>
            </div>
          </div>

          <nav className="site-nav">
            <button className="site-nav-link" onClick={() => scrollTo(connectRef)}>How it connects</button>
            <button className="site-nav-link" onClick={() => scrollTo(frameworksRef)}>Coverage</button>
            <button className="site-nav-link" onClick={() => scrollTo(securityRef)}>Zero data access</button>
          </nav>

          <div className="site-header-actions">
            {user ? (
              <Link className="btn btn-primary btn-sm" to="/app/dashboard">Open console</Link>
            ) : (
              <>
                <Link className="btn btn-outline btn-sm" to="/login">Sign in</Link>
                <Link className="btn btn-primary btn-sm" to="/login?demo=1">Visit demo page</Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="site-main">
        {/* ---------------- Hero ---------------- */}
        <section className="hero">
          <div className="hero-inner">
            <div>
              <div className="hero-eyebrow">Legal, Operational &amp; Policy Standards Intelligence Network</div>
              <h1>Prove you are compliant without handing over your data.</h1>
              <p>
                Every compliance tool asks for access to the systems it audits. That access is
                itself the risk: a new route into your estate, a longer security review, a slower
                deployment. Lopsin removes the access and keeps the assurance - it evaluates your
                configuration state and telemetry, never the information inside it.
              </p>
              <div className="hero-actions">
                <button className="btn btn-primary btn-lg" onClick={() => navigate('/login?demo=1')}>
                  Visit demo page
                </button>
                <button className="btn btn-outline btn-lg" onClick={() => scrollTo(connectRef)}>
                  See how companies connect
                </button>
              </div>
              <div className="hero-proof">
                <div className="hero-proof-item">
                  <div className="hero-proof-value">{overview.totalFrameworks}</div>
                  <div className="hero-proof-label">Frameworks</div>
                </div>
                <div className="hero-proof-item">
                  <div className="hero-proof-value">{overview.totalChecks}</div>
                  <div className="hero-proof-label">Automated checks</div>
                </div>
                <div className="hero-proof-item">
                  <div className="hero-proof-value">{overview.signalContractSize}</div>
                  <div className="hero-proof-label">Declared signals</div>
                </div>
                <div className="hero-proof-item">
                  <div className="hero-proof-value">0</div>
                  <div className="hero-proof-label">Records accessed</div>
                </div>
              </div>
            </div>

            {/* Console preview */}
            <div className="hero-panel">
              <div className="hero-panel-bar">
                <span className="hero-panel-dot" />
                <span className="hero-panel-dot" />
                <span className="hero-panel-dot" />
                <span className="hero-panel-title">Lopsin console - live posture</span>
              </div>
              <div className="hero-panel-body">
                <div className="score-row">
                  <div className="score-value">73</div>
                  <div className="text-muted" style={{ fontSize: 13 }}>compliance score</div>
                </div>
                <div className="score-caption">Severity-weighted across 47 controls, updated every cycle</div>
                <div className="meter"><div className="meter-fill" style={{ width: '73%' }} /></div>

                <div className="mini-row">
                  <span className="mini-row-key">storage.public_buckets</span>
                  <span><span className="badge badge-danger">FAIL</span></span>
                </div>
                <div className="mini-row">
                  <span className="mini-row-key">identity.mfa_enforced_admins</span>
                  <span><span className="badge badge-success">PASS</span></span>
                </div>
                <div className="mini-row">
                  <span className="mini-row-key">logging.retention_days</span>
                  <span><span className="badge badge-success">PASS</span></span>
                </div>
                <div className="mini-row">
                  <span className="mini-row-key">ai.human_oversight_configured</span>
                  <span><span className="badge badge-warning">WARN</span></span>
                </div>
                <div className="mini-row" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <span className="mini-row-key">patient.records</span>
                  <span><span className="badge badge-neutral">BLOCKED</span></span>
                </div>
                <div className="text-muted" style={{ fontSize: 11.5, marginTop: 12, lineHeight: 1.6 }}>
                  The last row is the point: a collector that tries to send data is refused at the
                  boundary, not stored and filtered later.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ---------------- Problem ---------------- */}
        <div className="section-tinted">
          <section className="section">
            <div className="section-label">The standing trade-off</div>
            <h2 className="section-title">Regulatory visibility has always cost you data security.</h2>
            <p className="section-lead">
              Traditional compliance platforms connect directly to internal systems to check whether
              you follow the rules. That connection widens your attack surface, drags deployment
              through a security review, and makes the auditor a permanent tenant of your estate.
              Lopsin breaks the trade-off by changing what gets inspected.
            </p>

            <div className="table-scroll">
              <table className="data-table compare-table">
                <thead>
                  <tr>
                    <th>Dimension</th>
                    <th>Traditional compliance tooling</th>
                    <th>Lopsin</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><strong>What it inspects</strong></td>
                    <td>Your data, to infer how it is handled</td>
                    <td>Configuration state, telemetry and metadata</td>
                  </tr>
                  <tr>
                    <td><strong>Access required</strong></td>
                    <td>Database credentials, read access, data export</td>
                    <td className="compare-yes">None. Outbound HTTPS from your agent only</td>
                  </tr>
                  <tr>
                    <td><strong>Attack surface added</strong></td>
                    <td className="compare-no">A new privileged path into production</td>
                    <td className="compare-yes">No inbound path exists to attack</td>
                  </tr>
                  <tr>
                    <td><strong>Breach blast radius</strong></td>
                    <td className="compare-no">Vendor breach exposes your records</td>
                    <td className="compare-yes">A breach exposes booleans and counters</td>
                  </tr>
                  <tr>
                    <td><strong>Time to deploy</strong></td>
                    <td>Weeks of security and privacy review</td>
                    <td className="compare-yes">Minutes - there is no data flow to assess</td>
                  </tr>
                  <tr>
                    <td><strong>Assurance cadence</strong></td>
                    <td>Point-in-time, at audit season</td>
                    <td className="compare-yes">Continuous, on every collection cycle</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* ---------------- Pillars ---------------- */}
        <section className="section">
          <div className="section-label">Platform architecture</div>
          <h2 className="section-title">Three layers, one boundary.</h2>
          <p className="section-lead">
            The intelligence engine decides what must be true. The agent observes whether it is
            true. The orchestration layer makes it true again when it drifts.
          </p>
          <div className="grid-3">
            {PILLARS.map((pillar) => (
              <div className="pillar" key={pillar.index}>
                <div className="pillar-index">{pillar.index}</div>
                <h3>{pillar.title}</h3>
                <p>{pillar.body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- How companies connect ---------------- */}
        <div className="section-tinted" ref={connectRef}>
          <section className="section">
            <div className="section-label">Onboarding</div>
            <h2 className="section-title">How a company connects to Lopsin.</h2>
            <p className="section-lead">
              Four steps, no credential sharing at any point. The connection is outbound-only, which
              is why it survives a security review that a data-access integration would not.
            </p>

            <div className="grid-2">
              <div className="card">
                {CONNECT_STEPS.map((step, index) => (
                  <div className="step" key={step.title}>
                    <div className="step-number">{index + 1}</div>
                    <div className="step-body">
                      <h3>{step.title}</h3>
                      <p>{step.body}</p>
                      <div className="text-muted" style={{ fontSize: 12 }}>{step.aside}</div>
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <div className="code-block">
{`POST /api/agent/signals
Authorization: Bearer lpsn_••••

`}<span className="c-comment">{`// What the agent is allowed to send:`}</span>{`
{ `}<span className="c-key">"key"</span>{`: `}<span className="c-string">"identity.mfa_enforced_admins"</span>{`,
  `}<span className="c-key">"value"</span>{`: true }

{ `}<span className="c-key">"key"</span>{`: `}<span className="c-string">"storage.public_buckets"</span>{`,
  `}<span className="c-key">"value"</span>{`: 2 }

`}<span className="c-comment">{`// What the guard refuses, every time:`}</span>{`
`}<span className="c-bad">{`{ "key": "patient.records",
  "value": "Jane Doe, DOB 1984-02-11" }
  -> 422 ALLOW_LIST

{ "key": "transport.tls_min_version",
  "value": "admin@acme.com" }
  -> 422 CONTENT_SCAN`}</span>
                </div>
                <div className="code-caption">
                  Four gates stand between a collector and the database: the key must be in the
                  published contract, the value must match its declared type, structured payloads
                  and long strings are refused outright, and every string is screened for personal
                  data, secrets and file paths. A refused signal is never stored.
                </div>

                <div className="card mt-16">
                  <div className="card-title">Already have tooling? Connect that instead.</div>
                  <div className="card-subtitle">
                    The agent is the easy path, not the only one.
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 1.9, color: 'var(--color-text-muted)' }}>
                    <li><strong>CI/CD push</strong> - post signals from a pipeline step after each deploy.</li>
                    <li><strong>Cloud read-only roles</strong> - scoped to configuration description calls, never object reads.</li>
                    <li><strong>Direct API</strong> - any system that can make an HTTPS request can report a signal.</li>
                    <li><strong>Workflow tools</strong> - Jira, GitHub and Slack receive the remediation work.</li>
                  </ul>
                </div>
              </div>
            </div>
          </section>
        </div>

        {/* ---------------- Coverage ---------------- */}
        <section className="section" ref={frameworksRef}>
          <div className="section-label">Coverage</div>
          <h2 className="section-title">
            {overview.totalFrameworks} frameworks, {overview.totalChecks} automated checks.
          </h2>
          <p className="section-lead">
            Privacy law, security assurance and AI governance evaluated from the same telemetry, so
            one collection cycle answers several regulators at once.
          </p>
          <div className="grid-3">
            {overview.frameworks.map((framework) => (
              <div className="pillar" key={framework.code}>
                <div className="pillar-index">
                  {framework.region} · {framework.version}
                </div>
                <h3>{framework.name}</h3>
                <p>{framework.summary}</p>
                <div className="text-muted" style={{ fontSize: 12, marginTop: 12 }}>
                  {framework.checkCount} automated checks
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ---------------- Zero data access ---------------- */}
        <div className="section-tinted" ref={securityRef}>
          <section className="section">
            <div className="section-label">The boundary</div>
            <h2 className="section-title">What Lopsin sees, and what it never can.</h2>
            <p className="section-lead">
              This is not a policy promise. It is enforced in code at the ingest endpoint, and every
              refusal is written to an audit trail you can read.
            </p>
            <div className="grid-2">
              <div className="card">
                <div className="card-title">Never reaches the platform</div>
                <div className="card-subtitle">Refused at the boundary, not filtered after storage</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 2 }}>
                  {NEVER_SEEN.map((item) => (
                    <li key={item}><span className="compare-no">✕</span>&nbsp; {item}</li>
                  ))}
                </ul>
              </div>
              <div className="card">
                <div className="card-title">All Lopsin ever holds</div>
                <div className="card-subtitle">Scalar observations about configuration, nothing more</div>
                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 13, lineHeight: 2 }}>
                  {ALWAYS_SEEN.map((item) => (
                    <li key={item}><span className="compare-yes">✓</span>&nbsp; {item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </div>

        {/* ---------------- Outcomes + CTA ---------------- */}
        <section className="section">
          <div className="grid-3">
            <div className="pillar">
              <div className="pillar-index">Security</div>
              <h3>A smaller attack surface</h3>
              <p>
                No inbound path, no stored credential, no data at rest worth stealing. The vendor
                risk your security team worries about does not exist here.
              </p>
            </div>
            <div className="pillar">
              <div className="pillar-index">Audit</div>
              <h3>Evidence that is already gathered</h3>
              <p>
                Every finding cites the signal, the timestamp and the integrity digest it came from.
                Audit preparation becomes a report you export, not a quarter you lose.
              </p>
            </div>
            <div className="pillar">
              <div className="pillar-index">Revenue</div>
              <h3>Faster vendor onboarding</h3>
              <p>
                Share a live readiness report instead of a stale questionnaire. Security review stops
                being the reason a deal slips a quarter.
              </p>
            </div>
          </div>

          <div className="card mt-16" style={{ textAlign: 'center', padding: '34px 24px' }}>
            <h2 className="section-title" style={{ marginBottom: 8 }}>See it running on a real tenant.</h2>
            <p className="text-muted" style={{ maxWidth: 560, margin: '0 auto 22px', lineHeight: 1.7 }}>
              The demo workspace is a healthcare SaaS company with three collectors reporting, a live
              posture score and open findings across six frameworks. Sign in as an administrator, a
              compliance officer or an external auditor.
            </p>
            <Link className="btn btn-primary btn-lg" to="/login?demo=1">Visit demo page</Link>
          </div>
        </section>
      </main>

      <footer className="site-footer">
        <div className="site-footer-inner">
          <div className="site-footer-grid">
            <div>
              <h4>Lopsin</h4>
              <p>
                Legal, Operational &amp; Policy Standards Intelligence Network. Continuous regulatory
                assurance with a zero-data-access architecture.
              </p>
            </div>
            <div>
              <h4>Platform</h4>
              <ul>
                <li>Regulation intelligence engine</li>
                <li>Zero-data-access agent</li>
                <li>Remediation orchestration</li>
                <li>Evidence register</li>
              </ul>
            </div>
            <div>
              <h4>Coverage</h4>
              <ul>
                {overview.frameworks.slice(0, 6).map((framework) => (
                  <li key={framework.code}>{framework.code}</li>
                ))}
              </ul>
            </div>
            <div>
              <h4>Project</h4>
              <ul>
                <li>K. Sai Keerthan - 2411CS040084</li>
                <li>G. Mahender - 2411CS040064</li>
                <li>Malla Reddy University</li>
              </ul>
            </div>
          </div>
          <div className="site-footer-bottom">
            <span>Lopsin - compliance without exposure.</span>
            <span>Application Development project, 2026.</span>
          </div>
        </div>
      </footer>
    </div>
  )
}
