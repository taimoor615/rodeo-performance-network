import { useEffect, useState, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { getCustomPosts } from '../services/wordpressApi'

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]

const AGE_GROUPS = [
  'Pee Wee (8 & under)',
  'Junior (9–13)',
  'High School (14–18)',
  'College',
  'Open / Pro',
  'Senior',
]

const ADULT_DISCIPLINES = [
  { id: 'bull-riding',         label: 'Bull Riding',            eventTypeMatch: 'bull-riding' },
  { id: 'saddle-bronc',        label: 'Saddle Bronc Riding',    eventTypeMatch: 'saddle-bronc' },
  { id: 'bareback',            label: 'Bareback Riding',        eventTypeMatch: 'bareback' },
  { id: 'barrel-racing',       label: 'Barrel Racing',          eventTypeMatch: 'barrel-racing' },
  { id: 'team-roping-header',  label: 'Team Roping – Header',   eventTypeMatch: 'team-roping-header' },
  { id: 'team-roping-heeler',  label: 'Team Roping – Heeler',   eventTypeMatch: 'team-roping-heeler' },
  { id: 'tie-down-roping',     label: 'Tie-Down Roping',        eventTypeMatch: 'tie-down-roping' },
  { id: 'breakaway-roping',    label: 'Breakaway Roping',       eventTypeMatch: 'breakaway-roping' },
  { id: 'steer-wrestling',     label: 'Steer Wrestling',        eventTypeMatch: 'steer-wrestling' },
]

const YOUTH_DISCIPLINES = [
  { id: 'junior-bull-riding',  label: 'Junior Bull Riding',     eventTypeMatch: 'junior-bull-riding' },
  { id: 'steer-riding',        label: 'Steer Riding',           eventTypeMatch: 'steer-riding' },
  { id: 'mini-bareback',       label: 'Mini Bareback',          eventTypeMatch: 'mini-bareback' },
  { id: 'mini-saddle-bronc',   label: 'Mini Saddle Bronc',      eventTypeMatch: 'mini-saddle-bronc' },
  { id: 'barrel-racing-youth', label: 'Barrel Racing (Youth)',  eventTypeMatch: 'barrel-racing-youth' },
  { id: 'pole-bending',        label: 'Pole Bending',           eventTypeMatch: 'pole-bending' },
  { id: 'goat-tying',          label: 'Goat Tying',             eventTypeMatch: 'goat-tying' },
  { id: 'breakaway-youth',     label: 'Breakaway (Youth)',      eventTypeMatch: 'breakaway-youth' },
  { id: 'team-roping-junior',  label: 'Team Roping (Junior)',   eventTypeMatch: 'team-roping-junior' },
]

const STOCK_DISCIPLINES = [
  { id: 'bulls',   label: 'Bulls',                animalType: 'Bull',   indexLabel: 'SRI', indexKey: 'sri' },
  { id: 'broncs',  label: 'Broncs',               animalType: 'Bronc',  indexLabel: 'SRI', indexKey: 'sri' },
  { id: 'horses',  label: 'Timed-Event Horses',   animalType: 'Horse',  indexLabel: 'TEI', indexKey: 'tei' },
]

function getTitle(post) {
  if (!post) return ''
  const t = post.title
  return typeof t === 'string' ? t : (t?.rendered?.replace?.(/<[^>]+>/g, '') || '')
}

export default function RankingsPage() {
  const [riders, setRiders] = useState([])
  const [animals, setAnimals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [filterEvent, setFilterEvent] = useState('')
  const [filterDivision, setFilterDivision] = useState('')
  const [filterState, setFilterState] = useState('')
  const [filterAgeGroup, setFilterAgeGroup] = useState('')

  useEffect(() => {
    Promise.all([
      getCustomPosts('riders', { perPage: 100, _embed: true }),
      getCustomPosts('animals', { perPage: 100, _embed: true }),
    ])
      .then(([rData, aData]) => {
        setRiders(Array.isArray(rData) ? rData : [])
        setAnimals(Array.isArray(aData) ? aData : [])
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  // Ranked lists keyed by discipline id, recomputed when filters change
  const ranked = useMemo(() => {
    const result = {}

    // Normalize for comparison: lowercase, replace all non-alphanumeric runs with a single space
    const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

    const rankRiders = (eventTypeMatch) => {
      const match = norm(eventTypeMatch)
      let list = riders.filter((r) => {
        const et = norm(r.meta?.event_type ?? r.acf?.event_type ?? '')
        return et === match || et.includes(match)
      })
      if (filterState) {
        list = list.filter((r) => (r.meta?.state ?? r.acf?.state ?? '').toUpperCase() === filterState)
      }
      if (filterAgeGroup) {
        list = list.filter((r) => (r.meta?.age_group ?? r.acf?.age_group ?? '') === filterAgeGroup)
      }
      const withIndex = list.map((r) => ({
        item: r,
        index: Number(r.meta?.rpi ?? r.acf?.rpi ?? r.meta?.rpi_base ?? r.acf?.rpi_base ?? 0),
      }))
      withIndex.sort((a, b) => b.index - a.index)
      let rank = 1
      return withIndex.map((x) => ({ ...x, rank: x.index > 0 ? rank++ : '—' }))
    }

    const rankAnimals = (animalType, indexKey) => {
      const type = animalType.toLowerCase()
      const matched = animals.filter((a) => {
        const stored = (a.meta?.animal_type ?? a.acf?.animal_type ?? '').toLowerCase().trim()
        return stored === type
      })
      const withIndex = matched.map((a) => ({
        item: a,
        index: indexKey === 'sri'
          ? Number(a.meta?.sri ?? a.acf?.sri ?? 0)
          : Number(a.meta?.tei ?? a.acf?.tei ?? 0),
      }))
      // Sort: scored animals first (descending), unscored at bottom
      withIndex.sort((a, b) => b.index - a.index)
      let rank = 1
      return withIndex.map((x) => ({ ...x, rank: x.index > 0 ? rank++ : '—' }))
    }

    ADULT_DISCIPLINES.forEach((d) => { result[d.id] = rankRiders(d.eventTypeMatch) })
    YOUTH_DISCIPLINES.forEach((d) => { result[d.id] = rankRiders(d.eventTypeMatch) })
    STOCK_DISCIPLINES.forEach((d) => { result[d.id] = rankAnimals(d.animalType, d.indexKey) })

    return result
  }, [riders, animals, filterState, filterAgeGroup])

  // Which sections to show based on event + division filters
  const visibleAdult = useMemo(() => {
    if (filterDivision === 'Youth' || filterDivision === 'Stock') return []
    if (filterEvent) return ADULT_DISCIPLINES.filter((d) => d.id === filterEvent)
    return ADULT_DISCIPLINES
  }, [filterDivision, filterEvent])

  const visibleYouth = useMemo(() => {
    if (filterDivision === 'Adult' || filterDivision === 'Stock') return []
    if (filterEvent) return YOUTH_DISCIPLINES.filter((d) => d.id === filterEvent)
    return YOUTH_DISCIPLINES
  }, [filterDivision, filterEvent])

  const visibleStock = useMemo(() => {
    if (filterDivision === 'Adult' || filterDivision === 'Youth') return []
    if (filterEvent) return STOCK_DISCIPLINES.filter((d) => d.id === filterEvent)
    return STOCK_DISCIPLINES
  }, [filterDivision, filterEvent])

  const nothingVisible = visibleAdult.length === 0 && visibleYouth.length === 0 && visibleStock.length === 0

  const renderRiderTable = (d) => {
    const list = ranked[d.id] || []
    return (
      <section key={d.id} className="rankings-discipline-section">
        <h3 className="rankings-discipline-title">{d.label}</h3>
        {list.length > 0 ? (
          <div className="rpn-card">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th className="leaderboard-rank">#</th>
                  <th>Rider</th>
                  <th>RPI</th>
                  <th>State</th>
                </tr>
              </thead>
              <tbody>
                {list.map(({ item, index, rank }) => (
                  <tr key={item.id}>
                    <td className="leaderboard-rank">{rank}</td>
                    <td><Link to={`/riders/${item.slug}`}>{getTitle(item)}</Link></td>
                    <td className="leaderboard-index">{Number(index).toFixed(1)}</td>
                    <td>{item.meta?.state ?? item.acf?.state ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="placeholder">No ranked riders yet.</p>
        )}
      </section>
    )
  }

  const renderAnimalTable = (d) => {
    const list = ranked[d.id] || []
    return (
      <section key={d.id} className="rankings-discipline-section">
        <h3 className="rankings-discipline-title">{d.label}</h3>
        {list.length > 0 ? (
          <div className="rpn-card">
            <table className="leaderboard-table">
              <thead>
                <tr>
                  <th className="leaderboard-rank">#</th>
                  <th>Animal</th>
                  <th>{d.indexLabel}</th>
                </tr>
              </thead>
              <tbody>
                {list.map(({ item, index, rank }) => (
                  <tr key={item.id} className={index === 0 ? 'leaderboard-row--unranked' : ''}>
                    <td className="leaderboard-rank">{rank}</td>
                    <td><Link to={`/animals/${item.slug}`}>{getTitle(item)}</Link></td>
                    <td className="leaderboard-index">{index > 0 ? Number(index).toFixed(1) : <span className="leaderboard-unranked">No score</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="placeholder">No {d.label.toLowerCase()} found. Make sure the animal's <strong>Animal Type</strong> is set to <strong>{d.animalType}</strong> in your dashboard.</p>
        )}
      </section>
    )
  }

  return (
    <div className="rankings-page">
      <h1>Rankings</h1>
      <p className="rankings-page-desc">
        Overall rankings by event and discipline. Filter by event, division, state, or age group.
      </p>

      <div className="rankings-filters filters-bar">
        <select
          value={filterEvent}
          onChange={(e) => setFilterEvent(e.target.value)}
          className="filter-select"
          aria-label="Filter by event"
        >
          <option value="">All Events</option>
          <optgroup label="Adult Events">
            {ADULT_DISCIPLINES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </optgroup>
          <optgroup label="Youth Events">
            {YOUTH_DISCIPLINES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </optgroup>
          <optgroup label="Stock Rankings">
            {STOCK_DISCIPLINES.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
          </optgroup>
        </select>

        <select
          value={filterDivision}
          onChange={(e) => { setFilterDivision(e.target.value); setFilterEvent('') }}
          className="filter-select"
          aria-label="Filter by division"
        >
          <option value="">All Divisions</option>
          <option value="Adult">Adult</option>
          <option value="Youth">Youth</option>
          <option value="Stock">Stock</option>
        </select>

        <select
          value={filterState}
          onChange={(e) => setFilterState(e.target.value)}
          className="filter-select"
          aria-label="Filter by state"
        >
          <option value="">All States</option>
          {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>

        <select
          value={filterAgeGroup}
          onChange={(e) => setFilterAgeGroup(e.target.value)}
          className="filter-select"
          aria-label="Filter by age group"
        >
          <option value="">All Age Groups</option>
          {AGE_GROUPS.map((ag) => <option key={ag} value={ag}>{ag}</option>)}
        </select>
      </div>

      {loading && <p className="loading">Loading rankings...</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !error && (
        <div className="rankings-disciplines">
          {visibleAdult.length > 0 && (
            <div className="rankings-category">
              {!filterEvent && <h2 className="rankings-category-heading">Adult Events</h2>}
              {visibleAdult.map(renderRiderTable)}
            </div>
          )}

          {visibleYouth.length > 0 && (
            <div className="rankings-category">
              {!filterEvent && <h2 className="rankings-category-heading">Youth Events</h2>}
              {visibleYouth.map(renderRiderTable)}
            </div>
          )}

          {visibleStock.length > 0 && (
            <div className="rankings-category">
              {!filterEvent && <h2 className="rankings-category-heading">Stock Rankings</h2>}
              {visibleStock.map(renderAnimalTable)}
            </div>
          )}

          {nothingVisible && (
            <p className="placeholder">No rankings match the selected filters.</p>
          )}
        </div>
      )}
    </div>
  )
}
