import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="not-found-page">
      <div className="not-found-inner">
        <div className="not-found-code">404</div>
        <h1 className="not-found-title">Page Not Found</h1>
        <p className="not-found-desc">
          The page you're looking for doesn't exist or may have been moved.
        </p>
        <div className="not-found-actions">
          <Link to="/" className="btn btn-primary">Go to Homepage</Link>
          <Link to="/rankings" className="btn btn-secondary">View Rankings</Link>
        </div>
        <p className="not-found-help">
          Need help? Email us at{' '}
          <a href="mailto:info@rinrodeo.com">info@rinrodeo.com</a>{' '}
          or call <a href="tel:4346040972">434-604-0972</a>
        </p>
      </div>
    </div>
  )
}
