import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import { ProtectedRoute, AUTH_ENABLED } from './routes/ProtectedRoute'
import LoginPage from './pages/LoginPage'
import AppMain from './AppMain'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* 로그인 비활성 시 /login 접근도 메인으로 보냄 (페이지 코드는 유지) */}
          <Route
            path="/login"
            element={AUTH_ENABLED ? <LoginPage /> : <Navigate to="/" replace />}
          />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <AppMain />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}

export default App
