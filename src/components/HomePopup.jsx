import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

const STORAGE_KEY = 'rin_welcome_popup_dismissed'

export default function HomePopup() {
  const [visible, setVisible] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    const dismissed = sessionStorage.getItem(STORAGE_KEY)
    if (!dismissed) {
      // Small delay so the page content loads first
      const t = setTimeout(() => setVisible(true), 600)
      return () => clearTimeout(t)
    }
  }, [])

  function dismiss() {
    sessionStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  function handleFeedback() {
    dismiss()
    window.location.href = 'mailto:info@rinrodeo.com?subject=Feedback%20for%20RIN'
  }

  function handleGetStarted() {
    dismiss()
    navigate('/join-us')
  }

  if (!visible) return null

  return (
    <div className="home-popup-overlay" role="dialog" aria-modal="true" aria-labelledby="popup-title">
      <div className="home-popup">
        <button
          type="button"
          className="home-popup-close"
          onClick={dismiss}
          aria-label="Close"
        >
          &times;
        </button>

        <div className="home-popup-icon" aria-hidden="true">🤠</div>

        <h2 id="popup-title" className="home-popup-title">We're Building Something Big</h2>

        <div className="home-popup-body">
          <p>
            The Rodeo Information Network is live and still growing. Some features are still
            being built, so you may see changes as we continue improving the platform.
          </p>
          <p>
            Right now, the most important thing is collecting data. Every rider, animal owner, and
            contractor who creates a profile and enters results helps build the foundation for this sport.
          </p>
          <p>
            If you have ideas or suggestions, we would love to hear them. This platform is built
            for the rodeo community.
          </p>
        </div>

        <div className="home-popup-actions">
          <button type="button" className="home-popup-btn home-popup-btn--secondary" onClick={handleFeedback}>
            Share Your Feedback
          </button>
          <button type="button" className="home-popup-btn home-popup-btn--primary" onClick={handleGetStarted}>
            Get Started
          </button>
        </div>
      </div>
    </div>
  )
}
