import { useState, useEffect, useRef } from 'react'
import { useSettings } from '../context/SettingsContext'
import { useAuth } from '../context/AuthContext'
import { Button, Input } from '../components/ui'
import { Palette, User, Gavel, Monitor, Eye, EyeOff, Upload, X } from 'lucide-react'
import api from '../services/api'
import toast from 'react-hot-toast'

const TABS = [
  { key: 'branding',  label: 'Branding',         icon: Palette },
  { key: 'account',   label: 'Admin Account',     icon: User },
  { key: 'auction',   label: 'Auction Defaults',  icon: Gavel },
  { key: 'login',     label: 'Login Page',        icon: Monitor },
]

const PRESET_COLORS = [
  '#2563eb', '#7c3aed', '#db2777', '#dc2626',
  '#ea580c', '#ca8a04', '#16a34a', '#0891b2',
]

export default function SettingsPage() {
  const { settings, updateSettings, updateProfile, changePassword } = useSettings()
  const { user, login } = useAuth()
  const [tab, setTab] = useState('branding')
  const [saving, setSaving] = useState(false)

  // ── Branding form
  const [branding, setBranding] = useState({
    app_name: '', app_tagline: '', app_logo: '', app_primary_color: '',
  })
  const [logoMode, setLogoMode] = useState('emoji') // 'emoji' | 'url' | 'upload'
  const [logoPreview, setLogoPreview] = useState(null) // object URL for uploaded file
  const [logoUploading, setLogoUploading] = useState(false)
  const logoFileRef = useRef()

  // ── Account form
  const [profile, setProfile] = useState({ name: '', email: '' })
  const [pwd, setPwd] = useState({ current_password: '', new_password: '', new_password_confirmation: '' })
  const [showPwd, setShowPwd] = useState(false)

  // ── Auction defaults form
  const [auctionDef, setAuctionDef] = useState({
    default_bid_timer: '', default_budget_per_team: '', default_max_players: '', default_bid_increments: '',
  })

  // ── Login page form
  const [loginCfg, setLoginCfg] = useState({
    show_demo_login: true, login_welcome_message: '',
  })

  // Sync forms when settings load
  useEffect(() => {
    const logo = settings.app_logo ?? ''
    // Detect mode from saved value
    const mode = logo.startsWith('http') || logo.startsWith('/storage') ? 'url' : 'emoji'
    setLogoMode(mode)
    setBranding({
      app_name:          settings.app_name          ?? '',
      app_tagline:       settings.app_tagline       ?? '',
      app_logo:          logo,
      app_primary_color: settings.app_primary_color ?? '#2563eb',
    })
    setAuctionDef({
      default_bid_timer:       settings.default_bid_timer       ?? 30,
      default_budget_per_team: settings.default_budget_per_team ?? 1000000,
      default_max_players:     settings.default_max_players     ?? 15,
      default_bid_increments:  settings.default_bid_increments  ?? '10000,25000,50000,100000',
    })
    setLoginCfg({
      show_demo_login:       settings.show_demo_login       ?? true,
      login_welcome_message: settings.login_welcome_message ?? '',
    })
  }, [settings])

  useEffect(() => {
    if (user) setProfile({ name: user.name ?? '', email: user.email ?? '' })
  }, [user])

  // ── Upload logo file
  const handleLogoFileChange = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    // Local preview immediately
    const objectUrl = URL.createObjectURL(file)
    setLogoPreview(objectUrl)
    // Upload to server
    setLogoUploading(true)
    try {
      const form = new FormData()
      form.append('logo', file)
      const res = await api.post('/settings/logo', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      setBranding(b => ({ ...b, app_logo: res.data.url }))
      toast.success('Logo uploaded!')
    } catch {
      toast.error('Upload failed')
      setLogoPreview(null)
    } finally {
      setLogoUploading(false)
      e.target.value = ''
    }
  }

  const clearLogo = () => {
    setBranding(b => ({ ...b, app_logo: '' }))
    setLogoPreview(null)
    setLogoMode('emoji')
  }

  // ── Save branding
  const saveBranding = async () => {
    if (!branding.app_name.trim()) return toast.error('App name is required')
    setSaving(true)
    try {
      await updateSettings(branding)
      toast.success('Branding saved!')
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  // ── Save auction defaults
  const saveAuctionDef = async () => {
    if (!auctionDef.default_bid_timer || Number(auctionDef.default_bid_timer) < 10)
      return toast.error('Bid timer must be at least 10 seconds')
    if (!auctionDef.default_budget_per_team || Number(auctionDef.default_budget_per_team) < 1)
      return toast.error('Budget must be a positive number')
    setSaving(true)
    try {
      await updateSettings({
        default_bid_timer:       Number(auctionDef.default_bid_timer),
        default_budget_per_team: Number(auctionDef.default_budget_per_team),
        default_max_players:     Number(auctionDef.default_max_players),
        default_bid_increments:  auctionDef.default_bid_increments,
      })
      toast.success('Auction defaults saved!')
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  // ── Save login config
  const saveLoginCfg = async () => {
    setSaving(true)
    try {
      await updateSettings(loginCfg)
      toast.success('Login page settings saved!')
    } catch { toast.error('Failed to save') }
    finally { setSaving(false) }
  }

  // ── Save profile
  const saveProfile = async () => {
    if (!profile.name.trim()) return toast.error('Name is required')
    if (!profile.email.trim()) return toast.error('Email is required')
    setSaving(true)
    try {
      await updateProfile(profile)
      toast.success('Profile updated!')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to update profile')
    } finally { setSaving(false) }
  }

  // ── Change password
  const savePassword = async () => {
    if (!pwd.current_password) return toast.error('Current password is required')
    if (!pwd.new_password || pwd.new_password.length < 6) return toast.error('New password must be at least 6 characters')
    if (pwd.new_password !== pwd.new_password_confirmation) return toast.error('Passwords do not match')
    setSaving(true)
    try {
      await changePassword(pwd)
      toast.success('Password changed!')
      setPwd({ current_password: '', new_password: '', new_password_confirmation: '' })
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to change password')
    } finally { setSaving(false) }
  }

  const fmt = (n) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${(n || 0).toLocaleString()}`

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-slate-400 text-sm mt-1">Manage your auction platform configuration</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-slate-800 p-1 rounded-2xl border border-slate-700">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${
              tab === t.key
                ? 'bg-blue-600 text-white shadow-lg'
                : 'text-slate-400 hover:text-white hover:bg-slate-700'
            }`}
          >
            <t.icon size={15} />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {/* ── TAB: BRANDING ── */}
      {tab === 'branding' && (
        <div className="space-y-6">
          {/* Live preview */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
            <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-4">Live Preview</p>
            <div className="flex items-center gap-3 p-4 bg-slate-900 rounded-xl border border-slate-700">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold text-white shrink-0 overflow-hidden"
                style={{ backgroundColor: branding.app_primary_color || '#2563eb' }}
              >
                {(logoPreview || (branding.app_logo && (branding.app_logo.startsWith('http') || branding.app_logo.startsWith('/')))) ? (
                  <img src={logoPreview || branding.app_logo} alt="logo" className="w-full h-full object-cover" />
                ) : (
                  branding.app_logo || '🏏'
                )}
              </div>
              <div>
                <p className="font-bold text-lg leading-tight">{branding.app_name || 'AuctionPro'}</p>
                <p className="text-sm text-slate-400">{branding.app_tagline || 'Player Auction Platform'}</p>
              </div>
            </div>
          </div>

          {/* Form */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5 space-y-4">
            <Input
              label="App Name"
              value={branding.app_name}
              onChange={e => setBranding(b => ({ ...b, app_name: e.target.value }))}
              placeholder="AuctionPro"
            />
            <Input
              label="Tagline"
              value={branding.app_tagline}
              onChange={e => setBranding(b => ({ ...b, app_tagline: e.target.value }))}
              placeholder="Player Auction Platform"
            />
            {/* Logo field */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Logo <span className="text-slate-500 font-normal">(optional)</span></label>

              {/* Mode toggle */}
              <div className="flex gap-1 p-1 bg-slate-700 rounded-xl w-fit">
                {[['emoji', 'Emoji'], ['url', 'Image URL'], ['upload', 'Upload File']].map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => { setLogoMode(key); if (key !== 'upload') setLogoPreview(null) }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      logoMode === key ? 'bg-slate-900 text-white shadow' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Emoji / text input */}
              {logoMode === 'emoji' && (
                <input
                  value={branding.app_logo}
                  onChange={e => setBranding(b => ({ ...b, app_logo: e.target.value }))}
                  placeholder="e.g. 🏏 or leave empty"
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              )}

              {/* Image URL input */}
              {logoMode === 'url' && (
                <input
                  value={branding.app_logo}
                  onChange={e => setBranding(b => ({ ...b, app_logo: e.target.value }))}
                  placeholder="https://example.com/logo.png"
                  className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              )}

              {/* File upload */}
              {logoMode === 'upload' && (
                <div className="space-y-2">
                  <div
                    onClick={() => logoFileRef.current.click()}
                    className="flex items-center gap-3 px-4 py-3 bg-slate-700 border-2 border-dashed border-slate-600 hover:border-blue-500 rounded-xl cursor-pointer transition-colors group"
                  >
                    <Upload size={18} className="text-slate-400 group-hover:text-blue-400 shrink-0" />
                    <div>
                      <p className="text-sm text-slate-300 group-hover:text-white">
                        {logoUploading ? 'Uploading...' : 'Click to upload image'}
                      </p>
                      <p className="text-xs text-slate-500">PNG, JPG, SVG, WEBP — max 2MB</p>
                    </div>
                    {(logoPreview || (branding.app_logo && branding.app_logo.startsWith('/'))) && (
                      <img
                        src={logoPreview || branding.app_logo}
                        alt="logo"
                        className="w-10 h-10 rounded-lg object-cover ml-auto shrink-0"
                      />
                    )}
                  </div>
                  <input
                    ref={logoFileRef}
                    type="file"
                    accept="image/png,image/jpeg,image/svg+xml,image/webp"
                    className="hidden"
                    onChange={handleLogoFileChange}
                  />
                </div>
              )}

              {/* Clear button */}
              {branding.app_logo && (
                <button
                  onClick={clearLogo}
                  className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-red-400 transition-colors"
                >
                  <X size={12} /> Clear logo
                </button>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Primary Color</label>
              <div className="flex flex-wrap gap-2 items-center">
                {PRESET_COLORS.map(c => (
                  <button
                    key={c}
                    onClick={() => setBranding(b => ({ ...b, app_primary_color: c }))}
                    className={`w-8 h-8 rounded-lg transition-all ${
                      branding.app_primary_color === c
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-110'
                        : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
                <input
                  type="color"
                  value={branding.app_primary_color}
                  onChange={e => setBranding(b => ({ ...b, app_primary_color: e.target.value }))}
                  className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-slate-600"
                  title="Custom color"
                />
                <span className="text-xs text-slate-500 ml-1">{branding.app_primary_color}</span>
              </div>
            </div>

            <Button onClick={saveBranding} disabled={saving} className="w-full">
              {saving ? 'Saving...' : 'Save Branding'}
            </Button>
          </div>
        </div>
      )}

      {/* ── TAB: ADMIN ACCOUNT ── */}
      {tab === 'account' && (
        <div className="space-y-5">
          {/* Profile */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5 space-y-4">
            <h2 className="font-bold text-base">Profile</h2>
            <Input
              label="Name"
              value={profile.name}
              onChange={e => setProfile(p => ({ ...p, name: e.target.value }))}
              placeholder="Admin User"
            />
            <Input
              label="Email"
              type="email"
              value={profile.email}
              onChange={e => setProfile(p => ({ ...p, email: e.target.value }))}
              placeholder="admin@example.com"
            />
            <Button onClick={saveProfile} disabled={saving} className="w-full">
              {saving ? 'Saving...' : 'Update Profile'}
            </Button>
          </div>

          {/* Change password */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5 space-y-4">
            <h2 className="font-bold text-base">Change Password</h2>
            <div className="relative">
              <Input
                label="Current Password"
                type={showPwd ? 'text' : 'password'}
                value={pwd.current_password}
                onChange={e => setPwd(p => ({ ...p, current_password: e.target.value }))}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPwd(v => !v)}
                className="absolute right-3 top-9 text-slate-400 hover:text-white"
              >
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <Input
              label="New Password"
              type="password"
              value={pwd.new_password}
              onChange={e => setPwd(p => ({ ...p, new_password: e.target.value }))}
              placeholder="Min 6 characters"
            />
            <Input
              label="Confirm New Password"
              type="password"
              value={pwd.new_password_confirmation}
              onChange={e => setPwd(p => ({ ...p, new_password_confirmation: e.target.value }))}
              placeholder="Repeat new password"
            />
            <Button onClick={savePassword} disabled={saving} className="w-full">
              {saving ? 'Saving...' : 'Change Password'}
            </Button>
          </div>
        </div>
      )}

      {/* ── TAB: AUCTION DEFAULTS ── */}
      {tab === 'auction' && (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5 space-y-4">
          <p className="text-sm text-slate-400">These values pre-fill the Create Auction wizard automatically.</p>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Default Bid Timer (seconds)"
              type="text"
              inputMode="numeric"
              value={auctionDef.default_bid_timer}
              onChange={e => { if (/^\d*$/.test(e.target.value)) setAuctionDef(a => ({ ...a, default_bid_timer: e.target.value })) }}
              placeholder="30"
            />
            <Input
              label="Default Budget Per Team (₹)"
              type="text"
              inputMode="numeric"
              value={auctionDef.default_budget_per_team}
              onChange={e => { if (/^\d*$/.test(e.target.value)) setAuctionDef(a => ({ ...a, default_budget_per_team: e.target.value })) }}
              placeholder="1000000"
            />
          </div>

          <Input
            label="Default Max Players Per Team"
            type="text"
            inputMode="numeric"
            value={auctionDef.default_max_players}
            onChange={e => { if (/^\d*$/.test(e.target.value)) setAuctionDef(a => ({ ...a, default_max_players: e.target.value })) }}
            placeholder="15"
          />

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">Default Bid Increments (₹, comma separated)</label>
            <input
              value={auctionDef.default_bid_increments}
              onChange={e => setAuctionDef(a => ({ ...a, default_bid_increments: e.target.value }))}
              placeholder="10000,25000,50000,100000"
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
          </div>

          {/* Increment preview */}
          <div className="bg-slate-700/50 rounded-xl p-3">
            <p className="text-xs text-slate-400 mb-2">Bid button preview</p>
            <div className="flex flex-wrap gap-2">
              {auctionDef.default_bid_increments.toString().split(',').map((v, i) => {
                const n = Number(v.trim())
                return n ? (
                  <span key={i} className="px-3 py-1.5 bg-blue-600/30 border border-blue-500/30 rounded-lg text-xs font-medium text-blue-300">
                    +{fmt(n)}
                  </span>
                ) : null
              })}
            </div>
          </div>

          <Button onClick={saveAuctionDef} disabled={saving} className="w-full">
            {saving ? 'Saving...' : 'Save Auction Defaults'}
          </Button>
        </div>
      )}

      {/* ── TAB: LOGIN PAGE ── */}
      {tab === 'login' && (
        <div className="space-y-5">
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5 space-y-4">
            <Input
              label="Welcome Message"
              value={loginCfg.login_welcome_message}
              onChange={e => setLoginCfg(l => ({ ...l, login_welcome_message: e.target.value }))}
              placeholder="Welcome back! Please sign in to continue."
            />

            <div className="flex items-center justify-between p-4 bg-slate-700/50 rounded-xl border border-slate-600">
              <div>
                <p className="text-sm font-medium text-white">Show Demo Login Buttons</p>
                <p className="text-xs text-slate-400 mt-0.5">Quick login buttons for Admin, Owner, Player</p>
              </div>
              <button
                onClick={() => setLoginCfg(l => ({ ...l, show_demo_login: !l.show_demo_login }))}
                className={`relative w-12 h-6 rounded-full transition-colors ${
                  loginCfg.show_demo_login ? 'bg-blue-600' : 'bg-slate-600'
                }`}
              >
                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-all ${
                  loginCfg.show_demo_login ? 'left-7' : 'left-1'
                }`} />
              </button>
            </div>

            <Button onClick={saveLoginCfg} disabled={saving} className="w-full">
              {saving ? 'Saving...' : 'Save Login Settings'}
            </Button>
          </div>

          {/* Login page preview */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
            <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold mb-4">Login Page Preview</p>
            <div className="bg-slate-900 rounded-xl p-6 text-center space-y-3 border border-slate-700">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl mx-auto"
                style={{ backgroundColor: settings.app_primary_color || '#2563eb' }}
              >
                {settings.app_logo || '🏏'}
              </div>
              <p className="font-bold text-lg">{settings.app_name || 'AuctionPro'}</p>
              <p className="text-slate-400 text-sm">{loginCfg.login_welcome_message || settings.login_welcome_message}</p>
              {loginCfg.show_demo_login && (
                <div className="flex gap-2 justify-center mt-2">
                  {['Admin', 'Owner', 'Player'].map(r => (
                    <span key={r} className="px-3 py-1.5 bg-slate-700 rounded-lg text-xs text-slate-300">{r}</span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
