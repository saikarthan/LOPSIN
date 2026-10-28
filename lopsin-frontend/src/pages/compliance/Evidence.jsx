import { useEffect, useMemo, useState } from 'react'
import { getEvidence, getSignalContract } from '../../api'
import { apiError, formatDateTime, formatValue, downloadJson } from '../../utils/format'

export default function Evidence() {
  const [signals, setSignals] = useState([])
  const [contract, setContract] = useState({ signals: [], guardRules: [] })
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    Promise.all([getEvidence(), getSignalContract()])
      .then(([evidence, signalContract]) => {
        setSignals(evidence)
        setContract(signalContract)
      })
      .catch((err) => setError(apiError(err, 'Failed to load the evidence register')))
      .finally(() => setLoading(false))
  }, [])

  const descriptions = useMemo(
    () => new Map(contract.signals.map((signal) => [signal.key, signal])),
    [contract.signals]
  )

  const reported = useMemo(() => new Set(signals.map((signal) => signal.key)), [signals])

  const missing = useMemo(
    () => contract.signals.filter((signal) => !reported.has(signal.key)),
    [contract.signals, reported]
  )

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase()
    if (!needle) return signals
    return signals.filter((signal) => signal.key.toLowerCase().includes(needle))
  }, [signals, query])

  if (loading) return <div className="spinner-row">Loading evidence...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Evidence register</h1>
          <p>Every observation Lopsin holds for this organisation. Nothing else exists on the platform.</p>
        </div>
        <button
          className="btn btn-outline"
          onClick={() => downloadJson(`lopsin-evidence-${new Date().toISOString().slice(0, 10)}.json`, signals)}
        >
          Export evidence
        </button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="guard-note">
        <strong>Zero-data-access boundary enforced at ingest.</strong> Each value below is a scalar
        that passed four gates: the key must exist in the published contract, the value must match
        its declared type, structured payloads and long strings are refused, and every string is
        screened for personal data, secrets and file paths. A refused signal is never stored.
      </div>

      <div className="filter-bar">
        <div className="form-field" style={{ minWidth: 280 }}>
          <label>Search signals</label>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="identity, storage, privacy, ai..."
          />
        </div>
        <div className="text-muted" style={{ fontSize: 12.5, paddingBottom: 10 }}>
          {signals.length} of {contract.signals.length} declared signals reported
        </div>
      </div>

      <div className="card mb-16">
        <div className="card-title">Reported observations</div>
        <div className="card-subtitle">Latest value per signal, with the integrity digest recorded at ingest</div>
        {filtered.length === 0 ? (
          <div className="empty-state">No signals match that search.</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Signal</th>
                  <th>What it observes</th>
                  <th>Value</th>
                  <th>Reported by</th>
                  <th>Collected</th>
                  <th>Digest</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((signal) => (
                  <tr key={signal.id}>
                    <td className="mono">{signal.key}</td>
                    <td className="text-muted">{descriptions.get(signal.key)?.description || '--'}</td>
                    <td className="mono"><strong>{formatValue(signal.value)}</strong></td>
                    <td>{signal.agentName}</td>
                    <td>{formatDateTime(signal.collectedAt)}</td>
                    <td className="mono" style={{ fontSize: 10.5 }}>{signal.digest?.slice(0, 16)}…</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {missing.length > 0 && (
        <div className="card">
          <div className="card-title">Not yet reported ({missing.length})</div>
          <div className="card-subtitle">
            Controls depending on these signals stay unmonitored. An unmonitored control never
            counts as passing.
          </div>
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Signal</th>
                  <th>Type</th>
                  <th>What it observes</th>
                </tr>
              </thead>
              <tbody>
                {missing.map((signal) => (
                  <tr key={signal.key}>
                    <td className="mono">{signal.key}</td>
                    <td className="text-muted">{signal.type}{signal.unit ? ` (${signal.unit})` : ''}</td>
                    <td className="text-muted">{signal.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
