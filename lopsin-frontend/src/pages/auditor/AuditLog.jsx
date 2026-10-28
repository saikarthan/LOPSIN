import { useEffect, useMemo, useState } from 'react'
import { getAuditLog } from '../../api'
import Badge from '../../components/ui/Badge'
import { apiError, formatDateTime, downloadCsv } from '../../utils/format'

const GUARD_ACTION = 'SIGNALS_REJECTED_BY_PRIVACY_GUARD'

export default function AuditLog() {
  const [entries, setEntries] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    getAuditLog({ limit: 300 })
      .then(setEntries)
      .catch((err) => setError(apiError(err, 'Failed to load the activity log')))
      .finally(() => setLoading(false))
  }, [])

  const actions = useMemo(
    () => [...new Set(entries.map((entry) => entry.action))].sort(),
    [entries]
  )

  const filtered = useMemo(
    () => (filter ? entries.filter((entry) => entry.action === filter) : entries),
    [entries, filter]
  )

  const exportCsv = () => {
    const rows = [
      ['Timestamp', 'Actor', 'Role', 'Action', 'Target', 'Detail'],
      ...filtered.map((entry) => [
        entry.at, entry.actor, entry.actorRole, entry.action, entry.target || '', entry.detail || '',
      ]),
    ]
    downloadCsv(`lopsin-activity-${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }

  if (loading) return <div className="spinner-row">Loading activity...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Activity log</h1>
          <p>
            Append-only record of every state change on the platform, including each signal the
            privacy guard refused.
          </p>
        </div>
        <button className="btn btn-outline" onClick={exportCsv}>Export CSV</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="filter-bar">
        <div className="form-field" style={{ minWidth: 300 }}>
          <label>Action</label>
          <select value={filter} onChange={(event) => setFilter(event.target.value)}>
            <option value="">All actions ({entries.length})</option>
            {actions.map((action) => (
              <option key={action} value={action}>{action.replace(/_/g, ' ')}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="card">
        {filtered.length === 0 ? (
          <div className="empty-state">No activity recorded for that filter.</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry) => (
                  <tr key={entry.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(entry.at)}</td>
                    <td>
                      <div>{entry.actor}</div>
                      <div className="text-muted" style={{ fontSize: 11 }}>{entry.actorRole}</div>
                    </td>
                    <td>
                      {entry.action === GUARD_ACTION ? (
                        <Badge value="BLOCKED" />
                      ) : null}{' '}
                      <span className="mono" style={{ fontSize: 11.5 }}>{entry.action}</span>
                    </td>
                    <td className="text-muted">{entry.detail || '--'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
