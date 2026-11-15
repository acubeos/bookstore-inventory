export default function Home() {
  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">Dashboard</h1>
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl p-4 shadow"><p className="text-xs text-slate-500">Books in stock</p><p className="text-2xl font-bold">—</p></div>
        <div className="bg-white rounded-2xl p-4 shadow"><p className="text-xs text-slate-500">Owed by customers</p><p className="text-2xl font-bold">—</p></div>
      </div>
      <p className="text-sm text-slate-500">Blocks 2–4 will wire these cards to live data.</p>
    </div>
  )
}
