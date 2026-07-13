import { useState } from 'react'
import { Link, useNavigate, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { resendVerification } from '../services/wordpressApi'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [errorCode, setErrorCode] = useState(null)
  const [loading, setLoading] = useState(false)
  const [resendStatus, setResendStatus] = useState(null) // null | 'sending' | 'sent'
  const { login, isAuthenticated, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  // Redirect already-authenticated users away from login
  if (!authLoading && isAuthenticated) return <Navigate to="/dashboard" replace />

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setErrorCode(null)
    setResendStatus(null)
    setLoading(true)
    try {
      await login(email, password)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err.message || 'Login failed. Please try again.')
      setErrorCode(err.code || null)
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    setResendStatus('sending')
    try {
      await resendVerification(email)
      setResendStatus('sent')
    } catch {
      setResendStatus(null)
    }
  }

  return (
    <div className="login-page">
      <div className="login-card">
        <h1>Welcome Back</h1>
        <p className="login-desc">Sign in to your Rodeo Information Network account.</p>
        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <div className="form-row">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div className="form-row">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="current-password"
            />
          </div>
          {error && (
            <div className="login-error" role="alert">
              {error}
              {errorCode === 'email_not_verified' && (
                <div style={{ marginTop: '0.5rem' }}>
                  {resendStatus === 'sent' ? (
                    <span>A new verification link has been sent to your email.</span>
                  ) : (
                    <button
                      type="button"
                      className="login-resend-link"
                      onClick={handleResend}
                      disabled={resendStatus === 'sending' || !email}
                      style={{ background: 'none', border: 'none', padding: 0, color: 'inherit', textDecoration: 'underline', cursor: 'pointer' }}
                    >
                      {resendStatus === 'sending' ? 'Sending…' : 'Resend verification email'}
                    </button>
                  )}
                </div>
              )}
            </div>
          )}
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
        <p className="login-footer">
          <Link to="/forgot-password" className="login-forgot">Forgot password?</Link>
        </p>
        <p className="login-footer">
          New to RIN? <Link to="/join-us">Create a free account →</Link>
        </p>
      </div>
    </div>
  )
}
