import { useAuction } from '../context/AuctionContext'
import { useAuth } from '../context/AuthContext'
import { Badge } from '../components/ui'
import { Star, MapPin, Calendar, TrendingUp } from 'lucide-react'

const fmt = (n) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${n?.toLocaleString()}`

export default function PlayerProfilePage() {
  const { user } = useAuth()
  const { players, teams } = useAuction()

  // Match logged-in player to their record
  const profile = players.find(p => p.id === user?.playerId) || players[0]
  const team = profile?.teamId ? teams.find(t => t.id === profile.teamId) : null

  const statusColor = { sold: 'green', unsold: 'yellow', pending: 'blue' }

  if (!profile) return (
    <div className="flex items-center justify-center h-64 text-slate-400">Profile not found</div>
  )

  return (
    <div className="space-y-5 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold">My Profile</h1>

      {/* Hero Card */}
      <div className="bg-gradient-to-br from-blue-600 to-purple-700 rounded-2xl p-6 text-white">
        <div className="flex items-center gap-5">
          <div className="w-20 h-20 bg-white/20 rounded-2xl flex items-center justify-center text-4xl font-bold shrink-0">
            {profile.name[0]}
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-2xl font-bold truncate">{profile.name}</h2>
            <p className="text-blue-200 mt-1">{profile.role}</p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="flex items-center gap-1 text-sm text-blue-100"><MapPin size={14} />{profile.country}</span>
              <span className="flex items-center gap-1 text-sm text-blue-100"><Calendar size={14} />Age {profile.age}</span>
            </div>
          </div>
          <div className="text-center shrink-0">
            <div className="text-3xl font-bold">{profile.rating}</div>
            <div className="flex items-center gap-1 text-yellow-300 text-xs mt-1"><Star size={12} fill="currentColor" />Rating</div>
          </div>
        </div>
      </div>

      {/* Status + Team */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 text-center">
          <p className="text-xs text-slate-400 mb-2">Auction Status</p>
          <Badge color={statusColor[profile.status] || 'gray'}>
            {profile.status.toUpperCase()}
          </Badge>
        </div>
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-4 text-center">
          <p className="text-xs text-slate-400 mb-1">Team</p>
          {team ? (
            <div className="flex items-center justify-center gap-2">
              <span className="text-xl">{team.logo}</span>
              <span className="text-sm font-bold truncate">{team.name}</span>
            </div>
          ) : (
            <span className="text-sm text-slate-400">Unassigned</span>
          )}
        </div>
      </div>

      {/* Price Info */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
        <h3 className="font-bold mb-4 flex items-center gap-2"><TrendingUp size={18} className="text-green-400" /> Price Details</h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="bg-slate-700 rounded-xl p-4 text-center">
            <p className="text-xs text-slate-400 mb-1">Base Price</p>
            <p className="text-xl font-bold text-blue-400">{fmt(profile.basePrice)}</p>
          </div>
          <div className="bg-slate-700 rounded-xl p-4 text-center">
            <p className="text-xs text-slate-400 mb-1">Sold Price</p>
            <p className="text-xl font-bold text-green-400">{profile.soldPrice ? fmt(profile.soldPrice) : '—'}</p>
          </div>
        </div>
        {profile.soldPrice && (
          <div className="mt-3 bg-green-500/10 border border-green-500/20 rounded-xl p-3 text-center">
            <p className="text-green-400 text-sm font-medium">
              🎉 Sold for {fmt(profile.soldPrice)} — {((profile.soldPrice / profile.basePrice - 1) * 100).toFixed(0)}% above base price!
            </p>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
        <h3 className="font-bold mb-4">Player Stats</h3>
        <div className="space-y-3">
          {[
            { label: 'Rating', value: profile.rating, max: 100, color: 'bg-yellow-500' },
            { label: 'Experience (Age)', value: Math.min(profile.age, 40), max: 40, color: 'bg-blue-500' },
          ].map(stat => (
            <div key={stat.label}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-slate-400">{stat.label}</span>
                <span className="font-medium">{stat.value}</span>
              </div>
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div className={`h-full ${stat.color} rounded-full transition-all`} style={{ width: `${(stat.value / stat.max) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
