import Sidebar from './Sidebar'
import { useAuth } from '../../context/AuthContext'

export default function AppLayout({ children }) {
  const { loading } = useAuth()
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Sidebar />
      <main className="lg:ml-64 min-h-screen">
        <div className="pt-16 lg:pt-1 p-4 md:p-6 lg:p-8">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : children}
        </div>
      </main>
    </div>
  )
}
