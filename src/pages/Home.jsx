import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Home() {
  const [stock, setStock] = useState(null)
  const [owed, setOwed] = useState(null)

  useEffect(() => {
    supabase.from('books').select('stock_qty').then(({ data }) => {
      if (data) setStock(data.reduce((s, b) => s + b.stock_qty, 0))
    })
    supabase.from('customer_balances').select('balance').then(({ data }) => {
      if (data) setOwed(data.reduce((s, b) => s + Math.max(0, Number(b.balance)), 0))
    })
  }, [])

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow"><p className="text-xs text-slate-500">Books in stock</p><p className="text-2xl font-bold">{stock ?? '—'}</p></div>
        <div className="bg-white rounded-2xl p-4 shadow"><p className="text-xs text-slate-500">Owed by customers</p><p className="text-2xl font-bold">{owed != null ? `₦${owed.toLocaleString()}` : '—'}</p></div>
      </div>
      <p className="text-sm text-slate-500">Block 4 will add the sell flow.</p>
    </div>
  )
}
