import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  BarChart, Bar,
} from 'recharts'
import { getSummary, runScan } from '../api'
import StatCard from '../components/ui/StatCard'
import { useAuth } from '../context/AuthContext'
import { apiError, formatRelative } from '../utils/format'

const STATUS_COLORS = {
  Passing: '#1c9a5b',
  Failing: '#d13b3b',
  Drifting: '#c07a12',
  Unmonitored: '#94a3b8',
}

const SEVERITY_COLORS = {
  CRITICAL: '#a8201a',
  HIGH: '#d13b3b',
  MEDIUM: '#c07a12',
  LOW: '#64768c',
}

export default function Dashboard() {
  const { user } = useAuth()
  const [summary, setSummary] = useState(null)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [scanning, setScanning] = useState(false)

  const load = useCallback(() => {
    getSummary()
      .then(setSummary)
      .catch((err) => setError(apiError(err, 'Failed to load the posture dashboard')))
  }, [])

  useEffect(load, [load])

  const handleScan = async () => {
    setScanning(true)
    setError('')
    setNotice('')
    try {
      const result = await runScan()
      setNotice(
        `Scan complete: ${result.summary.passed} passing, ${result.summary.failed} failing, ` +
        `${result.summary.warned} drifting. Score ${result.summary.score}.`
      )
      load()
    } catch (err) {
      setError(apiError(err, 'Could not run the scan'))
    } finally {
      setScanning(false)
    }
  }

  if (error && !summary) return <div className="alert alert-error">{error}</div>
  if (!summary) return <div className="spinner-row">Loading posture...</div>

  const { checks, failuresBySeverity, coverage, remediation, agents } = summary

  const statusData = [
    { name: 'Passing', value: checks.passed },
    { name: 'Failing', value: checks.failed },
    { name: 'Drifting', value: checks.warned },
    { name: 'Unmonitored', value: checks.notApplicable },
  ].filter((entry) => entry.value > 0)

  const severityData = Object.entries(failuresBySeverity)
    .map(([name, value]) => ({ name, value }))
    .filter((entry) => entry.value > 0)

  const frameworkData = Object.entries(summary.byFramework).map(([code, bucket]) => ({
    name: code,
    Passing: bucket.passed,
    Failing: bucket.failed,
    Drifting: bucket.warned,
  }))

  const canScan = user.role === 'ADMIN' || user.role === 'COMPLIANCE'
  const scoreTone = summary.complianceScore >= 85 ? 'success' : summary.complianceScore >= 60 ? 'warning' : 'danger'

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>{summary.organization?.name || 'Compliance posture'}</h1>
          <p>
            {summary.organization?.industry} · {summary.organization?.region} · last evaluated{' '}
            {formatRelative(summary.lastScanAt)}
          </p>
        </div>
        {canScan && (
          <button className="btn btn-primary" onClick={handleScan} disabled={scanning}>
            {scanning ? 'Evaluating...' : 'Run scan now'}
          </button>
        )}
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <div className="stat-grid">
        <StatCard
          label="Compliance score"
          value={`${summary.complianceScore}%`}
          hint="Severity-weighted across evaluated controls"
          tone={scoreTone}
        />
        <StatCard
          label="Failing controls"
          value={checks.failed}
          hint={`${failuresBySeverity.CRITICAL} critical · ${failuresBySeverity.HIGH} high`}
          tone={checks.failed > 0 ? 'danger' : 'success'}
        />
        <StatCard
          label="Open remediation"
          value={remediation.open}
          hint={`${remediation.overdue} past due · ${remediation.resolved} resolved`}
          tone={remediation.overdue > 0 ? 'warning' : undefined}
        />
        <StatCard
          label="Healthy agents"
          value={`${agents.healthy}/${agents.total}`}
          hint="Collectors reporting within the last 30 minutes"
          tone={agents.healthy < agents.total ? 'warning' : 'success'}
        />
        <StatCard
          label="Signal coverage"
          value={`${coverage.coveragePct}%`}
          hint={`${coverage.signalsReported} of ${coverage.signalsInContract} declared signals reported`}
        />
      </div>

      {checks.notApplicable > 0 && (
        <div className="alert alert-error" style={{ background: 'var(--color-warning-bg)', color: 'var(--color-warning)', borderColor: '#e8d5ac' }}>
          {checks.notApplicable} control{checks.notApplicable === 1 ? ' is' : 's are'} unmonitored because no
          agent has reported the signal they depend on. Unmonitored controls never count as passing.{' '}
          <Link to="/app/evidence" style={{ textDecoration: 'underline' }}>Review the evidence register</Link>.
        </div>
      )}

      <div className="chart-grid mb-16">
        <div className="card">
          <div className="card-title">Posture trend</div>
          <div className="card-subtitle">Compliance score across recent evaluation cycles</div>
          {summary.scanHistory.length < 2 ? (
            <div className="empty-state">Run a second scan to plot a trend.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={summary.scanHistory} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#e4ecf6" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: '#64768c' }} tickLine={false} />
                <YAxis domain={[0, 100]} tick={{ fontSize: 11, fill: '#64768c' }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Line type="monotone" dataKey="score" stroke="#1868db" strokeWidth={2} dot={{ r: 3 }} name="Score" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <div className="card-title">Control outcomes</div>
          <div className="card-subtitle">Every check in the enabled frameworks</div>
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={statusData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
                {statusData.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="chart-grid">
        <div className="card">
          <div className="card-title">Failures by severity</div>
          <div className="card-subtitle">Where the remediation effort should go first</div>
          {severityData.length === 0 ? (
            <div className="empty-state">No failing controls. Every evaluated check is satisfied.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={severityData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={55} outerRadius={90} paddingAngle={2}>
                  {severityData.map((entry) => (
                    <Cell key={entry.name} fill={SEVERITY_COLORS[entry.name]} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <div className="card-title">Posture by framework</div>
          <div className="card-subtitle">One collection cycle answers several regulators</div>
          {frameworkData.length === 0 ? (
            <div className="empty-state">No findings yet. Enrol an agent to begin collecting.</div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={frameworkData} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
                <CartesianGrid stroke="#e4ecf6" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64768c' }} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#64768c' }} tickLine={false} axisLine={false} />
                <Tooltip />
                <Legend />
                <Bar dataKey="Passing" stackId="a" fill="#1c9a5b" />
                <Bar dataKey="Drifting" stackId="a" fill="#c07a12" />
                <Bar dataKey="Failing" stackId="a" fill="#d13b3b" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}
