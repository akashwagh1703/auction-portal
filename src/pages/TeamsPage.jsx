import { useState, useRef } from 'react'
import { useAuction } from '../context/AuctionContext'
import { useAuth } from '../context/AuthContext'
import { Button, Modal, Input } from '../components/ui'
import { Plus, Edit2, Trash2, Users, Download, Upload, FileDown } from 'lucide-react'
import * as XLSX from 'xlsx'
import toast from 'react-hot-toast'

const COLORS = ['#3B82F6', '#EF4444', '#10B981', '#F59E0B', '#8B5CF6', '#EC4899', '#06B6D4', '#F97316']
const emptyForm = { name: '', email: '', phone: '', short_name: '', color: '#3B82F6', logo: '' }

export default function TeamsPage() {
  const { teams, addTeam, updateTeam, deleteTeam, importTeams } = useAuction()
  const { user } = useAuth()
  const [modal, setModal] = useState(null)
  const [editId, setEditId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const fileRef = useRef()

  const isAdmin = user?.role === 'admin'

  const openAdd = () => { setForm(emptyForm); setModal('add') }
  const openEdit = (t) => {
    setForm({ name: t.name, email: t.email ?? '', phone: t.phone ?? '', short_name: t.short_name, color: t.color || '#3B82F6', logo: t.logo || '' })
    setEditId(t.id)
    setModal('edit')
  }

  const handleSave = async () => {
    if (!form.name.trim()) return toast.error('Team name required')
    if (!form.short_name.trim()) return toast.error('Short name required')
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) return toast.error('Invalid email address')
    if (modal === 'add' && form.email && !form.phone) return toast.error('Phone is required to create login account')
    setSaving(true)
    try {
      if (modal === 'add') {
        await addTeam(form)
        if (form.email && form.phone) toast.success(`Team added — login: ${form.email} / password: ${form.phone}`)
        else toast.success('Team added')
      }
      else { await updateTeam(editId, form); toast.success('Team updated') }
      setModal(null)
    } catch {
      toast.error('Failed to save team')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id) => {
    if (!confirm('Delete this team?')) return
    try {
      await deleteTeam(id)
      toast.success('Team deleted')
    } catch {
      toast.error('Failed to delete team')
    }
  }

  const exportExcel = () => {
    const data = teams.map(t => ({ name: t.name, email: t.email ?? '', phone: t.phone ?? '', short_name: t.short_name, color: t.color, logo: t.logo || '' }))
    const ws = XLSX.utils.json_to_sheet(data)
    ws['!cols'] = [{ wch: 25 }, { wch: 25 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 8 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Teams')
    XLSX.writeFile(wb, 'teams.xlsx')
    toast.success('Exported!')
  }

  const downloadSample = () => {
    const sample = [
      { name: 'Mumbai Indians', email: 'mi@example.com', phone: '9876543210', short_name: 'MI', color: '#3B82F6', logo: '🔵' },
      { name: 'Chennai Super Kings', email: 'csk@example.com', phone: '9876543211', short_name: 'CSK', color: '#F59E0B', logo: '🟡' },
      { name: 'Royal Challengers', email: '', phone: '', short_name: 'RCB', color: '#EF4444', logo: '🔴' },
    ]
    const ws = XLSX.utils.json_to_sheet(sample)
    ws['!cols'] = [{ wch: 25 }, { wch: 25 }, { wch: 14 }, { wch: 12 }, { wch: 10 }, { wch: 8 }]
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Teams')
    XLSX.writeFile(wb, 'teams_sample.xlsx')
    toast.success('Sample downloaded!')
  }

  const handleImport = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    try {
      await importTeams(file)
      toast.success('Teams imported!')
    } catch {
      toast.error('Import failed')
    }
    e.target.value = ''
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Teams</h1>
          <p className="text-slate-400 text-sm">{teams.length} teams</p>
        </div>
        {isAdmin && (
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={exportExcel} title="Export teams to Excel"><Download size={16} /></Button>
            <Button variant="ghost" size="sm" onClick={downloadSample} title="Download sample Excel template"><FileDown size={16} /></Button>
            <Button variant="ghost" size="sm" onClick={() => fileRef.current.click()} title="Import teams from Excel"><Upload size={16} /></Button>
            <Button onClick={openAdd}><Plus size={16} /> Add Team</Button>
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
          </div>
        )}
      </div>

      {teams.length === 0 ? (
        <div className="bg-slate-800 rounded-2xl border border-slate-700 p-12 text-center">
          <Users size={48} className="mx-auto mb-4 text-slate-600" />
          <p className="text-slate-400 font-medium">No teams yet</p>
          {isAdmin && <p className="text-slate-500 text-sm mt-1">Add your first team to get started</p>}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {teams.map(team => (
            <div key={team.id} className="bg-slate-800 rounded-2xl border border-slate-700 p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl font-bold text-white"
                    style={{ backgroundColor: team.color || '#3B82F6' }}
                  >
                    {team.logo || team.name[0]}
                  </div>
                  <div>
                    <h2 className="text-lg font-bold">{team.name}</h2>
                    <p className="text-sm text-slate-400">{team.short_name}</p>
                    {team.email && <p className="text-xs text-slate-500 mt-0.5">{team.email}</p>}
                    {team.phone && <p className="text-xs text-slate-500">{team.phone}</p>}
                  </div>
                </div>
                {isAdmin && (
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(team)} className="p-2 hover:bg-slate-600 rounded-lg text-slate-400 hover:text-white transition-colors">
                      <Edit2 size={15} />
                    </button>
                    <button onClick={() => handleDelete(team.id)} className="p-2 hover:bg-red-500/20 rounded-lg text-slate-400 hover:text-red-400 transition-colors">
                      <Trash2 size={15} />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: team.color || '#3B82F6' }} />
                <span className="text-xs text-slate-400">Team color</span>
                <span className="text-xs text-slate-500 ml-auto">{team.color}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal === 'add' ? 'Add Team' : 'Edit Team'}>
        <div className="space-y-4">
          <Input
            label="Team Name"
            value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder="e.g. Mumbai Indians"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="team@email.com" />
            <Input label="Phone (login password)" type="text" inputMode="numeric" value={form.phone} onChange={e => { if (/^\d*$/.test(e.target.value)) setForm(f => ({ ...f, phone: e.target.value })) }} placeholder="9876543210" />
          </div>
          <Input
            label="Short Name"
            value={form.short_name}
            onChange={e => setForm(f => ({ ...f, short_name: e.target.value }))}
            placeholder="e.g. MI"
          />
          <Input
            label="Logo (emoji or text)"
            value={form.logo}
            onChange={e => setForm(f => ({ ...f, logo: e.target.value }))}
            placeholder="e.g. 🏏"
          />
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-slate-300">Team Color</label>
            <div className="flex flex-wrap gap-2">
              {COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={`w-8 h-8 rounded-lg transition-all ${form.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-800 scale-110' : ''}`}
                  style={{ backgroundColor: c }}
                />
              ))}
              <input
                type="color"
                value={form.color}
                onChange={e => setForm(f => ({ ...f, color: e.target.value }))}
                className="w-8 h-8 rounded-lg cursor-pointer bg-transparent border border-slate-600"
                title="Custom color"
              />
            </div>
            <p className="text-xs text-slate-500">Selected: {form.color}</p>
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setModal(null)}>Cancel</Button>
            <Button className="flex-1" onClick={handleSave} disabled={saving}>
              {saving ? 'Saving...' : 'Save'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
