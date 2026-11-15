import { NavLink } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

const link = ({ isActive }) =>
  `flex-1 py-3 text-center text-sm font-medium ${isActive ? 'text-[#1e3a5f] font-bold' : 'text-slate-500'}`

export default function Shell({ children }) {
  const { profile, signOut } = useAuth()
  return (
    <div className="min-h-dvh flex flex-col max-w-md mx-auto bg-slate-50">
      <header className="bg-[#1e3a5f] text-white px-4 py-3 flex justify-between items-center">
        <span className="font-bold">📚 Bookstore</span>
        <span className="text-xs opacity-80">{profile?.name} ({profile?.role})</span>
      </header>
      <main className="flex-1 p-4 pb-24">{children}</main>
      <nav className="fixed bottom-0 inset-x-0 max-w-md mx-auto bg-white border-t flex">
        <NavLink to="/" className={link}>Home</NavLink>
        <NavLink to="/books" className={link}>Books</NavLink>
        <NavLink to="/customers" className={link}>Customers</NavLink>
        <NavLink to="/sell" className={link}>Sell</NavLink>
        <button onClick={signOut} className="flex-1 py-3 text-center text-sm text-slate-500">Logout</button>
      </nav>
    </div>
  )
}
