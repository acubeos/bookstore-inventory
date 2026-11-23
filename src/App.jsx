import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth/AuthContext'
import Shell from './components/Shell'
import Login from './pages/Login'
import Home from './pages/Home'
import Books from './pages/Books'
import Customers from './pages/Customers'
import Sell from './pages/Sell'
import Activity from './pages/Activity'

function Guard({ children }) {
  const { user, loading } = useAuth()
  if (loading) return <p className="p-6 text-center">Loading…</p>
  if (!user) return <Login />
  return <Shell>{children}</Shell>
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Guard><Home /></Guard>} />
          <Route path="/books" element={<Guard><Books /></Guard>} />
          <Route path="/customers" element={<Guard><Customers /></Guard>} />
          <Route path="/sell" element={<Guard><Sell /></Guard>} />
      <Route path="/activity" element={<Guard><Activity /></Guard>} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
