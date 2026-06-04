import { Link } from 'react-router-dom'

export default function AboutUsPage() {
  return (
    <div className="about-us-page">
      <header className="about-hero">
        <h1>About RIN</h1>
        <p className="about-hero-tagline">
          Where rodeo performance becomes record.
        </p>
      </header>

      <section className="about-section about-mission">
        <div className="about-section-inner">
          <h2>Our Mission</h2>
          <p>
            RIN (Rodeo Information Network) exists to bring structure, transparency, and verified record-keeping to the sport of rodeo.
          </p>
          <p>
            We track real performance across riders, stock, horses, and events—turning every ride and run into standardized, trusted data.
          </p>
          <p>
            Through official indexes and independent rankings, RIN ensures competitors know where they stand, producers have reliable tools, and fans can follow clear, credible standings.
          </p>
          <p><em>Where rodeo performance becomes record.</em></p>
        </div>
      </section>

      <section className="about-section about-what">
        <div className="about-section-inner">
          <h2>What We Do</h2>
          <ul className="about-feature-list">
            <li>
              <strong>Rider Performance Index (RPI)</strong> — A standardized performance metric that tracks rider results across events and divisions—giving competitors and fans a clear view of where each athlete stands.
            </li>
            <li>
              <strong>Stock &amp; Horse Indexes (SRI, THI)</strong> — Data-driven performance ratings for bulls, broncs, and timed-event horses—helping producers, contractors, and riders make informed decisions.
            </li>
            <li>
              <strong>Pickup Team Index (PTI)</strong> — A performance rating recognizing the skill, consistency, and safety of pickup teams—bringing visibility to one of rodeo&apos;s most important roles.
            </li>
            <li>
              <strong>Event Producer Toolkit</strong> — Integrated tools for rodeo organizers, including verified results tracking, condition reporting, and seamless integration into RIN&apos;s indexing system.
            </li>
            <li>
              <strong>Buckle Rankings &amp; Verified Status</strong> — Independent rankings powered by RIN&apos;s verified records. Top performers earn official recognition, verified profiles, and increased visibility across the network.
            </li>
          </ul>
        </div>
      </section>

      <section className="about-section about-indexes">
        <div className="about-section-inner">
          <h2>Understanding the Indexes</h2>
          <p className="about-indexes-intro">
            RIN uses four performance indexes to rank riders, timed-event horses, stock (bulls and broncs), and pickup teams.
            Each index is explained below so you know exactly what the numbers mean and why they matter.
          </p>

          <div className="about-index-card">
            <h3>RPI – Rider Performance Index</h3>
            <p>
              RPI (Rider Performance Index) measures a contestant&apos;s overall competitive performance across sanctioned rodeos.
            </p>
            <p>It factors in:</p>
            <ul>
              <li>Scores and times</li>
              <li>Event difficulty</li>
              <li>Rodeo tier (Pro &gt; Regional &gt; Local)</li>
              <li>Consistency</li>
              <li>Participation points</li>
            </ul>
            <p><strong>Why it matters:</strong> RPI creates a true performance-based ranking system. Instead of popularity or association bias, riders are ranked based on measurable results. It provides transparency, credibility, and a clear path for advancement.</p>
          </div>

          <div className="about-index-card">
            <h3>TEI – Timed Event Index</h3>
            <p>
              TEI (Timed Event Index) evaluates competitors in timed events such as:
            </p>
            <ul>
              <li>Barrel Racing</li>
              <li>Team Roping</li>
              <li>Breakaway</li>
              <li>Tie-Down</li>
              <li>Steer Wrestling</li>
            </ul>
            <p>It tracks: average times, arena-adjusted performance, horse consistency (and it stays with the horse in perpetuity — even if the horse is sold, you can still track data), and clean run percentage.</p>
            <p><strong>Why it matters:</strong> Timed events demand precision. TEI highlights efficiency and consistency, not just one fast run. It identifies true competitors who deliver under pressure.</p>
          </div>

          <div className="about-index-card">
            <h3>SRI – Stock Rating Index</h3>
            <p>
              SRI (Stock Rating Index) measures the performance quality of bulls and broncs.
            </p>
            <p>It evaluates:</p>
            <ul>
              <li>Difficulty</li>
              <li>Consistency</li>
              <li>Rider score potential</li>
              <li>Buck intensity</li>
              <li>Rank score</li>
            </ul>
            <p><strong>Why it matters:</strong> Stock is half the score in roughstock events. SRI ensures elite animals receive recognition and gives contractors and producers a fair, data-driven way to evaluate and showcase their stock.</p>
          </div>

          <div className="about-index-card">
            <h3>PTI – Pickup Team Index</h3>
            <p>
              <strong>(Safety &amp; Response Performance Rating)</strong>
            </p>
            <p>
              PTI measures the speed, awareness, control, and safety effectiveness of pickup teams during roughstock events.
            </p>
            <p>Pickup teams are the unsung safety backbone of rodeo. PTI finally gives them measurable recognition.</p>
          </div>

          <div className="about-indexes-why">
            <h3>Why These Indexes Matter Overall</h3>
            <p>Together, RPI, TEI, SRI, and PTI create:</p>
            <ul>
              <li>A nationally trackable ranking system</li>
              <li>Objective, data-driven performance measurement</li>
              <li>Fair competitive structure</li>
              <li>Increased exposure for contestants and contractors</li>
              <li>A true performance-based rodeo network</li>
            </ul>
          </div>
        </div>
      </section>

      <section className="about-section about-values">
        <div className="about-section-inner">
          <h2>Our Values</h2>
          <div className="about-values-grid">
            <div className="about-value-card">
              <span className="about-value-icon" aria-hidden>★</span>
              <h3>Fairness</h3>
              <p>One standard, one index. Every ride and every event counts the same.</p>
            </div>
            <div className="about-value-card">
              <span className="about-value-icon" aria-hidden>◆</span>
              <h3>Transparency</h3>
              <p>Open methodology and real-time data so everyone can trust the numbers.</p>
            </div>
            <div className="about-value-card">
              <span className="about-value-icon" aria-hidden>✓</span>
              <h3>Community</h3>
              <p>Built for riders, producers, and fans — we grow the sport together.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="about-section about-cta">
        <div className="about-section-inner">
          <h2>Join the Network</h2>
          <p>
            Whether you&apos;re a rider, producer, or fan — get verified, track your performance, and be part of the
            future of rodeo.
          </p>
          <div className="about-cta-actions">
            <Link to="/join-us" className="btn btn-primary">Join Us</Link>
            <Link to="/rankings" className="btn btn-secondary">View Rankings</Link>
          </div>
        </div>
      </section>
    </div>
  )
}
