import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuction } from '../context/AuctionContext'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import { Button, Modal, Input, Select, Badge } from '../components/ui'
import { Plus, Gavel, Trash2, ArrowRight, Settings, Calendar } from 'lucide-react'
import toast from 'react-hot-toast'

const SPORTS = ['Cricket', 'Football', 'Basketball', 'Kabaddi', 'Hockey', 'Other']
const STATUS_COLOR = { upcoming: 'blue', live: 'green', completed: 'gray' }
const EMOJI_SPORTS = { Cricket: '🏏', Football: '⚽', Basketball: '🏀', Kabaddi: '🤼', Hockey: '🏑', Other: '🎯' }

export default function AuctionsListPage() {
  const { auctions, players, teams, createAuction, deleteAuction } = useAuction()
  const { user } = useAuth()
  const { settings } = useSettings()
  const navigate = useNavigate()
  const [modal, setModal] = useState(false)
  const [step, setStep] = useState(1)
  const [form, setForm] = useState(null) // null until modal opens
  const [saving, setSaving] = useState(false)

  const isAdmin = user?.role === 'admin'
  const fmt = (n) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${(n || 0).toLocaleString()}`

  const buildDefaultForm = () => ({
    name: '',
    sport: 'Cricket',
    date: '',
    bid_timer: settings.default_bid_timer ?? 30,
    bid_increments: settings.default_bid_increments ?? '10000,25000,50000,100000',
    budget_per_team: settings.default_budget_per_team ?? 1000000,
    max_players_per_team: settings.default_max_players ?? 15,
    player_ids: [],
    team_ids: [],
  })

  const setField = (key, val) => setForm(f => ({ ...f, [key]: val }))

  const toggleId = (key, id) =>
    setForm(f => ({
      ...f,
      [key]: f[key].includes(id) ? f[key].filter(x => x !== id) : [...f[key], id],
    }))

  const handleCreate = async () => {
    if (!form.name.trim()) return toast.error('Auction name required')
    if (!form.date) return toast.error('Date required')
    if (!form.bid_timer || isNaN(Number(form.bid_timer)) || Number(form.bid_timer) < 10) return toast.error('Bid timer must be at least 10 seconds')
    if (!form.budget_per_team || isNaN(Number(form.budget_per_team)) || Number(form.budget_per_team) <= 0) return toast.error('Budget per team must be a positive number')
    if (!form.max_players_per_team || isNaN(Number(form.max_players_per_team)) || Number(form.max_players_per_team) < 1) return toast.error('Max players must be at least 1')
    if (form.team_ids.length < 2) return toast.error('Select at least 2 teams')
    if (form.player_ids.length < 1) return toast.error('Select at least 1 player')

    const increments = form.bid_increments
      .split(',')
      .map(s => Number(s.trim()))
      .filter(Boolean)

    setSaving(true)
    try {
      const auction = await createAuction({
        name: form.name,
        sport: form.sport,
        date: form.date,
        bid_timer: Number(form.bid_timer),
        bid_increments: increments,
        budget_per_team: Number(form.budget_per_team),
        max_players_per_team: Number(form.max_players_per_team),
        player_ids: form.player_ids,
        team_ids: form.team_ids,
      })
      toast.success('Auction created!')
      setModal(false)
      setForm(null)
      setStep(1)
      navigate(`/auctions/${auction.id}`)
    } catch {
      toast.error('Failed to create auction')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (e, id) => {
    e.stopPropagation()
    if (!confirm('Delete this auction?')) return
    try {
      await deleteAuction(id)
      toast.success('Deleted')
    } catch {
      toast.error('Failed to delete')
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Auctions</h1>
          <p className="text-slate-400 text-sm">{auctions.length} auction{auctions.length !== 1 ? 's' : ''}</p>
        </div>
        {isAdmin && (
          <Button onClick={() => { setModal(true); setStep(1); setForm(buildDefaultForm()) }}>
            <Plus size={16} /> Create Auction
          </Button>
        )}
      </div>

      {auctions.length === 0 ? (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-12 text-center">
          <Gavel size={48} className="mx-auto mb-4 text-slate-600" />
          <p className="text-slate-400 font-medium">No auctions yet</p>
          {isAdmin && <p className="text-slate-500 text-sm mt-1">Create your first auction to get started</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {auctions.map(auction => {
            const auctionPlayers = auction.players ?? []
            const auctionTeams = auction.teams ?? []
            const soldCount = auctionPlayers.filter(p => p.pivot?.status === 'sold').length
            return (
              <div
                key={auction.id}
                onClick={() => navigate(`/auctions/${auction.id}`)}
                className="bg-slate-800 rounded-2xl border border-slate-700 p-5 cursor-pointer hover:border-blue-500/50 hover:bg-slate-700/50 transition-all group"
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center text-2xl">
                      {EMOJI_SPORTS[auction.sport] || '🎯'}
                    </div>
                    <div>
                      <h2 className="font-bold text-base leading-tight">{auction.name}</h2>
                      <p className="text-xs text-slate-400 mt-0.5">{auction.sport}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge color={STATUS_COLOR[auction.status]}>
                      {auction.status === 'live' && <span className="w-1.5 h-1.5 bg-green-400 rounded-full inline-block mr-1 animate-pulse" />}
                      {auction.status}
                    </Badge>
                    {isAdmin && (
                      <button
                        onClick={(e) => handleDelete(e, auction.id)}
                        className="p-1.5 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-colors"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 mb-4">
                  <div className="bg-slate-700 rounded-xl p-2.5 text-center">
                    <p className="text-lg font-bold">{auctionTeams.length}</p>
                    <p className="text-xs text-slate-400">Teams</p>
                  </div>
                  <div className="bg-slate-700 rounded-xl p-2.5 text-center">
                    <p className="text-lg font-bold">{auctionPlayers.length}</p>
                    <p className="text-xs text-slate-400">Players</p>
                  </div>
                  <div className="bg-slate-700 rounded-xl p-2.5 text-center">
                    <p className="text-lg font-bold text-green-400">{soldCount}</p>
                    <p className="text-xs text-slate-400">Sold</p>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="flex items-center gap-1"><Calendar size={12} />{auction.date || 'No date'}</span>
                  <span className="flex items-center gap-1"><Settings size={12} />Timer: {auction.bid_timer}s</span>
                  <span className="flex items-center gap-1 text-blue-400 group-hover:text-blue-300 font-medium">
                    Open <ArrowRight size={12} />
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Create Auction Modal */}
      <Modal open={modal} onClose={() => { setModal(false); setForm(null); setStep(1) }} title={`Create Auction — Step ${step} of 3`}>
        {form && (
          <div className="space-y-0">
            {/* Step progress */}
            <div className="flex gap-2 mb-6">
              {['Basic Info', 'Settings', 'Players & Teams'].map((label, i) => (
                <div key={i} className="flex-1 text-center">
                  <div className={`h-1.5 rounded-full mb-1.5 transition-all ${step > i || step === i + 1 ? 'bg-blue-500' : 'bg-slate-700'}`} />
                  <p className={`text-xs ${step === i + 1 ? 'text-blue-400 font-medium' : 'text-slate-500'}`}>{label}</p>
                </div>
              ))}
            </div>

            {/* Step 1 */}
            {step === 1 && (
              <div className="space-y-4">
                <Input label="Auction Name" placeholder="e.g. IPL Mega Auction 2025" value={form.name} onChange={e => setField('name', e.target.value)} />
                <Select label="Sport" value={form.sport} onChange={e => setField('sport', e.target.value)}>
                  {SPORTS.map(s => <option key={s} value={s}>{EMOJI_SPORTS[s]} {s}</option>)}
                </Select>
                <Input label="Auction Date" type="date" value={form.date} onChange={e => setField('date', e.target.value)} />
                <Button className="w-full" onClick={() => {
                  if (!form.name.trim()) return toast.error('Name required')
                  if (!form.date) return toast.error('Date required')
                  setStep(2)
                }}>Next: Settings →</Button>
              </div>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Input label="Bid Timer (seconds)" type="text" inputMode="numeric" value={form.bid_timer} onChange={e => { if (/^\d*$/.test(e.target.value)) setField('bid_timer', e.target.value) }} />
                  <Input label="Budget Per Team (₹)" type="text" inputMode="numeric" value={form.budget_per_team} onChange={e => { if (/^\d*$/.test(e.target.value)) setField('budget_per_team', e.target.value) }} />
                </div>
                <Input label="Max Players Per Team" type="text" inputMode="numeric" value={form.max_players_per_team} onChange={e => { if (/^\d*$/.test(e.target.value)) setField('max_players_per_team', e.target.value) }} />
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-slate-300">Bid Increments (₹, comma separated)</label>
                  <input
                    value={form.bid_increments}
                    onChange={e => setField('bid_increments', e.target.value)}
                    placeholder="10000,25000,50000,100000"
                    className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                  />
                </div>
                <div className="bg-slate-700/50 rounded-xl p-3">
                  <p className="text-xs text-slate-400 mb-2">Bid button preview</p>
                  <div className="flex flex-wrap gap-2">
                    {form.bid_increments.split(',').map((v, i) => {
                      const n = Number(v.trim())
                      return n ? (
                        <span key={i} className="px-3 py-1.5 bg-blue-600/30 border border-blue-500/30 rounded-lg text-xs font-medium text-blue-300">+{fmt(n)}</span>
                      ) : null
                    })}
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(1)}>← Back</Button>
                  <Button className="flex-1" onClick={() => setStep(3)}>Next: Players & Teams →</Button>
                </div>
              </div>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <div className="space-y-5">
                <div>
                  <p className="text-sm font-medium text-slate-300 mb-2">
                    Select Teams <span className="text-slate-500">({form.team_ids.length} selected)</span>
                  </p>
                  <div className="grid grid-cols-2 gap-2 max-h-40 overflow-y-auto">
                    {teams.map(t => (
                      <button
                        key={t.id}
                        onClick={() => toggleId('team_ids', t.id)}
                        className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-sm transition-all text-left ${
                          form.team_ids.includes(t.id) ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        <span>{t.logo}</span>
                        <span className="truncate font-medium">{t.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm font-medium text-slate-300">
                      Select Players <span className="text-slate-500">({form.player_ids.length} selected)</span>
                    </p>
                    <button
                      onClick={() => setForm(f => ({ ...f, player_ids: f.player_ids.length === players.length ? [] : players.map(p => p.id) }))}
                      className="text-xs text-blue-400 hover:text-blue-300"
                    >
                      {form.player_ids.length === players.length ? 'Deselect All' : 'Select All'}
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {players.map(p => (
                      <button
                        key={p.id}
                        onClick={() => toggleId('player_ids', p.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-sm transition-all text-left ${
                          form.player_ids.includes(p.id) ? 'bg-blue-600/20 border-blue-500/50 text-white' : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                        }`}
                      >
                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${form.player_ids.includes(p.id) ? 'bg-blue-500 border-blue-500' : 'border-slate-500'}`}>
                          {form.player_ids.includes(p.id) && <span className="text-white text-xs">✓</span>}
                        </div>
                        <div className="flex-1 min-w-0">
                          <span className="font-medium truncate block">{p.name}</span>
                          <span className="text-xs text-slate-400">{p.role} • {fmt(p.base_price)}</span>
                        </div>
                        <span className="text-xs text-yellow-400 shrink-0">★ {p.rating}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setStep(2)}>← Back</Button>
                  <Button variant="success" className="flex-1" onClick={handleCreate} disabled={saving}>
                    <Gavel size={16} /> {saving ? 'Creating...' : 'Create Auction'}
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}
