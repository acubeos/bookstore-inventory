import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from './supabase'

const KEY = 'bookstore_pending_ops'

function readQueue() {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]')
  } catch {
    return []
  }
}

function writeQueue(ops) {
  localStorage.setItem(KEY, JSON.stringify(ops))
}

export function useOfflineQueue(onSynced) {
  const [online, setOnline] = useState(navigator.onLine)
  const [pending, setPending] = useState(readQueue())
  const [failed, setFailed] = useState([])
  const [syncing, setSyncing] = useState(false)
  const onSyncedRef = useRef(onSynced)
  onSyncedRef.current = onSynced

  useEffect(() => {
    const up = () => setOnline(true)
    const down = () => setOnline(false)
    window.addEventListener('online', up)
    window.addEventListener('offline', down)
    return () => {
      window.removeEventListener('online', up)
      window.removeEventListener('offline', down)
    }
  }, [])

  const refresh = useCallback(() => setPending(readQueue()), [])

  const enqueue = useCallback((op) => {
    const ops = [...readQueue(), { ...op, queuedAt: new Date().toISOString(), status: 'pending' }]
    writeQueue(ops)
    setPending(ops)
  }, [])

  const removeOp = useCallback((queuedAt) => {
    const ops = readQueue().filter((o) => o.queuedAt !== queuedAt)
    writeQueue(ops)
    setPending(ops)
    setFailed((f) => f.filter((x) => x.queuedAt !== queuedAt))
  }, [])

  const sync = useCallback(async () => {
    const ops = readQueue().filter((o) => o.status === 'pending')
    if (!navigator.onLine || ops.length === 0 || syncing) return
    setSyncing(true)
    setFailed([])
    const failures = []
    let done = 0
    for (const op of ops) {
      let error = null
      if (op.type === 'sale') {
        // Snapshot price/qty from sale time — server re-validates stock.
        // If stock ran out meanwhile, mark failed (don't silently drop).
        ({ error } = await supabase.rpc('process_sale', op.payload))
      } else if (op.type === 'payment') {
        ({ error } = await supabase.from('payments').insert(op.payload))
      }
      if (error) {
        failures.push({ ...op, error: error.message })
      } else {
        done += 1
        const rest = readQueue().filter((o) => o.queuedAt !== op.queuedAt)
        writeQueue(rest)
        setPending(rest)
      }
    }
    setFailed(failures)
    setSyncing(false)
    if (onSyncedRef.current) onSyncedRef.current(done)
  }, [syncing])

  useEffect(() => {
    if (online) sync()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [online])

  return {
    online,
    pendingCount: pending.length,
    pending,
    failed,
    syncing,
    enqueue,
    sync,
    removeOp,
    refresh
  }
}
