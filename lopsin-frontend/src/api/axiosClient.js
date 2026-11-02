import axios from 'axios'

const axiosClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080/api',
})

axiosClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('lopsin_token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Re-visiting a page (switching tabs in the console, going back) re-fetches
// from the backend by default, which is slow on a free-tier host. Cache GET
// responses for a short window per browser tab, and drop the whole cache on
// any write or on login/logout so no stale or cross-account data can show.
const CACHE_TTL_MS = 20_000
const cache = new Map()
const rawGet = axiosClient.get.bind(axiosClient)

axiosClient.get = (url, config = {}) => {
  if (config.cache === false) return rawGet(url, config)
  const key = `${url}?${JSON.stringify(config.params || {})}`
  const hit = cache.get(key)
  if (hit && hit.expiresAt > Date.now()) return hit.promise

  const promise = rawGet(url, config).catch((error) => {
    cache.delete(key)
    throw error
  })
  cache.set(key, { promise, expiresAt: Date.now() + CACHE_TTL_MS })
  return promise
}

export function clearApiCache() {
  cache.clear()
}

for (const method of ['post', 'put', 'patch', 'delete']) {
  const raw = axiosClient[method].bind(axiosClient)
  axiosClient[method] = (...args) => raw(...args).then((response) => {
    clearApiCache()
    return response
  })
}

axiosClient.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      clearApiCache()
      localStorage.removeItem('lopsin_token')
      localStorage.removeItem('lopsin_user')
      const path = window.location.pathname
      if (path !== '/' && !path.startsWith('/login')) {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default axiosClient
