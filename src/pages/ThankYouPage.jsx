import { Link, useSearchParams } from 'react-router-dom'

export default function ThankYouPage() {
  const [searchParams] = useSearchParams()
  const type = searchParams.get('type') // 'free' | 'paid' | null

  const isPaid = type === 'paid'

  return (
    <div className="thankyou-page">
      <div className="thankyou-inner">
        <div className="thankyou-icon">{isPaid ? '🏆' : '🎉'}</div>
        <h1 className="thankyou-title">
          {isPaid ? 'Upgrade Complete!' : 'Welcome to RIN!'}
        </h1>
        <p className="thankyou-subtitle">
          {isPaid
            ? "Your membership has been upgraded successfully. Log in to your dashboard to access your new features and start tracking your performance."
            : "Your RIN profile is ready. Check your email for your login credentials — then log in to set up your profile and get your RIN ID."}
        </p>

        <div className="thankyou-actions">
          <Link to="/" className="btn btn-primary thankyou-btn">
            Go to Home
          </Link>
          <Link to={isPaid ? '/dashboard' : '/login'} className="btn btn-secondary thankyou-btn">
            {isPaid ? 'Go to Dashboard →' : 'Log In Now →'}
          </Link>
        </div>

        <p className="thankyou-note">
          Questions? Email us at <a href="mailto:info@rinrodeo.com">info@rinrodeo.com</a>
        </p>
      </div>
    </div>
  )
}
