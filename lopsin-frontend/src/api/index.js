import axiosClient from './axiosClient'

const data = (response) => response.data

// ---- auth ----
export const login = (email, password) =>
  axiosClient.post('/auth/login', { email, password }).then(data)
export const registerOrganization = (payload) =>
  axiosClient.post('/auth/register-organization', payload).then(data)
export const getMe = () => axiosClient.get('/auth/me').then(data)

// ---- public (marketing site) ----
export const getPublicOverview = () => axiosClient.get('/public/overview').then(data)
export const getPublicSignalContract = () => axiosClient.get('/public/signal-contract').then(data)

// ---- dashboard ----
export const getSummary = () => axiosClient.get('/dashboard/summary').then(data)
export const getReadiness = () => axiosClient.get('/dashboard/readiness').then(data)

// ---- frameworks ----
export const getFrameworks = () => axiosClient.get('/frameworks').then(data)
export const getFramework = (code) => axiosClient.get(`/frameworks/${code}`).then(data)
export const setFrameworkEnabled = (code, enabled) =>
  axiosClient.put(`/frameworks/${code}/enabled`, { enabled }).then(data)
export const getSignalContract = () => axiosClient.get('/signal-contract').then(data)

// ---- findings ----
export const getFindings = (params) => axiosClient.get('/findings', { params }).then(data)
export const getFinding = (id) => axiosClient.get(`/findings/${id}`).then(data)
export const runScan = () => axiosClient.post('/findings/scan').then(data)
export const getEvidence = () => axiosClient.get('/findings/evidence/signals').then(data)
export const getAdvisorStatus = () => axiosClient.get('/findings/advisor/status').then(data)
export const requestAdvice = (id) => axiosClient.post(`/findings/${id}/advise`).then(data)

// ---- agents ----
export const getAgents = () => axiosClient.get('/agents').then(data)
export const enrollAgent = (payload) => axiosClient.post('/agents', payload).then(data)
export const rotateAgent = (id) => axiosClient.post(`/agents/${id}/rotate`).then(data)
export const revokeAgent = (id) => axiosClient.post(`/agents/${id}/revoke`).then(data)
export const deleteAgent = (id) => axiosClient.delete(`/agents/${id}`)

// ---- remediation ----
export const getTickets = (params) => axiosClient.get('/remediation', { params }).then(data)
export const createTicket = (payload) => axiosClient.post('/remediation', payload).then(data)
export const updateTicketStatus = (id, status, note) =>
  axiosClient.put(`/remediation/${id}/status`, { status, note }).then(data)
export const deleteTicket = (id) => axiosClient.delete(`/remediation/${id}`)

// ---- integrations ----
export const getIntegrations = () => axiosClient.get('/integrations').then(data)
export const connectIntegration = (system, config) =>
  axiosClient.post(`/integrations/${system}/connect`, config).then(data)
export const disconnectIntegration = (system) =>
  axiosClient.post(`/integrations/${system}/disconnect`).then(data)

// ---- users + audit ----
export const getUsers = () => axiosClient.get('/users').then(data)
export const createUser = (payload) => axiosClient.post('/users', payload).then(data)
export const updateUser = (id, payload) => axiosClient.put(`/users/${id}`, payload).then(data)
export const deleteUser = (id) => axiosClient.delete(`/users/${id}`)
export const getAuditLog = (params) => axiosClient.get('/audit', { params }).then(data)
