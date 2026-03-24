import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuction } from '../context/AuctionContext'
import { useAuth } from '../context/AuthContext'
import { useSettings } from '../context/SettingsContext'
import {
  Play, Square, CheckCircle, XCircle, ArrowLeft,
  Gavel, Send, MessageSquare, Users, Shuffle, RefreshCw
} from 'lucide-react'
import toast from 'react-hot-toast'
import { QUICK_EMOJIS, PLAYER_MESSAGES, OWNER_MESSAGES, ADMIN_MESSAGES } from '../constants/chatSuggestions'

const fmt = (n) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${(n || 0).toLocaleString()}`

export default function AuctionRoomPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { auctions, liveStates, bids, chats, startAuction, stopAuction, nextPlayer, placeBid, soldPlayer, markUnsold, sendMessage, loadAuctionRoom, subscribeToAuction } = useAuction()
  const { user } = useAuth()
  const { settings } = useSettings()

  const [selectedTeamId, setSelectedTeamId] = useState(null)
  const [chatMsg, setChatMsg] = useState('')
  const [tab, setTab] = useState('auction')
  const [timer, setTimer] = useState(0)
  const [spinning, setSpinning] = useState(false)
  const [spinPlayer, setSpinPlayer] = useState(null)
  const [biddingTeamId, setBiddingTeamId] = useState(null)
  const [refreshing, setRefreshing] = useState(false)
  const [floatingEmojis, setFloatingEmojis] = useState([])
  const [rightTab, setRightTab] = useState('teams')
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const emojiId = useRef(0)
  const chatBottomRef = useRef()
  const chatScrollRef = useRef()

  const auction = useMemo(() => auctions.find(a => a.id === Number(id)), [auctions, id])
  const liveState = liveStates[id] ?? {}

  const auctionPlayers = useMemo(() => auction?.players ?? [], [auction?.players])
  const auctionTeams = useMemo(() => auction?.teams ?? [], [auction?.teams])
  const unsoldPlayers = useMemo(() => auctionPlayers.filter(p => p.pivot?.status === 'pending'), [auctionPlayers])
  const soldPlayers = useMemo(() => auctionPlayers.filter(p => p.pivot?.status === 'sold'), [auctionPlayers])
  const currentPlayer = useMemo(() => auctionPlayers.find(p => p.id === liveState.current_player_id), [auctionPlayers, liveState.current_player_id])
  const leadingTeam = useMemo(() => auctionTeams.find(t => t.id === liveState.current_highest_bidder_id), [auctionTeams, liveState.current_highest_bidder_id])

  // next_bid comes directly from server — no frontend computation needed
  const nextBid = Number(liveState.next_bid ?? 0)
  const smartIncrement = nextBid > Number(liveState.current_bid ?? 0)
    ? nextBid - Number(liveState.current_bid ?? 0)
    : Number(settings.bid_increment_fixed ?? settings.bid_increment_tiers?.toString().split(',')[0] ?? 100)

  const isAdmin = user?.role === 'admin'
  const isOwner = user?.role === 'owner'
  const isPlayer = user?.role === 'player'
  const chatSuggestions = isPlayer ? PLAYER_MESSAGES : OWNER_MESSAGES
  const soldCount = soldPlayers.length
  const timerPct = (timer / (auction?.bid_timer || 1)) * 100
  const timerColor = timer <= 5 ? 'text-red-400' : timer <= 10 ? 'text-yellow-400' : 'text-green-400'
  const timerRingColor = timer <= 5 ? '#ef4444' : timer <= 10 ? '#eab308' : '#22c55e'

  useEffect(() => {
    loadAuctionRoom(id)
    const unsub = subscribeToAuction(id)
    return () => unsub?.()
  }, [id])

  useEffect(() => {
    if (showScrollBtn) return
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chats[id]?.length])

  useEffect(() => {
    if (!liveState.is_live || !liveState.timer_started_at) {
      setTimer(0)
      return
    }
    const calc = () => {
      const elapsed = Math.floor((Date.now() - new Date(liveState.timer_started_at).getTime()) / 1000)
      const remaining = Math.max(0, (liveState.timer_seconds ?? auction?.bid_timer ?? 30) - elapsed)
      setTimer(remaining)
    }
    calc()
    const interval = setInterval(calc, 1000)
    return () => clearInterval(interval)
  }, [liveState.is_live, liveState.timer_started_at, liveState.timer_seconds, auction?.bid_timer])

  const handleRefresh = async () => {
    setRefreshing(true)
    try {
      await loadAuctionRoom(id)
    } catch {
      toast.error('Failed to refresh')
    } finally {
      setRefreshing(false)
    }
  }

  const handleSpin = () => {
    const pool = auctionPlayers.filter(p => p.pivot?.status === 'pending')
    if (pool.length === 0) return toast.error('No players left to spin')
    const picked = pool[Math.floor(Math.random() * pool.length)]
    setSpinning(true)
    setSpinPlayer(null)
    let i = 0
    const fast = setInterval(() => { setSpinPlayer(pool[i++ % pool.length]) }, 80)
    const slowTimer = setTimeout(() => {
      clearInterval(fast)
      let j = 0
      const slow = setInterval(() => {
        setSpinPlayer(pool[j++ % pool.length])
        if (j >= pool.length + 3) {
          clearInterval(slow)
          setSpinPlayer(null)
          setSpinning(false)
          nextPlayer(auction.id, picked.id)
        }
      }, 180)
    }, 1200)
    return () => { clearInterval(fast); clearTimeout(slowTimer) }
  }

  const liveStateRef = useRef(liveState)
  useEffect(() => { liveStateRef.current = liveState }, [liveState])

  const handleBid = useCallback(async (teamId) => {
    const state = liveStateRef.current
    if (!state.is_live) return toast.error('Auction not live')
    if (!state.current_player_id) return toast.error('No player up for bidding')
    const bidTeamId = teamId ?? (isAdmin ? selectedTeamId : user?.team_id)
    if (!bidTeamId) return toast.error(isAdmin ? 'Click a team card to bid' : 'No team assigned')
    if (bidTeamId === state.current_highest_bidder_id) return toast.error('This team is already the highest bidder!')
    const bidTeam = auctionTeams.find(t => t.id === bidTeamId)
    if (!bidTeam) return toast.error('Team not found')
    const amount = Number(state.next_bid ?? 0)
    if (!amount) return toast.error('Next bid amount not available, please refresh')
    const budgetRemaining = Number(bidTeam.pivot?.budget_remaining ?? 0)
    if (amount > budgetRemaining) return toast.error(`Insufficient budget for ${bidTeam.name}!`)
    setBiddingTeamId(bidTeamId)
    try {
      await placeBid(auction.id, bidTeamId, amount)
      toast.success(`${bidTeam.name} → ${fmt(amount)}`)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to place bid')
    } finally {
      setBiddingTeamId(null)
    }
  }, [auctionTeams, isAdmin, user, auction, placeBid, selectedTeamId])

  const handleSold = useCallback(async () => {
    if (!liveState.current_highest_bidder_id) return toast.error('No bids placed yet')
    try {
      await soldPlayer(auction.id)
      toast.success(`${currentPlayer?.name} sold to ${leadingTeam?.name} for ${fmt(liveState.current_bid)}!`)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to mark sold')
    }
  }, [liveState, currentPlayer, leadingTeam, soldPlayer, auction])

  const handleUnsold = useCallback(async () => {
    try {
      await markUnsold(auction.id)
      toast('Player marked as unsold')
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to mark unsold')
    }
  }, [markUnsold, auction])

  const handleSendChat = useCallback((e) => {
    e.preventDefault()
    if (!chatMsg.trim()) return
    sendMessage(auction.id, chatMsg.trim())
    setChatMsg('')
  }, [chatMsg, sendMessage, auction?.id])

  const spawnFloating = (emoji) => {
    const fid = emojiId.current++
    const left = 10 + Math.random() * 80
    setFloatingEmojis(prev => [...prev, { id: fid, emoji, left }])
    setTimeout(() => setFloatingEmojis(prev => prev.filter(e => e.id !== fid)), 2000)
  }

  const handleQuickChat = useCallback((text) => sendMessage(auction?.id, text), [sendMessage, auction?.id])
  const handleEmojiChat = useCallback((emoji) => { spawnFloating(emoji); sendMessage(auction?.id, emoji) }, [sendMessage, auction?.id])

  const handleChatScroll = (e) => {
    const el = e.currentTarget
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 80)
  }

  const scrollToBottom = () => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    setShowScrollBtn(false)
  }

  if (!auctions.length) return (
    <div className="h-full flex flex-col gap-4 animate-pulse">
      <div className="h-20 bg-slate-800 rounded-xl" />
      <div className="flex gap-4 flex-1">
        <div className="flex flex-col items-center gap-4 w-64 shrink-0">
          <div className="w-24 h-24 rounded-full bg-slate-800" />
          <div className="w-32 h-4 bg-slate-800 rounded-full" />
          <div className="w-20 h-3 bg-slate-800 rounded-full" />
          <div className="grid grid-cols-3 gap-3 w-full">
            {[1,2,3].map(i => <div key={i} className="h-14 bg-slate-800 rounded-xl" />)}
          </div>
        </div>
        <div className="flex-1 space-y-2">
          {[1,2,3,4,5].map(i => <div key={i} className="h-12 bg-slate-800 rounded-xl" />)}
        </div>
      </div>
    </div>
  )

  if (!auction) return (
    <div className="flex flex-col items-center justify-center h-64 gap-4">
      <p className="text-slate-400">Auction not found</p>
      <button onClick={() => navigate('/auctions')} className="text-blue-400 text-sm underline">← Back to Auctions</button>
    </div>
  )

  const TABS = [
    { key: 'auction', label: 'Auction', icon: Gavel },
    { key: 'teams',   label: 'Teams',   icon: Users },
    { key: 'chat',    label: 'Chat',    icon: MessageSquare },
  ]

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-slate-950 -m-4 lg:-m-6">

      {/* ══ HEADER BAR ══ */}
      <header className="shrink-0 flex items-center gap-3 px-4 py-2.5 bg-slate-900/90 backdrop-blur border-b border-slate-800 z-10">
        <button onClick={() => navigate('/auctions')} className="w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center text-slate-400 transition-colors shrink-0">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <h1 className="text-base font-bold truncate leading-tight">{auction.name}</h1>
          <div className="flex items-center gap-2 mt-0.5">
            {liveState.is_live
              ? <span className="flex items-center gap-1 bg-red-600/20 border border-red-500/30 text-red-400 text-xs font-bold px-2 py-0.5 rounded-full"><span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse inline-block" /> LIVE</span>
              : <span className="text-xs text-slate-500 capitalize">{auction.status}</span>
            }
            <span className="text-xs text-slate-500">{soldCount}/{auctionPlayers.length} sold</span>
          </div>
        </div>
        {isAdmin && (
          <div className="shrink-0 flex items-center gap-2">
            <button onClick={handleRefresh} disabled={refreshing} className="w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center text-slate-400 transition-colors">
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
            {!liveState.is_live
              ? <button onClick={() => unsoldPlayers[0] ? startAuction(auction.id) : toast.error('No unsold players')} className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-white text-xs font-semibold transition-colors"><Play size={13} /> Start</button>
              : <button onClick={() => stopAuction(auction.id)} className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-white text-xs font-semibold transition-colors"><Square size={13} /> Stop</button>
            }
          </div>
        )}
        {!isAdmin && (
          <button onClick={handleRefresh} disabled={refreshing} className="shrink-0 w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center text-slate-400 transition-colors">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        )}
      </header>

      {/* ══ MOBILE TAB BAR ══ */}
      <nav className="lg:hidden shrink-0 flex bg-slate-900 border-b border-slate-800">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold transition-all border-b-2 ${
              tab === t.key ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500'
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </nav>

      {/* ══ MAIN 3-COLUMN GRID ══ */}
      <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">

        {/* ── COL 1 + COL 2: Auction content ── */}
        <div className={`flex-1 overflow-y-auto flex flex-col ${
          tab === 'auction' ? 'flex' : 'hidden lg:flex lg:flex-col'
        }`}>

          {/* ══ PHASE 2: LIVE BID BANNER ══ */}
          <div className={`shrink-0 flex items-center gap-3 px-4 py-3 border-b border-slate-800 transition-colors ${
            timer <= 5 ? 'bg-red-950/60' : timer <= 10 ? 'bg-yellow-950/40' : 'bg-slate-900'
          }`}>
            {/* Bid amount */}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Current Bid</p>
              <p className={`text-3xl font-black tabular-nums leading-none mt-0.5 ${
                timer <= 5 ? 'text-red-400' : 'text-green-400'
              }`}>{fmt(liveState.current_bid ?? 0)}</p>
              <div className="flex items-center gap-1.5 mt-1">
                {leadingTeam ? (
                  <>
                    <span className="text-yellow-400 text-xs">🏆</span>
                    <span className="text-xs text-slate-300 font-medium truncate">{leadingTeam.logo} {leadingTeam.name}</span>
                  </>
                ) : (
                  <span className="text-xs text-slate-600">No bids yet</span>
                )}
              </div>
            </div>

            {/* Divider */}
            <div className="w-px h-12 bg-slate-800" />

            {/* Next bid */}
            {liveState.is_live && (
              <div className="text-center shrink-0">
                <p className="text-xs text-slate-500 uppercase tracking-widest font-semibold">Next Bid</p>
                <p className="text-lg font-bold text-blue-400 tabular-nums">{fmt(nextBid)}</p>
                <p className="text-xs text-slate-600">+{fmt(smartIncrement)}</p>
              </div>
            )}

            {/* Divider */}
            <div className="w-px h-12 bg-slate-800" />

            {/* Circular countdown */}
            <div className="relative w-14 h-14 shrink-0">
              <svg className="w-14 h-14 -rotate-90" viewBox="0 0 56 56">
                <circle cx="28" cy="28" r="24" fill="none" stroke="#1e293b" strokeWidth="4" />
                <circle
                  cx="28" cy="28" r="24" fill="none"
                  stroke={timerRingColor} strokeWidth="4"
                  strokeDasharray={`${2 * Math.PI * 24}`}
                  strokeDashoffset={`${2 * Math.PI * 24 * (1 - timerPct / 100)}`}
                  strokeLinecap="round"
                  className="transition-all duration-1000"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className={`text-base font-black tabular-nums leading-none ${timerColor}`}>{timer}</span>
                <span className="text-slate-600" style={{ fontSize: '9px' }}>SEC</span>
              </div>
            </div>
          </div>

          {/* ══ PHASE 3: PLAYER SPOTLIGHT ══ */}
          <div className="flex-1 flex flex-col lg:flex-row gap-0 min-h-0">

            {/* Spotlight card */}
            <div className="lg:w-64 xl:w-72 shrink-0 flex flex-col items-center justify-center p-4 lg:p-6 border-b lg:border-b-0 lg:border-r border-slate-800 max-h-72 lg:max-h-none overflow-hidden">
              {spinning ? (
                // ── Spinning state
                <>
                  <div className="relative mb-4">
                    <div className="w-24 h-24 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-4xl font-black text-white animate-spin shadow-lg shadow-orange-500/30">
                      {spinPlayer?.name?.[0] ?? '?'}
                    </div>
                    <div className="absolute inset-0 rounded-full border-4 border-yellow-400/40 animate-ping" />
                  </div>
                  <p className="text-lg font-bold text-yellow-400 truncate max-w-full">{spinPlayer?.name ?? '...'}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{spinPlayer?.role ?? '---'}</p>
                  <div className="mt-4 flex gap-3">
                    <div className="text-center">
                      <p className="text-xs text-slate-600 uppercase tracking-wide">Rating</p>
                      <p className="text-xl font-black text-yellow-400">{spinPlayer?.rating ?? '--'}</p>
                    </div>
                    <div className="w-px bg-slate-800" />
                    <div className="text-center">
                      <p className="text-xs text-slate-600 uppercase tracking-wide">Base</p>
                      <p className="text-xl font-black text-green-400">{spinPlayer ? fmt(spinPlayer.base_price) : '--'}</p>
                    </div>
                  </div>
                  <div className="mt-4 flex items-center gap-2 text-xs text-slate-500">
                    <Shuffle size={12} className="animate-spin" /> Spinning...
                  </div>
                </>
              ) : currentPlayer ? (
                // ── Active player
                <>
                  <div className="relative mb-4">
                    {/* Glow ring */}
                    <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-600/30 blur-md" />
                    <div className="relative w-24 h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-4xl font-black text-white shadow-xl shadow-blue-500/20">
                      {currentPlayer.name[0]}
                    </div>
                    {liveState.is_live && <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-green-500 rounded-full border-2 border-slate-950 flex items-center justify-center"><div className="w-2 h-2 bg-white rounded-full animate-pulse" /></div>}
                  </div>
                  <h2 className="text-xl font-black text-white text-center leading-tight">{currentPlayer.name}</h2>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs bg-slate-800 border border-slate-700 text-slate-400 px-2 py-0.5 rounded-full">{currentPlayer.role}</span>
                    {currentPlayer.nationality && <span className="text-xs text-slate-500">{currentPlayer.nationality}</span>}
                  </div>
                  <div className="mt-5 grid grid-cols-3 gap-3 w-full">
                    <div className="bg-slate-900 rounded-xl p-2.5 text-center border border-slate-800">
                      <p className="text-xs text-slate-600 uppercase tracking-wide">Rating</p>
                      <p className="text-2xl font-black text-yellow-400 leading-none mt-0.5">{currentPlayer.rating}</p>
                    </div>
                    <div className="bg-slate-900 rounded-xl p-2.5 text-center border border-slate-800">
                      <p className="text-xs text-slate-600 uppercase tracking-wide">Base</p>
                      <p className="text-sm font-black text-green-400 leading-none mt-1">{fmt(currentPlayer.base_price)}</p>
                    </div>
                    <div className="bg-slate-900 rounded-xl p-2.5 text-center border border-slate-800">
                      <p className="text-xs text-slate-600 uppercase tracking-wide">Sold</p>
                      <p className="text-2xl font-black text-slate-300 leading-none mt-0.5">{soldCount}</p>
                    </div>
                  </div>
                  {isAdmin && liveState.is_live && (
                    <button onClick={handleSpin} className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-purple-600/20 hover:bg-purple-600 border border-purple-500/30 hover:border-purple-500 rounded-xl text-purple-400 hover:text-white text-sm font-bold transition-all">
                      <Shuffle size={14} /> Spin Next
                    </button>
                  )}
                </>
              ) : (
                // ── Empty state
                <>
                  <div className="w-24 h-24 rounded-full bg-slate-800 border-2 border-dashed border-slate-700 flex items-center justify-center mb-4">
                    <Gavel size={32} className="text-slate-700" />
                  </div>
                  <p className="text-slate-500 text-sm font-medium">{liveState.is_live ? 'Spin a player' : 'Auction not started'}</p>
                  <p className="text-slate-700 text-xs mt-1">{liveState.is_live ? 'Click below to begin' : 'Admin will start soon'}</p>
                  {isAdmin && liveState.is_live && (
                    <button onClick={handleSpin} className="mt-4 w-full flex items-center justify-center gap-2 py-2.5 bg-purple-600 hover:bg-purple-700 rounded-xl text-white text-sm font-bold transition-all">
                      <Shuffle size={14} /> Spin Player
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Bid History */}
            <div className="flex-1 flex flex-col min-h-0 p-4">
              <p className="text-xs text-slate-600 uppercase tracking-widest font-semibold mb-3">Bid History</p>
              {(bids[id] ?? []).length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                  <p className="text-slate-700 text-sm">No bids yet</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto space-y-1.5 min-h-0">
                  {(bids[id] ?? []).slice(0, 12).map((bid, i) => {
                    const team = auctionTeams.find(t => t.id === bid.team_id)
                    const bidPlayer = auctionPlayers.find(p => p.id === bid.player_id)
                    return (
                      <div key={bid.id} className={`flex items-center justify-between py-2 px-3 rounded-xl transition-all ${
                        i === 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-slate-900/60 border border-slate-800'
                      }`}>
                        <div className="flex items-center gap-2 min-w-0">
                          {i === 0 && <span className="text-green-400 text-xs">🏆</span>}
                          <div className="min-w-0">
                            <p className="text-sm font-semibold truncate">{team?.logo} {team?.name ?? 'Unknown'}</p>
                            {bidPlayer && <p className="text-xs text-slate-600 truncate">{bidPlayer.name}</p>}
                          </div>
                        </div>
                        <span className={`text-sm font-black tabular-nums shrink-0 ml-2 ${
                          i === 0 ? 'text-green-400' : 'text-slate-400'
                        }`}>{fmt(bid.amount)}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>

          </div>

          {/* ══ PHASE 4: BID ZONE ══ */}
          <div className="shrink-0 border-t border-slate-800 bg-slate-900 pb-safe">

            {/* Player queue strip */}
            <div className="px-4 py-2.5 border-b border-slate-800">
              <div className="flex items-center gap-2 mb-2">
                <Users size={12} className="text-slate-600" />
                <span className="text-xs text-slate-600 uppercase tracking-widest font-semibold">Queue — {unsoldPlayers.length} remaining</span>
              </div>
              {unsoldPlayers.length === 0 ? (
                <p className="text-xs text-slate-700 py-1">All players processed</p>
              ) : (
                <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                  {unsoldPlayers.map(p => (
                    <button
                      key={p.id}
                      onClick={() => isAdmin && nextPlayer(auction.id, p.id)}
                      className={`shrink-0 flex items-center gap-1.5 px-2.5 py-2 min-h-[44px] rounded-lg border text-xs font-medium transition-all ${
                        p.id === liveState.current_player_id
                          ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                          : isAdmin
                            ? 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300 cursor-pointer'
                            : 'bg-slate-800 border-slate-700 text-slate-500 cursor-default'
                      }`}
                    >
                      <span className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-xs font-bold shrink-0">{p.name[0]}</span>
                      <span className="truncate max-w-[56px]">{p.name.split(' ')[0]}</span>
                      <span className="text-yellow-500 shrink-0">★{p.rating}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Action dock — Admin */}
            {isAdmin && liveState.is_live && (
              <div className="px-4 py-3 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600 uppercase tracking-widest font-semibold">Bid for team</span>
                  <span className="text-xs text-blue-400 font-semibold">+{fmt(smartIncrement)} per bid</span>
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {auctionTeams.map(t => {
                    const isLeading = t.id === liveState.current_highest_bidder_id
                    const isBidding = t.id === biddingTeamId
                    const budgetLeft = Number(t.pivot?.budget_remaining ?? 0)
                    const nobudget = nextBid > budgetLeft
                    return (
                      <button
                        key={t.id}
                        onClick={() => handleBid(t.id)}
                        disabled={isLeading || isBidding || nobudget || !liveState.current_player_id}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
                          isLeading ? 'bg-green-500/10 border-green-500/30 text-green-400 cursor-default' :
                          isBidding ? 'bg-blue-500/20 border-blue-500/40 text-blue-300 cursor-wait' :
                          nobudget ? 'bg-slate-800/50 border-slate-800 text-slate-600 cursor-not-allowed' :
                          'bg-slate-800 border-slate-700 text-slate-300 hover:bg-blue-600 hover:border-blue-500 hover:text-white cursor-pointer'
                        }`}
                      >
                        <span className="text-base leading-none">{t.logo}</span>
                        <span className="truncate flex-1 text-left">{t.name}</span>
                        <span className="shrink-0 opacity-60 text-xs">
                          {isLeading ? '🏆' : nobudget ? '💸' : fmt(budgetLeft)}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <button onClick={handleSold} className="flex items-center justify-center gap-2 py-3 min-h-[44px] bg-green-600/20 hover:bg-green-600 border border-green-500/30 hover:border-green-500 rounded-xl text-green-400 hover:text-white text-sm font-bold transition-all active:scale-95">
                    <CheckCircle size={15} /> Sold
                  </button>
                  <button onClick={handleUnsold} className="flex items-center justify-center gap-2 py-3 min-h-[44px] bg-red-600/20 hover:bg-red-600 border border-red-500/30 hover:border-red-500 rounded-xl text-red-400 hover:text-white text-sm font-bold transition-all active:scale-95">
                    <XCircle size={15} /> Unsold
                  </button>
                </div>
              </div>
            )}

            {/* Action dock — Owner */}
            {isOwner && liveState.is_live && (() => {
              const myTeam = auctionTeams.find(t => t.id === user?.team_id)
              const isLeading = user?.team_id === liveState.current_highest_bidder_id
              const myBudget = Number(myTeam?.pivot?.budget_remaining ?? 0)
              const nobudget = myTeam && (nextBid > myBudget)
              return (
                <div className="px-4 py-3">
                  <button
                    onClick={() => handleBid(user?.team_id)}
                    disabled={isLeading || nobudget || !liveState.current_player_id || !!biddingTeamId}
                    className={`w-full py-3.5 min-h-[48px] rounded-xl text-sm font-black flex items-center justify-center gap-2.5 transition-all active:scale-95 ${
                      isLeading ? 'bg-green-500/10 border border-green-500/30 text-green-400 cursor-default' :
                      nobudget ? 'bg-slate-800 border border-slate-700 text-slate-600 cursor-not-allowed' :
                      biddingTeamId ? 'bg-blue-500/20 border border-blue-500/30 text-blue-300 cursor-wait' :
                      'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
                    }`}
                  >
                    <Gavel size={16} />
                    {isLeading ? '🏆 Your team is leading' : nobudget ? '💸 Insufficient budget' : `Place Bid — ${fmt(nextBid)}`}
                  </button>
                  {myTeam && (
                    <p className="text-center text-xs text-slate-600 mt-1.5">
                      Budget left: <span className="text-slate-400 font-semibold">{fmt(myBudget)}</span>
                    </p>
                  )}
                </div>
              )
            })()}

            {/* Sold players mini-log */}
            {soldCount > 0 && (
              <div className="px-4 pb-3 border-t border-slate-800 pt-2.5">
                <p className="text-xs text-slate-600 uppercase tracking-widest font-semibold mb-2">Sold ({soldCount})</p>
                <div className="flex gap-1.5 overflow-x-auto pb-0.5">
                  {soldPlayers.map(p => {
                    const team = auctionTeams.find(t => t.id === p.pivot?.sold_to_team_id)
                    return (
                      <div key={p.id} className="shrink-0 flex items-center gap-1.5 px-2.5 py-1.5 bg-green-500/5 border border-green-500/10 rounded-lg">
                        <span className="text-xs font-semibold text-slate-300 truncate max-w-[60px]">{p.name.split(' ')[0]}</span>
                        <span className="text-xs text-slate-600">→</span>
                        <span className="text-xs">{team?.logo}</span>
                        <span className="text-xs font-bold text-green-400">{fmt(p.pivot?.sold_price)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

          </div>
        </div>

        {/* ── COL 3: Teams + Chat ── */}
        <div className={`lg:w-72 xl:w-80 shrink-0 flex flex-col border-l border-slate-800 overflow-hidden ${
          tab === 'teams' || tab === 'chat' ? 'flex flex-1' : 'hidden lg:flex'
        }`}>

          {/* Right sub-tab bar (desktop only — on mobile the top nav handles teams/chat) */}
          <div className="hidden lg:flex shrink-0 border-b border-slate-800">
            {[{ key: 'teams', label: 'Teams' }, { key: 'chat', label: 'Chat' }].map(t => (
              <button
                key={t.key}
                onClick={() => setRightTab(t.key)}
                className={`flex-1 py-2 text-xs font-semibold transition-all border-b-2 ${
                  rightTab === t.key ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-400'
                }`}
              >{t.label}</button>
            ))}
          </div>

          {/* Teams Budget panel */}
          <div className={`flex-1 overflow-y-auto p-3 ${
            (tab === 'teams' || rightTab === 'teams') ? 'flex flex-col' : 'hidden lg:hidden'
          } ${ tab === 'chat' ? 'hidden' : '' }`}>
            {isAdmin && liveState.is_live && (
              <p className="text-xs text-blue-400 mb-2">Click a team to bid +{fmt(smartIncrement)}</p>
            )}
            <div className="space-y-2">
              {auctionTeams.map(team => {
                const budgetRemaining = Number(team.pivot?.budget_remaining ?? auction.budget_per_team ?? 0)
                const spent = Number(auction.budget_per_team ?? 0) - budgetRemaining
                const pct = auction.budget_per_team ? Math.round((spent / auction.budget_per_team) * 100) : 0
                const isLeading = team.id === liveState.current_highest_bidder_id
                const isBidding = team.id === biddingTeamId
                const canClickBid = isAdmin && liveState.is_live && !isLeading && liveState.current_player_id
                const nobudget = nextBid > budgetRemaining
                return (
                  <div
                    key={team.id}
                    onClick={() => canClickBid && !nobudget && handleBid(team.id)}
                    className={`p-2.5 rounded-xl border transition-all ${
                      isLeading && liveState.is_live ? 'bg-green-500/10 border-green-500/20' :
                      isBidding ? 'bg-blue-500/10 border-blue-500/20' :
                      canClickBid && !nobudget ? 'bg-slate-900 border-slate-800 hover:border-blue-500/40 hover:bg-slate-800 cursor-pointer' :
                      'bg-slate-900 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className="text-base leading-none">{team.logo}</span>
                      <span className="text-sm font-semibold flex-1 truncate">{team.name}</span>
                      {isLeading && liveState.is_live && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shrink-0" />}
                      {isBidding && <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping shrink-0" />}
                    </div>
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${
                        pct > 75 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-500' : 'bg-blue-500'
                      }`} style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex justify-between mt-1.5">
                      <span className="text-xs text-slate-600">{fmt(spent)} spent</span>
                      <span className={`text-xs font-semibold ${
                        budgetRemaining < (auction.budget_per_team ?? 0) * 0.2 ? 'text-red-400' : 'text-slate-400'
                      }`}>{fmt(budgetRemaining)}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Chat panel */}
          <div className={`flex-1 flex flex-col min-h-0 relative ${
            (tab === 'chat' || rightTab === 'chat') ? 'flex' : 'hidden'
          } ${ tab === 'teams' ? 'hidden' : '' }`}>
            {/* Floating emojis */}
            {floatingEmojis.map(fe => (
              <div key={fe.id} className="absolute bottom-20 text-2xl pointer-events-none z-20" style={{ left: `${fe.left}%`, animation: 'floatUp 2s ease-out forwards' }}>{fe.emoji}</div>
            ))}
            {/* Messages */}
            <div
              ref={chatScrollRef}
              onScroll={handleChatScroll}
              className="flex-1 overflow-y-auto px-2 py-2 space-y-1 min-h-0"
            >
              {(chats[id] ?? []).length === 0 ? (
                <p className="text-slate-600 text-xs text-center py-8">No messages yet 🎉</p>
              ) : (
                (chats[id] ?? []).map(m => {
                  const isMe = m.user_id === user?.id
                  const role = m.user?.role ?? 'player'
                  const isEmoji = [...(m.message ?? '')].length === 1 && /\p{Emoji}/u.test(m.message)
                  const nameColor = role === 'admin' ? 'text-red-400' : role === 'owner' ? 'text-yellow-400' : 'text-blue-400'
                  const badge = role === 'admin' ? '👑' : role === 'owner' ? '🏟️' : '🏏'
                  return (
                    <div key={m.id} className={`flex items-end gap-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                      {!isMe && <div className="w-5 h-5 rounded-full bg-slate-700 flex items-center justify-center text-xs shrink-0">{m.user?.name?.[0] ?? '?'}</div>}
                      <div className={`max-w-[85%] flex flex-col gap-0.5 ${isMe ? 'items-end' : 'items-start'}`}>
                        {!isMe && <span className={`text-xs font-semibold px-0.5 ${nameColor}`}>{badge} {m.user?.name ?? 'Unknown'}</span>}
                        {isEmoji ? (
                          <span className="text-2xl leading-none px-0.5">{m.message}</span>
                        ) : (
                          <div className={`px-2.5 py-1.5 rounded-2xl text-xs leading-snug ${
                            isMe ? 'bg-blue-600/90 text-white rounded-br-sm' :
                            role === 'admin' ? 'bg-red-500/20 border border-red-500/20 text-white rounded-bl-sm' :
                            role === 'owner' ? 'bg-yellow-500/10 border border-yellow-500/20 text-white rounded-bl-sm' :
                            'bg-slate-700/80 text-white rounded-bl-sm'
                          }`}>{m.message}</div>
                        )}
                      </div>
                    </div>
                  )
                })
              )}
              <div ref={chatBottomRef} />
            </div>
            {/* Scroll-to-bottom button */}
            {showScrollBtn && (
              <button
                onClick={scrollToBottom}
                className="absolute bottom-[calc(100%-2.5rem)] left-1/2 -translate-x-1/2 z-10 flex items-center gap-1 px-3 py-1 bg-blue-600/90 hover:bg-blue-600 rounded-full text-white text-xs font-semibold shadow-lg backdrop-blur transition-all"
              >↓ New messages</button>
            )}
            {/* Controls */}
            <div className="border-t border-slate-700/60 bg-slate-900/70 backdrop-blur shrink-0">
              {(isOwner || isPlayer) && (
                <div className="px-2 pt-2 pb-2 space-y-2">
                  <div className="flex justify-between px-1">
                    {QUICK_EMOJIS.map(e => (
                      <button key={e} onClick={() => handleEmojiChat(e)} className="active:scale-75 transition-transform duration-100">
                        <span className="text-xl leading-none drop-shadow-lg">{e}</span>
                      </button>
                    ))}
                  </div>
                  <div className="h-px bg-slate-700/60" />
                  <div className="flex flex-wrap gap-1.5 px-1">
                    {chatSuggestions.map(s => (
                      <button key={s} onClick={() => handleQuickChat(s)} className="px-2.5 py-1 bg-slate-700/80 hover:bg-blue-600 border border-slate-600 hover:border-blue-500 active:scale-95 rounded-full text-xs text-slate-300 hover:text-white transition-all font-medium">{s}</button>
                    ))}
                  </div>
                </div>
              )}
              {isAdmin && (
                <div className="px-2 pt-2 pb-1 space-y-1.5">
                  <div className="flex justify-between px-1">
                    {QUICK_EMOJIS.map(e => (
                      <button key={e} onClick={() => handleEmojiChat(e)} className="active:scale-75 transition-transform duration-100">
                        <span className="text-xl leading-none drop-shadow-lg">{e}</span>
                      </button>
                    ))}
                  </div>
                  <div className="h-px bg-slate-700/60" />
                  <div className="flex flex-wrap gap-1">
                    {ADMIN_MESSAGES.map(s => (
                      <button key={s} onClick={() => handleQuickChat(s)} className="px-2 py-1 bg-slate-800 hover:bg-red-600/70 border border-slate-700 hover:border-red-500/40 active:scale-95 rounded-full text-xs text-slate-400 hover:text-white transition-all">{s}</button>
                    ))}
                  </div>
                  <form onSubmit={handleSendChat} className="flex gap-2 pb-1">
                    <input value={chatMsg} onChange={e => setChatMsg(e.target.value)} placeholder="Message..." className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                    <button type="submit" className="w-8 h-8 bg-red-600 hover:bg-red-700 active:scale-95 rounded-xl flex items-center justify-center text-white transition-all shrink-0"><Send size={13} /></button>
                  </form>
                </div>
              )}
            </div>
          </div>
          <style>{`@keyframes floatUp{0%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(-100px) scale(1.5);opacity:0}}`}</style>
        </div>

      </div>{/* end 3-col grid */}

    </div>
  )
}

