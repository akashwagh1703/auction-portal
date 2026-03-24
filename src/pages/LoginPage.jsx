import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { Button, Input } from '../components/ui'

const DEMO_ACCOUNTS = [
  { label: 'Admin',  email: 'admin@auction.com',  password: 'admin123' },
  { label: 'Owner',  email: 'mumbai@auction.com',  password: 'owner123' },
  { label: 'Player', email: 'virat@auction.com',   password: 'player123' },
]

export default function LoginPage() {
  const { login } = useAuth()
  const { settings } = useSettings()
  const navigate = useNavigate()
  const [form, setForm] = useState({ email: '', password: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!form.email.trim()) return setError('Email is required')
    if (!form.password) return setError('Password is required')
    setLoading(true)
    const result = await login(form.email, form.password)
    if (result.success) { navigate('/dashboard') }
    else setError(result.error)
    setLoading(false)
  }

  const quickLogin = async (acc) => {
    setError('')
    setLoading(true)
    const result = await login(acc.email, acc.password)
    if (result.success) { navigate('/dashboard') }
    else setError(result.error)
    setLoading(false)
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4 overflow-hidden"
            style={{ backgroundColor: settings.app_primary_color || '#2563eb' }}
          >
            {settings.app_logo && (settings.app_logo.startsWith('http') || settings.app_logo.startsWith('/')) ? (
              <img src={settings.app_logo} alt="logo" className="w-full h-full object-cover" />
            ) : (
              settings.app_logo || '🏏'
            )}
          </div>
          <h1 className="text-3xl font-bold text-white">{settings.app_name || 'AuctionPro'}</h1>
          <p className="text-slate-400 mt-2">{settings.login_welcome_message || 'Player Auction Platform'}</p>
        </div>

        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6 shadow-2xl">
          {error && (
            <div className="mb-4 px-4 py-3 bg-red-500/10 border border-red-500/30 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}
          <form onSubmit={handleSubmit} noValidate className="space-y-4">
            <Input
              label="Email"
              type="email"
              placeholder="Enter your email"
              value={form.email}
              onChange={e => { setForm(f => ({ ...f, email: e.target.value })); setError('') }}
            />
            <Input
              label="Password"
              type="password"
              placeholder="Enter your password"
              value={form.password}
              onChange={e => { setForm(f => ({ ...f, password: e.target.value })); setError('') }}
            />
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </form>

          {settings.show_demo_login && (
            <div className="mt-6">
              <p className="text-xs text-slate-500 text-center mb-3">Quick Demo Login</p>
              <div className="grid grid-cols-3 gap-2">
                {DEMO_ACCOUNTS.map(acc => (
                  <button
                    key={acc.label}
                    onClick={() => quickLogin(acc)}
                    disabled={loading}
                    className="py-2 px-3 bg-slate-700 hover:bg-slate-600 rounded-xl text-xs font-medium text-slate-300 transition-colors disabled:opacity-50"
                  >
                    {acc.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
