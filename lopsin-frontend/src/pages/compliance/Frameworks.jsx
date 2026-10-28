import { useCallback, useEffect, useState } from 'react'
import { getFrameworks, getFramework, setFrameworkEnabled } from '../../api'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import Severity from '../../components/ui/Severity'
import { useAuth } from '../../context/AuthContext'
import { apiError, formatValue } from '../../utils/format'

export default function Frameworks() {
  const { user } = useAuth()
  const canToggle = user.role === 'ADMIN' || user.role === 'COMPLIANCE'

  const [frameworks, setFrameworks] = useState([])
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(() => {
    setLoading(true)
    getFrameworks()
      .then(setFrameworks)
      .catch((err) => setError(apiError(err, 'Failed to load the framework catalog')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const toggle = async (framework) => {
    setError('')
    try {
      await setFrameworkEnabled(framework.code, !framework.enabled)
      load()
    } catch (err) {
      setError(apiError(err, 'Could not change the framework'))
    }
  }

  const openDetail = async (code) => {
    try {
      setDetail(await getFramework(code))
    } catch (err) {
      setError(apiError(err, 'Could not open that framework'))
    }
  }

  const readiness = (posture) => {
    const evaluated = posture.passed + posture.failed + posture.warned
    if (!evaluated) return 0
    return Math.round(((posture.passed + posture.warned * 0.6) / evaluated) * 100)
  }

  if (loading) return <div className="spinner-row">Loading frameworks...</div>

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Frameworks &amp; controls</h1>
          <p>
            The intelligence engine compiles each regulation into checks bound to a single
            configuration signal. Disable a framework and its checks stop being evaluated.
          </p>
        </div>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      <div className="grid-2">
        {frameworks.map((framework) => (
          <div className="card" key={framework.code}>
            <div className="flex-between" style={{ alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div className="card-title">{framework.name}</div>
                <div className="card-subtitle" style={{ marginBottom: 0 }}>
                  {framework.region} · {framework.version} · {framework.authority}
                </div>
              </div>
              <Badge value={framework.enabled ? 'ACTIVE' : 'NOT_CONNECTED'} />
            </div>

            <p className="text-muted" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 0 }}>
              {framework.summary}
            </p>

            <div className="flex-between mb-16" style={{ gap: 12 }}>
              <div className="text-muted" style={{ fontSize: 12 }}>
                {framework.controlCount} controls · {framework.checkCount} checks
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, justifyContent: 'flex-end' }}>
                <div className="progress-track" style={{ flex: 1, maxWidth: 140 }}>
                  <div className="progress-fill" style={{ width: `${readiness(framework.posture)}%` }} />
                </div>
                <strong style={{ fontSize: 13 }}>{readiness(framework.posture)}%</strong>
              </div>
            </div>

            <div className="flex-between">
              <div style={{ fontSize: 12 }}>
                <span className="compare-yes">{framework.posture.passed} passing</span>
                {' · '}
                <span className="compare-no">{framework.posture.failed} failing</span>
                {framework.posture.notApplicable > 0 && (
                  <span className="text-muted"> · {framework.posture.notApplicable} unmonitored</span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-outline btn-sm" onClick={() => openDetail(framework.code)}>
                  Controls
                </button>
                {canToggle && (
                  <button
                    className={`btn btn-sm ${framework.enabled ? 'btn-danger' : 'btn-primary'}`}
                    onClick={() => toggle(framework)}
                  >
                    {framework.enabled ? 'Disable' : 'Enable'}
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {detail && (
        <Modal title={`${detail.code} — ${detail.name}`} onClose={() => setDetail(null)} width={860}>
          <p className="text-muted" style={{ fontSize: 13, lineHeight: 1.6, marginTop: 0 }}>
            {detail.summary}
          </p>

          {detail.controls.map((control) => (
            <div key={control.code} style={{ marginBottom: 22 }}>
              <div className="card-title">{control.code} — {control.title}</div>
              <div className="card-subtitle">{control.requirement}</div>
              <div className="table-scroll">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Check</th>
                      <th>Assertion</th>
                      <th>Signal</th>
                      <th>Observed</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {control.checks.map((check) => (
                      <tr key={check.code}>
                        <td>
                          <div className="mono">{check.code}</div>
                          <Severity value={check.severity} />
                        </td>
                        <td>{check.title}</td>
                        <td className="mono" style={{ fontSize: 11.5 }}>{check.signalKey}</td>
                        <td className="mono">{formatValue(check.observed)}</td>
                        <td><Badge value={check.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </Modal>
      )}
    </div>
  )
}
