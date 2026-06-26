import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { useAuth } from './AuthContext'

const AuctionContext = createContext(null)

export function AuctionProvider({ children }) {
  const { user } = useAuth()
  const [players, setPlayers] = useState([])
  const [teams, setTeams] = useState([])
  const [auctions, setAuctions] = useState([])
  const [auctionState, setAuctionState] = useState(null)
  const [loading, setLoading] = useState(true)

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

  // ── Fetch auction room data (HTTP-based polling) ──
  const loadAuctionRoom = useCallback(async (auctionId) => {
    const res = await api.get(`/auctions/${auctionId}/state`)
    setAuctionState(res.data)
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

  // ── HTTP-based bidding controls ──
  const placeBid = async (auctionId, playerId, amount) => {
    const res = await api.post(`/auctions/${auctionId}/players/${playerId}/bid`, { amount })
    await loadAuctionRoom(auctionId) // Refresh state after bid
    return res.data
  }

  const soldPlayer = async (auctionId, playerId, teamId, price) => {
    const res = await api.post(`/auctions/${auctionId}/players/${playerId}/sold`, { team_id: teamId, price })
    await loadAuctionRoom(auctionId)
    return res.data
  }

  const markUnsold = async (auctionId, playerId) => {
    const res = await api.post(`/auctions/${auctionId}/players/${playerId}/unsold`)
    await loadAuctionRoom(auctionId)
    return res.data
  }

  const nextPlayer = async (auctionId) => {
    const res = await api.post(`/auctions/${auctionId}/next-player`)
    await loadAuctionRoom(auctionId)
    return res.data
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
      players, teams, auctions, auctionState, loading,
      createAuction, updateAuction, deleteAuction, getAuction,
      placeBid, soldPlayer, markUnsold, nextPlayer, loadAuctionRoom,
      addPlayer, updatePlayer, deletePlayer, importPlayers,
      addTeam, updateTeam, deleteTeam, importTeams, refreshTeams,
    }}>
      {children}
    </AuctionContext.Provider>
  )
}

export const useAuction = () => useContext(AuctionContext)
