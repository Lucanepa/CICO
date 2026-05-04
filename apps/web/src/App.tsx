import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { BottomNav } from './components/BottomNav'
import { Activity } from './views/Activity'
import { Today } from './views/Today'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="/activity" element={<Activity />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <BottomNav />
    </BrowserRouter>
  )
}
