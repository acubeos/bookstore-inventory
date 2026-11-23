import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export default function Activity() {
  const [log, setLog] = useState([])

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('activity_log').select('*').order('created_at', { ascending: false }).limit(100)
      if (data) setLog(data)
    }
    load()
    const ch = supabase.channel('activity-live')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_log' }, load)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [])

  return (
    <div className="space-y-3">
      <h1 className="text-lg font-bold">Activity</h1>
      <div className="space-y-2">
        {log.map((a) => (
          <div key={a.id} className="bg-white rounded-xl p-3 shadow text-sm">
            <p>
              <span className={`text-xs font-bold px-2 py-0.5 rounded-full mr-2 ${a.action === 'sale' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'}`}>
                {a.action}
              </span>
              {a.detail}
            </p>
            <p className="text-xs text-slate-400 mt-1">{a.actor_name} · {new Date(a.created_at).toLocaleString()}</p>
          </div>
        ))}
        {log.length === 0 && <p className="text-sm text-slate-500 text-center py-6">No activity yet. Record a sale or payment to see it here.</p>}
      </div>
    </div>
  )
}
