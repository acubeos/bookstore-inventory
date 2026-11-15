import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'

const empty = { title: '', author: '', isbn: '', cost_price: '', sale_price: '', stock_qty: '', low_stock_threshold: 5 }

export default function Books() {
  const { isManager } = useAuth()
  const [books, setBooks] = useState([])
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    const { data, error } = await supabase.from('books').select('*').order('title')
    if (!error) setBooks(data)
  }

  useEffect(() => {
    load()
    const ch = supabase.channel('books-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'books' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  const openAdd = () => { setForm(empty); setEditing(null); setShowForm(true) }
  const openEdit = (b) => {
    setForm({ ...b, cost_price: String(b.cost_price), sale_price: String(b.sale_price), stock_qty: String(b.stock_qty) })
    setEditing(b.id); setShowForm(true)
  }

  const save = async (e) => {
    e.preventDefault()
    setMsg('')
    const row = {
      title: form.title.trim(),
      author: form.author.trim(),
      isbn: form.isbn.trim(),
      cost_price: Number(form.cost_price) || 0,
      sale_price: Number(form.sale_price) || 0,
      stock_qty: Number(form.stock_qty) || 0,
      low_stock_threshold: Number(form.low_stock_threshold) || 5
    }
    const { error } = editing
      ? await supabase.from('books').update(row).eq('id', editing)
      : await supabase.from('books').insert(row)
    if (error) setMsg(error.message)
    else { setShowForm(false); load() }
  }

  const remove = async (id) => {
    if (!confirm('Delete this book?')) return
    const { error } = await supabase.from('books').delete().eq('id', id)
    if (!error) load()
  }

  const filtered = books.filter((b) =>
    (b.title + ' ' + b.author + ' ' + (b.isbn || '')).toLowerCase().includes(search.toLowerCase())
  )
  const totalStock = books.reduce((s, b) => s + b.stock_qty, 0)
  const lowCount = books.filter((b) => b.stock_qty <= b.low_stock_threshold).length

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Books</h1>
        {isManager && (
          <button onClick={openAdd} className="bg-[#1e3a5f] text-white text-sm font-semibold rounded-xl px-4 py-2">
            + Add
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-3 shadow"><p className="text-xs text-slate-500">Titles</p><p className="text-xl font-bold">{books.length}</p></div>
        <div className="bg-white rounded-2xl p-3 shadow"><p className="text-xs text-slate-500">Units in stock</p><p className="text-xl font-bold">{totalStock}</p></div>
      </div>
      {lowCount > 0 && (
        <p className="text-sm bg-amber-100 text-amber-800 rounded-xl px-3 py-2">⚠️ {lowCount} title{lowCount > 1 ? 's' : ''} low on stock</p>
      )}

      <input className="w-full border rounded-xl p-3 bg-white" placeholder="🔍 Search title, author, ISBN…"
        value={search} onChange={(e) => setSearch(e.target.value)} />

      {msg && <p className="text-sm text-red-600">{msg}</p>}

      <div className="space-y-2">
        {filtered.map((b) => {
          const low = b.stock_qty <= b.low_stock_threshold
          return (
            <div key={b.id} className="bg-white rounded-2xl p-3 shadow flex justify-between items-center">
              <div className="min-w-0">
                <p className="font-semibold truncate">{b.title}</p>
                <p className="text-xs text-slate-500 truncate">{b.author}{b.isbn ? ` · ${b.isbn}` : ''}</p>
                <p className="text-sm mt-1">₦{Number(b.sale_price).toLocaleString()}
                  <span className={`ml-2 text-xs font-semibold px-2 py-0.5 rounded-full ${low ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {low ? `⚠️ ${b.stock_qty} left` : `${b.stock_qty} in stock`}
                  </span>
                </p>
              </div>
              {isManager && (
                <div className="flex gap-2 ml-2 shrink-0">
                  <button onClick={() => openEdit(b)} className="text-sm border rounded-lg px-3 py-1.5">Edit</button>
                  <button onClick={() => remove(b.id)} className="text-sm border rounded-lg px-3 py-1.5 text-red-600">Del</button>
                </div>
              )}
            </div>
          )
        })}
        {filtered.length === 0 && <p className="text-sm text-slate-500 text-center py-6">No books yet. {isManager && 'Tap + Add to create one.'}</p>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center" onClick={() => setShowForm(false)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-md rounded-t-3xl p-5 space-y-3 max-h-[90dvh] overflow-y-auto">
            <h2 className="font-bold">{editing ? 'Edit book' : 'Add book'}</h2>
            <input className="w-full border rounded-xl p-3" placeholder="Title *" required
              value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            <input className="w-full border rounded-xl p-3" placeholder="Author"
              value={form.author} onChange={(e) => setForm({ ...form, author: e.target.value })} />
            <input className="w-full border rounded-xl p-3" placeholder="ISBN"
              value={form.isbn} onChange={(e) => setForm({ ...form, isbn: e.target.value })} />
            <div className="grid grid-cols-2 gap-3">
              <input className="border rounded-xl p-3" type="number" min="0" step="0.01" placeholder="Cost price"
                value={form.cost_price} onChange={(e) => setForm({ ...form, cost_price: e.target.value })} />
              <input className="border rounded-xl p-3" type="number" min="0" step="0.01" placeholder="Sale price *" required
                value={form.sale_price} onChange={(e) => setForm({ ...form, sale_price: e.target.value })} />
              <input className="border rounded-xl p-3" type="number" min="0" step="1" placeholder="Stock qty *" required
                value={form.stock_qty} onChange={(e) => setForm({ ...form, stock_qty: e.target.value })} />
              <input className="border rounded-xl p-3" type="number" min="0" step="1" placeholder="Low-stock alert at"
                value={form.low_stock_threshold} onChange={(e) => setForm({ ...form, low_stock_threshold: e.target.value })} />
            </div>
            <button className="w-full bg-[#1e3a5f] text-white rounded-xl p-3 font-semibold" type="submit">
              {editing ? 'Save changes' : 'Add book'}
            </button>
          </form>
        </div>
      )}
    </div>
  )
}
