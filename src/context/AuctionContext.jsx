import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react'
import api from '../services/api'
import { getEcho } from '../services/echo'
import { useAuth } from './AuthContext'

const AuctionContext = createContext(null)

export function AuctionProvider({ children }) {
  const { user } = useAuth()
  const [players, setPlayers] = useState([])
  const [teams, setTeams] = useState([])
  const [auctions, setAuctions] = useState([])
  const [liveStates, setLiveStates] = useState({})
  const [bids, setBids] = useState({})
  const [chats, setChats] = useState({})
  const [loading, setLoading] = useState(true)

  // Track active channel subscriptions to prevent duplicates
  const subscribedChannels = useRef({})

  // ── Bootstrap — only when user is authenticated ──
  useEffect(() => {
    if (!user) { setLoading(false); return }

    setLoading(true)
    Promise.all([
      api.get('/teams'),
      api.get('/players'),
      api.get('/auctions'),
    ]).then(([teamsRes, playersRes, auctionsRes]) => {
      setTeams(teamsRes.data.data ?? teamsRes.data)
      setPlayers(playersRes.data.data ?? playersRes.data)
      setAuctions(auctionsRes.data.data ?? auctionsRes.data)
    }).catch(console.error)
      .finally(() => setLoading(false))
  }, [user])

  // ── Subscribe to a live auction channel (deduped) ──
  const subscribeToAuction = useCallback((auctionId) => {
    const key = String(auctionId)

    // Already subscribed — return a no-op cleanup
    if (subscribedChannels.current[key]) {
      return () => {}
    }

    const echo = getEcho()
    const channel = echo.channel(`auction.${key}`)
    subscribedChannels.current[key] = channel

    channel.listen('.state.updated', (data) => {
      setLiveStates(prev => {
        const existing = prev[key] ?? {}
        // Merge carefully: keep existing player/bidder objects if new ones are null
        return {
          ...prev,
          [key]: {
            ...existing,
            ...data,
            current_player: data.current_player ?? existing.current_player ?? null,
            current_highest_bidder: data.current_highest_bidder ?? existing.current_highest_bidder ?? null,
          },
        }
      })
    })

    channel.listen('.bid.placed', (data) => {
      setBids(prev => {
        const existing = prev[key] ?? []
        // Dedup by id
        if (existing.find(b => b.id === data.id)) return prev
        return { ...prev, [key]: [data, ...existing] }
      })
    })

    channel.listen('.chat.message', (data) => {
      setChats(prev => {
        const existing = prev[key] ?? []
        if (existing.find(m => m.id === data.id)) return prev
        return { ...prev, [key]: [...existing, data] }
      })
    })

    return () => {
      echo.leaveChannel(`auction.${key}`)
      delete subscribedChannels.current[key]
    }
  }, [])

  // ── Fetch auction room data ──
  const loadAuctionRoom = useCallback(async (auctionId) => {
    const key = String(auctionId)
    const [auctionRes, stateRes, bidsRes, chatRes] = await Promise.all([
      api.get(`/auctions/${auctionId}`),
      api.get(`/auctions/${auctionId}/state`),
      api.get(`/auctions/${auctionId}/bids`),
      api.get(`/auctions/${auctionId}/chat`),
    ])
    const auction = auctionRes.data.data ?? auctionRes.data
    const state   = stateRes.data.data ?? stateRes.data

    setAuctions(prev => {
      const exists = prev.find(a => a.id === auction.id)
      return exists ? prev.map(a => a.id === auction.id ? auction : a) : [auction, ...prev]
    })
    setLiveStates(prev => ({ ...prev, [key]: state }))
    setBids(prev => ({ ...prev, [key]: bidsRes.data.data ?? bidsRes.data }))
    setChats(prev => ({ ...prev, [key]: chatRes.data.data ?? chatRes.data }))
  }, [])

  // ── Auction CRUD ──
  const createAuction = async (data) => {
    const res = await api.post('/auctions', data)
    const auction = res.data.data ?? res.data
    setAuctions(prev => [auction, ...prev])
    return auction
  }

  const updateAuction = async (id, data) => {
    const res = await api.put(`/auctions/${id}`, data)
    const updated = res.data.data ?? res.data
    setAuctions(prev => prev.map(a => a.id === id ? updated : a))
    return updated
  }

  const deleteAuction = async (id) => {
    await api.delete(`/auctions/${id}`)
    setAuctions(prev => prev.filter(a => a.id !== id))
  }

  const getAuction = (id) => auctions.find(a => a.id === Number(id))

  // ── Live auction controls ──
  const startAuction = async (auctionId) => {
    const res = await api.post(`/auctions/${auctionId}/start`)
    const state = res.data.data ?? res.data
    setLiveStates(prev => ({ ...prev, [auctionId]: state }))
  }

  const stopAuction = async (auctionId) => {
    const res = await api.post(`/auctions/${auctionId}/stop`)
    const state = res.data.data ?? res.data
    setLiveStates(prev => ({ ...prev, [auctionId]: state }))
  }

  const nextPlayer = async (auctionId, playerId) => {
    const res = await api.post(`/auctions/${auctionId}/next-player`, { player_id: playerId })
    const state = res.data.data ?? res.data
    setLiveStates(prev => ({ ...prev, [auctionId]: state }))
    // Update player status in auction locally
    setAuctions(prev => prev.map(a => {
      if (a.id !== Number(auctionId)) return a
      return {
        ...a,
        players: (a.players ?? []).map(p =>
          p.id === playerId
            ? { ...p, pivot: { ...p.pivot, status: 'live' } }
            : p.pivot?.status === 'live'
              ? { ...p, pivot: { ...p.pivot, status: 'pending' } }
              : p
        ),
      }
    }))
  }

  const placeBid = async (auctionId, teamId, amount) => {
    const res = await api.post(`/auctions/${auctionId}/bid`, { team_id: teamId, amount })
    const bid = res.data.data ?? res.data
    setBids(prev => {
      const existing = prev[auctionId] ?? []
      if (existing.find(b => b.id === bid.id)) return prev
      return { ...prev, [auctionId]: [bid, ...existing] }
    })
    // Capture current state snapshot before any updates
    const prevState = liveStates[String(auctionId)] ?? {}
    const prevHighestId = prevState.current_highest_bidder_id
    const prevBid = Number(prevState.current_bid ?? 0)
    // Update liveState with new current_bid + next_bid
    setLiveStates(prev => {
      const key = String(auctionId)
      const existing = prev[key] ?? {}
      return {
        ...prev,
        [key]: { ...existing, current_bid: bid.amount, current_highest_bidder_id: teamId, next_bid: bid.next_bid ?? existing.next_bid },
      }
    })
    // Patch team budgets: restore previous highest bidder's reserved amount, deduct new bidder
    setAuctions(prev => prev.map(a => {
      if (a.id !== Number(auctionId)) return a
      return {
        ...a,
        teams: (a.teams ?? []).map(t => {
          if (prevHighestId && t.id === Number(prevHighestId) && t.id !== teamId)
            return { ...t, pivot: { ...t.pivot, budget_remaining: Number(t.pivot?.budget_remaining ?? 0) + prevBid } }
          if (t.id === teamId)
            return { ...t, pivot: { ...t.pivot, budget_remaining: Number(t.pivot?.budget_remaining ?? 0) - bid.amount } }
          return t
        }),
      }
    }))
    return bid
  }

  const soldPlayer = async (auctionId) => {
    const res = await api.post(`/auctions/${auctionId}/sold`)
    const state = res.data.data ?? res.data
    setLiveStates(prev => ({ ...prev, [auctionId]: state }))
    // Refresh full auction data (player statuses + team budgets updated server-side)
    const auctionRes = await api.get(`/auctions/${auctionId}`)
    const updated = auctionRes.data.data ?? auctionRes.data
    setAuctions(prev => prev.map(a => a.id === Number(auctionId) ? updated : a))
  }

  const markUnsold = async (auctionId) => {
    const res = await api.post(`/auctions/${auctionId}/unsold`)
    const state = res.data.data ?? res.data
    setLiveStates(prev => ({ ...prev, [auctionId]: state }))
    const auctionRes = await api.get(`/auctions/${auctionId}`)
    const updated = auctionRes.data.data ?? auctionRes.data
    setAuctions(prev => prev.map(a => a.id === Number(auctionId) ? updated : a))
  }

  const reAuction = async (auctionId, playerId = null) => {
    await api.post(`/auctions/${auctionId}/re-auction`, playerId ? { player_id: playerId } : {})
    setAuctions(prev => prev.map(a => {
      if (a.id !== Number(auctionId)) return a
      return {
        ...a,
        players: (a.players ?? []).map(p => {
          if (p.pivot?.status !== 'unsold') return p
          if (playerId && p.id !== playerId) return p
          return { ...p, pivot: { ...p.pivot, status: 'pending', sold_to_team_id: null, sold_price: null } }
        }),
      }
    }))
  }

  const sendMessage = async (auctionId, message) => {
    const res = await api.post(`/auctions/${auctionId}/chat`, { message })
    return res.data.data ?? res.data
  }

  // ── Players CRUD ──
  const addPlayer = async (data) => {
    const res = await api.post('/players', data)
    const player = res.data.data ?? res.data
    setPlayers(prev => [...prev, player])
    return player
  }

  const updatePlayer = async (id, data) => {
    const res = await api.put(`/players/${id}`, data)
    const updated = res.data.data ?? res.data
    setPlayers(prev => prev.map(p => p.id === id ? updated : p))
    return updated
  }

  const deletePlayer = async (id) => {
    await api.delete(`/players/${id}`)
    setPlayers(prev => prev.filter(p => p.id !== id))
  }

  const importPlayers = async (file) => {
    const form = new FormData()
    form.append('file', file)
    await api.post('/players/import', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    const res = await api.get('/players')
    setPlayers(res.data.data ?? res.data)
  }

  // ── Teams CRUD ──
  const addTeam = async (data) => {
    const res = await api.post('/teams', data)
    const team = res.data.data ?? res.data
    setTeams(prev => [...prev, team])
    return team
  }

  const updateTeam = async (id, data) => {
    const res = await api.put(`/teams/${id}`, data)
    const updated = res.data.data ?? res.data
    setTeams(prev => prev.map(t => t.id === id ? updated : t))
    return updated
  }

  const deleteTeam = async (id) => {
    await api.delete(`/teams/${id}`)
    setTeams(prev => prev.filter(t => t.id !== id))
  }

  const importTeams = async (file) => {
    const form = new FormData()
    form.append('file', file)
    await api.post('/teams/import', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    const res = await api.get('/teams')
    setTeams(res.data.data ?? res.data)
  }

  const refreshTeams = async () => {
    const res = await api.get('/teams')
    setTeams(res.data.data ?? res.data)
  }

  return (
    <AuctionContext.Provider value={{
      players, teams, auctions, liveStates, bids, chats, loading,
      setLiveStates,
      createAuction, updateAuction, deleteAuction, getAuction,
      startAuction, stopAuction, nextPlayer, placeBid, soldPlayer, markUnsold, reAuction,
      sendMessage, loadAuctionRoom, subscribeToAuction,
      addPlayer, updatePlayer, deletePlayer, importPlayers,
      addTeam, updateTeam, deleteTeam, importTeams, refreshTeams,
    }}>
      {children}
    </AuctionContext.Provider>
  )
}

export const useAuction = () => useContext(AuctionContext)
