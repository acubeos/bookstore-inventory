import { createClient } from "@supabase/supabase-js"

const url =
	import.meta.env.VITE_SUPABASE_URL ||
	"https://mjicoxdphriglsizibbs.supabase.co"
const anonKey =
	import.meta.env.VITE_SUPABASE_ANON_KEY ||
	"sb_publishable_4vbB-Up9_0DanV9XcSGOXw_rCW5PuCM"

if (!url || !anonKey) {
	console.warn(
		"Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY — see .env.example",
	)
}

export const supabase = createClient(url, anonKey)
