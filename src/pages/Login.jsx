import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'

export default function Login() {
  const { signIn } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    const { error } = await signIn(email, password)
    if (error) setError(error.message)
  }

  return (
    <div className="min-h-dvh flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 bg-white p-6 rounded-2xl shadow">
        <h1 className="text-xl font-bold text-center">📚 Bookstore Login</h1>
        {error && <p className="text-sm text-red-600">{error}</p>}
        <input className="w-full border rounded-xl p-3" type="email" placeholder="Email"
          value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="w-full border rounded-xl p-3" type="password" placeholder="Password"
          value={password} onChange={(e) => setPassword(e.target.value)} required />
        <button className="w-full bg-[#1e3a5f] text-white rounded-xl p-3 font-semibold" type="submit">
          Sign in
        </button>
      </form>
    </div>
  )
}
