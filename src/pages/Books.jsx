export default function Books() {
  return <Placeholder title="Books" note="Block 2: book records, stock counts, low-stock badges." />
}
export function Placeholder({ title, note }) {
  return (
    <div className="space-y-2">
      <h1 className="text-lg font-bold">{title}</h1>
      <p className="text-sm text-slate-500">{note}</p>
    </div>
  )
}
