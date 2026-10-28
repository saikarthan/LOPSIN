import { useCallback, useEffect, useState } from 'react'
import { getIntegrations, connectIntegration, disconnectIntegration } from '../../api'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import { apiError, formatDateTime } from '../../utils/format'

export default function Integrations() {
  const [integrations, setIntegrations] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState({})

  const load = useCallback(() => {
    setLoading(true)
    getIntegrations()
      .then(setIntegrations)
      .catch((err) => setError(apiError(err, 'Failed to load integrations')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const openConnect = (integration) => {
    setForm(integration.config || {})
    setEditing(integration)
    setError('')
  }

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    try {
      await connectIntegration(editing.system, form)
      setNotice(`${editing.name} connected. Remediation tickets can now be raised there.`)
      setEditing(null)
      load()
    } catch (err) {
      setError(apiError(err, 'Could not connect that tool'))
    }
  }

  const disconnect = async (integration) => {
    if (!window.confirm(`Disconnect ${integration.name}? Existing tickets stay on the board.`)) return
    try {
      await disconnectIntegration(integration.system)
      setNotice(`${integration.name} disconnected.`)
      load()
    } catch (err) {
      setError(apiError(err, 'Could not disconnect that tool'))
    }
  }

  if (loading) return <div className="spinner-row">Loading integrations...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Integrations</h1>
          <p>
            Where remediation work lands. These connections push work outward; none of them grant
            Lopsin read access to anything.
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <div className="grid-3">
        {integrations.map((integration) => (
          <div className="pillar" key={integration.system}>
            <div className="flex-between" style={{ marginBottom: 10 }}>
              <div className="pillar-index">{integration.category}</div>
              <Badge value={integration.status} />
            </div>
            <h3>{integration.name}</h3>
            <p>{integration.description}</p>

            <div className="text-muted mono" style={{ fontSize: 11.5, margin: '12px 0' }}>
              scope requested: {integration.scopeRequested}
            </div>

            {integration.status === 'CONNECTED' && (
              <div style={{ fontSize: 12, marginBottom: 12 }}>
                {Object.entries(integration.config).map(([key, value]) => (
                  <div key={key} className="text-muted">
                    {key}: <span className="mono">{value}</span>
                  </div>
                ))}
                <div className="text-muted" style={{ marginTop: 6 }}>
                  Connected {formatDateTime(integration.connectedAt)}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn btn-outline btn-sm" onClick={() => openConnect(integration)}>
                {integration.status === 'CONNECTED' ? 'Reconfigure' : 'Connect'}
              </button>
              {integration.status === 'CONNECTED' && (
                <button className="btn btn-danger btn-sm" onClick={() => disconnect(integration)}>
                  Disconnect
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="card mt-16">
        <div className="card-title">Why these connections are safe</div>
        <div className="card-subtitle">The orchestration layer is outbound by design</div>
        <p className="text-muted" style={{ fontSize: 13, lineHeight: 1.7, margin: 0 }}>
          A remediation ticket carries the control reference, the observed configuration value and
          the fix - never a customer record, because the platform does not hold one. The scope
          requested from each tool is write-only for that reason: Lopsin needs to create an issue or
          post a message, not to read your project, your repository or your channel history.
        </p>
      </div>

      {editing && (
        <Modal title={`Connect ${editing.name}`} onClose={() => setEditing(null)}>
          <form onSubmit={submit}>
            {editing.fields.map((field) => (
              <div className="form-field mb-16" key={field.key}>
                <label>{field.label}</label>
                <input
                  value={form[field.key] || ''}
                  onChange={(event) => setForm({ ...form, [field.key]: event.target.value })}
                  placeholder={field.placeholder}
                  required={field.required}
                />
              </div>
            ))}
            <div className="form-actions">
              <button className="btn btn-primary">Connect</button>
              <button type="button" className="btn btn-outline" onClick={() => setEditing(null)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
