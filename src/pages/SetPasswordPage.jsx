import { useState } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { setPassword } from '../services/wordpressApi'

export default function SetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const key   = searchParams.get('key')   || ''
  const login = searchParams.get('login') || ''

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState(null)

  const pageTitle = 'Set Your Password'

  if (!key || !login) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <h1>Invalid Link</h1>
          <p className="auth-desc">This password link is missing required parameters.</p>
          <Link to="/forgot-password" className="btn btn-primary btn-block" style={{ marginTop: '1rem', display: 'block', textAlign: 'center' }}>
            Request a new link
          </Link>
        </div>
      </div>
    )
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)

    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }
    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    try {
      await setPassword({ login, key, new_password: newPassword })
      setDone(true)
      setTimeout(() => navigate('/login', { replace: true }), 2500)
    } catch (err) {
      setError(err.message || 'This link has expired. Please request a new one.')
    } finally {
      setLoading(false)
    }
  }

  if (done) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-success-icon">&#10003;</div>
          <h1>Password Set!</h1>
          <p className="auth-desc">Your password has been updated. Redirecting you to login…</p>
          <Link to="/login" className="btn btn-primary btn-block" style={{ marginTop: '1rem', display: 'block', textAlign: 'center' }}>
            Go to Login →
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <h1>{pageTitle}</h1>
        <p className="auth-desc">Choose a strong password for your RIN account.</p>
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-row">
            <label htmlFor="sp-new">New Password</label>
            <input
              id="sp-new"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
          </div>
          <div className="form-row">
            <label htmlFor="sp-confirm">Confirm Password</label>
            <input
              id="sp-confirm"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="Repeat your password"
            />
          </div>
          {error && <div className="login-error" role="alert">{error}</div>}
          <button type="submit" className="btn btn-primary btn-block" disabled={loading}>
            {loading ? 'Saving…' : 'Set Password →'}
          </button>
        </form>
      </div>
    </div>
  )
}
