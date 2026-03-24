import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../services/api'

const SettingsContext = createContext(null)

const DEFAULTS = {
  app_name: 'AuctionPro',
  app_tagline: 'Player Auction Platform',
  app_logo: '🏏',
  app_primary_color: '#2563eb',
  show_demo_login: true,
  login_welcome_message: 'Welcome back! Please sign in to continue.',
  default_bid_timer: 30,
  default_budget_per_team: 1000000,
  default_max_players: 15,
  default_bid_increments: '10000,25000,50000,100000',
  // Bidding rules
  bid_start_amount: 25,
  bid_increment_type: 'tiered',
  bid_increment_fixed: 1000,
  bid_increment_tiers: '100,500,1000,2000',
  bid_tier_every_n_bids: 3,
  bid_max_amount: 0,
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get('/settings')
      .then(res => setSettings({ ...DEFAULTS, ...res.data }))
      .catch(() => setSettings(DEFAULTS)) // fallback to defaults on any error
      .finally(() => setLoading(false))
  }, [])

  // Apply primary color as CSS variable whenever it changes
  useEffect(() => {
    if (settings.app_primary_color) {
      document.documentElement.style.setProperty('--color-primary', settings.app_primary_color)
    }
  }, [settings.app_primary_color])

  const updateSettings = useCallback(async (data) => {
    const res = await api.put('/settings', data)
    setSettings(prev => ({ ...prev, ...res.data }))
    return res.data
  }, [])

  const updateProfile = useCallback(async (data) => {
    const res = await api.put('/settings/profile', data)
    return res.data
  }, [])

  const changePassword = useCallback(async (data) => {
    const res = await api.put('/settings/password', data)
    return res.data
  }, [])

  return (
    <SettingsContext.Provider value={{ settings, loading, updateSettings, updateProfile, changePassword }}>
      {children}
    </SettingsContext.Provider>
  )
}

export const useSettings = () => useContext(SettingsContext)
