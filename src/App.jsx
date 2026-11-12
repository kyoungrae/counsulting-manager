import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import AppMain from './AppMain'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<AppMain />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
