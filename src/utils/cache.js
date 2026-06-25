// Simple in-memory cache with TTL support
class Cache {
  constructor() {
    this.cache = new Map()
  }

  set(key, value, ttl = 5 * 60 * 1000) {
    const expiry = Date.now() + ttl
    this.cache.set(key, { value, expiry })
  }

  get(key) {
    const item = this.cache.get(key)
    if (!item) return null

    if (Date.now() > item.expiry) {
      this.cache.delete(key)
      return null
    }

    return item.value
  }

  has(key) {
    return this.get(key) !== null
  }

  delete(key) {
    this.cache.delete(key)
  }

  clear() {
    this.cache.clear()
  }

  // Clean up expired entries
  cleanup() {
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now > item.expiry) {
        this.cache.delete(key)
      }
    }
  }
}

// Create singleton instance
const cache = new Cache()

// Clean up expired entries every minute
if (typeof window !== 'undefined') {
  setInterval(() => cache.cleanup(), 60 * 1000)
}

export default cache

// Cache keys constants
export const CACHE_KEYS = {
  USER_DATA: 'user_data',
  TEAMS: 'teams',
  PLAYERS: 'players',
  AUCTIONS: 'auctions',
  SETTINGS: 'settings',
}
