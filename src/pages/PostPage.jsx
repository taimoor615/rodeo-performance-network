import { useParams, Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { getPost, getPosts } from '../services/wordpressApi'
import { decodeHtmlEntities, stripHtml } from '../utils/html'

function PostMeta({ icon, children }) {
  return (
    <span className="post-meta-item">
      <span className="post-meta-icon" aria-hidden>{icon}</span>
      {children}
    </span>
  )
}

export default function PostPage() {
  const { slug } = useParams()
  const [post, setPost]         = useState(null)
  const [related, setRelated]   = useState([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)

  useEffect(() => {
    setLoading(true)
    setPost(null)
    getPost(slug)
      .then(p => {
        setPost(p)
        // Fetch a few more posts for the "More from RIN" section
        return getPosts({ perPage: 4 }).then(all => {
          setRelated(all.filter(r => r.id !== p.id).slice(0, 3))
        })
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) return (
    <div className="post-page-loading">
      <div className="post-page-skeleton">
        <div className="skeleton-hero" />
        <div className="skeleton-body">
          <div className="skeleton-line w60" />
          <div className="skeleton-line w40" />
          <div className="skeleton-line w100" />
          <div className="skeleton-line w90" />
          <div className="skeleton-line w80" />
        </div>
      </div>
    </div>
  )

  if (error) return (
    <div className="post-page-error">
      <h2>Could not load post</h2>
      <p>{error}</p>
      <Link to="/" className="post-back-btn">← Back to Home</Link>
    </div>
  )

  if (!post) return (
    <div className="post-page-error">
      <h2>Post not found</h2>
      <Link to="/" className="post-back-btn">← Back to Home</Link>
    </div>
  )

  const featImg    = post._embedded?.['wp:featuredmedia']?.[0]?.source_url || null
  const featAlt    = post._embedded?.['wp:featuredmedia']?.[0]?.alt_text   || decodeHtmlEntities(post.title.rendered)
  const author     = post._embedded?.author?.[0]?.name || null
  const categories = post._embedded?.['wp:term']?.[0] || []
  const tags       = post._embedded?.['wp:term']?.[1] || []
  const dateStr    = new Date(post.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
  const readTime   = Math.max(1, Math.round((post.content.rendered.replace(/<[^>]+>/g, '').split(/\s+/).length) / 200))

  return (
    <div className="post-page">

      {/* ── Hero ── */}
      <div className={`post-hero ${featImg ? 'post-hero--image' : 'post-hero--plain'}`}>
        {featImg && (
          <div className="post-hero-img-wrap">
            <img src={featImg} alt={featAlt} className="post-hero-img" />
            <div className="post-hero-overlay" />
          </div>
        )}
        <div className="post-hero-content">
          <Link to="/" className="post-back-btn">← Back to Home</Link>

          {categories.length > 0 && (
            <div className="post-hero-cats">
              {categories.map(cat => (
                <span key={cat.id} className="post-hero-cat">{decodeHtmlEntities(cat.name)}</span>
              ))}
            </div>
          )}

          <h1 className="post-hero-title" dangerouslySetInnerHTML={{ __html: post.title.rendered }} />

          <div className="post-hero-meta">
            {author     && <PostMeta icon="✍">By {author}</PostMeta>}
            <PostMeta icon="📅">{dateStr}</PostMeta>
            <PostMeta icon="⏱">{readTime} min read</PostMeta>
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className="post-layout">
        <article className="post-article">

          {/* Tags */}
          {tags.length > 0 && (
            <div className="post-tags">
              {tags.map(tag => (
                <span key={tag.id} className="post-tag">#{decodeHtmlEntities(tag.name)}</span>
              ))}
            </div>
          )}

          {/* Content */}
          <div
            className="post-content"
            dangerouslySetInnerHTML={{ __html: post.content.rendered }}
          />

          {/* Share / nav */}
          <div className="post-article-footer">
            <Link to="/" className="post-back-btn">← Back to Home</Link>
            <div className="post-share">
              <span>Share:</span>
              <a
                href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(decodeHtmlEntities(post.title.rendered))}`}
                target="_blank" rel="noopener noreferrer" className="post-share-btn"
              >Twitter</a>
              <a
                href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(window.location.href)}`}
                target="_blank" rel="noopener noreferrer" className="post-share-btn"
              >Facebook</a>
            </div>
          </div>
        </article>
      </div>

      {/* ── More from RIN ── */}
      {related.length > 0 && (
        <section className="post-related">
          <h2 className="post-related-title">More from RIN</h2>
          <div className="post-related-grid">
            {related.map(r => {
              const img     = r._embedded?.['wp:featuredmedia']?.[0]?.source_url || null
              const cats    = r._embedded?.['wp:term']?.[0] || []
              const excerpt = r.excerpt?.rendered
                ? stripHtml(r.excerpt.rendered).replace(/\[…\]/g, '…')
                : ''
              const d = new Date(r.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
              return (
                <article key={r.id} className="post-card">
                  <Link to={`/post/${r.slug}`} className="post-card-image-link" tabIndex={-1} aria-hidden>
                    {img
                      ? <img src={img} alt={decodeHtmlEntities(r.title.rendered)} className="post-card-img" loading="lazy" />
                      : <div className="post-card-img-placeholder"><span>RIN</span></div>
                    }
                  </Link>
                  <div className="post-card-body">
                    {cats.length > 0 && (
                      <div className="post-card-cats">
                        {cats.slice(0, 2).map(c => <span key={c.id} className="post-card-cat">{decodeHtmlEntities(c.name)}</span>)}
                      </div>
                    )}
                    <h3 className="post-card-title">
                      <Link to={`/post/${r.slug}`} dangerouslySetInnerHTML={{ __html: r.title.rendered }} />
                    </h3>
                    {excerpt && <p className="post-card-excerpt">{excerpt.length > 90 ? excerpt.slice(0, 90) + '…' : excerpt}</p>}
                    <div className="post-card-footer">
                      <time className="post-card-date">{d}</time>
                    </div>
                    <Link to={`/post/${r.slug}`} className="post-card-read-more">Read more →</Link>
                  </div>
                </article>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
