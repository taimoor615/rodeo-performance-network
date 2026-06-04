import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getCustomPosts } from '../services/wordpressApi'

const US_STATES = ['AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY']

export default function RidersPage() {
  const [viewMode, setViewMode] = useState('riders') // 'riders' | 'pickup_teams'

  // Riders state
  const [riders, setRiders] = useState([])
  const [ridersLoading, setRidersLoading] = useState(true)
  const [ridersError, setRidersError] = useState(null)

  // Pickup teams state
  const [teams, setTeams] = useState([])
  const [teamsLoading, setTeamsLoading] = useState(false)
  const [teamsError, setTeamsError] = useState(null)
  const [teamsFetched, setTeamsFetched] = useState(false)

  // Shared filter state
  const [search, setSearch] = useState('')
  const [stateFilter, setStateFilter] = useState('')
  const [sortBy, setSortBy] = useState('title')

  useEffect(() => {
    const params = { perPage: 100, _embed: true, orderby: 'title', order: 'asc' }
    if (search.trim()) params.search = search.trim()
    getCustomPosts('riders', params)
      .then(setRiders)
      .catch((err) => setRidersError(err.message))
      .finally(() => setRidersLoading(false))
  }, [search])

  useEffect(() => {
    if (viewMode !== 'pickup_teams' || teamsFetched) return
    setTeamsLoading(true)
    getCustomPosts('pickup_teams', { perPage: 100, _embed: true, orderby: 'title', order: 'asc' })
      .then((data) => setTeams(Array.isArray(data) ? data : []))
      .catch((err) => setTeamsError(err.message))
      .finally(() => { setTeamsLoading(false); setTeamsFetched(true) })
  }, [viewMode, teamsFetched])

  const filteredRiders = useMemo(() => {
    let list = riders
    if (stateFilter) {
      list = list.filter((r) => (r.meta?.state ?? r.acf?.state ?? '').toUpperCase() === stateFilter)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((r) => {
        const title = (r.title?.rendered ?? r.title ?? '').toLowerCase().replace(/<[^>]+>/g, '')
        const st = (r.meta?.state ?? r.acf?.state ?? '').toLowerCase()
        return title.includes(q) || st.includes(q)
      })
    }
    if (sortBy === 'rpi_desc') {
      list = [...list].sort((a, b) => Number(b.meta?.rpi ?? b.acf?.rpi ?? 0) - Number(a.meta?.rpi ?? a.acf?.rpi ?? 0))
    } else if (sortBy === 'rpi_asc') {
      list = [...list].sort((a, b) => Number(a.meta?.rpi ?? a.acf?.rpi ?? 0) - Number(b.meta?.rpi ?? b.acf?.rpi ?? 0))
    } else {
      list = [...list].sort((a, b) => {
        const ta = (a.title?.rendered ?? a.title ?? '').replace(/<[^>]+>/g, '').toLowerCase()
        const tb = (b.title?.rendered ?? b.title ?? '').replace(/<[^>]+>/g, '').toLowerCase()
        return ta.localeCompare(tb)
      })
    }
    return list
  }, [riders, search, stateFilter, sortBy])

  const filteredTeams = useMemo(() => {
    let list = teams
    if (stateFilter) {
      list = list.filter((t) => (t.meta?.state ?? t.acf?.state ?? '').toUpperCase() === stateFilter)
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((t) => {
        const title = (t.title?.rendered ?? t.title ?? '').toLowerCase().replace(/<[^>]+>/g, '')
        const st = (t.meta?.state ?? t.acf?.state ?? '').toLowerCase()
        return title.includes(q) || st.includes(q)
      })
    }
    if (sortBy === 'rpi_desc') {
      list = [...list].sort((a, b) => Number(b.meta?.pti ?? b.acf?.pti ?? 0) - Number(a.meta?.pti ?? a.acf?.pti ?? 0))
    } else if (sortBy === 'rpi_asc') {
      list = [...list].sort((a, b) => Number(a.meta?.pti ?? a.acf?.pti ?? 0) - Number(b.meta?.pti ?? b.acf?.pti ?? 0))
    } else {
      list = [...list].sort((a, b) => {
        const ta = (a.title?.rendered ?? a.title ?? '').replace(/<[^>]+>/g, '').toLowerCase()
        const tb = (b.title?.rendered ?? b.title ?? '').replace(/<[^>]+>/g, '').toLowerCase()
        return ta.localeCompare(tb)
      })
    }
    return list
  }, [teams, search, stateFilter, sortBy])

  const loading = viewMode === 'riders' ? ridersLoading : teamsLoading
  const error = viewMode === 'riders' ? ridersError : teamsError

  return (
    <div className="riders-page">
      <h1>Riders</h1>
      <p>Browse rider profiles with RPI scores, linked horses/stock, and media.</p>

      <div className="riders-tab-bar">
        <button
          type="button"
          className={`riders-tab-btn${viewMode === 'riders' ? ' riders-tab-btn--active' : ''}`}
          onClick={() => { setViewMode('riders'); setSearch(''); setStateFilter(''); setSortBy('title') }}
        >
          Riders
        </button>
        <button
          type="button"
          className={`riders-tab-btn${viewMode === 'pickup_teams' ? ' riders-tab-btn--active' : ''}`}
          onClick={() => { setViewMode('pickup_teams'); setSearch(''); setStateFilter(''); setSortBy('title') }}
        >
          Pickup Teams
        </button>
      </div>

      <div className="filters-bar">
        <input
          type="search"
          placeholder={viewMode === 'riders' ? 'Search by name…' : 'Search pickup teams…'}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="filter-input filter-search"
          aria-label={viewMode === 'riders' ? 'Search riders' : 'Search pickup teams'}
        />
        <select
          value={stateFilter}
          onChange={(e) => setStateFilter(e.target.value)}
          className="filter-select"
          aria-label="Filter by state"
        >
          <option value="">All States</option>
          {US_STATES.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="filter-select"
          aria-label="Sort by"
        >
          <option value="title">Name A–Z</option>
          {viewMode === 'riders' ? (
            <>
              <option value="rpi_desc">RPI (high to low)</option>
              <option value="rpi_asc">RPI (low to high)</option>
            </>
          ) : (
            <>
              <option value="rpi_desc">PTI (high to low)</option>
              <option value="rpi_asc">PTI (low to high)</option>
            </>
          )}
        </select>
      </div>

      {loading && <p className="loading">Loading {viewMode === 'riders' ? 'riders' : 'pickup teams'}...</p>}
      {error && <p className="error">{error}</p>}

      {/* Riders view */}
      {!loading && !error && viewMode === 'riders' && filteredRiders.length > 0 && (
        <div className="profile-grid">
          {filteredRiders.map((rider) => {
            const img = rider._embedded?.['wp:featuredmedia']?.[0]?.source_url
            const rpi = rider.meta?.rpi ?? rider.acf?.rpi
            const city = rider.meta?.city ?? rider.acf?.city ?? ''
            const state = rider.meta?.state ?? rider.acf?.state ?? ''
            const eventType = rider.meta?.event_type ?? rider.acf?.event_type ?? ''
            const ageGroup = rider.meta?.age_group ?? rider.acf?.age_group ?? ''
            const location = [city, state].filter(Boolean).join(', ')
            return (
              <Link to={`/riders/${rider.slug}`} key={rider.id} className="profile-card">
                {img ? (
                  <img src={img} alt="" className="profile-card-photo" />
                ) : (
                  <div className="profile-card-placeholder">R</div>
                )}
                <div className="profile-card-body">
                  <h3 className="profile-card-title">
                    <span dangerouslySetInnerHTML={{ __html: rider.title?.rendered }} />
                    {(rider.meta?.premium_member ?? rider.acf?.premium_member) && (
                      <span className="verified-badge" title="Premium member">✓</span>
                    )}
                  </h3>
                  {location && <p className="profile-card-meta">{location}</p>}
                  <div className="profile-card-tags">
                    {eventType && <span className="profile-card-tag">{eventType}</span>}
                    {ageGroup && <span className="profile-card-tag">{ageGroup}</span>}
                  </div>
                  {rpi != null && <span className="index-badge">RPI {Number(rpi).toFixed(1)}</span>}
                </div>
              </Link>
            )
          })}
        </div>
      )}
      {!loading && !error && viewMode === 'riders' && filteredRiders.length === 0 && (
        <p className="placeholder">No riders found.</p>
      )}

      {/* Pickup Teams view */}
      {!loading && !error && viewMode === 'pickup_teams' && filteredTeams.length > 0 && (
        <div className="pickup-teams-grid">
          {filteredTeams.map((team) => {
            const img = team._embedded?.['wp:featuredmedia']?.[0]?.source_url
            const pti = team.meta?.pti ?? team.acf?.pti
            const years = team.meta?.years_experience ?? team.acf?.years_experience
            const state = team.meta?.state ?? team.acf?.state
            const name = team.title?.rendered?.replace(/<[^>]+>/g, '') || 'Pickup Team'
            const initials = name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase()
            return (
              <Link to={`/pickup-teams/${team.slug}`} key={team.id} className="pickup-team-card">
                {img ? (
                  <img src={img} alt="" className="pickup-team-card-banner" />
                ) : (
                  <div className="pickup-team-card-banner-placeholder">{initials}</div>
                )}
                <div className="pickup-team-card-body">
                  <p className="pickup-team-card-name">{name}</p>
                  {state && <span className="pickup-team-card-meta">{state}</span>}
                  <div className="pickup-team-card-badges">
                    {pti != null && <span className="pickup-team-card-pti">PTI {Number(pti).toFixed(1)}</span>}
                    {years != null && <span className="pickup-team-card-exp">{years} yrs exp</span>}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
      {!loading && !error && viewMode === 'pickup_teams' && filteredTeams.length === 0 && (
        <p className="placeholder">No pickup teams found.</p>
      )}
    </div>
  )
}
