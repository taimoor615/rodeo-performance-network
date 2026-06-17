import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { WP_CONFIG } from '../config/wordpress'
import { getRevenueProducts } from '../services/wordpressApi'

/* --------------------------------------------------------------------------
 * RIN Membership tiers (source of truth for display + form submission)
 * -------------------------------------------------------------------------- */
const TIERS = [
  {
    key: 'rin_free',
    name: 'Fan Pass / Rider Preview',
    price: 0,
    interval: '',
    badge: 'Free',
    highlighted: false,
    cta: 'Create Free Profile',
    description: 'Get your RIN profile, browse riders and events, and preview your RPI score.',
    features: [
      'Browse all public rider & animal profiles',
      'Top 10 leaderboard per discipline',
      'View published event results',
      'Basic profile (name, discipline, home state, photo)',
      'Log results manually',
      'Locked RPI Preview badge',
      'One shareable public profile link',
    ],
    restrictions: [
      'No RPI calculated',
      'Leaderboard positions 11+ locked',
      'No verified badge',
    ],
  },
  {
    key: 'rin_competitor',
    name: 'Competitor Pro',
    price: 9.99,
    priceYear: 89,
    interval: 'month',
    badge: '★ Best Value',
    highlighted: true,
    cta: 'Get Competitor Pro',
    description: 'Full RPI tracking, score history, peer rankings, and a shareable sponsor-ready profile.',
    features: [
      'Everything in Free',
      'Full RPI or TPI calculated after every result',
      'Complete score history with season trends',
      'Discipline-specific performance breakdown',
      'Peer comparison (state & division rankings)',
      'NIL-ready shareable profile card',
      'Event tier history (PRCA, jackpot, college, HS)',
      'Eligible for verified profile badge',
      'Team roping: linked header/heeler profiles',
    ],
    restrictions: [],
  },
  {
    key: 'rin_contractor',
    name: 'Stock Contractor',
    price: 29.99,
    priceYear: 249,
    interval: 'month',
    badge: 'Contractor',
    highlighted: false,
    trialMonths: 3,
    cta: 'Start 3-Month Free Trial',
    description: 'SRI for your herd, shareable animal profiles, and a performance portfolio that markets your stock.',
    features: [
      'Everything in Competitor Pro',
      'SRI (Stock Rating Index) per animal',
      'Up to 25 animal profiles',
      'Shareable animal profile cards',
      'Herd performance dashboard (SRI trends)',
      'Buck-off rate & consistency scoring',
      'Event placement history per animal',
      'Rider + contractor under one account',
      'Barrel/performance horse TPI tracking',
    ],
    restrictions: [],
  },
  {
    key: 'rin_organizer',
    name: 'Event Organizer',
    price: 79.99,
    priceYear: 649,
    interval: 'month',
    badge: 'Producer',
    highlighted: false,
    trialMonths: 3,
    cta: 'Start 3-Month Free Trial',
    description: 'Direct score entry, Verified Event badge, and full event management for producers and sanctioning bodies.',
    features: [
      'Everything in Stock Contractor',
      'Direct score entry for your events',
      'Verified Event badge (higher RPI weight)',
      'Manage up to 50 events/year',
      'Bulk CSV results import',
      'Event analytics dashboard',
      'Priority listing in RIN event directory',
      'Re-ride & DNC/NT flag management',
      'Early API integration access',
    ],
    restrictions: [],
  },
  {
    key: 'rin_enterprise',
    name: 'Enterprise / Association',
    price: null,
    priceYear: null,
    interval: '',
    badge: 'Enterprise',
    highlighted: false,
    cta: 'Contact Us',
    description: 'Unlimited events, association leaderboards, bulk enrollment, white-label options, and API access.',
    features: [
      'Everything in Event Organizer',
      'Unlimited events & users',
      'Association-level leaderboards & reports',
      'Co-branded member profile pages',
      'Bulk member enrollment',
      'Custom data exports (media, broadcast)',
      'White-label performance indexes',
      'Dedicated account support',
    ],
    restrictions: [],
  },
]


const JOIN_AS_OPTIONS = [
  { value: 'rider',        label: 'Rider / Competitor' },
  { value: 'producer',     label: 'Producer' },
  { value: 'contractor',   label: 'Stock Contractor' },
  { value: 'pickup_team',  label: 'Pickup Team' },
]

export default function JoinUsPage() {
  const navigate = useNavigate()
  const { isAuthenticated, loading: authLoading } = useAuth()

  const [revenueProducts, setRevenueProducts] = useState([])
  const [selectedTierKey, setSelectedTierKey] = useState('')
  const [billingInterval, setBillingInterval] = useState('month')
  const [joiningAs, setJoiningAs] = useState('rider')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [email, setEmail] = useState('')
  const [organizationName, setOrganizationName] = useState('')
  const [producerLicenseId, setProducerLicenseId] = useState('')
  const [agreeTerms, setAgreeTerms] = useState(false)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)
  const [signupSuccess, setSignupSuccess] = useState(false)
  const formRef = useRef(null)

  // Strategic add-ons
  const [applyStudentDiscount, setApplyStudentDiscount] = useState(false)
  const [studentOrg, setStudentOrg] = useState('')   // NHSRA | NIRA | edu
  const [studentEmail, setStudentEmail] = useState('')
  const [partnerBundle, setPartnerBundle] = useState(false)
  const [partnerEmail, setPartnerEmail] = useState('')

  const isOrgRole = joiningAs === 'producer' || joiningAs === 'contractor' || joiningAs === 'pickup_team'

  // Auto-select the correct plan when joiningAs changes
  useEffect(() => {
    if (joiningAs === 'contractor') {
      setSelectedTierKey('rin_contractor')
      setApplyStudentDiscount(false)
      setPartnerBundle(false)
    } else if (joiningAs === 'producer') {
      setSelectedTierKey('rin_organizer')
      setApplyStudentDiscount(false)
      setPartnerBundle(false)
    } else if (selectedTierKey === 'rin_contractor' || selectedTierKey === 'rin_organizer') {
      setSelectedTierKey('')
    }
  }, [joiningAs]) // eslint-disable-line react-hooks/exhaustive-deps

  // Effective product key — resolves to yearly variant when yearly billing is selected
  const effectiveTierKey = (() => {
    if (selectedTierKey === 'rin_competitor' && billingInterval === 'year') {
      if (partnerBundle)        return 'rin_competitor_bundle'
      if (applyStudentDiscount) return 'rin_competitor_student'
      return 'rin_competitor_yearly'
    }
    if (
      billingInterval === 'year' &&
      selectedTierKey &&
      selectedTierKey !== 'rin_free' &&
      selectedTierKey !== 'rin_enterprise'
    ) {
      return selectedTierKey + '_yearly'
    }
    return selectedTierKey
  })()

  // Effective display price
  const effectivePrice = (() => {
    if (effectiveTierKey === 'rin_competitor_bundle')  return { amount: 149, label: '$149/yr (2 accounts)' }
    if (effectiveTierKey === 'rin_competitor_student') return { amount: 39,  label: '$39/yr (student rate)' }
    return null
  })()

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && isAuthenticated) navigate('/dashboard', { replace: true })
  }, [isAuthenticated, authLoading, navigate])

  // Fetch WooCommerce product IDs for checkout URL resolution
  useEffect(() => {
    getRevenueProducts()
      .then((res) => setRevenueProducts(Array.isArray(res?.products) ? res.products : []))
      .catch(() => setRevenueProducts([]))
  }, [])

  // Resolve WooCommerce product_id for paid plans
  const getProductId = (tierKey) => {
    if (!tierKey || tierKey === 'rin_free') return undefined
    const product = revenueProducts.find((p) => String(p.key) === tierKey)
    return product?.product_id ?? undefined
  }

  const selectedTier = TIERS.find((t) => t.key === selectedTierKey) || null

  // Plans shown in the form dropdown — filtered by role to enforce upgrade path rules
  const availableTiers = TIERS.filter((t) => {
    if (joiningAs === 'contractor') return t.key === 'rin_contractor'
    if (joiningAs === 'producer')   return t.key === 'rin_organizer'
    // rider / pickup_team: only Free and Competitor Pro
    return t.key === 'rin_free' || t.key === 'rin_competitor'
  })

  const handleSelectTier = (key) => {
    setSelectedTierKey(key)
    setStatus(null)
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus(null)
    if (!selectedTierKey) {
      setStatus({ type: 'error', message: 'Please select a membership plan.' })
      return
    }
    if (!firstName.trim() || !lastName.trim()) {
      setStatus({ type: 'error', message: 'First and last name are required.' })
      return
    }
    if (!email.trim()) {
      setStatus({ type: 'error', message: 'Email address is required.' })
      return
    }
    if (!agreeTerms) {
      setStatus({ type: 'error', message: 'Please agree to the Terms of Service and Privacy Policy.' })
      return
    }

    setLoading(true)
    try {
      const productId = getProductId(effectiveTierKey)
      const payload = {
        joining_as: joiningAs,
        membership_plan: effectiveTierKey,
        product_id: productId,
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        ...(isOrgRole && organizationName.trim() ? { organization_name: organizationName.trim() } : {}),
        ...(isOrgRole && producerLicenseId.trim() ? { producer_license_id: producerLicenseId.trim() } : {}),
        ...(partnerBundle && partnerEmail.trim() ? { partner_email: partnerEmail.trim() } : {}),
        ...(applyStudentDiscount && studentOrg ? { student_org: studentOrg } : {}),
        ...(applyStudentDiscount && studentOrg === 'edu' && studentEmail.trim() ? { student_email: studentEmail.trim() } : {}),
      }
      const res = await fetch(`${WP_CONFIG.apiUrl}/rpn/v1/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json().catch(() => ({}))
      if (res.ok && data.success !== false) {
        if (data.checkout_url) {
          setStatus({ type: 'success', message: 'Account created! Redirecting to payment…' })
          setTimeout(() => { window.location.href = data.checkout_url }, 1500)
        } else {
          setSignupSuccess(true)
        }
      } else {
        setStatus({ type: 'error', message: data.message || 'Something went wrong. Please try again.' })
      }
    } catch (err) {
      setStatus({ type: 'error', message: err.message || 'Could not connect. Check your connection.' })
    } finally {
      setLoading(false)
    }
  }

  if (authLoading || isAuthenticated) {
    return <div className="join-us-page"><p className="loading">Loading...</p></div>
  }

  return (
    <div className="join-us-page">

      {/* Signup success popup */}
      {signupSuccess && (
        <div className="signup-success-overlay" role="dialog" aria-modal="true" aria-labelledby="signup-success-title">
          <div className="signup-success-popup">
            <button
              type="button"
              className="signup-success-close"
              onClick={() => setSignupSuccess(false)}
              aria-label="Close"
            >
              &times;
            </button>
            <div className="signup-success-icon" aria-hidden="true">&#10003;</div>
            <h2 id="signup-success-title" className="signup-success-title">You're in!</h2>
            <p className="signup-success-msg">
              Thank you for signing up. Please check your email for your login information.
            </p>
            <a href="/login" className="signup-success-btn">Go to Login &rarr;</a>
          </div>
        </div>
      )}

      <header className="join-hero">
        <h1>Join RIN</h1>
        <p className="join-hero-tagline">
          Create your RIN profile. Track your performance. Get ranked.
        </p>
      </header>

      {/* ---- Tier comparison cards ---- */}
      <section className="join-plans-section">
        <h2>Membership Plans</h2>
        <p className="join-plans-desc">
          All plans include a RIN ID. Competitor Pro includes a 30-day free trial. Stock Contractor &amp; Event Organizer plans include a <strong>3-month free trial</strong> for qualified businesses.
        </p>

        <div className="join-billing-toggle">
          <button
            type="button"
            className={`join-billing-btn ${billingInterval === 'month' ? 'active' : ''}`}
            onClick={() => setBillingInterval('month')}
          >
            Monthly
          </button>
          <button
            type="button"
            className={`join-billing-btn ${billingInterval === 'year' ? 'active' : ''}`}
            onClick={() => setBillingInterval('year')}
          >
            Yearly <span className="join-billing-save">Save ~25–30%</span>
          </button>
        </div>
        {billingInterval === 'year' && (
          <p className="join-billing-renewal-note">
            Annual plans renew <strong>October 1</strong> — the start of rodeo season.
          </p>
        )}

        <div className="join-plans-grid">
          {TIERS.map((t) => {
            const showYear = billingInterval === 'year' && t.priceYear != null
            const displayPrice = showYear ? t.priceYear : t.price
            const displayInterval = showYear ? 'year' : t.interval
            const isSelected = selectedTierKey === t.key
            return (
              <div
                key={t.key}
                className={`join-plan-card${t.highlighted ? ' join-plan-card-highlighted' : ''}${isSelected ? ' join-plan-card-selected' : ''}`}
                onClick={() => handleSelectTier(t.key)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && handleSelectTier(t.key)}
                aria-pressed={isSelected}
              >
                <div className="join-plan-badge">{t.badge}</div>
                {t.trialMonths && (
                  <div className="join-plan-trial-tag">{t.trialMonths} months free to start</div>
                )}
                <h3 className="join-plan-name">{t.name}</h3>
                <div className="join-plan-price">
                  {t.price === null ? (
                    <span className="join-plan-amount join-plan-amount--custom">Custom</span>
                  ) : displayPrice > 0 ? (
                    <>
                      <span className="join-plan-amount">${displayPrice}</span>
                      {displayInterval && <span className="join-plan-interval">/{displayInterval}</span>}
                    </>
                  ) : (
                    <span className="join-plan-amount">Free</span>
                  )}
                </div>
                <p className="join-plan-desc">{t.description}</p>
                <ul className="join-plan-features">
                  {t.features.map((f, i) => (
                    <li key={i} className="join-plan-feature join-plan-feature--check">{f}</li>
                  ))}
                  {t.restrictions.map((r, i) => (
                    <li key={`r${i}`} className="join-plan-feature join-plan-feature--lock">{r}</li>
                  ))}
                </ul>
                <button
                  type="button"
                  className={`btn${t.highlighted ? ' btn-primary' : ' btn-secondary'} join-plan-cta`}
                  onClick={(e) => { e.stopPropagation(); handleSelectTier(t.key) }}
                >
                  {t.cta}
                </button>
              </div>
            )
          })}
        </div>

        {/* ── Special Bundles ─────────────────────────────────────────────── */}
        <div className="join-bundles-row">

          {/* Team Roping Partner Bundle */}
          <div
            className={`join-bundle-card${selectedTierKey === 'rin_competitor' && billingInterval === 'year' && partnerBundle ? ' join-bundle-card--selected' : ''}`}
            onClick={() => {
              setBillingInterval('year')
              setSelectedTierKey('rin_competitor')
              setPartnerBundle(true)
              setApplyStudentDiscount(false)
              setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
            }}
            role="button" tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.click()}
          >
            <span className="join-bundle-eyebrow">Team Roping</span>
            <h3 className="join-bundle-title">Roping Partner Bundle</h3>
            <div className="join-bundle-price">$149<span>/yr</span></div>
            <p className="join-bundle-sub">Two Competitor Pro accounts — saves $29 vs. two individual annual plans</p>
            <ul className="join-bundle-features">
              <li>Both header &amp; heeler get full RPI tracking</li>
              <li>Shared run history linked via run ID</li>
              <li>NIL-ready profiles for both athletes</li>
              <li>Annual renewal October 1</li>
            </ul>
            <button type="button" className="btn btn-primary join-plan-cta" onClick={() => {
              setBillingInterval('year')
              setSelectedTierKey('rin_competitor')
              setPartnerBundle(true)
              setApplyStudentDiscount(false)
              setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
            }}>
              Select Bundle →
            </button>
          </div>

          {/* Youth / Student Discount */}
          <div
            className={`join-bundle-card join-bundle-card--student${selectedTierKey === 'rin_competitor' && billingInterval === 'year' && applyStudentDiscount ? ' join-bundle-card--selected' : ''}`}
            onClick={() => {
              setBillingInterval('year')
              setSelectedTierKey('rin_competitor')
              setApplyStudentDiscount(true)
              setPartnerBundle(false)
              setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
            }}
            role="button" tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.click()}
          >
            <span className="join-bundle-eyebrow">Youth &amp; Student</span>
            <h3 className="join-bundle-title">Student Rate</h3>
            <div className="join-bundle-price">$39<span>/yr</span></div>
            <p className="join-bundle-sub">Full Competitor Pro for verified NHSRA, NIRA, or college (.edu) athletes</p>
            <ul className="join-bundle-features">
              <li>Full RPI &amp; TPI calculated</li>
              <li>Season trends &amp; peer comparison</li>
              <li>NIL-ready profile for recruiting</li>
              <li>Verified with NHSRA / NIRA / .edu email</li>
            </ul>
            <button type="button" className="btn btn-secondary join-plan-cta" onClick={() => {
              setBillingInterval('year')
              setSelectedTierKey('rin_competitor')
              setApplyStudentDiscount(true)
              setPartnerBundle(false)
              setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
            }}>
              Apply Student Rate →
            </button>
          </div>

        </div>
      </section>

      {/* ---- Registration form ---- */}
      <section className="join-form-section" id="register" ref={formRef}>

        <div className="join-form-inner">
          <h2>Create Your Account</h2>

          {selectedTier && (
            <div className="join-form-plan-summary">
              <span className="join-form-plan-label">Selected:</span>
              <strong>
                {effectivePrice
                  ? (effectiveTierKey === 'rin_competitor_bundle' ? 'Roping Partner Bundle' : 'Student Rate — Competitor Pro')
                  : selectedTier.name}
              </strong>
              {effectivePrice ? (
                <span className="join-form-plan-price"> — {effectivePrice.label}</span>
              ) : selectedTier.price === null ? (
                <span className="join-form-plan-price"> — Custom pricing</span>
              ) : selectedTier.price > 0 ? (
                <span className="join-form-plan-price">
                  — ${billingInterval === 'year' && selectedTier.priceYear ? selectedTier.priceYear : selectedTier.price}
                  /{billingInterval === 'year' && selectedTier.priceYear ? 'year' : 'month'}
                </span>
              ) : (
                <span className="join-form-plan-price"> — Free</span>
              )}
            </div>
          )}

          <form className="join-form" onSubmit={handleSubmit} noValidate>

            <div className="join-form-row">
              <label htmlFor="joining_as">Joining As</label>
              <select
                id="joining_as"
                value={joiningAs}
                onChange={(e) => setJoiningAs(e.target.value)}
                required
              >
                {JOIN_AS_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            <div className="join-form-row">
              <label htmlFor="membership_plan">Membership Plan</label>
              {partnerBundle ? (
                <input type="text" value="Roping Partner Bundle — $149/yr (2 accounts)" disabled style={{ background: '#f3f4f6', cursor: 'not-allowed' }} />
              ) : applyStudentDiscount ? (
                <input type="text" value="Student Rate — Competitor Pro — $39/yr" disabled style={{ background: '#f3f4f6', cursor: 'not-allowed' }} />
              ) : (
                <select
                  id="membership_plan"
                  value={selectedTierKey}
                  onChange={(e) => { setSelectedTierKey(e.target.value); handleSelectTier(e.target.value) }}
                  required
                >
                  <option value="">Select a plan…</option>
                  {availableTiers.map((t) => {
                    const showYear = billingInterval === 'year' && t.priceYear != null
                    const price = showYear ? t.priceYear : t.price
                    const interval = showYear ? 'year' : t.interval
                    const label = t.price === null
                      ? `${t.name} — Custom`
                      : price > 0
                        ? `${t.name} — $${price}/${interval}`
                        : `${t.name} — Free`
                    return <option key={t.key} value={t.key}>{label}</option>
                  })}
                </select>
              )}
            </div>

            <div className="join-form-row join-form-row--half">
              <div>
                <label htmlFor="first_name">First Name</label>
                <input
                  id="first_name" type="text"
                  value={firstName} onChange={(e) => setFirstName(e.target.value)}
                  required autoComplete="given-name"
                />
              </div>
              <div>
                <label htmlFor="last_name">Last Name</label>
                <input
                  id="last_name" type="text"
                  value={lastName} onChange={(e) => setLastName(e.target.value)}
                  required autoComplete="family-name"
                />
              </div>
            </div>

            <div className="join-form-row">
              <label htmlFor="email">Email Address</label>
              <input
                id="email" type="email"
                value={email} onChange={(e) => setEmail(e.target.value)}
                required autoComplete="email"
              />
            </div>

            {isOrgRole && (
              <>
                <div className="join-form-row">
                  <label htmlFor="organization_name">Organization Name</label>
                  <input
                    id="organization_name" type="text"
                    value={organizationName} onChange={(e) => setOrganizationName(e.target.value)}
                    placeholder={joiningAs === 'producer' ? 'Your rodeo production company name' : joiningAs === 'pickup_team' ? 'Your pickup team name' : 'Your stock contracting company name'}
                    autoComplete="organization"
                  />
                </div>
                <div className="join-form-row">
                  <label htmlFor="producer_license_id">
                    {joiningAs === 'producer' ? 'Producer License ID' : joiningAs === 'pickup_team' ? 'Team License ID' : 'Contractor License ID'}
                    <span className="join-form-label-hint"> (optional)</span>
                  </label>
                  <input
                    id="producer_license_id" type="text"
                    value={producerLicenseId} onChange={(e) => setProducerLicenseId(e.target.value)}
                    placeholder="e.g. PRO-12345"
                  />
                </div>
              </>
            )}

            {/* Partner Bundle extra field */}
            {partnerBundle && selectedTierKey === 'rin_competitor' && billingInterval === 'year' && (
              <div className="join-form-bundle-block">
                <p className="join-form-bundle-title">Roping Partner Bundle — $149/yr</p>
                <div className="join-form-row">
                  <label htmlFor="partner_email">Roping Partner's Email</label>
                  <input
                    id="partner_email" type="email"
                    value={partnerEmail} onChange={(e) => setPartnerEmail(e.target.value)}
                    placeholder="partner@example.com"
                  />
                  <span className="join-form-label-hint">Your partner will receive an invitation to link their account.</span>
                </div>
                <button type="button" className="join-clear-addon" onClick={() => setPartnerBundle(false)}>Remove bundle</button>
              </div>
            )}

            {/* Student Discount extra field */}
            {applyStudentDiscount && selectedTierKey === 'rin_competitor' && billingInterval === 'year' && (
              <div className="join-form-bundle-block">
                <p className="join-form-bundle-title">Student / Youth Rate — $39/yr</p>
                <div className="join-form-row">
                  <label htmlFor="student_org">Verify Eligibility</label>
                  <select
                    id="student_org" value={studentOrg} onChange={(e) => setStudentOrg(e.target.value)} required
                  >
                    <option value="">Select verification type…</option>
                    <option value="NHSRA">NHSRA member (high school)</option>
                    <option value="NIRA">NIRA member (college)</option>
                    <option value="edu">College / university .edu email</option>
                  </select>
                  <span className="join-form-label-hint">Eligibility is verified during account activation.</span>
                </div>
                {studentOrg === 'edu' && (
                  <div className="join-form-row">
                    <label htmlFor="student_email">School Email (.edu)</label>
                    <input
                      id="student_email" type="email"
                      value={studentEmail} onChange={(e) => setStudentEmail(e.target.value)}
                      placeholder="you@university.edu"
                      required
                    />
                    <span className="join-form-label-hint">Enter your .edu email address for verification.</span>
                  </div>
                )}
                <button type="button" className="join-clear-addon" onClick={() => { setApplyStudentDiscount(false); setStudentOrg(''); setStudentEmail('') }}>Remove discount</button>
              </div>
            )}

            <div className="join-form-row join-form-row--checkbox">
              <label className="join-checkbox-label">
                <input
                  type="checkbox"
                  checked={agreeTerms}
                  onChange={(e) => setAgreeTerms(e.target.checked)}
                  required
                />
                <span>
                  I agree to the{' '}
                  <a href="/terms" target="_blank" rel="noopener noreferrer">Terms of Service</a>
                  {' '}and{' '}
                  <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy Policy</a>.
                </span>
              </label>
            </div>

            {status && (
              <div className={`join-form-status join-form-status--${status.type}`} role="alert">
                {status.message}
              </div>
            )}

            <div className="join-form-actions">
              <button
                type="submit"
                className="btn btn-primary btn-join-submit"
                disabled={loading}
              >
                {loading
                  ? 'Creating Account…'
                  : effectiveTierKey === 'rin_competitor_bundle'
                    ? 'Get Partner Bundle ($149/yr) →'
                    : effectiveTierKey === 'rin_competitor_student'
                      ? 'Get Student Rate ($39/yr) →'
                      : selectedTier?.trialMonths
                        ? `Start ${selectedTier.trialMonths}-Month Free Trial →`
                        : selectedTier?.price === null
                          ? 'Submit Enquiry →'
                          : selectedTier?.price > 0
                            ? `Get ${selectedTier.name} →`
                            : 'Create Free Profile →'}
              </button>
            </div>

            <p className="join-form-login-note">
              Already have an account?{' '}
              <a href="/login">Log in here</a>
            </p>
          </form>
        </div>
      </section>
    </div>
  )
}
