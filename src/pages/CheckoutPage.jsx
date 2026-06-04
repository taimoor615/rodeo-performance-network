import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUpgradeUrl } from '../services/wordpressApi'

const PLAN_INFO = {
  competitor: {
    name: 'Competitor Pro', priceMonth: 9.99, priceYear: 89, trial: false,
    features: ['Full RPI & TPI calculation', 'Season score history', 'Peer rankings', 'Shareable sponsor-ready profile', 'NIL-ready athlete profile'],
  },
  contractor: {
    name: 'Stock Contractor', priceMonth: 29.99, priceYear: 249, trial: true,
    features: ['SRI per animal', 'Herd dashboard', 'Buck-off & qualified ride tracking', 'Shareable animal profile cards', '3-month free trial included'],
  },
  organizer: {
    name: 'Event Organizer', priceMonth: 79.99, priceYear: 649, trial: true,
    features: ['Direct score entry', 'Verified Event badge', 'CSV bulk import', 'Event analytics dashboard', '3-month free trial included'],
  },
}

const FIFTEEN_MIN = 15 * 60

export default function CheckoutPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { token, user, isAuthenticated, loading: authLoading } = useAuth()

  const tier    = searchParams.get('tier')    || 'competitor'
  const billing = searchParams.get('billing') || 'month'
  const plan    = PLAN_INFO[tier] || PLAN_INFO.competitor

  const [firstName, setFirstName] = useState('')
  const [lastName,  setLastName]  = useState('')
  const [email,     setEmail]     = useState('')
  const [timeLeft,  setTimeLeft]  = useState(FIFTEEN_MIN)
  const [expired,   setExpired]   = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [status,    setStatus]    = useState(null)

  // Pre-fill from auth user
  useEffect(() => {
    if (!user) return
    if (user.first_name) setFirstName(user.first_name)
    if (user.last_name)  setLastName(user.last_name)
    if (user.email)      setEmail(user.email)
  }, [user])

  // 15-minute countdown
  useEffect(() => {
    if (timeLeft <= 0) { setExpired(true); return }
    const t = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) { setExpired(true); clearInterval(t); return 0 }
        return prev - 1
      })
    }, 1000)
    return () => clearInterval(t)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const mm = String(Math.floor(timeLeft / 60)).padStart(2, '0')
  const ss = String(timeLeft % 60).padStart(2, '0')

  const displayPrice    = billing === 'year' && plan.priceYear ? plan.priceYear : plan.priceMonth
  const displayInterval = billing === 'year' && plan.priceYear ? 'year' : 'month'

  const handleUpgrade = async (e) => {
    e.preventDefault()
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setStatus({ type: 'error', message: 'Please fill in all required fields.' })
      return
    }
    setLoading(true)
    setStatus(null)
    try {
      const data = await getUpgradeUrl(tier, billing, token)
      if (data.checkout_url) {
        window.location.href = data.checkout_url
      } else {
        setStatus({ type: 'error', message: 'Could not get checkout link. Please try again.' })
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Something went wrong.' })
    } finally {
      setLoading(false)
    }
  }

  if (authLoading) return <div className="checkout-page"><p className="loading">Loading...</p></div>

  if (!isAuthenticated) {
    return (
      <div className="checkout-page">
        <div className="checkout-inner" style={{ textAlign: 'center', paddingTop: '3rem' }}>
          <h2>Please log in to upgrade your account</h2>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem' }}>
            <Link to="/login" className="btn btn-primary">Log In</Link>
            <Link to="/join-us" className="btn btn-secondary">Create Account</Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="checkout-page">
      {/* ---- Countdown banner ---- */}
      <div className={`checkout-timer${expired ? ' checkout-timer--expired' : ''}`}>
        <div className="checkout-timer-inner">
          {expired ? (
            <span>Your session has expired. <Link to="/dashboard">Return to Dashboard</Link></span>
          ) : (
            <>
              <span className="checkout-timer-label">🔒 Your plan is reserved for</span>
              <span className="checkout-timer-digits">{mm}:{ss}</span>
              <span className="checkout-timer-label">— Complete your upgrade before time runs out</span>
            </>
          )}
        </div>
      </div>

      <div className="checkout-inner">
        <Link to="/dashboard" className="back-link">← Back to Dashboard</Link>

        <div className="checkout-grid">

          {/* ---- Left: Plan summary ---- */}
          <aside className="checkout-summary">
            <h2 className="checkout-section-title">Order Summary</h2>

            <div className="checkout-plan-card">
              <div className="checkout-plan-eyebrow">Upgrading to</div>
              <div className="checkout-plan-name">{plan.name}</div>

              <div className="checkout-plan-price">
                {plan.trial ? (
                  <>
                    <span className="checkout-price-free">3 months free to start</span>
                    <span className="checkout-price-then">then ${displayPrice}/{displayInterval}</span>
                  </>
                ) : (
                  <span className="checkout-price-amount">${displayPrice}<span className="checkout-price-interval">/{displayInterval}</span></span>
                )}
              </div>

              {billing === 'year' && plan.priceYear && (
                <p className="checkout-yearly-save">Save ~25% vs monthly billing</p>
              )}

              {plan.trial && (
                <p className="checkout-trial-note">3-month free trial. Cancel anytime before billing starts.</p>
              )}

              <ul className="checkout-features">
                {plan.features.map((f, i) => (
                  <li key={i} className="checkout-feature">✓ {f}</li>
                ))}
              </ul>
            </div>
          </aside>

          {/* ---- Right: Details + submit ---- */}
          <div className="checkout-form-wrap">
            <h2 className="checkout-section-title">Your Details</h2>
            <p className="checkout-prefill-note">We've prefilled your details from your profile. You can update them below if needed.</p>

            <form className="checkout-form join-form" onSubmit={handleUpgrade} noValidate>
              <div className="join-form-row join-form-row--half">
                <div>
                  <label htmlFor="co_first">First Name</label>
                  <input
                    id="co_first" type="text"
                    value={firstName} onChange={(e) => setFirstName(e.target.value)}
                    required autoComplete="given-name"
                  />
                </div>
                <div>
                  <label htmlFor="co_last">Last Name</label>
                  <input
                    id="co_last" type="text"
                    value={lastName} onChange={(e) => setLastName(e.target.value)}
                    required autoComplete="family-name"
                  />
                </div>
              </div>

              <div className="join-form-row">
                <label htmlFor="co_email">Email Address</label>
                <input
                  id="co_email" type="email"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  required autoComplete="email"
                />
              </div>

              <div className="checkout-payment-note">
                <span>💳</span>
                <span>You'll be redirected to our secure payment page to complete your upgrade. No card stored here.</span>
              </div>

              {status && (
                <div className={`join-form-status join-form-status--${status.type}`} role="alert">
                  {status.message}
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary checkout-submit-btn"
                disabled={loading || expired}
              >
                {loading ? 'Redirecting to payment…' : `Upgrade to ${plan.name} →`}
              </button>

              <p className="checkout-secure-note">🔒 Secured checkout. Cancel anytime.</p>
            </form>
          </div>

        </div>
      </div>
    </div>
  )
}
