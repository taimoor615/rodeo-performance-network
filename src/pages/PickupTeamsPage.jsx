import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getCustomPosts } from '../services/wordpressApi'

export default function PickupTeamsPage() {
  const [teams, setTeams] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getCustomPosts('pickup_teams', { perPage: 50, _embed: true })
      .then((data) => setTeams(Array.isArray(data) ? data : []))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="pickup-teams-page">
      <h1>Pickup Teams</h1>
      <p className="pickup-teams-desc">
        Browse pickup teams rated by PTI (Pickup Team Index). Years of experience and tagged rescues. (Search by pickup horses will be available when pickup horses are added as an option—teams often change horses throughout a rodeo.)
      </p>

      {loading && <p className="loading">Loading pickup teams...</p>}
      {error && (
        <p className="error">
          {error}. Ensure the RPN Headless plugin is active and Pickup Teams are added in WordPress.
        </p>
      )}

      {!loading && !error && teams.length > 0 && (
        <div className="profile-grid">
          {teams.map((team) => {
            const img = team._embedded?.['wp:featuredmedia']?.[0]?.source_url
            const pti = team.meta?.pti ?? team.acf?.pti
            const years = team.meta?.years_experience ?? team.acf?.years_experience
            const city = team.meta?.city ?? team.acf?.city
            const state = team.meta?.state ?? team.acf?.state
            return (
              <Link to={`/pickup-teams/${team.slug}`} key={team.id} className="profile-card">
                {img ? (
                  <img src={img} alt="" className="profile-card-photo" />
                ) : (
                  <div className="profile-card-placeholder">PT</div>
                )}
                <div className="profile-card-body">
                  <span className="profile-card-title">{team.title?.rendered?.replace(/<[^>]+>/g, '') || 'Pickup Team'}</span>
                  {(city || state) && (
                    <p className="profile-card-meta">{[city, state].filter(Boolean).join(', ')}</p>
                  )}
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap', marginTop: '0.2rem' }}>
                    {pti != null && <span className="index-badge">PTI {Number(pti).toFixed(1)}</span>}
                    {years != null && <span className="profile-card-tag">{years} yrs exp</span>}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}

      {!loading && !error && teams.length === 0 && (
        <p className="placeholder">No pickup teams registered yet. Check back soon.</p>
      )}
    </div>
  )
}
