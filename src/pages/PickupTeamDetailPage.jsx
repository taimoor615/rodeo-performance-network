import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getCustomPosts } from '../services/wordpressApi'

export default function PickupTeamDetailPage() {
  const { slug } = useParams()
  const [team, setTeam] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getCustomPosts('pickup_teams', { slug, perPage: 1, _embed: true })
      .then((data) => setTeam(Array.isArray(data) && data.length > 0 ? data[0] : null))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return <p className="loading">Loading pickup team...</p>
  if (error) return <p className="error">Error: {error}</p>
  if (!team) return <p className="placeholder">Pickup team not found.</p>

  const title = team.title?.rendered?.replace(/<[^>]+>/g, '') || 'Pickup Team'
  const img = team._embedded?.['wp:featuredmedia']?.[0]?.source_url
  const pti = team.meta?.pti ?? team.acf?.pti
  const years = team.meta?.years_experience ?? team.acf?.years_experience
  const horses = team.meta?.horses_used ?? team.acf?.horses_used
  const rescues = team.meta?.tagged_rescues ?? team.acf?.tagged_rescues
  const city = team.meta?.city ?? team.acf?.city
  const state = team.meta?.state ?? team.acf?.state

  return (
    <div className="profile-detail pickup-team-detail">
      <Link to="/pickup-teams" className="back-link">← Back to Pickup Teams</Link>

      <header className="profile-detail-header">
        {img ? (
          <img src={img} alt="" className="profile-detail-photo" />
        ) : (
          <div className="profile-detail-photo profile-detail-photo-placeholder">Team</div>
        )}
        <div>
          <div className="profile-detail-eyebrow">Pickup Team</div>
          <h1 className="profile-detail-title">{title}</h1>
          {team.content?.rendered && (
            <p className="profile-detail-bio" dangerouslySetInnerHTML={{ __html: team.content.rendered }} />
          )}
          {(city || state) && (
            <p className="profile-detail-subtitle">{[city, state].filter(Boolean).join(', ')}</p>
          )}
          {pti != null && <span className="index-badge">PTI {Number(pti).toFixed(1)}</span>}
        </div>
      </header>

      <div className="profile-detail-section">
        <h3>Stats</h3>
        <div className="profile-detail-stats">
          {pti != null && (
            <div className="profile-detail-stat">
              <span className="profile-detail-stat-label">PTI</span>
              <span className="profile-detail-stat-value">{Number(pti).toFixed(1)}</span>
            </div>
          )}
          {years != null && (
            <div className="profile-detail-stat">
              <span className="profile-detail-stat-label">Years Experience</span>
              <span className="profile-detail-stat-value">{years}</span>
            </div>
          )}
          {rescues != null && (
            <div className="profile-detail-stat">
              <span className="profile-detail-stat-label">Tagged Rescues</span>
              <span className="profile-detail-stat-value">{rescues}</span>
            </div>
          )}
          {horses && (
            <div className="profile-detail-stat profile-detail-stat-full">
              <span className="profile-detail-stat-label">Horses Used</span>
              <span className="profile-detail-stat-value">{horses}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
