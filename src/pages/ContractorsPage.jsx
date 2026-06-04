import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCustomPosts } from '../services/wordpressApi'

export default function ContractorsPage() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getCustomPosts('contractors', { perPage: 50, _embed: true })
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="contractors-page pickup-teams-page">
      <div className="contractors-page-header">
        <div>
          <h1>Contractors</h1>
          <p className="pickup-teams-desc">
            Stock contractors rated by CRI (Contractor Rating Index). Verified contractors are badge-eligible.
          </p>
        </div>
        <Link to="/contractors/rankings" className="btn btn-primary">View Contractor Rankings</Link>
      </div>

      {loading && <p className="loading">Loading contractors...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && list.length > 0 && (
        <div className="profile-grid">
          {list.map((c) => {
            const img = c._embedded?.['wp:featuredmedia']?.[0]?.source_url
            const cri = c.meta?.cri ?? c.acf?.cri
            const code = c.meta?.contractor_code ?? c.acf?.contractor_code
            const verified = c.meta?.verified ?? c.acf?.verified
            const city = c.meta?.city ?? c.acf?.city
            const state = c.meta?.state ?? c.acf?.state
            const title = c.title?.rendered?.replace(/<[^>]+>/g, '') || 'Contractor'
            return (
              <Link to={`/contractors/${c.slug}`} key={c.id} className="profile-card">
                {img ? (
                  <img src={img} alt="" className="profile-card-photo" />
                ) : (
                  <div className="profile-card-placeholder">{code?.[0] || 'C'}</div>
                )}
                <div className="profile-card-body">
                  <span className="profile-card-title">{title}</span>
                  {(city || state) && (
                    <p className="profile-card-meta">{[city, state].filter(Boolean).join(', ')}</p>
                  )}
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                    {cri != null && <span className="index-badge">CRI {Number(cri).toFixed(1)}</span>}
                    {verified && <span className="verified-badge">Verified</span>}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {!loading && !error && list.length === 0 && (
        <p className="placeholder">No contractors registered yet. Check back soon.</p>
      )}
    </div>
  )
}
