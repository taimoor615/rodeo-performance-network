/**
 * WordPress REST API Service
 * Headless WordPress integration for RPN
 */

import { WP_CONFIG } from '../config/wordpress'

const getApiUrl = (endpoint, params = {}) => {
  const url = new URL(`${WP_CONFIG.apiUrl}${endpoint}`)
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      url.searchParams.append(key, value)
    }
  })
  return url.toString()
}

const handleResponse = async (response) => {
  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(error.message || `API Error: ${response.status}`)
  }
  return response.json()
}

/**
 * Fetch posts from WordPress
 */
export const getPosts = async (options = {}) => {
  const { page = 1, perPage = 10, category, search } = options
  const params = { page, per_page: perPage, _embed: true }
  if (category) params.categories = category
  if (search) params.search = search

  const response = await fetch(getApiUrl(WP_CONFIG.endpoints.posts, params))
  return handleResponse(response)
}

/**
 * Fetch a single post by slug or ID (with embedded featured image, author, terms)
 */
export const getPost = async (slugOrId) => {
  const isNumeric = /^\d+$/.test(String(slugOrId))
  const url = isNumeric
    ? `${WP_CONFIG.apiUrl}${WP_CONFIG.endpoints.posts}/${slugOrId}?_embed=true`
    : getApiUrl(WP_CONFIG.endpoints.posts, { slug: slugOrId, _embed: true })

  const response = await fetch(url)
  const data = await handleResponse(response)
  return Array.isArray(data) ? data[0] : data
}

/**
 * Fetch site settings: logo, nav menu, footer content (from /rpn/v1/site-settings)
 */
export const getSiteSettings = async () => {
  const response = await fetch(
    `${WP_CONFIG.apiUrl}${WP_CONFIG.endpoints.siteSettings}`
  )
  return handleResponse(response)
}

/**
 * Fetch pages from WordPress
 */
export const getPages = async (options = {}) => {
  const { page = 1, perPage = 10 } = options
  const response = await fetch(
    getApiUrl(WP_CONFIG.endpoints.pages, { page, per_page: perPage })
  )
  return handleResponse(response)
}

/**
 * Fetch a single WordPress page by slug
 */
export const getPageBySlug = async (slug) => {
  const url = getApiUrl(WP_CONFIG.endpoints.pages, {
    slug,
    _fields: 'id,slug,title,content',
  })
  const response = await fetch(url)
  const data = await handleResponse(response)
  return Array.isArray(data) ? data[0] : data
}

export const requestPasswordReset = async (email) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}/rpn/v1/request-password-reset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  return handleResponse(response)
}

export const setPassword = async ({ login, key, new_password }) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}/rpn/v1/set-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login, key, new_password }),
  })
  return handleResponse(response)
}

/**
 * Confirm a registration email via its verification token — GET /rpn/v1/verify-email?token=X
 * Returns { success, token, user } — the token logs the user straight in.
 */
export const verifyEmail = async (token) => {
  const response = await fetch(getApiUrl('/rpn/v1/verify-email', { token }))
  return handleResponse(response)
}

/**
 * Ask for a new verification email — POST /rpn/v1/resend-verification
 */
export const resendVerification = async (email) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}/rpn/v1/resend-verification`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  })
  return handleResponse(response)
}

/**
 * Fetch media/attachments
 */
export const getMediaAttachment = async (id) => {
  const response = await fetch(
    `${WP_CONFIG.apiUrl}${WP_CONFIG.endpoints.media}/${id}`
  )
  return handleResponse(response)
}

/**
 * Fetch categories
 */
export const getCategories = async () => {
  const response = await fetch(
    getApiUrl(WP_CONFIG.endpoints.categories, { per_page: 100 })
  )
  return handleResponse(response)
}

/**
 * Generic fetch for custom post types (riders, animals, etc.)
 * Requires custom post types to be registered in WordPress
 */
export const getCustomPosts = async (type, options = {}) => {
  const endpoint = WP_CONFIG.endpoints[type] || `/wp/v2/${type}`
  const { page = 1, perPage = 10, ...rest } = options
  // WordPress REST API typically allows per_page up to 100; higher values can cause "Invalid parameter(s): per_page"
  const perPageCapped = Math.min(Number(perPage) || 10, 100)
  const params = { page, per_page: perPageCapped, ...rest }

  const response = await fetch(getApiUrl(endpoint, params))
  return handleResponse(response)
}

/**
 * Fetch a single rider by slug (with embedded featured media)
 */
export const getRiderBySlug = async (slug) => {
  const data = await getCustomPosts('riders', { slug, perPage: 1, _embed: true })
  return Array.isArray(data) && data.length > 0 ? data[0] : null
}

/**
 * Fetch a single animal by slug (with embedded featured media)
 */
export const getAnimalBySlug = async (slug) => {
  const data = await getCustomPosts('animals', { slug, perPage: 1, _embed: true })
  return Array.isArray(data) && data.length > 0 ? data[0] : null
}

/**
 * Homepage sections: FAQ, reviews, top riders, upcoming/recent events, plans, hero
 * Uses same origin in dev (Vite proxy) so set VITE_WORDPRESS_URL only for production.
 */
export const getHomepageData = async () => {
  const url = `${WP_CONFIG.apiUrl}${WP_CONFIG.endpoints.homepage}`
  const response = await fetch(url)
  if (!response.ok) {
    const err = await response.json().catch(() => ({}))
    throw new Error(err.message || `Homepage API ${response.status}: ${response.statusText}`)
  }
  return response.json()
}

/**
 * Fetch riders by IDs (for top riders / relationships)
 */
export const getRidersByIds = async (ids) => {
  if (!ids?.length) return []
  const include = Array.isArray(ids) ? ids.join(',') : String(ids)
  const data = await getCustomPosts('riders', { include, per_page: 100, _embed: true })
  return Array.isArray(data) ? data : []
}

/**
 * Fetch animals by IDs (for rider's linked animals)
 */
export const getAnimalsByIds = async (ids) => {
  if (!ids?.length) return []
  const include = Array.isArray(ids) ? ids.join(',') : String(ids)
  const data = await getCustomPosts('animals', { include, per_page: 100, _embed: true })
  return Array.isArray(data) ? data : []
}

/**
 * Fetch events (upcoming/recent come from homepage API; this is for list page)
 */
export const getEvents = async (options = {}) => {
  return getCustomPosts('events', { perPage: options.perPage || 20, _embed: true, ...options })
}

/**
 * Fetch a single event by slug
 */
export const getEventBySlug = async (slug) => {
  const data = await getCustomPosts('events', { slug, perPage: 1, _embed: true })
  return Array.isArray(data) && data.length > 0 ? data[0] : null
}

/**
 * Fetch a single event by ID (includes event_results, round_1/2/championship_round_results from ACF)
 */
export const getEventById = async (id) => {
  const url = `${WP_CONFIG.apiUrl}${WP_CONFIG.endpoints.events}/${id}?_embed`
  const response = await fetch(url)
  if (!response.ok) throw new Error('Event not found')
  return response.json()
}

/**
 * Computed event results aggregated from rider-submitted rpn_performance posts.
 * Falls back to empty rounds if no submissions exist yet.
 */
export const getEventResults = async (eventId) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}/rpn/v1/event-results/${eventId}`)
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  return response.json()
}

/**
 * Fetch condition modifiers (arena, weather, tier) + tooltips
 */
export const getConditionModifiers = async () => {
  const response = await fetch(`${WP_CONFIG.apiUrl}${WP_CONFIG.endpoints.conditionModifiers}`)
  if (!response.ok) throw new Error('Could not load condition modifiers')
  return response.json()
}

/**
 * Fetch WooCommerce revenue products (Digital ID, Printed Card, Premium)
 * Returns checkout URLs so the React app can send users straight to WP checkout.
 */
export const getRevenueProducts = async () => {
  const response = await fetch(`${WP_CONFIG.apiUrl}${WP_CONFIG.endpoints.revenueProducts}`)
  if (!response.ok) throw new Error('Could not load revenue products')
  return response.json()
}

/**
 * Fetch media highlights filtered by rider, animal, or pickup team
 * GET /rpn/v1/media?rider_id=12 | ?animal_id=5 | ?pickup_team_id=3
 */
export const getMedia = async (options = {}) => {
  const params = {}
  if (options.riderId) params.rider_id = options.riderId
  if (options.animalId) params.animal_id = options.animalId
  if (options.pickupTeamId) params.pickup_team_id = options.pickupTeamId
  const url = getApiUrl(WP_CONFIG.endpoints.rpnMedia, params)
  const response = await fetch(url)
  if (!response.ok) throw new Error('Could not load media')
  return response.json()
}

/**
 * Submit a performance (ride/run)
 */
export const submitPerformance = async (data) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}${WP_CONFIG.endpoints.performances}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify(data),
  })
  const result = await response.json().catch(() => ({}))
  if (!response.ok) {
    if (response.status === 403) {
      throw new Error('You must be logged in as a WordPress administrator to submit performances.')
    }
    throw new Error(result.message || 'Failed to submit performance')
  }
  return result
}

/**
 * Contractor rankings (by linked animals' SRI/TEI)
 */
export const getContractorRankings = async () => {
  const response = await fetch(`${WP_CONFIG.apiUrl}${WP_CONFIG.endpoints.contractorRankings}`)
  if (!response.ok) throw new Error('Could not load contractor rankings')
  return response.json()
}

/**
 * Authenticated GET for profile data
 */
export const getMyProfile = async (token) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}${WP_CONFIG.endpoints.profile}`, {
    headers: { 'X-RPN-Auth': token },
  })
  return handleResponse(response)
}

/**
 * Update profile fields (name, bio, state, city, event_type, age_group, phone, website)
 */
export const updateMyProfile = async (token, data) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}${WP_CONFIG.endpoints.profile}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-RPN-Auth': token },
    body: JSON.stringify(data),
  })
  return handleResponse(response)
}

/**
 * Fetch animals linked to the authenticated user
 */
export const getMyAnimals = async (token) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}${WP_CONFIG.endpoints.myAnimals}`, {
    headers: { 'X-RPN-Auth': token },
  })
  return handleResponse(response)
}

/**
 * Create a new animal linked to the authenticated user
 */
export const addMyAnimal = async (token, data) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}${WP_CONFIG.endpoints.myAnimals}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-RPN-Auth': token },
    body: JSON.stringify(data),
  })
  return handleResponse(response)
}

/**
 * Update an existing animal
 */
export const updateMyAnimal = async (token, id, data) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}${WP_CONFIG.endpoints.myAnimals}/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-RPN-Auth': token },
    body: JSON.stringify(data),
  })
  return handleResponse(response)
}

export const deleteMyAnimal = async (token, id) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}${WP_CONFIG.endpoints.myAnimals}/${id}`, {
    method: 'DELETE',
    headers: { 'X-RPN-Auth': token },
  })
  return handleResponse(response)
}

/**
 * Fetch events created by the authenticated producer
 */
export const getMyEvents = async (token) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}${WP_CONFIG.endpoints.myEvents}`, {
    headers: { 'X-RPN-Auth': token },
  })
  return handleResponse(response)
}

/**
 * Create a new event (producers only)
 */
export const addMyEvent = async (token, data) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}${WP_CONFIG.endpoints.myEvents}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-RPN-Auth': token },
    body: JSON.stringify(data),
  })
  return handleResponse(response)
}

/**
 * Update an existing event
 */
export const updateMyEvent = async (token, id, data) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}${WP_CONFIG.endpoints.myEvents}/${id}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-RPN-Auth': token },
    body: JSON.stringify(data),
  })
  return handleResponse(response)
}

/**
 * Get authenticated user's submitted scores/performances
 */
export const getMyScores = async (token) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}${WP_CONFIG.endpoints.myScores}`, {
    headers: { 'X-RPN-Auth': token },
  })
  return handleResponse(response)
}

/**
 * Submit a new score/performance entry
 */
export const postMyScore = async (token, data) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}${WP_CONFIG.endpoints.myScores}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-RPN-Auth': token },
    body: JSON.stringify(data),
  })
  return handleResponse(response)
}

/**
 * Search for unclaimed rider profiles by name — GET /rpn/v1/search-riders?name=X
 * Public — no auth required. Used by the profile-claim flow.
 */
export const searchRiders = async (name) => {
  const response = await fetch(
    getApiUrl('/rpn/v1/search-riders', { name })
  )
  const data = await handleResponse(response)
  return data.results || []
}

/**
 * Search for unclaimed animal profiles by name — GET /rpn/v1/search-animals?name=X
 */
export const searchAnimals = async (name) => {
  const response = await fetch(getApiUrl('/rpn/v1/search-animals', { name }))
  const data = await handleResponse(response)
  return data.results || []
}

/**
 * Claim an existing animal profile — POST /rpn/v1/claim-animal
 */
export const claimAnimal = async (token, animalId) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}/rpn/v1/claim-animal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-RPN-Auth': token },
    body: JSON.stringify({ animal_id: animalId }),
  })
  return handleResponse(response)
}

/**
 * Get reviews for an event — GET /rpn/v1/reviews?event_id=X
 */
export const getEventReviews = async (eventId) => {
  const response = await fetch(getApiUrl('/rpn/v1/reviews', { event_id: eventId }))
  const data = await handleResponse(response)
  return data.reviews || []
}

/**
 * Submit a review for an event — POST /rpn/v1/reviews
 */
export const submitReview = async (token, eventId, rating, reviewText = '') => {
  const response = await fetch(`${WP_CONFIG.apiUrl}/rpn/v1/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-RPN-Auth': token },
    body: JSON.stringify({ event_id: eventId, rating, review_text: reviewText }),
  })
  return handleResponse(response)
}

/**
 * Claim an existing rider profile — POST /rpn/v1/claim-profile
 * Requires auth token + the rider post ID + date of birth for verification.
 */
export const claimProfile = async (token, riderId, dateOfBirth) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}/rpn/v1/claim-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-RPN-Auth': token },
    body: JSON.stringify({ rider_id: riderId, date_of_birth: dateOfBirth }),
  })
  return handleResponse(response)
}

/**
 * Upload a file to WordPress media library (returns attachment_id + url)
 */
export const uploadMedia = async (token, file) => {
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch(`${WP_CONFIG.apiUrl}/rpn/v1/upload-media`, {
    method: 'POST',
    headers: { 'X-RPN-Auth': token },
    body: formData,
  })
  return handleResponse(response)
}

/**
 * Fetch a public athlete profile by RIN ID (e.g. "RIN-A3F7C2")
 * No auth required — calls GET /rpn/v1/athletes/{rin_id}
 */
export const getRiderByRinId = async (rinId) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}/rpn/v1/athletes/${encodeURIComponent(rinId)}`)
  return handleResponse(response)
}

/**
 * Bulk-recalculate all indexes (admin only):
 * RPI for all riders, SRI/TEI/BHI for all animals, PTI for all pickup teams.
 * POST /rpn/v1/recalculate-indexes (requires WP admin credentials via cookie/nonce)
 */
export const recalculateAllIndexes = async () => {
  const response = await fetch(`${WP_CONFIG.apiUrl}/rpn/v1/recalculate-indexes`, {
    method: 'POST',
    credentials: 'include',
  })
  return handleResponse(response)
}

/**
 * Get WooCommerce checkout URL for a membership tier upgrade
 */
export const getUpgradeUrl = async (tier, interval = 'month', token = '') => {
  const headers = token ? { 'X-RPN-Auth': token } : {}
  const response = await fetch(
    `${WP_CONFIG.apiUrl}${WP_CONFIG.endpoints.upgradeUrl}?tier=${tier}&interval=${interval}`,
    { headers }
  )
  return handleResponse(response)
}

/* ---------- Phase 3: Organizer Portal + Disputes ---------- */

/** Organizer submits a single official result for any rider */
export const submitOrganizerResult = async (token, data) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}/rpn/v1/organizer/submit-result`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-RPN-Auth': token },
    body: JSON.stringify(data),
  })
  return handleResponse(response)
}

/** Organizer submits multiple results at once (CSV rows as JSON array) */
export const submitOrganizerCSV = async (token, rows) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}/rpn/v1/organizer/submit-csv`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-RPN-Auth': token },
    body: JSON.stringify({ rows }),
  })
  return handleResponse(response)
}

/** Authenticated rider flags a performance as disputed */
export const flagResult = async (token, performanceId, reason) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}/rpn/v1/flag-result`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-RPN-Auth': token },
    body: JSON.stringify({ performance_id: performanceId, reason }),
  })
  return handleResponse(response)
}

/** Admin: fetch all disputed performances */
export const getDisputes = async (token) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}/rpn/v1/disputes`, {
    headers: { 'X-RPN-Auth': token },
  })
  return handleResponse(response)
}

/** Admin: resolve or reject a dispute */
export const resolveDispute = async (token, performanceId, resolution, note = '') => {
  const response = await fetch(`${WP_CONFIG.apiUrl}/rpn/v1/disputes/${performanceId}/resolve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-RPN-Auth': token },
    body: JSON.stringify({ resolution, note }),
  })
  return handleResponse(response)
}

/* ---------- Phase 4: NIL Marketplace ---------- */

export const getNILMarketplace = async (filters = {}) => {
  const params = {}
  if (filters.discipline) params.discipline = filters.discipline
  if (filters.state)      params.state      = filters.state
  if (filters.minRpi)     params.min_rpi    = filters.minRpi
  const response = await fetch(getApiUrl('/rpn/v1/nil-marketplace', params))
  return handleResponse(response)
}

export const sendNILContact = async (riderSlug, brand) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}/rpn/v1/nil-contact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rider_slug: riderSlug, ...brand }),
  })
  return handleResponse(response)
}

/* ---------- Phase 4: API Keys ---------- */

export const getApiKeys = async (token) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}/rpn/v1/api-keys`, {
    headers: { 'X-RPN-Auth': token },
  })
  return handleResponse(response)
}

export const createApiKey = async (token, name) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}/rpn/v1/api-keys`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-RPN-Auth': token },
    body: JSON.stringify({ name }),
  })
  return handleResponse(response)
}

export const revokeApiKey = async (token, keyId) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}/rpn/v1/api-keys/${keyId}`, {
    method: 'DELETE',
    headers: { 'X-RPN-Auth': token },
  })
  return handleResponse(response)
}

/* ---------- Phase 4: Fantasy Rodeo ---------- */

export const getFantasyLeagues = async () => {
  const response = await fetch(`${WP_CONFIG.apiUrl}/rpn/v1/fantasy/leagues`)
  return handleResponse(response)
}

export const getMyFantasyLeagues = async (token) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}/rpn/v1/fantasy/my-leagues`, {
    headers: { 'X-RPN-Auth': token },
  })
  return handleResponse(response)
}

export const createFantasyLeague = async (token, data) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}/rpn/v1/fantasy/leagues`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-RPN-Auth': token },
    body: JSON.stringify(data),
  })
  return handleResponse(response)
}

export const getFantasyLeagueDetail = async (id) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}/rpn/v1/fantasy/leagues/${id}`)
  return handleResponse(response)
}

export const joinFantasyLeague = async (token, leagueId) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}/rpn/v1/fantasy/leagues/${leagueId}/join`, {
    method: 'POST',
    headers: { 'X-RPN-Auth': token },
  })
  return handleResponse(response)
}

export const setFantasyPicks = async (token, leagueId, riderIds) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}/rpn/v1/fantasy/leagues/${leagueId}/picks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-RPN-Auth': token },
    body: JSON.stringify({ rider_ids: riderIds }),
  })
  return handleResponse(response)
}

/* ---------- Phase 4: NIL Compliance ---------- */

export const getNILCompliance = async (token) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}/rpn/v1/nil-compliance`, {
    headers: { 'X-RPN-Auth': token },
  })
  return handleResponse(response)
}

export const saveNILCompliance = async (token, record) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}/rpn/v1/nil-compliance`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-RPN-Auth': token },
    body: JSON.stringify(record),
  })
  return handleResponse(response)
}

export const getMyRank = async (token) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}/rpn/v1/my-rank`, {
    headers: { 'X-RPN-Auth': token },
  })
  return handleResponse(response)
}

export const getEventAnalytics = async (token) => {
  const response = await fetch(`${WP_CONFIG.apiUrl}/rpn/v1/event-analytics`, {
    headers: { 'X-RPN-Auth': token },
  })
  return handleResponse(response)
}

export const exportResults = async (token, eventId = null) => {
  const url = eventId
    ? `${WP_CONFIG.apiUrl}/rpn/v1/export-results?event_id=${eventId}`
    : `${WP_CONFIG.apiUrl}/rpn/v1/export-results`
  const response = await fetch(url, {
    headers: { 'X-RPN-Auth': token },
  })
  return handleResponse(response)
}

export default {
  getPosts,
  getPost,
  getPages,
  getMedia,
  getCategories,
  getCustomPosts,
  getRiderBySlug,
  getAnimalBySlug,
  getHomepageData,
  getRidersByIds,
  getAnimalsByIds,
  getEvents,
  getEventBySlug,
  getEventById,
  getConditionModifiers,
  getRevenueProducts,
  getMedia,
  submitPerformance,
  getContractorRankings,
  getMyProfile,
  updateMyProfile,
  getMyAnimals,
  addMyAnimal,
  deleteMyAnimal,
  updateMyAnimal,
  getMyEvents,
  addMyEvent,
  updateMyEvent,
  uploadMedia,
  getMyScores,
  postMyScore,
  getRiderByRinId,
  getUpgradeUrl,
  recalculateAllIndexes,
  searchAnimals,
  claimAnimal,
  getEventReviews,
  submitReview,
}
