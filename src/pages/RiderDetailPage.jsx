import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faFacebook, faXTwitter, faInstagram, faTiktok, faYoutube } from '@fortawesome/free-brands-svg-icons'
import { faGlobe, faPlay } from '@fortawesome/free-solid-svg-icons'
import { getRiderBySlug, getAnimalsByIds, getMedia } from '../services/wordpressApi'
import { getRiderImage, getAnimalImage } from '../utils/placeholders'

/* --------------------------------------------------------------------------
 * Helpers
 * -------------------------------------------------------------------------- */

/** Extract YouTube video ID from various URL formats */
function getYouTubeId(url) {
  if (!url) return null
  const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/)
  return match ? match[1] : null
}

/** Extract Vimeo video ID */
function getVimeoId(url) {
  if (!url) return null
  const match = url.match(/vimeo\.com\/(\d+)/)
  return match ? match[1] : null
}

/** Return a thumbnail image URL for a video link, or null */
function getVideoThumb(url) {
  const ytId = getYouTubeId(url)
  if (ytId) return `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
  return null
}

/** Return a watch URL (normalised) */
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
 * ShareBar — one-tap social sharing buttons
 * -------------------------------------------------------------------------- */

function ShareBar({ name, url }) {
  const [copied, setCopied] = useState(false)

  const text = `Check out ${name}'s rodeo profile on RIN`

  const handleNativeShare = async () => {
    if (navigator.share) {
      try { await navigator.share({ title: name, text, url }) } catch (_) {}
    }
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(url).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  const enc = encodeURIComponent
  const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${enc(url)}`
  const xUrl  = `https://twitter.com/intent/tweet?url=${enc(url)}&text=${enc(text)}`

  return (
    <div className="share-bar">
      <div className="share-bar-inner">
        <span className="share-bar-label">Share Profile</span>
        <div className="share-bar-buttons">
          {navigator.share && (
            <button type="button" className="share-btn share-btn--native" onClick={handleNativeShare} aria-label="Share via device">
              ↑ Share
            </button>
          )}
          <a href={fbUrl} target="_blank" rel="noopener noreferrer" className="share-btn share-btn--fb" aria-label="Share on Facebook">
            <FontAwesomeIcon icon={faFacebook} /> Facebook
          </a>
          <a href={xUrl} target="_blank" rel="noopener noreferrer" className="share-btn share-btn--x" aria-label="Share on X">
            <FontAwesomeIcon icon={faXTwitter} /> X
          </a>
          <button type="button" className="share-btn share-btn--copy" onClick={handleCopy} aria-label="Copy link">
            {copied ? '✓ Copied!' : '🔗 Copy Link'}
          </button>
        </div>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
 * Main component
 * -------------------------------------------------------------------------- */

export default function RiderDetailPage() {
  const { slug } = useParams()
  const [rider, setRider] = useState(null)
  const [linkedAnimals, setLinkedAnimals] = useState([])
  const [mediaItems, setMediaItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getRiderBySlug(slug)
      .then((r) => {
        setRider(r)
        const raw = r?.meta?.linked_animals ?? r?.acf?.linked_animals
        let idList = []
        if (Array.isArray(raw)) idList = raw
        else if (typeof raw === 'string') idList = raw.split(',').map((id) => parseInt(id, 10)).filter(Boolean)
        else if (raw) idList = [Number(raw)]
        const promises = []
        if (idList.length > 0) promises.push(getAnimalsByIds(idList).then(setLinkedAnimals))
        if (r?.id) promises.push(getMedia({ riderId: r.id }).then(setMediaItems).catch(() => setMediaItems([])))
        return Promise.all(promises)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return <p className="loading">Loading rider...</p>
  if (error) return <p className="error">Error: {error}</p>
  if (!rider) return <p className="placeholder">Rider not found.</p>

  const m = rider.meta ?? rider.acf ?? {}

  // Core fields
  const rpi            = m.rpi
  const rpiRoughstock  = m.rpi_roughstock
  const rpiTimed       = m.rpi_timed
  const state          = m.state
  const city           = m.city
  const ageGroup       = m.age_group
  const isPremium      = m.premium_member
  const premiumExpires = m.premium_expires
  // Extended profile fields
  const nickname     = m.nickname
  const dateOfBirth  = m.date_of_birth
  const gender       = m.gender
  const country      = m.country
  const division     = m.division
  const primaryEvent = m.primary_event
  const secondaryEvents = Array.isArray(m.secondary_events) ? m.secondary_events.filter(Boolean) : []
  const yearsCompeting  = m.years_competing ? Number(m.years_competing) : null
  const associations    = Array.isArray(m.association_memberships) ? m.association_memberships.filter(Boolean) : []

  // Social media
  const instagramUrl    = m.instagram_url
  const tiktokUrl       = m.tiktok_url
  const facebookUrl     = m.facebook_url
  const twitterUrl      = m.twitter_url
  const youtubeUrl      = m.youtube_url
  const personalWebsite = m.personal_website
  const hasSocial = instagramUrl || tiktokUrl || facebookUrl || twitterUrl || youtubeUrl || personalWebsite

  // Video highlights
  const videoHighlights = Array.isArray(m.video_highlights)
    ? m.video_highlights.filter(Boolean)
    : []

  // NIL / Sponsorship
  const nilOpen          = m.nil_open_to_sponsorship === '1' || m.nil_open_to_sponsorship === true
  const sponsorName      = m.sponsor_name
  const sponsorUrl       = m.sponsor_url
  const confidence       = m.rpi_confidence_score != null ? Number(m.rpi_confidence_score) : null
  const hasVerifiedResults = m.has_verified_results === true || m.has_verified_results === '1'

  const hasCompetitionInfo = division || primaryEvent || secondaryEvents.length > 0 || associations.length > 0 || yearsCompeting

  return (
    <div className="profile-detail rider-detail">
      <Link to="/riders" className="back-link">← Back to Riders</Link>

      {/* ---- Header ---- */}
      <header className="profile-detail-header">
        <div>
          <img
            src={rider._embedded?.['wp:featuredmedia']?.[0]?.source_url || getRiderImage(rider)}
            alt=""
            className="profile-detail-photo"
          />
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
            {nilOpen && (
              <span className="nil-badge">Open to NIL</span>
            )}
            {sponsorName && (
              <span className="sponsor-badge">
                {sponsorUrl
                  ? <a href={sponsorUrl} target="_blank" rel="noopener noreferrer">{sponsorName}</a>
                  : sponsorName
                }
              </span>
            )}
            {hasVerifiedResults && (
              <span className="verified-profile-badge" title="Has organizer-verified competition results">
                &#10003; Verified Results
              </span>
            )}
            {isPremium && premiumExpires && (
              <span className="profile-card-meta" style={{ fontSize: '0.8rem' }}>
                Premium until {premiumExpires}
              </span>
            )}
          </div>

          {confidence != null && (
            <div className="rider-confidence-bar">
              <span className="rider-confidence-label">Profile Confidence</span>
              <div className="rider-confidence-track">
                <div className="rider-confidence-fill" style={{ width: `${confidence}%` }} />
              </div>
              <span className="rider-confidence-val">{confidence}/100</span>
            </div>
          )}

          {/* Social media icons in header */}
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

      {/* ---- Share Profile ---- */}
      <ShareBar name={rider.title?.rendered?.replace(/<[^>]+>/g, '') ?? 'this rider'} url={typeof window !== 'undefined' ? window.location.href : ''} />

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
          <p className="placeholder">No animals linked to this rider yet.</p>
        )}
      </section>

      {/* ---- Media ---- */}
      <section className="profile-detail-section">
        <h3>Media &amp; highlights</h3>
        {mediaItems.length > 0 ? (
          <div className="media-highlights-grid">
            {mediaItems.map((item) => (
              <div key={item.id} className="media-highlight-card">
                {item.media_type === 'video' && item.video_url ? (
                  <a href={item.video_url} target="_blank" rel="noopener noreferrer" className="media-highlight-link">
                    {item.thumbnail_url ? (
                      <img src={item.thumbnail_url} alt="" className="media-highlight-thumb" />
                    ) : (
                      <div className="media-highlight-placeholder">▶ Play</div>
                    )}
                  </a>
                ) : (
                  item.thumbnail_url ? (
                    <img src={item.thumbnail_url} alt="" className="media-highlight-thumb" />
                  ) : (
                    <div className="media-highlight-placeholder">Image</div>
                  )
                )}
                <div className="media-highlight-info">
                  <span className="media-highlight-title">{item.title}</span>
                  {item.excerpt && <p className="media-highlight-excerpt">{item.excerpt}</p>}
                  {item.likes_count > 0 && <span className="media-highlight-likes">❤ {item.likes_count}</span>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="placeholder">No media highlights yet. Check back after events are logged.</p>
        )}
      </section>

    </div>
  )
}
