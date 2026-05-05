import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthGate } from './components/AuthGate'
import { BottomNav } from './components/BottomNav'
import { InstallBanner } from './components/InstallBanner'
import { Activity } from './views/Activity'
import { Food } from './views/Food'
import { Login } from './views/Login'
import { Settings } from './views/Settings'
import { Today } from './views/Today'
import { Trends } from './views/Trends'
import { WorkoutDetail } from './views/WorkoutDetail'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="*"
          element={
            <AuthGate>
              <AppShell />
            </AuthGate>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}

function AppShell() {
  const location = useLocation()
  const hideChrome = location.pathname === '/login'
  return (
    <>
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/food" element={<Food />} />
        <Route path="/trends" element={<Trends />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="/workout/:id" element={<WorkoutDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      {!hideChrome && <BottomNav />}
      {!hideChrome && <InstallBanner />}
    </>
  )
}
