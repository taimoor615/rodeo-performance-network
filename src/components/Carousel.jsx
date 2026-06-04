import { useRef } from 'react'
import { Link } from 'react-router-dom'

/**
 * Carousel with section header (centered eyebrow/title/subtitle, viewAll right) and arrow controls.
 * Uses CSS scroll-snap for smooth sliding.
 */
export default function Carousel({ title, eyebrow, subtitle, viewAllTo, viewAllText = 'View all', children, visibleCount = 3 }) {
  const viewportRef = useRef(null)
  const items = Array.isArray(children) ? children : (children ? [children] : [])

  const scrollBy = (dir) => {
    const el = viewportRef.current
    if (!el) return
    const slide = el.querySelector('.carousel-slide')
    const gap = 16
    const step = (slide?.offsetWidth ?? 280) + gap
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
  }

  if (items.length === 0) return null

  const hasHeader = title || eyebrow || subtitle || viewAllTo

  return (
    <section className="carousel-section" style={{ '--carousel-visible': visibleCount }}>
      {hasHeader && (
        <div className="carousel-section-header">
          <div className="carousel-section-heading">
            {eyebrow && <span className="section-eyebrow">{eyebrow}</span>}
            {title && <h2 className="carousel-section-title">{title}</h2>}
            {subtitle && <p className="carousel-section-subtitle">{subtitle}</p>}
          </div>
          {viewAllTo && (
            <Link to={viewAllTo} className="carousel-section-viewall">
              {viewAllText} →
            </Link>
          )}
        </div>
      )}
      <div className="carousel-wrap">
        <button
          type="button"
          className="carousel-arrow carousel-arrow-prev"
          onClick={() => scrollBy(-1)}
          aria-label="Previous"
        >
          <span aria-hidden>‹</span>
        </button>
        <div className="carousel-viewport" ref={viewportRef}>
          <div className="carousel-track">
            {items.map((child, i) => (
              <div key={i} className="carousel-slide">
                {child}
              </div>
            ))}
          </div>
        </div>
        <button
          type="button"
          className="carousel-arrow carousel-arrow-next"
          onClick={() => scrollBy(1)}
          aria-label="Next"
        >
          <span aria-hidden>›</span>
        </button>
      </div>
    </section>
  )
}
