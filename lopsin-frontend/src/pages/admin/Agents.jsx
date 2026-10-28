import { useCallback, useEffect, useState } from 'react'
import { getAgents, enrollAgent, rotateAgent, revokeAgent, deleteAgent } from '../../api'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import { apiError, formatRelative } from '../../utils/format'

const ENVIRONMENTS = ['PRODUCTION', 'STAGING', 'DEVELOPMENT', 'CORPORATE']
const PLATFORMS = ['AWS', 'AZURE', 'GCP', 'KUBERNETES', 'ON_PREMISE', 'SAAS']

const EMPTY_FORM = { name: '', environment: 'PRODUCTION', platform: 'AWS' }

export default function Agents() {
  const [agents, setAgents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [issued, setIssued] = useState(null)
  const [copied, setCopied] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    getAgents()
      .then(setAgents)
      .catch((err) => setError(apiError(err, 'Failed to load agents')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    try {
      const agent = await enrollAgent(form)
      setIssued({ ...agent, action: 'enrolled' })
      setModalOpen(false)
      setForm(EMPTY_FORM)
      load()
    } catch (err) {
      setError(apiError(err, 'Could not enrol the agent'))
    }
  }

  const rotate = async (agent) => {
    if (!window.confirm(`Rotate the credential for ${agent.name}? The current secret stops working immediately.`)) return
    try {
      const result = await rotateAgent(agent.id)
      setIssued({ ...agent, ...result, action: 'rotated' })
      load()
    } catch (err) {
      setError(apiError(err, 'Could not rotate the credential'))
    }
  }

  const revoke = async (agent) => {
    if (!window.confirm(`Revoke ${agent.name}? It will stop being able to report signals.`)) return
    try {
      await revokeAgent(agent.id)
      load()
    } catch (err) {
      setError(apiError(err, 'Could not revoke the agent'))
    }
  }

  const remove = async (agent) => {
    if (!window.confirm(`Delete ${agent.name}? Signals it already reported stay on the evidence register.`)) return
    try {
      await deleteAgent(agent.id)
      load()
    } catch (err) {
      setError(apiError(err, 'Could not delete the agent'))
    }
  }

  const copySecret = async () => {
    try {
      await navigator.clipboard.writeText(issued.enrollmentSecret)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Agents</h1>
          <p>
            Collectors running inside your estate. Each one talks outbound over HTTPS only - Lopsin
            never opens a connection into your network.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => setModalOpen(true)}>Enrol an agent</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="card">
        {loading ? (
          <div className="spinner-row">Loading agents...</div>
        ) : agents.length === 0 ? (
          <div className="empty-state">
            No collectors yet. Enrol one to start reporting configuration signals.
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Agent</th>
                  <th>Environment</th>
                  <th>Platform</th>
                  <th>Version</th>
                  <th>Last heartbeat</th>
                  <th>Signals</th>
                  <th>Connectivity</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {agents.map((agent) => (
                  <tr key={agent.id}>
                    <td>
                      <div><strong>{agent.name}</strong></div>
                      <div className="text-muted mono" style={{ fontSize: 11 }}>{agent.hostLabel || agent.id}</div>
                    </td>
                    <td>{agent.environment}</td>
                    <td>{agent.platform}</td>
                    <td className="mono">{agent.version || '--'}</td>
                    <td>{formatRelative(agent.lastHeartbeatAt)}</td>
                    <td>
                      <span className="compare-yes">{agent.signalsAccepted}</span>
                      {agent.signalsRejected > 0 && (
                        <span className="compare-no"> / {agent.signalsRejected} blocked</span>
                      )}
                    </td>
                    <td><Badge value={agent.connectivity} /></td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => rotate(agent)}>Rotate</button>{' '}
                      {agent.status !== 'REVOKED' && (
                        <button className="btn btn-outline btn-sm" onClick={() => revoke(agent)}>Revoke</button>
                      )}{' '}
                      <button className="btn btn-danger btn-sm" onClick={() => remove(agent)}>Delete</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <Modal title="Enrol an agent" onClose={() => setModalOpen(false)}>
          <form onSubmit={submit}>
            <div className="form-field mb-16">
              <label>Agent name</label>
              <input
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="aws-prod-collector"
                required
              />
            </div>
            <div className="form-grid">
              <div className="form-field">
                <label>Environment</label>
                <select
                  value={form.environment}
                  onChange={(event) => setForm({ ...form, environment: event.target.value })}
                >
                  {ENVIRONMENTS.map((option) => <option key={option}>{option}</option>)}
                </select>
              </div>
              <div className="form-field">
                <label>Platform</label>
                <select
                  value={form.platform}
                  onChange={(event) => setForm({ ...form, platform: event.target.value })}
                >
                  {PLATFORMS.map((option) => <option key={option}>{option}</option>)}
                </select>
              </div>
            </div>
            <p className="text-muted" style={{ fontSize: 12.5, lineHeight: 1.6, marginTop: 16 }}>
              Enrolment issues a secret that is shown once. Lopsin stores only its SHA-256 digest,
              so the platform can verify your collector without being able to reproduce its
              credential.
            </p>
            <div className="form-actions">
              <button className="btn btn-primary">Issue credential</button>
              <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}

      {issued && (
        <Modal title={`Agent credential ${issued.action}`} onClose={() => setIssued(null)} width={640}>
          <div className="alert alert-error">
            Copy this secret now. It is stored only as a hash and cannot be shown again.
          </div>
          <div className="secret-box">{issued.enrollmentSecret}</div>
          <div className="form-actions" style={{ marginTop: 0, marginBottom: 20 }}>
            <button className="btn btn-outline btn-sm" onClick={copySecret}>
              {copied ? 'Copied' : 'Copy secret'}
            </button>
          </div>

          <div className="card-title">Run the collector</div>
          <div className="card-subtitle">Outbound HTTPS only. No inbound rule, no VPN, no bastion.</div>
          <div className="code-block">
{`# Docker
docker run -d --name lopsin-agent \\
  -e LOPSIN_API=http://localhost:8080/api \\
  -e LOPSIN_AGENT_SECRET=${issued.enrollmentSecret} \\
  lopsin/agent:1.4

# or from this repository
cd lopsin-agent
LOPSIN_AGENT_SECRET=${issued.enrollmentSecret} node agent.js --once`}
          </div>
          <div className="code-caption">
            The agent handshakes, pulls its collection manifest, reduces each observation to a single
            scalar and posts the batch. Anything outside the signal contract is refused at ingest.
          </div>
        </Modal>
      )}
    </div>
  )
}
