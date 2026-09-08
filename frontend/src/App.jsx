import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './context/ToastContext'
import Layout from './components/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import SplashLoader from './components/SplashLoader'
import Landing from './pages/Landing'
import Register from './pages/Register'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Groups from './pages/Groups'
import GroupDetail from './pages/GroupDetail'
import LessonDetail from './pages/LessonDetail'
import Profile from './pages/Profile'
import QuestionBank from './pages/QuestionBank'
import GameBoard from './pages/GameBoard'
import InviteLanding from './pages/InviteLanding'
import Settings from './pages/Settings'
import Students from './pages/Students'
import ForgotPassword from './pages/ForgotPassword'
import NotFound from './pages/NotFound'
import Exams from './pages/Exams'
import Rewards from './pages/Rewards'
import CoinReport from './pages/CoinReport'
import PurchaseScanner from './pages/PurchaseScanner'
import Payments from './pages/Payments'
import GroupPayments from './pages/GroupPayments'
import MyPayments from './pages/MyPayments'

function AppShell() {
  const { loading } = useAuth()
  const [splashDone, setSplashDone] = useState(false)

  useEffect(() => {
    const min = setTimeout(() => setSplashDone(true), 1400)
    return () => clearTimeout(min)
  }, [])

  const done = splashDone && !loading

  return (
    <>
      <SplashLoader done={done} />
      {done && (
        <Layout>
          <Routes>
            <Route path="/"          element={<Landing />} />
            <Route path="/register"  element={<Register />} />
            <Route path="/login"          element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/groups"    element={<ProtectedRoute roles={['teacher','admin']}><Groups /></ProtectedRoute>} />
            <Route path="/groups/:id" element={<ProtectedRoute roles={['teacher','admin','student']}><GroupDetail /></ProtectedRoute>} />
            <Route path="/groups/:groupId/lessons/:lessonId" element={<ProtectedRoute roles={['teacher','admin','student']}><LessonDetail /></ProtectedRoute>} />
            <Route path="/groups/:id/games/:gameId" element={<ProtectedRoute roles={['teacher','admin','student']}><GameBoard /></ProtectedRoute>} />
            <Route path="/questions" element={<ProtectedRoute roles={['teacher','admin']}><QuestionBank /></ProtectedRoute>} />
            <Route path="/profile/:id" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
            <Route path="/invite/:token"     element={<InviteLanding />} />
            <Route path="/settings"          element={<ProtectedRoute roles={['teacher','admin']}><Settings /></ProtectedRoute>} />
            <Route path="/students"          element={<ProtectedRoute roles={['admin','teacher']}><Students /></ProtectedRoute>} />
            <Route path="/exams"             element={<ProtectedRoute><Exams /></ProtectedRoute>} />
            <Route path="/rewards"           element={<ProtectedRoute><Rewards /></ProtectedRoute>} />
            <Route path="/coins/report"      element={<ProtectedRoute roles={['admin']}><CoinReport /></ProtectedRoute>} />
            <Route path="/payments"          element={<ProtectedRoute roles={['admin']}><Payments /></ProtectedRoute>} />
            <Route path="/payments/groups/:groupId" element={<ProtectedRoute roles={['admin']}><GroupPayments /></ProtectedRoute>} />
            <Route path="/my-payments"       element={<ProtectedRoute roles={['student','parent']}><MyPayments /></ProtectedRoute>} />
            <Route path="/scanner"           element={<ProtectedRoute roles={['admin']}><PurchaseScanner /></ProtectedRoute>} />
            <Route path="*"                  element={<NotFound />} />
          </Routes>
        </Layout>
      )}
    </>
  )
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <AppShell />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
