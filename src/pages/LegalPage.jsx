import { useState, useEffect } from 'react'
import { useLocation, Link } from 'react-router-dom'
import { getPageBySlug } from '../services/wordpressApi'

export default function LegalPage() {
  const { pathname } = useLocation()
  const slug = pathname.replace(/^\//, '').replace(/\/$/, '')

  const [page, setPage] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    window.scrollTo(0, 0)
    setLoading(true)
    setPage(null)
    setError(null)

    getPageBySlug(slug)
      .then(data => {
        if (!data) { setError('Page not found.'); return }
        setPage(data)
        document.title = `${data.title.rendered} | RIN`
      })
      .catch(() => setError('Could not load this page. Please try again later.'))
      .finally(() => setLoading(false))
  }, [slug])

  const siblingLabel = slug === 'legal' ? 'Privacy Policy' : 'Terms of Service'
  const siblingPath  = slug === 'legal' ? '/privacy-policy' : '/legal'
  const heroSubtitle = slug === 'legal' ? 'Terms of Service' : 'Privacy Policy'

  return (
    <div className="legal-page">
      <div className="legal-hero">
        <p className="legal-hero-eyebrow">Legal</p>
        <h1>{heroSubtitle}</h1>
        <p className="legal-effective">Effective Date: April 28, 2026 &mdash; Rodeo Information Network Inc.</p>
      </div>

      <div className="legal-container">
        <div className="legal-sibling-link">
          Also see: <Link to={siblingPath}>{siblingLabel} &rarr;</Link>
        </div>

        {loading && (
          <div className="legal-state">
            <div className="legal-spinner" />
            <p>Loading&hellip;</p>
          </div>
        )}

        {!loading && error && (
          <div className="legal-state legal-state--error">
            <p>{error}</p>
            <p>
              For immediate assistance, email{' '}
              <a href="mailto:info@rinrodeo.com">info@rinrodeo.com</a>
            </p>
          </div>
        )}

        {!loading && page && (
          <div
            className="legal-content"
            dangerouslySetInnerHTML={{ __html: page.content.rendered }}
          />
        )}
      </div>
    </div>
  )
}
