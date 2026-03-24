import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { getEcho } from '../services/echo'

const AuctionContext = createContext(null)

export function AuctionProvider({ children }) {
  const [players, setPlayers] = useState([])
  const [teams, setTeams] = useState([])
  const [auctions, setAuctions] = useState([])
  const [liveStates, setLiveStates] = useState({})   // { [auctionId]: liveState }
  const [bids, setBids] = useState({})               // { [auctionId]: bid[] }
  const [chats, setChats] = useState({})             // { [auctionId]: message[] }
  const [loading, setLoading] = useState(true)

  // ── Bootstrap ──
  useEffect(() => {
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
  }, [])

  // ── Subscribe to a live auction channel ──
  const subscribeToAuction = useCallback((auctionId) => {
    const echo = getEcho()
    const channel = echo.channel(`auction.${auctionId}`)

    channel.listen('.state.updated', (data) => {
      setLiveStates(prev => ({ ...prev, [auctionId]: data }))
    })

    channel.listen('.bid.placed', (data) => {
      setBids(prev => ({
        ...prev,
        [auctionId]: [data, ...(prev[auctionId] || [])],
      }))
    })

    channel.listen('.chat.message', (data) => {
      setChats(prev => ({
        ...prev,
        [auctionId]: [...(prev[auctionId] || []), data],
      }))
    })

    return () => echo.leaveChannel(`auction.${auctionId}`)
  }, [])

  // ── Fetch auction-specific data ──
  const loadAuctionRoom = useCallback(async (auctionId) => {
    const [auctionRes, stateRes, bidsRes, chatRes] = await Promise.all([
      api.get(`/auctions/${auctionId}`),
      api.get(`/auctions/${auctionId}/state`),
      api.get(`/auctions/${auctionId}/bids`),
      api.get(`/auctions/${auctionId}/chat`),
    ])
    const auction = auctionRes.data.data ?? auctionRes.data
    setAuctions(prev => {
      const exists = prev.find(a => a.id === auction.id)
      return exists ? prev.map(a => a.id === auction.id ? auction : a) : [auction, ...prev]
    })
    setLiveStates(prev => ({ ...prev, [auctionId]: stateRes.data.data ?? stateRes.data }))
    setBids(prev => ({ ...prev, [auctionId]: bidsRes.data.data ?? bidsRes.data }))
    setChats(prev => ({ ...prev, [auctionId]: chatRes.data.data ?? chatRes.data }))
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
    setLiveStates(prev => ({ ...prev, [auctionId]: res.data.data ?? res.data }))
  }

  const stopAuction = async (auctionId) => {
    const res = await api.post(`/auctions/${auctionId}/stop`)
    setLiveStates(prev => ({ ...prev, [auctionId]: res.data.data ?? res.data }))
  }

  const nextPlayer = async (auctionId, playerId) => {
    const res = await api.post(`/auctions/${auctionId}/next-player`, { player_id: playerId })
    setLiveStates(prev => ({ ...prev, [auctionId]: res.data.data ?? res.data }))
  }

  const placeBid = async (auctionId, teamId, amount) => {
    const res = await api.post(`/auctions/${auctionId}/bid`, { team_id: teamId, amount })
    const bid = res.data.data ?? res.data
    // update bid list
    setBids(prev => {
      const existing = prev[auctionId] ?? []
      if (existing.find(b => b.id === bid.id)) return prev
      return { ...prev, [auctionId]: [bid, ...existing] }
    })
    // update team budget_remaining optimistically in auctions state
    setAuctions(prev => prev.map(a => {
      if (a.id !== Number(auctionId)) return a
      return {
        ...a,
        teams: (a.teams ?? []).map(t =>
          t.id === teamId
            ? { ...t, pivot: { ...t.pivot, budget_remaining: Number(t.pivot?.budget_remaining ?? 0) - amount } }
            : t
        ),
      }
    }))
    return bid
  }

  const soldPlayer = async (auctionId) => {
    const res = await api.post(`/auctions/${auctionId}/sold`)
    setLiveStates(prev => ({ ...prev, [auctionId]: res.data.data ?? res.data }))
    // Refresh auction to get updated player statuses
    const auctionRes = await api.get(`/auctions/${auctionId}`)
    const updated = auctionRes.data.data ?? auctionRes.data
    setAuctions(prev => prev.map(a => a.id === auctionId ? updated : a))
  }

  const markUnsold = async (auctionId) => {
    const res = await api.post(`/auctions/${auctionId}/unsold`)
    setLiveStates(prev => ({ ...prev, [auctionId]: res.data.data ?? res.data }))
    const auctionRes = await api.get(`/auctions/${auctionId}`)
    const updated = auctionRes.data.data ?? auctionRes.data
    setAuctions(prev => prev.map(a => a.id === auctionId ? updated : a))
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
    await api.post('/players/import', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
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
    await api.post('/teams/import', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
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
      createAuction, updateAuction, deleteAuction, getAuction,
      startAuction, stopAuction, nextPlayer, placeBid, soldPlayer, markUnsold,
      sendMessage, loadAuctionRoom, subscribeToAuction,
      addPlayer, updatePlayer, deletePlayer, importPlayers,
      addTeam, updateTeam, deleteTeam, importTeams, refreshTeams,
    }}>
      {children}
    </AuctionContext.Provider>
  )
}

export const useAuction = () => useContext(AuctionContext)
