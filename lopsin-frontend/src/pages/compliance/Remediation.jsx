import { useCallback, useEffect, useState } from 'react'
import { getTickets, updateTicketStatus, deleteTicket } from '../../api'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import Severity from '../../components/ui/Severity'
import { useAuth } from '../../context/AuthContext'
import { apiError, formatDateTime } from '../../utils/format'

const STATUSES = ['OPEN', 'IN_PROGRESS', 'BLOCKED', 'RESOLVED', 'CLOSED']

export default function Remediation() {
  const { user } = useAuth()
  const canAct = user.role === 'ADMIN' || user.role === 'COMPLIANCE'

  const [tickets, setTickets] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [note, setNote] = useState('')
  // Read the clock once at mount: calling Date.now() during render is impure and
  // makes overdue styling flicker between re-renders.
  const [now] = useState(() => Date.now())

  const load = useCallback(() => {
    setLoading(true)
    getTickets(filter ? { status: filter } : undefined)
      .then(setTickets)
      .catch((err) => setError(apiError(err, 'Failed to load the remediation board')))
      .finally(() => setLoading(false))
  }, [filter])

  useEffect(load, [load])

  const changeStatus = async (ticket, status) => {
    setError('')
    try {
      const updated = await updateTicketStatus(ticket.id, status, note)
      setNote('')
      setSelected(updated)
      load()
    } catch (err) {
      setError(apiError(err, 'Could not update the ticket'))
    }
  }

  const remove = async (ticket) => {
    if (!window.confirm(`Delete ${ticket.externalKey}? The finding itself stays on the register.`)) return
    try {
      await deleteTicket(ticket.id)
      setSelected(null)
      load()
    } catch (err) {
      setError(apiError(err, 'Could not delete the ticket'))
    }
  }

  const isOverdue = (ticket) =>
    !['RESOLVED', 'CLOSED'].includes(ticket.status) && new Date(ticket.dueAt).getTime() < now

  const counts = STATUSES.reduce((acc, status) => {
    acc[status] = tickets.filter((ticket) => ticket.status === status).length
    return acc
  }, {})

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Remediation</h1>
          <p>
            Findings pushed into the tools your team already runs, each carrying the control
            reference and a deadline set by severity.
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="filter-bar">
        <div className="form-field">
          <label>Status</label>
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="">All tickets</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status.replace(/_/g, ' ')}{filter === '' ? ` (${counts[status] || 0})` : ''}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        {loading ? (
          <div className="spinner-row">Loading tickets...</div>
        ) : tickets.length === 0 ? (
          <div className="empty-state">
            No remediation tickets. Open a failing finding and send it to Jira, GitHub or Slack.
          </div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reference</th>
                  <th>Severity</th>
                  <th>Control</th>
                  <th>Title</th>
                  <th>Assignee</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tickets.map((ticket) => (
                  <tr key={ticket.id}>
                    <td>
                      <div className="mono">{ticket.externalKey}</div>
                      <div className="text-muted" style={{ fontSize: 11.5 }}>{ticket.system}</div>
                    </td>
                    <td><Severity value={ticket.severity} /></td>
                    <td className="mono">{ticket.checkCode}</td>
                    <td>{ticket.title}</td>
                    <td className="text-muted">{ticket.assignee || 'unassigned'}</td>
                    <td>
                      {formatDateTime(ticket.dueAt).split(',')[0]}
                      {isOverdue(ticket) && <div><span className="badge badge-danger">Overdue</span></div>}
                    </td>
                    <td><Badge value={ticket.status} /></td>
                    <td style={{ textAlign: 'right' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => setSelected(ticket)}>Open</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selected && (
        <Modal title={selected.externalKey} onClose={() => setSelected(null)} width={660}>
          <h3 style={{ margin: '0 0 6px', fontSize: 15 }}>{selected.title}</h3>
          <div className="mb-16">
            <Badge value={selected.status} /> <Badge value={selected.severity} /> <Badge value={selected.system} />
          </div>

          <dl className="detail-list mb-16">
            <dt>Control</dt>
            <dd>{selected.frameworkCode} {selected.controlCode} · {selected.checkCode}</dd>
            <dt>Assignee</dt>
            <dd>{selected.assignee || 'unassigned'}</dd>
            <dt>Raised by</dt>
            <dd>{selected.createdBy} on {formatDateTime(selected.createdAt)}</dd>
            <dt>Due</dt>
            <dd>{formatDateTime(selected.dueAt)}{isOverdue(selected) ? ' (overdue)' : ''}</dd>
          </dl>

          <div className="card-title">Description</div>
          <div className="ai-plan mb-16">{selected.description}</div>

          <div className="card-title">History</div>
          <ul className="timeline mb-16">
            {selected.history.map((entry, index) => (
              <li key={index}>
                <strong>{entry.from ? `${entry.from} → ${entry.to}` : entry.to}</strong>
                <div className="text-muted">
                  {entry.actor} · {formatDateTime(entry.at)}
                  {entry.note ? ` · ${entry.note}` : ''}
                </div>
              </li>
            ))}
          </ul>

          {canAct && (
            <>
              <div className="form-field mb-16">
                <label>Note (optional, recorded in the history)</label>
                <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="What changed?" />
              </div>
              <div className="form-actions" style={{ flexWrap: 'wrap' }}>
                {STATUSES.filter((status) => status !== selected.status).map((status) => (
                  <button key={status} className="btn btn-outline btn-sm" onClick={() => changeStatus(selected, status)}>
                    {status.replace(/_/g, ' ')}
                  </button>
                ))}
                <button className="btn btn-danger btn-sm" onClick={() => remove(selected)}>Delete</button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  )
}
