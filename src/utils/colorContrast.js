// Color contrast utilities for WCAG compliance

/**
 * Calculate relative luminance of a color
 * @param {string} hex - Hex color code (e.g., '#ffffff')
 * @returns {number} Relative luminance (0-1)
 */
export const getLuminance = (hex) => {
  const rgb = hexToRgb(hex)
  if (!rgb) return 0

  const [r, g, b] = rgb.map((value) => {
    value /= 255
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4)
  })

  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/**
 * Convert hex to RGB
 * @param {string} hex - Hex color code
 * @returns {number[]} RGB values or null
 */
const hexToRgb = (hex) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16),
      ]
    : null
}

/**
 * Calculate contrast ratio between two colors
 * @param {string} color1 - First hex color
 * @param {string} color2 - Second hex color
 * @returns {number} Contrast ratio (1-21)
 */
export const getContrastRatio = (color1, color2) => {
  const lum1 = getLuminance(color1)
  const lum2 = getLuminance(color2)
  const lighter = Math.max(lum1, lum2)
  const darker = Math.min(lum1, lum2)
  return (lighter + 0.05) / (darker + 0.05)
}

/**
 * Check if contrast meets WCAG AA standard (4.5:1 for normal text)
 * @param {string} foreground - Foreground hex color
 * @param {string} background - Background hex color
 * @param {boolean} largeText - Whether text is large (18pt+ or 14pt+ bold)
 * @returns {boolean} True if meets AA standard
 */
export const meetsWCAGAA = (foreground, background, largeText = false) => {
  const ratio = getContrastRatio(foreground, background)
  return largeText ? ratio >= 3 : ratio >= 4.5
}

/**
 * Check if contrast meets WCAG AAA standard (7:1 for normal text)
 * @param {string} foreground - Foreground hex color
 * @param {string} background - Background hex color
 * @param {boolean} largeText - Whether text is large
 * @returns {boolean} True if meets AAA standard
 */
export const meetsWCAGAAA = (foreground, background, largeText = false) => {
  const ratio = getContrastRatio(foreground, background)
  return largeText ? ratio >= 4.5 : ratio >= 7
}

/**
 * Get appropriate text color for a background (black or white)
 * @param {string} backgroundColor - Background hex color
 * @returns {string} '#000000' or '#ffffff'
 */
export const getTextColorForBackground = (backgroundColor) => {
  const luminance = getLuminance(backgroundColor)
  return luminance > 0.5 ? '#000000' : '#ffffff'
}

/**
 * WCAG compliant color palette adjustments
 */
export const wcagColors = {
  // High contrast text colors
  text: {
    primary: '#ffffff', // On dark backgrounds
    secondary: '#e2e8f0', // On dark backgrounds
    muted: '#94a3b8', // On dark backgrounds
    onLight: '#1e293b', // On light backgrounds
  },

  // High contrast backgrounds
  background: {
    primary: '#0f172a', // Very dark slate
    secondary: '#1e293b', // Dark slate
    tertiary: '#334155', // Medium slate
    light: '#f8fafc', // Very light
  },

  // High contrast semantic colors
  success: {
    bg: '#065f46', // Dark green
    text: '#ecfdf5', // Light green
  },

  warning: {
    bg: '#92400e', // Dark yellow/amber
    text: '#fefce8', // Light yellow
  },

  error: {
    bg: '#991b1b', // Dark red
    text: '#fef2f2', // Light red
  },
}
