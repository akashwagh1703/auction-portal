import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuction } from '../context/AuctionContext'
import { useAuth } from '../context/AuthContext'
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
  const { auctions, liveStates, bids, chats, startAuction, stopAuction, nextPlayer, placeBid, soldPlayer, markUnsold, reAuction, sendMessage, loadAuctionRoom, subscribeToAuction, setLiveStates } = useAuction()
  const { user } = useAuth()
  // settings not needed for bid logic — all bid amounts come from server via liveState.next_bid

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
  const [soldTeamTab, setSoldTeamTab] = useState(null)
  const [historyTab, setHistoryTab] = useState('history')
  const [confirm, setConfirm] = useState(null) // { type: 'sold' | 'unsold' }
  const [celebration, setCelebration] = useState(null) // { playerName, teamName, teamLogo, amount }
  const [spinReveal, setSpinReveal] = useState(null) // player object shown in reveal burst
  const emojiId = useRef(0)
  const chatBottomRef = useRef()
  const chatScrollRef = useRef()

  const auction = useMemo(() => auctions.find(a => a.id === Number(id)), [auctions, id])
  const liveState = liveStates[id] ?? {}

  const auctionPlayers = useMemo(() => auction?.players ?? [], [auction?.players])
  const auctionTeams = useMemo(() => auction?.teams ?? [], [auction?.teams])
  const unsoldPlayers = useMemo(() => auctionPlayers.filter(p => p.pivot?.status === 'pending'), [auctionPlayers])
  const unsoldMarkedPlayers = useMemo(() => auctionPlayers.filter(p => p.pivot?.status === 'unsold'), [auctionPlayers])
  const soldPlayers = useMemo(() => auctionPlayers.filter(p => p.pivot?.status === 'sold'), [auctionPlayers])
  const currentPlayer = useMemo(() => auctionPlayers.find(p => p.id === liveState.current_player_id), [auctionPlayers, liveState.current_player_id])
  const leadingTeam = useMemo(() => auctionTeams.find(t => t.id === liveState.current_highest_bidder_id), [auctionTeams, liveState.current_highest_bidder_id])

  // Count sold players per team for max_players_per_team enforcement
  const soldCountByTeam = useMemo(() => {
    const map = {}
    soldPlayers.forEach(p => {
      const tid = p.pivot?.sold_to_team_id
      if (tid) map[tid] = (map[tid] ?? 0) + 1
    })
    return map
  }, [soldPlayers])

  // next_bid comes directly from server — no frontend computation needed
  const nextBid = Number(liveState.next_bid ?? 0)
  const currentBid = Number(liveState.current_bid ?? 0)
  // smartIncrement is display-only: difference between next and current bid
  const smartIncrement = nextBid > 0 && nextBid > currentBid ? nextBid - currentBid : 0

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
          // Show spin reveal burst before calling nextPlayer
          setSpinReveal(picked)
          setTimeout(() => {
            setSpinReveal(null)
            nextPlayer(auction.id, picked.id)
          }, 1800)
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
    if ((bidTeamId === state.current_highest_bidder_id) || (Number(bidTeamId) === Number(state.current_highest_bidder_id)))
      return toast.error('This team is already the highest bidder!')
    const bidTeam = auctionTeams.find(t => t.id === bidTeamId)
    if (!bidTeam) return toast.error('Team not found')
    const maxPlayers = auction?.max_players_per_team ?? 0
    if (maxPlayers > 0 && (soldCountByTeam[bidTeamId] ?? 0) >= maxPlayers)
      return toast.error(`${bidTeam.name} has reached the max of ${maxPlayers} players`)
    const amount = Number(state.next_bid ?? 0)
    if (!amount) return toast.error('Next bid amount not available, please refresh')
    const budgetRemaining = Number(bidTeam.pivot?.budget_remaining ?? 0)
    if (amount > budgetRemaining) return toast.error(`Insufficient budget for ${bidTeam.name}!`)
    setBiddingTeamId(bidTeamId)
    try {
      await placeBid(auction.id, bidTeamId, amount)
      toast.success(`${bidTeam.name} → ${fmt(amount)}`)
    } catch (err) {
      const serverNextBid = err.response?.data?.next_bid
      if (serverNextBid && serverNextBid !== amount) {
        // State was stale — update liveState with correct next_bid and retry once
        setLiveStates(prev => ({
          ...prev,
          [String(auction.id)]: { ...(prev[String(auction.id)] ?? {}), next_bid: serverNextBid }
        }))
        try {
          await placeBid(auction.id, bidTeamId, serverNextBid)
          toast.success(`${bidTeam.name} → ${fmt(serverNextBid)}`)
        } catch (retryErr) {
          toast.error(retryErr.response?.data?.message ?? 'Failed to place bid')
        }
      } else {
        toast.error(err.response?.data?.message ?? 'Failed to place bid')
      }
    } finally {
      setBiddingTeamId(null)
    }
  }, [auctionTeams, isAdmin, user, auction, placeBid, selectedTeamId])

  const handleSold = useCallback(async () => {
    if (!liveState.current_highest_bidder_id) return toast.error('No bids placed yet')
    setConfirm({ type: 'sold' })
  }, [liveState])

  const handleUnsold = useCallback(async () => {
    setConfirm({ type: 'unsold' })
  }, [])

  const handleConfirm = useCallback(async () => {
    const type = confirm?.type
    const snapPlayer = currentPlayer
    const snapTeam = leadingTeam
    const snapBid = liveState.current_bid
    setConfirm(null)
    try {
      if (type === 'sold') {
        await soldPlayer(auction.id)
        toast.success(`${snapPlayer?.name} sold to ${snapTeam?.name} for ${fmt(snapBid)}!`)
        setCelebration({ playerName: snapPlayer?.name, teamName: snapTeam?.name, teamLogo: snapTeam?.logo, amount: snapBid })
        setTimeout(() => setCelebration(null), 4000)
      } else {
        await markUnsold(auction.id)
        toast(`${snapPlayer?.name} marked as unsold`)
      }
    } catch (err) {
      toast.error(err.response?.data?.message ?? `Failed to mark ${type}`)
    }
  }, [confirm, soldPlayer, markUnsold, auction, currentPlayer, leadingTeam, liveState])

  const handleReAuction = useCallback(async () => {
    try {
      await reAuction(auction.id)
      toast.success(`${unsoldMarkedPlayers.length} unsold player(s) back in queue`)
    } catch (err) {
      toast.error(err.response?.data?.message ?? 'Failed to re-auction')
    }
  }, [reAuction, auction, unsoldMarkedPlayers.length])

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
    <div className="flex flex-col bg-slate-950 -mt-16 -mx-4 -mb-4 lg:-mt-1 lg:-mx-8 lg:-mb-8" style={{ height: '100dvh' }}>

      {/* ══ SOLD CELEBRATION OVERLAY ══ */}
      {celebration && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none overflow-hidden">
          {/* Confetti particles */}
          {Array.from({ length: 40 }).map((_, i) => (
            <div
              key={i}
              className="absolute w-2 h-2 rounded-sm"
              style={{
                left: `${Math.random() * 100}%`,
                top: `-8px`,
                background: ['#22c55e','#facc15','#3b82f6','#f97316','#ec4899','#a855f7'][i % 6],
                animation: `confettiFall ${1.5 + Math.random() * 2}s ${Math.random() * 0.8}s ease-in forwards`,
                transform: `rotate(${Math.random() * 360}deg)`,
              }}
            />
          ))}
          {/* Central card */}
          <div className="relative flex flex-col items-center gap-3 px-8 py-6 rounded-3xl bg-slate-900/95 border border-green-500/40 shadow-2xl shadow-green-500/20" style={{ animation: 'celebPop 0.4s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>
            {/* Glow ring */}
            <div className="absolute inset-0 rounded-3xl" style={{ boxShadow: '0 0 60px 10px rgba(34,197,94,0.25)', animation: 'celebGlow 1s ease-in-out infinite alternate' }} />
            <div className="text-5xl" style={{ animation: 'celebBounce 0.6s ease-in-out infinite alternate' }}>🏆</div>
            <p className="text-green-400 text-xs font-black uppercase tracking-[0.3em]">SOLD!</p>
            <p className="text-white text-2xl font-black text-center leading-tight">{celebration.playerName}</p>
            <div className="flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-2xl">
              <span className="text-2xl">{celebration.teamLogo}</span>
              <span className="text-white font-bold text-sm">{celebration.teamName}</span>
            </div>
            <p className="text-green-400 text-3xl font-black tabular-nums">{fmt(celebration.amount)}</p>
          </div>
        </div>
      )}

      {/* ══ SPIN REVEAL OVERLAY ══ */}
      {spinReveal && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center pointer-events-none">
          <div className="flex flex-col items-center gap-3" style={{ animation: 'spinRevealPop 0.35s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>
            {/* Burst rays */}
            <div className="absolute w-64 h-64 rounded-full" style={{ background: 'conic-gradient(from 0deg, transparent 0deg, rgba(168,85,247,0.3) 20deg, transparent 40deg, rgba(59,130,246,0.3) 60deg, transparent 80deg, rgba(168,85,247,0.3) 100deg, transparent 120deg, rgba(59,130,246,0.3) 140deg, transparent 160deg, rgba(168,85,247,0.3) 180deg, transparent 200deg, rgba(59,130,246,0.3) 220deg, transparent 240deg, rgba(168,85,247,0.3) 260deg, transparent 280deg, rgba(59,130,246,0.3) 300deg, transparent 320deg, rgba(168,85,247,0.3) 340deg, transparent 360deg)', animation: 'spinRays 1.8s linear forwards' }} />
            <div className="relative z-10 w-28 h-28 rounded-full bg-gradient-to-br from-purple-500 to-blue-600 flex items-center justify-center text-5xl font-black text-white shadow-2xl shadow-purple-500/50" style={{ animation: 'celebBounce 0.5s ease-in-out infinite alternate' }}>
              {spinReveal.name?.[0]}
            </div>
            <div className="relative z-10 text-center px-6 py-3 bg-slate-900/90 border border-purple-500/40 rounded-2xl backdrop-blur">
              <p className="text-purple-300 text-[10px] font-black uppercase tracking-[0.3em] mb-1">SELECTED!</p>
              <p className="text-white text-xl font-black">{spinReveal.name}</p>
              <p className="text-slate-400 text-xs mt-0.5">{spinReveal.role} · ★{spinReveal.rating}</p>
            </div>
          </div>
        </div>
      )}

      {/* ══ CONFIRM MODAL ══ */}
      {confirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className={`px-5 py-4 border-b border-slate-800 flex items-center gap-3 ${
              confirm.type === 'sold' ? 'bg-green-500/10' : 'bg-red-500/10'
            }`}>
              {confirm.type === 'sold'
                ? <CheckCircle size={20} className="text-green-400 shrink-0" />
                : <XCircle size={20} className="text-red-400 shrink-0" />
              }
              <div>
                <p className="text-sm font-bold text-white">
                  {confirm.type === 'sold' ? 'Confirm Sale' : 'Mark as Unsold'}
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  {confirm.type === 'sold' ? 'This action cannot be undone' : 'Player will return to unsold list'}
                </p>
              </div>
            </div>
            {/* Player info */}
            <div className="px-5 py-4 flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-xl font-black text-white shrink-0 ${
                confirm.type === 'sold' ? 'bg-gradient-to-br from-green-500 to-emerald-600' : 'bg-gradient-to-br from-red-500 to-rose-600'
              }`}>
                {currentPlayer?.name?.[0] ?? '?'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-white truncate">{currentPlayer?.name ?? 'Unknown Player'}</p>
                <p className="text-xs text-slate-500">{currentPlayer?.role}</p>
              </div>
            </div>
            {/* Details */}
            {confirm.type === 'sold' && (
              <div className="px-5 pb-4 grid grid-cols-2 gap-2">
                <div className="bg-slate-800 rounded-xl p-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Winning Bid</p>
                  <p className="text-base font-black text-green-400 mt-0.5">{fmt(liveState.current_bid ?? 0)}</p>
                </div>
                <div className="bg-slate-800 rounded-xl p-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Sold To</p>
                  <p className="text-sm font-bold text-white mt-0.5 truncate">{leadingTeam?.logo} {leadingTeam?.name ?? '—'}</p>
                </div>
              </div>
            )}
            {confirm.type === 'unsold' && (
              <div className="px-5 pb-4">
                <div className="bg-slate-800 rounded-xl p-3">
                  <p className="text-[10px] text-slate-500 uppercase tracking-wide">Base Price</p>
                  <p className="text-base font-black text-slate-300 mt-0.5">{fmt(currentPlayer?.base_price ?? 0)}</p>
                </div>
              </div>
            )}
            {/* Actions */}
            <div className="px-5 pb-5 grid grid-cols-2 gap-2">
              <button
                onClick={() => setConfirm(null)}
                className="py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 text-sm font-semibold transition-all active:scale-95"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirm}
                className={`py-2.5 rounded-xl text-white text-sm font-bold transition-all active:scale-95 ${
                  confirm.type === 'sold'
                    ? 'bg-green-600 hover:bg-green-500'
                    : 'bg-red-600 hover:bg-red-500'
                }`}
              >
                {confirm.type === 'sold' ? '✓ Confirm Sold' : '✗ Mark Unsold'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══ HEADER BAR ══ */}
      <header className="shrink-0 flex items-center gap-2 md:gap-3 px-3 md:px-4 py-2 md:py-2.5 bg-slate-900/90 backdrop-blur border-b border-slate-800 z-10">
        <button onClick={() => navigate('/auctions')} className="w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center text-slate-400 transition-colors shrink-0">
          <ArrowLeft size={16} />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-sm md:text-base font-bold truncate leading-tight">{auction.name}</h1>
            {liveState.is_live
              ? <span className="flex items-center gap-1 bg-red-600/20 border border-red-500/30 text-red-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0"><span className="w-1.5 h-1.5 bg-red-500 rounded-full animate-pulse inline-block" /> LIVE</span>
              : <span className="text-[10px] text-slate-500 capitalize shrink-0">{auction.status}</span>
            }
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[10px] md:text-xs text-slate-500">{soldCount}/{auctionPlayers.length} sold</span>
            {unsoldMarkedPlayers.length > 0 && <span className="text-[10px] md:text-xs text-red-400">{unsoldMarkedPlayers.length} unsold</span>}
            {unsoldPlayers.length > 0 && <span className="text-[10px] md:text-xs text-slate-600">{unsoldPlayers.length} pending</span>}
          </div>
        </div>
        {isAdmin && (
          <div className="shrink-0 flex items-center gap-1.5 md:gap-2">
            <button onClick={handleRefresh} disabled={refreshing} className="w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center text-slate-400 transition-colors">
              <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
            </button>
            {!liveState.is_live
              ? <button onClick={() => unsoldPlayers[0] ? startAuction(auction.id) : toast.error('No players to auction')} className="flex items-center gap-1 md:gap-1.5 px-2.5 md:px-3 py-1.5 bg-green-600 hover:bg-green-700 rounded-lg text-white text-xs font-semibold transition-colors"><Play size={13} /> Start</button>
              : <button onClick={() => stopAuction(auction.id)} className="flex items-center gap-1 md:gap-1.5 px-2.5 md:px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded-lg text-white text-xs font-semibold transition-colors"><Square size={13} /> Stop</button>
            }
          </div>
        )}
        {!isAdmin && (
          <button onClick={handleRefresh} disabled={refreshing} className="shrink-0 w-8 h-8 bg-slate-800 hover:bg-slate-700 rounded-lg flex items-center justify-center text-slate-400 transition-colors">
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        )}
      </header>

      {/* ══ MOBILE/TABLET TAB BAR — hidden on lg+ ══ */}
      <nav className="lg:hidden shrink-0 flex bg-slate-900 border-b border-slate-800">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 md:py-2.5 text-xs font-semibold transition-all border-b-2 ${
              tab === t.key ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500'
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </nav>

      {/* ══ MAIN GRID ══ */}
      <div className="flex-1 overflow-hidden flex flex-col md:flex-row min-h-0">

        {/* ── COL 1+2: Auction content ── */}
        <div className={`flex-1 flex flex-col overflow-hidden min-h-0 ${
          tab === 'auction' ? 'flex' : 'hidden md:flex'
        }`}>

          {/* ══ BID BANNER ══ */}
          <div className={`shrink-0 flex items-center gap-2 md:gap-3 px-3 md:px-4 py-1.5 md:py-3 border-b border-slate-800 transition-colors ${
            timer <= 5 ? 'bg-red-950/60' : timer <= 10 ? 'bg-yellow-950/40' : 'bg-slate-900'
          }`}>
            {/* Current bid */}
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold hidden md:block">Current Bid</p>
              <div className="flex items-baseline gap-2">
                <p className={`text-xl md:text-3xl font-black tabular-nums leading-none ${
                  timer <= 5 ? 'text-red-400' : 'text-green-400'
                }`}>{fmt(liveState.current_bid ?? 0)}</p>
                {/* Next bid inline on mobile only */}
                {liveState.is_live && (
                  <span className="md:hidden text-xs text-blue-400 font-bold tabular-nums">→ {fmt(nextBid)}</span>
                )}
              </div>
              <div className="flex items-center gap-1.5 mt-0.5">
                {leadingTeam ? (
                  <>
                    <span className="text-yellow-400 text-[10px]">🏆</span>
                    <span className="text-[10px] md:text-xs text-slate-300 font-medium truncate">{leadingTeam.logo} {leadingTeam.name}</span>
                  </>
                ) : (
                  <span className="text-[10px] md:text-xs text-slate-600">No bids yet</span>
                )}
              </div>
            </div>

            <div className="w-px h-8 md:h-12 bg-slate-800" />

            {/* Next bid — desktop only */}
            {liveState.is_live && (
              <div className="text-center shrink-0 hidden md:block">
                <p className="text-[10px] text-slate-500 uppercase tracking-widest font-semibold">Next Bid</p>
                <p className="text-lg font-bold text-blue-400 tabular-nums">{fmt(nextBid)}</p>
                <p className="text-[10px] text-slate-600">{smartIncrement > 0 ? `+${fmt(smartIncrement)}` : ''}</p>
              </div>
            )}

            {liveState.is_live && <div className="w-px h-8 md:h-12 bg-slate-800 hidden md:block" />}

            {/* Countdown ring */}
            <div className="relative w-10 h-10 md:w-14 md:h-14 shrink-0">
              <svg className="w-10 h-10 md:w-14 md:h-14 -rotate-90" viewBox="0 0 56 56">
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
                <span className={`text-xs md:text-base font-black tabular-nums leading-none ${timerColor}`}>{timer}</span>
                <span className="text-slate-600" style={{ fontSize: '8px' }}>SEC</span>
              </div>
            </div>
          </div>

          {/* ══ MIDDLE ZONE ══ */}
          <div className="flex-1 flex flex-col md:flex-row min-h-0 overflow-hidden">

            {/* Spotlight card — horizontal strip on mobile, vertical card on md+ */}
            <div className="md:w-52 lg:w-64 xl:w-72 shrink-0 flex flex-row md:flex-col items-center md:justify-center gap-3 md:gap-0 px-3 py-2 md:p-4 lg:p-6 border-b md:border-b-0 md:border-r border-slate-800 overflow-hidden">
              {spinning ? (
                <>
                  {/* Avatar */}
                  <div className="relative shrink-0">
                    <div className="w-12 h-12 md:w-24 md:h-24 md:mb-4 rounded-full bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-xl md:text-4xl font-black text-white animate-spin shadow-lg shadow-orange-500/30">
                      {spinPlayer?.name?.[0] ?? '?'}
                    </div>
                    <div className="absolute inset-0 rounded-full border-4 border-yellow-400/40 animate-ping" />
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0 md:text-center md:w-full">
                    <p className="text-sm md:text-lg font-bold text-yellow-400 truncate">{spinPlayer?.name ?? '...'}</p>
                    <p className="text-xs text-slate-500">{spinPlayer?.role ?? '---'}</p>
                    <div className="flex gap-3 mt-1 md:justify-center">
                      <span className="text-xs text-slate-600">★ <span className="text-yellow-400 font-black">{spinPlayer?.rating ?? '--'}</span></span>
                      <span className="text-xs text-slate-600">Base <span className="text-green-400 font-black">{spinPlayer ? fmt(spinPlayer.base_price) : '--'}</span></span>
                    </div>
                    <div className="flex items-center gap-1 mt-1 text-xs text-slate-500 md:justify-center">
                      <Shuffle size={10} className="animate-spin" /> Spinning...
                    </div>
                  </div>
                </>
              ) : currentPlayer ? (
                <>
                  {/* Avatar */}
                  <div className="relative shrink-0 md:mb-4">
                    <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-blue-500/30 to-purple-600/30 blur-md" />
                    <div className="relative w-12 h-12 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-xl md:text-4xl font-black text-white shadow-xl shadow-blue-500/20">
                      {currentPlayer.name[0]}
                    </div>
                    {liveState.is_live && <div className="absolute -bottom-0.5 -right-0.5 md:-bottom-1 md:-right-1 w-3.5 h-3.5 md:w-5 md:h-5 bg-green-500 rounded-full border-2 border-slate-950 flex items-center justify-center"><div className="w-1 h-1 md:w-2 md:h-2 bg-white rounded-full animate-pulse" /></div>}
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0 md:text-center md:w-full">
                    <h2 className="text-sm md:text-xl font-black text-white leading-tight truncate md:text-center">{currentPlayer.name}</h2>
                    <div className="flex items-center gap-1.5 mt-0.5 md:justify-center flex-wrap">
                      <span className="text-xs bg-slate-800 border border-slate-700 text-slate-400 px-1.5 py-0.5 rounded-full">{currentPlayer.role}</span>
                      {currentPlayer.nationality && <span className="text-xs text-slate-500 hidden sm:inline">{currentPlayer.nationality}</span>}
                    </div>
                    {/* Stats — inline on mobile, grid on md+ */}
                    <div className="flex gap-2 mt-1.5 md:hidden">
                      <span className="text-xs text-slate-600">★ <span className="text-yellow-400 font-black">{currentPlayer.rating}</span></span>
                      <span className="text-xs text-slate-600">Base <span className="text-green-400 font-black text-[11px]">{fmt(currentPlayer.base_price)}</span></span>
                      <span className="text-xs text-slate-600">Sold <span className="text-slate-300 font-black">{soldCount}</span></span>
                    </div>
                    <div className="hidden md:grid grid-cols-3 gap-2 mt-5 w-full">
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
                      <button onClick={handleSpin} className="mt-2 md:mt-4 flex md:w-full items-center justify-center gap-1.5 px-3 py-1.5 md:py-2.5 bg-purple-600/20 hover:bg-purple-600 border border-purple-500/30 hover:border-purple-500 rounded-xl text-purple-400 hover:text-white text-xs md:text-sm font-bold transition-all">
                        <Shuffle size={12} /> <span className="hidden sm:inline">Spin Next</span><span className="sm:hidden">Spin</span>
                      </button>
                    )}
                  </div>
                </>
              ) : (
                <>
                  {/* Avatar */}
                  <div className="w-12 h-12 md:w-24 md:h-24 md:mb-4 rounded-full bg-slate-800 border-2 border-dashed border-slate-700 flex items-center justify-center shrink-0">
                    <Gavel size={20} className="text-slate-700" />
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0 md:text-center">
                    <p className="text-slate-500 text-sm font-medium">{liveState.is_live ? 'Spin a player' : 'Auction not started'}</p>
                    <p className="text-slate-700 text-xs mt-0.5">{liveState.is_live ? 'Click below to begin' : 'Admin will start soon'}</p>
                    {isAdmin && liveState.is_live && (
                      <button onClick={handleSpin} className="mt-2 md:mt-4 flex md:w-full items-center justify-center gap-1.5 px-3 py-1.5 md:py-2.5 bg-purple-600 hover:bg-purple-700 rounded-xl text-white text-xs md:text-sm font-bold transition-all">
                        <Shuffle size={12} /> Spin Player
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Bid History + Unsold + Sold — tabbed */}
            <div className="flex-1 flex flex-col min-h-0 min-w-0">

              {/* Tab bar */}
              <div className="shrink-0 flex border-b border-slate-800 px-3 md:px-4 pt-2 gap-1">
                <button
                  onClick={() => setHistoryTab('history')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-t-lg border-b-2 transition-all ${
                    historyTab === 'history' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-500 hover:text-slate-400'
                  }`}
                >
                  Bids <span className="text-[10px] px-1 py-0.5 rounded-full bg-slate-800 text-slate-500">{(bids[id] ?? []).length}</span>
                </button>
                <button
                  onClick={() => setHistoryTab('unsold')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-t-lg border-b-2 transition-all ${
                    historyTab === 'unsold' ? 'border-orange-500 text-orange-400' : 'border-transparent text-slate-500 hover:text-slate-400'
                  }`}
                >
                  Unsold <span className={`text-[10px] px-1 py-0.5 rounded-full ${ unsoldMarkedPlayers.length > 0 ? 'bg-orange-500/20 text-orange-400' : 'bg-slate-800 text-slate-500' }`}>{unsoldMarkedPlayers.length}</span>
                </button>
                <button
                  onClick={() => setHistoryTab('sold')}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-t-lg border-b-2 transition-all ${
                    historyTab === 'sold' ? 'border-green-500 text-green-400' : 'border-transparent text-slate-500 hover:text-slate-400'
                  }`}
                >
                  Sold <span className={`text-[10px] px-1 py-0.5 rounded-full ${ soldCount > 0 ? 'bg-green-500/20 text-green-400' : 'bg-slate-800 text-slate-500' }`}>{soldCount}</span>
                </button>
              </div>

              {/* ── Tab: Bid History ── */}
              {historyTab === 'history' && (
                <div className="flex-1 min-h-0 p-3 md:p-4 flex flex-col">
                  {(bids[id] ?? []).length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-slate-700 text-sm">No bids yet</p>
                    </div>
                  ) : (
                    <div className="auction-scroll flex-1 overflow-y-auto space-y-1.5 min-h-0">
                      {(bids[id] ?? []).slice(0, 20).map((bid, i) => {
                        const team = auctionTeams.find(t => t.id === bid.team_id)
                        const bidPlayer = auctionPlayers.find(p => p.id === bid.player_id)
                        return (
                          <div key={bid.id} className={`flex items-center justify-between py-1.5 md:py-2 px-2.5 md:px-3 rounded-xl transition-all ${
                            i === 0 ? 'bg-green-500/10 border border-green-500/20' : 'bg-slate-900/60 border border-slate-800'
                          }`}>
                            <div className="flex items-center gap-1.5 md:gap-2 min-w-0">
                              {i === 0 && <span className="text-green-400 text-[10px]">🏆</span>}
                              <div className="min-w-0">
                                <p className="text-xs md:text-sm font-semibold truncate">{team?.logo} {team?.name ?? 'Unknown'}</p>
                                {bidPlayer && <p className="text-[10px] md:text-xs text-slate-600 truncate">{bidPlayer.name}</p>}
                              </div>
                            </div>
                            <span className={`text-xs md:text-sm font-black tabular-nums shrink-0 ml-2 ${
                              i === 0 ? 'text-green-400' : 'text-slate-400'
                            }`}>{fmt(bid.amount)}</span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* ── Tab: Unsold ── */}
              {historyTab === 'unsold' && (
                <div className="flex-1 min-h-0 p-3 md:p-4 flex flex-col">
                  {unsoldMarkedPlayers.length === 0 ? (
                    <div className="flex-1 flex items-center justify-center">
                      <p className="text-slate-700 text-sm">No unsold players</p>
                    </div>
                  ) : (
                    <>
                      {isAdmin && (
                        <div className="shrink-0 flex justify-end mb-2">
                          <button
                            onClick={handleReAuction}
                            className="flex items-center gap-1 px-2.5 py-1.5 bg-orange-600/80 hover:bg-orange-500 border border-orange-500/40 rounded-lg text-white text-xs font-bold transition-colors active:scale-95"
                          >
                            <Shuffle size={10} /> Re-Auction All
                          </button>
                        </div>
                      )}
                      <div className="auction-scroll flex-1 overflow-y-auto space-y-1.5 min-h-0">
                        {unsoldMarkedPlayers.map(p => (
                          <div key={p.id} className="flex items-center gap-2 px-2.5 py-2 bg-red-500/5 border border-red-500/10 rounded-xl">
                            <div className="w-7 h-7 rounded-full bg-red-500/20 flex items-center justify-center text-xs font-bold text-red-400 shrink-0">{p.name[0]}</div>
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-300 truncate">{p.name}</p>
                              <p className="text-[10px] text-slate-600">{p.role}</p>
                            </div>
                            <span className="text-xs text-slate-500 shrink-0">{fmt(p.base_price)}</span>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* ── Tab: Sold ── */}
              {historyTab === 'sold' && (() => {
                const teamsWithSold = auctionTeams.filter(t => (soldCountByTeam[t.id] ?? 0) > 0)
                const activeTeamTab = soldTeamTab ?? teamsWithSold[0]?.id ?? null
                const tabPlayers = soldPlayers.filter(p => p.pivot?.sold_to_team_id === activeTeamTab)
                return (
                  <div className="flex-1 min-h-0 p-3 md:p-4 flex flex-col">
                    {teamsWithSold.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center">
                        <p className="text-slate-700 text-sm">No players sold yet</p>
                      </div>
                    ) : (
                      <>
                        {/* Team tabs */}
                        <div className="auction-scroll shrink-0 flex gap-1 overflow-x-auto pb-2">
                          {teamsWithSold.map(t => (
                            <button
                              key={t.id}
                              onClick={() => setSoldTeamTab(t.id)}
                              className={`shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-semibold transition-all border ${
                                activeTeamTab === t.id
                                  ? 'bg-green-600 border-green-500 text-white'
                                  : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600'
                              }`}
                            >
                              <span>{t.logo}</span>
                              <span className="hidden sm:inline md:hidden lg:inline">{t.name.split(' ')[0]}</span>
                              <span className={`text-[10px] px-1 rounded-full ${ activeTeamTab === t.id ? 'bg-green-500/40' : 'bg-slate-700' }`}>{soldCountByTeam[t.id]}</span>
                            </button>
                          ))}
                        </div>
                        {/* Player list */}
                        <div className="auction-scroll flex-1 overflow-y-auto space-y-1.5 min-h-0">
                          {tabPlayers.map(p => (
                            <div key={p.id} className="flex items-center gap-2 px-2.5 py-2 bg-green-500/5 border border-green-500/10 rounded-xl">
                              <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center text-xs font-bold text-green-400 shrink-0">{p.name[0]}</div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-semibold text-slate-200 truncate">{p.name}</p>
                                <p className="text-[10px] text-slate-500">{p.role}</p>
                              </div>
                              <span className="text-xs font-bold text-green-400 shrink-0">{fmt(p.pivot?.sold_price)}</span>
                            </div>
                          ))}
                        </div>
                      </>
                    )}
                  </div>
                )
              })()}

            </div>

          </div>

          {/* ══ BID ZONE — shrink-0, always pinned at bottom ══ */}
          <div className="shrink-0 border-t border-slate-800 bg-slate-900">

            {/* Player queue strip */}
            <div className="px-3 md:px-4 py-1.5 md:py-2.5 border-b border-slate-800">
              <div className="flex items-center gap-1.5 mb-1 md:mb-2">
                <Users size={11} className="text-slate-600" />
                <span className="text-[10px] md:text-xs text-slate-600 uppercase tracking-widest font-semibold">Queue <span className="normal-case">({unsoldPlayers.length})</span></span>
              </div>
              {unsoldPlayers.length === 0 ? (
                <p className="text-xs text-slate-700 py-0.5">All players processed</p>
              ) : (
                <div className="auction-scroll flex gap-1 md:gap-1.5 overflow-x-auto pb-0.5">
                  {unsoldPlayers.map(p => (
                    <button
                      key={p.id}
                      onClick={() => isAdmin && nextPlayer(auction.id, p.id)}
                      className={`shrink-0 flex items-center gap-1 px-1.5 md:px-2.5 py-1 md:py-2 min-h-[34px] md:min-h-[44px] rounded-lg border text-xs font-medium transition-all ${
                        p.id === liveState.current_player_id
                          ? 'bg-blue-600/20 border-blue-500/50 text-blue-300'
                          : isAdmin
                            ? 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600 hover:text-slate-300 cursor-pointer'
                            : 'bg-slate-800 border-slate-700 text-slate-500 cursor-default'
                      }`}
                    >
                      <span className="w-4 h-4 md:w-5 md:h-5 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold shrink-0">{p.name[0]}</span>
                      <span className="truncate max-w-[40px] md:max-w-[56px] text-[11px] md:text-xs">{p.name.split(' ')[0]}</span>
                      <span className="text-yellow-500 shrink-0 text-[10px] md:text-xs">★{p.rating}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Action dock — Admin */}
            {isAdmin && liveState.is_live && (
              <div className="px-3 md:px-4 py-2.5 md:py-3 space-y-2 md:space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-600 uppercase tracking-widest font-semibold">Bid for team</span>
                  <span className="text-xs text-blue-400 font-semibold">{smartIncrement > 0 ? `+${fmt(smartIncrement)} per bid` : `Next: ${fmt(nextBid)}`}</span>
                </div>
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-1.5">
                  {auctionTeams.map(t => {
                    const isLeading = t.id === liveState.current_highest_bidder_id
                    const isBidding = t.id === biddingTeamId
                    const budgetLeft = Number(t.pivot?.budget_remaining ?? 0)
                    const nobudget = nextBid > budgetLeft
                    const maxPlayers = auction?.max_players_per_team ?? 0
                    const atMax = maxPlayers > 0 && (soldCountByTeam[t.id] ?? 0) >= maxPlayers
                    return (
                      <button
                        key={t.id}
                        onClick={() => handleBid(t.id)}
                        disabled={isLeading || isBidding || nobudget || atMax || !liveState.current_player_id}
                        className={`flex items-center gap-1.5 md:gap-2 px-2 md:px-3 py-2 min-h-[40px] md:min-h-0 rounded-xl border text-xs font-semibold transition-all active:scale-95 ${
                          isLeading ? 'bg-green-500/10 border-green-500/30 text-green-400 cursor-default' :
                          isBidding ? 'bg-blue-500/20 border-blue-500/40 text-blue-300 cursor-wait' :
                          atMax ? 'bg-slate-800/50 border-slate-800 text-slate-600 cursor-not-allowed' :
                          nobudget ? 'bg-slate-800/50 border-slate-800 text-slate-600 cursor-not-allowed' :
                          'bg-slate-800 border-slate-700 text-slate-300 hover:bg-blue-600 hover:border-blue-500 hover:text-white cursor-pointer'
                        }`}
                      >
                        <span className="text-base leading-none shrink-0">{t.logo}</span>
                        <span className="truncate flex-1 text-left hidden sm:inline">{t.name}</span>
                        <span className="shrink-0 opacity-60 text-[10px] md:text-xs">
                          {isLeading ? '🏆' : atMax ? '🚫' : nobudget ? '💸' : fmt(budgetLeft)}
                        </span>
                      </button>
                    )
                  })}
                </div>
                <div className="grid grid-cols-2 gap-2 pt-0.5">
                  <button onClick={handleSold} className="flex items-center justify-center gap-2 py-2.5 md:py-3 min-h-[44px] bg-green-600/20 hover:bg-green-600 border border-green-500/30 hover:border-green-500 rounded-xl text-green-400 hover:text-white text-sm font-bold transition-all active:scale-95">
                    <CheckCircle size={15} /> Sold
                  </button>
                  <button onClick={handleUnsold} className="flex items-center justify-center gap-2 py-2.5 md:py-3 min-h-[44px] bg-red-600/20 hover:bg-red-600 border border-red-500/30 hover:border-red-500 rounded-xl text-red-400 hover:text-white text-sm font-bold transition-all active:scale-95">
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
              const maxPlayers = auction?.max_players_per_team ?? 0
              const atMax = maxPlayers > 0 && (soldCountByTeam[user?.team_id] ?? 0) >= maxPlayers
              return (
                <div className="px-3 md:px-4 py-2.5 md:py-3">
                  <button
                    onClick={() => handleBid(user?.team_id)}
                    disabled={isLeading || nobudget || atMax || !liveState.current_player_id || !!biddingTeamId}
                    className={`w-full py-3.5 md:py-4 min-h-[52px] rounded-xl text-sm font-black flex items-center justify-center gap-2.5 transition-all active:scale-95 ${
                      isLeading ? 'bg-green-500/10 border border-green-500/30 text-green-400 cursor-default' :
                      atMax ? 'bg-slate-800 border border-slate-700 text-slate-600 cursor-not-allowed' :
                      nobudget ? 'bg-slate-800 border border-slate-700 text-slate-600 cursor-not-allowed' :
                      biddingTeamId ? 'bg-blue-500/20 border border-blue-500/30 text-blue-300 cursor-wait' :
                      'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-600/20'
                    }`}
                  >
                    <Gavel size={16} />
                    {isLeading ? '🏆 Your team is leading' : atMax ? `🚫 Max ${maxPlayers} players reached` : nobudget ? '💸 Insufficient budget' : `Place Bid — ${fmt(nextBid)}`}
                  </button>
                  {myTeam && (
                    <p className="text-center text-xs text-slate-600 mt-1.5">
                      Budget left: <span className="text-slate-400 font-semibold">{fmt(myBudget)}</span>
                      {maxPlayers > 0 && <span className="ml-2">· Players: <span className="text-slate-400 font-semibold">{soldCountByTeam[user?.team_id] ?? 0}/{maxPlayers}</span></span>}
                    </p>
                  )}
                </div>
              )
            })()}



          </div>
        </div>

        {/* ── COL 3: Teams + Chat ── */}
        <div className={`w-full md:w-64 lg:w-72 xl:w-80 md:shrink-0 flex flex-col border-l border-slate-800 overflow-hidden min-h-0 ${
          tab === 'teams' || tab === 'chat' ? 'flex flex-1' : 'hidden md:flex'
        }`}>

          {/* Sub-tab bar — hidden on mobile (top nav handles it), shown md+ */}
          <div className="hidden md:flex shrink-0 border-b border-slate-800">
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

          {/* Teams panel */}
          <div className={`auction-scroll flex-1 overflow-y-auto p-2.5 md:p-3 ${
            (tab === 'teams' || (tab !== 'chat' && rightTab === 'teams')) ? 'flex flex-col' : 'hidden'
          }`}>
            {isAdmin && liveState.is_live && (
              <p className="text-xs text-blue-400 mb-2">Click a team to bid{smartIncrement > 0 ? ` +${fmt(smartIncrement)}` : ''}</p>
            )}
            <div className="space-y-1.5 md:space-y-2">
              {auctionTeams.map(team => {
                const budgetRemaining = Number(team.pivot?.budget_remaining ?? auction.budget_per_team ?? 0)
                const spent = Number(auction.budget_per_team ?? 0) - budgetRemaining
                const pct = auction.budget_per_team ? Math.round((spent / auction.budget_per_team) * 100) : 0
                const isLeading = team.id === liveState.current_highest_bidder_id
                const isBidding = team.id === biddingTeamId
                const maxPlayers = auction?.max_players_per_team ?? 0
                const atMax = maxPlayers > 0 && (soldCountByTeam[team.id] ?? 0) >= maxPlayers
                const canClickBid = isAdmin && liveState.is_live && !isLeading && !atMax && liveState.current_player_id
                const nobudget = nextBid > budgetRemaining
                return (
                  <div
                    key={team.id}
                    onClick={() => canClickBid && !nobudget && handleBid(team.id)}
                    className={`p-2 md:p-2.5 rounded-xl border transition-all ${
                      isLeading && liveState.is_live ? 'bg-green-500/10 border-green-500/20' :
                      isBidding ? 'bg-blue-500/10 border-blue-500/20' :
                      atMax ? 'bg-slate-900 border-slate-800 opacity-50' :
                      canClickBid && !nobudget ? 'bg-slate-900 border-slate-800 hover:border-blue-500/40 hover:bg-slate-800 cursor-pointer' :
                      'bg-slate-900 border-slate-800'
                    }`}
                  >
                    {/* Top row: logo + name + status dot */}
                    <div className="flex items-center gap-2">
                      <span className="text-base leading-none shrink-0">{team.logo}</span>
                      <span className="text-xs md:text-sm font-semibold flex-1 truncate">{team.name}</span>
                      {atMax && <span className="text-[10px] text-slate-600 shrink-0">🚫</span>}
                      {isLeading && liveState.is_live && !atMax && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse shrink-0" />}
                      {isBidding && <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping shrink-0" />}
                      {/* Budget + player count inline on mobile */}
                      <span className="flex items-center gap-1.5 md:hidden shrink-0">
                        {maxPlayers > 0 && (
                          <span className={`text-[10px] font-semibold ${ atMax ? 'text-red-400' : 'text-slate-600' }`}>
                            {soldCountByTeam[team.id] ?? 0}/{maxPlayers}p
                          </span>
                        )}
                        <span className={`text-[10px] font-semibold ${
                          budgetRemaining < (auction.budget_per_team ?? 0) * 0.2 ? 'text-red-400' : 'text-slate-400'
                        }`}>{fmt(budgetRemaining)}</span>
                      </span>
                    </div>
                    {/* Budget bar + stats — full detail on md+ */}
                    <div className="hidden md:block mt-1.5">
                      <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full rounded-full transition-all ${
                          pct > 75 ? 'bg-red-500' : pct > 50 ? 'bg-yellow-500' : 'bg-blue-500'
                        }`} style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-[10px] text-slate-600">{fmt(spent)} spent</span>
                        <span className="flex items-center gap-2">
                          {maxPlayers > 0 && (
                            <span className={`text-[10px] font-semibold ${ atMax ? 'text-red-400' : 'text-slate-600' }`}>
                              {soldCountByTeam[team.id] ?? 0}/{maxPlayers}p
                            </span>
                          )}
                          <span className={`text-[10px] font-semibold ${
                            budgetRemaining < (auction.budget_per_team ?? 0) * 0.2 ? 'text-red-400' : 'text-slate-400'
                          }`}>{fmt(budgetRemaining)}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Chat panel */}
          <div className={`flex-1 flex flex-col min-h-0 relative ${
            (tab === 'chat' || (tab !== 'teams' && rightTab === 'chat')) ? 'flex' : 'hidden'
          }`}>
            {floatingEmojis.map(fe => (
              <div key={fe.id} className="absolute bottom-20 text-2xl pointer-events-none z-20" style={{ left: `${fe.left}%`, animation: 'floatUp 2s ease-out forwards' }}>{fe.emoji}</div>
            ))}
            {/* Messages — flex-1 min-h-0 so it never pushes input off screen */}
            <div
              ref={chatScrollRef}
              onScroll={handleChatScroll}
              className="auction-scroll flex-1 overflow-y-auto px-2 py-2 space-y-1 min-h-0"
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
            {/* Chat input — shrink-0, always visible */}
            <div className="shrink-0 border-t border-slate-700/60 bg-slate-900/70 backdrop-blur">
              {(isOwner || isPlayer) && (
                <div className="px-2 pt-1.5 pb-2 space-y-1.5">
                  <div className="flex justify-between px-1">
                    {QUICK_EMOJIS.map(e => (
                      <button key={e} onClick={() => handleEmojiChat(e)} className="active:scale-75 transition-transform duration-100">
                        <span className="text-lg leading-none drop-shadow-lg">{e}</span>
                      </button>
                    ))}
                  </div>
                  <div className="h-px bg-slate-700/60" />
                  <div className="hidden md:flex flex-wrap gap-1 md:gap-1.5 px-1">
                    {chatSuggestions.map(s => (
                      <button key={s} onClick={() => handleQuickChat(s)} className="px-2 md:px-2.5 py-1 bg-slate-700/80 hover:bg-blue-600 border border-slate-600 hover:border-blue-500 active:scale-95 rounded-full text-xs text-slate-300 hover:text-white transition-all font-medium">{s}</button>
                    ))}
                  </div>
                  <form onSubmit={handleSendChat} className="flex gap-2">
                    <input value={chatMsg} onChange={e => setChatMsg(e.target.value)} placeholder="Message..." className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-blue-500" />
                    <button type="submit" className="w-8 h-8 bg-blue-600 hover:bg-blue-700 active:scale-95 rounded-xl flex items-center justify-center text-white transition-all shrink-0"><Send size={13} /></button>
                  </form>
                </div>
              )}
              {isAdmin && (
                <div className="px-2 pt-1.5 pb-1 space-y-1 md:space-y-1.5">
                  <div className="flex justify-between px-1">
                    {QUICK_EMOJIS.map(e => (
                      <button key={e} onClick={() => handleEmojiChat(e)} className="active:scale-75 transition-transform duration-100">
                        <span className="text-lg leading-none drop-shadow-lg">{e}</span>
                      </button>
                    ))}
                  </div>
                  <div className="h-px bg-slate-700/60" />
                  <div className="hidden md:flex flex-wrap gap-1">
                    {ADMIN_MESSAGES.map(s => (
                      <button key={s} onClick={() => handleQuickChat(s)} className="px-2 py-0.5 md:py-1 bg-slate-800 hover:bg-red-600/70 border border-slate-700 hover:border-red-500/40 active:scale-95 rounded-full text-xs text-slate-400 hover:text-white transition-all">{s}</button>
                    ))}
                  </div>
                  <form onSubmit={handleSendChat} className="flex gap-2 pb-1">
                    <input value={chatMsg} onChange={e => setChatMsg(e.target.value)} placeholder="Message..." className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-1.5 md:py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-red-500" />
                    <button type="submit" className="w-8 h-8 bg-red-600 hover:bg-red-700 active:scale-95 rounded-xl flex items-center justify-center text-white transition-all shrink-0"><Send size={13} /></button>
                  </form>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>{/* end 3-col grid */}
      <style>{`
        @keyframes floatUp{0%{transform:translateY(0) scale(1);opacity:1}100%{transform:translateY(-100px) scale(1.5);opacity:0}}
        @keyframes confettiFall{0%{transform:translateY(0) rotate(0deg) scaleX(1);opacity:1}100%{transform:translateY(100vh) rotate(720deg) scaleX(0.5);opacity:0}}
        @keyframes celebPop{0%{transform:scale(0.4);opacity:0}100%{transform:scale(1);opacity:1}}
        @keyframes celebGlow{0%{opacity:0.5}100%{opacity:1}}
        @keyframes celebBounce{0%{transform:translateY(0) scale(1)}100%{transform:translateY(-8px) scale(1.08)}}
        @keyframes spinRevealPop{0%{transform:scale(0.2) rotate(-15deg);opacity:0}100%{transform:scale(1) rotate(0deg);opacity:1}}
        @keyframes spinRays{0%{transform:rotate(0deg);opacity:0.8}100%{transform:rotate(180deg);opacity:0}}
      `}</style>

    </div>
  )
}

