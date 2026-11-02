import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './lopsin.css'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'

// Open the TLS connection to the API host before the first request needs it,
// so that handshake doesn't sit on the critical path of the first page view.
try {
  const apiOrigin = new URL(import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api').origin
  const link = document.createElement('link')
  link.rel = 'preconnect'
  link.href = apiOrigin
  document.head.appendChild(link)
} catch {
  // Malformed/missing base URL - nothing to preconnect to, request path is unaffected.
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
