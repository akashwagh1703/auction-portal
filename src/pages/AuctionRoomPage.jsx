import { useEffect, useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuction } from '../context/AuctionContext'
import { useAuth } from '../context/AuthContext'
import { ArrowLeft, Gavel, Users, RefreshCw, CheckCircle, XCircle } from 'lucide-react'
import toast from 'react-hot-toast'

const fmt = (n) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${(n || 0).toLocaleString()}`

export default function AuctionRoomPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { auctions, auctionState, placeBid, soldPlayer, markUnsold, nextPlayer, loadAuctionRoom } = useAuction()
  const { user } = useAuth()

  const [refreshing, setRefreshing] = useState(false)
  const [bidAmount, setBidAmount] = useState('')
  const [confirm, setConfirm] = useState(null)

  const auction = useMemo(() => auctions.find(a => a.id === Number(id)), [auctions, id])
  const state = auctionState || {}

  const auctionPlayers = useMemo(() => auction?.players ?? [], [auction?.players])
  const auctionTeams = useMemo(() => auction?.teams ?? [], [auction?.teams])
  const currentPlayer = useMemo(() => state.auction?.current_player, [state.auction?.current_player])
  const recentBids = useMemo(() => state.recent_bids ?? [], [state.recent_bids])

  const isAdmin = user?.role === 'admin'
  const isOwner = user?.role === 'owner'

  // HTTP-based polling instead of WebSocket
  useEffect(() => {
    loadAuctionRoom(id)
    const interval = setInterval(() => loadAuctionRoom(id), 2000)
    return () => clearInterval(interval)
  }, [id, loadAuctionRoom])

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

  const handleBid = async () => {
    if (!currentPlayer || !bidAmount) return
    try {
      await placeBid(id, currentPlayer.id, parseInt(bidAmount))
      setBidAmount('')
      toast.success('Bid placed successfully')
    } catch (error) {
      toast.error(error.response?.data?.message || 'Failed to place bid')
    }
  }

  const handleSold = async () => {
    if (!currentPlayer || !confirm?.teamId || !confirm?.price) return
    try {
      await soldPlayer(id, currentPlayer.id, confirm.teamId, confirm.price)
      setConfirm(null)
      toast.success('Player sold successfully')
    } catch (error) {
      toast.error('Failed to mark player as sold')
    }
  }

  const handleUnsold = async () => {
    if (!currentPlayer) return
    try {
      await markUnsold(id, currentPlayer.id)
      toast.success('Player marked as unsold')
    } catch (error) {
      toast.error('Failed to mark player as unsold')
    }
  }

  const handleNext = async () => {
    try {
      await nextPlayer(id)
      toast.success('Moved to next player')
    } catch (error) {
      toast.error('Failed to move to next player')
    }
  }

  if (!auction) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-slate-400">Loading auction...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="bg-slate-800 border-b border-slate-700 px-6 py-4">
        <div className="flex items-center justify-between max-w-7xl mx-auto">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/auctions')} className="p-2 hover:bg-slate-700 rounded-lg">
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="text-xl font-bold">{auction.name}</h1>
              <p className="text-slate-400 text-sm">{auction.sport} • {new Date(auction.date).toLocaleDateString()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`px-3 py-1 rounded-full text-sm ${auction.status === 'active' ? 'bg-green-500/20 text-green-400' : 'bg-slate-700 text-slate-300'}`}>
              {auction.status}
            </span>
            <button onClick={handleRefresh} disabled={refreshing} className="p-2 hover:bg-slate-700 rounded-lg disabled:opacity-50">
              <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Auction Area */}
        <div className="lg:col-span-2 space-y-6">
          {/* Current Player */}
          {currentPlayer ? (
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-2xl font-bold">{currentPlayer.name}</h2>
                  <p className="text-slate-400">{currentPlayer.category} • {currentPlayer.nationality}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-slate-400">Base Price</p>
                  <p className="text-2xl font-bold text-green-400">{fmt(currentPlayer.base_price)}</p>
                </div>
              </div>

              {/* Bidding Controls */}
              {(isAdmin || isOwner) && auction.status === 'active' && (
                <div className="mt-6 space-y-4">
                  <div className="flex gap-4">
                    <input
                      type="number"
                      value={bidAmount}
                      onChange={(e) => setBidAmount(e.target.value)}
                      placeholder="Enter bid amount"
                      className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={handleBid}
                      disabled={!bidAmount}
                      className="px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg font-medium flex items-center gap-2"
                    >
                      <Gavel className="w-4 h-4" />
                      Place Bid
                    </button>
                  </div>
                </div>
              )}

              {/* Admin Controls */}
              {isAdmin && (
                <div className="mt-6 flex gap-2">
                  <button
                    onClick={() => setConfirm({ type: 'sold' })}
                    className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg text-sm font-medium flex items-center gap-2"
                  >
                    <CheckCircle className="w-4 h-4" />
                    Mark Sold
                  </button>
                  <button
                    onClick={handleUnsold}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium flex items-center gap-2"
                  >
                    <XCircle className="w-4 h-4" />
                    Mark Unsold
                  </button>
                  <button
                    onClick={handleNext}
                    className="px-4 py-2 bg-slate-600 hover:bg-slate-700 rounded-lg text-sm font-medium"
                  >
                    Next Player
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="bg-slate-800 rounded-xl p-6 border border-slate-700 text-center">
              <p className="text-slate-400">No active player</p>
              {isAdmin && (
                <button onClick={handleNext} className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm">
                  Start Auction
                </button>
              )}
            </div>
          )}

          {/* Recent Bids */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Gavel className="w-5 h-5" />
              Recent Bids
            </h3>
            {recentBids.length > 0 ? (
              <div className="space-y-2">
                {recentBids.map((bid, index) => (
                  <div key={bid.id || index} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-sm font-bold">
                        {bid.team?.name?.[0] || 'T'}
                      </div>
                      <span>{bid.team?.name || 'Unknown'}</span>
                    </div>
                    <span className="font-bold text-green-400">{fmt(bid.amount)}</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-400 text-center py-4">No bids yet</p>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Teams */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h3 className="font-bold mb-4 flex items-center gap-2">
              <Users className="w-5 h-5" />
              Teams
            </h3>
            <div className="space-y-2">
              {auctionTeams.map((team) => (
                <div key={team.id} className="flex items-center justify-between py-2 border-b border-slate-700 last:border-0">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-slate-600 rounded-full flex items-center justify-center text-sm font-bold" style={{ backgroundColor: team.color }}>
                      {team.short_name || team.name[0]}
                    </div>
                    <span>{team.name}</span>
                  </div>
                  <span className="text-slate-400">{fmt(team.budget_remaining || 0)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Players List */}
          <div className="bg-slate-800 rounded-xl p-6 border border-slate-700">
            <h3 className="font-bold mb-4">Players</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {auctionPlayers.map((player) => (
                <div key={player.id} className={`flex items-center justify-between py-2 border-b border-slate-700 last:border-0 ${player.pivot?.status === 'active' ? 'bg-blue-600/20 -mx-2 px-2' : ''}`}>
                  <div>
                    <p className="font-medium">{player.name}</p>
                    <p className="text-xs text-slate-400">{player.category}</p>
                  </div>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    player.pivot?.status === 'sold' ? 'bg-green-500/20 text-green-400' :
                    player.pivot?.status === 'unsold' ? 'bg-red-500/20 text-red-400' :
                    player.pivot?.status === 'active' ? 'bg-blue-500/20 text-blue-400' :
                    'bg-slate-700 text-slate-300'
                  }`}>
                    {player.pivot?.status || 'pending'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Sold Confirmation Modal */}
      {confirm?.type === 'sold' && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-md border border-slate-700">
            <h3 className="text-lg font-bold mb-4">Mark Player as Sold</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Team</label>
                <select
                  value={confirm.teamId || ''}
                  onChange={(e) => setConfirm({ ...confirm, teamId: parseInt(e.target.value) })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select team</option>
                  {auctionTeams.map((team) => (
                    <option key={team.id} value={team.id}>{team.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Final Price</label>
                <input
                  type="number"
                  value={confirm.price || ''}
                  onChange={(e) => setConfirm({ ...confirm, price: parseInt(e.target.value) })}
                  className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <div className="flex gap-2 mt-6">
              <button onClick={handleSold} disabled={!confirm.teamId || !confirm.price} className="flex-1 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:opacity-50 rounded-lg font-medium">
                Confirm Sold
              </button>
              <button onClick={() => setConfirm(null)} className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg font-medium">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
