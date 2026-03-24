import Sidebar from './Sidebar'
import { useState } from 'react'

export default function AppLayout({ children }) {
  const [collapsed, setCollapsed] = useState(false)
  return (
    <div className="min-h-screen bg-slate-900 text-white">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <main className={`min-h-screen transition-all duration-300 ${
        collapsed ? 'lg:ml-16' : 'lg:ml-64'
      }`}>
        <div className="pt-16 lg:pt-1 p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
