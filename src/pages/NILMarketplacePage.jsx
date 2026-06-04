import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getNILMarketplace, sendNILContact } from '../services/wordpressApi'

const DISCIPLINES = ['All', 'Bull Riding', 'Saddle Bronc', 'Bareback', 'Team Roping', 'Barrel Racing', 'Tie-Down Roping', 'Steer Wrestling']
const US_STATES   = ['All', 'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']

export default function NILMarketplacePage() {
  const [riders,     setRiders]     = useState([])
  const [loading,    setLoading]    = useState(true)
  const [error,      setError]      = useState(null)
  const [discipline, setDiscipline] = useState('All')
  const [state,      setState]      = useState('All')
  const [minRpi,     setMinRpi]     = useState('')
  const [contact,    setContact]    = useState(null)   // rider being contacted
  const [form,       setForm]       = useState({ brand_name: '', brand_email: '', brand_website: '', message: '' })
  const [sending,    setSending]    = useState(false)
  const [sent,       setSent]       = useState(false)
  const [sendError,  setSendError]  = useState(null)

  const load = () => {
    setLoading(true)
    setError(null)
    getNILMarketplace({
      discipline: discipline !== 'All' ? discipline : '',
      state:      state !== 'All'      ? state      : '',
      minRpi:     minRpi || 0,
    })
      .then((data) => setRiders(data.riders || []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [discipline, state, minRpi]) // eslint-disable-line react-hooks/exhaustive-deps

  const openContact = (rider) => {
    setContact(rider)
    setSent(false)
    setSendError(null)
    setForm({ brand_name: '', brand_email: '', brand_website: '', message: '' })
  }

  const handleContactSubmit = async (e) => {
    e.preventDefault()
    setSending(true)
    setSendError(null)
    try {
      await sendNILContact(contact.slug, form)
      setSent(true)
    } catch (err) {
      setSendError(err.message)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="nil-marketplace-page">
      <div className="nil-marketplace-hero">
        <h1>NIL Brand Marketplace</h1>
        <p>Connect with elite rodeo athletes open to sponsorships, endorsements, and brand partnerships.</p>
      </div>

      <div className="nil-marketplace-filters">
        <select value={discipline} onChange={(e) => setDiscipline(e.target.value)} className="nil-filter-select">
          {DISCIPLINES.map((d) => <option key={d} value={d}>{d === 'All' ? 'All Disciplines' : d}</option>)}
        </select>
        <select value={state} onChange={(e) => setState(e.target.value)} className="nil-filter-select">
          {US_STATES.map((s) => <option key={s} value={s}>{s === 'All' ? 'All States' : s}</option>)}
        </select>
        <input
          type="number"
          min="0"
          max="100"
          step="1"
          placeholder="Min RPI"
          value={minRpi}
          onChange={(e) => setMinRpi(e.target.value)}
          className="nil-filter-input"
        />
        <span className="nil-result-count">{riders.length} athlete{riders.length !== 1 ? 's' : ''}</span>
      </div>

      {loading && <p className="loading">Loading athletes…</p>}
      {error   && <p className="error">Error: {error}</p>}

      {!loading && !error && riders.length === 0 && (
        <p className="placeholder">No athletes match your filters. Try broadening your search.</p>
      )}

      {!loading && !error && riders.length > 0 && (
        <div className="nil-grid">
          {riders.map((rider) => (
            <div key={rider.id} className="nil-card">
              {rider.photo ? (
                <img src={rider.photo} alt="" className="nil-card-photo" />
              ) : (
                <div className="nil-card-photo nil-card-photo-placeholder">
                  {(rider.name || '?')[0].toUpperCase()}
                </div>
              )}
              <div className="nil-card-body">
                <h3 className="nil-card-name">{rider.name}</h3>
                {rider.discipline && <p className="nil-card-meta">{rider.discipline}</p>}
                {(rider.state) && <p className="nil-card-meta">{rider.state}</p>}
                {rider.rpi_current > 0 && (
                  <span className="nil-rpi-badge">RPI {Number(rider.rpi_current).toFixed(1)}</span>
                )}
                {rider.nil_note && <p className="nil-card-note">"{rider.nil_note}"</p>}
                {rider.sponsor && <p className="nil-card-sponsor">Currently partnered with: {rider.sponsor}</p>}
                <div className="nil-card-actions">
                  <Link to={`/riders/${rider.slug}`} className="btn btn-secondary btn-sm">View Profile</Link>
                  <button className="btn btn-primary btn-sm" onClick={() => openContact(rider)}>
                    Contact Athlete
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {contact && (
        <div className="nil-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setContact(null) }}>
          <div className="nil-modal">
            <button className="nil-modal-close" onClick={() => setContact(null)}>✕</button>
            {sent ? (
              <div className="nil-modal-success">
                <div className="nil-modal-success-icon">&#10003;</div>
                <h3>Inquiry Sent!</h3>
                <p>Your message was delivered to <strong>{contact.name}</strong>. They will reply directly to your email.</p>
                <button className="btn btn-secondary" onClick={() => setContact(null)}>Close</button>
              </div>
            ) : (
              <>
                <h2>Contact {contact.name}</h2>
                <p className="nil-modal-subtitle">Send a partnership inquiry. The athlete will receive it via email.</p>
                <form onSubmit={handleContactSubmit} className="nil-contact-form">
                  <label>
                    <span>Brand / Company Name <span className="required">*</span></span>
                    <input type="text" required value={form.brand_name} onChange={(e) => setForm({ ...form, brand_name: e.target.value })} />
                  </label>
                  <label>
                    <span>Your Email <span className="required">*</span></span>
                    <input type="email" required value={form.brand_email} onChange={(e) => setForm({ ...form, brand_email: e.target.value })} />
                  </label>
                  <label>
                    <span>Brand Website</span>
                    <input type="url" value={form.brand_website} onChange={(e) => setForm({ ...form, brand_website: e.target.value })} placeholder="https://" />
                  </label>
                  <label>
                    <span>Message <span className="required">*</span></span>
                    <textarea required rows={5} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })}
                      placeholder="Describe the partnership opportunity, product category, campaign details…" />
                  </label>
                  {sendError && <p className="error">{sendError}</p>}
                  <div className="nil-contact-form-actions">
                    <button type="button" className="btn btn-secondary" onClick={() => setContact(null)}>Cancel</button>
                    <button type="submit" className="btn btn-primary" disabled={sending}>
                      {sending ? 'Sending…' : 'Send Inquiry'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
