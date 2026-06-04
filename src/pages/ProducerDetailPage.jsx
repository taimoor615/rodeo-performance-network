import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getCustomPosts, getEvents } from '../services/wordpressApi'

export default function ProducerDetailPage() {
  const { slug } = useParams()
  const [producer, setProducer] = useState(null)
  const [events, setEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getCustomPosts('producers', { slug, perPage: 1, _embed: true })
      .then((data) => {
        const p = Array.isArray(data) && data.length > 0 ? data[0] : null
        setProducer(p)
        const raw = p?.meta?.linked_events ?? p?.acf?.linked_events
        let eventIds = []
        if (Array.isArray(raw)) eventIds = raw
        else if (typeof raw === 'string') eventIds = raw.split(',').map((id) => parseInt(id, 10)).filter(Boolean)
        else if (raw) eventIds = [Number(raw)]
        if (eventIds.length > 0) {
          return getEvents({ include: eventIds.join(','), perPage: 50 })
            .then((evts) => setEvents(Array.isArray(evts) ? evts : []))
            .catch(() => setEvents([]))
        }
        return getEvents({ perPage: 50 }).then((evts) => {
          const producerId = p?.id
          const linked = Array.isArray(evts) ? evts.filter((e) => {
            let pid = e.meta?.producer_id ?? e.acf?.producer_id ?? e.meta?.event_producer ?? e.acf?.event_producer
            if (pid && typeof pid === 'object' && pid.id) pid = pid.id
            return pid == producerId
          }) : []
          setEvents(linked)
        }).catch(() => setEvents([]))
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return <p className="loading">Loading organization...</p>
  if (error) return <p className="error">Error: {error}</p>
  if (!producer) return <p className="placeholder">Organization not found.</p>

  const title = producer.title?.rendered?.replace(/<[^>]+>/g, '') || 'Organization'
  const img = producer._embedded?.['wp:featuredmedia']?.[0]?.source_url
  const pri = producer.meta?.pri ?? producer.acf?.pri
  const verified = producer.meta?.verified ?? producer.acf?.verified
  const verifiedEventPartner = producer.meta?.verified_event_partner === true || producer.meta?.verified_event_partner === '1' || producer.acf?.verified_event_partner === true
  const city = producer.meta?.city ?? producer.acf?.city
  const state = producer.meta?.state ?? producer.acf?.state
  const region = producer.meta?.region ?? producer.acf?.region
  const addressStreet = producer.meta?.address_street ?? producer.acf?.address_street
  const addressZip = producer.meta?.address_zip ?? producer.acf?.address_zip
  const description = producer.meta?.bio ?? producer.meta?.description ?? producer.acf?.bio ?? producer.acf?.description ?? producer.content?.rendered?.replace(/<[^>]+>/g, '')
  const website = producer.meta?.website ?? producer.acf?.website
  const phone = producer.meta?.phone ?? producer.acf?.phone
  const contactEmail = producer.meta?.contact_email ?? producer.acf?.contact_email
  const contactName = producer.meta?.contact_name ?? producer.acf?.contact_name

  const today = new Date().toISOString().slice(0, 10)
  const upcoming = events.filter((e) => (e.meta?.event_date || e.acf?.event_date || '') >= today)
  const past = events.filter((e) => (e.meta?.event_date || e.acf?.event_date || '9999') < today)

  return (
    <div className="profile-detail producer-detail pickup-team-detail">
      <Link to="/producers" className="back-link">← Back to Organizations</Link>

      <header className="profile-detail-header">
        {img ? (
          <img src={img} alt="" className="profile-detail-photo" />
        ) : (
          <div className="profile-detail-photo profile-detail-photo-placeholder">ORG</div>
        )}
        <div>
          <h1 className="profile-detail-title">{title}</h1>
          {(city || state || region || addressStreet) && (
            <p className="profile-detail-subtitle">
              {[addressStreet, city, state, addressZip].filter(Boolean).join(', ')}
              {region && ` · ${region}`}
            </p>
          )}
          <div>
            {verified && <span className="verified-badge">Verified</span>}
            {verifiedEventPartner && (
              <span className="verified-partner-badge" title="Verified Event Partner — results submitted through official RIN channels">
                &#10003; Verified Event Partner
              </span>
            )}
          </div>
          {pri != null && <span className="index-badge">PRI {Number(pri).toFixed(1)}</span>}
        </div>
      </header>

      {description && (
        <div className="profile-detail-section">
          <h3>About</h3>
          <p className="profile-detail-bio">{description}</p>
        </div>
      )}

      {(events.length > 0) && (
        <div className="profile-detail-section">
          <h3>Events</h3>
          {upcoming.length > 0 && (
            <>
              <h4>Upcoming</h4>
              <ul className="event-list">
                {upcoming.map((e) => (
                  <li key={e.id}>
                    <Link to={`/events/${e.slug}`}>
                      {e.title?.rendered?.replace(/<[^>]+>/g, '') || 'Event'} — {e.meta?.event_date || e.acf?.event_date}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
          {past.length > 0 && (
            <>
              <h4>Past Events</h4>
              <ul className="event-list">
                {past.slice(0, 10).map((e) => (
                  <li key={e.id}>
                    <Link to={`/events/${e.slug}`}>
                      {e.title?.rendered?.replace(/<[^>]+>/g, '') || 'Event'} — {e.meta?.event_date || e.acf?.event_date}
                    </Link>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {(contactName || phone || website || contactEmail) && (
        <div className="profile-detail-section">
          <h3>Contact</h3>
          <dl className="profile-detail-dl">
            {contactName && <><dt>Point of Contact</dt><dd>{contactName}</dd></>}
            {phone && <><dt>Phone</dt><dd><a href={`tel:${phone.replace(/\D/g, '')}`}>{phone}</a></dd></>}
            {contactEmail && <><dt>Email</dt><dd><a href={`mailto:${contactEmail}`}>{contactEmail}</a></dd></>}
            {website && <><dt>Website</dt><dd><a href={website} target="_blank" rel="noopener noreferrer">{website.replace(/^https?:\/\//, '')}</a></dd></>}
          </dl>
        </div>
      )}
    </div>
  )
}
