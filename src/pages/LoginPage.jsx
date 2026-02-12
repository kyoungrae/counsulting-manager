import { useState, useEffect } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { User, Lock, AlertCircle, Loader2, Home, BarChart3 } from 'lucide-react'
import ewhaLogo from '../assets/symbol-mark.png'

export default function LoginPage() {
  const [userId, setUserId] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const { login, currentUser } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const savedId = localStorage.getItem('ewha_analytics_savedUserId')
    if (savedId) {
      setUserId(savedId)
      setRememberMe(true)
    }
  }, [])

  if (currentUser) {
    return <Navigate to="/" replace />
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!userId.trim() || !password) {
      setError('아이디와 비밀번호를 입력해주세요.')
      return
    }
    try {
      setError('')
      setLoading(true)
      if (rememberMe) {
        localStorage.setItem('ewha_analytics_savedUserId', userId)
      } else {
        localStorage.removeItem('ewha_analytics_savedUserId')
      }
      await login(userId, password)
      navigate('/')
    } catch (err) {
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError(err.message || '아이디 또는 비밀번호가 올바르지 않습니다.')
      } else {
        setError(err.message || '로그인에 실패했습니다. 다시 시도해주세요.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="login-container login-container--analytics">
      <div className="login-card login-card--analytics animate-fade-in">
        <div className="login-logo text-center">
          <div className="login-logo-inner">
            <div className="login-logo-box">
              <img src={ewhaLogo} alt="이화 로고" className="login-logo-img" />
            </div>
            <div className="login-logo-accent" />
            <h1 className="login-title">이화 컨설팅 분석</h1>
            <p className="login-subtitle">
              <BarChart3 size={14} className="login-subtitle-icon" />
              컨설팅 데이터 분석·통계
            </p>
          </div>
        </div>

        {error && (
          <div className="login-error-box">
            <AlertCircle size={18} className="login-error-icon" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">아이디</label>
            <div className="form-input-wrap">
              <User size={18} className="form-input-icon" />
              <input
                type="text"
                className="form-input form-input--with-icon"
                placeholder="아이디를 입력하세요"
                value={userId}
                onChange={(e) => setUserId(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>
          <div className="form-group">
            <label className="form-label">비밀번호</label>
            <div className="form-input-wrap">
              <Lock size={18} className="form-input-icon" />
              <input
                type="password"
                className="form-input form-input--with-icon"
                placeholder="비밀번호를 입력하세요"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
                required
              />
            </div>
          </div>
          <div className="login-remember">
            <label className="login-remember-label">
              <input
                type="checkbox"
                className="login-remember-checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <span>아이디 기억하기</span>
            </label>
          </div>
          <button
            type="submit"
            className="btn btn-primary btn-login"
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 size={20} className="login-btn-spinner" />
                <span>로그인 중...</span>
              </>
            ) : (
              '로그인'
            )}
          </button>
        </form>

        <div className="login-footer">
          <p className="login-footer-text">
            계정이 없으신가요? <span className="login-footer-link">관리자에게 문의하세요</span>
          </p>
        </div>
      </div>

      <div className="login-home-wrap animate-fade-in">
        <button
          type="button"
          className="login-home-btn"
          onClick={() => navigate('/')}
        >
          <Home size={20} />
          <span>홈으로 돌아가기</span>
        </button>
      </div>
    </div>
  )
}
