import { useState } from 'react'
import { Link } from 'react-router-dom'
import { requestPasswordReset } from '../services/wordpressApi'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      await requestPasswordReset(email.trim())
      setDone(true)
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        {done ? (
          <>
            <div className="auth-success-icon">&#10003;</div>
            <h1>Check Your Email</h1>
            <p className="auth-desc">
              If <strong>{email}</strong> is registered with RIN, you'll receive a
              password reset link shortly.
            </p>
            <Link to="/login" className="btn btn-primary btn-block" style={{ marginTop: '1.5rem', display: 'block', textAlign: 'center' }}>
              Back to Login
            </Link>
          </>
        ) : (
          <>
            <h1>Forgot Password</h1>
            <p className="auth-desc">Enter your email and we'll send you a reset link.</p>
            <form onSubmit={handleSubmit} noValidate>
              <div className="form-row">
                <label htmlFor="fp-email">Email address</label>
                <input
                  id="fp-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@example.com"
                />
              </div>
              {error && <div className="login-error" role="alert">{error}</div>}
              <button type="submit" className="btn btn-primary btn-block" disabled={loading || !email.trim()}>
                {loading ? 'Sending…' : 'Send Reset Link'}
              </button>
            </form>
            <p className="auth-footer-link">
              Remember it? <Link to="/login">Back to Login</Link>
            </p>
          </>
        )}
      </div>
    </div>
  )
}
