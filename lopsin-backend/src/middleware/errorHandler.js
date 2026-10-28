export class ApiError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

export function notFound(_req, res) {
  res.status(404).json({ message: 'Endpoint not found' })
}

// eslint-disable-next-line no-unused-vars -- Express identifies error handlers by arity.
export function errorHandler(error, _req, res, _next) {
  const status = error.status || 500
  if (status >= 500) console.error('[error]', error)
  res.status(status).json({
    message: error.message || 'Unexpected server error',
    ...(error.details ? { details: error.details } : {}),
  })
}

/** Wraps an async route so a rejected promise reaches the error handler. */
export function asyncRoute(handler) {
  return (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next)
}
