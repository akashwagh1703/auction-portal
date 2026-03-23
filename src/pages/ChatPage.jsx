import { useState, useRef, useEffect } from 'react'
import { useAuction } from '../context/AuctionContext'
import { useAuth } from '../context/AuthContext'
import { Send } from 'lucide-react'
import { QUICK_EMOJIS, PLAYER_MESSAGES, OWNER_MESSAGES, ADMIN_MESSAGES } from '../constants/chatSuggestions'

export default function ChatPage() {
  const { auctions, chats, sendMessage, loadAuctionRoom, subscribeToAuction } = useAuction()
  const { user } = useAuth()
  const [msg, setMsg] = useState('')
  const [selectedId, setSelectedId] = useState(null)
  const [floatingEmojis, setFloatingEmojis] = useState([])
  const bottomRef = useRef()
  const emojiId = useRef(0)

  const isAdmin = user?.role === 'admin'
  const isPlayer = user?.role === 'player'
  const isOwner = user?.role === 'owner'
  const suggestions = isPlayer ? PLAYER_MESSAGES : OWNER_MESSAGES

  useEffect(() => {
    if (auctions.length && !selectedId) setSelectedId(auctions[0].id)
  }, [auctions])

  useEffect(() => {
    if (!selectedId) return
    loadAuctionRoom(selectedId)
    const unsub = subscribeToAuction(selectedId)
    return unsub
  }, [selectedId])

  const messages = chats[selectedId] ?? []

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const spawnFloating = (emoji) => {
    const id = emojiId.current++
    const left = 10 + Math.random() * 80
    setFloatingEmojis(prev => [...prev, { id, emoji, left }])
    setTimeout(() => setFloatingEmojis(prev => prev.filter(e => e.id !== id)), 2000)
  }

  const handleSend = async (e) => {
    e?.preventDefault()
    if (!msg.trim() || !selectedId) return
    await sendMessage(selectedId, msg.trim())
    setMsg('')
  }

  const handleQuick = async (text) => {
    if (!selectedId) return
    await sendMessage(selectedId, text)
  }

  const handleEmoji = async (emoji) => {
    if (!selectedId) return
    spawnFloating(emoji)
    await sendMessage(selectedId, emoji)
  }

  const fmt = (date) => new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

  const roleColor = (role) => role === 'admin' ? 'text-red-400' : role === 'owner' ? 'text-yellow-400' : 'text-blue-400'
  const roleBadge = (role) => role === 'admin' ? '👑' : role === 'owner' ? '🏟️' : '🏏'

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)] lg:h-[calc(100vh-4rem)]">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-3 h-3 bg-red-500 rounded-full animate-pulse" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Live Chat</h1>
            <p className="text-slate-400 text-sm">{messages.length} messages</p>
          </div>
        </div>
        {auctions.length > 1 && (
          <select
            value={selectedId ?? ''}
            onChange={e => setSelectedId(Number(e.target.value))}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-sm text-white focus:outline-none"
          >
            {auctions.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        )}
      </div>

      {/* Chat container */}
      <div className="relative flex flex-col flex-1 bg-gradient-to-b from-slate-900 to-slate-800 rounded-2xl border border-slate-700 overflow-hidden">

        {/* Floating emojis */}
        {floatingEmojis.map(fe => (
          <div
            key={fe.id}
            className="absolute bottom-24 text-3xl pointer-events-none z-20 animate-bounce"
            style={{ left: `${fe.left}%`, animation: 'floatUp 2s ease-out forwards' }}
          >
            {fe.emoji}
          </div>
        ))}

        {/* Live badge */}
        <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-red-600/90 backdrop-blur px-2.5 py-1 rounded-full">
          <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          <span className="text-white text-xs font-bold tracking-wide">LIVE</span>
        </div>

        {/* Messages — YouTube/Insta live style */}
        <div className="flex-1 overflow-y-auto px-3 pt-10 pb-2 space-y-1.5 flex flex-col justify-end">
          {messages.length === 0 ? (
            <p className="text-slate-600 text-sm text-center py-8">Be the first to react! 🎉</p>
          ) : (
            messages.map(m => {
              const isMe = m.user_id === user?.id
              const role = m.user?.role ?? 'player'
              const isEmoji = [...(m.message ?? '')].length === 1 && /\p{Emoji}/u.test(m.message)
              return (
                <div key={m.id} className={`flex items-end gap-2 ${isMe ? 'justify-end' : 'justify-start'}`}>
                  {!isMe && (
                    <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center text-xs shrink-0 mb-0.5">
                      {m.user?.name?.[0] ?? '?'}
                    </div>
                  )}
                  <div className={`max-w-[78%] ${isMe ? 'items-end' : 'items-start'} flex flex-col gap-0.5`}>
                    {!isMe && (
                      <span className={`text-xs font-semibold px-1 ${roleColor(role)}`}>
                        {roleBadge(role)} {m.user?.name ?? 'Unknown'}
                      </span>
                    )}
                    {isEmoji ? (
                      <span className="text-3xl leading-none px-1">{m.message}</span>
                    ) : (
                      <div className={`px-3 py-1.5 rounded-2xl text-sm leading-snug backdrop-blur-sm ${
                        isMe
                          ? 'bg-blue-600/90 text-white rounded-br-sm'
                          : role === 'admin'
                            ? 'bg-red-500/20 border border-red-500/30 text-white rounded-bl-sm'
                            : role === 'owner'
                              ? 'bg-yellow-500/15 border border-yellow-500/20 text-white rounded-bl-sm'
                              : 'bg-slate-700/80 text-white rounded-bl-sm'
                      }`}>
                        {m.message}
                      </div>
                    )}
                    <span className="text-xs text-slate-600 px-1">{fmt(m.created_at)}</span>
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Bottom controls */}
        <div className="border-t border-slate-700/60 bg-slate-900/80 backdrop-blur">

          {/* Player / Owner: Jio-style reaction bar + quick chips */}
          {(isPlayer || isOwner) && (
            <div className="px-3 pt-3 pb-3 space-y-2.5">
              {/* Reaction emoji bar */}
              <div className="flex justify-between px-2">
                {QUICK_EMOJIS.map(e => (
                  <button
                    key={e}
                    onClick={() => handleEmoji(e)}
                    className="flex flex-col items-center gap-0.5 active:scale-75 transition-transform duration-100 group"
                  >
                    <span className="text-2xl leading-none drop-shadow-lg group-active:scale-125 transition-transform">{e}</span>
                  </button>
                ))}
              </div>
              {/* Divider */}
              <div className="h-px bg-slate-700/60" />
              {/* Quick message pills */}
              <div className="flex flex-wrap gap-1.5">
                {suggestions.map(s => (
                  <button
                    key={s}
                    onClick={() => handleQuick(s)}
                    className="px-3 py-1.5 bg-slate-700/80 hover:bg-blue-600 border border-slate-600 hover:border-blue-500 active:scale-95 rounded-full text-xs text-slate-300 hover:text-white transition-all font-medium"
                  >{s}</button>
                ))}
              </div>
            </div>
          )}

          {/* Admin: emoji bar + quick chips + text input */}
          {isAdmin && (
            <div className="px-3 pt-3 pb-3 space-y-2.5">
              <div className="flex justify-between px-2">
                {QUICK_EMOJIS.map(e => (
                  <button key={e} onClick={() => handleEmoji(e)} className="active:scale-75 transition-transform duration-100">
                    <span className="text-2xl leading-none drop-shadow-lg">{e}</span>
                  </button>
                ))}
              </div>
              <div className="h-px bg-slate-700/60" />
              <div className="flex flex-wrap gap-1.5">
                {ADMIN_MESSAGES.map(s => (
                  <button key={s} onClick={() => handleQuick(s)} className="px-3 py-1.5 bg-slate-700/80 hover:bg-red-600 border border-slate-600 hover:border-red-500 active:scale-95 rounded-full text-xs text-slate-300 hover:text-white transition-all font-medium">{s}</button>
                ))}
              </div>
              <form onSubmit={handleSend} className="flex gap-2">
                <input value={msg} onChange={e => setMsg(e.target.value)} placeholder="Type a message..." className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500" />
                <button type="submit" className="w-11 h-11 bg-red-600 hover:bg-red-700 active:scale-95 rounded-xl flex items-center justify-center text-white transition-all shrink-0"><Send size={18} /></button>
              </form>
            </div>
          )}
        </div>
      </div>

      <style>{`
        @keyframes floatUp {
          0%   { transform: translateY(0) scale(1); opacity: 1; }
          100% { transform: translateY(-120px) scale(1.4); opacity: 0; }
        }
      `}</style>
    </div>
  )
}
