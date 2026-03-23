import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import api from '../../services/api'
import {
  LayoutDashboard, Users, Gavel, MessageSquare, Trophy,
  LogOut, Menu, X, ChevronRight, UserCircle, Trash2, AlertTriangle
} from 'lucide-react'
import toast from 'react-hot-toast'

const navItems = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['admin', 'owner', 'player'] },
  { path: '/players', label: 'Players', icon: Users, roles: ['admin', 'owner', 'player'] },
  { path: '/auctions', label: 'Auctions', icon: Gavel, roles: ['admin', 'owner', 'player'] },
  { path: '/teams', label: 'Teams', icon: Trophy, roles: ['admin', 'owner', 'player'] },
  { path: '/chat', label: 'Team Chat', icon: MessageSquare, roles: ['admin', 'owner', 'player'] },
  { path: '/profile', label: 'My Profile', icon: UserCircle, roles: ['player'] },
]

function NavLink({ item, onClick }) {
  const location = useLocation()
  const active = location.pathname === item.path
  return (
    <Link
      to={item.path}
      onClick={onClick}
      className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        active ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-300 hover:bg-slate-700 hover:text-white'
      }`}
    >
      <item.icon size={20} />
      <span className="font-medium">{item.label}</span>
      {active && <ChevronRight size={16} className="ml-auto" />}
    </Link>
  )
}

export default function Sidebar() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [resetModal, setResetModal] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [confirmText, setConfirmText] = useState('')

  const allowed = navItems.filter(i => i.roles.includes(user?.role))
  const isAdmin = user?.role === 'admin'

  const handleLogout = () => { logout(); navigate('/login') }

  const handleReset = async () => {
    if (confirmText !== 'RESET') return
    setResetting(true)
    try {
      await api.post('/reset')
      toast.success('All data has been reset')
      setResetModal(false)
      setConfirmText('')
      // Reload page so AuctionProvider re-bootstraps with empty data
      window.location.href = '/dashboard'
    } catch {
      toast.error('Reset failed')
    } finally {
      setResetting(false)
    }
  }

  const SidebarContent = () => (
    <div className="flex flex-col h-full bg-slate-800 text-white">
      <div className="p-5 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-xl">🏏</div>
          <div>
            <h1 className="font-bold text-lg leading-tight">AuctionPro</h1>
            <p className="text-xs text-slate-400 capitalize">{user?.role} Panel</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {allowed.map(item => (
          <NavLink key={item.path} item={item} onClick={() => setMobileOpen(false)} />
        ))}
      </nav>

      <div className="p-4 border-t border-slate-700">
        <div className="flex items-center gap-3 mb-3 px-2">
          <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-sm font-bold">
            {user?.name?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{user?.name}</p>
            <p className="text-xs text-slate-400 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-red-400 hover:bg-red-500/10 transition-colors"
        >
          <LogOut size={18} />
          <span className="text-sm font-medium">Logout</span>
        </button>
        {isAdmin && (
          <button
            onClick={() => { setResetModal(true); setConfirmText('') }}
            className="w-full flex items-center gap-2 px-4 py-2.5 rounded-xl text-orange-400 hover:bg-orange-500/10 transition-colors mt-1"
          >
            <Trash2 size={18} />
            <span className="text-sm font-medium">Reset All Data</span>
          </button>
        )}
      </div>
    </div>
  )

  return (
    <>
      {/* Mobile hamburger */}
      <button
        onClick={() => setMobileOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 w-11 h-11 bg-slate-800 text-white rounded-xl flex items-center justify-center shadow-lg"
      >
        <Menu size={22} />
      </button>

      {/* Mobile drawer overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="relative w-72 h-full shadow-2xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute top-4 right-4 z-10 w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center text-white"
            >
              <X size={16} />
            </button>
            <SidebarContent />
          </div>
        </div>
      )}

      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col w-64 h-screen fixed left-0 top-0 shadow-xl z-30">
        <SidebarContent />
      </aside>

      {/* Reset Confirmation Modal */}
      {resetModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70" onClick={() => setResetModal(false)} />
          <div className="relative w-full max-w-md bg-slate-800 rounded-2xl border border-red-500/30 shadow-2xl p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center">
                <AlertTriangle size={20} className="text-red-400" />
              </div>
              <h2 className="text-lg font-bold text-white">Reset All Data</h2>
            </div>
            <p className="text-slate-400 text-sm mb-2">This will permanently delete:</p>
            <ul className="text-sm text-slate-300 space-y-1 mb-4 ml-3">
              <li>• All players</li>
              <li>• All teams</li>
              <li>• All auctions &amp; bids</li>
              <li>• All owner &amp; player accounts</li>
              <li>• All chat messages</li>
            </ul>
            <p className="text-slate-400 text-sm mb-3">Type <span className="text-red-400 font-bold">RESET</span> to confirm:</p>
            <input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="Type RESET here"
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500 text-sm mb-4"
            />
            <div className="flex gap-3">
              <button
                onClick={() => setResetModal(false)}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-600 text-slate-300 hover:bg-slate-700 text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={confirmText !== 'RESET' || resetting}
                className="flex-1 px-4 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {resetting ? 'Resetting...' : 'Reset Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
