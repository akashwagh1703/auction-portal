// Performance monitoring utilities

/**
 * Measure component render time
 */
export function useRenderTime(componentName) {
  if (process.env.NODE_ENV !== 'development') return

  const startTime = performance.now()

  useEffect(() => {
    const endTime = performance.now()
    const renderTime = endTime - startTime

    if (renderTime > 16) { // Log if render takes more than one frame (16ms at 60fps)
      console.warn(`[Performance] ${componentName} rendered in ${renderTime.toFixed(2)}ms`)
    }
  })
}

/**
 * Measure async operation time
 */
export async function measureAsync(operationName, operation) {
  const startTime = performance.now()
  try {
    const result = await operation()
    const duration = performance.now() - startTime

    if (duration > 1000) {
      console.warn(`[Performance] ${operationName} took ${duration.toFixed(2)}ms`)
    } else {
      console.log(`[Performance] ${operationName} completed in ${duration.toFixed(2)}ms`)
    }

    return result
  } catch (error) {
    const duration = performance.now() - startTime
    console.error(`[Performance] ${operationName} failed after ${duration.toFixed(2)}ms`, error)
    throw error
  }
}

/**
 * Get Web Vitals metrics
 */
export function getWebVitals() {
  if (!window.performance) return null

  const navigation = performance.getEntriesByType('navigation')[0]
  if (!navigation) return null

  return {
    // Page load time
    pageLoadTime: navigation.loadEventEnd - navigation.fetchStart,
    // DOM content loaded time
    domContentLoaded: navigation.domContentLoadedEventEnd - navigation.fetchStart,
    // First paint
    firstPaint: performance.getEntriesByType('paint').find(entry => entry.name === 'first-paint')?.startTime,
    // First contentful paint
    firstContentfulPaint: performance.getEntriesByType('paint').find(entry => entry.name === 'first-contentful-paint')?.startTime,
  }
}

/**
 * Log Web Vitals on page load
 */
export function logWebVitals() {
  if (process.env.NODE_ENV !== 'production') return

  window.addEventListener('load', () => {
    const vitals = getWebVitals()
    if (vitals) {
      console.log('[Web Vitals]', vitals)
      // You can send this to an analytics service
      // analytics.track('web_vitals', vitals)
    }
  })
}

/**
 * Memory usage monitoring (Chrome only)
 */
export function getMemoryUsage() {
  if (!window.performance?.memory) return null

  return {
    usedJSHeapSize: window.performance.memory.usedJSHeapSize,
    totalJSHeapSize: window.performance.memory.totalJSHeapSize,
    jsHeapSizeLimit: window.performance.memory.jsHeapSizeLimit,
  }
}

/**
 * Log memory usage periodically
 */
export function startMemoryMonitoring(interval = 5000) {
  if (process.env.NODE_ENV !== 'development') return

  return setInterval(() => {
    const memory = getMemoryUsage()
    if (memory) {
      const usagePercent = (memory.usedJSHeapSize / memory.jsHeapSizeLimit * 100).toFixed(2)
      console.log(`[Memory] JS Heap: ${usagePercent}% used (${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)}MB)`)
    }
  }, interval)
}
