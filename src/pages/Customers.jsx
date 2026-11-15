import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'

const empty = { name: '', phone: '', address: '', notes: '' }

export default function Customers() {
  const { isManager, user } = useAuth()
  const [customers, setCustomers] = useState([])
  const [balances, setBalances] = useState({})
  const [search, setSearch] = useState('')
  const [form, setForm] = useState(empty)
  const [editing, setEditing] = useState(null)
  const [showForm, setShowForm] = useState(false)
  const [selected, setSelected] = useState(null)
  const [history, setHistory] = useState([])
  const [payAmount, setPayAmount] = useState('')
  const [msg, setMsg] = useState('')

  const load = async () => {
    const { data } = await supabase.from('customers').select('*').order('name')
    if (data) {
      setCustomers(data)
      const { data: bal } = await supabase.from('customer_balances').select('*')
      if (bal) setBalances(Object.fromEntries(bal.map((b) => [b.customer_id, Number(b.balance)))))
    }
  }

  useEffect(() => {
    load()
    const ch = supabase.channel('customers-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'customers' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  const openDetail = async (c) => {
    setSelected(c)
    const { data: s } = await supabase.from('sales').select('*, books(title)').eq('customer_id', c.id).order('sold_at', { ascending: false })
    const { data: p } = await supabase.from('payments').select('*').eq('customer_id', c.id).order('recorded_at', { ascending: false })
    setHistory([...(s || []).map((x) => ({ ...x, kind: 'sale' })), ...(p || []).map((x) => ({ ...x, kind: 'payment' }))])
      .sort((a, b) => new Date(b.sold_at || b.recorded_at) - new Date(a.sold_at || a.recorded_at))
  }

  const save = async (e) => {
    e.preventDefault()
    setMsg('')
    const row = { name: form.name.trim(), phone: form.phone.trim(), address: form.address.trim(), notes: form.notes.trim() }
    const { error } = editing
      ? await supabase.from('customers').update(row).eq('id', editing)
      : await supabase.from('customers').insert(row)
    if (error) setMsg(error.message)
    else { setShowForm(false); load() }
  }

  const recordPayment = async (e) => {
    e.preventDefault()
    const amount = Number(payAmount)
    if (!amount || amount <= 0) return
    const { error } = await supabase.from('payments').insert({ customer_id: selected.id, amount, recorded_by: user.id })
    if (!error) { setPayAmount(''); load(); openDetail({ ...selected }) }
  }

  const filtered = customers.filter((c) =>
    (c.name + ' ' + (c.phone || '')).toLowerCase().includes(search.toLowerCase())
  )
  const totalOwed = Object.values(balances).reduce((s, b) => s + Math.max(0, b), 0)

  if (selected) {
    const bal = balances[selected.id] || 0
    return (
      <div className="space-y-3">
        <button onClick={() => setSelected(null)} className="text-sm text-[#1e3a5f] font-semibold">← Back</button>
        <h1 className="text-lg font-bold">{selected.name}</h1>
        <p className="text-sm text-slate-500">{selected.phone}{selected.address ? ` · ${selected.address}` : ''}</p>
        <div className={`rounded-2xl p-4 shadow ${bal > 0 ? 'bg-red-50' : 'bg-green-50'}`}>
          <p className="text-xs text-slate-500">Outstanding balance</p>
          <p className={`text-2xl font-bold ${bal > 0 ? 'text-red-700' : 'text-green-700'}`}>₦{bal.toLocaleString()}</p>
        </div>
        <form onSubmit={recordPayment} className="flex gap-2">
          <input className="flex-1 border rounded-xl p-3 bg-white" type="number" min="1" step="0.01"
            placeholder="Record payment…" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} />
          <button className="bg-[#1e3a5f] text-white rounded-xl px-4 font-semibold" type="submit">Add</button>
        </form>
        <h2 className="font-semibold text-sm">History</h2>
        <div className="space-y-2">
          {history.map((h) => (
            <div key={h.kind + h.id} className="bg-white rounded-xl p-3 shadow text-sm">
              {h.kind === 'sale' ? (
                <p>{h.qty}× {h.books?.title || 'Book'} — ₦{Number(h.total).toLocaleString()}
                  <span className="text-slate-500"> (paid ₦{Number(h.amount_paid).toLocaleString()})</span></p>
              ) : (
                <p className="text-green-700">Payment received: ₦{Number(h.amount).toLocaleString()}</p>
              )}
              <p className="text-xs text-slate-400">{new Date(h.sold_at || h.recorded_at).toLocaleString()}</p>
            </div>
          ))}
          {history.length === 0 && <p className="text-sm text-slate-500">No transactions yet.</p>}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold">Customers</h1>
        <button onClick={() => { setForm(empty); setEditing(null); setShowForm(true) }}
          className="bg-[#1e3a5f] text-white text-sm font-semibold rounded-xl px-4 py-2">+ Add</button>
      </div>
      <div className="bg-white rounded-2xl p-3 shadow">
        <p className="text-xs text-slate-500">Total owed by all customers</p>
        <p className="text-xl font-bold">₦{totalOwed.toLocaleString()}</p>
      </div>
      <input className="w-full border rounded-xl p-3 bg-white" placeholder="🔍 Search name or phone…"
        value={search} onChange={(e) => setSearch(e.target.value)} />
      {msg && <p className="text-sm text-red-600">{msg}</p>}
      <div className="space-y-2">
        {filtered.map((c) => {
          const bal = balances[c.id] || 0
          return (
            <button key={c.id} onClick={() => openDetail(c)}
              className="w-full text-left bg-white rounded-2xl p-3 shadow flex justify-between items-center">
              <div>
                <p className="font-semibold">{c.name}</p>
                <p className="text-xs text-slate-500">{c.phone}</p>
              </div>
              <span className={`text-sm font-bold ${bal > 0 ? 'text-red-600' : 'text-green-600'}`}>
                {bal > 0 ? `owes ₦${bal.toLocaleString()}` : 'settled'}
              </span>
            </button>
          )
        })}
        {filtered.length === 0 && <p className="text-sm text-slate-500 text-center py-6">No customers yet.</p>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-end justify-center" onClick={() => setShowForm(false)}>
          <form onSubmit={save} onClick={(e) => e.stopPropagation()}
            className="bg-white w-full max-w-md rounded-t-3xl p-5 space-y-3">
            <h2 className="font-bold">{editing ? 'Edit customer' : 'Add customer'}</h2>
            <input className="w-full border rounded-xl p-3" placeholder="Name *" required
              value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <input className="w-full border rounded-xl p-3" placeholder="Phone"
              value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            <input className="w-full border rounded-xl p-3" placeholder="Address"
              value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            <textarea className="w-full border rounded-xl p-3" placeholder="Notes"
              value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <button className="w-full bg-[#1e3a5f] text-white rounded-xl p-3 font-semibold" type="submit">
              {editing ? 'Save changes' : 'Add customer'}
            </button>
            {isManager && editing && (
              <p className="text-xs text-slate-400 text-center">Managers can edit/delete via Supabase dashboard for now.</p>
            )}
          </form>
        </div>
      )}
    </div>
  )
}
