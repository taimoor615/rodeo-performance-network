import { useEffect, useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getEvents, getEventById, getCustomPosts, getEventResults } from '../services/wordpressApi'
import { getEventImage } from '../utils/placeholders'
import Carousel from '../components/Carousel'

const US_STATES = [
  '', 'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA',
  'ME', 'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR',
  'PA', 'RI', 'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY'
]

function getEventTitle(event) {
  if (!event) return ''
  const t = event.title
  return typeof t === 'string' ? t : (t?.rendered?.replace?.(/<[^>]+>/g, '') || '')
}

const DISCIPLINES = [
  '', 'Bull Riding', 'Saddle Bronc', 'Bareback', 'Barrel Racing',
  'Team Roping', 'Tie-Down Roping', 'Breakaway Roping', 'Steer Wrestling',
  'Junior Bull Riding', 'Steer Riding', 'Pole Bending', 'Goat Tying',
]

const EVENT_TIERS = ['', 'local', 'regional', 'national', 'championship']

export default function EventsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const stateFromUrl = searchParams.get('state') || ''
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [filterState, setFilterState] = useState(stateFromUrl)
  const [filterDiscipline, setFilterDiscipline] = useState('')
  const [filterTier, setFilterTier] = useState('')
  const [selectedSeason, setSelectedSeason] = useState('')
  const [pastSearch, setPastSearch] = useState('')
  const [selectedEventId, setSelectedEventId] = useState('')
  const [selectedEvent, setSelectedEvent] = useState(null)
  const [eventResultsLoading, setEventResultsLoading] = useState(false)
  const [computedResults, setComputedResults] = useState(null)
  const [riderMap, setRiderMap] = useState({})

  useEffect(() => {
    getEvents({ perPage: 100, _embed: true })
      .then((data) => setEvents(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    if (!selectedEventId) { setSelectedEvent(null); setComputedResults(null); return }
    setEventResultsLoading(true)
    Promise.all([
      getEventById(selectedEventId),
      getEventResults(Number(selectedEventId)),
    ])
      .then(([ev, computed]) => {
        setSelectedEvent(ev)
        setComputedResults(computed || null)
      })
      .catch(() => { setSelectedEvent(null); setComputedResults(null) })
      .finally(() => setEventResultsLoading(false))
  }, [selectedEventId])

  useEffect(() => {
    if (!selectedEvent && !computedResults) return
    const riderIds = new Set()
    const er = selectedEvent?.event_results || []
    er.forEach((row) => row.rider_id && riderIds.add(row.rider_id))
    ;[selectedEvent?.round_1_results, selectedEvent?.round_2_results, selectedEvent?.championship_round_results].forEach((arr) => {
      if (!Array.isArray(arr)) return
      arr.forEach((row) => row.rider_id && riderIds.add(row.rider_id))
    })
    ;[computedResults?.overall, computedResults?.round_1, computedResults?.round_2, computedResults?.championship_round].forEach((arr) => {
      if (!Array.isArray(arr)) return
      arr.forEach((row) => row.rider_id && riderIds.add(row.rider_id))
    })
    if (riderIds.size === 0) return
    getCustomPosts('riders', { perPage: 100, _embed: true })
      .then((data) => {
        const m = {}
        ;(Array.isArray(data) ? data : []).forEach((r) => {
          const id = r.id != null ? Number(r.id) : null
          if (id == null) return
          m[id] = { name: getEventTitle(r), slug: r.slug, imageUrl: r._embedded?.['wp:featuredmedia']?.[0]?.source_url || null }
        })
        setRiderMap(m)
      })
      .catch(() => {})
  }, [selectedEvent, computedResults])

  useEffect(() => {
    setFilterState(stateFromUrl)
  }, [stateFromUrl])

  const today = new Date().toISOString().slice(0, 10)

  const filtered = useMemo(() => {
    return events.filter((e) => {
      const state = (e.meta?.state ?? e.acf?.state ?? '').toUpperCase().trim()
      if (filterState && state !== filterState) return false
      if (filterTier) {
        const tier = (e.meta?.event_tier ?? e.acf?.event_tier ?? '').toLowerCase()
        if (tier !== filterTier) return false
      }
      if (filterDiscipline) {
        const disciplines = e.meta?.disciplines ?? e.acf?.disciplines ?? []
        const dArr = Array.isArray(disciplines) ? disciplines : (typeof disciplines === 'string' ? disciplines.split(',').map((d) => d.trim()) : [])
        if (!dArr.some((d) => d.toLowerCase().includes(filterDiscipline.toLowerCase()))) return false
      }
      return true
    })
  }, [events, filterState, filterTier, filterDiscipline])

  const upcoming = filtered.filter((e) => (e.meta?.event_date || e.acf?.event_date || '') >= today)
  const past = filtered.filter((e) => (e.meta?.event_date || e.acf?.event_date || '9999') < today)

  const seasons = useMemo(() => {
    const s = new Set()
    events.forEach((e) => { const v = e.meta?.season ?? e.acf?.season; if (v) s.add(v) })
    return [...s].sort().reverse()
  }, [events])

  const pastFiltered = useMemo(() => {
    let list = past
    if (selectedSeason) list = list.filter((e) => (e.meta?.season ?? e.acf?.season) === selectedSeason)
    if (pastSearch.trim()) {
      const q = pastSearch.trim().toLowerCase()
      list = list.filter((e) => getEventTitle(e).toLowerCase().includes(q))
    }
    return list
  }, [past, selectedSeason, pastSearch])

  // All events (past + upcoming) matching season/name filters — for the results dropdown
  const allResultsFiltered = useMemo(() => {
    let list = filtered
    if (selectedSeason) list = list.filter((e) => (e.meta?.season ?? e.acf?.season) === selectedSeason)
    if (pastSearch.trim()) {
      const q = pastSearch.trim().toLowerCase()
      list = list.filter((e) => getEventTitle(e).toLowerCase().includes(q))
    }
    return list.sort((a, b) => {
      const da = a.meta?.event_date || a.acf?.event_date || ''
      const db = b.meta?.event_date || b.acf?.event_date || ''
      return db.localeCompare(da)
    })
  }, [filtered, selectedSeason, pastSearch])

  const eventResults = (computedResults?.overall?.length > 0 ? computedResults.overall : null)
    ?? selectedEvent?.event_results
    ?? []

  const renderEventCard = (event) => {
    const title = getEventTitle(event)
    const img = event._embedded?.['wp:featuredmedia']?.[0]?.source_url || getEventImage(event)
    const eventDate = event.meta?.event_date ?? event.acf?.event_date
    const venue = event.meta?.venue ?? event.acf?.venue
    const city = event.meta?.city ?? event.acf?.city
    const state = event.meta?.state ?? event.acf?.state
    const tier = event.meta?.event_tier ?? event.acf?.event_tier

    return (
      <Link to={`/events/${event.slug}`} key={event.id} className="event-list-card">
        <img src={img} alt="" className="event-list-card-img" />
        <div className="event-list-card-body">
          <h3 className="event-list-card-title">{title}</h3>
          {eventDate && (
            <p className="event-list-card-date">
              {new Date(eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
            </p>
          )}
          {(venue || city || state) && (
            <p className="event-list-card-meta">{[venue, city, state].filter(Boolean).join(' · ')}</p>
          )}
          {tier && <span className="event-list-card-badge">{tier}</span>}
        </div>
      </Link>
    )
  }

  return (
    <div className="events-page">
      <h1>Events</h1>
      <p className="events-page-desc">
        Browse current and upcoming rodeo events, or search past events by season, state, or name.
      </p>

      <div className="events-add-cta">
        <Link to="/join-us" className="btn btn-primary">Add your event</Link>
        <span className="events-add-cta-note">Producers can add and manage events after joining.</span>
      </div>

      {!loading && events.length > 0 && (
        <div className="events-filters">
          <select
            value={filterState}
            onChange={(e) => {
              const v = e.target.value
              setFilterState(v)
              const next = new URLSearchParams(searchParams)
              if (v) next.set('state', v)
              else next.delete('state')
              setSearchParams(next)
            }}
            className="events-filter-select"
            aria-label="Filter by state"
          >
            <option value="">All States</option>
            {US_STATES.filter(Boolean).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <select
            value={filterDiscipline}
            onChange={(e) => setFilterDiscipline(e.target.value)}
            className="events-filter-select"
            aria-label="Filter by discipline"
          >
            <option value="">All Disciplines</option>
            {DISCIPLINES.filter(Boolean).map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>

          <select
            value={filterTier}
            onChange={(e) => setFilterTier(e.target.value)}
            className="events-filter-select"
            aria-label="Filter by tier"
          >
            <option value="">All Tiers</option>
            {EVENT_TIERS.filter(Boolean).map((t) => (
              <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
            ))}
          </select>
        </div>
      )}

      {loading && <p className="loading">Loading events...</p>}
      {error && (
        <div className="rpn-card" style={{ borderTop: '4px solid var(--rpn-red)', padding: '1.25rem 1.5rem' }}>
          <p className="error" style={{ margin: 0 }}>{error}</p>
          <p style={{ margin: '0.5rem 0 0', color: 'var(--rpn-text-muted)', fontSize: '0.9rem' }}>
            Make sure the RPN Headless plugin is active in WordPress and events are <strong>Published</strong> (not Draft).
          </p>
        </div>
      )}

      {!loading && !error && (
        <>
          {upcoming.length > 0 && (
            <section id="upcoming" className="events-section">
              <h2>Current &amp; Future Events</h2>
              {upcoming.length > 3 ? (
                <Carousel visibleCount={3}>
                  {upcoming.map(renderEventCard)}
                </Carousel>
              ) : (
                <div className="events-list-grid">
                  {upcoming.map(renderEventCard)}
                </div>
              )}
            </section>
          )}

          <section id="past" className="events-section events-past-section">
            <h2>Season &amp; Past Event Results</h2>
            <p className="events-section-desc">Filter by season, state, or name — then select an event to view scores and riders.</p>
            <div className="events-results-filters">
              <label>
                Season
                <select
                  value={selectedSeason}
                  onChange={(e) => { setSelectedSeason(e.target.value); setSelectedEventId('') }}
                  aria-label="Season"
                >
                  <option value="">All seasons</option>
                  {seasons.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </label>
              <label>
                Name
                <input
                  type="search"
                  value={pastSearch}
                  onChange={(e) => { setPastSearch(e.target.value); setSelectedEventId('') }}
                  placeholder="Search by event name…"
                  aria-label="Search past events by name"
                  className="filter-input"
                />
              </label>
              <label>
                Event
                <select
                  value={selectedEventId}
                  onChange={(e) => setSelectedEventId(e.target.value)}
                  aria-label="Event"
                >
                  <option value="">Select event</option>
                  {allResultsFiltered.map((ev) => (
                    <option key={ev.id} value={ev.id}>
                      {getEventTitle(ev)}{ev.meta?.event_date || ev.acf?.event_date ? ` (${ev.meta?.event_date || ev.acf?.event_date})` : ''}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {eventResultsLoading && selectedEventId && <p className="loading">Loading event results...</p>}

            {!eventResultsLoading && selectedEventId && selectedEvent && (
              <div className="events-results-block">
                <header className="rankings-event-header">
                  {selectedEvent._embedded?.['wp:featuredmedia']?.[0]?.source_url && (
                    <img src={selectedEvent._embedded['wp:featuredmedia'][0].source_url} alt="" className="rankings-event-logo" />
                  )}
                  <div>
                    <h3 className="rankings-event-title">{getEventTitle(selectedEvent)}</h3>
                    <p className="rankings-event-meta">
                      {selectedEvent.meta?.city ?? selectedEvent.acf?.city}
                      {(selectedEvent.meta?.state ?? selectedEvent.acf?.state) && `, ${selectedEvent.meta?.state ?? selectedEvent.acf?.state}`}
                      {(selectedEvent.meta?.event_date ?? selectedEvent.acf?.event_date) && ` · ${selectedEvent.meta?.event_date ?? selectedEvent.acf?.event_date}`}
                    </p>
                  </div>
                </header>
                <div className="rpn-card rankings-table-card">
                  <table className="leaderboard-table event-results-table">
                    <thead>
                      <tr>
                        <th>Place</th>
                        <th>Rider</th>
                        <th>Agg Score</th>
                        <th>Total Pts</th>
                        <th>Round 1</th>
                        <th>Round 2</th>
                        <th>Champ</th>
                        <th>Earnings</th>
                        <th>Ride %</th>
                      </tr>
                    </thead>
                    <tbody>
                      {eventResults.map((row, i) => {
                        const riderId = row.rider_id != null ? Number(row.rider_id) : null
                        const rider = riderId ? riderMap[riderId] : null
                        return (
                          <tr key={(row.rider_id || i) + '-' + i}>
                            <td className="leaderboard-rank">{row.place || i + 1}</td>
                            <td className="round-cell-rider">
                              {rider ? (
                                <Link to={`/riders/${rider.slug}`} className="round-cell-profile">
                                  {rider.imageUrl ? (
                                    <img src={rider.imageUrl} alt="" className="round-cell-avatar" />
                                  ) : (
                                    <span className="round-cell-avatar round-cell-avatar-placeholder">
                                      {(rider.name || 'R').charAt(0)}
                                    </span>
                                  )}
                                  <span className="round-cell-name">{rider.name || `Rider #${riderId}`}</span>
                                </Link>
                              ) : (
                                riderId ? `Rider #${riderId}` : '—'
                              )}
                            </td>
                            <td>{row.agg_score != null ? Number(row.agg_score).toFixed(2) : '—'}</td>
                            <td>{row.total_points != null ? row.total_points : '—'}</td>
                            <td>{row.round_1_points != null ? Number(row.round_1_points).toFixed(2) : '—'}</td>
                            <td>{row.round_2_points != null ? Number(row.round_2_points).toFixed(2) : '—'}</td>
                            <td>{row.championship_round_points != null ? Number(row.championship_round_points).toFixed(2) : '—'}</td>
                            <td>{row.earnings != null ? `$${Number(row.earnings).toLocaleString()}` : '—'}</td>
                            <td>{row.ride_percentage != null && row.ride_percentage !== '' ? row.ride_percentage : '—'}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                  {eventResults.length === 0 && (
                    <p className="placeholder">No event results for this event yet.</p>
                  )}
                </div>
              </div>
            )}

            {!selectedEventId && allResultsFiltered.length > 0 && (
              <p className="placeholder">Select an event above to view results.</p>
            )}
            {!selectedEventId && allResultsFiltered.length === 0 && events.length > 0 && (
              <p className="placeholder">No events match your filters.</p>
            )}
          </section>

          {filtered.length === 0 && (
            <p className="placeholder">No events found. <a href="/join-us">Join as a Producer</a> to create and publish your first event.</p>
          )}
        </>
      )}
    </div>
  )
}
