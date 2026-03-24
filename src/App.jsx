import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import { AuthProvider } from './context/AuthContext'
import { AuctionProvider } from './context/AuctionContext'
import { SettingsProvider } from './context/SettingsContext'
import ProtectedRoute from './components/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'

const LoginPage = lazy(() => import('./pages/LoginPage'))
const DashboardPage = lazy(() => import('./pages/DashboardPage'))
const PlayersPage = lazy(() => import('./pages/PlayersPage'))
const AuctionsListPage = lazy(() => import('./pages/AuctionsListPage'))
const AuctionRoomPage = lazy(() => import('./pages/AuctionRoomPage'))
const TeamsPage = lazy(() => import('./pages/TeamsPage'))
const ChatPage = lazy(() => import('./pages/ChatPage'))
const PlayerProfilePage = lazy(() => import('./pages/PlayerProfilePage'))
const SettingsPage = lazy(() => import('./pages/SettingsPage'))

function PageLoader() {
  return <div className="flex items-center justify-center h-64 text-slate-400">Loading...</div>
}

function LayoutRoute({ children }) {
  return (
    <ProtectedRoute>
      <AuctionProvider>
        <AppLayout>
          <Suspense fallback={<PageLoader />}>{children}</Suspense>
        </AppLayout>
      </AuctionProvider>
    </ProtectedRoute>
  )
}

export default function App() {
  return (
    <SettingsProvider>
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { background: '#1e293b', color: '#fff', border: '1px solid #334155' },
          }}
        />
        <Routes>
          <Route path="/login" element={<Suspense fallback={<PageLoader />}><LoginPage /></Suspense>} />
          <Route path="/dashboard" element={<LayoutRoute><DashboardPage /></LayoutRoute>} />
          <Route path="/players" element={<LayoutRoute><PlayersPage /></LayoutRoute>} />
          <Route path="/auctions" element={<LayoutRoute><AuctionsListPage /></LayoutRoute>} />
          <Route path="/auctions/:id" element={<LayoutRoute><AuctionRoomPage /></LayoutRoute>} />
          <Route path="/teams" element={<LayoutRoute><TeamsPage /></LayoutRoute>} />
          <Route path="/chat" element={<LayoutRoute><ChatPage /></LayoutRoute>} />
          <Route path="/profile" element={<ProtectedRoute roles={['player']}><AuctionProvider><AppLayout><Suspense fallback={<PageLoader />}><PlayerProfilePage /></Suspense></AppLayout></AuctionProvider></ProtectedRoute>} />
          <Route path="/settings" element={<LayoutRoute><SettingsPage /></LayoutRoute>} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
    </SettingsProvider>
  )
}
