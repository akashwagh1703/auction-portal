// Keyboard navigation utilities

/**
 * Handle keyboard navigation for lists/grids
 * @param {KeyboardEvent} event - The keyboard event
 * @param {HTMLElement[]} items - Array of focusable items
 * @param {number} currentIndex - Current focused index
 * @returns {number} New index
 */
export const handleArrowKeys = (event, items, currentIndex) => {
  if (!items.length) return currentIndex

  let newIndex = currentIndex

  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowRight':
      newIndex = (currentIndex + 1) % items.length
      break
    case 'ArrowUp':
    case 'ArrowLeft':
      newIndex = (currentIndex - 1 + items.length) % items.length
      break
    case 'Home':
      newIndex = 0
      break
    case 'End':
      newIndex = items.length - 1
      break
    default:
      return currentIndex
  }

  event.preventDefault()
  items[newIndex]?.focus()
  return newIndex
}

/**
 * Handle Escape key to close modals/dropdowns
 * @param {KeyboardEvent} event - The keyboard event
 * @param {Function} onClose - Callback to close the element
 */
export const handleEscape = (event, onClose) => {
  if (event.key === 'Escape') {
    onClose()
  }
}

/**
 * Handle Enter key to activate focused element
 * @param {KeyboardEvent} event - The keyboard event
 * @param {Function} onActivate - Callback to activate the element
 */
export const handleEnter = (event, onActivate) => {
  if (event.key === 'Enter') {
    onActivate()
  }
}

/**
 * Trap focus within a container (for modals)
 * @param {KeyboardEvent} event - The keyboard event
 * @param {HTMLElement} container - The container element
 */
export const trapFocus = (event, container) => {
  if (event.key !== 'Tab') return

  const focusableElements = container.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  )
  const firstElement = focusableElements[0]
  const lastElement = focusableElements[focusableElements.length - 1]

  if (event.shiftKey) {
    if (document.activeElement === firstElement) {
      event.preventDefault()
      lastElement.focus()
    }
  } else {
    if (document.activeElement === lastElement) {
      event.preventDefault()
      firstElement.focus()
    }
  }
}

/**
 * Make an element focusable with keyboard
 * @param {HTMLElement} element - The element to make focusable
 * @param {Function} onClick - Click handler
 */
export const makeKeyboardClickable = (element, onClick) => {
  if (!element) return

  element.setAttribute('tabindex', '0')
  element.setAttribute('role', 'button')

  const handleKeyDown = (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      onClick(event)
    }
  }

  element.addEventListener('keydown', handleKeyDown)

  return () => {
    element.removeEventListener('keydown', handleKeyDown)
  }
}

/**
 * Get all focusable elements within a container
 * @param {HTMLElement} container - The container element
 * @returns {HTMLElement[]} Array of focusable elements
 */
export const getFocusableElements = (container) => {
  return Array.from(
    container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )
  ).filter(
    (el) =>
      !el.disabled &&
      !el.getAttribute('aria-hidden') &&
      el.offsetParent !== null
  )
}
