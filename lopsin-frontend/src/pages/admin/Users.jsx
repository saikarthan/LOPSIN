import { useCallback, useEffect, useState } from 'react'
import { getUsers, createUser, updateUser, deleteUser } from '../../api'
import Modal from '../../components/ui/Modal'
import Badge from '../../components/ui/Badge'
import { useAuth } from '../../context/AuthContext'
import { apiError, formatDateTime } from '../../utils/format'

const ROLES = [
  { value: 'ADMIN', label: 'Administrator', blurb: 'Enrol agents, connect tools, manage the team.' },
  { value: 'COMPLIANCE', label: 'Compliance officer', blurb: 'Run scans, triage findings, drive remediation.' },
  { value: 'AUDITOR', label: 'Auditor', blurb: 'Read-only access to evidence, readiness and the activity log.' },
]

const EMPTY_FORM = { fullName: '', email: '', role: 'AUDITOR', password: '' }

export default function Users() {
  const { user: currentUser } = useAuth()
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [form, setForm] = useState(EMPTY_FORM)

  const load = useCallback(() => {
    setLoading(true)
    getUsers()
      .then(setUsers)
      .catch((err) => setError(apiError(err, 'Failed to load the team')))
      .finally(() => setLoading(false))
  }, [])

  useEffect(load, [load])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setModalOpen(true)
    setError('')
  }

  const openEdit = (user) => {
    setEditing(user)
    setForm({ fullName: user.fullName, email: user.email, role: user.role, password: '' })
    setModalOpen(true)
    setError('')
  }

  const submit = async (event) => {
    event.preventDefault()
    setError('')
    try {
      if (editing) {
        const payload = { fullName: form.fullName, role: form.role }
        if (form.password) payload.password = form.password
        await updateUser(editing.id, payload)
        setNotice(`${form.fullName} updated.`)
      } else {
        await createUser(form)
        setNotice(`${form.fullName} added as ${form.role}.`)
      }
      setModalOpen(false)
      load()
    } catch (err) {
      setError(apiError(err, 'Could not save that user'))
    }
  }

  const toggleStatus = async (user) => {
    try {
      await updateUser(user.id, { status: user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' })
      load()
    } catch (err) {
      setError(apiError(err, 'Could not change that account'))
    }
  }

  const remove = async (user) => {
    if (!window.confirm(`Remove ${user.fullName}? They lose access immediately.`)) return
    try {
      await deleteUser(user.id)
      load()
    } catch (err) {
      setError(apiError(err, 'Could not remove that user'))
    }
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h1>Team access</h1>
          <p>Who can see the compliance posture, and what they are allowed to do with it.</p>
        </div>
        <button className="btn btn-primary" onClick={openCreate}>Add a user</button>
      </div>

      {error && <div className="alert alert-error">{error}</div>}
      {notice && <div className="alert alert-success">{notice}</div>}

      <div className="card">
        {loading ? (
          <div className="spinner-row">Loading team...</div>
        ) : (
          <div className="table-scroll">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Last sign-in</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id}>
                    <td>
                      <strong>{user.fullName}</strong>
                      {user.id === currentUser.id && <span className="text-muted"> (you)</span>}
                    </td>
                    <td className="mono">{user.email}</td>
                    <td><Badge value={user.role} tone="neutral" /></td>
                    <td><Badge value={user.status} /></td>
                    <td>{user.lastLoginAt ? formatDateTime(user.lastLoginAt) : 'never'}</td>
                    <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button className="btn btn-outline btn-sm" onClick={() => openEdit(user)}>Edit</button>{' '}
                      {user.id !== currentUser.id && (
                        <>
                          <button className="btn btn-outline btn-sm" onClick={() => toggleStatus(user)}>
                            {user.status === 'ACTIVE' ? 'Suspend' : 'Restore'}
                          </button>{' '}
                          <button className="btn btn-danger btn-sm" onClick={() => remove(user)}>Remove</button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {modalOpen && (
        <Modal title={editing ? `Edit ${editing.fullName}` : 'Add a user'} onClose={() => setModalOpen(false)}>
          <form onSubmit={submit}>
            <div className="form-field mb-16">
              <label>Full name</label>
              <input
                value={form.fullName}
                onChange={(event) => setForm({ ...form, fullName: event.target.value })}
                required
              />
            </div>
            <div className="form-field mb-16">
              <label>Email</label>
              <input
                type="email"
                value={form.email}
                onChange={(event) => setForm({ ...form, email: event.target.value })}
                disabled={Boolean(editing)}
                required
              />
            </div>
            <div className="form-field mb-16">
              <label>Role</label>
              <select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })}>
                {ROLES.map((role) => (
                  <option key={role.value} value={role.value}>{role.label}</option>
                ))}
              </select>
              <div className="text-muted" style={{ fontSize: 12 }}>
                {ROLES.find((role) => role.value === form.role)?.blurb}
              </div>
            </div>
            <div className="form-field mb-16">
              <label>{editing ? 'New password (leave blank to keep)' : 'Password (at least 10 characters)'}</label>
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm({ ...form, password: event.target.value })}
                minLength={editing ? undefined : 10}
                required={!editing}
              />
            </div>
            <div className="form-actions">
              <button className="btn btn-primary">{editing ? 'Save changes' : 'Add user'}</button>
              <button type="button" className="btn btn-outline" onClick={() => setModalOpen(false)}>Cancel</button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
