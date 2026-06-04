import { useEffect, useState, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { getCustomPosts } from '../services/wordpressApi'

const ANIMAL_TYPES = [
  { value: '', label: 'All Animals' },
  { value: 'Bull', label: 'Bulls' },
  { value: 'Bronc', label: 'Broncs' },
  { value: 'Horse', label: 'Horses' },
]

/**
 * Animal profiles (horses, bulls) – breeding, owner, SRI/TEI
 * Per spec: linked to riders and events
 */
export default function AnimalsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const typeFromUrl = searchParams.get('type') || ''
  const [animals, setAnimals] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState(typeFromUrl)
  const [sortBy, setSortBy] = useState('title') // title | sri_desc | tei_desc

  useEffect(() => {
    setTypeFilter(typeFromUrl)
  }, [typeFromUrl])

  useEffect(() => {
    const params = { perPage: 100, _embed: true, orderby: 'title', order: 'asc' }
    if (search.trim()) params.search = search.trim()
    getCustomPosts('animals', params)
      .then(setAnimals)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [search])

  const filteredAnimals = useMemo(() => {
    let list = animals
    if (typeFilter) {
      const typeVal = (a) => (a.meta?.animal_type ?? a.acf?.animal_type ?? 'Animal')
      list = list.filter((a) => typeVal(a).toLowerCase() === typeFilter.toLowerCase())
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((a) => {
        const title = (a.title?.rendered ?? a.title ?? '').toLowerCase().replace(/<[^>]+>/g, '')
        const type = (a.meta?.animal_type ?? a.acf?.animal_type ?? '').toLowerCase()
        const owner = (a.meta?.owner ?? a.acf?.owner ?? '').toLowerCase()
        return title.includes(q) || type.includes(q) || owner.includes(q)
      })
    }
    if (sortBy === 'sri_desc') {
      list = [...list].sort((a, b) => {
        const sa = Number(a.meta?.sri ?? a.acf?.sri ?? 0)
        const sb = Number(b.meta?.sri ?? b.acf?.sri ?? 0)
        return sb - sa
      })
    } else if (sortBy === 'tei_desc') {
      list = [...list].sort((a, b) => {
        const ta = Number(a.meta?.tei ?? a.acf?.tei ?? 0)
        const tb = Number(b.meta?.tei ?? b.acf?.tei ?? 0)
        return tb - ta
      })
    } else {
      list = [...list].sort((a, b) => {
        const ta = (a.title?.rendered ?? a.title ?? '').replace(/<[^>]+>/g, '').toLowerCase()
        const tb = (b.title?.rendered ?? b.title ?? '').replace(/<[^>]+>/g, '').toLowerCase()
        return ta.localeCompare(tb)
      })
    }
    return list
  }, [animals, search, typeFilter, sortBy])

  return (
    <div className="animals-page">
      <h1>Animals</h1>
      <p>Bulls, broncs, and horses with SRI/TEI ratings, breeding, and owner info.</p>

      <div className="filters-bar">
        <input
          type="search"
          placeholder="Search by name or owner…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="filter-input filter-search"
          aria-label="Search animals"
        />
        <select
          value={typeFilter}
          onChange={(e) => {
            const v = e.target.value
            setTypeFilter(v)
            if (v) setSearchParams({ type: v })
            else setSearchParams({})
          }}
          className="filter-select"
          aria-label="Filter by type"
        >
          {ANIMAL_TYPES.map((t) => (
            <option key={t.value || 'all'} value={t.value}>{t.label}</option>
          ))}
        </select>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
          className="filter-select"
          aria-label="Sort by"
        >
          <option value="title">Name A–Z</option>
          <option value="sri_desc">SRI (high to low)</option>
          <option value="tei_desc">TEI (high to low)</option>
        </select>
      </div>

      {loading && <p className="loading">Loading animals from WordPress...</p>}
      {error && (
        <p className="error">
          {error}. Activate the RPN Headless WordPress plugin and add Animals in
          WP Admin.
        </p>
      )}
      {!loading && !error && filteredAnimals.length > 0 && (
        <div className="profile-grid">
          {filteredAnimals.map((animal) => {
            const img = animal._embedded?.['wp:featuredmedia']?.[0]?.source_url
            const sri = animal.meta?.sri ?? animal.acf?.sri
            const tei = animal.meta?.tei ?? animal.acf?.tei
            const type = animal.meta?.animal_type ?? animal.acf?.animal_type ?? 'Animal'
            return (
              <Link
                to={`/animals/${animal.slug}`}
                key={animal.id}
                className="profile-card"
              >
                {img ? (
                  <img src={img} alt="" className="profile-card-photo" />
                ) : (
                  <div className="profile-card-placeholder">
                    {type?.[0] ?? 'A'}
                  </div>
                )}
                <div className="profile-card-body">
                  <h3 className="profile-card-title" dangerouslySetInnerHTML={{ __html: animal.title?.rendered }} />
                  <div className="profile-card-tags">
                    {type && <span className="profile-card-tag">{type}</span>}
                    {(animal.meta?.scoring_type ?? animal.acf?.scoring_type) && (
                      <span className="profile-card-tag">{animal.meta?.scoring_type ?? animal.acf?.scoring_type}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                    {sri != null && <span className="index-badge">SRI {Number(sri).toFixed(1)}</span>}
                    {tei != null && <span className="index-badge">TEI {Number(tei).toFixed(1)}</span>}
                  </div>
                </div>
              </Link>
            )
          })}
        </div>
      )}
      {!loading && !error && filteredAnimals.length === 0 && (
        <p className="placeholder">
          No animals yet. In WordPress: Plugins → activate &quot;RPN Headless
          WordPress&quot;, then add Animals in the admin.
        </p>
      )}
    </div>
  )
}
