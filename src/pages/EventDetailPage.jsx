import { useParams, Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { getEventBySlug, getEventResults, getCustomPosts } from '../services/wordpressApi'
import { getEventImage } from '../utils/placeholders'

const ROUND_TABS = [
  { id: 'overall',      label: 'Overall Results' },
  { id: 'round1',       label: 'Round 1' },
  { id: 'round2',       label: 'Round 2' },
  { id: 'championship', label: 'Championship Round' },
]

function buildMediaMap(posts) {
  const m = {}
  ;(Array.isArray(posts) ? posts : []).forEach((p) => {
    const id = p.id != null ? Number(p.id) : null
    if (!id) return
    m[id] = {
      name: typeof p.title === 'string' ? p.title : p.title?.rendered?.replace?.(/<[^>]+>/g, '') || '',
      slug: p.slug,
      imageUrl: p._embedded?.['wp:featuredmedia']?.[0]?.source_url || null,
    }
  })
  return m
}

export default function EventDetailPage() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const { isAuthenticated } = useAuth()
  const [event, setEvent] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [activeRound, setActiveRound] = useState('overall')
  const [riderMap, setRiderMap] = useState({})
  const [animalMap, setAnimalMap] = useState({})
  const [computed, setComputed] = useState(null)

  useEffect(() => {
    getEventBySlug(slug)
      .then(setEvent)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [slug])

  // After event loads: fetch computed results + rider/animal images
  useEffect(() => {
    if (!event) return

    // Computed results from rider submissions
    getEventResults(event.id).then(setComputed).catch(() => {})

    const allResults = [
      ...(event.event_results || []),
      ...(event.round_1_results || []),
      ...(event.round_2_results || []),
      ...(event.championship_round_results || []),
    ]
    const hasRiders  = allResults.some((r) => r.rider_id)
    const hasAnimals = allResults.some((r) => r.animal_id)

    if (hasRiders) {
      getCustomPosts('riders', { perPage: 100, _embed: true })
        .then((data) => setRiderMap(buildMediaMap(data)))
        .catch(() => {})
    }
    if (hasAnimals) {
      getCustomPosts('animals', { perPage: 100, _embed: true })
        .then((data) => setAnimalMap(buildMediaMap(data)))
        .catch(() => {})
    }
  }, [event])

  if (loading) return <p className="loading">Loading event...</p>
  if (error) return <p className="error">Error: {error}</p>
  if (!event) return <p className="placeholder">Event not found.</p>

  const title = typeof event.title === 'string' ? event.title : event.title?.rendered?.replace?.(/<[^>]+>/g, '') || 'Event'
  const img = event._embedded?.['wp:featuredmedia']?.[0]?.source_url || getEventImage(event)
  const eventDate = event.meta?.event_date ?? event.acf?.event_date
  const eventEndDate = event.meta?.event_end_date ?? event.acf?.event_end_date
  const venue = event.meta?.venue ?? event.acf?.venue
  const city = event.meta?.city ?? event.acf?.city
  const state = event.meta?.state ?? event.acf?.state
  const tier = event.meta?.event_tier ?? event.acf?.event_tier
  const arena = event.meta?.arena_condition ?? event.acf?.arena_condition
  const weather = event.meta?.weather_condition ?? event.acf?.weather_condition

  return (
    <div className="profile-detail event-detail">
      <Link to="/events" className="back-link">← Back to Events</Link>

      <header className="profile-detail-header">
        <img src={img} alt="" className="profile-detail-photo" style={{ maxWidth: '320px', aspectRatio: '16/10' }} />
        <div>
          <div className="profile-detail-eyebrow">{tier || 'Event'}</div>
          <h1 className="profile-detail-title">{title}</h1>
          {event.content?.rendered && (
            <p className="profile-detail-bio" dangerouslySetInnerHTML={{ __html: event.content.rendered }} />
          )}
          {eventDate && (
            <p className="profile-detail-subtitle">
              {new Date(eventDate).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              {eventEndDate && eventEndDate !== eventDate && ` – ${new Date(eventEndDate).toLocaleDateString()}`}
            </p>
          )}
          {(venue || city || state) && (
            <p className="profile-detail-subtitle">
              {[venue, city, state].filter(Boolean).join(' · ')}
            </p>
          )}
          {tier && <span className="index-badge">{tier}</span>}
        </div>
      </header>

      <div className="rpn-card">
        <div className="rpn-card-header">Event details</div>
        <div className="rpn-card-body">
          <div className="profile-detail-stats">
            {arena && (
              <div className="profile-detail-stat">
                <span className="profile-detail-stat-label">Arena condition</span>
                <div className="profile-detail-stat-value">{arena}</div>
              </div>
            )}
            {weather && (
              <div className="profile-detail-stat">
                <span className="profile-detail-stat-label">Weather</span>
                <div className="profile-detail-stat-value">{weather}</div>
              </div>
            )}
            {tier && (
              <div className="profile-detail-stat">
                <span className="profile-detail-stat-label">Event tier</span>
                <div className="profile-detail-stat-value">{tier}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---- Results by round ---- */}
      <section className="profile-detail-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
          <h3 style={{ margin: 0 }}>Results</h3>
          {isAuthenticated && (
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => navigate(`/dashboard?tab=scores&event_id=${event.id}&event_name=${encodeURIComponent(typeof event.title === 'string' ? event.title : event.title?.rendered?.replace?.(/<[^>]+>/g, '') || '')}`)}
            >
              + Log My Score
            </button>
          )}
        </div>
        {computed?.total_performances > 0 && (
          <p style={{ fontSize: '0.8rem', color: '#6b7280', marginBottom: '0.5rem' }}>
            {computed.total_performances} submitted result{computed.total_performances !== 1 ? 's' : ''} · auto-calculated
          </p>
        )}
        <nav className="event-round-tabs" aria-label="Event rounds">
          {ROUND_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`event-round-tab${activeRound === tab.id ? ' event-round-tab--active' : ''}`}
              onClick={() => setActiveRound(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeRound === 'overall' && (
          <EventResultsTable
            rows={computed?.overall?.length > 0 ? computed.overall : event.event_results}
            riderMap={riderMap}
          />
        )}
        {activeRound === 'round1' && (
          <RoundResultsTable
            round={computed?.round_1?.length > 0 ? computed.round_1 : event.round_1_results}
            riderMap={riderMap} animalMap={animalMap}
          />
        )}
        {activeRound === 'round2' && (
          <RoundResultsTable
            round={computed?.round_2?.length > 0 ? computed.round_2 : event.round_2_results}
            riderMap={riderMap} animalMap={animalMap}
          />
        )}
        {activeRound === 'championship' && (
          <RoundResultsTable
            round={computed?.championship_round?.length > 0 ? computed.championship_round : event.championship_round_results}
            riderMap={riderMap} animalMap={animalMap}
          />
        )}
      </section>
    </div>
  )
}

function PersonCell({ id, name, imageUrl, map }) {
  const resolved = map && id ? map[id] : null
  const displayName = resolved?.name || name || null
  const displayImage = resolved?.imageUrl || imageUrl || null
  if (!displayName) return <span>—</span>
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
      {displayImage ? (
        <img
          src={displayImage}
          alt={displayName}
          className="round-cell-avatar"
          style={{ width: 32, height: 32, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }}
        />
      ) : (
        <span
          className="round-cell-avatar round-cell-avatar--placeholder"
          style={{ width: 32, height: 32, borderRadius: '50%', background: '#e5e7eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', fontWeight: 700, color: '#6b7280', flexShrink: 0 }}
        >
          {displayName.charAt(0).toUpperCase()}
        </span>
      )}
      {displayName}
    </span>
  )
}

function RoundResultsTable({ round, riderMap, animalMap }) {
  const rows = Array.isArray(round) ? round : []
  if (rows.length === 0) {
    return (
      <div className="event-round-placeholder">
        No results posted for this round yet.
      </div>
    )
  }
  return (
    <div className="rpn-card" style={{ overflowX: 'auto' }}>
      <table className="event-results-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Rider</th>
            <th>Animal</th>
            <th>Score</th>
            <th>Bull Score</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td>{i + 1}</td>
              <td><PersonCell id={row.rider_id} name={row.rider_name} imageUrl={row.rider_image} map={riderMap} /></td>
              <td><PersonCell id={row.animal_id} name={row.animal_name} imageUrl={row.animal_image} map={animalMap} /></td>
              <td>{row.score != null && row.score !== '' ? Number(row.score).toFixed(1) : '—'}</td>
              <td>{row.bull_score != null ? Number(row.bull_score).toFixed(1) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function EventResultsTable({ rows, riderMap }) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return <div className="event-round-placeholder">No overall results posted yet.</div>
  }
  return (
    <div className="rpn-card" style={{ overflowX: 'auto' }}>
      <table className="event-results-table">
        <thead>
          <tr>
            <th>Place</th>
            <th>Rider</th>
            <th>Agg Score</th>
            <th>R1 Pts</th>
            <th>R2 Pts</th>
            <th>CR Pts</th>
            <th>Earnings</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              <td>{row.place || i + 1}</td>
              <td><PersonCell id={row.rider_id} name={row.rider_name} imageUrl={row.rider_image} map={riderMap} /></td>
              <td>{row.agg_score != null ? Number(row.agg_score).toFixed(1) : '—'}</td>
              <td>{row.round_1_points != null ? Number(row.round_1_points).toFixed(1) : '—'}</td>
              <td>{row.round_2_points != null ? Number(row.round_2_points).toFixed(1) : '—'}</td>
              <td>{row.championship_round_points != null ? Number(row.championship_round_points).toFixed(1) : '—'}</td>
              <td>{row.earnings ? `$${Number(row.earnings).toLocaleString()}` : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
