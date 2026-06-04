import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getAnimalBySlug, getRidersByIds } from '../services/wordpressApi'
import { getAnimalImage, getRiderImage } from '../utils/placeholders'

/* ── Video helpers ───────────────────────────────────────────────────── */
function parseVideo(url) {
  if (!url) return null
  // YouTube: standard, short, embed
  const ytMatch = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  )
  if (ytMatch) {
    return {
      type: 'youtube',
      id: ytMatch[1],
      thumb: `https://img.youtube.com/vi/${ytMatch[1]}/hqdefault.jpg`,
      embed: `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1&rel=0`,
    }
  }
  // Vimeo
  const vmMatch = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (vmMatch) {
    return {
      type: 'vimeo',
      id: vmMatch[1],
      thumb: null,
      embed: `https://player.vimeo.com/video/${vmMatch[1]}?autoplay=1`,
    }
  }
  return { type: 'other', id: null, thumb: null, embed: null, url }
}

function VideoCard({ url, index }) {
  const [playing, setPlaying] = useState(false)
  const info = parseVideo(url)
  if (!info) return null

  const label = `Video ${index + 1}`

  if (playing && info.embed) {
    return (
      <div className="animal-video-card animal-video-card--playing">
        <iframe
          src={info.embed}
          title={label}
          frameBorder="0"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          className="animal-video-iframe"
        />
      </div>
    )
  }

  // Thumbnail card
  const thumbStyle = info.thumb
    ? { backgroundImage: `url(${info.thumb})` }
    : {}

  const handleClick = () => {
    if (info.embed) {
      setPlaying(true)
    } else {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <div
      className={`animal-video-card ${!info.thumb ? 'animal-video-card--no-thumb' : ''}`}
      style={thumbStyle}
      onClick={handleClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === 'Enter' && handleClick()}
      aria-label={`Play ${label}`}
    >
      <div className="animal-video-overlay">
        <div className="animal-video-play-btn">
          <svg viewBox="0 0 24 24" fill="currentColor" width="32" height="32">
            <path d="M8 5v14l11-7z" />
          </svg>
        </div>
        <span className="animal-video-label">{label}</span>
        {info.type === 'youtube' && (
          <span className="animal-video-platform animal-video-platform--yt">YouTube</span>
        )}
        {info.type === 'vimeo' && (
          <span className="animal-video-platform animal-video-platform--vm">Vimeo</span>
        )}
      </div>
    </div>
  )
}

/* ── Main component ──────────────────────────────────────────────────── */
export default function AnimalDetailPage() {
  const { slug } = useParams()
  const [animal, setAnimal] = useState(null)
  const [linkedRiders, setLinkedRiders] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getAnimalBySlug(slug)
      .then((a) => {
        setAnimal(a)
        const raw = a?.meta?.linked_riders ?? a?.acf?.linked_riders ?? a?.meta?.linked_rider_ids ?? a?.acf?.linked_rider_ids
        let idList = []
        if (Array.isArray(raw)) idList = raw.map(Number).filter(Boolean)
        else if (typeof raw === 'string') idList = raw.split(',').map((id) => parseInt(id, 10)).filter(Boolean)
        else if (raw) idList = [Number(raw)]
        if (idList.length > 0) return getRidersByIds(idList).then(setLinkedRiders)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return <p className="loading">Loading animal...</p>
  if (error) return <p className="error">Error: {error}</p>
  if (!animal) return <p className="placeholder">Animal not found.</p>

  const m = (key, fallback = null) => {
    const v = animal.meta?.[key] ?? animal.acf?.[key]
    return (v !== undefined && v !== null && v !== '' && v !== 0) ? v : fallback
  }
  const mNum = (key) => { const v = parseFloat(animal.meta?.[key] ?? animal.acf?.[key] ?? 0); return isNaN(v) ? 0 : v }
  const mInt = (key) => { const v = parseInt(animal.meta?.[key] ?? animal.acf?.[key] ?? 0, 10); return isNaN(v) ? 0 : v }

  const animalType      = m('animal_type', 'Animal')
  const scoringType     = m('scoring_type')
  const uniqueNumber    = m('unique_number')
  const sex             = m('sex')
  const sire            = m('sire')
  const dam             = m('dam')
  const breed           = m('breed')
  const color           = m('color')
  const yearFoaled      = m('year_foaled')
  const birthDate       = m('birth_date')
  const bloodlines      = m('bloodlines')
  const breeding        = m('breeding')
  const breedingPapersRaw = m('breeding_papers_url')
  const breedingPapersUrl = typeof breedingPapersRaw === 'string'
    ? breedingPapersRaw : (breedingPapersRaw?.url ?? null)
  const owner           = m('owner')
  const yearsCompeting  = mInt('years_competing')
  const currentlyActive = m('currently_active', 'yes')
  const notes           = m('notes')
  const videoLinksRaw   = animal.meta?.video_links ?? animal.acf?.video_links
  const videoLinks      = (Array.isArray(videoLinksRaw) ? videoLinksRaw : []).filter(Boolean)

  const sri = mNum('sri'), tei = mNum('tei'), bhi = mNum('bhi')
  const buckoffRate = mNum('buckoff_rate'), avgAnimalScore = mNum('avg_animal_score'), totalRides = mInt('total_animal_rides')
  const avgRunTime = mNum('avg_run_time'), cleanRunRate = mNum('clean_run_rate'), totalRuns = mInt('total_animal_runs')

  const isRoughstock = scoringType === 'roughstock' || (sri > 0 && tei === 0)
  const isTimed      = scoringType === 'timed' || scoringType === 'barrel' || (tei > 0 && sri === 0)
  const photoUrl     = animal._embedded?.['wp:featuredmedia']?.[0]?.source_url || getAnimalImage(animal)
  const scoringLabel = scoringType === 'roughstock' ? 'Roughstock'
    : scoringType === 'timed' ? 'Timed Event'
    : scoringType === 'barrel' ? 'Barrel Racing'
    : scoringType ?? null

  // Quick-facts chips: { label, value } pairs
  const quickFacts = [
    (breed || color) ? { label: null,        value: [breed, color].filter(Boolean).join(' · ') } : null,
    sire             ? { label: 'Sire',       value: sire }          : null,
    dam              ? { label: 'Dam',        value: dam }           : null,
    yearFoaled       ? { label: 'Foaled',     value: yearFoaled }    : null,
    owner            ? { label: 'Owner',      value: owner }         : null,
    yearsCompeting > 0 ? { label: 'Competing', value: `${yearsCompeting} yrs` } : null,
  ].filter(Boolean)

  return (
    <div className="profile-detail animal-detail">
      <Link to="/animals" className="back-link">← Back to Animals</Link>

      {/* ── Header card ──────────────────────────────────────────────── */}
      <header className="profile-detail-header">
        <div className="profile-detail-photo-wrap">
          <img src={photoUrl} alt={animal.title?.rendered ?? 'Animal'} className="profile-detail-photo" />
        </div>

        <div className="profile-detail-header-info">
          <div className="profile-detail-eyebrow">
            {animalType}
            {sex && <span className="animal-sex-tag">{sex}</span>}
            <span className={`animal-active-tag ${currentlyActive === 'no' ? 'inactive' : 'active'}`}>
              {currentlyActive === 'no' ? 'Inactive' : 'Active'}
            </span>
          </div>

          <h1 className="profile-detail-title" dangerouslySetInnerHTML={{ __html: animal.title?.rendered }} />

          {scoringLabel && <p className="profile-detail-subtitle">{scoringLabel}</p>}

          {/* Quick-facts chips */}
          {quickFacts.length > 0 && (
            <ul className="animal-quick-facts">
              {quickFacts.map((f, i) => (
                <li key={i} className={`animal-fact-chip${f.label ? '' : ' animal-fact-chip--solo'}`}>
                  {f.label && <span className="animal-fact-chip-label">{f.label}</span>}
                  <span className="animal-fact-chip-value">{f.value}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Index badges */}
          <div className="profile-detail-badges">
            {uniqueNumber && <span className="index-badge">{uniqueNumber}</span>}
            {sri > 0 && <span className="index-badge index-badge--primary">SRI {sri.toFixed(2)}</span>}
            {tei > 0 && <span className="index-badge index-badge--primary">TEI {tei.toFixed(2)}</span>}
            {bhi > 0 && <span className="index-badge index-badge--primary">BHI {bhi.toFixed(2)}</span>}
          </div>
        </div>
      </header>

      {/* ── Performance Stats ─────────────────────────────────────────── */}
      {(isRoughstock || isTimed) && (
        <div className="rpn-card">
          <div className="rpn-card-header">
            {isRoughstock ? 'Roughstock Performance Stats' : 'Timed Event Performance Stats'}
          </div>
          <div className="rpn-card-body">
            <div className="profile-detail-stats">
              {isRoughstock && (<>
                {sri > 0 && <StatCell label="Stock Rating Index (SRI)" value={sri.toFixed(2)} highlight />}
                {buckoffRate > 0 && <StatCell label="Buck-off Rate" value={`${buckoffRate.toFixed(1)}%`} />}
                {avgAnimalScore > 0 && <StatCell label="Avg Animal Score" value={avgAnimalScore.toFixed(1)} />}
                {totalRides > 0 && <StatCell label="Total Rides" value={totalRides} />}
              </>)}
              {isTimed && (<>
                {tei > 0 && <StatCell label="Timed Event Index (TEI)" value={tei.toFixed(2)} highlight />}
                {bhi > 0 && <StatCell label="Barrel Horse Index (BHI)" value={bhi.toFixed(2)} highlight />}
                {avgRunTime > 0 && <StatCell label="Avg Run Time" value={`${avgRunTime.toFixed(3)}s`} />}
                {cleanRunRate > 0 && <StatCell label="Clean Run Rate" value={`${cleanRunRate.toFixed(1)}%`} />}
                {totalRuns > 0 && <StatCell label="Total Runs" value={totalRuns} />}
              </>)}
            </div>
          </div>
        </div>
      )}

      {/* ── Identity & Breeding ───────────────────────────────────────── */}
      <div className="rpn-card">
        <div className="rpn-card-header">Identity &amp; Breeding</div>
        <div className="rpn-card-body">
          <div className="profile-detail-stats">
            {uniqueNumber && <StatCell label="Animal ID (AIN)" value={uniqueNumber} highlight />}
            {sex && <StatCell label="Sex" value={sex} />}
            {sire && <StatCell label="Sire (Father)" value={sire} />}
            {dam && <StatCell label="Dam (Mother)" value={dam} />}
            {breed && <StatCell label="Breed" value={breed} />}
            {color && <StatCell label="Color" value={color} />}
            {yearFoaled && <StatCell label="Year Foaled" value={yearFoaled} />}
            {birthDate && <StatCell label="Birth Date" value={birthDate} />}
            {bloodlines && <StatCell label="Bloodlines" value={bloodlines} />}
            {breeding && <StatCell label="Breeding" value={breeding} />}
            {owner && <StatCell label="Owner" value={owner} />}
            {yearsCompeting > 0 && <StatCell label="Years Competing" value={yearsCompeting} />}
            {breedingPapersUrl && (
              <div className="profile-detail-stat">
                <span className="profile-detail-stat-label">Breeding Papers</span>
                <div className="profile-detail-stat-value">
                  <a href={breedingPapersUrl} target="_blank" rel="noopener noreferrer">View / Download</a>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Notes ─────────────────────────────────────────────────────── */}
      {notes && (
        <div className="rpn-card">
          <div className="rpn-card-header">Notes</div>
          <div className="rpn-card-body">
            <p style={{ margin: 0, lineHeight: 1.7, color: 'var(--rpn-text)' }}>{notes}</p>
          </div>
        </div>
      )}

      {/* ── Videos ────────────────────────────────────────────────────── */}
      {videoLinks.length > 0 && (
        <div className="rpn-card">
          <div className="rpn-card-header">Videos</div>
          <div className="rpn-card-body">
            <div className="animal-video-grid">
              {videoLinks.map((url, idx) => (
                <VideoCard key={idx} url={url} index={idx} />
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── About (post content) ──────────────────────────────────────── */}
      {animal.content?.rendered && (
        <div className="rpn-card">
          <div className="rpn-card-header">About</div>
          <div className="rpn-card-body">
            <div className="profile-detail-bio" dangerouslySetInnerHTML={{ __html: animal.content.rendered }} />
          </div>
        </div>
      )}

      {/* ── Rider History ─────────────────────────────────────────────── */}
      <div className="rpn-card">
        <div className="rpn-card-header">Rider History</div>
        <div className="rpn-card-body">
          {linkedRiders.length > 0 ? (
            <div className="profile-related-grid">
              {linkedRiders.map((r) => (
                <Link to={`/riders/${r.slug}`} key={r.id} className="profile-related-card">
                  <img src={getRiderImage(r)} alt="" className="profile-related-img" />
                  <span className="profile-related-title" dangerouslySetInnerHTML={{ __html: r.title?.rendered }} />
                  {(r.meta?.rpi ?? r.acf?.rpi) != null && (
                    <span className="index-badge">RPI {r.meta?.rpi ?? r.acf?.rpi}</span>
                  )}
                </Link>
              ))}
            </div>
          ) : (
            <p className="placeholder">No riders linked to this animal yet.</p>
          )}
        </div>
      </div>
    </div>
  )
}

/* ── Reusable stat cell ──────────────────────────────────────────────── */
function StatCell({ label, value, highlight = false }) {
  return (
    <div className="profile-detail-stat">
      <span className="profile-detail-stat-label">{label}</span>
      <div className={`profile-detail-stat-value${highlight ? ' highlight' : ''}`}>{value}</div>
    </div>
  )
}
