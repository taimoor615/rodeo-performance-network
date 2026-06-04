import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getCustomPosts } from '../services/wordpressApi'

const US_STATES = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY']

const US_REGIONS = [
  { value: 'Northeast', states: ['CT', 'ME', 'MA', 'NH', 'NJ', 'NY', 'PA', 'RI', 'VT'] },
  { value: 'Southeast', states: ['AL', 'AR', 'DE', 'FL', 'GA', 'KY', 'LA', 'MD', 'MS', 'NC', 'SC', 'TN', 'VA', 'WV'] },
  { value: 'Midwest', states: ['IL', 'IN', 'IA', 'KS', 'MI', 'MN', 'MO', 'NE', 'ND', 'OH', 'SD', 'WI'] },
  { value: 'Southwest', states: ['AZ', 'NM', 'OK', 'TX'] },
  { value: 'West', states: ['AK', 'CA', 'CO', 'HI', 'ID', 'MT', 'NV', 'OR', 'UT', 'WA', 'WY'] },
]

export default function ProducersPage() {
  const [list, setList] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [regionFilter, setRegionFilter] = useState('')

  useEffect(() => {
    getCustomPosts('producers', { perPage: 100, _embed: true })
      .then((data) => setList(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const filtered = useMemo(() => {
    let result = list
    if (stateFilter) {
      result = result.filter((p) => (p.meta?.state ?? p.acf?.state ?? '').toUpperCase() === stateFilter)
    } else if (regionFilter) {
      const region = US_REGIONS.find((r) => r.value === regionFilter)
      if (region) {
        result = result.filter((p) => region.states.includes((p.meta?.state ?? p.acf?.state ?? '').toUpperCase()))
      }
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      result = result.filter((p) => {
        const title = (p.title?.rendered ?? p.title ?? '').toLowerCase().replace(/<[^>]+>/g, '')
        const state = (p.meta?.state ?? p.acf?.state ?? '').toLowerCase()
        return title.includes(q) || state.includes(q)
      })
    }
    return result
  }, [list, stateFilter, regionFilter, search])

  return (
    <div className="producers-page contractors-page">
      <h1>Event Organizations</h1>
      <p className="pickup-teams-desc">
        Event producers and organizations can create their page, advertise events, and collect payments. Rated by PRI (Producer Rating Index).
      </p>

      <div className="filters-bar">
        <input
          type="search"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="filter-input filter-search"
          aria-label="Search organizations"
        />
        <select
          value={regionFilter}
          onChange={(e) => { setRegionFilter(e.target.value); setStateFilter('') }}
          className="filter-select"
          aria-label="Filter by region"
        >
          <option value="">All Regions</option>
          {US_REGIONS.map((r) => (
            <option key={r.value} value={r.value}>{r.value}</option>
          ))}
        </select>
        <select
          value={stateFilter}
          onChange={(e) => { setStateFilter(e.target.value); setRegionFilter('') }}
          className="filter-select"
          aria-label="Filter by state"
        >
          <option value="">All States</option>
          {US_STATES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {loading && <p className="loading">Loading organizations...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && filtered.length > 0 && (
        <div className="profile-grid">
          {filtered.map((p) => {
            const img = p._embedded?.['wp:featuredmedia']?.[0]?.source_url
            const pri = p.meta?.pri ?? p.acf?.pri
            const verified = p.meta?.verified ?? p.acf?.verified
            const state = p.meta?.state ?? p.acf?.state
            const title = p.title?.rendered?.replace(/<[^>]+>/g, '') || 'Organization'
            return (
              <Link to={`/producers/${p.slug}`} key={p.id} className="profile-card">
                {img ? (
                  <img src={img} alt="" className="profile-card-photo" />
                ) : (
                  <div className="profile-card-placeholder">ORG</div>
                )}
                <div className="profile-card-body">
                  <span className="profile-card-title">{title}</span>
                  {state && <p className="profile-card-meta">{state}</p>}
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                    {pri != null && <span className="index-badge">PRI {Number(pri).toFixed(1)}</span>}
                    {verified && <span className="verified-badge">Verified</span>}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <p className="placeholder">No organizations found. Try a different state or region.</p>
      )}
    </div>
  )
}
