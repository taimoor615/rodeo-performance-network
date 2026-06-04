import { useState, useEffect } from 'react'
import { getCustomPosts, getEvents, getConditionModifiers, submitPerformance } from '../services/wordpressApi'

const EVENT_CATEGORIES_ROUGHSTOCK = ['Bull Riding', 'Saddle Bronc', 'Bareback Riding']
const EVENT_CATEGORIES_TIMED = ['Barrel Racing', 'Breakaway Roping', 'Tie-Down Roping', 'Team Roping (Header)', 'Team Roping (Heeler)', 'Steer Wrestling']

export default function AddPerformancePage() {
  const [type, setType] = useState('roughstock')
  const [riders, setRiders] = useState([])
  const [events, setEvents] = useState([])
  const [modifiers, setModifiers] = useState(null)
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  const [riderId, setRiderId] = useState('')
  const [eventId, setEventId] = useState('')
  const [eventName, setEventName] = useState('')
  const [eventLocation, setEventLocation] = useState('')
  const [perfDate, setPerfDate] = useState('')
  const [eventCategory, setEventCategory] = useState('')
  const [arenaCondition, setArenaCondition] = useState('smooth')
  const [weatherCondition, setWeatherCondition] = useState('clear')
  const [eventTier, setEventTier] = useState('local')
  const [totalRides, setTotalRides] = useState('')
  const [qualifiedRides, setQualifiedRides] = useState('')
  const [avgRideScore, setAvgRideScore] = useState('')
  const [winCount, setWinCount] = useState('')
  const [totalRuns, setTotalRuns] = useState('')
  const [cleanRuns, setCleanRuns] = useState('')
  const [avgTime, setAvgTime] = useState('')
  const [penalties, setPenalties] = useState('')
  const [benchmark, setBenchmark] = useState('')
  const [patternSize, setPatternSize] = useState('')

  useEffect(() => {
    Promise.all([
      getCustomPosts('riders', { perPage: 100 }),
      getEvents({ perPage: 100 }),
      getConditionModifiers().catch(() => null),
    ]).then(([r, e, m]) => {
      setRiders(Array.isArray(r) ? r : [])
      setEvents(Array.isArray(e) ? e : [])
      setModifiers(m)
    })
  }, [])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setStatus(null)
    setLoading(true)
    try {
      const payload = {
        rider_id: parseInt(riderId, 10),
        event_id: eventId ? parseInt(eventId, 10) : undefined,
        performance_type: type,
        event_category: eventCategory || (type === 'roughstock' ? EVENT_CATEGORIES_ROUGHSTOCK[0] : EVENT_CATEGORIES_TIMED[0]),
        performance_date: perfDate,
        event_name: eventName,
        event_location: eventLocation,
        arena_condition: arenaCondition,
        weather_condition: weatherCondition,
        event_tier: eventTier,
      }
      if (type === 'roughstock') {
        payload.total_rides = parseInt(totalRides, 10)
        payload.qualified_rides = parseInt(qualifiedRides, 10)
        payload.avg_ride_score = parseFloat(avgRideScore)
        payload.win_count = parseInt(winCount, 10) || 0
      } else {
        payload.total_runs = parseInt(totalRuns, 10)
        payload.clean_runs = parseInt(cleanRuns, 10)
        payload.avg_time = parseFloat(avgTime)
        payload.penalties = parseInt(penalties, 10) || 0
        payload.benchmark = parseFloat(benchmark)
        payload.penalty_weight = 2
        if (eventCategory === 'Barrel Racing' && patternSize) payload.pattern_size = patternSize
      }
      const res = await submitPerformance(payload)
      setStatus({ type: 'success', message: `Submitted. Base: ${res.base_score}, Adjusted: ${res.adjusted_score}` })
    } catch (err) {
      setStatus({ type: 'error', message: err.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="add-performance-page">
      <h1>Add Performance</h1>
      <p>Submit a ride or run. Scores are calculated using RIN formulas and condition modifiers.</p>

      <form className="performance-form" onSubmit={handleSubmit}>
        <div className="perf-form-row">
          <label>Performance Type</label>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="roughstock">Roughstock (Bull, Bronc, Bareback)</option>
            <option value="timed">Timed Event (Barrel, Roping)</option>
          </select>
        </div>

        <div className="perf-form-row">
          <label>Rider *</label>
          <select value={riderId} onChange={(e) => setRiderId(e.target.value)} required>
            <option value="">Select rider...</option>
            {riders.map((r) => (
              <option key={r.id} value={r.id}>{r.title?.rendered?.replace(/<[^>]+>/g, '') || r.id}</option>
            ))}
          </select>
        </div>

        <div className="perf-form-row">
          <label>Event (optional)</label>
          <select value={eventId} onChange={(e) => {
          setEventId(e.target.value)
          const ev = events.find(x => x.id === parseInt(e.target.value, 10))
          if (ev) {
            setEventName(ev.title?.rendered?.replace(/<[^>]+>/g, '') || '')
            setEventLocation([ev.city, ev.state].filter(Boolean).join(', '))
            setArenaCondition((ev.arena_condition || ev.meta?.arena_condition || 'smooth').toLowerCase())
            setWeatherCondition((ev.weather_condition || ev.meta?.weather_condition || 'clear').toLowerCase())
            setEventTier((ev.event_tier || ev.meta?.event_tier || 'local').toLowerCase())
          }
        }}>
            <option value="">Or enter new event below</option>
            {events.map((ev) => (
              <option key={ev.id} value={ev.id}>{ev.title?.rendered?.replace(/<[^>]+>/g, '') || ev.id}</option>
            ))}
          </select>
        </div>

        <div className="perf-form-row">
          <label>Event Category *</label>
          <select value={eventCategory} onChange={(e) => setEventCategory(e.target.value)} required>
            {(type === 'roughstock' ? EVENT_CATEGORIES_ROUGHSTOCK : EVENT_CATEGORIES_TIMED).map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>

        <div className="perf-form-row">
          <label>Performance Date *</label>
          <input type="date" value={perfDate} onChange={(e) => setPerfDate(e.target.value)} required />
        </div>

        {!eventId && (
          <>
            <div className="perf-form-row">
              <label>Event Name</label>
              <input type="text" value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="If adding new event" />
            </div>
            <div className="perf-form-row">
              <label>Event Location</label>
              <input type="text" value={eventLocation} onChange={(e) => setEventLocation(e.target.value)} placeholder="City, State" />
            </div>
          </>
        )}

        <div className="perf-form-section">
          <h3>Conditions (producer pre-fill if event selected)</h3>
          <div className="perf-form-row perf-form-row--half">
            <div title={modifiers?.tooltips?.arena}>
              <label>Arena *</label>
              <select value={arenaCondition} onChange={(e) => setArenaCondition(e.target.value)}>
                {modifiers?.arena && Object.entries(modifiers.arena).map(([k, v]) => (
                  <option key={k} value={k}>{v.label} ({v.value})</option>
                ))}
                {!modifiers && <><option value="smooth">Smooth</option><option value="muddy">Muddy</option><option value="chopped">Chopped</option></>}
              </select>
            </div>
            <div title={modifiers?.tooltips?.weather}>
              <label>Weather *</label>
              <select value={weatherCondition} onChange={(e) => setWeatherCondition(e.target.value)}>
                {modifiers?.weather && Object.entries(modifiers.weather).map(([k, v]) => (
                  <option key={k} value={k}>{v.label} ({v.value})</option>
                ))}
                {!modifiers && <><option value="clear">Clear</option><option value="rainy">Rainy</option></>}
              </select>
            </div>
          </div>
          <div className="perf-form-row" title={modifiers?.tooltips?.tier}>
            <label>Event Tier *</label>
            <select value={eventTier} onChange={(e) => setEventTier(e.target.value)}>
              {modifiers?.tier && Object.entries(modifiers.tier).map(([k, v]) => (
                <option key={k} value={k}>{v.label} ({v.value})</option>
              ))}
              {!modifiers && <><option value="local">Local</option><option value="regional">Regional</option><option value="pro">Pro</option></>}
            </select>
          </div>
        </div>

        {type === 'roughstock' && (
          <div className="perf-form-section">
            <h3>Roughstock Data</h3>
            <div className="perf-form-row perf-form-row--half">
              <div><label>Total Rides *</label><input type="number" value={totalRides} onChange={(e) => setTotalRides(e.target.value)} required min={1} /></div>
              <div><label>Qualified Rides *</label><input type="number" value={qualifiedRides} onChange={(e) => setQualifiedRides(e.target.value)} required min={0} /></div>
            </div>
            <div className="perf-form-row perf-form-row--half">
              <div><label>Avg Ride Score *</label><input type="number" step="0.1" value={avgRideScore} onChange={(e) => setAvgRideScore(e.target.value)} required /></div>
              <div><label>Win Count</label><input type="number" value={winCount} onChange={(e) => setWinCount(e.target.value)} min={0} /></div>
            </div>
          </div>
        )}

        {type === 'timed' && (
          <div className="perf-form-section">
            <h3>Timed Event Data</h3>
            {eventCategory === 'Barrel Racing' && (
              <div className="perf-form-row">
                <label title="Pattern size affects the algorithm">Pattern Size (Barrel Racing) *</label>
                <input type="text" value={patternSize} onChange={(e) => setPatternSize(e.target.value)} placeholder="e.g. Standard, Small, Large" />
              </div>
            )}
            <div className="perf-form-row perf-form-row--half">
              <div><label>Total Runs *</label><input type="number" value={totalRuns} onChange={(e) => setTotalRuns(e.target.value)} required min={1} /></div>
              <div><label>Clean Runs *</label><input type="number" value={cleanRuns} onChange={(e) => setCleanRuns(e.target.value)} required min={0} /></div>
            </div>
            <div className="perf-form-row perf-form-row--half">
              <div><label>Avg Time (sec) *</label><input type="number" step="0.01" value={avgTime} onChange={(e) => setAvgTime(e.target.value)} required /></div>
              <div><label>Benchmark (sec) *</label><input type="number" step="0.01" value={benchmark} onChange={(e) => setBenchmark(e.target.value)} required /></div>
            </div>
            <div className="perf-form-row">
              <label>Penalties</label>
              <input type="number" value={penalties} onChange={(e) => setPenalties(e.target.value)} min={0} />
            </div>
          </div>
        )}

        {status && (
          <div className={`join-form-status join-form-status--${status.type}`} role="alert">{status.message}</div>
        )}
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Submitting...' : 'Submit Performance'}
        </button>
      </form>
    </div>
  )
}
