import { useState, useRef } from 'react'
import { useAuction } from '../context/AuctionContext'
import { useAuth } from '../context/AuthContext'
import { Button, Modal, Input, Select, Badge } from '../components/ui'
import { Plus, Search, Upload, Download, Edit2, Trash2, FileDown } from 'lucide-react'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'

const ROLES = ['Batsman', 'Bowler', 'All-Rounder', 'Wicket-Keeper']
const STATUS_COLOR = { sold: 'green', unsold: 'yellow', pending: 'blue' }

const emptyForm = { name: '', email: '', phone: '', role: 'Batsman', base_price: '', nationality: 'India', age: '', rating: '' }

export default function PlayersPage() {
  const { players, addPlayer, updatePlayer, deletePlayer, importPlayers } = useAuction()
  const { user } = useAuth()
  const [search, setSearch] = useState('')
  const [filterRole, setFilterRole] = useState('all')
  const [modal, setModal] = useState(null) // null | 'add' | 'edit'
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()

  const isAdmin = user?.role === 'admin'

  const filtered = players.filter(p => {
    const matchSearch = p.name.toLowerCase().includes(search.toLowerCase())
    const matchRole = filterRole === 'all' || p.role === filterRole
    return matchSearch && matchRole
  })

  const fmt = (n) => n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : `₹${(n || 0).toLocaleString()}`

  const openAdd = () => { setForm(emptyForm); setModal('add') }
  const openEdit = (p) => {
    setForm({ name: p.name, email: p.email ?? '', phone: p.phone ?? '', role: p.role, base_price: p.base_price, nationality: p.nationality, age: p.age, rating: p.rating })
    setEditId(p.id)
    setModal('edit')
  }

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Name is required')
    if (form.base_price === '') return toast.error('Base price is required')
    if (isNaN(Number(form.base_price)) || Number(form.base_price) < 0) return toast.error('Base price must be 0 or more')
    if (form.age && (isNaN(Number(form.age)) || Number(form.age) <= 0)) return toast.error('Age must be a positive number')
    if (form.rating && (isNaN(Number(form.rating)) || Number(form.rating) < 1 || Number(form.rating) > 100)) return toast.error('Rating must be between 1 and 100')
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return toast.error('Invalid email address')
    if (modal === 'add' && form.email && !form.phone) return toast.error('Phone is required to create login account')
    setSaving(true)
    try {
      const data = { ...form, base_price: Number(form.base_price), age: Number(form.age), rating: Number(form.rating) }
      if (modal === 'add') {
        await addPlayer(data)
        if (form.email && form.phone) toast.success(`Player added — login: ${form.email} / password: ${form.phone}`)
        else toast.success('Player added')
      }
      else { await updatePlayer(editId, data); toast.success('Player updated') }
      setModal(null)
    } catch {
      toast.error('Failed to save player')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this player?')) return
    try {
      await deletePlayer(id)
      toast.success('Player deleted')
    } catch {
      toast.error('Failed to delete player')
    }
  }

  const exportExcel = () => {
    const data = players.map(p => ({ name: p.name, email: p.email ?? '', phone: p.phone ?? '', role: p.role, nationality: p.nationality, age: p.age, rating: p.rating, base_price: p.base_price }))
    const ws = XLSX.utils.json_to_sheet(data)
    ws['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 14 }, { wch: 15 }, { wch: 15 }, { wch: 6 }, { wch: 8 }, { wch: 12 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Players')
    XLSX.writeFile(wb, 'players.xlsx')
    toast.success('Exported!')
  }

  const handleImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      await importPlayers(file)
      toast.success('Players imported!')
    } catch {
      toast.error('Import failed')
    }
    e.target.value = ''
  }

  const downloadSample = () => {
    const sample = [
      { name: 'Virat Kohli', email: 'virat@example.com', phone: '9876543210', role: 'Batsman', nationality: 'India', age: 35, rating: 95, base_price: 2000000 },
      { name: 'Jasprit Bumrah', email: 'bumrah@example.com', phone: '9876543211', role: 'Bowler', nationality: 'India', age: 30, rating: 92, base_price: 1500000 },
      { name: 'Hardik Pandya', email: '', phone: '', role: 'All-Rounder', nationality: 'India', age: 30, rating: 88, base_price: 1000000 },
      { name: 'MS Dhoni', email: '', phone: '', role: 'Wicket-Keeper', nationality: 'India', age: 42, rating: 90, base_price: 1500000 },
    ]
    const ws = XLSX.utils.json_to_sheet(sample)
    ws['!cols'] = [{ wch: 20 }, { wch: 25 }, { wch: 14 }, { wch: 15 }, { wch: 15 }, { wch: 6 }, { wch: 8 }, { wch: 12 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Players')
    XLSX.writeFile(wb, 'players_sample.xlsx')
    toast.success('Sample file downloaded!')
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Players</h1>
          <p className="text-slate-400 text-sm">{filtered.length} of {players.length} players</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={exportExcel} title="Export players to Excel"><Download size={16} /></Button>
            <Button variant="ghost" size="sm" onClick={downloadSample} title="Download sample Excel template"><FileDown size={16} /></Button>
            <Button variant="ghost" size="sm" onClick={() => fileRef.current.click()} title="Import players from Excel"><Upload size={16} /></Button>
            <Button size="sm" onClick={openAdd}><Plus size={16} /><span className="hidden sm:inline">Add</span></Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search players..."
            className="w-full bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <select value={filterRole} onChange={e => setFilterRole(e.target.value)} className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none">
          <option value="all">All Roles</option>
          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      {/* Mobile: Cards */}
      <div className="block md:hidden space-y-3">
        {filtered.map(p => (
          <div key={p.id} className="bg-slate-800 rounded-2xl border border-slate-700 p-4">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-700 rounded-xl flex items-center justify-center font-bold">{p.name[0]}</div>
                <div>
                  <p className="font-medium">{p.name}</p>
                  <p className="text-xs text-slate-400">{p.role} • {p.nationality}</p>
                  {p.email && <p className="text-xs text-slate-500">{p.email}</p>}
                  {p.phone && <p className="text-xs text-slate-500">{p.phone}</p>}
                </div>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3 text-center">
              <div><p className="text-xs text-slate-400">Base</p><p className="text-sm font-medium">{fmt(p.base_price)}</p></div>
              <div><p className="text-xs text-slate-400">Rating</p><p className="text-sm font-medium">{p.rating}</p></div>
              <div><p className="text-xs text-slate-400">Age</p><p className="text-sm font-medium">{p.age}</p></div>
            </div>
            {isAdmin && (
              <div className="flex gap-2 mt-3">
                <Button variant="ghost" size="sm" className="flex-1" onClick={() => openEdit(p)}><Edit2 size={14} /> Edit</Button>
                <Button variant="danger" size="sm" className="flex-1" onClick={() => handleDelete(p.id)}><Trash2 size={14} /> Delete</Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Desktop: Table */}
      <div className="hidden md:block bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-700/50">
              <tr>
                {['Player', 'Email', 'Phone', 'Role', 'Nationality', 'Age', 'Rating', 'Base Price', isAdmin && 'Actions'].filter(Boolean).map(h => (
                  <th key={h} className="text-left px-4 py-3 text-slate-400 font-medium">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700">
              {filtered.map(p => (
                <tr key={p.id} className="hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-slate-700 rounded-lg flex items-center justify-center text-xs font-bold">{p.name[0]}</div>
                      <span className="font-medium">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-300">{p.email || <span className="text-slate-600">—</span>}</td>
                  <td className="px-4 py-3 text-slate-300">{p.phone || <span className="text-slate-600">—</span>}</td>
                  <td className="px-4 py-3 text-slate-300">{p.role}</td>
                  <td className="px-4 py-3 text-slate-300">{p.nationality}</td>
                  <td className="px-4 py-3 text-slate-300">{p.age}</td>
                  <td className="px-4 py-3"><span className="font-medium text-yellow-400">{p.rating}</span></td>
                  <td className="px-4 py-3 font-medium">{fmt(p.base_price)}</td>
                  {isAdmin && (
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(p)} className="p-1.5 hover:bg-slate-600 rounded-lg text-slate-400 hover:text-white transition-colors"><Edit2 size={14} /></button>
                        <button onClick={() => handleDelete(p.id)} className="p-1.5 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'add' ? 'Add Player' : 'Edit Player'}>
        <div className="space-y-4">
          <Input label="Name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Player name" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="player@email.com" />
            <Input label="Phone (login password)" type="text" inputMode="numeric" value={form.phone} onChange={e => { if (/^\d*$/.test(e.target.value)) setForm(f => ({ ...f, phone: e.target.value })) }} placeholder="9876543210" />
          </div>
          <Select label="Role" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
          </Select>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Nationality" value={form.nationality} onChange={e => setForm(f => ({ ...f, nationality: e.target.value }))} placeholder="India" />
            <Input label="Age" type="text" inputMode="numeric" value={form.age} onChange={e => { if (/^\d*$/.test(e.target.value)) setForm(f => ({ ...f, age: e.target.value })) }} placeholder="25" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Base Price (₹)" type="text" inputMode="numeric" value={form.base_price} onChange={e => { if (/^\d*$/.test(e.target.value)) setForm(f => ({ ...f, base_price: e.target.value })) }} placeholder="100000" />
            <Input label="Rating" type="text" inputMode="numeric" value={form.rating} onChange={e => { if (/^\d*$/.test(e.target.value)) setForm(f => ({ ...f, rating: e.target.value })) }} placeholder="80" />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setModal(null)}>Cancel</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>{saving ? 'Saving...' : 'Save'}</Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
