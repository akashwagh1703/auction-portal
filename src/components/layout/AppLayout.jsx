import Sidebar from './Sidebar'

export default function AppLayout({ children }) {
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Sidebar />
      <main className="lg:ml-64 min-h-screen">
        <div className="pt-16 lg:pt-1 p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
