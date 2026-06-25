/**
 * Debounce function - delays execution until after wait milliseconds have elapsed
 * since the last time it was invoked
 */
export function debounce(func, wait = 300) {
  let timeout

  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }

    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }
}

/**
 * Throttle function - ensures function is called at most once every wait milliseconds
 */
export function throttle(func, wait = 300) {
  let inThrottle
  let lastResult

  return function executedFunction(...args) {
    if (!inThrottle) {
      func(...args)
      lastResult = func.apply(this, args)
      inThrottle = true
      setTimeout(() => inThrottle = false, wait)
    }
    return lastResult
  }
}

/**
 * Debounced version of a function that can be cancelled
 */
export function debounceWithCancel(func, wait = 300) {
  let timeout

  const debounced = function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout)
      func(...args)
    }

    clearTimeout(timeout)
    timeout = setTimeout(later, wait)
  }

  debounced.cancel = () => {
    clearTimeout(timeout)
  }

  return debounced
}

/**
 * Throttle function that can be called immediately on first invocation
 */
export function throttleWithImmediate(func, wait = 300) {
  let timeout
  let lastRan

  return function executedFunction(...args) {
    const context = this
    if (!lastRan) {
      func.apply(context, args)
      lastRan = Date.now()
    } else {
      clearTimeout(timeout)
      timeout = setTimeout(() => {
        if ((Date.now() - lastRan) >= wait) {
          func.apply(context, args)
          lastRan = Date.now()
        }
      }, wait - (Date.now() - lastRan))
    }
  }
}
