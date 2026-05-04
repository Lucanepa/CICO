import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import { Today } from './views/Today'

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Today />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}
