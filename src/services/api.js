import axios from 'axios'
import { handleApiError } from '../utils/errorHandler'

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
  headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
  withCredentials: true, // Important for cookie-based auth
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    // Handle 401 unauthorized
    if (err.response?.status === 401) {
      const url = err.config?.url ?? ''
      const isAuthCall = url.includes('/login') || url.includes('/me')
      if (!isAuthCall) {
        window.location.href = '/login'
      }
    }

    // Handle other errors globally
    handleApiError(err)

    return Promise.reject(err)
  }
)

export default api
