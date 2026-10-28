import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import Logo from '../components/ui/Logo'
import { apiError } from '../utils/format'

const DEMO_ACCOUNTS = [
  {
    role: 'ADMIN',
    label: 'Administrator',
    email: 'admin@lopsin.demo',
    blurb: 'Enrol agents, connect Jira and Slack, manage team access.',
  },
  {
    role: 'COMPLIANCE',
    label: 'Compliance officer',
    email: 'compliance@lopsin.demo',
    blurb: 'Run scans, triage findings, push remediation tickets.',
  },
  {
    role: 'AUDITOR',
    label: 'External auditor',
    email: 'auditor@lopsin.demo',
    blurb: 'Read-only: evidence register, readiness report, activity log.',
  },
]

const DEMO_PASSWORD = 'Lopsin@2026'

const EMPTY_SIGNUP = {
  organizationName: '',
  fullName: '',
  email: '',
  password: '',
  region: 'India',
  industry: 'Technology',
}

export default function Login() {
  const { login, register } = useAuth()
  const navigate = useNavigate()
  const [params] = useSearchParams()

  const [mode, setMode] = useState(params.get('signup') ? 'signup' : 'signin')
  const [email, setEmail] = useState(params.get('demo') ? DEMO_ACCOUNTS[0].email : '')
  const [password, setPassword] = useState(params.get('demo') ? DEMO_PASSWORD : '')
  const [signup, setSignup] = useState(EMPTY_SIGNUP)
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSignIn = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/app/dashboard')
    } catch (err) {
      setError(apiError(err, 'Invalid email or password'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleSignUp = async (event) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await register(signup)
      navigate('/app/dashboard')
    } catch (err) {
      setError(apiError(err, 'Could not create the workspace'))
    } finally {
      setSubmitting(false)
    }
  }

  const signInAsDemo = async (account) => {
    setEmail(account.email)
    setPassword(DEMO_PASSWORD)
    setError('')
    setSubmitting(true)
    try {
      await login(account.email, DEMO_PASSWORD)
      navigate('/app/dashboard')
    } catch (err) {
      setError(apiError(err, 'The demo API is not reachable. Start the backend on port 8080.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-shell" style={{ padding: 24, alignItems: 'flex-start' }}>
      <div style={{ width: '100%', maxWidth: 900, margin: '48px auto' }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <Link to="/" className="site-brand">
            <Logo size={30} />
            <div>
              <div className="site-brand-text">Lopsin</div>
              <div className="site-brand-sub">Compliance without exposure</div>
            </div>
          </Link>
        </div>

        <div className="grid-2" style={{ alignItems: 'start' }}>
          <div className="card">
            <div className="tabs">
              <div
                className={`tab-btn${mode === 'signin' ? ' active' : ''}`}
                onClick={() => { setMode('signin'); setError('') }}
              >
                Sign in
              </div>
              <div
                className={`tab-btn${mode === 'signup' ? ' active' : ''}`}
                onClick={() => { setMode('signup'); setError('') }}
              >
                Create a workspace
              </div>
            </div>

            {error && <div className="alert alert-error">{error}</div>}

            {mode === 'signin' ? (
              <form onSubmit={handleSignIn}>
                <div className="form-field mb-16">
                  <label>Work email</label>
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@company.com"
                    required
                  />
                </div>
                <div className="form-field mb-16">
                  <label>Password</label>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="••••••••"
                    required
                  />
                </div>
                <button className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
                  {submitting ? 'Signing in...' : 'Sign in'}
                </button>
              </form>
            ) : (
              <form onSubmit={handleSignUp}>
                <div className="form-field mb-16">
                  <label>Organisation name</label>
                  <input
                    value={signup.organizationName}
                    onChange={(event) => setSignup({ ...signup, organizationName: event.target.value })}
                    placeholder="Acme Technologies"
                    required
                  />
                </div>
                <div className="form-grid mb-16">
                  <div className="form-field">
                    <label>Your name</label>
                    <input
                      value={signup.fullName}
                      onChange={(event) => setSignup({ ...signup, fullName: event.target.value })}
                      placeholder="Priya R"
                      required
                    />
                  </div>
                  <div className="form-field">
                    <label>Work email</label>
                    <input
                      type="email"
                      value={signup.email}
                      onChange={(event) => setSignup({ ...signup, email: event.target.value })}
                      placeholder="priya@acme.com"
                      required
                    />
                  </div>
                  <div className="form-field">
                    <label>Region</label>
                    <select
                      value={signup.region}
                      onChange={(event) => setSignup({ ...signup, region: event.target.value })}
                    >
                      <option>India</option>
                      <option>European Union</option>
                      <option>United States</option>
                      <option>Global</option>
                    </select>
                  </div>
                  <div className="form-field">
                    <label>Industry</label>
                    <select
                      value={signup.industry}
                      onChange={(event) => setSignup({ ...signup, industry: event.target.value })}
                    >
                      <option>Technology</option>
                      <option>Healthcare</option>
                      <option>Fintech</option>
                      <option>Manufacturing</option>
                      <option>Public sector</option>
                    </select>
                  </div>
                </div>
                <div className="form-field mb-16">
                  <label>Password (at least 10 characters)</label>
                  <input
                    type="password"
                    value={signup.password}
                    onChange={(event) => setSignup({ ...signup, password: event.target.value })}
                    placeholder="••••••••••"
                    minLength={10}
                    required
                  />
                </div>
                <button className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
                  {submitting ? 'Creating workspace...' : 'Create workspace'}
                </button>
                <p className="text-muted" style={{ fontSize: 12, marginTop: 12, lineHeight: 1.6 }}>
                  Creating a workspace never asks for a credential into your systems. Your posture
                  stays at zero until a collector reports its first signal.
                </p>
              </form>
            )}
          </div>

          <div className="card">
            <div className="card-title">Demo workspace</div>
            <div className="card-subtitle">
              Northwind Health Cloud - a healthcare SaaS tenant with three collectors reporting and
              live findings across six frameworks. Pick a role to sign in instantly.
            </div>

            {DEMO_ACCOUNTS.map((account) => (
              <div
                key={account.role}
                style={{
                  border: '1px solid var(--color-border)',
                  padding: '12px 14px',
                  marginBottom: 10,
                }}
              >
                <div className="flex-between" style={{ marginBottom: 6 }}>
                  <strong style={{ fontSize: 13.5 }}>{account.label}</strong>
                  <span className="badge badge-neutral">{account.role}</span>
                </div>
                <div className="text-muted" style={{ fontSize: 12.5, lineHeight: 1.6, marginBottom: 10 }}>
                  {account.blurb}
                </div>
                <div className="flex-between">
                  <span className="mono text-muted">{account.email}</span>
                  <button
                    className="btn btn-outline btn-sm"
                    onClick={() => signInAsDemo(account)}
                    disabled={submitting}
                  >
                    Enter
                  </button>
                </div>
              </div>
            ))}

            <div className="text-muted" style={{ fontSize: 12, lineHeight: 1.6 }}>
              All demo accounts use the password <span className="mono">{DEMO_PASSWORD}</span>.
              The backend must be running on port 8080.
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: 20 }}>
          <Link className="text-muted" style={{ fontSize: 13 }} to="/">← Back to the site</Link>
        </div>
      </div>
    </div>
  )
}
