import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { getPosts, getCustomPosts, getHomepageData, getRevenueProducts, getEvents } from '../services/wordpressApi'
import { getRiderImage, getAnimalImage, getEventImage } from '../utils/placeholders'
import Carousel from '../components/Carousel'
import HomePopup from '../components/HomePopup'

export default function HomePage() {
  const [posts, setPosts] = useState([])
  const [riders, setRiders] = useState([])
  const [animals, setAnimals] = useState([])
  const [homepage, setHomepage] = useState(null)
  const [revenueProducts, setRevenueProducts] = useState([])
  const [allEvents, setAllEvents] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [homepageApiError, setHomepageApiError] = useState(null)
  const [faqOpen, setFaqOpen] = useState(null)

  useEffect(() => {
    const loadHomepage = getHomepageData()
      .then((data) => {
        setHomepage(data || {})
        setHomepageApiError(null)
      })
      .catch((err) => {
        setHomepage({})
        setHomepageApiError(err.message || 'Could not load homepage sections from WordPress.')
      })

    const loadRevenueProducts = getRevenueProducts()
      .then((data) => {
        // API returns { products: [...] }
        setRevenueProducts(Array.isArray(data?.products) ? data.products : [])
      })
      .catch(() => {
        setRevenueProducts([])
      })

    const loadEvents = getEvents({ perPage: 50 }).then((data) => setAllEvents(Array.isArray(data) ? data : [])).catch(() => setAllEvents([]))

    Promise.all([
      getPosts({ perPage: 6 }),
      getCustomPosts('riders', { perPage: 10, _embed: true }),
      getCustomPosts('animals', { perPage: 10, _embed: true }),
      loadHomepage,
      loadRevenueProducts,
      loadEvents,
    ])
      .then(([postsData, ridersData, animalsData]) => {
        setPosts(postsData || [])
        setRiders(Array.isArray(ridersData) ? ridersData : [])
        setAnimals(Array.isArray(animalsData) ? animalsData : [])
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  const hero = homepage?.hero || {}
  const faq = homepage?.faq || []
  const reviews = homepage?.reviews || []
  const topRiders = homepage?.top_riders || []
  const upcomingEvents = homepage?.upcoming_events || []
  const recentEvents = homepage?.recent_events || []
  const plans = homepage?.membership_plans || []
  const revenuePlans = revenueProducts

  const topRidersList = (topRiders.length > 0 ? topRiders : riders).slice(0, 5)
  const eventsForSlider = recentEvents.length > 0 ? recentEvents : (Array.isArray(allEvents) ? allEvents : [])
  const heroTitle = hero.title || 'Every Ride Measured. Every Career Proven.'
  const heroSubtitle = hero.subtitle || 'The first national performance index built for rodeo athletes, animals, and the people who run the sport.'
  const primaryText = hero.primary_button_text || 'View Performance Leaders'
  const primaryLink = hero.primary_button_link || '/rankings'
  const secondaryText = hero.secondary_button_text || 'Browse Riders'
  const secondaryLink = hero.secondary_button_link || '/riders'

  return (
    <div className="home-page">
      <HomePopup />
      {homepageApiError && (
        <div className="homepage-api-error" role="alert">
          {homepageApiError} Check that the RPN Headless plugin is active and the homepage API is reachable at <code>/wp-json/rpn/v1/homepage</code>.
        </div>
      )}

      <header className="hero home-hero" style={hero.background_image_url ? { '--hero-bg-image': `url(${hero.background_image_url})` } : undefined}>
        <div className="hero-bg" aria-hidden="true" />
        <div className="hero-overlay" aria-hidden="true" />
        <div className="hero-content">
          <div className="hero-eyebrow">
            <span className="hero-eyebrow-dot" aria-hidden="true" />
            RIN — Live Performance Tracking
          </div>
          <h1 className="hero-title">{heroTitle}</h1>
          <p className="tagline">{heroSubtitle}</p>
          <div className="hero-actions">
            {primaryLink.startsWith('http') ? <a href={primaryLink} className="btn btn-primary">{primaryText}</a> : <Link to={primaryLink} className="btn btn-primary">{primaryText}</Link>}
            {secondaryLink.startsWith('http') ? <a href={secondaryLink} className="btn btn-secondary">{secondaryText}</a> : <Link to={secondaryLink} className="btn btn-secondary">{secondaryText}</Link>}
          </div>
          <div className="hero-stats-row">
            <div className="hero-stat-item">
              <span className="hero-stat-value">{riders.length > 0 ? riders.length + '+' : 'Growing Daily'}</span>
              <span className="hero-stat-label">Registered Riders</span>
            </div>
            <div className="hero-stat-item">
              <span className="hero-stat-value">{animals.length > 0 ? animals.length + '+' : 'Growing Daily'}</span>
              <span className="hero-stat-label">Animals Ranked</span>
            </div>
            <div className="hero-stat-item">
              <span className="hero-stat-value">RPI</span>
              <span className="hero-stat-label">Live Performance Index</span>
            </div>
          </div>
        </div>
      </header>

      <section className="home-stats">
        <div className="home-stats-inner">
          <div className="home-stat">
            <span className="home-stat-value">{riders.length > 0 ? riders.length + '+' : '500+'}</span>
            <span className="home-stat-label">Riders</span>
          </div>
          <div className="home-stat">
            <span className="home-stat-value">{animals.length > 0 ? animals.length + '+' : '500+'}</span>
            <span className="home-stat-label">Animals</span>
          </div>
          <div className="home-stat">
            <span className="home-stat-value">4</span>
            <span className="home-stat-label">Performance Indexes</span>
          </div>
          <div className="home-stat">
            <span className="home-stat-value">50</span>
            <span className="home-stat-label">States</span>
          </div>
        </div>
      </section>

      <section className="features home-features">
        <div className="section-header">
          <span className="section-eyebrow">Scoring System</span>
          <h2 className="section-title">Core Performance Indexes</h2>
          <p className="section-subtitle">Four data-driven indexes built for every part of the rodeo ecosystem.</p>
        </div>
        <div className="index-grid">
          {[
            { label: 'RPI', name: 'Rider Performance Index', desc: "Measures a contestant's overall competitive performance across sanctioned rodeos." },
            { label: 'TPI', name: 'Timed Performance Index', desc: 'Evaluates timed-event competitors: Barrel Racing, Team Roping, Breakaway, Tie-Down & Steer Wrestling.' },
            { label: 'SRI', name: 'Stock Rating Index', desc: 'Measures the performance quality of bulls and broncs across all events.' },
            { label: 'PTI', name: 'Pickup Team Index', desc: 'Rates the speed, control, and safety effectiveness of pickup teams in roughstock events.' },
          ].map((item, i) => (
            <div key={item.label} className="index-card" style={{ animationDelay: `${i * 0.1}s` }}>
              <span className="index-label">{item.label}</span>
              <strong className="index-card-name">{item.name}</strong>
              <p>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Top Riders – carousel, 5 only */}
      {topRidersList.length > 0 && (
        <Carousel title="Top Riders" eyebrow="Leaderboard" subtitle="The highest-rated competitors on the national circuit." viewAllTo="/rankings" viewAllText="View Standings" visibleCount={3}>
          {topRidersList.map((rider, i) => {
            const name = rider.title?.rendered ? String(rider.title.rendered).replace(/<[^>]+>/g, '') : rider.title || 'Rider'
            const location = [rider.city, rider.state].filter(Boolean).join(', ')
            const eventType = rider.event_type || rider.meta?.event_type || rider.acf?.event_type
            return (
              <Link to={rider.slug ? `/riders/${rider.slug}` : '/riders'} key={rider.id || i} className="home-featured-card">
                <img src={rider.image_url || getRiderImage(rider)} alt="" className="home-featured-card-img" />
                <div className="home-featured-card-body">
                  <span className="home-featured-card-title">{name}</span>
                  {(location || eventType) && (
                    <div className="home-featured-card-meta">
                      {location && <span className="home-featured-card-tag">{location}</span>}
                      {eventType && <span className="home-featured-card-tag">{eventType}</span>}
                    </div>
                  )}
                  <div>
                    {rider.rpi != null && <span className="home-featured-card-badge">RPI {Number(rider.rpi).toFixed(1)}</span>}
                  </div>
                </div>
              </Link>
            )
          })}
        </Carousel>
      )}

      {/* Upcoming Events */}
      {upcomingEvents.length > 0 && (
        <Carousel title="Upcoming Events" eyebrow="On the Circuit" subtitle="Sanctioned rodeo events happening near you." viewAllTo="/events" viewAllText="View all events" visibleCount={3}>
          {upcomingEvents.map((event) => (
            <Link to={`/events/${event.slug}`} key={event.id} className="home-event-card">
              <img src={getEventImage(event)} alt="" className="home-event-card-img" />
              <div className="home-event-card-body">
                <h3 className="home-event-card-title">{typeof event.title === 'string' ? event.title : event.title?.rendered?.replace?.(/<[^>]+>/g, '') || 'Event'}</h3>
                <p className="home-event-card-meta">
                  {event.event_date && new Date(event.event_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  {event.city && ` · ${event.city}`}
                  {event.state && `, ${event.state}`}
                </p>
              </div>
            </Link>
          ))}
        </Carousel>
      )}

      {/* Recent Events – slider with all published events */}
      {eventsForSlider.length > 0 && (
        <Carousel title="Recent Events" eyebrow="Results" subtitle="Latest scores and standings from completed events." viewAllTo="/events" viewAllText="View all events" visibleCount={3}>
          {eventsForSlider.map((event) => (
            <Link to={`/events/${event.slug}`} key={event.id} className="home-event-card">
              <img src={getEventImage(event)} alt="" className="home-event-card-img" />
              <div className="home-event-card-body">
                <h3 className="home-event-card-title">{typeof event.title === 'string' ? event.title : event.title?.rendered?.replace?.(/<[^>]+>/g, '') || 'Event'}</h3>
                <p className="home-event-card-meta">
                  {event.event_date && new Date(event.event_date).toLocaleDateString()}
                  {event.venue && ` · ${event.venue}`}
                  {event.city && ` · ${event.city}`}
                  {event.state && `, ${event.state}`}
                </p>
              </div>
            </Link>
          ))}
        </Carousel>
      )}

      <section className="home-why">
        <div className="section-header">
          <span className="section-eyebrow">The RIN Difference</span>
          <h2 className="section-title">Why RIN?</h2>
          <p className="section-subtitle">Built for riders, contractors, and producers who compete to be the best.</p>
        </div>
        <div className="home-why-grid">
          <div className="home-why-item">
            <span className="home-why-icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
            </span>
            <h3>Fair Scoring</h3>
            <p>Scores adjusted for arena, weather, and event tier so every ride is measured fairly.</p>
          </div>
          <div className="home-why-item">
            <span className="home-why-icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
            </span>
            <h3>Performance Leaders</h3>
            <p>See where athletes rank by state, city, and age group — updated in real time.</p>
          </div>
          <div className="home-why-item">
            <span className="home-why-icon" aria-hidden="true">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </span>
            <h3>NIL-Ready Profiles</h3>
            <p>Shareable rider and animal profiles built for sponsorship, media, and exposure.</p>
          </div>
        </div>
      </section>

      {/* Riders carousel */}
      {riders.length > 0 && (
        <Carousel title="Riders" eyebrow="Directory" subtitle="Verified riders competing on the national circuit." viewAllTo="/riders" viewAllText="View all Riders" visibleCount={3}>
          {riders.map((rider) => {
            const rpi = rider.meta?.rpi ?? rider.acf?.rpi
            const state = rider.meta?.state ?? rider.acf?.state
            const city = rider.meta?.city ?? rider.acf?.city
            const eventType = rider.meta?.event_type ?? rider.acf?.event_type
            const location = [city, state].filter(Boolean).join(', ')
            return (
              <Link to={`/riders/${rider.slug}`} key={rider.id} className="home-featured-card">
                <img src={getRiderImage(rider)} alt="" className="home-featured-card-img" />
                <div className="home-featured-card-body">
                  <span className="home-featured-card-title" dangerouslySetInnerHTML={{ __html: rider.title?.rendered }} />
                  {(location || eventType) && (
                    <div className="home-featured-card-meta">
                      {location && <span className="home-featured-card-tag">{location}</span>}
                      {eventType && <span className="home-featured-card-tag">{eventType}</span>}
                    </div>
                  )}
                  <div>
                    {rpi != null && <span className="home-featured-card-badge">RPI {Number(rpi).toFixed(1)}</span>}
                  </div>
                </div>
              </Link>
            )
          })}
        </Carousel>
      )}

      {/* Animals carousel */}
      {animals.length > 0 && (
        <Carousel title="Animals" eyebrow="Stock" subtitle="Bulls and broncs rated by the Stock Rating Index." viewAllTo="/animals" viewAllText="View all Animals" visibleCount={3}>
          {animals.map((animal) => {
            const sri = animal.meta?.sri ?? animal.acf?.sri
            const tei = animal.meta?.tei ?? animal.acf?.tei
            const animalType = animal.meta?.animal_type ?? animal.acf?.animal_type
            const state = animal.meta?.state ?? animal.acf?.state
            return (
              <Link to={`/animals/${animal.slug}`} key={animal.id} className="home-featured-card">
                <img src={getAnimalImage(animal)} alt="" className="home-featured-card-img" />
                <div className="home-featured-card-body">
                  <span className="home-featured-card-title" dangerouslySetInnerHTML={{ __html: animal.title?.rendered }} />
                  {(animalType || state) && (
                    <div className="home-featured-card-meta">
                      {state && <span>{state}</span>}
                      {animalType && <span className="home-featured-card-tag">{animalType}</span>}
                    </div>
                  )}
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {sri != null && <span className="home-featured-card-badge">SRI {Number(sri).toFixed(1)}</span>}
                    {tei != null && <span className="home-featured-card-badge">TEI {Number(tei).toFixed(1)}</span>}
                  </div>
                </div>
              </Link>
            )
          })}
        </Carousel>
      )}

      {/* Reviews carousel */}
      {reviews.length > 0 && (
        <Carousel title="What Riders Say" eyebrow="Community" subtitle="Hear from athletes who compete on the RIN network." viewAllTo={null} visibleCount={3}>
          {reviews.map((review, i) => (
            <div key={i} className="home-review-card">
              <div className="home-review-stars">
                {'★'.repeat(review.rating || 5)}{'☆'.repeat(5 - (review.rating || 5))}
              </div>
              <p className="home-review-text">&ldquo;{review.review_text}&rdquo;</p>
              <div className="home-review-author">
                {review.image_url && <img src={review.image_url} alt="" className="home-review-avatar" />}
                <span>{review.reviewer_name}</span>
              </div>
            </div>
          ))}
        </Carousel>
      )}

      {/* FAQ */}
      {faq.length > 0 && (
        <section className="home-faq">
          <div className="section-header">
            <span className="section-eyebrow">Help</span>
            <h2 className="section-title">Common Questions</h2>
            <p className="section-subtitle">Everything you need to know about how RIN works.</p>
          </div>
          <div className="home-faq-list">
            {faq.map((item, i) => (
              <div key={i} className="home-faq-item">
                <button
                  type="button"
                  className="home-faq-question"
                  onClick={() => setFaqOpen(faqOpen === i ? null : i)}
                  aria-expanded={faqOpen === i}
                >
                  {item.question}
                  <span className="home-faq-icon">{faqOpen === i ? '−' : '+'}</span>
                </button>
                {faqOpen === i && <div className="home-faq-answer">{item.answer}</div>}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Revenue Products / Membership Plans – drive WooCommerce checkout from React */}
      {(revenuePlans.length > 0 || plans.length > 0) && (
        <section className="home-plans">
          <div className="section-header">
            <span className="section-eyebrow">Membership</span>
            <h2 className="section-title">Join RIN</h2>
            <p className="section-subtitle">Choose your card or membership. Checkout is handled securely by WordPress + Stripe.</p>
          </div>
          <div className="home-plans-grid">
            {/* Primary: products coming from WooCommerce via /rpn/v1/revenue-products */}
            {revenuePlans.map((prod, i) => (
              <div
                key={prod.product_id || prod.slug || i}
                className="home-plan-card"
              >
                <h3 className="home-plan-name">{prod.label || prod.name}</h3>
                <div className="home-plan-price">
                  {prod.price != null ? (
                    <>
                      <span className="home-plan-amount">${Number(prod.price).toFixed(2)}</span>
                      {prod.key === 'premium_membership' && (
                        <span className="home-plan-interval">/month</span>
                      )}
                    </>
                  ) : (
                    <span className="home-plan-amount">—</span>
                  )}
                </div>
                {prod.description && (
                  <p className="home-plan-desc">{prod.description}</p>
                )}
                <a href={prod.checkout_url} className="btn home-plan-btn">
                  Get started
                </a>
              </div>
            ))}

            {/* Fallback: CMS-configured marketing plans */}
            {revenuePlans.length === 0 &&
              plans.map((plan, i) => (
                <div
                  key={`acf-${i}`}
                  className={`home-plan-card ${plan.highlighted ? 'home-plan-card-highlighted' : ''}`}
                >
                  <h3 className="home-plan-name">{plan.name}</h3>
                  <div className="home-plan-price">
                    {plan.price !== undefined && plan.price !== null && plan.price !== '' ? (
                      <>
                        <span className="home-plan-amount">${plan.price}</span>
                        {plan.interval && <span className="home-plan-interval">/{plan.interval}</span>}
                      </>
                    ) : (
                      <span className="home-plan-amount">—</span>
                    )}
                  </div>
                  {Array.isArray(plan.features) && plan.features.length > 0 && (
                    <ul className="home-plan-features">
                      {plan.features.filter(Boolean).map((f, j) => (
                        <li key={j}>{f}</li>
                      ))}
                    </ul>
                  )}
                  <a href={plan.button_link || '#'} className="btn home-plan-btn">
                    {plan.button_text || 'Sign Up'}
                  </a>
                </div>
              ))}
          </div>
        </section>
      )}

      <section className="home-cta">
        <div className="home-cta-inner">
          <span className="section-eyebrow">Start Today</span>
          <h2 className="section-title">Ready to compete?</h2>
          <p>Join the network. Get your performance index. Climb the national Performance Index.</p>
          <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link to="/join-us" className="btn btn-primary">Get Started Free</Link>
            <Link to="/rankings" className="btn btn-secondary">View Performance Leaders</Link>
          </div>
        </div>
      </section>

      {!loading && !error && posts.length > 0 && (
        <section className="home-posts-section">
          <div className="section-header">
            <span className="section-eyebrow">News &amp; Updates</span>
            <h2 className="section-title">Latest from RIN</h2>
            <p className="section-subtitle">Stay up to date with rodeo news, rankings, and announcements.</p>
          </div>
          <Carousel visibleCount={3}>
            {posts.map((post) => {
              const featImg = post._embedded?.['wp:featuredmedia']?.[0]?.source_url || null
              const categories = post._embedded?.['wp:term']?.[0] || []
              const tags       = post._embedded?.['wp:term']?.[1] || []
              const excerpt    = post.excerpt?.rendered
                ? post.excerpt.rendered.replace(/<[^>]+>/g, '').replace(/\[&hellip;\]/g, '…').trim()
                : ''
              const dateStr = new Date(post.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })

              return (
                <article key={post.id} className="post-card">
                  <Link to={`/post/${post.slug}`} className="post-card-image-link" tabIndex={-1} aria-hidden>
                    {featImg
                      ? <img src={featImg} alt={post.title.rendered} className="post-card-img" loading="lazy" />
                      : <div className="post-card-img-placeholder"><span>RIN</span></div>
                    }
                  </Link>
                  <div className="post-card-body">
                    {categories.length > 0 && (
                      <div className="post-card-cats">
                        {categories.slice(0, 2).map(cat => (
                          <span key={cat.id} className="post-card-cat">{cat.name}</span>
                        ))}
                      </div>
                    )}
                    <h3 className="post-card-title">
                      <Link to={`/post/${post.slug}`} dangerouslySetInnerHTML={{ __html: post.title.rendered }} />
                    </h3>
                    {excerpt && <p className="post-card-excerpt">{excerpt.length > 110 ? excerpt.slice(0, 110) + '…' : excerpt}</p>}
                    <div className="post-card-footer">
                      <time className="post-card-date">{dateStr}</time>
                      {tags.slice(0, 2).map(tag => (
                        <span key={tag.id} className="post-card-tag">#{tag.name}</span>
                      ))}
                    </div>
                    <Link to={`/post/${post.slug}`} className="post-card-read-more">Read more →</Link>
                  </div>
                </article>
              )
            })}
          </Carousel>
        </section>
      )}
    </div>
  )
}
