import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function ProtectedRoute({ children }) {
  const { currentUser, userProfile } = useAuth()

  if (!currentUser) {
    return <Navigate to="/login" replace />
  }

  if (!userProfile) {
    return (
      <div className="login-loading">
        <div className="login-spinner" />
        <p>사용자 정보를 확인하는 중...</p>
      </div>
    )
  }

  if (userProfile?.status && userProfile.status !== 'approved') {
    return (
      <div className="login-container">
        <div className="login-card" style={{ maxWidth: 420, textAlign: 'center' }}>
          <p className="login-error-text" style={{ marginBottom: '1rem' }}>
            계정이 아직 승인되지 않았습니다. 관리자에게 문의하세요.
          </p>
          <button type="button" className="btn btn-secondary" onClick={() => window.location.reload()}>
            다시 확인
          </button>
        </div>
      </div>
    )
  }

  return children
}
