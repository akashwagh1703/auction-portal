import { useAuction } from '../context/AuctionContext'
import { useAuth } from '../context/AuthContext'
import { StatCard } from '../components/ui'
import { Users, Trophy, Gavel, DollarSign, TrendingUp, Clock } from 'lucide-react'

const fmt = (n) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${(n || 0).toLocaleString()}`

export default function DashboardPage() {
  const { players, teams, auctions, liveStates } = useAuction()
  const { user } = useAuth()

  // Player status lives in auction pivot — aggregate across all auctions
  const allAuctionPlayers = auctions.flatMap(a => a.players ?? [])
  const sold = allAuctionPlayers.filter(p => p.pivot?.status === 'sold').length
  const unsold = allAuctionPlayers.filter(p => p.pivot?.status === 'unsold').length

  // Budget from pivot on each auction's teams
  const allAuctionTeams = auctions.flatMap(a => a.teams ?? [])
  const totalBudget = allAuctionTeams.reduce((s, t) => s + (t.pivot?.budget_remaining ?? 0), 0)

  // Live auction: check liveStates map
  const liveAuction = auctions.find(a => liveStates[a.id]?.is_live)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-slate-400 text-sm mt-1">Welcome back, {user?.name}</p>
      </div>

      {liveAuction && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-2xl p-4 flex items-center gap-3 animate-pulse">
          <div className="w-3 h-3 bg-red-500 rounded-full" />
          <p className="text-red-400 font-medium">🔴 {liveAuction.name} is Live!</p>
          <a href={`/auctions/${liveAuction.id}`} className="ml-auto text-sm text-red-400 underline shrink-0">Join Now</a>
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Players" value={players.length} icon={Users} color="blue" />
        <StatCard label="Sold" value={sold} icon={TrendingUp} color="green" />
        <StatCard label="Unsold" value={unsold} icon={Clock} color="yellow" />
        <StatCard label="Teams" value={teams.length} icon={Trophy} color="purple" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <StatCard label="Total Budget Remaining" value={fmt(totalBudget)} icon={DollarSign} color="blue" sub="Combined across all auctions" />
        <StatCard label="Auctions" value={auctions.length} icon={Gavel} color="red" sub={`${Object.values(liveStates).filter(s => s?.is_live).length} live now`} />
      </div>

      {/* Teams Overview */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
        <h2 className="font-bold mb-4">Teams Overview</h2>
        <div className="space-y-3">
          {teams.map(team => (
            <div key={team.id} className="flex items-center gap-3">
              <span className="text-2xl">{team.logo}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium truncate">{team.name}</span>
                  <span className="text-xs text-slate-400 ml-2 shrink-0">{team.short_name}</span>
                </div>
                <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: '100%' }} />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent Players */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
        <h2 className="font-bold mb-4">Recent Players</h2>
        <div className="space-y-2">
          {players.slice(0, 5).map(p => (
            <div key={p.id} className="flex items-center gap-3 py-2 border-b border-slate-700 last:border-0">
              <div className="w-9 h-9 bg-slate-700 rounded-xl flex items-center justify-center text-sm font-bold shrink-0">
                {p.name[0]}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p.name}</p>
                <p className="text-xs text-slate-400">{p.role} • {p.nationality}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-xs font-medium">{fmt(p.base_price)}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
