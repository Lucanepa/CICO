import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { InstallBanner } from './components/InstallBanner'
import { Activity } from './views/Activity'
import { Food } from './views/Food'
import { Today } from './views/Today'
import { Trends } from './views/Trends'
import { WorkoutDetail } from './views/WorkoutDetail'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="/food" element={<Food />} />
        <Route path="/trends" element={<Trends />} />
        <Route path="/workout/:id" element={<WorkoutDetail />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
      <InstallBanner />
    </BrowserRouter>
  )
}
