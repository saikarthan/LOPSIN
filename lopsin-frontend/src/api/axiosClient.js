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
// from the backend by default, which is slow on a free-tier host. Stale-
// while-revalidate: a page that has loaded once renders instantly from cache
// on every later visit in this tab, while a fresh copy is fetched silently
// in the background for the visit after that. Any write, login, logout, or
// 401 drops the whole cache so results can't go stale across a mutation or
// leak between the demo accounts in the same tab.
const FRESH_MS = 20_000
const cache = new Map()
const rawGet = axiosClient.get.bind(axiosClient)

function revalidate(key, url, config) {
  rawGet(url, config)
    .then((response) => cache.set(key, { response, promise: Promise.resolve(response), fetchedAt: Date.now() }))
    .catch(() => {
      // Keep serving the stale entry; the next visit will just try again.
    })
}

axiosClient.get = (url, config = {}) => {
  if (config.cache === false) return rawGet(url, config)
  const key = `${url}?${JSON.stringify(config.params || {})}`
  const hit = cache.get(key)

  if (hit) {
    if (Date.now() - hit.fetchedAt > FRESH_MS) revalidate(key, url, config)
    return hit.promise
  }

  const promise = rawGet(url, config).catch((error) => {
    cache.delete(key)
    throw error
  })
  promise.then((response) => cache.set(key, { response, promise, fetchedAt: Date.now() }))
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
