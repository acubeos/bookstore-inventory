import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useOfflineQueue } from '../lib/offlineQueue'

export default function Sell() {
  const [books, setBooks] = useState([])
  const [customers, setCustomers] = useState([])
  const [balances, setBalances] = useState({})
  const [today, setToday] = useState([])
  const [bookId, setBookId] = useState('')
  const [customerId, setCustomerId] = useState('')
  const [qty, setQty] = useState('1')
  const [paid, setPaid] = useState('')
  const [msg, setMsg] = useState('')
  const [ok, setOk] = useState('')

  const load = async () => {
    const { data: b } = await supabase.from('books').select('*').order('title')
    if (b) setBooks(b)
    const { data: c } = await supabase.from('customers').select('*').order('name')
    if (c) setCustomers(c)
    const { data: bal } = await supabase.from('customer_balances').select('*')
    if (bal) setBalances(Object.fromEntries(bal.map((x) => [x.customer_id, Number(x.balance)])))
    const start = new Date()
    start.setHours(0, 0, 0, 0)
    const { data: s } = await supabase.from('sales')
      .select('*, books(title), customers(name)')
      .gte('sold_at', start.toISOString())
      .order('sold_at', { ascending: false })
    if (s) setToday(s)
  }

  const { online, pending, pendingCount, failed, syncing, enqueue, sync, removeOp } =
    useOfflineQueue(load)

  useEffect(() => {
    load()
    const ch = supabase.channel('sell-live')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sales' }, load)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'books' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  const book = books.find((b) => b.id === bookId)
  const customer = customers.find((c) => c.id === customerId)
  const total = book ? Number(qty || 0) * Number(book.sale_price) : 0
  const paidNum = Number(paid) || 0

  // Credit / balance math (mirrors process_sale RPC)
  const credit = customer ? Number(customer.credit_balance || 0) : 0
  const creditUsed = Math.min(credit, total)
  const afterCredit = total - creditUsed
  const oldBalance = customerId ? (balances[customerId] || 0) : 0
  const newDue = Math.max(0, afterCredit - paidNum)
  const changeDue = Math.max(0, paidNum - afterCredit)
  const newCredit = Math.max(0, paidNum - afterCredit)
  const totalOwedAfter = oldBalance + newDue

  const submit = async (e) => {
    e.preventDefault()
    setMsg(''); setOk('')
    if (!bookId || !customerId) return setMsg('Pick a book and a customer.')
    const nQty = Number(qty)
    if (!nQty || nQty < 1) return setMsg('Quantity must be at least 1.')
    const payload = {
      p_book_id: bookId,
      p_customer_id: customerId,
      p_qty: nQty,
      p_unit_price: Number(book.sale_price),
      p_amount_paid: paidNum
    }
    const meta = {
      bookTitle: book.title,
      customerName: customer?.name || '',
      qty: nQty,
      total,
      paid: paidNum
    }
    if (!navigator.onLine) {
      enqueue({ type: 'sale', payload, meta })
      setOk(`Offline — sale queued at ₦${total.toLocaleString()} (price locked in). Will sync when back online.`)
      setBookId(''); setCustomerId(''); setQty('1'); setPaid('')
      return
    }
    const { error } = await supabase.rpc('process_sale', payload)
    if (error) setMsg(error.message)
    else {
      const parts = []
      if (creditUsed > 0) parts.push(`₦${creditUsed.toLocaleString()} credit applied`)
      if (changeDue > 0) parts.push(`change due ₦${changeDue.toLocaleString()}`)
      if (newCredit > 0) parts.push(`₦${newCredit.toLocaleString()} saved as credit`)
      if (totalOwedAfter > 0) parts.push(`customer now owes ₦${totalOwedAfter.toLocaleString()}`)
      setOk(`Sale recorded.${parts.length ? ' ' + parts.join(' · ') + '.' : ' Fully paid.'}`)
      setBookId(''); setCustomerId(''); setQty('1'); setPaid('')
      load()
    }
  }

  const todayTotal = today.reduce((s, x) => s + Number(x.total), 0)

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">New Sale</h1>
      {!online && (
        <p className="text-sm bg-slate-200 rounded-xl px-3 py-2">
          📴 Offline — sales will queue{pendingCount > 0 && ` (${pendingCount} pending)`}.
        </p>
      )}
      {online && pendingCount > 0 && (
        <button onClick={sync} disabled={syncing}
          className="text-sm bg-amber-100 text-amber-800 rounded-xl px-3 py-2 w-full disabled:opacity-60">
          {syncing ? '⏳ Syncing…' : `⏳ ${pendingCount} queued sale${pendingCount > 1 ? 's' : ''} — tap to sync now`}
        </button>
      )}

      {pending.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold text-sm">Queued (not yet synced)</h2>
          {pending.map((op) => (
            <div key={op.queuedAt} className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-sm flex justify-between items-center">
              <div>
                <p>{op.meta?.qty}× {op.meta?.bookTitle} → {op.meta?.customerName}</p>
                <p className="text-xs text-slate-500">
                  ₦{Number(op.meta?.total || 0).toLocaleString()} · queued {new Date(op.queuedAt).toLocaleString()}
                </p>
              </div>
              <button onClick={() => removeOp(op.queuedAt)} className="text-xs text-red-600 border rounded-lg px-2 py-1 ml-2 shrink-0">
                Discard
              </button>
            </div>
          ))}
        </div>
      )}

      {failed.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold text-sm text-red-700">Couldn't sync — needs attention</h2>
          {failed.map((op) => (
            <div key={op.queuedAt} className="bg-red-50 border border-red-200 rounded-xl p-3 text-sm">
              <p>{op.meta?.qty}× {op.meta?.bookTitle} → {op.meta?.customerName}</p>
              <p className="text-xs text-red-600 mt-1">{op.error}</p>
              <div className="flex gap-2 mt-2">
                <button onClick={sync} disabled={syncing} className="text-xs bg-white border rounded-lg px-3 py-1.5 disabled:opacity-60">
                  Retry
                </button>
                <button onClick={() => removeOp(op.queuedAt)} className="text-xs border rounded-lg px-3 py-1.5 text-red-600">
                  Discard
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {msg && <p className="text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2">{msg}</p>}
      {ok && <p className="text-sm text-green-700 bg-green-50 rounded-xl px-3 py-2">{ok}</p>}

      <form onSubmit={submit} className="bg-white rounded-2xl p-4 shadow space-y-3">
        <select className="w-full border rounded-xl p-3 bg-white" value={bookId} onChange={(e) => setBookId(e.target.value)} required>
          <option value="">— Select book —</option>
          {books.map((b) => (
            <option key={b.id} value={b.id} disabled={b.stock_qty < 1}>
              {b.title} — ₦{Number(b.sale_price).toLocaleString()} ({b.stock_qty} left)
            </option>
          ))}
        </select>
        <select className="w-full border rounded-xl p-3 bg-white" value={customerId} onChange={(e) => setCustomerId(e.target.value)} required>
          <option value="">— Select customer —</option>
          {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>

        {customer && (
          <div className="text-sm rounded-xl px-3 py-2 bg-slate-50">
            {credit > 0 && <p className="text-green-700 font-semibold">💳 Has ₦{credit.toLocaleString()} credit</p>}
            {oldBalance > 0 && <p className="text-red-600 font-semibold">⚠️ Owes ₦{oldBalance.toLocaleString()} from before</p>}
            {credit === 0 && oldBalance === 0 && <p className="text-slate-500">No balance, no credit</p>}
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm">Qty
            <input className="w-full border rounded-xl p-3 mt-1" type="number" min="1"
              max={book?.stock_qty || undefined} value={qty} onChange={(e) => setQty(e.target.value)} required />
          </label>
          <label className="text-sm">Amount paid
            <input className="w-full border rounded-xl p-3 mt-1" type="number" min="0" step="0.01"
              value={paid} onChange={(e) => setPaid(e.target.value)} placeholder={afterCredit ? String(afterCredit) : '0'} />
          </label>
        </div>

        {book && (
          <div className="text-sm space-y-1 bg-slate-50 rounded-xl px-3 py-2">
            <p>Total: <b>₦{total.toLocaleString()}</b></p>
            {creditUsed > 0 && <p className="text-green-700">Credit applied: −₦{creditUsed.toLocaleString()}</p>}
            {afterCredit !== total && <p>To pay now: <b>₦{afterCredit.toLocaleString()}</b></p>}
            {paidNum > 0 && changeDue > 0 && (
              <p className="text-amber-700 font-semibold">💵 Change due: ₦{changeDue.toLocaleString()}</p>
            )}
            {paidNum > 0 && newCredit > 0 && (
              <p className="text-green-700">₦{newCredit.toLocaleString()} will be saved as credit</p>
            )}
            {newDue > 0 && <p className="text-red-600">New balance: ₦{newDue.toLocaleString()}</p>}
            {totalOwedAfter > 0 && <p className="text-red-600 font-semibold">Total owed after: ₦{totalOwedAfter.toLocaleString()}</p>}
            {newDue === 0 && totalOwedAfter === 0 && total > 0 && <p className="text-green-600">Fully paid ✓</p>}
          </div>
        )}

        <button className="w-full bg-[#1e3a5f] text-white rounded-xl p-3 font-semibold" type="submit">
          Record sale
        </button>
      </form>

      <h2 className="font-semibold text-sm pt-2">Today's sales (₦{todayTotal.toLocaleString()})</h2>
      <div className="space-y-2">
        {today.map((s) => (
          <div key={s.id} className="bg-white rounded-xl p-3 shadow text-sm">
            <p>{s.qty}× {s.books?.title} → {s.customers?.name}</p>
            <p className="text-xs text-slate-500">
              ₦{Number(s.total).toLocaleString()} · paid ₦{Number(s.amount_paid).toLocaleString()}
              {Number(s.balance_due) > 0 && <span className="text-red-600"> · owes ₦{Number(s.balance_due).toLocaleString()}</span>}
            </p>
          </div>
        ))}
        {today.length === 0 && <p className="text-sm text-slate-500 text-center py-4">No sales today yet.</p>}
      </div>
    </div>
  )
}
