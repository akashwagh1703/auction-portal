import { useMemo, useState } from 'react'
import { useAuction } from '../context/AuctionContext'
import { useAuth } from '../context/AuthContext'
import { Button } from '../components/ui'
import { Gavel, Play, Square, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const BID_INCREMENTS = [10000, 25000, 50000, 100000]

const fmt = (n) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n?.toLocaleString()}`

export default function AuctionPage() {
  const { players, teams, bids, auctionState, startAuction, stopAuction, placeBid, soldPlayer } = useAuction()
  const { user } = useAuth()

  const isAdmin = user?.role === 'admin'
  const isOwner = user?.role === 'owner'

  // Admin selects which team to bid on behalf of
  const [selectedTeamId, setSelectedTeamId] = useState(null)

  const currentPlayer = useMemo(() => players.find(p => p.id === auctionState.currentPlayerId), [players, auctionState.currentPlayerId])
  const leadingTeam = useMemo(() => teams.find(t => t.id === auctionState.leadingTeamId), [teams, auctionState.leadingTeamId])
  const unsoldPlayers = useMemo(() => players.filter(p => p.status === 'unsold'), [players])

  const timerColor = auctionState.timer <= 5 ? 'text-red-400' : auctionState.timer <= 10 ? 'text-yellow-400' : 'text-green-400'
  const timerBg = auctionState.timer <= 5 ? 'bg-red-500/10 border-red-500/30' : auctionState.timer <= 10 ? 'bg-yellow-500/10 border-yellow-500/30' : 'bg-slate-800 border-slate-700'

  const handleBid = (increment) => {
    if (!auctionState.isLive) return toast.error('Auction not live')
    // Owner bids for their own team; Admin bids on behalf of selected team
    const bidTeamId = isAdmin ? selectedTeamId : user?.teamId
    if (!bidTeamId) return toast.error(isAdmin ? 'Select a team to bid on behalf of' : 'No team assigned')
    const bidTeam = teams.find(t => t.id === bidTeamId)
    if (!bidTeam) return toast.error('Team not found')
    const newAmount = auctionState.currentBid + increment
    if (newAmount > bidTeam.budget - bidTeam.spent) return toast.error(`Insufficient budget for ${bidTeam.name}!`)
    placeBid(bidTeamId, newAmount)
    toast.success(`Bid ₹${fmt(newAmount)} placed for ${bidTeam.name}`)
  }

  const handleSold = () => {
    if (!auctionState.leadingTeamId) return toast.error('No bids placed')
    soldPlayer(auctionState.leadingTeamId)
    toast.success(`${currentPlayer?.name} sold to ${leadingTeam?.name}!`)
  }

  const handleUnsold = () => {
    stopAuction()
    toast('Player marked unsold')
  }

  return (
    // pb-32 on mobile to avoid content hidden behind fixed bottom bar
    <div className={`space-y-4 ${isOwner && auctionState.isLive ? 'pb-32 lg:pb-0' : isAdmin && auctionState.isLive ? 'pb-64 lg:pb-0' : ''}`}>

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Live Auction</h1>
          <div className="flex items-center gap-2 mt-1">
            <div className={`w-2 h-2 rounded-full ${auctionState.isLive ? 'bg-red-500 animate-pulse' : 'bg-slate-500'}`} />
            <span className="text-sm text-slate-400">{auctionState.isLive ? 'LIVE' : 'Offline'}</span>
          </div>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            {!auctionState.isLive ? (
              <Button onClick={() => unsoldPlayers[0] ? startAuction(unsoldPlayers[0].id) : toast.error('No unsold players')} size="sm">
                <Play size={16} /> Start
              </Button>
            ) : (
              <Button variant="danger" onClick={stopAuction} size="sm"><Square size={16} /> Stop</Button>
            )}
          </div>
        )}
      </div>

      {/* ── STICKY TIMER BAR (mobile only) ── */}
      <div className={`lg:hidden sticky top-0 z-20 rounded-2xl border p-3 transition-all ${timerBg}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-slate-400">Current Bid</p>
            <p className="text-xl font-bold text-green-400">{fmt(auctionState.currentBid)}</p>
            {leadingTeam && <p className="text-xs text-slate-400 mt-0.5">🏆 {leadingTeam.name}</p>}
          </div>
          <div className="text-center">
            <div className={`text-4xl font-bold tabular-nums ${timerColor}`}>{auctionState.timer}</div>
            <p className="text-xs text-slate-400">sec</p>
          </div>
        </div>
      </div>

      {/* ── MAIN LAYOUT ── */}
      <div className="flex flex-col lg:flex-row gap-5">

        {/* LEFT: Player Card */}
        <div className="lg:w-72 shrink-0">
          {currentPlayer ? (
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5 text-center">
              <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl flex items-center justify-center text-3xl font-bold mx-auto mb-3">
                {currentPlayer.name[0]}
              </div>
              <h2 className="text-xl font-bold">{currentPlayer.name}</h2>
              <p className="text-slate-400 text-sm mt-1">{currentPlayer.role} • {currentPlayer.country}</p>
              <div className="grid grid-cols-2 gap-3 mt-4">
                <div className="bg-slate-700 rounded-xl p-3">
                  <p className="text-xs text-slate-400">Rating</p>
                  <p className="text-lg font-bold text-yellow-400">{currentPlayer.rating}</p>
                </div>
                <div className="bg-slate-700 rounded-xl p-3">
                  <p className="text-xs text-slate-400">Age</p>
                  <p className="text-lg font-bold">{currentPlayer.age}</p>
                </div>
              </div>
              <div className="mt-3 bg-slate-700 rounded-xl p-3">
                <p className="text-xs text-slate-400">Base Price</p>
                <p className="text-lg font-bold text-green-400">{fmt(currentPlayer.basePrice)}</p>
              </div>
            </div>
          ) : (
            <div className="bg-slate-800 rounded-2xl border border-slate-700 p-8 text-center text-slate-400">
              <Gavel size={40} className="mx-auto mb-3 opacity-30" />
              <p>No player selected</p>
            </div>
          )}
        </div>

        {/* CENTER: Bid + Timer (desktop) + Bid History */}
        <div className="flex-1 space-y-4">

          {/* Desktop-only timer/bid panel */}
          <div className={`hidden lg:block rounded-2xl border p-5 transition-all ${timerBg}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-slate-400 text-sm">Current Bid</p>
                <p className="text-3xl font-bold text-green-400">{fmt(auctionState.currentBid)}</p>
                {leadingTeam && <p className="text-sm text-slate-400 mt-1">Leading: <span className="text-white font-medium">{leadingTeam.name}</span></p>}
              </div>
              <div className="text-center">
                <div className={`text-5xl font-bold tabular-nums ${timerColor}`}>{auctionState.timer}</div>
                <p className="text-xs text-slate-400 mt-1">seconds</p>
              </div>
            </div>
          </div>

          {/* Admin controls — desktop inline, mobile in fixed bar */}
          {isAdmin && auctionState.isLive && (
            <div className="hidden lg:block space-y-3">
              {/* Team selector for admin bidding */}
              <div>
                <p className="text-sm text-slate-400 mb-2">Bid on behalf of</p>
                <div className="grid grid-cols-2 gap-2">
                  {teams.map(t => (
                    <button
                      key={t.id}
                      onClick={() => setSelectedTeamId(t.id)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                        selectedTeamId === t.id
                          ? 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-slate-700 border-slate-600 text-slate-300 hover:bg-slate-600'
                      }`}
                    >
                      <span>{t.logo}</span>
                      <span className="truncate">{t.name}</span>
                    </button>
                  ))}
                </div>
              </div>
              {/* Bid increments for admin */}
              {selectedTeamId && (
                <div>
                  <p className="text-sm text-slate-400 mb-2">Place Bid</p>
                  <div className="grid grid-cols-4 gap-2">
                    {BID_INCREMENTS.map(inc => (
                      <Button key={inc} variant="ghost" size="md" onClick={() => handleBid(inc)} className="w-full">
                        +{fmt(inc)}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              {/* Sold / Unsold */}
              <div className="flex gap-3">
                <Button variant="success" className="flex-1" onClick={handleSold}><CheckCircle size={18} /> Sold</Button>
                <Button variant="danger" className="flex-1" onClick={handleUnsold}><XCircle size={18} /> Unsold</Button>
              </div>
            </div>
          )}

          {/* Owner bid controls — desktop inline, mobile in fixed bar */}
          {isOwner && auctionState.isLive && (
            <div className="hidden lg:block">
              <p className="text-sm text-slate-400 mb-2">Place Bid</p>
              <div className="grid grid-cols-4 gap-2">
                {BID_INCREMENTS.map(inc => (
                  <Button key={inc} variant="ghost" size="md" onClick={() => handleBid(inc)} className="w-full">
                    +{fmt(inc)}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Bid History */}
          <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4">
            <h3 className="font-medium mb-3 text-sm text-slate-400">Recent Bids</h3>
            {bids.length === 0 ? (
              <p className="text-slate-500 text-sm text-center py-4">No bids yet</p>
            ) : (
              <div className="space-y-2">
                {[...bids].reverse().slice(0, 5).map((bid, i) => {
                  const team = teams.find(t => t.id === bid.teamId)
                  return (
                    <div key={bid.id} className={`flex items-center justify-between py-2 px-3 rounded-xl ${i === 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-slate-700/50'}`}>
                      <span className="text-sm font-medium">{team?.name || 'Unknown'}</span>
                      <span className={`text-sm font-bold ${i === 0 ? 'text-green-400' : 'text-slate-300'}`}>{fmt(bid.amount)}</span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Teams — horizontal scroll on mobile, stacked on desktop */}
        <div className="lg:w-64 shrink-0">
          <h3 className="font-medium mb-3 text-sm text-slate-400">Teams</h3>

          {/* Mobile: horizontal scroll */}
          <div className="flex lg:hidden gap-3 overflow-x-auto pb-2 -mx-1 px-1 snap-x snap-mandatory">
            {teams.map(team => {
              const isLeading = team.id === auctionState.leadingTeamId
              return (
                <div
                  key={team.id}
                  className={`snap-start shrink-0 w-40 bg-slate-800 rounded-xl border p-3 transition-all ${isLeading && auctionState.isLive ? 'border-green-500/50 bg-green-500/5' : 'border-slate-700'}`}
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xl">{team.logo}</span>
                    {isLeading && auctionState.isLive && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse ml-auto" />}
                  </div>
                  <p className="text-sm font-medium truncate">{team.name}</p>
                  <p className="text-xs text-slate-400 mt-1">{fmt(team.budget - team.spent)} left</p>
                </div>
              )
            })}
          </div>

          {/* Desktop: stacked */}
          <div className="hidden lg:flex flex-col gap-2">
            {teams.map(team => {
              const isLeading = team.id === auctionState.leadingTeamId
              return (
                <div key={team.id} className={`bg-slate-800 rounded-xl border p-3 transition-all ${isLeading && auctionState.isLive ? 'border-green-500/50 bg-green-500/5' : 'border-slate-700'}`}>
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{team.logo}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{team.name}</p>
                      <p className="text-xs text-slate-400">{fmt(team.budget - team.spent)} left</p>
                    </div>
                    {isLeading && auctionState.isLive && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Admin queue */}
          {isAdmin && (
            <div className="mt-4">
              <h3 className="font-medium mb-2 text-sm text-slate-400">Queue ({unsoldPlayers.length})</h3>
              <div className="space-y-1 max-h-48 overflow-y-auto">
                {unsoldPlayers.map(p => (
                  <button
                    key={p.id}
                    onClick={() => startAuction(p.id)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-sm transition-colors ${p.id === auctionState.currentPlayerId ? 'bg-blue-600 text-white' : 'bg-slate-800 hover:bg-slate-700 text-slate-300'}`}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── FIXED BOTTOM BAR (mobile only) — Owner bid buttons ── */}
      {isOwner && auctionState.isLive && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur border-t border-slate-700 p-4">
          <p className="text-xs text-slate-400 mb-2 text-center">Place Bid — Current: <span className="text-green-400 font-bold">{fmt(auctionState.currentBid)}</span></p>
          <div className="grid grid-cols-4 gap-2">
            {BID_INCREMENTS.map(inc => (
              <button
                key={inc}
                onClick={() => handleBid(inc)}
                className="min-h-[48px] bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl text-white text-xs font-bold transition-all"
              >
                +{fmt(inc)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── FIXED BOTTOM BAR (mobile only) — Admin sold/unsold + team bid ── */}
      {isAdmin && auctionState.isLive && (
        <div className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-slate-900/95 backdrop-blur border-t border-slate-700 p-4 space-y-3">
          {/* Team selector */}
          <div>
            <p className="text-xs text-slate-400 mb-2">Bid on behalf of</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {teams.map(t => (
                <button
                  key={t.id}
                  onClick={() => setSelectedTeamId(t.id)}
                  className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
                    selectedTeamId === t.id
                      ? 'bg-blue-600 border-blue-500 text-white'
                      : 'bg-slate-700 border-slate-600 text-slate-300'
                  }`}
                >
                  {t.logo} {t.name}
                </button>
              ))}
            </div>
          </div>
          {/* Bid increments (only when team selected) */}
          {selectedTeamId && (
            <div className="grid grid-cols-4 gap-2">
              {BID_INCREMENTS.map(inc => (
                <button
                  key={inc}
                  onClick={() => handleBid(inc)}
                  className="min-h-[44px] bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl text-white text-xs font-bold transition-all"
                >
                  +{fmt(inc)}
                </button>
              ))}
            </div>
          )}
          {/* Sold / Unsold */}
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={handleSold}
              className="min-h-[48px] bg-green-600 hover:bg-green-700 active:scale-95 rounded-xl text-white font-bold flex items-center justify-center gap-2 transition-all"
            >
              <CheckCircle size={18} /> Sold
            </button>
            <button
              onClick={handleUnsold}
              className="min-h-[48px] bg-red-600 hover:bg-red-700 active:scale-95 rounded-xl text-white font-bold flex items-center justify-center gap-2 transition-all"
            >
              <XCircle size={18} /> Unsold
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
