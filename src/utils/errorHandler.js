import toast from 'react-hot-toast'

export const handleApiError = (error) => {
  console.error('API Error:', error)

  // Network error
  if (!error.response) {
    toast.error('Network error. Please check your connection.')
    return
  }

  const { status, data } = error.response

  switch (status) {
    case 400:
      toast.error(data?.message || 'Bad request. Please check your input.')
      break
    case 401:
      toast.error('Session expired. Please login again.')
      // Redirect to login after a short delay
      setTimeout(() => {
        window.location.href = '/login'
      }, 1500)
      break
    case 403:
      toast.error('You do not have permission to perform this action.')
      break
    case 404:
      toast.error('Resource not found.')
      break
    case 422:
      // Validation errors
      if (data?.errors) {
        const firstError = Object.values(data.errors)[0]
        toast.error(Array.isArray(firstError) ? firstError[0] : firstError)
      } else {
        toast.error(data?.message || 'Validation failed.')
      }
      break
    case 429:
      toast.error(data?.message || 'Too many requests. Please wait.')
      break
    case 500:
      toast.error('Server error. Please try again later.')
      break
    default:
      toast.error(data?.message || 'An unexpected error occurred.')
  }
}

export const handleAsyncError = async (promise, errorMessage = 'Operation failed') => {
  try {
    return await promise
  } catch (error) {
    handleApiError(error)
    throw error
  }
}

export const withErrorHandling = (fn) => {
  return async (...args) => {
    try {
      return await fn(...args)
    } catch (error) {
      handleApiError(error)
      throw error
    }
  }
}
