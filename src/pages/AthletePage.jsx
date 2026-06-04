import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFacebook, faXTwitter, faInstagram, faTiktok, faYoutube } from '@fortawesome/free-brands-svg-icons'
import { faGlobe, faPlay } from '@fortawesome/free-solid-svg-icons'
import { getRiderByRinId, getAnimalsByIds } from '../services/wordpressApi'
import { getRiderImage, getAnimalImage } from '../utils/placeholders'

/* --------------------------------------------------------------------------
 * Helpers (shared with RiderDetailPage)
 * -------------------------------------------------------------------------- */

function getYouTubeId(url) {
  if (!url) return null
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/)
  return match ? match[1] : null
}

function getVimeoId(url) {
  if (!url) return null
  const match = url.match(/vimeo\.com\/(\d+)/)
  return match ? match[1] : null
}

function getVideoThumb(url) {
  const ytId = getYouTubeId(url)
  if (ytId) return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
  return null
}

function getVideoUrl(url) {
  const ytId = getYouTubeId(url)
  if (ytId) return `https://www.youtube.com/watch?v=${ytId}`
  const vmId = getVimeoId(url)
  if (vmId) return `https://vimeo.com/${vmId}`
  return url
}

/* --------------------------------------------------------------------------
 * Sub-components
 * -------------------------------------------------------------------------- */

function SocialLink({ href, icon, label }) {
  if (!href) return null
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="rider-social-link"
      aria-label={label}
      title={label}
    >
      <FontAwesomeIcon icon={icon} />
    </a>
  )
}

function VideoCard({ url, index }) {
  const thumb = getVideoThumb(url)
  const watchUrl = getVideoUrl(url)
  const ytId = getYouTubeId(url)
  const vmId = getVimeoId(url)
  const platform = ytId ? 'YouTube' : vmId ? 'Vimeo' : 'Video'

  return (
    <a
      href={watchUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="rider-video-card"
      aria-label={`Video highlight ${index + 1}`}
    >
      <div className="rider-video-thumb">
        {thumb ? (
          <img src={thumb} alt="" loading="lazy" />
        ) : (
          <div className="rider-video-thumb-placeholder" />
        )}
        <div className="rider-video-play">
          <FontAwesomeIcon icon={faPlay} />
        </div>
      </div>
      <span className="rider-video-label">{platform} · Highlight {index + 1}</span>
    </a>
  )
}

/* --------------------------------------------------------------------------
 * Main component — public athlete profile at /athletes/:rinId
 * -------------------------------------------------------------------------- */

export default function AthletePage() {
  const { rinId } = useParams()
  const [rider, setRider] = useState(null)
  const [linkedAnimals, setLinkedAnimals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getRiderByRinId(rinId)
      .then((data) => {
        setRider(data)
        const raw = data?.meta?.linked_animals
        let idList = []
        if (Array.isArray(raw)) idList = raw
        else if (typeof raw === 'string') idList = raw.split(',').map((id) => parseInt(id, 10)).filter(Boolean)
        else if (raw) idList = [Number(raw)]
        if (idList.length > 0) return getAnimalsByIds(idList).then(setLinkedAnimals)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [rinId])

  if (loading) return <p className="loading">Loading athlete profile...</p>
  if (error) return <p className="error">Error: {error}</p>
  if (!rider) return <p className="placeholder">Athlete not found.</p>

  const m = rider.meta ?? {}

  const rpi           = m.rpi
  const rpiRoughstock = m.rpi_roughstock
  const rpiTimed      = m.rpi_timed
  const state         = m.state
  const city          = m.city
  const isPremium     = m.premium_member
  const ageGroup      = m.age_group
  const digitalCardActive = m.digital_card_status === 'active'
  const profileUrl = typeof window !== 'undefined' ? window.location.href : `https://rodeoperformance.com/athletes/${rinId}`
  const qrValue = digitalCardActive ? profileUrl : `https://rodeoperformance.com/athletes/${rinId}`

  const nickname        = m.nickname
  const dateOfBirth     = m.date_of_birth
  const gender          = m.gender
  const country         = m.country
  const division        = m.division
  const primaryEvent    = m.primary_event
  const secondaryEvents = Array.isArray(m.secondary_events) ? m.secondary_events.filter(Boolean) : []
  const yearsCompeting  = m.years_competing ? Number(m.years_competing) : null
  const associations    = Array.isArray(m.association_memberships) ? m.association_memberships.filter(Boolean) : []

  const instagramUrl    = m.instagram_url
  const tiktokUrl       = m.tiktok_url
  const facebookUrl     = m.facebook_url
  const twitterUrl      = m.twitter_url
  const youtubeUrl      = m.youtube_url
  const personalWebsite = m.personal_website
  const hasSocial = instagramUrl || tiktokUrl || facebookUrl || twitterUrl || youtubeUrl || personalWebsite

  const videoHighlights = Array.isArray(m.video_highlights) ? m.video_highlights.filter(Boolean) : []

  const hasCompetitionInfo = division || primaryEvent || secondaryEvents.length > 0 || associations.length > 0 || yearsCompeting

  // Featured image: prefer the URL returned by the custom endpoint
  const photoSrc = rider.featured_image_url || getRiderImage(rider)

  return (
    <div className="profile-detail rider-detail">
      <Link to="/riders" className="back-link">← Back to Riders</Link>

      {/* ---- Header ---- */}
      <header className="profile-detail-header">
        <div>
          <img src={photoSrc} alt="" className="profile-detail-photo" />
        </div>
        <div className="rider-header-info">
          <div className="profile-detail-eyebrow">
            {isPremium ? '✓ Verified Premium' : 'RIN Member'}
          </div>
          <h1 className="profile-detail-title">
            <span dangerouslySetInnerHTML={{ __html: rider.title?.rendered }} />
            {nickname && <span className="rider-nickname"> "{nickname}"</span>}
          </h1>

          {rider.content?.rendered && (
            <p className="profile-detail-bio" dangerouslySetInnerHTML={{ __html: rider.content.rendered }} />
          )}

          <div className="rider-header-badges">
            {rpi != null && (
              <span className="index-badge">RPI {Number(rpi).toFixed(1)}</span>
            )}
            <span className="profile-detail-eyebrow" style={{ marginLeft: '0.5rem', opacity: 0.7 }}>
              {rider.rin_id}
            </span>
          </div>

          {hasSocial && (
            <div className="rider-social-row">
              <SocialLink href={instagramUrl}    icon={faInstagram} label="Instagram" />
              <SocialLink href={tiktokUrl}       icon={faTiktok}    label="TikTok" />
              <SocialLink href={facebookUrl}     icon={faFacebook}  label="Facebook" />
              <SocialLink href={twitterUrl}      icon={faXTwitter}  label="X / Twitter" />
              <SocialLink href={youtubeUrl}      icon={faYoutube}   label="YouTube" />
              {personalWebsite && (
                <a
                  href={personalWebsite}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rider-social-link"
                  aria-label="Personal Website"
                  title="Personal Website"
                >
                  <FontAwesomeIcon icon={faGlobe} />
                </a>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ---- Profile info strip ---- */}
      {(city || state || division || primaryEvent || yearsCompeting > 0 || country) && (
        <div className="rider-infobar">
          {(city || state) && (
            <div className="rider-infobar-item">
              <span className="rider-infobar-label">Location</span>
              <span className="rider-infobar-value">{[city, state].filter(Boolean).join(', ')}</span>
            </div>
          )}
          {country && (
            <div className="rider-infobar-item">
              <span className="rider-infobar-label">Country</span>
              <span className="rider-infobar-value">{country}</span>
            </div>
          )}
          {division && (
            <div className="rider-infobar-item">
              <span className="rider-infobar-label">Division</span>
              <span className="rider-infobar-value">{division}</span>
            </div>
          )}
          {primaryEvent && (
            <div className="rider-infobar-item">
              <span className="rider-infobar-label">Primary Event</span>
              <span className="rider-infobar-value">{primaryEvent}</span>
            </div>
          )}
          {yearsCompeting > 0 && (
            <div className="rider-infobar-item">
              <span className="rider-infobar-label">Years Competing</span>
              <span className="rider-infobar-value">{yearsCompeting}</span>
            </div>
          )}
        </div>
      )}

      {/* ---- Digital ID / QR ---- */}
      <section className="profile-detail-section digital-id-section">
        <h3>Digital ID Card</h3>
        <p className="profile-detail-subtitle">
          {digitalCardActive
            ? 'Event organizers can scan this QR code to check you in at events.'
            : 'This is the shareable athlete profile link for this RIN ID.'}
        </p>
        <div className="digital-id-card">
          <div className="digital-id-qr">
            <QRCodeSVG value={qrValue} size={160} level="M" marginSize={4} />
          </div>
          <div className="digital-id-info">
            <span className="digital-id-name" dangerouslySetInnerHTML={{ __html: rider.title?.rendered }} />
            <span className="digital-id-rpi" style={{ fontSize: '0.85rem', opacity: 0.7 }}>{rider.rin_id}</span>
            {rpi != null && <span className="digital-id-rpi">RPI {Number(rpi).toFixed(1)}</span>}
          </div>
        </div>
      </section>

      {/* ---- Performance stats ---- */}
      <div className="rpn-card">
        <div className="rpn-card-header">Performance</div>
        <div className="rpn-card-body">
          <div className="profile-detail-stats">
            {rpi != null && (
              <div className="profile-detail-stat">
                <span className="profile-detail-stat-label">Overall RPI</span>
                <div className="profile-detail-stat-value">{Number(rpi).toFixed(1)}</div>
              </div>
            )}
            {rpiRoughstock != null && rpiRoughstock > 0 && (
              <div className="profile-detail-stat">
                <span className="profile-detail-stat-label">Roughstock RPI</span>
                <div className="profile-detail-stat-value">{Number(rpiRoughstock).toFixed(1)}</div>
              </div>
            )}
            {rpiTimed != null && rpiTimed > 0 && (
              <div className="profile-detail-stat">
                <span className="profile-detail-stat-label">Timed THI</span>
                <div className="profile-detail-stat-value">{Number(rpiTimed).toFixed(1)}</div>
              </div>
            )}
            {state && (
              <div className="profile-detail-stat">
                <span className="profile-detail-stat-label">State</span>
                <div className="profile-detail-stat-value">{state}</div>
              </div>
            )}
            {city && (
              <div className="profile-detail-stat">
                <span className="profile-detail-stat-label">City</span>
                <div className="profile-detail-stat-value">{city}</div>
              </div>
            )}
            {ageGroup && (
              <div className="profile-detail-stat">
                <span className="profile-detail-stat-label">Age Group</span>
                <div className="profile-detail-stat-value">{ageGroup}</div>
              </div>
            )}
            {gender && (
              <div className="profile-detail-stat">
                <span className="profile-detail-stat-label">Gender</span>
                <div className="profile-detail-stat-value">{gender}</div>
              </div>
            )}
            {dateOfBirth && (
              <div className="profile-detail-stat">
                <span className="profile-detail-stat-label">Date of Birth</span>
                <div className="profile-detail-stat-value">{dateOfBirth}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---- Competition profile ---- */}
      {hasCompetitionInfo && (
        <div className="rpn-card" style={{ marginTop: '1.5rem' }}>
          <div className="rpn-card-header">Competition Profile</div>
          <div className="rpn-card-body">
            <div className="rider-competition-grid">
              {division && (
                <div className="rider-comp-item">
                  <span className="rider-comp-label">Division</span>
                  <span className="rider-comp-value">{division}</span>
                </div>
              )}
              {primaryEvent && (
                <div className="rider-comp-item">
                  <span className="rider-comp-label">Primary Event</span>
                  <span className="rider-comp-value">{primaryEvent}</span>
                </div>
              )}
              {yearsCompeting > 0 && (
                <div className="rider-comp-item">
                  <span className="rider-comp-label">Years Competing</span>
                  <span className="rider-comp-value">{yearsCompeting}</span>
                </div>
              )}
              {country && (
                <div className="rider-comp-item">
                  <span className="rider-comp-label">Country</span>
                  <span className="rider-comp-value">{country}</span>
                </div>
              )}
            </div>

            {secondaryEvents.length > 0 && (
              <div className="rider-comp-tags-row">
                <span className="rider-comp-label">Also Competes In</span>
                <div className="rider-comp-tags">
                  {secondaryEvents.map((ev) => (
                    <span key={ev} className="rider-comp-tag">{ev}</span>
                  ))}
                </div>
              </div>
            )}

            {associations.length > 0 && (
              <div className="rider-comp-tags-row">
                <span className="rider-comp-label">Association Memberships</span>
                <div className="rider-comp-tags">
                  {associations.map((a) => (
                    <span key={a} className="rider-comp-tag rider-comp-tag--assoc">{a}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- Video Highlights ---- */}
      {videoHighlights.length > 0 && (
        <section className="profile-detail-section">
          <h3>Video Highlights</h3>
          <div className="rider-video-grid">
            {videoHighlights.map((url, i) => (
              <VideoCard key={i} url={url} index={i} />
            ))}
          </div>
        </section>
      )}

      {/* ---- Linked animals ---- */}
      <section className="profile-detail-section">
        <h3>Linked horses / stock</h3>
        {linkedAnimals.length > 0 ? (
          <div className="profile-related-grid">
            {linkedAnimals.map((a) => (
              <Link to={`/animals/${a.slug}`} key={a.id} className="profile-related-card">
                <img src={getAnimalImage(a)} alt="" className="profile-related-img" />
                <span className="profile-related-title" dangerouslySetInnerHTML={{ __html: a.title?.rendered }} />
                {(a.meta?.sri ?? a.acf?.sri) != null && <span className="index-badge">SRI {(a.meta?.sri ?? a.acf?.sri)}</span>}
              </Link>
            ))}
          </div>
        ) : (
          <p className="placeholder">No animals linked to this athlete yet.</p>
        )}
      </section>

      {/* ---- Share ---- */}
      <section className="profile-detail-section">
        <h3>Share profile</h3>
        <div className="share-links">
          <a
            href={`https://twitter.com/intent/tweet?text=${encodeURIComponent((rider.title?.rendered || 'Athlete') + ' on RIN')}&url=${encodeURIComponent(profileUrl)}`}
            target="_blank" rel="noopener noreferrer" aria-label="Share on X"
          >
            <FontAwesomeIcon icon={faXTwitter} /> Share on X
          </a>
          <a
            href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(profileUrl)}`}
            target="_blank" rel="noopener noreferrer" aria-label="Share on Facebook"
          >
            <FontAwesomeIcon icon={faFacebook} /> Share on Facebook
          </a>
        </div>
      </section>
    </div>
  )
}
