import { useEffect, useState } from 'react'
import { getReadiness } from '../../api'
import Severity from '../../components/ui/Severity'
import { apiError, formatDateTime, downloadJson, downloadCsv } from '../../utils/format'

export default function Readiness() {
  const [report, setReport] = useState(null)
  const [error, setError] = useState('')

  useEffect(() => {
    getReadiness()
      .then(setReport)
      .catch((err) => setError(apiError(err, 'Failed to build the readiness report')))
  }, [])

  const exportCsv = () => {
    const rows = [['Framework', 'Readiness %', 'Passing', 'Failing', 'Drifting', 'Unmonitored']]
    for (const framework of report.frameworks) {
      rows.push([
        framework.frameworkCode, framework.readinessPct, framework.passed,
        framework.failed, framework.warned, framework.notApplicable,
      ])
    }
    rows.push([])
    rows.push(['Framework', 'Control', 'Check', 'Severity', 'Assessment', 'Ticket'])
    for (const framework of report.frameworks) {
      for (const finding of framework.openFindings) {
        rows.push([
          framework.frameworkCode, finding.controlCode, finding.checkCode,
          finding.severity, finding.detail, finding.ticket || 'none',
        ])
      }
    }
    downloadCsv(`lopsin-readiness-${new Date().toISOString().slice(0, 10)}.csv`, rows)
  }

  if (error) return <div className="alert alert-error">{error}</div>
  if (!report) return <div className="spinner-row">Building the readiness report...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Audit readiness</h1>
          <p>
            {report.organization} · generated {formatDateTime(report.generatedAt)} for {report.generatedFor}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-outline" onClick={exportCsv}>Export CSV</button>
          <button
            className="btn btn-outline"
            onClick={() => downloadJson(`lopsin-readiness-${new Date().toISOString().slice(0, 10)}.json`, report)}
          >
            Export JSON
          </button>
        </div>
      </div>

      <div className="card mb-16">
        <div className="card-title">Overall programme score</div>
        <div className="card-subtitle">
          Severity-weighted across every evaluated control. Unmonitored controls are excluded from
          the numerator and the denominator, so an unreported estate cannot inflate the score.
        </div>
        <div className="score-row">
          <div className="score-value">{report.overallScore}</div>
          <div className="text-muted">out of 100</div>
        </div>
        <div className="meter" style={{ marginTop: 12 }}>
          <div className="meter-fill" style={{ width: `${report.overallScore}%` }} />
        </div>
      </div>

      {report.frameworks.map((framework) => (
        <div className="card mb-16" key={framework.frameworkCode}>
          <div className="flex-between" style={{ marginBottom: 12, gap: 16, flexWrap: 'wrap' }}>
            <div>
              <div className="card-title">{framework.frameworkCode}</div>
              <div className="card-subtitle" style={{ marginBottom: 0 }}>
                {framework.passed} passing · {framework.failed} failing · {framework.warned} drifting
                {framework.notApplicable > 0 && ` · ${framework.notApplicable} unmonitored`}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 180 }}>
              <div className="progress-track" style={{ flex: 1 }}>
                <div className="progress-fill" style={{ width: `${framework.readinessPct}%` }} />
              </div>
              <strong>{framework.readinessPct}%</strong>
            </div>
          </div>

          {framework.openFindings.length === 0 ? (
            <div className="empty-state">
              No open findings. Every evaluated control in {framework.frameworkCode} is satisfied.
            </div>
          ) : (
            <div className="table-scroll">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Severity</th>
                    <th>Control</th>
                    <th>Gap</th>
                    <th>Required action</th>
                    <th>Open since</th>
                    <th>Tracked as</th>
                  </tr>
                </thead>
                <tbody>
                  {framework.openFindings.map((finding) => (
                    <tr key={finding.checkCode}>
                      <td><Severity value={finding.severity} /></td>
                      <td>
                        <div className="mono">{finding.checkCode}</div>
                        <div className="text-muted" style={{ fontSize: 11.5 }}>{finding.controlCode}</div>
                      </td>
                      <td>{finding.detail}</td>
                      <td className="text-muted">{finding.remediation}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{formatDateTime(finding.firstSeenAt).split(',')[0]}</td>
                      <td className="mono">{finding.ticket || '--'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
