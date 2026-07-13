import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { verifyEmail } from '../services/wordpressApi'
import { useAuth } from '../context/AuthContext'

export default function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { loginWithToken } = useAuth()
  const token = searchParams.get('token') || ''

  const [status, setStatus] = useState('verifying') // verifying | done | error
  const [error, setError] = useState(null)
  const ranRef = useRef(false)

  useEffect(() => {
    if (!token) {
      setStatus('error')
      setError('This verification link is missing its token.')
      return
    }
    if (ranRef.current) return
    ranRef.current = true

    verifyEmail(token)
      .then((data) => {
        if (data.token) loginWithToken(data.token, data.user)
        setStatus('done')
        setTimeout(() => navigate('/dashboard', { replace: true }), 2000)
      })
      .catch((err) => {
        setStatus('error')
        setError(err.message || 'This link has expired or was already used.')
      })
  }, [token, loginWithToken, navigate])

  if (status === 'verifying') {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <h1>Verifying your email…</h1>
          <p className="auth-desc">Please wait a moment.</p>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Verification Failed</h1>
          <p className="auth-desc">{error}</p>
          <Link to="/login" className="btn btn-primary btn-block" style={{ marginTop: '1rem', display: 'block', textAlign: 'center' }}>
            Go to Login →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card" style={{ textAlign: 'center' }}>
        <div className="auth-success-icon">&#10003;</div>
        <h1>Email Verified!</h1>
        <p className="auth-desc">Your account is active. Taking you to your dashboard…</p>
        <Link to="/dashboard" className="btn btn-primary btn-block" style={{ marginTop: '1rem', display: 'block', textAlign: 'center' }}>
          Go to Dashboard →
        </Link>
      </div>
    </div>
  )
}
