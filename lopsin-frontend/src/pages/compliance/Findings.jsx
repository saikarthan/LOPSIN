import { useCallback, useEffect, useState } from 'react'
import {
  getFindings, getFinding, createTicket, requestAdvice, getAdvisorStatus, getIntegrations,
} from '../../api'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import Severity from '../../components/ui/Severity'
import { useAuth } from '../../context/AuthContext'
import { apiError, formatDateTime, formatValue } from '../../utils/format'

const STATUS_OPTIONS = ['', 'FAIL', 'WARN', 'PASS', 'NOT_APPLICABLE']
const SEVERITY_OPTIONS = ['', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW']

export default function Findings() {
  const { user } = useAuth()
  const canAct = user.role === 'ADMIN' || user.role === 'COMPLIANCE'

  const [findings, setFindings] = useState([])
  const [frameworks, setFrameworks] = useState([])
  const [filters, setFilters] = useState({ status: 'FAIL', severity: '', framework: '' })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const [selected, setSelected] = useState(null)
  const [advice, setAdvice] = useState(null)
  const [advising, setAdvising] = useState(false)
  const [advisorEnabled, setAdvisorEnabled] = useState(false)
  const [connectedSystems, setConnectedSystems] = useState([])
  const [ticketSystem, setTicketSystem] = useState('MANUAL')
  const [assignee, setAssignee] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value))
    getFindings(params)
      .then((data) => {
        setFindings(data)
        setFrameworks([...new Set(data.map((finding) => finding.frameworkCode))].sort())
      })
      .catch((err) => setError(apiError(err, 'Failed to load findings')))
      .finally(() => setLoading(false))
  }, [filters])

  useEffect(load, [load])

  useEffect(() => {
    getAdvisorStatus().then((status) => setAdvisorEnabled(status.enabled)).catch(() => setAdvisorEnabled(false))
    getIntegrations()
      .then((list) => {
        const connected = list.filter((item) => item.status === 'CONNECTED').map((item) => item.system)
        setConnectedSystems(connected)
        setTicketSystem(connected[0] || 'MANUAL')
      })
      .catch(() => setConnectedSystems([]))
  }, [])

  const openFinding = async (finding) => {
    setAdvice(null)
    setError('')
    try {
      const detail = await getFinding(finding.id)
      setSelected(detail)
    } catch (err) {
      setError(apiError(err, 'Could not open that finding'))
    }
  }

  const handleAdvise = async () => {
    setAdvising(true)
    try {
      setAdvice(await requestAdvice(selected.id))
    } catch (err) {
      setError(apiError(err, 'The advisor is unavailable'))
    } finally {
      setAdvising(false)
    }
  }

  const handleCreateTicket = async () => {
    setError('')
    try {
      const ticket = await createTicket({ findingId: selected.id, system: ticketSystem, assignee })
      setNotice(`${ticket.system} ticket ${ticket.externalKey} raised for ${ticket.checkCode}.`)
      setSelected(null)
      setAssignee('')
      load()
    } catch (err) {
      setError(apiError(err, 'Could not raise the remediation ticket'))
    }
  }

  const ticketable = selected && (selected.status === 'FAIL' || selected.status === 'WARN') && !selected.ticket

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Findings</h1>
          <p>Every control evaluated against the configuration your agents reported.</p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <div className="filter-bar">
        <div className="form-field">
          <label>Status</label>
          <select value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
            {STATUS_OPTIONS.map((option) => (
              <option key={option} value={option}>{option ? option.replace(/_/g, ' ') : 'All statuses'}</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>Severity</label>
          <select value={filters.severity} onChange={(event) => setFilters({ ...filters, severity: event.target.value })}>
            {SEVERITY_OPTIONS.map((option) => (
              <option key={option} value={option}>{option || 'All severities'}</option>
            ))}
          </select>
        </div>
        <div className="form-field">
          <label>Framework</label>
          <select value={filters.framework} onChange={(event) => setFilters({ ...filters, framework: event.target.value })}>
            <option value="">All frameworks</option>
            {frameworks.map((code) => (
              <option key={code} value={code}>{code}</option>
            ))}
          </select>
        </div>
        <button className="btn btn-outline" onClick={() => setFilters({ status: '', severity: '', framework: '' })}>
          Clear filters
        </button>
      </div>

      <div className="card">
        {loading ? (
          <div className="spinner-row">Loading findings...</div>
        ) : findings.length === 0 ? (
          <div className="empty-state">No findings match these filters.</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Severity</th>
                  <th>Control</th>
                  <th>Requirement</th>
                  <th>Observed</th>
                  <th>Status</th>
                  <th>Ticket</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {findings.map((finding) => (
                  <tr key={finding.id}>
                    <td><Severity value={finding.severity} /></td>
                    <td>
                      <div className="mono">{finding.checkCode}</div>
                      <div className="text-muted" style={{ fontSize: 11.5 }}>{finding.frameworkCode}</div>
                    </td>
                    <td>{finding.title}</td>
                    <td className="mono">{formatValue(finding.observed)}</td>
                    <td><Badge value={finding.status} /></td>
                    <td>
                      {finding.ticket ? (
                        <span className="mono">{finding.ticket.externalKey}</span>
                      ) : (
                        <span className="text-muted">--</span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => openFinding(finding)}>
                        Inspect
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <Modal title={selected.checkCode} onClose={() => setSelected(null)} width={720}>
          <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{selected.title}</h3>
          <div className="mb-16">
            <Badge value={selected.status} /> <Badge value={selected.severity} />
          </div>

          <dl className="detail-list mb-16">
            <dt>Framework</dt>
            <dd>{selected.frameworkCode} · control {selected.controlCode}</dd>
            <dt>Signal</dt>
            <dd className="mono">{selected.signalKey}</dd>
            <dt>Observed</dt>
            <dd className="mono">{formatValue(selected.observed)}</dd>
            <dt>Required</dt>
            <dd>{selected.expected}</dd>
            <dt>Assessment</dt>
            <dd>{selected.detail}</dd>
            <dt>Why it matters</dt>
            <dd>{selected.rationale}</dd>
            <dt>First seen</dt>
            <dd>{formatDateTime(selected.firstSeenAt)}</dd>
            <dt>Last evaluated</dt>
            <dd>{formatDateTime(selected.lastEvaluatedAt)}</dd>
          </dl>

          {selected.evidence && (
            <>
              <div className="card-title">Evidence</div>
              <div className="card-subtitle">
                The exact observation this finding was derived from. This is all Lopsin holds.
              </div>
              <dl className="detail-list mb-16">
                <dt>Reported by</dt>
                <dd>{selected.evidence.agentName}</dd>
                <dt>Collected at</dt>
                <dd>{formatDateTime(selected.evidence.collectedAt)}</dd>
                <dt>Value</dt>
                <dd className="mono">{formatValue(selected.evidence.value)}</dd>
                <dt>Integrity digest</dt>
                <dd className="mono" style={{ wordBreak: 'break-all', fontSize: 11 }}>
                  {selected.evidence.digest}
                </dd>
              </dl>
            </>
          )}

          <div className="card-title">Remediation</div>
          <div className="ai-plan mb-16">{advice?.plan || selected.remediation}</div>
          {advice && (
            <div className="text-muted mb-16" style={{ fontSize: 12 }}>
              {advice.source === 'AI'
                ? `Drafted by the remediation advisor (${advice.model}). The prompt carried the control text and one scalar observation - no customer data.`
                : 'Baseline guidance from the control catalog.'}
            </div>
          )}

          {canAct && advisorEnabled && !advice && (
            <button className="btn btn-outline mb-16" onClick={handleAdvise} disabled={advising}>
              {advising ? 'Drafting a plan...' : 'Draft a remediation plan'}
            </button>
          )}

          {selected.ticket && (
            <div className="alert alert-success">
              Tracked as {selected.ticket.system} {selected.ticket.externalKey} ({selected.ticket.status.replace(/_/g, ' ')}).
            </div>
          )}

          {canAct && ticketable && (
            <>
              <div className="card-title">Send for remediation</div>
              <div className="form-grid">
                <div className="form-field">
                  <label>Destination</label>
                  <select value={ticketSystem} onChange={(event) => setTicketSystem(event.target.value)}>
                    {connectedSystems.map((system) => (
                      <option key={system} value={system}>{system} (connected)</option>
                    ))}
                    <option value="MANUAL">Manual tracking</option>
                  </select>
                </div>
                <div className="form-field">
                  <label>Assignee (optional)</label>
                  <input
                    value={assignee}
                    onChange={(event) => setAssignee(event.target.value)}
                    placeholder="platform-security@company.com"
                  />
                </div>
              </div>
              <div className="form-actions">
                <button className="btn btn-primary" onClick={handleCreateTicket}>Raise ticket</button>
                <button className="btn btn-outline" onClick={() => setSelected(null)}>Close</button>
              </div>
            </>
          )}

          {!ticketable && !selected.ticket && (
            <div className="form-actions">
              <button className="btn btn-outline" onClick={() => setSelected(null)}>Close</button>
            </div>
          )}
        </Modal>
      )}
    </div>
  )
}
