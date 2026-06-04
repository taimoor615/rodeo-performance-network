import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getCustomPosts, getAnimalsByIds } from '../services/wordpressApi'
import { getAnimalImage } from '../utils/placeholders'

export default function ContractorDetailPage() {
  const { slug } = useParams()
  const [contractor, setContractor] = useState(null)
  const [linkedAnimals, setLinkedAnimals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    getCustomPosts('contractors', { slug, perPage: 1, _embed: true })
      .then((data) => {
        const c = Array.isArray(data) && data.length > 0 ? data[0] : null
        setContractor(c)
        const raw = c?.meta?.linked_animals ?? c?.acf?.linked_animals
        let ids = []
        if (Array.isArray(raw)) ids = raw
        else if (typeof raw === 'string') ids = raw.split(',').map((id) => parseInt(id, 10)).filter(Boolean)
        else if (raw) ids = [Number(raw)]
        if (ids.length > 0) return getAnimalsByIds(ids).then(setLinkedAnimals)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return <p className="loading">Loading contractor...</p>
  if (error) return <p className="error">Error: {error}</p>
  if (!contractor) return <p className="placeholder">Contractor not found.</p>

  const title = contractor.title?.rendered?.replace(/<[^>]+>/g, '') || 'Contractor'
  const img = contractor._embedded?.['wp:featuredmedia']?.[0]?.source_url
  const cri = contractor.meta?.cri ?? contractor.acf?.cri
  const code = contractor.meta?.contractor_code ?? contractor.acf?.contractor_code
  const verified = contractor.meta?.verified ?? contractor.acf?.verified
  const city = contractor.meta?.city ?? contractor.acf?.city
  const state = contractor.meta?.state ?? contractor.acf?.state
  const addressStreet = contractor.meta?.address_street ?? contractor.acf?.address_street
  const addressZip = contractor.meta?.address_zip ?? contractor.acf?.address_zip
  const description = contractor.meta?.bio ?? contractor.meta?.description ?? contractor.acf?.bio ?? contractor.acf?.description ?? contractor.content?.rendered?.replace(/<[^>]+>/g, '')
  const website = contractor.meta?.website ?? contractor.acf?.website
  const phone = contractor.meta?.phone ?? contractor.acf?.phone
  const contactEmail = contractor.meta?.contact_email ?? contractor.acf?.contact_email
  const contactName = contractor.meta?.contact_name ?? contractor.acf?.contact_name
  const rawStockTypes = contractor.meta?.stock_types ?? contractor.acf?.stock_types
  const stockTypes = Array.isArray(rawStockTypes) ? rawStockTypes : (rawStockTypes ? [rawStockTypes] : [])

  return (
    <div className="profile-detail pickup-team-detail">
      <div className="profile-detail-top-links">
        <Link to="/contractors" className="back-link">← Back to Contractors</Link>
        <Link to="/contractors/rankings" className="btn btn-secondary">View Contractor Rankings</Link>
      </div>

      <header className="profile-detail-header">
        {img ? (
          <img src={img} alt="" className="profile-detail-photo" />
        ) : (
          <div className="profile-detail-photo profile-detail-photo-placeholder">{code || 'C'}</div>
        )}
        <div>
          <h1 className="profile-detail-title">{title}</h1>
          {(city || state) && (
            <p className="profile-detail-subtitle">
              {[addressStreet, city, state, addressZip].filter(Boolean).join(', ')}
            </p>
          )}
          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginTop: '0.35rem' }}>
            {code && <span className="index-badge">{code}</span>}
            {verified && <span className="verified-badge">Verified</span>}
            {cri != null && <span className="index-badge">CRI {Number(cri).toFixed(1)}</span>}
            {stockTypes.map((t) => (
              <span key={t} className="index-badge index-badge--stock">{t}</span>
            ))}
          </div>
        </div>
      </header>

      {description && (
        <div className="profile-detail-section">
          <h3>About</h3>
          <p className="profile-detail-bio">{description}</p>
        </div>
      )}

      {linkedAnimals.length > 0 && (
        <div className="profile-detail-section">
          <h3>Stock</h3>
          <p className="profile-detail-subtitle">Contractor ranking is determined by animal performance (SRI).</p>
          <div className="profile-related-grid">
            {linkedAnimals.map((a) => (
              <Link to={`/animals/${a.slug}`} key={a.id} className="profile-related-card">
                <img src={getAnimalImage(a)} alt="" className="profile-related-img" />
                <span className="profile-related-title" dangerouslySetInnerHTML={{ __html: a.title?.rendered }} />
                {(a.meta?.sri ?? a.acf?.sri) != null && <span className="index-badge">SRI {(a.meta?.sri ?? a.acf?.sri)}</span>}
              </Link>
            ))}
          </div>
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
