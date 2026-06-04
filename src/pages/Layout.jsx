import { useState, useEffect } from 'react'
import { Outlet, Link, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getSiteSettings } from '../services/wordpressApi'
import { WP_CONFIG } from '../config/wordpress'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faChevronDown } from '@fortawesome/free-solid-svg-icons'
import { faFacebook, faXTwitter, faInstagram } from '@fortawesome/free-brands-svg-icons'

const LOGO_SRC = '/rin-logo-img.png'

// Convert a WordPress absolute URL to a React Router path.
// e.g. "http://localhost/rodeo-performance-network/riders" → "/riders"
// External URLs (different origin) are returned as-is.
function toInternalPath(url) {
  if (!url) return null
  try {
    const parsed = new URL(url)
    const wpBase = new URL(WP_CONFIG.baseUrl || window.location.origin)
    if (parsed.hostname !== wpBase.hostname) return null // external link
    // Strip the WordPress sub-path prefix (e.g. /rodeo-performance-network)
    const wpPath = wpBase.pathname.replace(/\/$/, '')
    const itemPath = parsed.pathname.startsWith(wpPath)
      ? parsed.pathname.slice(wpPath.length) || '/'
      : parsed.pathname
    return itemPath || '/'
  } catch {
    // Relative URL or invalid — treat as internal path
    return url.startsWith('/') ? url : null
  }
}

function NavItem({ item, childrenOf, openDropdownId, setOpenDropdownId }) {
  const kids = childrenOf(item.id)
  const internalPath = toInternalPath(item.url)
  const isOpen = openDropdownId === item.id

  if (kids.length > 0) {
    return (
      <li className="nav-dropdown">
        <button
          type="button"
          className="nav-dropdown-label"
          onClick={() => setOpenDropdownId(isOpen ? null : item.id)}
          aria-expanded={isOpen}
          aria-haspopup="true"
        >
          {item.label}
          <FontAwesomeIcon icon={faChevronDown} className="nav-dropdown-arrow" aria-hidden="true" />
        </button>
        <ul className={`nav-dropdown-menu ${isOpen ? 'nav-dropdown-open' : ''}`}>
          {kids.map(child => {
            const childPath = toInternalPath(child.url)
            return (
              <li key={child.id}>
                {childPath
                  ? <Link to={childPath}>{child.label}</Link>
                  : <a href={child.url} target="_blank" rel="noopener noreferrer">{child.label}</a>
                }
              </li>
            )
          })}
        </ul>
      </li>
    )
  }

  return (
    <li>
      {internalPath
        ? <Link to={internalPath}>{item.label}</Link>
        : <a href={item.url} target="_blank" rel="noopener noreferrer">{item.label}</a>
      }
    </li>
  )
}

export default function Layout() {
  const [navOpen, setNavOpen] = useState(false)
  // 'events' | 'more' | null — tracks which static-nav dropdown is open
  const [staticDropdown, setStaticDropdown] = useState(null)
  const [logoError, setLogoError] = useState(false)
  const [siteSettings, setSiteSettings] = useState(null)
  // Track which WP menu item dropdown is open (by item id)
  const [openDropdownId, setOpenDropdownId] = useState(null)

  const location = useLocation()
  const { isAuthenticated, logout } = useAuth()

  // Close nav + dropdowns on route change
  useEffect(() => {
    setNavOpen(false)
    setStaticDropdown(null)
    setOpenDropdownId(null)
  }, [location.pathname])

  // Close dropdowns (and mobile nav) on outside click
  useEffect(() => {
    function handleClick(e) {
      // Close WP + static dropdowns when clicking outside any dropdown
      if (!e.target.closest('.nav-dropdown')) {
        setOpenDropdownId(null)
        setStaticDropdown(null)
      }
      // Close mobile nav when clicking outside the nav bar
      if (!e.target.closest('.main-nav')) {
        setNavOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  // Fetch site settings from WordPress
  useEffect(() => {
    getSiteSettings()
      .then(data => {
        setSiteSettings(data)
        // Dynamically update favicon if WordPress has a site icon set
        if (data?.site_icon_url) {
          const icon = document.querySelector("link[rel='icon']")
          const apple = document.querySelector("link[rel='apple-touch-icon']")
          if (icon)  icon.href  = data.site_icon_url
          if (apple) apple.href = data.site_icon_url
        }
      })
      .catch(() => {}) // fail silently — fallback values used
  }, [])

  // Build menu items from WP nav_menu, falling back to static defaults
  const wpMenuItems = siteSettings?.nav_menu ?? []

  // Separate top-level items and children
  const topLevel = wpMenuItems.filter(item => item.parent === 0)
  const childrenOf = (parentId) => wpMenuItems.filter(item => item.parent === parentId)

  // Logo
  const logoUrl   = siteSettings?.logo_url || null
  const logoText  = siteSettings?.logo_text || 'RIN'

  // Footer menu links (WP repeater or static fallback)
  const exploreLinks = siteSettings?.footer_explore_links?.length > 0
    ? siteSettings.footer_explore_links
    : [
        { label: 'Rankings', url: '/rankings' },
        { label: 'Riders',   url: '/riders'   },
        { label: 'Animals',  url: '/animals'  },
        { label: 'Events',   url: '/events'   },
      ]

  const moreLinks = siteSettings?.footer_more_links?.length > 0
    ? siteSettings.footer_more_links
    : [
        { label: 'About',            url: '/about-us'        },
        { label: 'Organizations',    url: '/producers'       },
        { label: 'Contractors',      url: '/contractors'     },
        { label: 'NIL Marketplace',  url: '/nil-marketplace' },
        { label: 'Fantasy Rodeo',    url: '/fantasy'         },
      ]

  // Footer values (WP or static fallback)
  const footerTagline   = siteSettings?.footer_tagline   || 'Performance-based scoring for rodeo athletes, horses, bulls, and pickup teams.'
  const footerEmail     = siteSettings?.footer_email     || 'info@rinrodeo.com'
  const footerPhone     = siteSettings?.footer_phone     || '434-604-0972'
  const footerFacebook  = siteSettings?.footer_facebook  || 'https://facebook.com'
  const footerTwitter   = siteSettings?.footer_twitter   || 'https://twitter.com'
  const footerInstagram = siteSettings?.footer_instagram || 'https://instagram.com'
  const footerCopyright = siteSettings?.footer_copyright
    || `© ${new Date().getFullYear()} ${siteSettings?.site_name || 'Rodeo Information Network'}. All rights reserved.`


  // Static fallback nav (used when WP menu is empty)
  const staticNav = (
    <>
      <li><Link to="/">Home</Link></li>
      <li><Link to="/rankings">Rankings</Link></li>
      <li><Link to="/riders">Riders</Link></li>
      <li><Link to="/animals">Animals</Link></li>

      {/* Events dropdown */}
      <li className="nav-dropdown">
        <button
          type="button"
          className="nav-dropdown-label"
          onClick={() => setStaticDropdown(staticDropdown === 'events' ? null : 'events')}
          aria-expanded={staticDropdown === 'events'}
          aria-haspopup="true"
        >
          Events
          <FontAwesomeIcon icon={faChevronDown} className="nav-dropdown-arrow" aria-hidden="true" />
        </button>
        <ul className={`nav-dropdown-menu ${staticDropdown === 'events' ? 'nav-dropdown-open' : ''}`}>
          <li><Link to="/events">All Events</Link></li>
          <li><Link to="/events?status=upcoming">Upcoming Events</Link></li>
          <li><Link to="/events?status=completed">Past Results</Link></li>
        </ul>
      </li>

      {/* More dropdown */}
      <li className="nav-dropdown">
        <button
          type="button"
          className="nav-dropdown-label"
          onClick={() => setStaticDropdown(staticDropdown === 'more' ? null : 'more')}
          aria-expanded={staticDropdown === 'more'}
          aria-haspopup="true"
        >
          More
          <FontAwesomeIcon icon={faChevronDown} className="nav-dropdown-arrow" aria-hidden="true" />
        </button>
        <ul className={`nav-dropdown-menu ${staticDropdown === 'more' ? 'nav-dropdown-open' : ''}`}>
          <li><Link to="/about-us">About Us</Link></li>
          <li><Link to="/producers">Organizations</Link></li>
          <li><Link to="/contractors">Contractors</Link></li>
          <li><Link to="/nil-marketplace">NIL Marketplace</Link></li>
          <li><Link to="/fantasy">Fantasy Rodeo</Link></li>
        </ul>
      </li>
    </>
  )

  return (
    <div className="rpn-layout">
      <nav className="main-nav">
        <Link to="/" className="logo">
          {logoUrl ? (
            <img src={logoUrl} alt={logoText} className="logo-img" onError={() => setLogoError(true)} />
          ) : !logoError ? (
            <img src={LOGO_SRC} alt="RIN" className="logo-img" onError={() => setLogoError(true)} />
          ) : (
            <span className="logo-icon">{logoText}</span>
          )}
        </Link>

        <button
          type="button"
          className="nav-toggle"
          aria-expanded={navOpen}
          aria-label="Toggle menu"
          onClick={() => setNavOpen(!navOpen)}
        >
          <span /><span /><span />
        </button>

        <ul className={navOpen ? 'nav-open' : ''}>
          {topLevel.length > 0
            ? topLevel.map(item => <NavItem key={item.id} item={item} childrenOf={childrenOf} openDropdownId={openDropdownId} setOpenDropdownId={setOpenDropdownId} />)
            : staticNav
          }
          {/* Auth-dependent items always appended */}
          {!isAuthenticated && <li><Link to="/join-us">Join Us</Link></li>}
          {isAuthenticated ? (
            <>
              <li><Link to="/dashboard">Dashboard</Link></li>
              <li><button type="button" className="nav-link-btn" onClick={logout}>Logout</button></li>
            </>
          ) : (
            <li><Link to="/login">Login</Link></li>
          )}
        </ul>
      </nav>

      <main className="main-content">
        <Outlet />
      </main>

      <footer className="main-footer">
        <div className="footer-inner">
          <div className="footer-col footer-brand">
            <Link to="/" className="footer-logo">
              {logoUrl
                ? <img src={logoUrl} alt={logoText} style={{ height: 75, objectFit: 'contain' }} />
                : logoText
              }
            </Link>
            <p>{footerTagline}</p>
          </div>

          <div className="footer-col footer-links">
            <h4>Explore</h4>
            <ul>
              {exploreLinks.map(link => {
                const path = toInternalPath(link.url)
                return (
                  <li key={link.label}>
                    {path
                      ? <Link to={path}>{link.label}</Link>
                      : <a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a>
                    }
                  </li>
                )
              })}
            </ul>
          </div>

          <div className="footer-col footer-links-secondary">
            <h4>More</h4>
            <ul>
              {moreLinks.map(link => {
                const path = toInternalPath(link.url)
                return (
                  <li key={link.label}>
                    {path
                      ? <Link to={path}>{link.label}</Link>
                      : <a href={link.url} target="_blank" rel="noopener noreferrer">{link.label}</a>
                    }
                  </li>
                )
              })}
              {!isAuthenticated && <li><Link to="/join-us">Join Us</Link></li>}
              {isAuthenticated && <li><Link to="/dashboard">Dashboard</Link></li>}
            </ul>
          </div>

          <div className="footer-col footer-contact">
            <h4>Contact</h4>
            {footerEmail && <p>Email: <a href={`mailto:${footerEmail}`}>{footerEmail}</a></p>}
            {footerPhone && <p>Phone: <a href={`tel:${footerPhone.replace(/\D/g, '')}`}>{footerPhone}</a></p>}
          </div>

          <div className="footer-col footer-social">
            <h4>Follow Us</h4>
            <div className="footer-social-links">
              {footerFacebook  && <a href={footerFacebook}  target="_blank" rel="noopener noreferrer" aria-label="Facebook"><FontAwesomeIcon icon={faFacebook} /></a>}
              {footerTwitter   && <a href={footerTwitter}   target="_blank" rel="noopener noreferrer" aria-label="X / Twitter"><FontAwesomeIcon icon={faXTwitter} /></a>}
              {footerInstagram && <a href={footerInstagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram"><FontAwesomeIcon icon={faInstagram} /></a>}
            </div>
          </div>
        </div>

        <div className="footer-bottom">
          <p>{footerCopyright}</p>
          <p className="footer-legal-links">
            <Link to="/legal">Terms of Service</Link>
            <span aria-hidden="true">&nbsp;|&nbsp;</span>
            <Link to="/privacy-policy">Privacy Policy</Link>
            <span aria-hidden="true">&nbsp;|&nbsp;</span>
            <a href="mailto:info@rinrodeo.com">info@rinrodeo.com</a>
          </p>
        </div>
      </footer>
    </div>
  )
}
