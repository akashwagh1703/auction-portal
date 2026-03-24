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

  // ── Bidding rules form
  const [bidRules, setBidRules] = useState({
    bid_start_amount: '',
    bid_increment_type: 'threshold',
    bid_increment_fixed: '',
    bid_increment_thresholds: '',
    bid_max_amount: '',
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
    setBidRules({
      bid_start_amount:        settings.bid_start_amount        ?? 25,
      bid_increment_type:      settings.bid_increment_type      ?? 'threshold',
      bid_increment_fixed:     settings.bid_increment_fixed     ?? 25,
      bid_increment_thresholds: settings.bid_increment_thresholds ?? '200:25,max:50',
      bid_max_amount:          settings.bid_max_amount          ?? 0,
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

  // ── Save bidding rules
  const saveBidRules = async () => {
    if (bidRules.bid_increment_type === 'fixed' && Number(bidRules.bid_increment_fixed) < 1)
      return toast.error('Fixed increment must be at least 1')
    if (bidRules.bid_increment_type === 'threshold') {
      const raw = bidRules.bid_increment_thresholds.toString().trim()
      if (!raw) return toast.error('Thresholds cannot be empty')
      const segments = raw.split(',').map(s => s.trim())
      const hasMax = segments.some(s => s.toLowerCase().startsWith('max:'))
      if (!hasMax) return toast.error('Thresholds must end with a max: entry, e.g. max:50')
    }
    setSaving(true)
    try {
      await updateSettings({
        bid_start_amount:         Number(bidRules.bid_start_amount),
        bid_increment_type:       bidRules.bid_increment_type,
        bid_increment_fixed:      Number(bidRules.bid_increment_fixed),
        bid_increment_thresholds: bidRules.bid_increment_thresholds.toString(),
        bid_max_amount:           Number(bidRules.bid_max_amount),
      })
      toast.success('Bidding rules saved!')
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
        <div className="space-y-5">

          {/* ─ Auction Defaults ─ */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5 space-y-4">
            <div>
              <h2 className="font-bold text-base">Auction Defaults</h2>
              <p className="text-xs text-slate-400 mt-0.5">Pre-fill values for the Create Auction wizard.</p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Input
                label="Default Bid Timer (seconds)"
                type="text" inputMode="numeric"
                value={auctionDef.default_bid_timer}
                onChange={e => { if (/^\d*$/.test(e.target.value)) setAuctionDef(a => ({ ...a, default_bid_timer: e.target.value })) }}
                placeholder="30"
              />
              <Input
                label="Default Budget Per Team (₹)"
                type="text" inputMode="numeric"
                value={auctionDef.default_budget_per_team}
                onChange={e => { if (/^\d*$/.test(e.target.value)) setAuctionDef(a => ({ ...a, default_budget_per_team: e.target.value })) }}
                placeholder="1000000"
              />
            </div>
            <Input
              label="Default Max Players Per Team"
              type="text" inputMode="numeric"
              value={auctionDef.default_max_players}
              onChange={e => { if (/^\d*$/.test(e.target.value)) setAuctionDef(a => ({ ...a, default_max_players: e.target.value })) }}
              placeholder="15"
            />
            <Button onClick={saveAuctionDef} disabled={saving} className="w-full">
              {saving ? 'Saving...' : 'Save Auction Defaults'}
            </Button>
          </div>

          {/* ─ Bidding Rules ─ */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5 space-y-5">
            <div>
              <h2 className="font-bold text-base">Bidding Rules</h2>
              <p className="text-xs text-slate-400 mt-0.5">These rules apply live during every auction.</p>
            </div>

            {/* Opening bid */}
            <div className="space-y-1.5">
              <Input
                label="Opening Bid Amount (₹)"
                type="text" inputMode="numeric"
                value={bidRules.bid_start_amount}
                onChange={e => { if (/^\d*$/.test(e.target.value)) setBidRules(b => ({ ...b, bid_start_amount: e.target.value })) }}
                placeholder="100"
              />
              <p className="text-xs text-slate-500">Every player bidding starts from this amount. Set 0 to use each player’s own base price.</p>
            </div>

            {/* Increment type toggle */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-300">Increment Type</label>
              <div className="grid grid-cols-2 gap-2">
                {[['fixed', 'Fixed', 'Same jump every bid'], ['threshold', 'Threshold', 'Jump changes by price level']].map(([val, label, desc]) => (
                  <button
                    key={val}
                    onClick={() => setBidRules(b => ({ ...b, bid_increment_type: val }))}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      bidRules.bid_increment_type === val
                        ? 'bg-blue-600/20 border-blue-500 text-white'
                        : 'bg-slate-700 border-slate-600 text-slate-400 hover:border-slate-500'
                    }`}
                  >
                    <p className="text-sm font-semibold">{label}</p>
                    <p className="text-xs mt-0.5 opacity-70">{desc}</p>
                  </button>
                ))}
              </div>
            </div>

            {/* Fixed increment */}
            {bidRules.bid_increment_type === 'fixed' && (
              <div className="space-y-1.5">
                <Input
                  label="Fixed Increment Amount (₹)"
                  type="text" inputMode="numeric"
                  value={bidRules.bid_increment_fixed}
                  onChange={e => { if (/^\d*$/.test(e.target.value)) setBidRules(b => ({ ...b, bid_increment_fixed: e.target.value })) }}
                  placeholder="25"
                />
                <p className="text-xs text-slate-500">Every bid is exactly this much higher than the current bid.</p>
              </div>
            )}

            {/* Threshold increments */}
            {bidRules.bid_increment_type === 'threshold' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-300">Price Thresholds</label>
                  <input
                    value={bidRules.bid_increment_thresholds}
                    onChange={e => setBidRules(b => ({ ...b, bid_increment_thresholds: e.target.value }))}
                    placeholder="200:25,max:50"
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm font-mono"
                  />
                  <p className="text-xs text-slate-500">
                    Format: <span className="text-slate-300 font-mono">price:increment</span> pairs, comma separated. Use <span className="text-slate-300 font-mono">max</span> as the final fallback.<br />
                    Example: <span className="text-slate-300 font-mono">200:25,max:50</span> means +₹25 while bid &lt; ₹200, then +₹50 after.
                  </p>
                </div>

                {/* Threshold breakdown */}
                <div className="bg-slate-700/50 rounded-xl p-3 space-y-1.5">
                  <p className="text-xs text-slate-400 mb-2">Threshold breakdown</p>
                  {bidRules.bid_increment_thresholds.toString().split(',').map((seg, i) => {
                    const parts = seg.trim().split(':')
                    if (parts.length !== 2) return null
                    const [limit, inc] = parts.map(s => s.trim())
                    const isMax = limit.toLowerCase() === 'max'
                    return (
                      <div key={i} className="flex items-center gap-3 text-xs">
                        <span className={`px-2 py-1 rounded-lg font-mono font-bold ${
                          isMax ? 'bg-orange-500/20 text-orange-300' : 'bg-blue-500/20 text-blue-300'
                        }`}>
                          {isMax ? '≥ all' : `< ₹${Number(limit).toLocaleString()}`}
                        </span>
                        <span className="text-slate-400">→</span>
                        <span className="text-green-400 font-bold">+₹{Number(inc).toLocaleString()}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Max bid cap */}
            <div className="space-y-1.5">
              <Input
                label="Maximum Bid Cap (₹)"
                type="text" inputMode="numeric"
                value={bidRules.bid_max_amount}
                onChange={e => { if (/^\d*$/.test(e.target.value)) setBidRules(b => ({ ...b, bid_max_amount: e.target.value })) }}
                placeholder="0"
              />
              <p className="text-xs text-slate-500">No bid can exceed this amount. Set 0 to disable the cap.</p>
            </div>

            {/* Live simulation */}
            <div className="bg-slate-900 rounded-xl p-4 border border-slate-700 space-y-2">
              <p className="text-xs text-slate-400 uppercase tracking-widest font-semibold">Live Simulation</p>
              {(() => {
                const type = bidRules.bid_increment_type
                const start = Number(bidRules.bid_start_amount) || 25
                const fixed = Number(bidRules.bid_increment_fixed) || 25
                const max = Number(bidRules.bid_max_amount) || 0

                // Parse thresholds: "200:25,max:50" → [{limit:200,inc:25},{limit:Infinity,inc:50}]
                const thresholds = (bidRules.bid_increment_thresholds || '').toString()
                  .split(',').map(s => {
                    const [l, i] = s.trim().split(':')
                    return { limit: l?.toLowerCase() === 'max' ? Infinity : Number(l), inc: Number(i) }
                  }).filter(t => !isNaN(t.inc) && t.inc > 0)

                const getIncrement = (currentBid) => {
                  if (type === 'fixed') return fixed
                  for (const t of thresholds) {
                    if (currentBid < t.limit) return t.inc
                  }
                  return thresholds[thresholds.length - 1]?.inc || fixed
                }

                const steps = [{ bid: 0, amount: start, inc: 0, label: 'Opening' }]
                let current = start
                for (let i = 0; i < 10; i++) {
                  const inc = getIncrement(current)
                  const next = current + inc
                  if (max > 0 && next > max) break
                  steps.push({ bid: i + 1, amount: next, inc })
                  current = next
                  if (steps.length >= 10) break
                }
                return (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-xs text-slate-500 mb-1">
                      <span className="w-8">Bid</span>
                      <span className="w-24">Amount</span>
                      <span>+Increment</span>
                    </div>
                    {steps.map((s, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <span className="w-8 text-slate-500">{s.label ?? `#${s.bid}`}</span>
                        <span className="w-24 font-bold text-green-400">{fmt(s.amount)}</span>
                        <span className="text-blue-400">{s.inc > 0 ? `+${fmt(s.inc)}` : '—'}</span>
                      </div>
                    ))}
                    {max > 0 && <p className="text-xs text-red-400 mt-1">🛑 Cap at {fmt(max)}</p>}
                  </div>
                )
              })()}
            </div>

            <Button onClick={saveBidRules} disabled={saving} className="w-full">
              {saving ? 'Saving...' : 'Save Bidding Rules'}
            </Button>
          </div>
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
