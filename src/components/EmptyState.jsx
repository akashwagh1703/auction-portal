import { FileText, Users, Trophy, Plus, RefreshCw } from 'lucide-react'

const icons = {
  default: FileText,
  players: Users,
  teams: Trophy,
}

export default function EmptyState({
  icon = 'default',
  title = 'No data found',
  description = 'There are no items to display at the moment.',
  action = null,
  actionLabel = 'Add new',
  onAction = () => {},
}) {
  const Icon = icons[icon] || icons.default

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="w-20 h-20 rounded-full bg-slate-800 flex items-center justify-center mb-6">
        <Icon size={40} className="text-slate-500" />
      </div>
      <h3 className="text-xl font-semibold text-white mb-2">{title}</h3>
      <p className="text-slate-400 text-center max-w-md mb-6">{description}</p>
      {action && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-medium px-6 py-3 rounded-xl transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-slate-900"
        >
          {action === 'add' && <Plus size={18} />}
          {action === 'refresh' && <RefreshCw size={18} />}
          {actionLabel}
        </button>
      )}
    </div>
  )
}
