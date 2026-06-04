import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import {
  getFantasyLeagues,
  getMyFantasyLeagues,
  createFantasyLeague,
  getFantasyLeagueDetail,
  joinFantasyLeague,
  setFantasyPicks,
  getCustomPosts,
} from '../services/wordpressApi'

export default function FantasyPage() {
  const { user, token, isAuthenticated } = useAuth()
  const [tab,         setTab]         = useState('browse')  // browse | my-leagues | create
  const [leagues,     setLeagues]     = useState([])
  const [myLeagues,   setMyLeagues]   = useState([])
  const [loading,     setLoading]     = useState(true)
  const [error,       setError]       = useState(null)
  const [selectedLeague, setSelected] = useState(null)  // detail view
  const [leagueDetail,   setDetail]   = useState(null)
  const [detailLoading,  setDetailL]  = useState(false)
  const [joinMsg,     setJoinMsg]     = useState(null)
  const [joining,     setJoining]     = useState(false)

  // Create league form
  const [createForm, setCreateForm]   = useState({ name: '', season: new Date().getFullYear(), max_picks: 5, is_private: false })
  const [creating,   setCreating]     = useState(false)
  const [createMsg,  setCreateMsg]    = useState(null)

  // Picks UI
  const [pickLeagueId, setPickLeague] = useState(null)
  const [allRiders,    setAllRiders]  = useState([])
  const [myPicks,      setMyPicks]    = useState([])
  const [ridersLoading, setRidersL]  = useState(false)
  const [savingPicks,  setSavingPicks] = useState(false)
  const [picksMsg,     setPicksMsg]   = useState(null)

  useEffect(() => {
    setLoading(true)
    const pub = getFantasyLeagues().then((d) => setLeagues(d.leagues || []))
    const my  = isAuthenticated
      ? getMyFantasyLeagues(token).then((d) => setMyLeagues(d.leagues || []))
      : Promise.resolve()
    Promise.all([pub, my]).catch((e) => setError(e.message)).finally(() => setLoading(false))
  }, [isAuthenticated, token])

  const openLeague = (id) => {
    setSelected(id)
    setDetail(null)
    setDetailL(true)
    setJoinMsg(null)
    getFantasyLeagueDetail(id)
      .then((d) => setDetail(d))
      .catch((e) => setError(e.message))
      .finally(() => setDetailL(false))
  }

  const handleJoin = async (leagueId) => {
    setJoining(true)
    setJoinMsg(null)
    try {
      const res = await joinFantasyLeague(token, leagueId)
      setJoinMsg({ type: 'success', text: res.message || 'Joined!' })
      const my = await getMyFantasyLeagues(token)
      setMyLeagues(my.leagues || [])
    } catch (e) {
      setJoinMsg({ type: 'error', text: e.message })
    } finally {
      setJoining(false)
    }
  }

  const handleCreate = async (e) => {
    e.preventDefault()
    setCreating(true)
    setCreateMsg(null)
    try {
      await createFantasyLeague(token, createForm)
      const [pub, my] = await Promise.all([
        getFantasyLeagues(),
        getMyFantasyLeagues(token),
      ])
      setLeagues(pub.leagues || [])
      setMyLeagues(my.leagues || [])
      setCreateMsg({ type: 'success', text: `League "${createForm.name}" created!` })
      setTab('my-leagues')
    } catch (e) {
      setCreateMsg({ type: 'error', text: e.message })
    } finally {
      setCreating(false)
    }
  }

  const openPicks = async (leagueId, currentPicks = []) => {
    setPickLeague(leagueId)
    setMyPicks(currentPicks.map(Number))
    setPicksMsg(null)
    if (allRiders.length === 0) {
      setRidersL(true)
      try {
        const data = await getCustomPosts('riders', { perPage: 100, _embed: false })
        setAllRiders(Array.isArray(data) ? data : [])
      } catch { /* ignore */ } finally {
        setRidersL(false)
      }
    }
  }

  const togglePick = (riderId, maxPicks) => {
    setMyPicks((prev) => {
      if (prev.includes(riderId)) return prev.filter((id) => id !== riderId)
      if (prev.length >= maxPicks) return prev
      return [...prev, riderId]
    })
  }

  const savePicks = async (leagueId) => {
    setSavingPicks(true)
    setPicksMsg(null)
    try {
      const res = await setFantasyPicks(token, leagueId, myPicks)
      setPicksMsg({ type: 'success', text: res.message || 'Picks saved!' })
      const my = await getMyFantasyLeagues(token)
      setMyLeagues(my.leagues || [])
    } catch (e) {
      setPicksMsg({ type: 'error', text: e.message })
    } finally {
      setSavingPicks(false)
    }
  }

  const currentLeaguePicks = myLeagues.find((l) => l.id === pickLeagueId)
  const maxPicks = currentLeaguePicks?.max_picks || 5

  const statusColor = (s) => ({ open: '#16a34a', active: '#2563eb', closed: '#6b7280' }[s] || '#6b7280')

  return (
    <div className="fantasy-page">
      <div className="fantasy-hero">
        <h1>Fantasy Rodeo</h1>
        <p>Pick your team of rodeo athletes, compete against friends, and win based on real RPI performance.</p>
      </div>

      {pickLeagueId && (
        <div className="nil-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setPickLeague(null) }}>
          <div className="nil-modal fantasy-picks-modal">
            <button className="nil-modal-close" onClick={() => setPickLeague(null)}>✕</button>
            <h2>Set My Picks</h2>
            <p className="nil-modal-subtitle">Select up to <strong>{maxPicks}</strong> riders for your team. Scores are based on their current RPI.</p>
            {ridersLoading && <p className="loading">Loading riders…</p>}
            {!ridersLoading && (
              <>
                <p className="fantasy-picks-count">{myPicks.length} / {maxPicks} selected</p>
                <div className="fantasy-picks-grid">
                  {allRiders.map((r) => {
                    const name = r.title?.rendered?.replace(/<[^>]+>/g, '') || r.post_title || 'Rider'
                    const rpi  = Number(r.meta?.rpi_current || 0).toFixed(1)
                    const sel  = myPicks.includes(r.id)
                    return (
                      <button
                        key={r.id}
                        className={`fantasy-pick-btn${sel ? ' fantasy-pick-btn--selected' : ''}`}
                        onClick={() => togglePick(r.id, maxPicks)}
                        disabled={!sel && myPicks.length >= maxPicks}
                      >
                        <span className="fantasy-pick-name">{name}</span>
                        {rpi > 0 && <span className="fantasy-pick-rpi">RPI {rpi}</span>}
                        {sel && <span className="fantasy-pick-check">&#10003;</span>}
                      </button>
                    )
                  })}
                </div>
                {picksMsg && (
                  <p className={picksMsg.type === 'success' ? 'success' : 'error'}>{picksMsg.text}</p>
                )}
                <div className="nil-contact-form-actions" style={{ marginTop: '1rem' }}>
                  <button className="btn btn-secondary" onClick={() => setPickLeague(null)}>Cancel</button>
                  <button className="btn btn-primary" onClick={() => savePicks(pickLeagueId)} disabled={savingPicks}>
                    {savingPicks ? 'Saving…' : 'Save Picks'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {selectedLeague && (
        <div className="nil-modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setSelected(null) }}>
          <div className="nil-modal fantasy-detail-modal">
            <button className="nil-modal-close" onClick={() => setSelected(null)}>✕</button>
            {detailLoading && <p className="loading">Loading…</p>}
            {!detailLoading && leagueDetail && (
              <>
                <h2>{leagueDetail.name}</h2>
                <div className="fantasy-league-meta">
                  <span style={{ color: statusColor(leagueDetail.status), fontWeight: 700, textTransform: 'capitalize' }}>
                    {leagueDetail.status}
                  </span>
                  <span>Season {leagueDetail.season}</span>
                  <span>{leagueDetail.member_count} member{leagueDetail.member_count !== 1 ? 's' : ''}</span>
                  <span>Max {leagueDetail.max_picks} picks</span>
                </div>
                {joinMsg && <p className={joinMsg.type === 'success' ? 'success' : 'error'}>{joinMsg.text}</p>}
                {isAuthenticated && leagueDetail.status === 'open' && (
                  <button className="btn btn-primary" onClick={() => handleJoin(leagueDetail.id)} disabled={joining} style={{ marginBottom: '1rem' }}>
                    {joining ? 'Joining…' : 'Join League'}
                  </button>
                )}
                <h3>Standings</h3>
                {leagueDetail.standings?.length > 0 ? (
                  <table className="fantasy-standings-table">
                    <thead>
                      <tr><th>#</th><th>Team Manager</th><th>Picks</th><th>Total RPI Score</th></tr>
                    </thead>
                    <tbody>
                      {leagueDetail.standings.map((s, i) => (
                        <tr key={s.user_id} className={i === 0 ? 'fantasy-leader-row' : ''}>
                          <td>{i + 1}{i === 0 && ' 🏆'}</td>
                          <td>{s.display_name}</td>
                          <td>{s.picks_count}</td>
                          <td><strong>{s.total_score}</strong></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="placeholder">No picks yet — be the first to set your team!</p>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <div className="fantasy-tabs">
        <button className={`fantasy-tab${tab === 'browse' ? ' fantasy-tab--active' : ''}`} onClick={() => setTab('browse')}>Browse Leagues</button>
        <button className={`fantasy-tab${tab === 'my-leagues' ? ' fantasy-tab--active' : ''}`} onClick={() => setTab('my-leagues')}>My Leagues</button>
        {isAuthenticated && <button className={`fantasy-tab${tab === 'create' ? ' fantasy-tab--active' : ''}`} onClick={() => setTab('create')}>Create League</button>}
      </div>

      {loading && <p className="loading">Loading…</p>}
      {error   && <p className="error">Error: {error}</p>}

      {!loading && tab === 'browse' && (
        <>
          {leagues.length === 0 && <p className="placeholder">No public leagues yet. Create one to get started!</p>}
          <div className="fantasy-league-grid">
            {leagues.map((l) => (
              <div key={l.id} className="fantasy-league-card">
                <div className="fantasy-league-card-header">
                  <h3>{l.name}</h3>
                  <span className="fantasy-status-dot" style={{ background: statusColor(l.status) }} title={l.status} />
                </div>
                <p className="fantasy-league-info">Season {l.season} · {l.member_count} member{l.member_count !== 1 ? 's' : ''} · Max {l.max_picks} picks</p>
                <div className="fantasy-league-card-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => openLeague(l.id)}>View Standings</button>
                  {isAuthenticated && l.status === 'open' && (
                    <button className="btn btn-primary btn-sm" onClick={() => handleJoin(l.id)}>Join</button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && tab === 'my-leagues' && (
        <>
          {!isAuthenticated && <p className="placeholder"><Link to="/login">Log in</Link> to see your leagues.</p>}
          {isAuthenticated && myLeagues.length === 0 && <p className="placeholder">You haven't joined any leagues yet. Browse open leagues or create your own!</p>}
          <div className="fantasy-league-grid">
            {myLeagues.map((l) => (
              <div key={l.id} className="fantasy-league-card fantasy-league-card--mine">
                <div className="fantasy-league-card-header">
                  <h3>{l.name}</h3>
                  <div>
                    {l.is_commissioner && <span className="fantasy-commissioner-badge">Commissioner</span>}
                    <span className="fantasy-status-dot" style={{ background: statusColor(l.status) }} title={l.status} />
                  </div>
                </div>
                <p className="fantasy-league-info">Season {l.season} · {l.member_count} member{l.member_count !== 1 ? 's' : ''}</p>
                <p className="fantasy-my-score">My Score: <strong>{l.my_score}</strong> RPI · {l.my_picks?.length || 0} picks</p>
                <div className="fantasy-league-card-actions">
                  <button className="btn btn-secondary btn-sm" onClick={() => openLeague(l.id)}>Standings</button>
                  <button className="btn btn-primary btn-sm" onClick={() => openPicks(l.id, l.my_picks || [])}>
                    {l.my_picks?.length > 0 ? 'Edit Picks' : 'Set Picks'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {!loading && tab === 'create' && isAuthenticated && (
        <div className="fantasy-create-form-wrap">
          <h2>Create a New League</h2>
          <form className="fantasy-create-form" onSubmit={handleCreate}>
            <label>
              League Name <span className="required">*</span>
              <input type="text" required value={createForm.name} onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })} placeholder="e.g. Texas Rodeo Fantasy 2026" />
            </label>
            <label>
              Season
              <input type="number" value={createForm.season} min="2024" max="2030" onChange={(e) => setCreateForm({ ...createForm, season: e.target.value })} />
            </label>
            <label>
              Max Picks per Team (1–10)
              <input type="number" value={createForm.max_picks} min="1" max="10" onChange={(e) => setCreateForm({ ...createForm, max_picks: Number(e.target.value) })} />
            </label>
            <label className="fantasy-checkbox-label">
              <input type="checkbox" checked={createForm.is_private} onChange={(e) => setCreateForm({ ...createForm, is_private: e.target.checked })} />
              Private league (invite-only, hidden from browse)
            </label>
            {createMsg && <p className={createMsg.type === 'success' ? 'success' : 'error'}>{createMsg.text}</p>}
            <div className="nil-contact-form-actions">
              <button type="submit" className="btn btn-primary" disabled={creating}>
                {creating ? 'Creating…' : 'Create League'}
              </button>
            </div>
          </form>
          <div className="fantasy-how-it-works">
            <h3>How Fantasy Rodeo Works</h3>
            <ol>
              <li>Create or join a league.</li>
              <li>Pick up to your league's maximum number of rodeo athletes as your team.</li>
              <li>Your team score is the combined RPI of all your picks.</li>
              <li>Standings update automatically as athletes compete.</li>
              <li>The team with the highest total RPI at the end of the season wins.</li>
            </ol>
          </div>
        </div>
      )}
    </div>
  )
}
