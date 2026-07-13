import React, { useState, useEffect, useCallback } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import ImageCropModal from '../components/ImageCropModal'
import { QRCodeSVG } from 'qrcode.react'
import { useAuth } from '../context/AuthContext'
import { WP_CONFIG } from '../config/wordpress'
import {
  getMyProfile, updateMyProfile,
  getMyAnimals, addMyAnimal, updateMyAnimal, deleteMyAnimal,
  getMyEvents, addMyEvent, updateMyEvent,
  getMyScores, postMyScore, getUpgradeUrl,
  uploadMedia, getCustomPosts, getEventResults,
  searchRiders, claimProfile,
  searchAnimals, claimAnimal,
  submitOrganizerResult, submitOrganizerCSV, flagResult,
  getDisputes, resolveDispute,
  getApiKeys, createApiKey, revokeApiKey,
  getNILCompliance, saveNILCompliance,
  getMyRank,
  getEventAnalytics, exportResults,
} from '../services/wordpressApi'

/* --------------------------------------------------------------------------
 * Animal form defaults
 * -------------------------------------------------------------------------- */
const EMPTY_ANIMAL_FORM = {
  name: '', animal_type: '', scoring_type: '', unique_number: '',
  sex: '', sire: '', dam: '',
  breed: '', color: '', year_foaled: '', birth_date: '',
  bloodlines: '', breeding: '', breeding_papers_url: '', owner: '',
  years_competing: '', currently_active: 'yes',
  video_links: ['', '', '', '', ''],
  notes: '', featured_image_id: 0, image_url: '', _imageFile: null,
}

/* --------------------------------------------------------------------------
 * Tier helpers
 * -------------------------------------------------------------------------- */
const TIER_ORDER = { free: 0, competitor: 1, contractor: 2, organizer: 3, enterprise: 4 }
const tierGte = (tier, required) => (TIER_ORDER[tier] ?? 0) >= (TIER_ORDER[required] ?? 99)

const TIER_LABELS = {
  free:       'Fan Pass / Rider Preview (Free)',
  competitor: 'Competitor Pro',
  contractor: 'Stock Contractor',
  organizer:  'Event Organizer',
  enterprise: 'Enterprise / Association',
}

const UPGRADE_PLANS = [
  { key: 'competitor', label: 'Competitor Pro',   priceMonth: '$9.99/mo',  priceYear: '$89/yr',  description: 'Full RPI, score history, peer rankings, shareable sponsor profile', hasYearly: true },
  { key: 'contractor', label: 'Stock Contractor', priceMonth: '$29.99/mo', priceYear: '$249/yr', description: 'SRI per animal, herd dashboard, shareable animal profile cards', hasYearly: true },
  { key: 'organizer',  label: 'Event Organizer',  priceMonth: '$79.99/mo', priceYear: '$649/yr', description: 'Direct score entry, Verified Event badge, CSV import, event analytics', hasYearly: true },
]

const DISCIPLINES = [
  'Bull Riding', 'Saddle Bronc', 'Bareback', 'Barrel Racing',
  'Team Roping – Header', 'Team Roping – Heeler', 'Tie-Down Roping',
  'Breakaway Roping', 'Steer Wrestling', 'Junior Bull Riding', 'Steer Riding',
  'Pole Bending', 'Goat Tying', 'Barrel Racing (Youth)', 'Breakaway (Youth)',
]

const AGE_GROUPS = [
  'Pee Wee (8 & under)', 'Junior (9–13)', 'High School (14–18)',
  'College', 'Open / Pro', 'Senior',
]

const DIVISIONS = ['Youth', 'High School', 'College', 'Amateur', 'Open', 'Pro', 'Senior']

// Barrel racing uses a time-based split-division system (1D = fastest, 5D = slowest)
const BARREL_RACING_DIVISIONS = ['1D', '2D', '3D', '4D', '5D']

// Goat tying is a youth sport — divisions are age/grade based, not time-spread based
const GOAT_TYING_DIVISIONS = ['Junior High', 'Senior High', 'College', 'Open']

// Team roping divisions — combined header+heeler handicap number
// "Slide" entries are WSTR-style handicap bracket events with raised number caps
const TEAM_ROPING_DIVISIONS = [
  'Open',
  '#15.5 Slide',
  '#14.5 – #15.5',
  '#13.5 Slide',
  '#12.5 – #13.5',
  '#10.5 – #11.5',
  '#7.5 – #9.5',
]

// Returns the correct division list for a given event category
function getDivisionsForEvent(eventCategory) {
  if (['Barrel Racing', 'Barrel Racing (Youth)', 'Pole Bending'].includes(eventCategory)) {
    return BARREL_RACING_DIVISIONS
  }
  if (eventCategory === 'Goat Tying') {
    return GOAT_TYING_DIVISIONS
  }
  if (['Team Roping – Header', 'Team Roping – Heeler'].includes(eventCategory)) {
    return TEAM_ROPING_DIVISIONS
  }
  return DIVISIONS
}

const TIMED_EVENTS = [
  'Barrel Racing',
  'Pole Bending',
  'Breakaway Roping',
  'Tie-Down Roping',
  'Steer Wrestling',
  'Team Roping – Header',
  'Team Roping – Heeler',
  'Goat Tying',
]

const TEAM_ROPING_EVENTS = ['Team Roping – Header', 'Team Roping – Heeler']

const PENALTY_VALUE = {
  'Barrel Racing':        5,
  'Pole Bending':         5,
  'Goat Tying':           5,
  'Breakaway Roping':     0,
  'Tie-Down Roping':      10,
  'Steer Wrestling':      10,
  'Team Roping – Header': 10,
  'Team Roping – Heeler': 10,
}

const GENDERS = ['Male', 'Female', 'Non-binary', 'Prefer not to say']

const ASSOCIATIONS = ['PRCA', 'WPRA', 'NHSRA', 'NIRA', 'USTRC', 'Other']

const ALL_EVENTS = [
  'Bull Riding', 'Saddle Bronc', 'Bareback', 'Barrel Racing',
  'Team Roping – Header', 'Team Roping – Heeler', 'Tie-Down Roping',
  'Breakaway Roping', 'Steer Wrestling', 'Junior Bull Riding', 'Steer Riding',
  'Pole Bending', 'Goat Tying', 'Barrel Racing (Youth)', 'Breakaway (Youth)',
]

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY',
]

/* --------------------------------------------------------------------------
 * Sub-components
 * -------------------------------------------------------------------------- */

/** Blurred overlay for features locked behind a higher tier */
function LockedFeature({ requiredTier, currentTier, children }) {
  if (tierGte(currentTier, requiredTier)) return children
  return (
    <div className="locked-feature">
      <div className="locked-feature-content" aria-hidden="true">{children}</div>
      <div className="locked-feature-overlay">
        <span className="locked-feature-icon">🔒</span>
        <p className="locked-feature-label">
          Requires <strong>{TIER_LABELS[requiredTier]}</strong>
        </p>
        <Link to="/checkout?tier=competitor&billing=month" className="btn btn-primary btn-sm">Upgrade</Link>
      </div>
    </div>
  )
}

/* --------------------------------------------------------------------------
 * Main Dashboard
 * -------------------------------------------------------------------------- */
export default function DashboardPage() {
  const { token, user, loading: authLoading, getAuthHeaders, logout, refreshUser } = useAuth()

  const tier               = user?.membership_tier || 'free'
  const isRider            = user?.roles?.some?.(r => r === 'rpn_rider' || r.includes('rider'))
  const isContractor       = user?.roles?.includes?.('rpn_contractor')
  const isProducer         = user?.roles?.includes?.('rpn_producer')
  const isAdmin            = user?.roles?.includes?.('administrator')
  const hasRiderLink       = !!user?.linked_rider_id
  const hasContractorLink  = !!user?.linked_contractor_id
  const hasProdLink        = !!user?.linked_producer_id
  // True when the user is a business (contractor/producer) without a rider account
  const isBusinessOnly     = (isContractor || isProducer) && !isRider

  const [searchParams] = useSearchParams()
  const defaultTab = searchParams.get('tab') || 'profile'
  const [activeTab, setActiveTab] = useState(defaultTab)

  // Pre-fill score form when arriving from an event page (?tab=scores&event_id=X&event_name=Y)
  useEffect(() => {
    const tabParam       = searchParams.get('tab')
    const eventIdParam   = searchParams.get('event_id')
    const eventNameParam = searchParams.get('event_name')
    if (tabParam === 'scores' && eventIdParam) {
      setActiveTab('scores')
      setScoreFormOpen(true)
      setScoreForm((f) => ({ ...f, event_id: eventIdParam, event_name: decodeURIComponent(eventNameParam || '') }))
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Profile state ----
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [profileMsg, setProfileMsg] = useState(null)
  const [editProfile, setEditProfile] = useState({
    display_name: '', first_name: '', last_name: '', bio: '', state: '', city: '',
    event_type: '', age_group: '', phone: '', website: '',
    // Business profile fields (contractor / producer)
    business_name: '', address_street: '', address_zip: '', contact_name: '',
    stock_types: [],
    // Extended rider fields
    nickname: '', date_of_birth: '', gender: '', country: 'United States',
    division: '', primary_event: '', secondary_events: [], years_competing: '',
    association_memberships: [],
    twitter_url: '', instagram_url: '', tiktok_url: '', facebook_url: '',
    youtube_url: '', personal_website: '',
    video_highlights: ['', '', '', '', ''],
    // NIL / Sponsorship
    nil_open_to_sponsorship: false,
    sponsor_name: '',
    sponsor_url: '',
  })

  // ---- Animals state ----
  const [animals, setAnimals] = useState([])
  const [animalsLoading, setAnimalsLoading] = useState(false)
  const [animalsFetched, setAnimalsFetched] = useState(false)
  const [addAnimalOpen, setAddAnimalOpen] = useState(false)
  const [animalForm, setAnimalForm] = useState(EMPTY_ANIMAL_FORM)
  const [animalSaving, setAnimalSaving] = useState(false)
  const [animalMsg, setAnimalMsg] = useState(null)
  const [editingAnimal, setEditingAnimal] = useState(null)
  const [deletingAnimal, setDeletingAnimal] = useState(null) // id awaiting delete confirm
  const [deleteAnimalLoading, setDeleteAnimalLoading] = useState(false)

  // ---- Events state ----
  const [events, setEvents] = useState([])
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsFetched, setEventsFetched] = useState(false)
  const [addEventOpen, setAddEventOpen] = useState(false)
  const [eventForm, setEventForm] = useState({
    title: '', event_date: '', venue: '', city: '', state: '',
    event_tier: '', season: '', entry_fee: '', prize_money: '',
    description: '', disciplines: [],
  })
  const [eventSaving, setEventSaving] = useState(false)
  const [eventMsg, setEventMsg] = useState(null)
  const [editingEvent, setEditingEvent] = useState(null)
  const [selectedResultsEventId, setSelectedResultsEventId] = useState('')
  const [eventResultsData, setEventResultsData] = useState(null)
  const [eventResultsLoading, setEventResultsLoading] = useState(false)

  // ---- Peer rank state (Competitor+) ----
  const [peerRank, setPeerRank] = useState(null)
  const [peerRankFetched, setPeerRankFetched] = useState(false)

  // ---- Event analytics state (Organizer+) ----
  const [eventAnalytics, setEventAnalytics] = useState(null)
  const [eventAnalyticsFetched, setEventAnalyticsFetched] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [exportMsg, setExportMsg] = useState(null)

  // ---- Scores state ----
  const [scores, setScores] = useState([])
  const [scoresLoading, setScoresLoading] = useState(false)
  const [scoresFetched, setScoresFetched] = useState(false)
  const [scoreFormOpen, setScoreFormOpen] = useState(false)
  const [scoreType, setScoreType] = useState('roughstock')
  const [scoreForm, setScoreForm] = useState({
    performance_type: 'roughstock',
    event_category: '',
    event_id: '',
    event_name: '',
    event_city: '',
    event_state: '',
    organization_name: '',
    performance_date: new Date().toISOString().slice(0, 10),
    arena_condition: 'smooth',
    weather_condition: 'clear',
    event_tier: 'local',
    // Roughstock per-ride (spec Section 4+5)
    go_round: 'Round 1',
    division: '',
    animal_name: '',
    bull_type: '',
    covered: null,          // null | true | false
    judge1_score: '',
    judge2_score: '',
    animal_score: '',
    reride_offered: false,
    reride_accepted: false,
    reride_covered: null,
    reride_judge1_score: '',
    reride_judge2_score: '',
    reride_animal_score: '',
    reride_animal_name: '',
    placement: '',
    payout: '',
    // Timed per-run (Section 6)
    timed_go_round: 'Round 1',
    timed_division: '',
    horse_name: '',
    got_time: null,        // null | true | false  — "Did you receive an official time?"
    raw_run_time: '',
    num_penalties: '0',
    benchmark_time: '',    // optional for RPI calc
    // Team roping
    role: '',
    partner_name: '',
    partner_rin_id: '',
  })
  const [scoreSaving, setScoreSaving] = useState(false)
  const [scoreMsg, setScoreMsg] = useState(null)
  const [conditionModifiers, setConditionModifiers] = useState(null)

  // ---- Profile photo state ----
  const [profilePhotoFile, setProfilePhotoFile] = useState(null)
  const [profilePhotoPreview, setProfilePhotoPreview] = useState(null)
  const [profilePhotoSaving, setProfilePhotoSaving] = useState(false)
  const [profilePhotoMsg, setProfilePhotoMsg] = useState(null)

  // ---- Image crop modal state ----
  const [cropSrc, setCropSrc] = useState(null)
  const [cropTarget, setCropTarget] = useState(null) // 'profile'

  // ---- Event search state (for score submission Step 1) ----
  const [eventSearchQuery, setEventSearchQuery] = useState('')
  const [eventSearchResults, setEventSearchResults] = useState([])
  const [eventSearchLoading, setEventSearchLoading] = useState(false)
  const [eventSearchDone, setEventSearchDone] = useState(false)
  const [addingNewEvent, setAddingNewEvent] = useState(false)
  const [newEventForm, setNewEventForm] = useState({
    title: '', event_date: '', city: '', state: '', event_tier: 'local', organization_name: '',
  })
  // ---- Profile Claim state ----
  const [claimSearch, setClaimSearch] = useState('')
  const [claimResults, setClaimResults] = useState([])
  const [claimSearching, setClaimSearching] = useState(false)
  const [claimSelected, setClaimSelected] = useState(null)
  const [claimDob, setClaimDob] = useState('')
  const [claimSaving, setClaimSaving] = useState(false)
  const [claimMsg, setClaimMsg] = useState(null)

  // ---- Animal Claim state ----
  const [animalClaimSearch, setAnimalClaimSearch] = useState('')
  const [animalClaimResults, setAnimalClaimResults] = useState([])
  const [animalClaimSearching, setAnimalClaimSearching] = useState(false)
  const [animalClaimSelected, setAnimalClaimSelected] = useState(null)
  const [animalClaimSaving, setAnimalClaimSaving] = useState(false)
  const [animalClaimMsg, setAnimalClaimMsg] = useState(null)

  // ---- Organizer submit-result state (producer) ----
  const [orgForm, setOrgForm] = useState({
    rider_name: '', rider_id: '',
    performance_type: 'roughstock',
    event_category: 'Bull Riding',
    division: '',
    performance_date: new Date().toISOString().slice(0, 10),
    event_name: '', event_id: '',
    arena_condition: 'smooth', weather_condition: 'clear', event_tier: 'local',
    go_round: 'Round 1', placement: '', payout: '',
    // Roughstock
    covered: true, judge1_score: '', judge2_score: '', animal_score: '', animal_name: '', bull_type: '',
    // Timed
    no_time: false, raw_run_time: '', field_best_time: '', num_penalties: '0', horse_name: '',
  })
  const [orgSaving, setOrgSaving] = useState(false)
  const [orgMsg, setOrgMsg] = useState(null)
  // ---- CSV bulk upload state ----
  const [csvRows, setCsvRows] = useState([])
  const [csvFileName, setCsvFileName] = useState('')
  const [csvSaving, setCsvSaving] = useState(false)
  const [csvMsg, setCsvMsg] = useState(null)
  // ---- Flag result state (rider) ----
  const [flaggingId, setFlaggingId] = useState(null)
  const [flagReason, setFlagReason] = useState('')
  const [flagSaving, setFlagSaving] = useState(false)
  const [flagMsg, setFlagMsg] = useState(null)
  // ---- Admin disputes state ----
  const [disputes, setDisputes] = useState([])
  const [disputesLoading, setDisputesLoading] = useState(false)
  const [disputeResolveId, setDisputeResolveId] = useState(null)
  const [disputeNote, setDisputeNote] = useState('')
  const [disputeSaving, setDisputeSaving] = useState(false)
  const [disputeMsg, setDisputeMsg] = useState(null)

  // ---- API Keys state (Phase 4) ----
  const [apiKeys,        setApiKeys]        = useState([])
  const [apiKeysLoading, setApiKeysLoading] = useState(false)
  const [newKeyName,     setNewKeyName]     = useState('')
  const [newKeyCreating, setNewKeyCreating] = useState(false)
  const [newKeyResult,   setNewKeyResult]   = useState(null)   // { key, name } — shown once
  const [apiKeyMsg,      setApiKeyMsg]      = useState(null)

  // ---- NIL Compliance state (Phase 4) ----
  const [nilRecords,    setNilRecords]    = useState([])
  const [nilLoading,    setNilLoading]    = useState(false)
  const [nilFetched,    setNilFetched]    = useState(false)
  const [nilFormOpen,   setNilFormOpen]   = useState(false)
  const [nilEditId,     setNilEditId]     = useState(null)
  const [nilForm,       setNilForm]       = useState({ school: '', sport: '', season_start: '', season_end: '', sponsor_name: '', income_amount: '', activity_type: '', disclosure_status: 'pending', notes: '' })
  const [nilSaving,     setNilSaving]     = useState(false)
  const [nilMsg,        setNilMsg]        = useState(null)

  // ---- Upgrade URLs ----
  const [upgradeUrls, setUpgradeUrls] = useState({ month: {}, year: {} })
  const [upgradeBilling, setUpgradeBilling] = useState('year')

  // ---- Load profile on mount ----
  const loadProfile = useCallback(() => {
    if (!token) return
    setProfileLoading(true)
    getMyProfile(token)
      .then((data) => {
        setProfile(data)
        const p = data.profile || {}
        const highlights = Array.isArray(p.video_highlights) ? p.video_highlights : []
        setEditProfile({
          display_name: data.display_name || '',
          first_name:  data.first_name  || '',
          last_name:   data.last_name   || '',
          bio:         p.bio        || '',
          state:       p.state      || '',
          city:        p.city       || '',
          event_type:  p.event_type || '',
          age_group:   p.age_group  || '',
          phone:       p.phone      || '',
          website:     p.website    || '',
          // Business profile fields
          business_name:  p.business_name  || '',
          address_street: p.address_street || '',
          address_zip:    p.address_zip    || '',
          contact_name:   p.contact_name   || '',
          stock_types: Array.isArray(p.stock_types) ? p.stock_types : [],
          // Extended rider fields
          nickname:     p.nickname     || '',
          date_of_birth: p.date_of_birth || '',
          gender:       p.gender       || '',
          country:      p.country      || 'United States',
          division:     p.division     || '',
          primary_event: p.primary_event || '',
          secondary_events: Array.isArray(p.secondary_events) ? p.secondary_events : [],
          years_competing: p.years_competing ? String(p.years_competing) : '',
          association_memberships: Array.isArray(p.association_memberships) ? p.association_memberships : [],
          twitter_url:     p.twitter_url     || '',
          instagram_url:   p.instagram_url   || '',
          tiktok_url:      p.tiktok_url      || '',
          facebook_url:    p.facebook_url    || '',
          youtube_url:     p.youtube_url     || '',
          personal_website: p.personal_website || '',
          video_highlights: [
            highlights[0] || '', highlights[1] || '', highlights[2] || '',
            highlights[3] || '', highlights[4] || '',
          ],
          nil_open_to_sponsorship: !!p.nil_open_to_sponsorship,
          sponsor_name: p.sponsor_name || '',
          sponsor_url:  p.sponsor_url  || '',
        })
      })
      .catch(() => {})
      .finally(() => setProfileLoading(false))
  }, [token])

  useEffect(() => {
    if (token && user) loadProfile()
  }, [token, user, loadProfile])

  // Load condition modifiers
  useEffect(() => {
    fetch(`${WP_CONFIG.apiUrl}/rpn/v1/condition-modifiers`)
      .then((r) => r.json())
      .then(setConditionModifiers)
      .catch(() => {})
  }, [])

  // Load upgrade checkout URLs (both monthly and yearly)
  useEffect(() => {
    if (!token) return
    const tiers = ['competitor', 'contractor', 'organizer']
    const intervals = ['month', 'year']
    Promise.all(
      intervals.flatMap((interval) =>
        tiers.map((t) =>
          getUpgradeUrl(t, interval, token)
            .then((d) => ({ tier: t, interval, url: d.checkout_url }))
            .catch(() => ({ tier: t, interval, url: null }))
        )
      )
    ).then((results) => {
      const map = { month: {}, year: {} }
      results.forEach(({ tier, interval, url }) => { map[interval][tier] = url })
      setUpgradeUrls(map)
    })
  }, [token])

  // ---- Load animals when tab is first visited ----
  useEffect(() => {
    if (activeTab !== 'animals' || animalsFetched || !token) return
    setAnimalsLoading(true)
    getMyAnimals(token)
      .then((data) => setAnimals(Array.isArray(data?.animals) ? data.animals : []))
      .catch(() => setAnimals([]))
      .finally(() => { setAnimalsLoading(false); setAnimalsFetched(true) })
  }, [activeTab, animalsFetched, token])

  // ---- Load events when tab is first visited ----
  useEffect(() => {
    if (activeTab !== 'events' || eventsFetched || !token) return
    setEventsLoading(true)
    getMyEvents(token)
      .then((data) => setEvents(Array.isArray(data?.events) ? data.events : []))
      .catch(() => setEvents([]))
      .finally(() => { setEventsLoading(false); setEventsFetched(true) })
  }, [activeTab, eventsFetched, token])

  // ---- Load peer rank when stats tab visited (competitor+) ----
  useEffect(() => {
    if (activeTab !== 'stats' || peerRankFetched || !token) return
    if (!tierGte(tier, 'competitor')) return
    getMyRank(token)
      .then((data) => setPeerRank(data))
      .catch(() => setPeerRank(null))
      .finally(() => setPeerRankFetched(true))
  }, [activeTab, peerRankFetched, token, tier])

  // ---- Load event analytics when events tab visited (organizer+) ----
  useEffect(() => {
    if (activeTab !== 'events' || eventAnalyticsFetched || !token) return
    if (!tierGte(tier, 'organizer')) return
    getEventAnalytics(token)
      .then((data) => setEventAnalytics(data))
      .catch(() => setEventAnalytics(null))
      .finally(() => setEventAnalyticsFetched(true))
  }, [activeTab, eventAnalyticsFetched, token, tier])

  // ---- Load scores when tab is first visited ----
  useEffect(() => {
    if (activeTab !== 'scores' || scoresFetched || !token) return
    setScoresLoading(true)
    getMyScores(token)
      .then((data) => setScores(Array.isArray(data?.scores) ? data.scores : []))
      .catch(() => setScores([]))
      .finally(() => { setScoresLoading(false); setScoresFetched(true) })
  }, [activeTab, scoresFetched, token])

  // ---- Load disputes when admin visits the tab ----
  useEffect(() => {
    if (activeTab !== 'disputes' || !token || !isAdmin) return
    setDisputesLoading(true)
    getDisputes(token)
      .then((data) => setDisputes(Array.isArray(data?.disputes) ? data.disputes : []))
      .catch(() => setDisputes([]))
      .finally(() => setDisputesLoading(false))
  }, [activeTab, token, isAdmin])

  // ---- Save profile ----
  const handleProfileSave = async (e) => {
    e.preventDefault()
    setProfileSaving(true)
    setProfileMsg(null)

    // Phone is required — must have at least 10 digits
    const phoneDigits = (editProfile.phone || '').replace(/\D/g, '')
    if (phoneDigits.length < 10) {
      setProfileMsg({ type: 'error', text: 'Phone number is required and must be at least 10 digits.' })
      setProfileSaving(false)
      return
    }

    try {
      let payload = {
        ...editProfile,
        video_highlights: editProfile.video_highlights.filter(Boolean),
      }
      // Upload profile photo if a new file was selected
      if (profilePhotoFile) {
        setProfilePhotoSaving(true)
        const up = await uploadMedia(token, profilePhotoFile)
        payload.featured_image_id = up.attachment_id
        setProfilePhotoFile(null)
        setProfilePhotoSaving(false)
      }
      await updateMyProfile(token, payload)
      setProfileMsg({ type: 'success', text: 'Profile saved.' })
      await refreshUser()
      loadProfile()
    } catch (err) {
      setProfileMsg({ type: 'error', text: err.message || 'Save failed.' })
      setProfilePhotoSaving(false)
    } finally {
      setProfileSaving(false)
    }
  }

  // ---- Profile photo file selection ----
  const handleProfilePhotoChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setProfilePhotoMsg({ type: 'error', text: 'Only JPG and PNG files are accepted.' })
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setProfilePhotoMsg({ type: 'error', text: 'File must be 5 MB or smaller.' })
      return
    }
    setProfilePhotoMsg(null)
    const reader = new FileReader()
    reader.onloadend = () => { setCropSrc(reader.result); setCropTarget('profile') }
    reader.readAsDataURL(file)
    // reset input so the same file can be re-selected after cancelling crop
    e.target.value = ''
  }

  // ---- Crop modal apply ----
  const handleCropApply = (blob, previewUrl) => {
    if (cropTarget === 'profile') {
      const croppedFile = new File([blob], 'profile-photo.jpg', { type: 'image/jpeg' })
      setProfilePhotoFile(croppedFile)
      setProfilePhotoPreview(previewUrl)
    }
    setCropSrc(null)
    setCropTarget(null)
  }

  const handleCropCancel = () => {
    setCropSrc(null)
    setCropTarget(null)
  }

  // ---- Event search ----
  const handleEventSearch = async () => {
    if (!eventSearchQuery.trim()) return
    setEventSearchLoading(true)
    setEventSearchResults([])
    setEventSearchDone(false)
    setAddingNewEvent(false)
    try {
      const results = await getCustomPosts('events', { search: eventSearchQuery.trim(), perPage: 10, _embed: true })
      setEventSearchResults(Array.isArray(results) ? results : [])
    } catch {
      setEventSearchResults([])
    } finally {
      setEventSearchLoading(false)
      setEventSearchDone(true)
    }
  }

  // ---- Select event from search results ----
  const handleSelectEvent = (ev) => {
    const meta = ev.meta || ev.acf || {}
    setScoreForm((f) => ({
      ...f,
      event_id:         String(ev.id),
      event_name:       ev.title?.rendered || meta.title || '',
      performance_date: meta.event_date || f.performance_date,
      event_tier:       meta.event_tier || f.event_tier,
      event_city:       meta.city || '',
      event_state:      meta.state || '',
      organization_name: meta.organization_name || '',
    }))
    setEventSearchResults([])
    setEventSearchDone(false)
    setEventSearchQuery('')
    setAddingNewEvent(false)
  }

  // ---- Confirm "add new event" details into score form ----
  const handleConfirmNewEvent = () => {
    if (!newEventForm.title.trim()) return
    setScoreForm((f) => ({
      ...f,
      event_id:         '',
      event_name:       newEventForm.title,
      performance_date: newEventForm.event_date || f.performance_date,
      event_tier:       newEventForm.event_tier || f.event_tier,
      event_city:       newEventForm.city,
      event_state:      newEventForm.state,
      organization_name: newEventForm.organization_name,
    }))
    setAddingNewEvent(false)
    setNewEventForm({ title: '', event_date: '', city: '', state: '', event_tier: 'local', organization_name: '' })
  }

  // ---- Profile Claim handlers ----
  const handleClaimSearch = async (e) => {
    e.preventDefault()
    if (claimSearch.trim().length < 2) return
    setClaimSearching(true)
    setClaimResults([])
    setClaimSelected(null)
    setClaimMsg(null)
    try {
      const results = await searchRiders(claimSearch.trim())
      setClaimResults(results)
      if (results.length === 0) setClaimMsg({ type: 'info', text: 'No profiles found. Try a different name.' })
    } catch (err) {
      setClaimMsg({ type: 'error', text: err.message })
    } finally {
      setClaimSearching(false)
    }
  }

  const handleClaimSubmit = async (e) => {
    e.preventDefault()
    if (!claimSelected) return
    if (!claimDob) { setClaimMsg({ type: 'error', text: 'Please enter your date of birth.' }); return }
    setClaimSaving(true)
    setClaimMsg(null)
    try {
      await claimProfile(token, claimSelected.id, claimDob)
      setClaimMsg({ type: 'success', text: 'Profile claimed! Reloading your dashboard…' })
      setTimeout(() => window.location.reload(), 1500)
    } catch (err) {
      setClaimMsg({ type: 'error', text: err.message })
    } finally {
      setClaimSaving(false)
    }
  }

  // ---- Animal Claim handlers ----
  const handleAnimalClaimSearch = async (e) => {
    e.preventDefault()
    if (animalClaimSearch.trim().length < 2) return
    setAnimalClaimSearching(true)
    setAnimalClaimResults([])
    setAnimalClaimSelected(null)
    setAnimalClaimMsg(null)
    try {
      const results = await searchAnimals(animalClaimSearch.trim())
      setAnimalClaimResults(results)
      if (results.length === 0) setAnimalClaimMsg({ type: 'info', text: 'No animals found. Try a different name.' })
    } catch (err) {
      setAnimalClaimMsg({ type: 'error', text: err.message })
    } finally {
      setAnimalClaimSearching(false)
    }
  }

  const handleAnimalClaimSubmit = async (e) => {
    e.preventDefault()
    if (!animalClaimSelected) return
    setAnimalClaimSaving(true)
    setAnimalClaimMsg(null)
    try {
      await claimAnimal(token, animalClaimSelected.id)
      setAnimalClaimMsg({ type: 'success', text: 'Animal claimed! Reloading…' })
      setTimeout(() => window.location.reload(), 1500)
    } catch (err) {
      setAnimalClaimMsg({ type: 'error', text: err.message })
    } finally {
      setAnimalClaimSaving(false)
    }
  }

  // ---- Post score ----
  const handlePostScore = async (e) => {
    e.preventDefault()
    setScoreSaving(true)
    setScoreMsg(null)

    // Validation for roughstock
    if (scoreType === 'roughstock') {
      if (!scoreForm.event_category) { setScoreMsg({ type: 'error', text: 'Please select an event category.' }); setScoreSaving(false); return }
      if (scoreForm.covered === null) { setScoreMsg({ type: 'error', text: 'Please select whether you covered the animal.' }); setScoreSaving(false); return }
      if (scoreForm.covered && (!scoreForm.judge1_score || !scoreForm.judge2_score || !scoreForm.animal_score)) {
        setScoreMsg({ type: 'error', text: 'Please enter Judge 1, Judge 2, and Animal scores.' }); setScoreSaving(false); return
      }
      if (scoreForm.reride_offered && scoreForm.reride_accepted && scoreForm.reride_covered === null) {
        setScoreMsg({ type: 'error', text: 'Please select whether you covered on the re-ride.' }); setScoreSaving(false); return
      }
    }

    // Validation for timed
    if (scoreType === 'timed') {
      if (!scoreForm.event_category) { setScoreMsg({ type: 'error', text: 'Please select an event category.' }); setScoreSaving(false); return }
      if (scoreForm.got_time === null) { setScoreMsg({ type: 'error', text: 'Please select whether you received an official time.' }); setScoreSaving(false); return }
      if (scoreForm.got_time && !scoreForm.raw_run_time) { setScoreMsg({ type: 'error', text: 'Please enter your raw run time.' }); setScoreSaving(false); return }
      if (TEAM_ROPING_EVENTS.includes(scoreForm.event_category) && !scoreForm.role) {
        setScoreMsg({ type: 'error', text: 'Please select your role (Header or Heeler) for Team Roping.' }); setScoreSaving(false); return
      }
    }

    try {
      let payload
      if (scoreType === 'roughstock') {
        payload = {
          performance_type:  'roughstock',
          event_category:    scoreForm.event_category,
          performance_date:  scoreForm.performance_date,
          event_name:        scoreForm.event_name,
          event_id:          scoreForm.event_id || '',
          event_tier:        scoreForm.event_tier,
          event_city:        scoreForm.event_city || '',
          event_state:       scoreForm.event_state || '',
          organization_name: scoreForm.organization_name || '',
          arena_condition:  scoreForm.arena_condition,
          weather_condition: scoreForm.weather_condition,
          go_round:         scoreForm.go_round,
          division:         scoreForm.division,
          animal_name:      scoreForm.animal_name,
          bull_type:        scoreForm.bull_type,
          covered:          scoreForm.covered === true,
          judge1_score:     scoreForm.covered ? Number(scoreForm.judge1_score) : 0,
          judge2_score:     scoreForm.covered ? Number(scoreForm.judge2_score) : 0,
          animal_score:     scoreForm.covered ? Number(scoreForm.animal_score) : 0,
          reride_offered:   scoreForm.reride_offered,
          reride_accepted:  scoreForm.reride_offered && scoreForm.reride_accepted,
          reride_covered:   (scoreForm.reride_offered && scoreForm.reride_accepted) ? (scoreForm.reride_covered === true) : false,
          reride_judge1_score: (scoreForm.reride_offered && scoreForm.reride_accepted && scoreForm.reride_covered) ? Number(scoreForm.reride_judge1_score) : 0,
          reride_judge2_score: (scoreForm.reride_offered && scoreForm.reride_accepted && scoreForm.reride_covered) ? Number(scoreForm.reride_judge2_score) : 0,
          reride_animal_score: (scoreForm.reride_offered && scoreForm.reride_accepted && scoreForm.reride_covered) ? Number(scoreForm.reride_animal_score) : 0,
          reride_animal_name: scoreForm.reride_animal_name,
          placement: scoreForm.placement !== '' ? Number(scoreForm.placement) : '',
          payout:    scoreForm.payout    !== '' ? Number(scoreForm.payout)    : '',
        }
      } else {
        const numPen    = Number(scoreForm.num_penalties) || 0
        const penVal    = PENALTY_VALUE[scoreForm.event_category] ?? 5
        const penSecs   = numPen * penVal
        const rawTime   = scoreForm.got_time ? Number(scoreForm.raw_run_time) : null
        const finalTime = scoreForm.got_time ? (rawTime + penSecs) : null
        payload = {
          performance_type:  'timed',
          event_category:    scoreForm.event_category,
          performance_date:  scoreForm.performance_date,
          event_name:        scoreForm.event_name,
          event_id:          scoreForm.event_id || '',
          event_tier:        scoreForm.event_tier,
          event_city:        scoreForm.event_city || '',
          event_state:       scoreForm.event_state || '',
          organization_name: scoreForm.organization_name || '',
          arena_condition:   scoreForm.arena_condition,
          weather_condition: scoreForm.weather_condition,
          go_round:          scoreForm.timed_go_round,
          division:          scoreForm.timed_division,
          horse_name:        scoreForm.horse_name,
          no_time:           !scoreForm.got_time,
          raw_run_time:      rawTime,
          num_penalties:     numPen,
          benchmark_time:    scoreForm.benchmark_time || (finalTime ? finalTime * 1.1 : ''),
          placement:         scoreForm.placement !== '' ? Number(scoreForm.placement) : '',
          payout:            scoreForm.payout    !== '' ? Number(scoreForm.payout)    : '',
          role:              scoreForm.role,
          partner_name:      scoreForm.partner_name,
          partner_rin_id:    scoreForm.partner_rin_id,
        }
      }

      const data = await postMyScore(token, payload)
      const finalScore = data.final_score != null ? data.final_score : null
      let successText = ''
      if (data.free_tier && data.rpi_preview != null) {
        const previewVal = Number(data.rpi_preview).toFixed(1)
        if (scoreType === 'roughstock') {
          successText = `Result logged! Final score: ${finalScore ?? '—'} | Your RPI would be ${previewVal} — upgrade to unlock it.`
        } else {
          const ft = data.final_time != null ? `${Number(data.final_time).toFixed(2)}s` : 'No Time'
          successText = `Result logged! Final time: ${ft} | Your RPI would be ${previewVal} — upgrade to unlock it.`
        }
      } else if (scoreType === 'roughstock') {
        successText = `Score submitted! Final score: ${finalScore ?? '—'} | RPI updated: ${data.rpi_updated != null ? Number(data.rpi_updated).toFixed(1) : '—'}`
      } else {
        const ft = data.final_time != null ? `${Number(data.final_time).toFixed(2)}s` : 'No Time'
        successText = `Score submitted! Final time: ${ft} | RPI updated: ${data.rpi_updated != null ? Number(data.rpi_updated).toFixed(1) : '—'}`
      }
      setScoreMsg({ type: 'success', text: successText })
      setEventSearchQuery('')
      setEventSearchResults([])
      setEventSearchDone(false)
      setAddingNewEvent(false)
      setScoreForm((f) => ({
        ...f,
        event_name: '', event_id: '', event_city: '', event_state: '', organization_name: '',
        performance_date: new Date().toISOString().slice(0, 10),
        // Roughstock reset
        covered: null, judge1_score: '', judge2_score: '', animal_score: '',
        reride_offered: false, reride_accepted: false, reride_covered: null,
        reride_judge1_score: '', reride_judge2_score: '', reride_animal_score: '',
        reride_animal_name: '', animal_name: '', bull_type: '', placement: '', payout: '',
        // Timed reset
        got_time: null, raw_run_time: '', num_penalties: '0', benchmark_time: '',
        horse_name: '', role: '', partner_name: '', partner_rin_id: '',
      }))
      setScoreFormOpen(false)
      setScoresFetched(false)
      loadProfile()
    } catch (err) {
      setScoreMsg({ type: 'error', text: err.message || 'Could not submit score.' })
    } finally {
      setScoreSaving(false)
    }
  }

  // ---- Add animal ----
  const handleAddAnimal = async (e) => {
    e.preventDefault()
    setAnimalSaving(true)
    setAnimalMsg(null)
    try {
      let payload = { ...animalForm, video_links: (animalForm.video_links || []).filter(Boolean) }
      // Upload image first if one was selected
      if (animalForm._imageFile) {
        const up = await uploadMedia(token, animalForm._imageFile)
        payload.featured_image_id = up.attachment_id
      }
      const { _imageFile, image_url, ...submitData } = payload
      await addMyAnimal(token, submitData)
      setAnimalMsg({ type: 'success', text: 'Animal added.' })
      setAnimalForm(EMPTY_ANIMAL_FORM)
      setAddAnimalOpen(false)
      const data = await getMyAnimals(token)
      setAnimals(Array.isArray(data?.animals) ? data.animals : [])
    } catch (err) {
      setAnimalMsg({ type: 'error', text: err.message || 'Could not add animal.' })
    } finally {
      setAnimalSaving(false)
    }
  }

  // ---- Save animal edit ----
  const handleUpdateAnimal = async (e, animalId) => {
    e.preventDefault()
    setAnimalSaving(true)
    setAnimalMsg(null)
    try {
      let payload = { ...animalForm, video_links: (animalForm.video_links || []).filter(Boolean) }
      if (animalForm._imageFile) {
        const up = await uploadMedia(token, animalForm._imageFile)
        payload.featured_image_id = up.attachment_id
      }
      const { _imageFile, image_url, ...submitData } = payload
      await updateMyAnimal(token, animalId, submitData)
      setAnimalMsg({ type: 'success', text: 'Animal updated.' })
      setEditingAnimal(null)
      const data = await getMyAnimals(token)
      setAnimals(Array.isArray(data?.animals) ? data.animals : [])
    } catch (err) {
      setAnimalMsg({ type: 'error', text: err.message || 'Could not update animal.' })
    } finally {
      setAnimalSaving(false)
    }
  }

  // ---- Delete animal ----
  const handleDeleteAnimal = async (animalId) => {
    setDeleteAnimalLoading(true)
    setAnimalMsg(null)
    try {
      await deleteMyAnimal(token, animalId)
      setDeletingAnimal(null)
      setAnimalMsg({ type: 'success', text: 'Animal removed from your herd.' })
      const data = await getMyAnimals(token)
      setAnimals(Array.isArray(data?.animals) ? data.animals : [])
    } catch (err) {
      setAnimalMsg({ type: 'error', text: err.message || 'Could not delete animal.' })
    } finally {
      setDeleteAnimalLoading(false)
    }
  }

  // ---- Add event ----
  const handleAddEvent = async (e) => {
    e.preventDefault()
    setEventSaving(true)
    setEventMsg(null)
    try {
      await addMyEvent(token, eventForm)
      setEventMsg({ type: 'success', text: 'Event submitted for review. It will be published after admin approval.' })
      setEventForm({ title: '', event_date: '', venue: '', city: '', state: '', event_tier: '', season: '', entry_fee: '', prize_money: '', description: '', disciplines: [] })
      setAddEventOpen(false)
      const data = await getMyEvents(token)
      setEvents(Array.isArray(data?.events) ? data.events : [])
    } catch (err) {
      setEventMsg({ type: 'error', text: err.message || 'Could not add event.' })
    } finally {
      setEventSaving(false)
    }
  }

  // ---- Save event edit ----
  const handleUpdateEvent = async (e, eventId) => {
    e.preventDefault()
    setEventSaving(true)
    setEventMsg(null)
    try {
      await updateMyEvent(token, eventId, eventForm)
      setEventMsg({ type: 'success', text: 'Event updated.' })
      setEditingEvent(null)
      const data = await getMyEvents(token)
      setEvents(Array.isArray(data?.events) ? data.events : [])
    } catch (err) {
      setEventMsg({ type: 'error', text: err.message || 'Could not update event.' })
    } finally {
      setEventSaving(false)
    }
  }

  const startEditAnimal = (animal) => {
    setEditingAnimal(animal.id)
    const rawLinks = Array.isArray(animal.video_links) ? animal.video_links : []
    const paddedLinks = [...rawLinks, '', '', '', '', ''].slice(0, 5)
    setAnimalForm({
      name:                animal.name              || '',
      animal_type:         animal.animal_type        || '',
      scoring_type:        animal.scoring_type       || '',
      unique_number:       animal.unique_number      || '',
      sex:                 animal.sex                || '',
      sire:                animal.sire               || '',
      dam:                 animal.dam                || '',
      breed:               animal.breed              || '',
      color:               animal.color              || '',
      year_foaled:         animal.year_foaled        || '',
      birth_date:          animal.birth_date         || '',
      bloodlines:          animal.bloodlines         || '',
      breeding:            animal.breeding           || '',
      breeding_papers_url: animal.breeding_papers_url|| '',
      owner:               animal.owner              || '',
      years_competing:     animal.years_competing    || '',
      currently_active:    animal.currently_active   || 'yes',
      video_links:         paddedLinks,
      notes:               animal.notes              || '',
      featured_image_id:   animal.featured_image_id  || 0,
      image_url:           animal.image_url          || '',
      _imageFile:          null,
    })
    setAddAnimalOpen(false)
  }

  const startEditEvent = (ev) => {
    setEditingEvent(ev.id)
    setEventForm({ title: ev.title, event_date: ev.event_date, venue: ev.venue, city: ev.city, state: ev.state, event_tier: ev.event_tier, season: ev.season, entry_fee: ev.entry_fee, prize_money: ev.prize_money, description: ev.description, disciplines: ev.disciplines || [] })
    setAddEventOpen(false)
  }

  // ---- Guard: not logged in ----
  if (authLoading) return <p className="loading">Loading...</p>
  if (!token || !user) {
    return (
      <div className="dashboard-page">
        <div className="dashboard-gate">
          <h2>Sign in required</h2>
          <p>Please log in to access your dashboard.</p>
          <Link to="/login" className="btn btn-primary">Log In</Link>
        </div>
      </div>
    )
  }

  const rinId        = user.rin_id || profile?.rin_id || '—'
  const rpi          = profile?.profile?.rpi
  const rpiPreview   = profile?.profile?.rpi_preview
  const rpiRoughstock= profile?.profile?.rpi_roughstock
  const rpiTimed     = profile?.profile?.rpi_timed
  const pri          = profile?.profile?.pri
  const isFreeTier   = user?.membership_tier === 'free'

  // ---- Tab list (role-aware) ----
  const tabs = [
    { id: 'profile',    label: 'Profile' },
    // Stats & Rankings only for riders and admins (not pure contractors/producers)
    ...(!isBusinessOnly || isAdmin ? [{ id: 'stats', label: 'Stats & Rankings' }] : []),
    // My Animals: riders and contractors (not pure producers without rider account)
    ...(isRider || isContractor ? [{ id: 'animals', label: 'My Animals' }] : []),
    // Post Score: riders only (or admins); pure business accounts use Submit Results
    ...(isRider || isAdmin ? [{ id: 'scores', label: 'Post Score' }] : []),
    // Producer-only tabs
    ...(isProducer ? [
      { id: 'events',     label: 'My Events' },
      { id: 'organizer',  label: 'Submit Results' },
    ] : []),
    { id: 'membership', label: 'Membership' },
    ...(isAdmin ? [{ id: 'disputes', label: 'Disputes' }] : []),
    // API Keys and NIL Compliance: riders only (these are athlete-focused features)
    ...(isRider && tierGte(tier, 'competitor') ? [{ id: 'api-keys', label: 'API Keys' }] : []),
    ...(isRider && tierGte(tier, 'competitor') ? [{ id: 'nil-compliance', label: 'NIL Compliance' }] : []),
  ]

  return (
    <>
    <div className="dashboard-page">
      {/* ----- Header ----- */}
      <header className="dashboard-header">
        <div>
          <h1>My Dashboard</h1>
          <p className="dashboard-subtitle">
            Welcome, {user.first_name || user.display_name || user.email}
          </p>
          <div className="dashboard-header-meta">
            <span className="dashboard-rin-id">RIN ID: <strong>{rinId}</strong></span>
            <span className={`dashboard-tier-badge dashboard-tier-badge--${tier}`}>
              {TIER_LABELS[tier] || tier}
            </span>
            {profile?.profile?.verified && (
              <span className="verified-badge">Verified</span>
            )}
          </div>
        </div>
        <button type="button" className="btn btn-secondary btn-sm" onClick={logout}>
          Logout
        </button>
      </header>

      {/* ----- Tabs ----- */}
      <nav className="dashboard-tabs" aria-label="Dashboard sections">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`dashboard-tab${activeTab === t.id ? ' active' : ''}`}
            onClick={() => setActiveTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {/* ================================================================
          TAB: PROFILE
      ================================================================ */}
      {activeTab === 'profile' && (
        <div className="dashboard-content">
          <h2 className="dashboard-section-title">My Profile</h2>
          {profileLoading ? (
            <p className="loading">Loading profile...</p>
          ) : (
            <>
            {/* ---- Claim Profile (riders only — contractors/producers don't claim rider profiles) ---- */}
            {!hasRiderLink && !isBusinessOnly && (
              <div className="dashboard-card" style={{ marginBottom: '1.5rem', borderLeft: '4px solid var(--rpn-red)' }}>
                <h3 style={{ marginTop: 0 }}>Claim Your Existing Profile</h3>
                <p style={{ color: 'var(--rpn-text-muted)', marginBottom: '1rem' }}>
                  If your rider profile already exists in the RIN system, search for it by name and verify your identity to link it to your account.
                </p>
                <form onSubmit={handleClaimSearch} className="claim-search-form">
                  <input
                    type="text"
                    placeholder="Search by your full name…"
                    value={claimSearch}
                    onChange={(e) => setClaimSearch(e.target.value)}
                    className="claim-search-input"
                  />
                  <button type="submit" className="claim-search-btn" disabled={claimSearching}>
                    {claimSearching ? 'Searching…' : 'Search'}
                  </button>
                </form>

                {claimResults.length > 0 && (
                  <div style={{ marginBottom: '1rem' }}>
                    <p style={{ fontWeight: 600, marginBottom: '0.5rem' }}>Select your profile:</p>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                      {claimResults.map((r) => (
                        <label
                          key={r.id}
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.75rem',
                            padding: '0.6rem 0.8rem', borderRadius: '6px', cursor: r.already_claimed ? 'not-allowed' : 'pointer',
                            background: claimSelected?.id === r.id ? 'var(--rpn-red)' : 'var(--rpn-bg)',
                            color: claimSelected?.id === r.id ? '#fff' : 'inherit',
                            opacity: r.already_claimed ? 0.5 : 1,
                            border: '1px solid var(--rpn-border)',
                          }}
                        >
                          <input
                            type="radio"
                            name="claim_rider"
                            disabled={r.already_claimed}
                            checked={claimSelected?.id === r.id}
                            onChange={() => { setClaimSelected(r); setClaimMsg(null) }}
                            style={{ accentColor: 'var(--rpn-red)' }}
                          />
                          <span>
                            <strong>{r.name}</strong>
                            {r.city || r.state ? ` — ${[r.city, r.state].filter(Boolean).join(', ')}` : ''}
                            {r.primary_event ? ` · ${r.primary_event}` : ''}
                            {r.already_claimed ? ' (already claimed)' : ''}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {claimSelected && (
                  <form onSubmit={handleClaimSubmit} className="claim-dob-form">
                    <div className="claim-dob-field">
                      <label className="claim-dob-label">
                        Date of Birth <span className="claim-dob-required">*</span>
                      </label>
                      <p className="claim-dob-hint">Enter the date of birth on file for <strong>{claimSelected.name}</strong> to verify ownership.</p>
                      <input
                        type="date"
                        className="claim-dob-input"
                        value={claimDob}
                        onChange={(e) => setClaimDob(e.target.value)}
                        required
                      />
                    </div>
                    <button type="submit" className="btn btn-primary claim-dob-btn" disabled={claimSaving}>
                      {claimSaving ? 'Verifying & Claiming…' : `Claim "${claimSelected.name}"`}
                    </button>
                  </form>
                )}

                {claimMsg && (
                  <p className={`dashboard-msg dashboard-msg--${claimMsg.type}`} style={{ marginTop: '0.75rem' }}>
                    {claimMsg.text}
                  </p>
                )}
              </div>
            )}

            <form className="dashboard-form" onSubmit={handleProfileSave}>
              {isBusinessOnly ? (
                /* ── BUSINESS PROFILE FORM (contractor / organizer) ─────────── */
                <>
                  <h3 className="dashboard-form-section-title">Business Info</h3>

                  <div className="dashboard-form-row">
                    <label>Display Name <span className="optional">(shown on your dashboard and public profile)</span></label>
                    <input
                      type="text"
                      value={editProfile.display_name}
                      onChange={(e) => setEditProfile((p) => ({ ...p, display_name: e.target.value }))}
                      placeholder="How your name should appear on RIN"
                    />
                  </div>

                  <div className="dashboard-form-row">
                    <label>{isProducer && !isContractor ? 'Organization Name' : 'Business Name'} <span className="required">*</span></label>
                    <input
                      type="text"
                      value={editProfile.business_name}
                      onChange={(e) => setEditProfile((p) => ({ ...p, business_name: e.target.value }))}
                      placeholder={isProducer && !isContractor ? 'e.g. Rocky Mountain Rodeo Productions' : 'e.g. Circle T Rodeo Stock'}
                      required
                    />
                  </div>

                  <div className="dashboard-form-row dashboard-form-row--half">
                    <div>
                      <label>Point of Contact <span className="optional">(optional)</span></label>
                      <input
                        type="text"
                        value={editProfile.contact_name}
                        onChange={(e) => setEditProfile((p) => ({ ...p, contact_name: e.target.value }))}
                        placeholder="Full name of main contact person"
                      />
                    </div>
                    <div>
                      <label>Website <span className="optional">(optional)</span></label>
                      <input
                        type="url"
                        value={editProfile.website}
                        onChange={(e) => setEditProfile((p) => ({ ...p, website: e.target.value }))}
                        placeholder="https://"
                      />
                    </div>
                  </div>

                  <h3 className="dashboard-form-section-title">Location</h3>

                  <div className="dashboard-form-row">
                    <label>Street Address <span className="optional">(optional)</span></label>
                    <input
                      type="text"
                      value={editProfile.address_street}
                      onChange={(e) => setEditProfile((p) => ({ ...p, address_street: e.target.value }))}
                      placeholder="e.g. 123 Ranch Road"
                    />
                  </div>

                  <div className="dashboard-form-row dashboard-form-row--third">
                    <div>
                      <label>City</label>
                      <input
                        type="text"
                        value={editProfile.city}
                        onChange={(e) => setEditProfile((p) => ({ ...p, city: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label>State</label>
                      <select
                        value={editProfile.state}
                        onChange={(e) => setEditProfile((p) => ({ ...p, state: e.target.value }))}
                      >
                        <option value="">Select state</option>
                        {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label>ZIP <span className="optional">(optional)</span></label>
                      <input
                        type="text"
                        value={editProfile.address_zip}
                        onChange={(e) => setEditProfile((p) => ({ ...p, address_zip: e.target.value }))}
                        placeholder="e.g. 79765"
                        maxLength={10}
                      />
                    </div>
                  </div>

                  <h3 className="dashboard-form-section-title">Contact</h3>

                  <div className="dashboard-form-row dashboard-form-row--half">
                    <div>
                      <label>Phone <span className="required">*</span></label>
                      <input
                        type="tel"
                        value={editProfile.phone}
                        onChange={(e) => setEditProfile((p) => ({ ...p, phone: e.target.value }))}
                        placeholder="e.g. (555) 123-4567"
                        required
                      />
                    </div>
                    <div>
                      <label>Business Email</label>
                      <input type="email" value={profile?.email || ''} disabled className="input-disabled" />
                      <p className="form-hint">Email is tied to your account login.</p>
                    </div>
                  </div>

                  {isContractor && (
                    <>
                      <h3 className="dashboard-form-section-title">Stock</h3>
                      <div className="dashboard-form-row">
                        <label>Stock Types <span className="optional">(select all that apply)</span></label>
                        <div className="dashboard-checkbox-group">
                          {['Bulls', 'Broncs'].map((type) => (
                            <label key={type} className="dashboard-checkbox-item">
                              <input
                                type="checkbox"
                                checked={editProfile.stock_types.includes(type)}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? [...editProfile.stock_types, type]
                                    : editProfile.stock_types.filter((x) => x !== type)
                                  setEditProfile((p) => ({ ...p, stock_types: next }))
                                }}
                              />
                              {type}
                            </label>
                          ))}
                        </div>
                      </div>
                    </>
                  )}

                  <h3 className="dashboard-form-section-title">About</h3>

                  <div className="dashboard-form-row">
                    <label>Description <span className="optional">(optional)</span></label>
                    <textarea
                      rows={4}
                      value={editProfile.bio}
                      onChange={(e) => setEditProfile((p) => ({ ...p, bio: e.target.value }))}
                      placeholder={isProducer && !isContractor
                        ? 'Tell rodeo fans about your organization and events...'
                        : 'Tell rodeo fans about your stock and operation...'}
                    />
                  </div>

                  <div className="dashboard-form-row">
                    <label>Logo / Photo <span className="optional">(optional — JPG or PNG, max 5 MB)</span></label>
                    <div className="profile-photo-upload">
                      {(profilePhotoPreview || profile?.profile?.photo_url) && (
                        <img
                          src={profilePhotoPreview || profile.profile.photo_url}
                          alt="Logo preview"
                          className="profile-photo-preview"
                        />
                      )}
                      <input
                        type="file"
                        accept="image/jpeg,image/png"
                        onChange={handleProfilePhotoChange}
                        className="profile-photo-input"
                      />
                      {profilePhotoFile && (
                        <span className="profile-photo-filename">{profilePhotoFile.name}</span>
                      )}
                      {profilePhotoMsg && (
                        <p className={`dashboard-msg dashboard-msg--${profilePhotoMsg.type}`}>{profilePhotoMsg.text}</p>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                /* ── RIDER PROFILE FORM ──────────────────────────────────────── */
                <>
                  <div className="dashboard-form-row">
                    <label>Display Name <span className="optional">(shown on your dashboard and public profile)</span></label>
                    <input
                      type="text"
                      value={editProfile.display_name}
                      onChange={(e) => setEditProfile((p) => ({ ...p, display_name: e.target.value }))}
                      placeholder="How your name should appear on RIN"
                    />
                  </div>

                  <div className="dashboard-form-row dashboard-form-row--half">
                    <div>
                      <label>First Name</label>
                      <input
                        type="text"
                        value={editProfile.first_name}
                        onChange={(e) => setEditProfile((p) => ({ ...p, first_name: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label>Last Name</label>
                      <input
                        type="text"
                        value={editProfile.last_name}
                        onChange={(e) => setEditProfile((p) => ({ ...p, last_name: e.target.value }))}
                      />
                    </div>
                  </div>

              <div className="dashboard-form-row dashboard-form-row--half">
                <div>
                  <label>State</label>
                  <select
                    value={editProfile.state}
                    onChange={(e) => setEditProfile((p) => ({ ...p, state: e.target.value }))}
                  >
                    <option value="">Select state</option>
                    {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <div>
                  <label>City</label>
                  <input
                    type="text"
                    value={editProfile.city}
                    onChange={(e) => setEditProfile((p) => ({ ...p, city: e.target.value }))}
                  />
                </div>
              </div>

              <div className="dashboard-form-row dashboard-form-row--half">
                <div>
                  <label>Primary Event / Discipline</label>
                  <select
                    value={editProfile.event_type}
                    onChange={(e) => setEditProfile((p) => ({ ...p, event_type: e.target.value }))}
                  >
                    <option value="">Select discipline</option>
                    {DISCIPLINES.map((d) => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label>Age Group</label>
                  <select
                    value={editProfile.age_group}
                    onChange={(e) => setEditProfile((p) => ({ ...p, age_group: e.target.value }))}
                  >
                    <option value="">Select age group</option>
                    {AGE_GROUPS.map((ag) => <option key={ag} value={ag}>{ag}</option>)}
                  </select>
                </div>
              </div>

              <div className="dashboard-form-row">
                <label>Bio</label>
                <textarea
                  rows={4}
                  value={editProfile.bio}
                  onChange={(e) => setEditProfile((p) => ({ ...p, bio: e.target.value }))}
                  placeholder="Tell the rodeo world about yourself..."
                />
              </div>

              {/* Profile photo upload */}
              <div className="dashboard-form-row">
                <label>Profile Photo <span className="optional">(optional — JPG or PNG, max 5 MB)</span></label>
                <div className="profile-photo-upload">
                  {(profilePhotoPreview || profile?.profile?.photo_url) && (
                    <img
                      src={profilePhotoPreview || profile.profile.photo_url}
                      alt="Profile preview"
                      className="profile-photo-preview"
                    />
                  )}
                  <input
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={handleProfilePhotoChange}
                    className="profile-photo-input"
                  />
                  {profilePhotoFile && (
                    <span className="profile-photo-filename">{profilePhotoFile.name}</span>
                  )}
                  {profilePhotoMsg && (
                    <p className={`dashboard-msg dashboard-msg--${profilePhotoMsg.type}`}>{profilePhotoMsg.text}</p>
                  )}
                </div>
              </div>

              <div className="dashboard-form-row dashboard-form-row--half">
                <div>
                  <label>Phone <span className="required">*</span></label>
                  <input
                    type="tel"
                    value={editProfile.phone}
                    onChange={(e) => setEditProfile((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="e.g. (555) 123-4567"
                    required
                  />
                </div>
                <div>
                  <label>Website <span className="optional">(optional)</span></label>
                  <input
                    type="url"
                    value={editProfile.website}
                    onChange={(e) => setEditProfile((p) => ({ ...p, website: e.target.value }))}
                    placeholder="https://"
                  />
                </div>
              </div>

              {hasRiderLink && (<>
                <h3 className="dashboard-form-section-title">Personal Info</h3>

                <div className="dashboard-form-row dashboard-form-row--half">
                  <div>
                    <label>Nickname <span className="optional">(optional)</span></label>
                    <input
                      type="text"
                      value={editProfile.nickname}
                      onChange={(e) => setEditProfile((p) => ({ ...p, nickname: e.target.value }))}
                      placeholder="e.g. Dusty"
                    />
                  </div>
                  <div>
                    <label>Date of Birth</label>
                    <input
                      type="text"
                      value={editProfile.date_of_birth}
                      onChange={(e) => setEditProfile((p) => ({ ...p, date_of_birth: e.target.value }))}
                      placeholder="MM/DD/YYYY"
                    />
                  </div>
                </div>

                <div className="dashboard-form-row dashboard-form-row--half">
                  <div>
                    <label>Gender</label>
                    <select
                      value={editProfile.gender}
                      onChange={(e) => setEditProfile((p) => ({ ...p, gender: e.target.value }))}
                    >
                      <option value="">Select gender</option>
                      {GENDERS.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>Country</label>
                    <input
                      type="text"
                      value={editProfile.country}
                      onChange={(e) => setEditProfile((p) => ({ ...p, country: e.target.value }))}
                    />
                  </div>
                </div>

                <h3 className="dashboard-form-section-title">Competition Classification</h3>

                <div className="dashboard-form-row dashboard-form-row--half">
                  <div>
                    <label>Division</label>
                    <select
                      value={editProfile.division}
                      onChange={(e) => setEditProfile((p) => ({ ...p, division: e.target.value }))}
                    >
                      <option value="">Select division</option>
                      {DIVISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>Years Competing <span className="optional">(optional)</span></label>
                    <input
                      type="number"
                      min="0"
                      max="60"
                      value={editProfile.years_competing}
                      onChange={(e) => setEditProfile((p) => ({ ...p, years_competing: e.target.value }))}
                    />
                  </div>
                </div>

                <div className="dashboard-form-row dashboard-form-row--half">
                  <div>
                    <label>Primary Event</label>
                    <select
                      value={editProfile.primary_event}
                      onChange={(e) => setEditProfile((p) => ({ ...p, primary_event: e.target.value }))}
                    >
                      <option value="">Select primary event</option>
                      {ALL_EVENTS.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
                    </select>
                  </div>
                </div>

                <div className="dashboard-form-row">
                  <label>Secondary Events <span className="optional">(optional — select all that apply)</span></label>
                  <div className="dashboard-checkbox-group">
                    {ALL_EVENTS.map((ev) => (
                      <label key={ev} className="dashboard-checkbox-item">
                        <input
                          type="checkbox"
                          checked={editProfile.secondary_events.includes(ev)}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...editProfile.secondary_events, ev]
                              : editProfile.secondary_events.filter((x) => x !== ev)
                            setEditProfile((p) => ({ ...p, secondary_events: next }))
                          }}
                        />
                        {ev}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="dashboard-form-row">
                  <label>Association Memberships <span className="optional">(optional)</span></label>
                  <div className="dashboard-checkbox-group">
                    {ASSOCIATIONS.map((a) => (
                      <label key={a} className="dashboard-checkbox-item">
                        <input
                          type="checkbox"
                          checked={editProfile.association_memberships.includes(a)}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...editProfile.association_memberships, a]
                              : editProfile.association_memberships.filter((x) => x !== a)
                            setEditProfile((p) => ({ ...p, association_memberships: next }))
                          }}
                        />
                        {a}
                      </label>
                    ))}
                  </div>
                </div>

                <h3 className="dashboard-form-section-title">Social Media</h3>

                <div className="dashboard-form-row dashboard-form-row--half">
                  <div>
                    <label>Instagram <span className="optional">(optional)</span></label>
                    <input
                      type="url"
                      value={editProfile.instagram_url}
                      onChange={(e) => setEditProfile((p) => ({ ...p, instagram_url: e.target.value }))}
                      placeholder="https://instagram.com/username"
                    />
                  </div>
                  <div>
                    <label>TikTok <span className="optional">(optional)</span></label>
                    <input
                      type="url"
                      value={editProfile.tiktok_url}
                      onChange={(e) => setEditProfile((p) => ({ ...p, tiktok_url: e.target.value }))}
                      placeholder="https://tiktok.com/@username"
                    />
                  </div>
                </div>

                <div className="dashboard-form-row dashboard-form-row--half">
                  <div>
                    <label>Facebook <span className="optional">(optional)</span></label>
                    <input
                      type="url"
                      value={editProfile.facebook_url}
                      onChange={(e) => setEditProfile((p) => ({ ...p, facebook_url: e.target.value }))}
                      placeholder="https://facebook.com/username"
                    />
                  </div>
                  <div>
                    <label>X / Twitter <span className="optional">(optional)</span></label>
                    <input
                      type="url"
                      value={editProfile.twitter_url}
                      onChange={(e) => setEditProfile((p) => ({ ...p, twitter_url: e.target.value }))}
                      placeholder="https://x.com/username"
                    />
                  </div>
                </div>

                <div className="dashboard-form-row dashboard-form-row--half">
                  <div>
                    <label>YouTube <span className="optional">(optional)</span></label>
                    <input
                      type="url"
                      value={editProfile.youtube_url}
                      onChange={(e) => setEditProfile((p) => ({ ...p, youtube_url: e.target.value }))}
                      placeholder="https://youtube.com/@channel"
                    />
                  </div>
                  <div>
                    <label>Personal Website <span className="optional">(optional)</span></label>
                    <input
                      type="url"
                      value={editProfile.personal_website}
                      onChange={(e) => setEditProfile((p) => ({ ...p, personal_website: e.target.value }))}
                      placeholder="https://"
                    />
                  </div>
                </div>

                <h3 className="dashboard-form-section-title">Sponsorship &amp; NIL</h3>

                <div className="dashboard-form-row">
                  <label className="dashboard-nil-toggle">
                    <input
                      type="checkbox"
                      checked={!!editProfile.nil_open_to_sponsorship}
                      onChange={(e) => setEditProfile((p) => ({ ...p, nil_open_to_sponsorship: e.target.checked }))}
                    />
                    <span>Open to NIL / Brand Partnerships</span>
                    <span className="optional" style={{ marginLeft: '0.5rem' }}>— shows a badge on your public profile</span>
                  </label>
                </div>

                <div className="dashboard-form-row dashboard-form-row--half">
                  <div>
                    <label>Sponsor / Brand Name <span className="optional">(optional)</span></label>
                    <input
                      type="text"
                      value={editProfile.sponsor_name}
                      onChange={(e) => setEditProfile((p) => ({ ...p, sponsor_name: e.target.value }))}
                      placeholder="e.g. Wrangler, Resistol…"
                    />
                  </div>
                  <div>
                    <label>Sponsor Website <span className="optional">(optional)</span></label>
                    <input
                      type="url"
                      value={editProfile.sponsor_url}
                      onChange={(e) => setEditProfile((p) => ({ ...p, sponsor_url: e.target.value }))}
                      placeholder="https://sponsor.com"
                    />
                  </div>
                </div>

                <h3 className="dashboard-form-section-title">Video Highlights <span className="optional">(up to 5 YouTube / Vimeo links)</span></h3>

                {editProfile.video_highlights.map((url, idx) => (
                  <div className="dashboard-form-row" key={idx}>
                    <label>Video {idx + 1} <span className="optional">(optional)</span></label>
                    <input
                      type="url"
                      value={url}
                      onChange={(e) => {
                        const next = [...editProfile.video_highlights]
                        next[idx] = e.target.value
                        setEditProfile((p) => ({ ...p, video_highlights: next }))
                      }}
                      placeholder="https://youtube.com/watch?v=..."
                    />
                  </div>
                ))}
              </>)}
                </>
              )}

              {profileMsg && (
                <p className={`dashboard-msg dashboard-msg--${profileMsg.type}`}>{profileMsg.text}</p>
              )}

              <div className="dashboard-form-actions">
                <button type="submit" className="btn btn-primary" disabled={profileSaving}>
                  {profileSaving ? 'Saving...' : 'Save Profile'}
                </button>
                {hasRiderLink && profile && (
                  <Link to={`/riders/${profile.profile_slug || ''}`} className="btn btn-secondary">
                    View Public Profile
                  </Link>
                )}
                {hasContractorLink && profile && (
                  <Link to={`/contractors/${profile.profile_slug || ''}`} className="btn btn-secondary">
                    View Public Page
                  </Link>
                )}
                {hasProdLink && profile && (
                  <Link to={`/producers/${profile.profile_slug || ''}`} className="btn btn-secondary">
                    View Organization Page
                  </Link>
                )}
              </div>
            </form>

            {/* QR Code / Digital ID */}
            {hasRiderLink && (
              <div className="dashboard-qr-section">
                <h3 className="dashboard-section-title" style={{ marginTop: '2rem' }}>Your Digital ID</h3>
                <div className="dashboard-qr-card">
                  <div className="dashboard-qr-code">
                    <QRCodeSVG
                      value={`${window.location.origin}/riders/${profile?.profile_slug || ''}`}
                      size={150}
                      bgColor="#ffffff"
                      fgColor="#1a1a1a"
                      level="M"
                    />
                  </div>
                  <div className="dashboard-qr-info">
                    <p className="dashboard-qr-name">{user.first_name} {user.last_name || ''}</p>
                    <p className="dashboard-qr-rin">RIN ID: <strong>{rinId}</strong></p>
                    <p className="dashboard-qr-desc">Event organizers can scan this QR code to look up your profile and verify your RIN membership at check-in.</p>
                    <p className="dashboard-qr-desc" style={{ fontSize: '0.8rem', color: 'var(--rpn-text-muted)' }}>You can also screenshot or print this code to bring to events.</p>
                  </div>
                </div>
              </div>
            )}

            {/* QR Code — Contractor public page */}
            {hasContractorLink && !hasRiderLink && profile?.profile_slug && (
              <div className="dashboard-qr-section">
                <h3 className="dashboard-section-title" style={{ marginTop: '2rem' }}>Your Business Page QR Code</h3>
                <div className="dashboard-qr-card">
                  <div className="dashboard-qr-code">
                    <QRCodeSVG
                      value={`${window.location.origin}/contractors/${profile.profile_slug}`}
                      size={150}
                      bgColor="#ffffff"
                      fgColor="#1a1a1a"
                      level="M"
                    />
                  </div>
                  <div className="dashboard-qr-info">
                    <p className="dashboard-qr-name">{editProfile.business_name || user.display_name}</p>
                    <p className="dashboard-qr-rin">RIN ID: <strong>{rinId}</strong></p>
                    <p className="dashboard-qr-desc">Share or print this QR code so event organizers and riders can find your stock contractor page quickly.</p>
                  </div>
                </div>
              </div>
            )}

            {/* QR Code — Producer public page */}
            {hasProdLink && !hasRiderLink && profile?.profile_slug && (
              <div className="dashboard-qr-section">
                <h3 className="dashboard-section-title" style={{ marginTop: '2rem' }}>Your Organization QR Code</h3>
                <div className="dashboard-qr-card">
                  <div className="dashboard-qr-code">
                    <QRCodeSVG
                      value={`${window.location.origin}/producers/${profile.profile_slug}`}
                      size={150}
                      bgColor="#ffffff"
                      fgColor="#1a1a1a"
                      level="M"
                    />
                  </div>
                  <div className="dashboard-qr-info">
                    <p className="dashboard-qr-name">{editProfile.business_name || user.display_name}</p>
                    <p className="dashboard-qr-rin">RIN ID: <strong>{rinId}</strong></p>
                    <p className="dashboard-qr-desc">Share or print this QR code so riders can find your events and organization page.</p>
                  </div>
                </div>
              </div>
            )}

            {/* NIL-Ready Shareable Profile Card — Competitor+ */}
            {hasRiderLink && tierGte(tier, 'competitor') && (
              <div className="dashboard-nil-share-section">
                <h3 className="dashboard-section-title" style={{ marginTop: '2rem' }}>Share Your Profile</h3>
                <div className="nil-share-card">
                  <div className="nil-share-card-body">
                    <p className="nil-share-label">Your shareable profile link:</p>
                    <div className="nil-share-url-row">
                      <input
                        readOnly
                        className="nil-share-url-input"
                        value={`${window.location.origin}/riders/${profile?.profile_slug || ''}`}
                      />
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => {
                          navigator.clipboard.writeText(`${window.location.origin}/riders/${profile?.profile_slug || ''}`)
                          // brief feedback
                          const btn = document.activeElement
                          const orig = btn.textContent
                          btn.textContent = 'Copied!'
                          setTimeout(() => { btn.textContent = orig }, 1500)
                        }}
                      >Copy</button>
                    </div>
                    <p className="nil-share-hint">Share on Instagram, X, or Facebook to connect with sponsors and event organizers.</p>
                    <div className="nil-share-social">
                      <a
                        href={`https://twitter.com/intent/tweet?url=${encodeURIComponent(`${window.location.origin}/riders/${profile?.profile_slug || ''}&text=Check out my RIN athlete profile!`)}`}
                        target="_blank" rel="noreferrer"
                        className="nil-share-social-btn nil-share-twitter"
                      >Share on X</a>
                      <a
                        href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(`${window.location.origin}/riders/${profile?.profile_slug || ''}`)}`}
                        target="_blank" rel="noreferrer"
                        className="nil-share-social-btn nil-share-facebook"
                      >Share on Facebook</a>
                    </div>
                  </div>
                </div>
              </div>
            )}
            </>
          )}
        </div>
      )}

      {/* ================================================================
          TAB: STATS & RANKINGS
      ================================================================ */}
      {activeTab === 'stats' && (
        <div className="dashboard-content">
          <h2 className="dashboard-section-title">Stats &amp; Rankings</h2>

          {/* RPI — always visible */}
          <div className="dashboard-card">
            <h3>Performance Index</h3>
            <div className="dashboard-stats-grid">
              {isFreeTier ? (
                /* Free tier — never show actual RPI, show preview or prompt */
                rpiPreview != null && Number(rpiPreview) > 0 ? (
                  <div className="dashboard-stat rpi-preview-locked">
                    <span className="dashboard-stat-label">RPI Preview 🔒</span>
                    <span className="dashboard-stat-val dashboard-stat-val--large rpi-preview-blur">{Number(rpiPreview).toFixed(1)}</span>
                    <p className="rpi-preview-prompt">
                      Your RPI would be <strong>{Number(rpiPreview).toFixed(1)}</strong> — unlock it for <strong>$7.46/mo</strong>.{' '}
                      <a href="/join-us" className="rpi-preview-link">Upgrade to Competitor Pro →</a>
                    </p>
                  </div>
                ) : (
                  <div className="dashboard-stat rpi-preview-locked">
                    <span className="dashboard-stat-label">RPI 🔒</span>
                    <span className="dashboard-stat-val dashboard-stat-val--large" style={{ color: '#d1d5db' }}>—</span>
                    <p className="rpi-preview-prompt">
                      Log your first result to see your RPI Preview.{' '}
                      <a href="/join-us" className="rpi-preview-link">Upgrade to Competitor Pro →</a>
                    </p>
                  </div>
                )
              ) : (
                /* Paid tiers — show actual RPI */
                <>
                  {rpi != null && (
                    <div className="dashboard-stat">
                      <span className="dashboard-stat-label">Overall RPI</span>
                      <span className="dashboard-stat-val dashboard-stat-val--large">{Number(rpi).toFixed(1)}</span>
                    </div>
                  )}
                  {rpiRoughstock != null && rpiRoughstock > 0 && (
                    <div className="dashboard-stat">
                      <span className="dashboard-stat-label">Roughstock RPI</span>
                      <span className="dashboard-stat-val">{Number(rpiRoughstock).toFixed(1)}</span>
                    </div>
                  )}
                  {rpiTimed != null && rpiTimed > 0 && (
                    <div className="dashboard-stat">
                      <span className="dashboard-stat-label">Timed THI</span>
                      <span className="dashboard-stat-val">{Number(rpiTimed).toFixed(1)}</span>
                    </div>
                  )}
                  {pri != null && (
                    <div className="dashboard-stat">
                      <span className="dashboard-stat-label">PRI</span>
                      <span className="dashboard-stat-val dashboard-stat-val--large">{Number(pri).toFixed(1)}</span>
                    </div>
                  )}
                  {rpi == null && pri == null && (
                    <p className="placeholder">No index data yet. Compete in sanctioned events to build your RPI.</p>
                  )}
                </>
              )}
            </div>
            {(rpiRoughstock > 0 || rpiTimed > 0) && (
              <p className="dashboard-rpi-formula-note">
                Overall RPI = {rpiRoughstock > 0 && rpiTimed > 0
                  ? (rpiRoughstock >= rpiTimed
                    ? 'Roughstock RPI × 60% + Timed THI × 40% (roughstock is primary discipline)'
                    : 'Timed THI × 60% + Roughstock RPI × 40% (timed is primary discipline)')
                  : rpiRoughstock > 0
                    ? '(avg qualified adj. score × completion rate) + (wins × 5)'
                    : '(avg timed adj. score × completion rate) − (total penalties × 0.5)'
                }
              </p>
            )}
          </div>

          {/* Season overview — Competitor+ */}
          <LockedFeature requiredTier="competitor" currentTier={tier}>
            <div className="dashboard-card">
              <h3>Season Overview</h3>
              <div className="dashboard-stats-grid">
                <div className="dashboard-stat">
                  <span className="dashboard-stat-label">Total Rides</span>
                  <span className="dashboard-stat-val">{profile?.profile?.total_rides ?? '—'}</span>
                </div>
                <div className="dashboard-stat">
                  <span className="dashboard-stat-label">Qualified Rides</span>
                  <span className="dashboard-stat-val">{profile?.profile?.qualified_rides ?? '—'}</span>
                </div>
                <div className="dashboard-stat">
                  <span className="dashboard-stat-label">Completion Rate</span>
                  <span className="dashboard-stat-val">
                    {profile?.profile?.completion_rate != null
                      ? `${Number(profile.profile.completion_rate).toFixed(1)}%`
                      : '—'}
                  </span>
                </div>
                <div className="dashboard-stat">
                  <span className="dashboard-stat-label">Wins</span>
                  <span className="dashboard-stat-val">{profile?.profile?.win_count ?? '—'}</span>
                </div>
              </div>
            </div>
          </LockedFeature>

          {/* Confidence Score */}
          {profile?.profile?.rpi_confidence_score != null && (
            <div className="dashboard-card" style={{ marginTop: '1.5rem' }}>
              <h3>RPI Confidence Score</h3>
              <p className="dashboard-rpi-formula-note" style={{ marginBottom: '0.75rem' }}>
                How well-established your RPI is — based on number of performances, how recent they are, and how many were officially verified.
              </p>
              <div className="confidence-score-bar-wrap">
                <div className="confidence-score-bar">
                  <div
                    className="confidence-score-fill"
                    style={{ width: `${profile.profile.rpi_confidence_score}%` }}
                  />
                </div>
                <span className="confidence-score-label">{profile.profile.rpi_confidence_score}/100</span>
              </div>
            </div>
          )}

          {/* RPI Trend Chart — Competitor+ */}
          <LockedFeature requiredTier="competitor" currentTier={tier}>
            <div className="dashboard-card" style={{ marginTop: '1.5rem' }}>
              <h3>RPI Trend (Monthly)</h3>
              {(() => {
                const history = profile?.profile?.rpi_history || []
                if (history.length < 2) {
                  return <p className="placeholder dashboard-placeholder">Log at least 2 months of performances to see your trend chart.</p>
                }
                const maxRpi = Math.max(...history.map((h) => h.rpi), 1)
                const W = 600, H = 120, PAD = 8
                const xStep = history.length > 1 ? (W - PAD * 2) / (history.length - 1) : W
                const points = history.map((h, i) => {
                  const x = PAD + i * xStep
                  const y = H - PAD - ((h.rpi / maxRpi) * (H - PAD * 2))
                  return `${x},${y}`
                }).join(' ')
                const lastIdx = history.length - 1
                const lastX = PAD + lastIdx * xStep
                const lastY = H - PAD - ((history[lastIdx].rpi / maxRpi) * (H - PAD * 2))
                return (
                  <div className="rpi-chart-wrap">
                    <svg viewBox={`0 0 ${W} ${H}`} className="rpi-chart-svg" preserveAspectRatio="none">
                      <defs>
                        <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="var(--rpn-red)" stopOpacity="0.3" />
                          <stop offset="100%" stopColor="var(--rpn-red)" stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <polygon
                        points={`${PAD},${H} ${points} ${PAD + lastIdx * xStep},${H}`}
                        fill="url(#chartGrad)"
                      />
                      <polyline points={points} fill="none" stroke="var(--rpn-red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                      <circle cx={lastX} cy={lastY} r="4" fill="var(--rpn-red)" />
                    </svg>
                    <div className="rpi-chart-labels">
                      {history.map((h) => (
                        <span key={h.month} className="rpi-chart-label">{h.month.slice(5)}</span>
                      ))}
                    </div>
                    <p className="rpi-chart-note">Showing {history.length} month{history.length !== 1 ? 's' : ''} · Latest RPI: <strong>{history[lastIdx]?.rpi}</strong></p>
                  </div>
                )
              })()}
            </div>
          </LockedFeature>

          {/* Performance Breakdown — Competitor+ */}
          <LockedFeature requiredTier="competitor" currentTier={tier}>
            <div className="dashboard-card" style={{ marginTop: '1.5rem' }}>
              <h3>Performance Breakdown</h3>
              {(() => {
                const history = profile?.profile?.rpi_history || []
                if (history.length === 0) {
                  return <p className="placeholder dashboard-placeholder">No performance data yet.</p>
                }
                const rpiSeason = profile?.profile?.rpi_season
                const rpiCareer = profile?.profile?.rpi_career
                const rpiCurrent = profile?.profile?.rpi_current ?? profile?.profile?.rpi
                return (
                  <div className="dashboard-stats-grid">
                    {rpiCurrent != null && (
                      <div className="dashboard-stat">
                        <span className="dashboard-stat-label">Current RPI (rolling 12mo)</span>
                        <span className="dashboard-stat-val">{Number(rpiCurrent).toFixed(1)}</span>
                      </div>
                    )}
                    {rpiSeason != null && rpiSeason > 0 && (
                      <div className="dashboard-stat">
                        <span className="dashboard-stat-label">Season RPI ({new Date().getFullYear()})</span>
                        <span className="dashboard-stat-val">{Number(rpiSeason).toFixed(1)}</span>
                      </div>
                    )}
                    {rpiCareer != null && rpiCareer > 0 && (
                      <div className="dashboard-stat">
                        <span className="dashboard-stat-label">Career RPI (all-time avg)</span>
                        <span className="dashboard-stat-val">{Number(rpiCareer).toFixed(1)}</span>
                      </div>
                    )}
                    <div className="dashboard-stat">
                      <span className="dashboard-stat-label">Events in History</span>
                      <span className="dashboard-stat-val">{history.reduce((s, h) => s + h.count, 0)}</span>
                    </div>
                  </div>
                )
              })()}
            </div>
          </LockedFeature>

          {/* Discipline Index Breakdown — Competitor+ */}
          <LockedFeature requiredTier="competitor" currentTier={tier}>
            <div className="dashboard-card" style={{ marginTop: '1.5rem' }}>
              <h3>Discipline Index Breakdown</h3>
              <div className="dashboard-stats-grid">
                {rpiRoughstock != null && rpiRoughstock > 0 && (
                  <div className="dashboard-stat">
                    <span className="dashboard-stat-label">Roughstock RPI</span>
                    <span className="dashboard-stat-val">{Number(rpiRoughstock).toFixed(1)}</span>
                    <span className="dashboard-stat-sub">Bareback, Saddle Bronc, Bull Riding</span>
                  </div>
                )}
                {rpiTimed != null && rpiTimed > 0 && (
                  <div className="dashboard-stat">
                    <span className="dashboard-stat-label">Timed THI</span>
                    <span className="dashboard-stat-val">{Number(rpiTimed).toFixed(1)}</span>
                    <span className="dashboard-stat-sub">Roping, Barrel, Breakaway, Steer</span>
                  </div>
                )}
                {(rpiRoughstock == null || rpiRoughstock === 0) && (rpiTimed == null || rpiTimed === 0) && (
                  <p className="placeholder">Log results in multiple discipline types to see your breakdown.</p>
                )}
              </div>
              <p className="dashboard-rpi-formula-note">
                Overall RPI weights your strongest discipline 60% and secondary 40%. View individual event scores in the Post Score tab.
              </p>
            </div>
          </LockedFeature>

          {/* Peer Comparison — Competitor+ */}
          <LockedFeature requiredTier="competitor" currentTier={tier}>
            <div className="dashboard-card" style={{ marginTop: '1.5rem' }}>
              <h3>Peer Comparison</h3>
              {peerRank == null && peerRankFetched ? (
                <p className="placeholder">Could not load rankings. Make sure your state and primary discipline are set in your profile.</p>
              ) : peerRank == null ? (
                <p className="placeholder">Loading rankings…</p>
              ) : (
                <div className="dashboard-stats-grid">
                  {peerRank.state_rank != null ? (
                    <div className="dashboard-stat">
                      <span className="dashboard-stat-label">State Rank ({peerRank.state || '—'})</span>
                      <span className="dashboard-stat-val dashboard-stat-val--large">#{peerRank.state_rank}</span>
                      <span className="dashboard-stat-sub">of {peerRank.state_total} riders</span>
                    </div>
                  ) : (
                    <div className="dashboard-stat">
                      <span className="dashboard-stat-label">State Rank</span>
                      <span className="dashboard-stat-val">—</span>
                      <span className="dashboard-stat-sub">Set your state in Profile to see rank</span>
                    </div>
                  )}
                  {peerRank.discipline_rank != null ? (
                    <div className="dashboard-stat">
                      <span className="dashboard-stat-label">Discipline Rank ({peerRank.discipline || '—'})</span>
                      <span className="dashboard-stat-val dashboard-stat-val--large">#{peerRank.discipline_rank}</span>
                      <span className="dashboard-stat-sub">of {peerRank.discipline_total} riders</span>
                    </div>
                  ) : (
                    <div className="dashboard-stat">
                      <span className="dashboard-stat-label">Discipline Rank</span>
                      <span className="dashboard-stat-val">—</span>
                      <span className="dashboard-stat-sub">Set primary discipline in Profile to see rank</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </LockedFeature>
        </div>
      )}

      {/* ================================================================
          TAB: MY ANIMALS
      ================================================================ */}
      {activeTab === 'animals' && (
        <div className="dashboard-content">
          <div className="dashboard-section-header">
            <h2 className="dashboard-section-title">My Animals</h2>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => { setAddAnimalOpen((v) => !v); setEditingAnimal(null); setAnimalMsg(null) }}
            >
              {addAnimalOpen ? 'Cancel' : '+ Add Animal'}
            </button>
          </div>

          {animalMsg && (
            <p className={`dashboard-msg dashboard-msg--${animalMsg.type}`}>{animalMsg.text}</p>
          )}

          {/* Animal profile limit notice */}
          {(() => {
            const limits = { free: 3, competitor: 5, contractor: 25, organizer: 25, enterprise: 999 }
            const limit = limits[tier] ?? 3
            const count = animals.length
            return (
              <p className="animal-limit-notice">
                {count}/{limit === 999 ? '∞' : limit} animal profiles used
                {count >= limit && tier !== 'enterprise' && (
                  <> — <a href="/join-us" className="rpi-preview-link">Upgrade to add more</a></>
                )}
              </p>
            )
          })()}

          {/* Herd SRI Dashboard — Contractor+ */}
          {tierGte(tier, 'contractor') && animals.length > 0 && (
            <div className="dashboard-card herd-dashboard" style={{ marginBottom: '1.5rem' }}>
              <h3>Herd Performance Dashboard</h3>
              <div className="dashboard-stats-grid">
                <div className="dashboard-stat">
                  <span className="dashboard-stat-label">Animals in Herd</span>
                  <span className="dashboard-stat-val dashboard-stat-val--large">{animals.length}/25</span>
                </div>
                {(() => {
                  const sriVals = animals.map((a) => a.sri).filter((v) => v > 0)
                  const avgSri = sriVals.length > 0 ? (sriVals.reduce((s, v) => s + v, 0) / sriVals.length) : 0
                  const topAnimal = sriVals.length > 0
                    ? animals.reduce((best, a) => (a.sri > (best?.sri ?? 0) ? a : best), null)
                    : null
                  return (
                    <>
                      <div className="dashboard-stat">
                        <span className="dashboard-stat-label">Avg Herd SRI</span>
                        <span className="dashboard-stat-val">{avgSri > 0 ? avgSri.toFixed(2) : '—'}</span>
                      </div>
                      {topAnimal && (
                        <div className="dashboard-stat">
                          <span className="dashboard-stat-label">Top Ranked Animal</span>
                          <span className="dashboard-stat-val">{topAnimal.name}</span>
                          <span className="dashboard-stat-sub">SRI {topAnimal.sri?.toFixed(2)}</span>
                        </div>
                      )}
                    </>
                  )
                })()}
              </div>
            </div>
          )}

          {/* Claim existing animal */}
          <div className="claim-card">
            <div className="claim-card-header">
              <span className="claim-card-icon">🐂</span>
              <div>
                <h3 className="claim-card-title">Claim an Existing Animal</h3>
                <p className="claim-card-desc">
                  If your animal is already in the RIN system, search for it by name and link it to your account.
                </p>
              </div>
            </div>

            <form className="claim-search-form" onSubmit={handleAnimalClaimSearch}>
              <input
                type="text"
                className="claim-search-input"
                placeholder="Search by animal name…"
                value={animalClaimSearch}
                onChange={(e) => setAnimalClaimSearch(e.target.value)}
              />
              <button type="submit" className="claim-search-btn" disabled={animalClaimSearching}>
                {animalClaimSearching ? (
                  <span className="claim-search-btn-spinner" />
                ) : (
                  '🔍 Search'
                )}
              </button>
            </form>

            {animalClaimResults.length > 0 && (
              <div className="claim-results">
                <p className="claim-results-label">Select the animal to claim:</p>
                {animalClaimResults.map((a) => (
                  <label
                    key={a.id}
                    className={`claim-result-item${animalClaimSelected?.id === a.id ? ' selected' : ''}${a.already_claimed ? ' disabled' : ''}`}
                  >
                    <input
                      type="radio"
                      name="claim_animal"
                      disabled={a.already_claimed}
                      checked={animalClaimSelected?.id === a.id}
                      onChange={() => { setAnimalClaimSelected(a); setAnimalClaimMsg(null) }}
                    />
                    <span className="claim-result-name">{a.name}</span>
                    {a.animal_type && <span className="claim-result-type">{a.animal_type}</span>}
                    {a.already_claimed && <span className="claim-result-tag">Already claimed</span>}
                  </label>
                ))}
              </div>
            )}

            {animalClaimSelected && (
              <form onSubmit={handleAnimalClaimSubmit} className="claim-submit-row">
                <button type="submit" className="btn btn-primary" disabled={animalClaimSaving}>
                  {animalClaimSaving ? 'Claiming…' : `Claim "${animalClaimSelected.name}"`}
                </button>
              </form>
            )}

            {animalClaimMsg && (
              <p className={`dashboard-msg dashboard-msg--${animalClaimMsg.type}`}>
                {animalClaimMsg.text}
              </p>
            )}
          </div>

          {/* Add animal form */}
          {addAnimalOpen && (
            <form className="dashboard-form dashboard-inline-form" onSubmit={handleAddAnimal}>
              <h3>Add New Animal</h3>
              <AnimalFormFields form={animalForm} setForm={setAnimalForm} />
              <div className="dashboard-form-actions">
                <button type="submit" className="btn btn-primary" disabled={animalSaving}>
                  {animalSaving ? 'Saving...' : 'Add Animal'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setAddAnimalOpen(false)}>Cancel</button>
              </div>
            </form>
          )}

          {animalsLoading && <p className="loading">Loading animals...</p>}

          {!animalsLoading && animals.length === 0 && (
            <p className="placeholder">No animals linked yet. Add your first animal above.</p>
          )}

          {!animalsLoading && animals.length > 0 && (
            <div className="dashboard-animals-list">
              {animals.map((animal) => (
                <div key={animal.id} className="dashboard-animal-card">
                  {editingAnimal === animal.id ? (
                    <form className="dashboard-form" onSubmit={(e) => handleUpdateAnimal(e, animal.id)}>
                      <AnimalFormFields form={animalForm} setForm={setAnimalForm} />
                      <div className="dashboard-form-actions">
                        <button type="submit" className="btn btn-primary btn-sm" disabled={animalSaving}>
                          {animalSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingAnimal(null)}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="dashboard-animal-info">
                        <strong className="dashboard-animal-name">{animal.name}</strong>
                        <span className="dashboard-animal-type">{animal.animal_type}</span>
                        {animal.breed && <span className="dashboard-animal-meta">{animal.breed}</span>}
                        <span className={`dashboard-animal-active-badge ${animal.currently_active === 'no' ? 'inactive' : 'active'}`}>
                          {animal.currently_active === 'no' ? 'Inactive' : 'Active'}
                        </span>
                        {animal.sri > 0 && <span className="dashboard-animal-index">SRI {animal.sri.toFixed(1)}</span>}
                        {animal.tei > 0 && <span className="dashboard-animal-index">TEI {animal.tei.toFixed(1)}</span>}
                        {animal.buckoff_rate > 0 && <span className="dashboard-animal-index">B/O {animal.buckoff_rate.toFixed(1)}%</span>}
                        {animal.clean_run_rate > 0 && <span className="dashboard-animal-index">Clean {animal.clean_run_rate.toFixed(1)}%</span>}
                      </div>
                      <div className="dashboard-animal-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => startEditAnimal(animal)}
                        >
                          Edit
                        </button>
                        <Link to={`/animals/${animal.slug}`} className="btn btn-outline btn-sm">View</Link>
                        {deletingAnimal === animal.id ? (
                          <span className="animal-delete-confirm">
                            <span className="animal-delete-confirm-label">Delete?</span>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              disabled={deleteAnimalLoading}
                              onClick={() => handleDeleteAnimal(animal.id)}
                            >
                              {deleteAnimalLoading ? 'Deleting…' : 'Yes, Delete'}
                            </button>
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              disabled={deleteAnimalLoading}
                              onClick={() => setDeletingAnimal(null)}
                            >
                              Cancel
                            </button>
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-danger-outline btn-sm"
                            onClick={() => { setDeletingAnimal(animal.id); setEditingAnimal(null) }}
                          >
                            Delete
                          </button>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ================================================================
          TAB: POST SCORE
      ================================================================ */}
      {activeTab === 'scores' && isProducer && !isRider && (
        <div className="dashboard-content">
          <div className="dashboard-card" style={{ textAlign: 'center', padding: '2rem' }}>
            <p style={{ fontWeight: 600, marginBottom: '0.75rem' }}>
              As a Producer, use the <strong>Submit Results</strong> tab to record official results for riders.
            </p>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setActiveTab('organizer')}
            >
              Go to Submit Results
            </button>
          </div>
        </div>
      )}
      {activeTab === 'scores' && (!isProducer || isRider) && (
        <div className="dashboard-content">
          <div className="dashboard-section-header">
            <h2 className="dashboard-section-title">Post Score</h2>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => { setScoreFormOpen((v) => !v); setScoreMsg(null) }}
            >
              {scoreFormOpen ? 'Cancel' : isFreeTier ? '+ Log Result' : '+ Post New Score'}
            </button>
          </div>

          {/* Free-tier upgrade prompt banner */}
          {isFreeTier && (
            <div className="free-tier-upgrade-banner">
              {rpiPreview && rpiPreview > 0 ? (
                <>
                  Your RPI would be <strong>{Number(rpiPreview).toFixed(1)}</strong> — unlock it for <strong>$7.46/month</strong>.{' '}
                  <a href="/join-us" className="free-tier-upgrade-link">Upgrade to Competitor Pro →</a>
                </>
              ) : (
                <>
                  Log your first result to see your RPI Preview — then unlock full tracking for <strong>$7.46/month</strong>.{' '}
                  <a href="/join-us" className="free-tier-upgrade-link">Upgrade to Competitor Pro →</a>
                </>
              )}
            </div>
          )}

          {scoreMsg && (
            <p className={`dashboard-msg dashboard-msg--${scoreMsg.type}`}>{scoreMsg.text}</p>
          )}

          {scoreFormOpen && (
            <form className="dashboard-form dashboard-inline-form" onSubmit={handlePostScore}>
              <h3>New Score Entry</h3>

              {/* ---- Performance type toggle ---- */}
              <div className="dashboard-form-row">
                <label>Performance Type</label>
                <div className="score-type-toggle">
                  <button type="button" className={`score-type-btn${scoreType === 'roughstock' ? ' score-type-btn--active' : ''}`}
                    onClick={() => { setScoreType('roughstock'); setScoreForm((f) => ({ ...f, performance_type: 'roughstock', event_category: '' })) }}>
                    Roughstock
                  </button>
                  <button type="button" className={`score-type-btn${scoreType === 'timed' ? ' score-type-btn--active' : ''}`}
                    onClick={() => { setScoreType('timed'); setScoreForm((f) => ({ ...f, performance_type: 'timed', event_category: '' })) }}>
                    Timed Event
                  </button>
                </div>
              </div>

              {/* ---- STEP 1: Select or Add Event ---- */}
              <h4 className="score-form-step-title">Step 1 — Select Event</h4>

              {/* Show selected event summary if one has been chosen */}
              {scoreForm.event_name && !addingNewEvent && (
                <div className="event-selected-summary">
                  <div className="event-selected-info">
                    <strong>{scoreForm.event_name}</strong>
                    {(scoreForm.event_city || scoreForm.event_state) && (
                      <span> · {[scoreForm.event_city, scoreForm.event_state].filter(Boolean).join(', ')}</span>
                    )}
                    {scoreForm.performance_date && <span> · {scoreForm.performance_date}</span>}
                    {scoreForm.event_tier && <span className="event-tier-badge">{scoreForm.event_tier}</span>}
                  </div>
                  <button type="button" className="btn btn-secondary btn-sm"
                    onClick={() => setScoreForm((f) => ({ ...f, event_name: '', event_id: '', event_city: '', event_state: '', organization_name: '' }))}>
                    Change
                  </button>
                </div>
              )}

              {/* Search box — shown when no event is selected yet */}
              {!scoreForm.event_name && !addingNewEvent && (
                <div className="event-search-box">
                  <div className="event-search-input-row">
                    <input
                      type="text"
                      placeholder="Search by event name…"
                      value={eventSearchQuery}
                      onChange={(e) => { setEventSearchQuery(e.target.value); setEventSearchDone(false) }}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleEventSearch() } }}
                      className="event-search-input"
                    />
                    <button type="button" className="btn btn-secondary btn-sm" onClick={handleEventSearch} disabled={eventSearchLoading}>
                      {eventSearchLoading ? 'Searching…' : 'Search'}
                    </button>
                  </div>

                  {/* Search results */}
                  {eventSearchResults.length > 0 && (
                    <ul className="event-search-results">
                      {eventSearchResults.map((ev) => {
                        const m = ev.meta || ev.acf || {}
                        return (
                          <li key={ev.id} className="event-search-result" onClick={() => handleSelectEvent(ev)}>
                            <span className="event-search-result-name" dangerouslySetInnerHTML={{ __html: ev.title?.rendered }} />
                            {m.event_date && <span className="event-search-result-date"> · {m.event_date}</span>}
                            {(m.city || m.state) && <span className="event-search-result-loc"> · {[m.city, m.state].filter(Boolean).join(', ')}</span>}
                            {m.event_tier && <span className="event-tier-badge">{m.event_tier}</span>}
                          </li>
                        )
                      })}
                    </ul>
                  )}

                  {/* No results found */}
                  {eventSearchDone && eventSearchResults.length === 0 && (
                    <p className="event-search-empty">No events found.</p>
                  )}

                  {/* Add new event option */}
                  {(eventSearchDone || eventSearchQuery) && (
                    <button type="button" className="btn btn-secondary btn-sm event-add-new-btn"
                      onClick={() => { setAddingNewEvent(true); setEventSearchResults([]); setEventSearchDone(false) }}>
                      + Add New Event
                    </button>
                  )}
                </div>
              )}

              {/* Add New Event inline form */}
              {addingNewEvent && (
                <div className="event-new-form">
                  <h5 className="event-new-form-title">New Event Details</h5>
                  <div className="dashboard-form-row dashboard-form-row--half">
                    <div>
                      <label>Event Name *</label>
                      <input type="text" placeholder="e.g. Austin Spring Rodeo 2026"
                        value={newEventForm.title}
                        onChange={(e) => setNewEventForm((f) => ({ ...f, title: e.target.value }))} />
                    </div>
                    <div>
                      <label>Date *</label>
                      <input type="date"
                        value={newEventForm.event_date}
                        onChange={(e) => setNewEventForm((f) => ({ ...f, event_date: e.target.value }))} />
                    </div>
                  </div>
                  <div className="dashboard-form-row dashboard-form-row--half">
                    <div>
                      <label>City</label>
                      <input type="text" placeholder="e.g. Austin"
                        value={newEventForm.city}
                        onChange={(e) => setNewEventForm((f) => ({ ...f, city: e.target.value }))} />
                    </div>
                    <div>
                      <label>State</label>
                      <select value={newEventForm.state}
                        onChange={(e) => setNewEventForm((f) => ({ ...f, state: e.target.value }))}>
                        <option value="">Select state</option>
                        {US_STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                  <div className="dashboard-form-row dashboard-form-row--half">
                    <div>
                      <label>Event Tier</label>
                      <select value={newEventForm.event_tier}
                        onChange={(e) => setNewEventForm((f) => ({ ...f, event_tier: e.target.value }))}>
                        <option value="local">Local</option>
                        <option value="regional">Regional</option>
                        <option value="pro">Pro / Major</option>
                        <option value="championship">Championship</option>
                      </select>
                    </div>
                    <div>
                      <label>Organization <span className="optional">(optional)</span></label>
                      <input type="text" placeholder="e.g. PRCA, WPRA"
                        value={newEventForm.organization_name}
                        onChange={(e) => setNewEventForm((f) => ({ ...f, organization_name: e.target.value }))} />
                    </div>
                  </div>
                  <div className="dashboard-form-row event-new-form-actions">
                    <button type="button" className="btn btn-primary btn-sm"
                      onClick={handleConfirmNewEvent} disabled={!newEventForm.title.trim()}>
                      Use This Event
                    </button>
                    <button type="button" className="btn btn-secondary btn-sm"
                      onClick={() => { setAddingNewEvent(false); setNewEventForm({ title: '', event_date: '', city: '', state: '', event_tier: 'local', organization_name: '' }) }}>
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Performance date (always visible once event is selected) */}
              {scoreForm.event_name && (
                <div className="dashboard-form-row dashboard-form-row--half">
                  <div>
                    <label>Performance Date *</label>
                    <input type="date" value={scoreForm.performance_date}
                      onChange={(e) => setScoreForm((f) => ({ ...f, performance_date: e.target.value }))} required />
                  </div>
                  <div>
                    <label>Arena Condition</label>
                    <select value={scoreForm.arena_condition} onChange={(e) => setScoreForm((f) => ({ ...f, arena_condition: e.target.value }))}>
                      {conditionModifiers?.arena
                        ? Object.entries(conditionModifiers.arena).map(([k, v]) => <option key={k} value={k}>{v.label || k}</option>)
                        : ['smooth', 'chopped', 'muddy', 'deep', 'slick'].map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>Weather</label>
                    <select value={scoreForm.weather_condition} onChange={(e) => setScoreForm((f) => ({ ...f, weather_condition: e.target.value }))}>
                      {conditionModifiers?.weather
                        ? Object.entries(conditionModifiers.weather).map(([k, v]) => <option key={k} value={k}>{v.label || k}</option>)
                        : ['clear', 'rainy', 'windy', 'hot', 'cold'].map((c) => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                    </select>
                  </div>
                </div>
              )}

              {/* ---- ROUGHSTOCK FORM ---- */}
              {scoreType === 'roughstock' && scoreForm.event_name && (<>
                {/* Step 2: Competition details */}
                <h4 className="score-form-step-title">Step 2 — Competition Details</h4>
                <div className="dashboard-form-row dashboard-form-row--half">
                  <div>
                    <label>Event Category *</label>
                    <select value={scoreForm.event_category} onChange={(e) => setScoreForm((f) => ({ ...f, event_category: e.target.value }))} required>
                      <option value="">Select event…</option>
                      <option value="Bull Riding">Bull Riding</option>
                      <option value="Saddle Bronc">Saddle Bronc</option>
                      <option value="Bareback Riding">Bareback Riding</option>
                      <option value="Junior Bull Riding">Junior Bull Riding</option>
                      <option value="Steer Riding">Steer Riding</option>
                    </select>
                  </div>
                  <div>
                    <label>Division *</label>
                    <select value={scoreForm.division} onChange={(e) => setScoreForm((f) => ({ ...f, division: e.target.value }))}>
                      <option value="">Select division…</option>
                      {DIVISIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div>
                    <label>Go-Round *</label>
                    <select value={scoreForm.go_round} onChange={(e) => setScoreForm((f) => ({ ...f, go_round: e.target.value }))}>
                      <option value="Round 1">Round 1</option>
                      <option value="Round 2">Round 2</option>
                      <option value="Round 3">Round 3</option>
                      <option value="Short Round / Finals">Short Round / Finals</option>
                      <option value="Average">Average</option>
                    </select>
                  </div>
                  <div>
                    <label>Animal Name / ID <span className="optional">(optional)</span></label>
                    <input type="text" placeholder="e.g. Bodacious, #47" value={scoreForm.animal_name}
                      onChange={(e) => setScoreForm((f) => ({ ...f, animal_name: e.target.value }))} />
                  </div>
                  {['Bull Riding', 'Junior Bull Riding'].includes(scoreForm.event_category) && (
                    <div>
                      <label>Bull Type</label>
                      <select value={scoreForm.bull_type} onChange={(e) => setScoreForm((f) => ({ ...f, bull_type: e.target.value }))}>
                        <option value="">Select bull type…</option>
                        <option value="Adult Bull">Adult Bull</option>
                        <option value="Mini Bull">Mini Bull</option>
                      </select>
                      <span className="score-form-hint">Mini bulls are typically used in youth divisions</span>
                    </div>
                  )}
                </div>

                {/* Step 3: Did You Cover? */}
                <h4 className="score-form-step-title">Step 3 — Your Ride</h4>
                <div className="dashboard-form-row">
                  <label>Did you cover? (Complete the 8-second ride?) *</label>
                  <div className="score-cover-toggle">
                    <button
                      type="button"
                      className={`score-cover-btn score-cover-btn--yes${scoreForm.covered === true ? ' active' : ''}`}
                      onClick={() => setScoreForm((f) => ({ ...f, covered: true }))}
                    >
                      YES — I Covered
                    </button>
                    <button
                      type="button"
                      className={`score-cover-btn score-cover-btn--no${scoreForm.covered === false ? ' active' : ''}`}
                      onClick={() => setScoreForm((f) => ({ ...f, covered: false, judge1_score: '', judge2_score: '', animal_score: '' }))}
                    >
                      NO — I Did Not Cover
                    </button>
                  </div>
                </div>

                {scoreForm.covered === false && (
                  <div className="score-buckoff-notice">
                    Buckoff recorded. Final score will be set to <strong>0</strong>. No score fields needed.
                  </div>
                )}

                {scoreForm.covered === true && (
                  <div className="dashboard-form-row">
                    <div className="score-judges-grid">
                      <div className="score-judge-block">
                        <label>Judge 1 Score <span className="score-range">(0–25)</span></label>
                        <input type="number" min="0" max="25" step="0.5"
                          value={scoreForm.judge1_score}
                          onChange={(e) => setScoreForm((f) => ({ ...f, judge1_score: e.target.value }))}
                          required placeholder="0–25" />
                      </div>
                      <div className="score-judge-block">
                        <label>Judge 2 Score <span className="score-range">(0–25)</span></label>
                        <input type="number" min="0" max="25" step="0.5"
                          value={scoreForm.judge2_score}
                          onChange={(e) => setScoreForm((f) => ({ ...f, judge2_score: e.target.value }))}
                          required placeholder="0–25" />
                      </div>
                      <div className="score-judge-block">
                        <label>Animal Score <span className="score-range">(0–50)</span></label>
                        <input type="number" min="0" max="50" step="0.5"
                          value={scoreForm.animal_score}
                          onChange={(e) => setScoreForm((f) => ({ ...f, animal_score: e.target.value }))}
                          required placeholder="0–50" />
                      </div>
                      <div className="score-judge-block score-judge-block--total">
                        <label>Final Score <span className="score-range">(auto)</span></label>
                        <div className="score-final-display">
                          {scoreForm.judge1_score !== '' && scoreForm.judge2_score !== '' && scoreForm.animal_score !== ''
                            ? Number(scoreForm.judge1_score) + Number(scoreForm.judge2_score) + Number(scoreForm.animal_score)
                            : '—'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 4: Re-ride */}
                {scoreForm.covered !== null && (
                  <>
                    <h4 className="score-form-step-title">Step 4 — Re-ride</h4>
                    <div className="dashboard-form-row">
                      <label className="score-reride-label">
                        <input type="checkbox" checked={scoreForm.reride_offered}
                          onChange={(e) => setScoreForm((f) => ({
                            ...f, reride_offered: e.target.checked,
                            reride_accepted: false, reride_covered: null,
                            reride_judge1_score: '', reride_judge2_score: '', reride_animal_score: '', reride_animal_name: '',
                          }))} />
                        A re-ride was offered by the judges
                      </label>
                    </div>

                    {scoreForm.reride_offered && (
                      <div className="dashboard-form-row">
                        <label className="score-reride-label">
                          <input type="checkbox" checked={scoreForm.reride_accepted}
                            onChange={(e) => setScoreForm((f) => ({
                              ...f, reride_accepted: e.target.checked,
                              reride_covered: null,
                              reride_judge1_score: '', reride_judge2_score: '', reride_animal_score: '',
                            }))} />
                          I accepted the re-ride (new score replaces original for RPI)
                        </label>
                      </div>
                    )}

                    {scoreForm.reride_offered && scoreForm.reride_accepted && (<>
                      <div className="score-reride-block">
                        <p className="score-reride-note">Enter your re-ride result below. This score will be used for your RPI.</p>
                        <div className="dashboard-form-row">
                          <label>Re-ride Animal Name / ID <span className="optional">(optional)</span></label>
                          <input type="text" placeholder="Different animal name/ID" value={scoreForm.reride_animal_name}
                            onChange={(e) => setScoreForm((f) => ({ ...f, reride_animal_name: e.target.value }))} />
                        </div>
                        <div className="dashboard-form-row">
                          <label>Did you cover on the re-ride? *</label>
                          <div className="score-cover-toggle">
                            <button type="button"
                              className={`score-cover-btn score-cover-btn--yes${scoreForm.reride_covered === true ? ' active' : ''}`}
                              onClick={() => setScoreForm((f) => ({ ...f, reride_covered: true }))}>
                              YES — I Covered
                            </button>
                            <button type="button"
                              className={`score-cover-btn score-cover-btn--no${scoreForm.reride_covered === false ? ' active' : ''}`}
                              onClick={() => setScoreForm((f) => ({ ...f, reride_covered: false, reride_judge1_score: '', reride_judge2_score: '', reride_animal_score: '' }))}>
                              NO — I Did Not Cover
                            </button>
                          </div>
                        </div>
                        {scoreForm.reride_covered === false && (
                          <div className="score-buckoff-notice">Re-ride buckoff — final score 0.</div>
                        )}
                        {scoreForm.reride_covered === true && (
                          <div className="score-judges-grid">
                            <div className="score-judge-block">
                              <label>Judge 1 <span className="score-range">(0–25)</span></label>
                              <input type="number" min="0" max="25" step="0.5" value={scoreForm.reride_judge1_score}
                                onChange={(e) => setScoreForm((f) => ({ ...f, reride_judge1_score: e.target.value }))} required placeholder="0–25" />
                            </div>
                            <div className="score-judge-block">
                              <label>Judge 2 <span className="score-range">(0–25)</span></label>
                              <input type="number" min="0" max="25" step="0.5" value={scoreForm.reride_judge2_score}
                                onChange={(e) => setScoreForm((f) => ({ ...f, reride_judge2_score: e.target.value }))} required placeholder="0–25" />
                            </div>
                            <div className="score-judge-block">
                              <label>Animal Score <span className="score-range">(0–50)</span></label>
                              <input type="number" min="0" max="50" step="0.5" value={scoreForm.reride_animal_score}
                                onChange={(e) => setScoreForm((f) => ({ ...f, reride_animal_score: e.target.value }))} required placeholder="0–50" />
                            </div>
                            <div className="score-judge-block score-judge-block--total">
                              <label>Re-ride Final <span className="score-range">(auto)</span></label>
                              <div className="score-final-display">
                                {scoreForm.reride_judge1_score !== '' && scoreForm.reride_judge2_score !== '' && scoreForm.reride_animal_score !== ''
                                  ? Number(scoreForm.reride_judge1_score) + Number(scoreForm.reride_judge2_score) + Number(scoreForm.reride_animal_score)
                                  : '—'}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    </>)}
                  </>
                )}

                {/* Step 5: Placement & payout */}
                <h4 className="score-form-step-title">Step 5 — Placement &amp; Payout</h4>
                <div className="dashboard-form-row dashboard-form-row--half">
                  <div>
                    <label>Placement <span className="optional">(optional — where you finished)</span></label>
                    <input type="number" min="1" placeholder="e.g. 1, 2, 3…" value={scoreForm.placement}
                      onChange={(e) => setScoreForm((f) => ({ ...f, placement: e.target.value }))} />
                  </div>
                  <div>
                    <label>Payout / Prize Money <span className="optional">(private — only you see this)</span></label>
                    <input type="text" inputMode="decimal" placeholder="$ amount won" value={scoreForm.payout}
                      onChange={(e) => setScoreForm((f) => ({ ...f, payout: e.target.value }))} />
                  </div>
                </div>
              </>)}

              {/* ---- TIMED EVENT FORM ---- */}
              {scoreType === 'timed' && scoreForm.event_name && (() => {
                const isTeamRoping = TEAM_ROPING_EVENTS.includes(scoreForm.event_category)
                const penVal       = PENALTY_VALUE[scoreForm.event_category] ?? 5
                const numPen       = Number(scoreForm.num_penalties) || 0
                const penSecs      = numPen * penVal
                const rawTime      = Number(scoreForm.raw_run_time) || 0
                const finalTime    = scoreForm.got_time && rawTime > 0 ? (rawTime + penSecs) : null
                const cleanRun     = scoreForm.got_time && numPen === 0
                return (<>
                  {/* Step 2: Competition details */}
                  <h4 className="score-form-step-title">Step 2 — Competition Details</h4>
                  <div className="dashboard-form-row dashboard-form-row--half">
                    <div>
                      <label>Event Category *</label>
                      <select value={scoreForm.event_category}
                        onChange={(e) => setScoreForm((f) => ({ ...f, event_category: e.target.value, role: '', got_time: null, raw_run_time: '', num_penalties: '0', timed_division: '' }))}
                        required>
                        <option value="">Select event…</option>
                        {TIMED_EVENTS.map((ev) => <option key={ev} value={ev}>{ev}</option>)}
                      </select>
                    </div>
                    <div>
                      <label>Division *</label>
                      <select value={scoreForm.timed_division}
                        onChange={(e) => setScoreForm((f) => ({ ...f, timed_division: e.target.value }))}>
                        <option value="">Select division…</option>
                        {getDivisionsForEvent(scoreForm.event_category).map((d) => <option key={d} value={d}>{d}</option>)}
                      </select>
                      {['Barrel Racing', 'Barrel Racing (Youth)', 'Pole Bending'].includes(scoreForm.event_category) && (
                        <p className="form-hint">1D = fastest; 5D = slowest. Set by the event based on your run time.</p>
                      )}
                      {scoreForm.event_category === 'Goat Tying' && (
                        <p className="form-hint">Youth event — select your age division. 5-sec penalty if horse crosses the rope.</p>
                      )}
                      {['Team Roping – Header', 'Team Roping – Heeler'].includes(scoreForm.event_category) && (
                        <p className="form-hint">Combined header + heeler handicap number. "Slide" = raised cap handicap bracket (WSTR format).</p>
                      )}
                    </div>
                    <div>
                      <label>Go-Round *</label>
                      <select value={scoreForm.timed_go_round}
                        onChange={(e) => setScoreForm((f) => ({ ...f, timed_go_round: e.target.value }))}>
                        <option value="Round 1">Round 1</option>
                        <option value="Round 2">Round 2</option>
                        <option value="Round 3">Round 3</option>
                        <option value="Short Round / Finals">Short Round / Finals</option>
                        <option value="Average">Average</option>
                      </select>
                    </div>
                    <div>
                      <label>Horse / Animal Name <span className="optional">(optional)</span></label>
                      <input type="text" placeholder="e.g. Trigger, #22" value={scoreForm.horse_name}
                        onChange={(e) => setScoreForm((f) => ({ ...f, horse_name: e.target.value }))} />
                    </div>
                  </div>

                  {/* Team Roping: role + partner */}
                  {isTeamRoping && (
                    <div className="timed-teamroping-block">
                      <p className="timed-teamroping-note">
                        Team Roping — two separate records are created and linked together.
                      </p>
                      <div className="dashboard-form-row dashboard-form-row--half">
                        <div>
                          <label>Your Role *</label>
                          <div className="score-cover-toggle">
                            <button type="button"
                              className={`score-cover-btn${scoreForm.role === 'header' ? ' active score-cover-btn--yes' : ' score-cover-btn--yes'}`}
                              onClick={() => setScoreForm((f) => ({ ...f, role: 'header' }))}>
                              Header
                            </button>
                            <button type="button"
                              className={`score-cover-btn${scoreForm.role === 'heeler' ? ' active score-cover-btn--no' : ' score-cover-btn--no'}`}
                              onClick={() => setScoreForm((f) => ({ ...f, role: 'heeler' }))}>
                              Heeler
                            </button>
                          </div>
                        </div>
                        <div>
                          <label>Partner Name / RIN ID *</label>
                          <input type="text" placeholder="Partner's name or RIN ID" value={scoreForm.partner_name}
                            onChange={(e) => setScoreForm((f) => ({ ...f, partner_name: e.target.value }))} />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Did you receive an official time? */}
                  <h4 className="score-form-step-title">Step 3 — Your Run</h4>
                  <div className="dashboard-form-row">
                    <label>Did you receive an official time? *</label>
                    <div className="score-cover-toggle">
                      <button type="button"
                        className={`score-cover-btn score-cover-btn--yes${scoreForm.got_time === true ? ' active' : ''}`}
                        onClick={() => setScoreForm((f) => ({ ...f, got_time: true }))}>
                        YES — I Received a Time
                      </button>
                      <button type="button"
                        className={`score-cover-btn score-cover-btn--no${scoreForm.got_time === false ? ' active' : ''}`}
                        onClick={() => setScoreForm((f) => ({ ...f, got_time: false, raw_run_time: '', num_penalties: '0' }))}>
                        NO — No Time / DQ
                      </button>
                    </div>
                  </div>

                  {scoreForm.got_time === false && (
                    <div className="score-buckoff-notice">
                      No Time recorded. This run will score 0 for RPI purposes. No time entry needed.
                    </div>
                  )}

                  {scoreForm.got_time === true && (
                    <>
                      <div className="timed-time-grid">
                        {/* Raw run time */}
                        <div className="timed-time-block">
                          <label>Raw Run Time (sec) *<span className="score-range"> e.g. 17.43</span></label>
                          <input type="number" min="0" step="0.01" placeholder="0.00"
                            value={scoreForm.raw_run_time}
                            onChange={(e) => setScoreForm((f) => ({ ...f, raw_run_time: e.target.value }))}
                            required />
                        </div>

                        {/* Number of penalties */}
                        <div className="timed-time-block">
                          <label>
                            No. of Penalties *
                            {penVal > 0
                              ? <span className="score-range"> ({penVal}s each)</span>
                              : <span className="score-range"> (no penalty secs)</span>}
                          </label>
                          <input type="number" min="0" step="1" placeholder="0"
                            value={scoreForm.num_penalties}
                            onChange={(e) => setScoreForm((f) => ({ ...f, num_penalties: e.target.value }))}
                            required />
                        </div>

                        {/* Penalty seconds — auto */}
                        <div className="timed-time-block timed-time-block--auto">
                          <label>Penalty Seconds<span className="score-range"> (auto)</span></label>
                          <div className="timed-auto-display">{penSecs > 0 ? `+${penSecs.toFixed(2)}s` : '0.00s'}</div>
                        </div>

                        {/* Final time — auto */}
                        <div className="timed-time-block timed-time-block--auto timed-time-block--final">
                          <label>Final Time<span className="score-range"> (auto)</span></label>
                          <div className="timed-final-display">
                            {finalTime != null && finalTime > 0 ? `${finalTime.toFixed(2)}s` : '—'}
                          </div>
                        </div>
                      </div>

                      {/* Clean run indicator */}
                      <div className={`timed-cleanrun-badge ${cleanRun ? 'clean' : 'penalty'}`}>
                        {cleanRun ? '✓ Clean Run' : `Penalty Run — ${numPen} infraction${numPen !== 1 ? 's' : ''}`}
                      </div>
                    </>
                  )}

                  {/* Step 4: Placement & Payout */}
                  {scoreForm.got_time !== null && (
                    <>
                      <h4 className="score-form-step-title">Step 4 — Placement &amp; Payout</h4>
                      <div className="dashboard-form-row dashboard-form-row--half">
                        <div>
                          <label>Placement <span className="optional">(optional — where you finished)</span></label>
                          <input type="number" min="1" placeholder="e.g. 1, 2, 3…" value={scoreForm.placement}
                            onChange={(e) => setScoreForm((f) => ({ ...f, placement: e.target.value }))} />
                        </div>
                        <div>
                          <label>Payout / Prize Money <span className="optional">(private — only you see this)</span></label>
                          <input type="text" inputMode="decimal" placeholder="$ amount won" value={scoreForm.payout}
                            onChange={(e) => setScoreForm((f) => ({ ...f, payout: e.target.value }))} />
                        </div>
                      </div>
                    </>
                  )}
                </>)
              })()}

              {scoreForm.event_name && (
                <div className="dashboard-form-actions">
                  <button type="submit" className="btn btn-primary" disabled={scoreSaving}>{scoreSaving ? 'Submitting…' : 'Submit Score'}</button>
                  <button type="button" className="btn btn-secondary" onClick={() => setScoreFormOpen(false)}>Cancel</button>
                </div>
              )}
              {!scoreForm.event_name && (
                <div className="dashboard-form-actions">
                  <button type="button" className="btn btn-secondary" onClick={() => setScoreFormOpen(false)}>Cancel</button>
                </div>
              )}
            </form>
          )}

          {scoresLoading && <p className="loading">Loading score history\u2026</p>}
          {!scoresLoading && scores.length === 0 && (
            <p className="placeholder">No results yet. Use the button above to log your first score.</p>
          )}
          {!scoresLoading && scores.length > 0 && (
            <div className="score-history">
              <h3 style={{ marginBottom: '0.75rem', fontSize: '1rem', color: 'var(--rpn-text)' }}>Score History</h3>
              <div className="rpn-card" style={{ overflowX: 'auto' }}>
                <table className="event-results-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Category</th>
                      <th>Event / Round</th>
                      <th>Animal / Horse</th>
                      <th>Result</th>
                      <th>Score / Time</th>
                      <th>Place</th>
                      <th>RPI</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {scores.map((s) => {
                      const isRS = s.performance_type === 'roughstock'
                      const isT  = s.performance_type === 'timed'
                      const isFlagging = flaggingId === s.id
                      return (
                        <React.Fragment key={s.id}>
                          <tr className={s.is_reride ? 'score-row--reride' : ''}>
                            <td>{s.performance_date || '—'}</td>
                            <td>{s.event_category || s.performance_type || '—'}</td>
                            <td>
                              {s.event_name || '—'}
                              {s.go_round ? <span className="score-go-round"> · {s.go_round}</span> : null}
                              {isT && s.role ? <span className="score-go-round"> · {s.role}</span> : null}
                              {s.verification_status === 'official' && (
                                <span className="verified-result-badge" title="Verified by organizer">&#10003; Verified</span>
                              )}
                            </td>
                            <td>{isRS ? (s.animal_name || '—') : (isT ? (s.horse_name || '—') : '—')}</td>
                            <td>
                              {isRS && (
                                <span className={`score-covered-badge ${s.qualified_ride ? 'covered' : 'buckoff'}`}>
                                  {s.qualified_ride ? 'Covered' : 'Buckoff'}
                                </span>
                              )}
                              {isT && (
                                s.no_time
                                  ? <span className="score-covered-badge buckoff">No Time</span>
                                  : <span className={`score-covered-badge ${s.clean_run ? 'covered' : 'penalty'}`}>
                                      {s.clean_run ? 'Clean Run' : 'Penalty Run'}
                                    </span>
                              )}
                            </td>
                            <td>
                              {isRS && (
                                s.final_score > 0
                                  ? <><strong>{s.final_score}</strong>{s.qualified_ride && s.judge1_score > 0 && <span className="score-breakdown"> ({s.judge1_score}+{s.judge2_score}+{s.animal_score})</span>}</>
                                  : <span className="score-zero">0</span>
                              )}
                              {isT && (
                                s.no_time
                                  ? <span className="score-zero">No Time</span>
                                  : s.final_time != null
                                    ? <><strong>{Number(s.final_time).toFixed(2)}s</strong>{s.num_penalties > 0 && <span className="score-breakdown"> (+{Number(s.penalty_seconds).toFixed(2)}s pen)</span>}</>
                                    : '—'
                              )}
                            </td>
                            <td>{s.placement || '—'}</td>
                            <td>
                              {s.is_reride
                                ? <span className="score-reride-tag">Re-ride</span>
                                : s.use_for_rpi ? '✓' : <span className="score-replaced-tag">Replaced</span>}
                            </td>
                            <td>
                              {s.disputed ? (
                                <span className="flag-pending-tag">Disputed</span>
                              ) : (
                                <button
                                  type="button"
                                  className="btn btn-sm flag-btn"
                                  onClick={() => { setFlaggingId(isFlagging ? null : s.id); setFlagReason(''); setFlagMsg(null) }}
                                  title="Flag this result as incorrect"
                                >
                                  {isFlagging ? 'Cancel' : '⚑ Flag'}
                                </button>
                              )}
                            </td>
                          </tr>
                          {isFlagging && (
                            <tr className="flag-inline-row">
                              <td colSpan={9}>
                                <div className="flag-inline-form">
                                  <p className="flag-inline-label">Describe the error in this result:</p>
                                  <textarea
                                    className="flag-inline-textarea"
                                    rows={2}
                                    value={flagReason}
                                    onChange={(e) => setFlagReason(e.target.value)}
                                    placeholder="e.g. Score was recorded incorrectly — I scored 87, not 82."
                                  />
                                  {flagMsg && <p className={`dashboard-msg dashboard-msg--${flagMsg.type}`}>{flagMsg.text}</p>}
                                  <button
                                    type="button"
                                    className="btn btn-danger btn-sm"
                                    disabled={flagSaving || !flagReason.trim()}
                                    onClick={async () => {
                                      setFlagSaving(true); setFlagMsg(null)
                                      try {
                                        await flagResult(token, s.id, flagReason)
                                        setFlagMsg({ type: 'success', text: 'Result flagged. An admin will review your dispute.' })
                                        setFlaggingId(null); setFlagReason('')
                                        setScores((prev) => prev.map((row) => row.id === s.id ? { ...row, disputed: true } : row))
                                      } catch (e) {
                                        setFlagMsg({ type: 'error', text: e.message || 'Failed to flag result.' })
                                      } finally {
                                        setFlagSaving(false)
                                      }
                                    }}
                                  >
                                    {flagSaving ? 'Submitting…' : 'Submit Dispute'}
                                  </button>
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================
          TAB: MY EVENTS (producers only)
      ================================================================ */}
      {activeTab === 'events' && isProducer && (
        <div className="dashboard-content">
          <div className="dashboard-section-header">
            <h2 className="dashboard-section-title">My Events</h2>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => { setAddEventOpen((v) => !v); setEditingEvent(null); setEventMsg(null) }}
            >
              {addEventOpen ? 'Cancel' : '+ Add Event'}
            </button>
          </div>

          {eventMsg && (
            <p className={`dashboard-msg dashboard-msg--${eventMsg.type}`}>{eventMsg.text}</p>
          )}

          {/* Event limit notice */}
          {(() => {
            const currentYear = new Date().getFullYear()
            const eventsThisYear = events.filter((ev) => ev.event_date?.startsWith(String(currentYear)) || true).length
            const limit = tier === 'enterprise' ? null : 50
            return (
              <p className="animal-limit-notice">
                {limit === null
                  ? `${events.length} event${events.length !== 1 ? 's' : ''} · Unlimited (Enterprise)`
                  : `${events.length} event${events.length !== 1 ? 's' : ''} created · ${limit} per year limit`}
                {limit !== null && events.length >= limit && (
                  <> — <a href="/join-us" className="rpi-preview-link">Upgrade to Enterprise for unlimited events</a></>
                )}
              </p>
            )
          })()}

          {/* Event Analytics Dashboard — Organizer+ */}
          {tierGte(tier, 'organizer') && (
            <div className="dashboard-card event-analytics-card" style={{ marginBottom: '1.5rem' }}>
              <h3>Event Analytics Dashboard</h3>
              {eventAnalytics == null ? (
                <p className="placeholder">Loading analytics…</p>
              ) : (
                <>
                  <div className="dashboard-stats-grid">
                    <div className="dashboard-stat">
                      <span className="dashboard-stat-label">Events This Year</span>
                      <span className="dashboard-stat-val dashboard-stat-val--large">{eventAnalytics.total_events_year ?? 0}/{eventAnalytics.event_limit ?? '∞'}</span>
                    </div>
                    <div className="dashboard-stat">
                      <span className="dashboard-stat-label">Total Results Submitted</span>
                      <span className="dashboard-stat-val dashboard-stat-val--large">{eventAnalytics.total_performances ?? 0}</span>
                    </div>
                    <div className="dashboard-stat">
                      <span className="dashboard-stat-label">Unique Riders</span>
                      <span className="dashboard-stat-val">{eventAnalytics.unique_riders ?? 0}</span>
                    </div>
                    <div className="dashboard-stat">
                      <span className="dashboard-stat-label">Avg Participants / Event</span>
                      <span className="dashboard-stat-val">{eventAnalytics.avg_participants ?? 0}</span>
                    </div>
                  </div>
                  {eventAnalytics.top_performers?.length > 0 && (
                    <div style={{ marginTop: '1rem' }}>
                      <p style={{ fontWeight: 600, fontSize: '0.85rem', marginBottom: '0.5rem' }}>Top Performers (by avg weighted score)</p>
                      <table className="org-results-table" style={{ width: '100%' }}>
                        <thead><tr><th>Rank</th><th>Rider</th><th>Avg Score</th><th>Appearances</th></tr></thead>
                        <tbody>
                          {eventAnalytics.top_performers.map((p, i) => (
                            <tr key={p.rider_id}>
                              <td>#{i + 1}</td>
                              <td>{p.rider_name}</td>
                              <td>{p.avg_score}</td>
                              <td>{p.appearances}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Enterprise Data Export — Enterprise only */}
          {tier === 'enterprise' && (
            <div className="dashboard-card enterprise-export-card" style={{ marginBottom: '1.5rem', borderLeft: '3px solid var(--rpn-navy)' }}>
              <h3>Data Export</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--rpn-text-muted)', margin: '0 0 1rem' }}>
                Download all results across your events as a CSV file for media, sponsorship, or broadcast use.
              </p>
              {exportMsg && <p className={`dashboard-msg dashboard-msg--${exportMsg.type}`}>{exportMsg.text}</p>}
              <button
                className="btn btn-primary btn-sm"
                disabled={exportLoading}
                onClick={async () => {
                  setExportLoading(true)
                  setExportMsg(null)
                  try {
                    const data = await exportResults(token)
                    if (!data?.rows?.length) {
                      setExportMsg({ type: 'error', text: 'No results to export yet.' })
                      return
                    }
                    // Convert rows to CSV and trigger download
                    const cols = Object.keys(data.rows[0])
                    const csv = [cols.join(','), ...data.rows.map((r) =>
                      cols.map((c) => `"${String(r[c] ?? '').replace(/"/g, '""')}"`).join(',')
                    )].join('\n')
                    const blob = new Blob([csv], { type: 'text/csv' })
                    const url  = URL.createObjectURL(blob)
                    const a    = document.createElement('a')
                    a.href = url; a.download = `rin-results-${Date.now()}.csv`; a.click()
                    URL.revokeObjectURL(url)
                    setExportMsg({ type: 'success', text: `Exported ${data.count} results.` })
                  } catch (err) {
                    setExportMsg({ type: 'error', text: err.message || 'Export failed.' })
                  } finally {
                    setExportLoading(false)
                  }
                }}
              >
                {exportLoading ? 'Exporting…' : 'Download All Results (CSV)'}
              </button>
            </div>
          )}

          {/* Add event form */}
          {addEventOpen && (
            <form className="dashboard-form dashboard-inline-form" onSubmit={handleAddEvent}>
              <h3>Add New Event</h3>
              <EventFormFields form={eventForm} setForm={setEventForm} />
              <div className="dashboard-form-actions">
                <button type="submit" className="btn btn-primary" disabled={eventSaving}>
                  {eventSaving ? 'Submitting...' : 'Submit Event for Review'}
                </button>
                <button type="button" className="btn btn-secondary" onClick={() => setAddEventOpen(false)}>Cancel</button>
              </div>
            </form>
          )}

          {eventsLoading && <p className="loading">Loading events...</p>}

          {!eventsLoading && events.length === 0 && (
            <p className="placeholder">No events yet. Add your first event above.</p>
          )}

          {!eventsLoading && events.length > 0 && (
            <div className="dashboard-events-list">
              {events.map((ev) => (
                <div key={ev.id} className="dashboard-event-card">
                  {editingEvent === ev.id ? (
                    <form className="dashboard-form" onSubmit={(e) => handleUpdateEvent(e, ev.id)}>
                      <EventFormFields form={eventForm} setForm={setEventForm} />
                      <div className="dashboard-form-actions">
                        <button type="submit" className="btn btn-primary btn-sm" disabled={eventSaving}>
                          {eventSaving ? 'Saving...' : 'Save'}
                        </button>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => setEditingEvent(null)}>Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="dashboard-event-info">
                        <strong className="dashboard-event-title">{ev.title}</strong>
                        {ev.verified_event && <span className="verified-event-badge">✓ Verified Event</span>}
                        {ev.event_date && <span className="dashboard-event-meta">{ev.event_date}</span>}
                        {ev.state && <span className="dashboard-event-meta">{[ev.city, ev.state].filter(Boolean).join(', ')}</span>}
                        <span className={`dashboard-event-status dashboard-event-status--${ev.status}`}>{ev.status}</span>
                      </div>
                      <div className="dashboard-event-actions">
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => startEditEvent(ev)}
                        >
                          Edit
                        </button>
                        {ev.status === 'publish' && (
                          <Link to={`/events/${ev.slug}`} className="btn btn-outline btn-sm">View</Link>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── Season & Past Event Results ─────────────────────────────── */}
          {!eventsLoading && events.length > 0 && (
            <div className="dashboard-card" style={{ marginTop: '2rem' }}>
              <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Season &amp; Past Event Results</h3>
              <p style={{ color: 'var(--rpn-text-muted)', fontSize: '0.875rem', marginBottom: '1rem' }}>
                Select one of your events to see auto-calculated results from rider submissions.
              </p>
              <div style={{ marginBottom: '1rem' }}>
                <select
                  className="score-form-select"
                  value={selectedResultsEventId}
                  onChange={(e) => {
                    const id = e.target.value
                    setSelectedResultsEventId(id)
                    setEventResultsData(null)
                    if (!id) return
                    setEventResultsLoading(true)
                    getEventResults(Number(id))
                      .then(setEventResultsData)
                      .catch(() => setEventResultsData(null))
                      .finally(() => setEventResultsLoading(false))
                  }}
                  style={{ minWidth: '280px' }}
                >
                  <option value="">— Select an event —</option>
                  {events.map((ev) => (
                    <option key={ev.id} value={ev.id}>{ev.title}{ev.event_date ? ` (${ev.event_date})` : ''}</option>
                  ))}
                </select>
              </div>

              {eventResultsLoading && <p className="loading" style={{ marginTop: '0.5rem' }}>Loading results...</p>}

              {!eventResultsLoading && eventResultsData && (
                <>
                  {eventResultsData.total_performances > 0 && (
                    <p style={{ fontSize: '0.8rem', color: 'var(--rpn-text-muted)', marginBottom: '0.75rem' }}>
                      {eventResultsData.total_performances} submitted result{eventResultsData.total_performances !== 1 ? 's' : ''} · auto-calculated from rider submissions
                    </p>
                  )}
                  <ProducerEventResultsView data={eventResultsData} />
                </>
              )}

              {!eventResultsLoading && selectedResultsEventId && eventResultsData && eventResultsData.total_performances === 0 && (
                <p className="placeholder" style={{ marginTop: '0.5rem' }}>No results submitted for this event yet.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ================================================================
          TAB: ORGANIZER — Submit Results (producer only)
      ================================================================ */}
      {activeTab === 'organizer' && isProducer && (
        <div className="dashboard-content">
          <h2 className="dashboard-section-title">Submit Official Results</h2>
          <p style={{ color: 'var(--rpn-text-muted)', marginBottom: '1.5rem' }}>
            Results you submit here are marked <strong>Official</strong> (1.05× RPI multiplier) and will automatically notify the rider by email.
          </p>

          {/* ---- Single Result Form ---- */}
          <div className="dashboard-card" style={{ marginBottom: '2rem' }}>
            <h3 style={{ marginTop: 0 }}>Submit Single Result</h3>
            <form onSubmit={async (e) => {
              e.preventDefault()
              setOrgSaving(true); setOrgMsg(null)
              try {
                const res = await submitOrganizerResult(token, {
                  ...orgForm,
                  rider_id: orgForm.rider_id ? Number(orgForm.rider_id) : undefined,
                  judge1_score: Number(orgForm.judge1_score) || 0,
                  judge2_score: Number(orgForm.judge2_score) || 0,
                  animal_score: Number(orgForm.animal_score) || 0,
                  raw_run_time: Number(orgForm.raw_run_time) || 0,
                  field_best_time: Number(orgForm.field_best_time) || 0,
                  num_penalties: Number(orgForm.num_penalties) || 0,
                  placement: orgForm.placement !== '' ? Number(orgForm.placement) : undefined,
                  payout: orgForm.payout !== '' ? Number(orgForm.payout) : undefined,
                })
                setOrgMsg({ type: 'success', text: `Result submitted! Performance ID: ${res.performance_id}` })
                setOrgForm(f => ({ ...f, rider_name: '', rider_id: '', division: '', judge1_score: '', judge2_score: '', animal_score: '', animal_name: '', bull_type: '', raw_run_time: '', placement: '', payout: '' }))
              } catch (err) {
                setOrgMsg({ type: 'error', text: err.message })
              } finally {
                setOrgSaving(false)
              }
            }}>
              <div className="score-form-grid">
                <div className="score-form-row">
                  <label>Rider Name *
                    <input type="text" value={orgForm.rider_name} onChange={e => setOrgForm(f => ({ ...f, rider_name: e.target.value }))} placeholder="Search by name" required={!orgForm.rider_id} />
                  </label>
                  <label>Rider ID (optional override)
                    <input type="number" value={orgForm.rider_id} onChange={e => setOrgForm(f => ({ ...f, rider_id: e.target.value }))} placeholder="WP post ID" />
                  </label>
                </div>
                <div className="score-form-row">
                  <label>Performance Type *
                    <select value={orgForm.performance_type} onChange={e => setOrgForm(f => ({ ...f, performance_type: e.target.value, event_category: e.target.value === 'roughstock' ? 'Bull Riding' : 'Barrel Racing', division: '' }))}>
                      <option value="roughstock">Roughstock</option>
                      <option value="timed">Timed</option>
                    </select>
                  </label>
                  <label>Event Category *
                    <select value={orgForm.event_category} onChange={e => setOrgForm(f => ({ ...f, event_category: e.target.value, division: '' }))}>
                      {DISCIPLINES.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </label>
                  <label>Division *
                    <select value={orgForm.division} onChange={e => setOrgForm(f => ({ ...f, division: e.target.value }))} required>
                      <option value="">Select division…</option>
                      {getDivisionsForEvent(orgForm.event_category).map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                    {['Barrel Racing', 'Barrel Racing (Youth)', 'Pole Bending'].includes(orgForm.event_category) && (
                      <span className="score-form-hint">1D = fastest, 5D = slowest</span>
                    )}
                    {orgForm.event_category === 'Goat Tying' && (
                      <span className="score-form-hint">Youth event — select age division. 5-sec penalty if horse crosses rope.</span>
                    )}
                    {['Team Roping – Header', 'Team Roping – Heeler'].includes(orgForm.event_category) && (
                      <span className="score-form-hint">Combined header + heeler handicap number. "Slide" = raised cap handicap bracket (WSTR format).</span>
                    )}
                  </label>
                </div>
                <div className="score-form-row">
                  <label>Performance Date *
                    <input type="date" value={orgForm.performance_date} onChange={e => setOrgForm(f => ({ ...f, performance_date: e.target.value }))} required />
                  </label>
                  <label>Event Name
                    <input type="text" value={orgForm.event_name} onChange={e => setOrgForm(f => ({ ...f, event_name: e.target.value }))} placeholder="Event name" />
                  </label>
                </div>
                <div className="score-form-row">
                  <label>Go Round
                    <input type="text" value={orgForm.go_round} onChange={e => setOrgForm(f => ({ ...f, go_round: e.target.value }))} />
                  </label>
                  <label>Event Tier
                    <select value={orgForm.event_tier} onChange={e => setOrgForm(f => ({ ...f, event_tier: e.target.value }))}>
                      {['local','regional','pro','championship'].map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase()+t.slice(1)}</option>)}
                    </select>
                  </label>
                </div>

                {orgForm.performance_type === 'roughstock' && (
                  <>
                    <div className="score-form-row">
                      <label>Animal Name
                        <input type="text" value={orgForm.animal_name} onChange={e => setOrgForm(f => ({ ...f, animal_name: e.target.value }))} />
                      </label>
                      <label>Covered?
                        <select value={orgForm.covered ? 'yes' : 'no'} onChange={e => setOrgForm(f => ({ ...f, covered: e.target.value === 'yes' }))}>
                          <option value="yes">Yes — Covered</option>
                          <option value="no">No — Buckoff</option>
                        </select>
                      </label>
                    </div>
                    {['Bull Riding', 'Junior Bull Riding'].includes(orgForm.event_category) && (
                      <div className="score-form-row">
                        <label>Bull Type
                          <select value={orgForm.bull_type} onChange={e => setOrgForm(f => ({ ...f, bull_type: e.target.value }))}>
                            <option value="">Select bull type…</option>
                            <option value="Adult Bull">Adult Bull</option>
                            <option value="Mini Bull">Mini Bull</option>
                          </select>
                        </label>
                        <span className="score-form-hint" style={{ alignSelf: 'flex-end', marginBottom: '0.5rem' }}>Mini bulls are typically used in youth divisions</span>
                      </div>
                    )}
                    {orgForm.covered && (
                      <div className="score-form-row">
                        <label>Judge 1 (0–25)<input type="number" min="0" max="25" value={orgForm.judge1_score} onChange={e => setOrgForm(f => ({ ...f, judge1_score: e.target.value }))} /></label>
                        <label>Judge 2 (0–25)<input type="number" min="0" max="25" value={orgForm.judge2_score} onChange={e => setOrgForm(f => ({ ...f, judge2_score: e.target.value }))} /></label>
                        <label>Animal (0–50)<input type="number" min="0" max="50" value={orgForm.animal_score} onChange={e => setOrgForm(f => ({ ...f, animal_score: e.target.value }))} /></label>
                      </div>
                    )}
                  </>
                )}

                {orgForm.performance_type === 'timed' && (
                  <>
                    <div className="score-form-row">
                      <label>Horse Name
                        <input type="text" value={orgForm.horse_name} onChange={e => setOrgForm(f => ({ ...f, horse_name: e.target.value }))} />
                      </label>
                      <label>No Time?
                        <select value={orgForm.no_time ? 'yes' : 'no'} onChange={e => setOrgForm(f => ({ ...f, no_time: e.target.value === 'yes' }))}>
                          <option value="no">No — Got Time</option>
                          <option value="yes">Yes — No Time</option>
                        </select>
                      </label>
                    </div>
                    {!orgForm.no_time && (
                      <div className="score-form-row">
                        <label>Raw Run Time (s)<input type="number" step="0.001" value={orgForm.raw_run_time} onChange={e => setOrgForm(f => ({ ...f, raw_run_time: e.target.value }))} /></label>
                        <label>Field Best Time (s)<input type="number" step="0.001" value={orgForm.field_best_time} onChange={e => setOrgForm(f => ({ ...f, field_best_time: e.target.value }))} /></label>
                        <label>Penalties<input type="number" min="0" value={orgForm.num_penalties} onChange={e => setOrgForm(f => ({ ...f, num_penalties: e.target.value }))} /></label>
                      </div>
                    )}
                  </>
                )}

                <div className="score-form-row">
                  <label>Placement
                    <input type="number" min="1" value={orgForm.placement} onChange={e => setOrgForm(f => ({ ...f, placement: e.target.value }))} placeholder="1, 2, 3…" />
                  </label>
                  <label>Payout ($)
                    <input type="text" inputMode="decimal" value={orgForm.payout} onChange={e => setOrgForm(f => ({ ...f, payout: e.target.value }))} placeholder="0.00" />
                  </label>
                </div>
              </div>

              {orgMsg && (
                <div className={`submit-result-banner submit-result-banner--${orgMsg.type}`}>
                  {orgMsg.type === 'success' && <span className="submit-result-icon">&#10003;</span>}
                  {orgMsg.type === 'error' && <span className="submit-result-icon">&#10007;</span>}
                  <span>{orgMsg.text}</span>
                </div>
              )}
              <button type="submit" className="btn btn-primary" disabled={orgSaving} style={{ marginTop: '1rem' }}>
                {orgSaving ? 'Submitting…' : 'Submit Official Result'}
              </button>
            </form>
          </div>

          {/* ---- CSV Bulk Upload ---- */}
          <div className="dashboard-card">
            <h3 style={{ marginTop: 0 }}>Bulk CSV Upload</h3>
            <p style={{ color: 'var(--rpn-text-muted)', fontSize: '0.9rem', marginBottom: '0.75rem' }}>
              Upload a CSV file to submit multiple results at once. Required columns: <code>rider_name</code>, <code>performance_type</code>, <code>event_category</code>, <code>performance_date</code>. For roughstock: <code>covered</code>, <code>judge1_score</code>, <code>judge2_score</code>, <code>animal_score</code>. For timed: <code>raw_run_time</code>, <code>field_best_time</code>, <code>num_penalties</code>.
            </p>
            <div style={{ marginBottom: '1rem' }}>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => {
                  const file = e.target.files?.[0]
                  if (!file) return
                  setCsvFileName(file.name)
                  const reader = new FileReader()
                  reader.onload = (ev) => {
                    const text = ev.target.result
                    const lines = text.trim().split('\n')
                    if (lines.length < 2) { setCsvMsg({ type: 'error', text: 'CSV must have a header row and at least one data row.' }); return }
                    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''))
                    const rows = lines.slice(1).map(line => {
                      const vals = line.split(',').map(v => v.trim().replace(/^"|"$/g, ''))
                      const row = {}
                      headers.forEach((h, i) => { row[h] = vals[i] ?? '' })
                      // coerce booleans
                      if (row.covered !== undefined) row.covered = row.covered.toLowerCase() !== 'false' && row.covered !== '0'
                      if (row.no_time !== undefined) row.no_time = row.no_time.toLowerCase() === 'true' || row.no_time === '1'
                      return row
                    })
                    setCsvRows(rows)
                    setCsvMsg({ type: 'success', text: `Parsed ${rows.length} row(s) from ${file.name}. Review and click Upload.` })
                  }
                  reader.readAsText(file)
                }}
              />
              {csvFileName && <p style={{ fontSize: '0.85rem', color: 'var(--rpn-text-muted)', marginTop: '0.25rem' }}>{csvFileName} — {csvRows.length} row(s) parsed</p>}
            </div>
            {csvRows.length > 0 && (
              <div style={{ overflowX: 'auto', marginBottom: '1rem' }}>
                <table className="leaderboard-table" style={{ fontSize: '0.8rem' }}>
                  <thead>
                    <tr>{Object.keys(csvRows[0]).slice(0, 8).map(h => <th key={h}>{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {csvRows.slice(0, 5).map((row, i) => (
                      <tr key={i}>{Object.values(row).slice(0, 8).map((v, j) => <td key={j}>{String(v)}</td>)}</tr>
                    ))}
                    {csvRows.length > 5 && <tr><td colSpan={8} style={{ color: 'var(--rpn-text-muted)', textAlign: 'center' }}>…and {csvRows.length - 5} more rows</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
            {csvMsg && (
              <p className={csvMsg.type === 'success' ? 'form-success' : 'form-error'} style={{ marginBottom: '0.75rem' }}>{csvMsg.text}</p>
            )}
            {csvRows.length > 0 && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={csvSaving}
                onClick={async () => {
                  setCsvSaving(true); setCsvMsg(null)
                  try {
                    const res = await submitOrganizerCSV(token, csvRows)
                    setCsvMsg({ type: 'success', text: res.message })
                    if (res.errors?.length) {
                      setCsvMsg({ type: 'error', text: res.message + ' Errors: ' + res.errors.join('; ') })
                    }
                    setCsvRows([])
                    setCsvFileName('')
                  } catch (err) {
                    setCsvMsg({ type: 'error', text: err.message })
                  } finally {
                    setCsvSaving(false)
                  }
                }}
              >
                {csvSaving ? 'Uploading…' : `Upload ${csvRows.length} Result(s)`}
              </button>
            )}
          </div>
        </div>
      )}

      {/* ================================================================
          TAB: MEMBERSHIP
      ================================================================ */}
      {activeTab === 'membership' && (
        <div className="dashboard-content">
          <h2 className="dashboard-section-title">Membership</h2>

          <div className="dashboard-card dashboard-membership-current">
            <h3>Your Current Plan</h3>
            <p className="dashboard-membership-tier">{TIER_LABELS[tier] || tier}</p>
            <p className="dashboard-rin-id">RIN ID: <strong>{rinId}</strong></p>
          </div>

          {/* Trial expiry banner */}
          {profile?.trial_expires && (
            <div className="dashboard-card dashboard-trial-banner">
              <div>
                <strong>Free Trial Active</strong>
                <p>
                  Your 3-month free trial expires on{' '}
                  <strong>{new Date(profile.trial_expires + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</strong>.
                  After that your account will be downgraded to the free plan. Contact us at{' '}
                  <a href="mailto:info@rinrodeo.com">info@rinrodeo.com</a> to set up billing before then.
                </p>
              </div>
            </div>
          )}

          {/* Free-tier users: upgrade to Competitor Pro only */}
          {tier === 'free' && (
            <div className="dashboard-card dashboard-membership-section">
              <h3>Upgrade to Competitor Pro</h3>
              <p className="dashboard-membership-upgrade-desc">
                Unlock full RPI tracking, score history, peer rankings, and a shareable sponsor-ready profile.
              </p>

              <div className="join-billing-toggle" style={{ marginBottom: '1.25rem' }}>
                <button
                  type="button"
                  className={`join-billing-btn${upgradeBilling === 'month' ? ' active' : ''}`}
                  onClick={() => setUpgradeBilling('month')}
                >Monthly</button>
                <button
                  type="button"
                  className={`join-billing-btn${upgradeBilling === 'year' ? ' active' : ''}`}
                  onClick={() => setUpgradeBilling('year')}
                >Yearly <span className="join-billing-save">Save ~25%</span></button>
              </div>

              <div className="dashboard-upgrade-cards">
                {UPGRADE_PLANS.filter((p) => p.key === 'competitor').map((p) => {
                  const showYear = upgradeBilling === 'year' && p.hasYearly
                  const displayPrice = showYear ? p.priceYear : p.priceMonth
                  const directUrl = upgradeUrls[upgradeBilling]?.[p.key]
                  return (
                    <div key={p.key} className="dashboard-upgrade-card">
                      <h4>{p.label}</h4>
                      <p className="dashboard-upgrade-price">{displayPrice}</p>
                      {upgradeBilling === 'year' && p.hasYearly && (
                        <p className="dashboard-upgrade-save">Save ~25% vs monthly — renews October 1</p>
                      )}
                      <p className="dashboard-upgrade-desc">{p.description}</p>
                      {directUrl ? (
                        <a href={directUrl} className="btn btn-primary btn-sm">
                          Upgrade to Competitor Pro
                        </a>
                      ) : (
                        <Link
                          to={`/checkout?tier=${p.key}&billing=${upgradeBilling}`}
                          className="btn btn-primary btn-sm"
                        >
                          Upgrade to Competitor Pro
                        </Link>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Competitor-tier riders: no further upgrade path via dashboard */}
          {tier === 'competitor' && (
            <div className="dashboard-card">
              <h3>You're on Competitor Pro</h3>
              <p style={{ color: 'var(--rpn-text-muted)', marginBottom: 0 }}>
                Competitor Pro is the top plan for riders. Stock Contractor and Event Organizer plans are purpose-built for stock contractors and event producers — they are not available as rider upgrades.
              </p>
            </div>
          )}

          {/* Contractor / Organizer / Enterprise: on a top-tier plan */}
          {(tier === 'contractor' || tier === 'organizer' || tier === 'enterprise') && (
            <div className="dashboard-card">
              <p>You are on the <strong>{TIER_LABELS[tier]}</strong> plan. Thank you for being a top RIN member!</p>
            </div>
          )}
        </div>
      )}

      {/* ================================================================
          TAB: DISPUTES (Admin only)
      ================================================================ */}
      {activeTab === 'disputes' && isAdmin && (
        <div className="dashboard-content">
          <h2 className="dashboard-section-title">Disputed Results</h2>

          {disputeMsg && (
            <div className={`submit-result-banner submit-result-banner--${disputeMsg.type}`} style={{ marginBottom: '1rem' }}>
              <span className="submit-result-icon">{disputeMsg.type === 'success' ? '✓' : '✗'}</span>
              <span>{disputeMsg.text}</span>
            </div>
          )}

          {disputesLoading ? (
            <p className="loading">Loading disputes…</p>
          ) : disputes.length === 0 ? (
            <div className="dashboard-card" style={{ textAlign: 'center', padding: '2rem', color: 'var(--rpn-text-muted)' }}>
              No disputed results found.
            </div>
          ) : (
            <div className="dashboard-card" style={{ padding: 0, overflow: 'hidden' }}>
              <table className="scores-table" style={{ width: '100%' }}>
                <thead>
                  <tr>
                    <th>Perf ID</th>
                    <th>Rider</th>
                    <th>Event</th>
                    <th>Date</th>
                    <th>Status</th>
                    <th>Dispute Reason</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {disputes.map((d) => (
                    <React.Fragment key={d.performance_id}>
                      <tr>
                        <td><strong>#{d.performance_id}</strong></td>
                        <td>{d.rider_name || `Rider #${d.rider_id}`}</td>
                        <td>{d.event_name || '—'}</td>
                        <td>{d.performance_date || '—'}</td>
                        <td>
                          <span className={`dispute-status-badge dispute-status-badge--${d.dispute_status}`}>
                            {d.dispute_status === 'pending' ? 'Pending' : d.dispute_status === 'resolved' ? 'Resolved' : 'Rejected'}
                          </span>
                        </td>
                        <td className="dispute-reason-cell">{d.dispute_reason || '—'}</td>
                        <td>
                          {d.dispute_status === 'pending' && (
                            <button
                              type="button"
                              className="btn btn-sm flag-btn"
                              onClick={() => { setDisputeResolveId(disputeResolveId === d.performance_id ? null : d.performance_id); setDisputeNote(''); setDisputeMsg(null) }}
                            >
                              Review
                            </button>
                          )}
                          {d.dispute_status !== 'pending' && (
                            <span style={{ fontSize: '0.8rem', color: 'var(--rpn-text-muted)' }}>
                              {d.dispute_resolved_at ? d.dispute_resolved_at.slice(0, 10) : 'Done'}
                            </span>
                          )}
                        </td>
                      </tr>
                      {disputeResolveId === d.performance_id && (
                        <tr className="flag-inline-row">
                          <td colSpan={7}>
                            <div className="flag-inline-form" style={{ background: '#f0f9ff', borderTopColor: '#3b82f6' }}>
                              <p className="flag-inline-label">Admin note (optional — sent to rider):</p>
                              <textarea
                                className="flag-inline-textarea"
                                style={{ borderColor: '#3b82f6' }}
                                rows={2}
                                value={disputeNote}
                                onChange={(e) => setDisputeNote(e.target.value)}
                                placeholder="e.g. Score verified with event producer — result stands."
                              />
                              <div style={{ display: 'flex', gap: '0.75rem' }}>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-primary"
                                  disabled={disputeSaving}
                                  onClick={async () => {
                                    setDisputeSaving(true); setDisputeMsg(null)
                                    try {
                                      await resolveDispute(token, d.performance_id, 'resolved', disputeNote)
                                      setDisputeMsg({ type: 'success', text: `Dispute #${d.performance_id} approved — result removed from RPI. Rider notified.` })
                                      setDisputes((prev) => prev.map((x) => x.performance_id === d.performance_id ? { ...x, dispute_status: 'resolved' } : x))
                                      setDisputeResolveId(null)
                                    } catch (e) { setDisputeMsg({ type: 'error', text: e.message }) }
                                    finally { setDisputeSaving(false) }
                                  }}
                                >
                                  {disputeSaving ? 'Saving…' : 'Approve (Remove from RPI)'}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm btn-danger"
                                  disabled={disputeSaving}
                                  onClick={async () => {
                                    setDisputeSaving(true); setDisputeMsg(null)
                                    try {
                                      await resolveDispute(token, d.performance_id, 'rejected', disputeNote)
                                      setDisputeMsg({ type: 'success', text: `Dispute #${d.performance_id} rejected — original result stands. Rider notified.` })
                                      setDisputes((prev) => prev.map((x) => x.performance_id === d.performance_id ? { ...x, dispute_status: 'rejected' } : x))
                                      setDisputeResolveId(null)
                                    } catch (e) { setDisputeMsg({ type: 'error', text: e.message }) }
                                    finally { setDisputeSaving(false) }
                                  }}
                                >
                                  {disputeSaving ? 'Saving…' : 'Reject (Result Stands)'}
                                </button>
                                <button
                                  type="button"
                                  className="btn btn-sm"
                                  onClick={() => setDisputeResolveId(null)}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ===== API Keys tab (Phase 4 — Competitor+) ===== */}
      {activeTab === 'api-keys' && (
        <div className="dashboard-section">
          <h2>Public Data API Keys</h2>
          <p className="dashboard-section-desc">
            Use your API keys to access RIN rider, event, and animal data from your own applications.
            Elite members get additional fields (season/career RPI, confidence score).
          </p>

          <div className="apikey-create-row">
            <input
              type="text"
              placeholder="Key name (e.g. My App)"
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              className="apikey-name-input"
            />
            <button
              className="btn btn-primary btn-sm"
              disabled={newKeyCreating || !newKeyName.trim()}
              onClick={async () => {
                setNewKeyCreating(true)
                setApiKeyMsg(null)
                setNewKeyResult(null)
                try {
                  const res = await createApiKey(token, newKeyName.trim())
                  setNewKeyResult(res)
                  setNewKeyName('')
                  const keys = await getApiKeys(token)
                  setApiKeys(keys.keys || [])
                } catch (e) {
                  setApiKeyMsg({ type: 'error', text: e.message })
                } finally {
                  setNewKeyCreating(false)
                }
              }}
            >
              {newKeyCreating ? 'Creating…' : '+ Generate Key'}
            </button>
          </div>

          {newKeyResult && (
            <div className="apikey-new-banner">
              <strong>New API Key (copy now — not shown again):</strong>
              <code className="apikey-value">{newKeyResult.key}</code>
              <p className="apikey-hint">Name: {newKeyResult.name}</p>
            </div>
          )}

          {apiKeyMsg && <p className={apiKeyMsg.type === 'success' ? 'success' : 'error'}>{apiKeyMsg.text}</p>}

          {apiKeysLoading && <p className="loading">Loading keys…</p>}

          {!apiKeysLoading && apiKeys.length === 0 && !newKeyResult && (
            <p className="placeholder">No API keys yet. Generate one above to get started.</p>
          )}

          {apiKeys.length > 0 && (
            <table className="apikey-table">
              <thead>
                <tr><th>Name</th><th>Key (masked)</th><th>Created</th><th>Last Used</th><th></th></tr>
              </thead>
              <tbody>
                {apiKeys.map((k) => (
                  <tr key={k.key_id} className={k.status === 'revoked' ? 'apikey-row--revoked' : ''}>
                    <td>{k.name}</td>
                    <td><code className="apikey-masked">{k.key_prefix}</code></td>
                    <td>{k.created_at ? k.created_at.slice(0, 10) : '—'}</td>
                    <td>{k.last_used ? k.last_used.slice(0, 10) : 'Never'}</td>
                    <td>
                      {k.status !== 'revoked' ? (
                        <button
                          className="btn btn-danger btn-xs"
                          onClick={async () => {
                            if (!window.confirm('Revoke this key? Any app using it will lose access.')) return
                            try {
                              await revokeApiKey(token, k.key_id)
                              const keys = await getApiKeys(token)
                              setApiKeys(keys.keys || [])
                            } catch (e) {
                              setApiKeyMsg({ type: 'error', text: e.message })
                            }
                          }}
                        >
                          Revoke
                        </button>
                      ) : <span className="apikey-revoked-label">Revoked</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="apikey-docs">
            <h3>API Reference</h3>
            <p>Pass your key as a header or query param on all requests:</p>
            <code className="apikey-example">X-RIN-API-Key: rin_yourkey…</code>
            <table className="apikey-endpoints-table">
              <thead><tr><th>Endpoint</th><th>Description</th><th>Extra Elite fields</th></tr></thead>
              <tbody>
                <tr><td><code>GET /rpn/v1/public-api/riders</code></td><td>Paginated rider list</td><td>rpi_season, rpi_career, confidence, total_rides</td></tr>
                <tr><td><code>GET /rpn/v1/public-api/events</code></td><td>Paginated event list</td><td>—</td></tr>
                <tr><td><code>GET /rpn/v1/public-api/animals</code></td><td>Paginated animal list</td><td>—</td></tr>
              </tbody>
            </table>
            <p className="apikey-hint">Params: <code>page</code>, <code>per_page</code> (max 100), <code>state</code>, <code>discipline</code></p>
          </div>
        </div>
      )}

      {/* Load API keys when tab opens */}
      {activeTab === 'api-keys' && apiKeys.length === 0 && !apiKeysLoading && (() => {
        setApiKeysLoading(true)
        getApiKeys(token)
          .then((d) => setApiKeys(d.keys || []))
          .catch(() => {})
          .finally(() => setApiKeysLoading(false))
        return null
      })()}

      {/* ===== NIL Compliance tab (Phase 4 — Competitor+) ===== */}
      {activeTab === 'nil-compliance' && (
        <div className="dashboard-section">
          <h2>College NIL Compliance</h2>
          <p className="dashboard-section-desc">
            Track your NIL activity to stay compliant with college athletic eligibility rules.
            Records are private and only visible to you.
          </p>

          <button className="btn btn-primary btn-sm" style={{ marginBottom: '1rem' }} onClick={() => {
            setNilFormOpen(true)
            setNilEditId(null)
            setNilForm({ school: '', sport: '', season_start: '', season_end: '', sponsor_name: '', income_amount: '', activity_type: '', disclosure_status: 'pending', notes: '' })
            setNilMsg(null)
          }}>
            + Add NIL Record
          </button>

          {nilLoading && <p className="loading">Loading records…</p>}

          {nilFormOpen && (
            <div className="nil-compliance-form-card">
              <h3>{nilEditId ? 'Edit Record' : 'New NIL Activity Record'}</h3>
              <form onSubmit={async (e) => {
                e.preventDefault()
                setNilSaving(true)
                setNilMsg(null)
                try {
                  const payload = nilEditId ? { ...nilForm, id: nilEditId } : nilForm
                  await saveNILCompliance(token, payload)
                  const res = await getNILCompliance(token)
                  setNilRecords(res.records || [])
                  setNilFormOpen(false)
                  setNilMsg({ type: 'success', text: nilEditId ? 'Record updated.' : 'Record saved.' })
                } catch (err) {
                  setNilMsg({ type: 'error', text: err.message })
                } finally {
                  setNilSaving(false)
                }
              }}>
                <div className="dashboard-form-row dashboard-form-row--half">
                  <div>
                    <label>School / University</label>
                    <input type="text" value={nilForm.school} onChange={(e) => setNilForm({ ...nilForm, school: e.target.value })} />
                  </div>
                  <div>
                    <label>Sport</label>
                    <input type="text" value={nilForm.sport} onChange={(e) => setNilForm({ ...nilForm, sport: e.target.value })} placeholder="e.g. Rodeo" />
                  </div>
                </div>
                <div className="dashboard-form-row dashboard-form-row--half">
                  <div>
                    <label>Season Start</label>
                    <input type="date" value={nilForm.season_start} onChange={(e) => setNilForm({ ...nilForm, season_start: e.target.value })} />
                  </div>
                  <div>
                    <label>Season End</label>
                    <input type="date" value={nilForm.season_end} onChange={(e) => setNilForm({ ...nilForm, season_end: e.target.value })} />
                  </div>
                </div>
                <div className="dashboard-form-row dashboard-form-row--half">
                  <div>
                    <label>Sponsor / Brand</label>
                    <input type="text" value={nilForm.sponsor_name} onChange={(e) => setNilForm({ ...nilForm, sponsor_name: e.target.value })} />
                  </div>
                  <div>
                    <label>Income Amount ($)</label>
                    <input type="number" min="0" step="0.01" value={nilForm.income_amount} onChange={(e) => setNilForm({ ...nilForm, income_amount: e.target.value })} />
                  </div>
                </div>
                <div className="dashboard-form-row dashboard-form-row--half">
                  <div>
                    <label>Activity Type</label>
                    <select value={nilForm.activity_type} onChange={(e) => setNilForm({ ...nilForm, activity_type: e.target.value })}>
                      <option value="">Select type</option>
                      <option value="endorsement">Brand Endorsement</option>
                      <option value="social_media">Social Media Post</option>
                      <option value="appearance">Personal Appearance</option>
                      <option value="autograph">Autograph Signing</option>
                      <option value="camp">Training Camp / Clinic</option>
                      <option value="merchandise">Merchandise Sale</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div>
                    <label>Disclosure Status</label>
                    <select value={nilForm.disclosure_status} onChange={(e) => setNilForm({ ...nilForm, disclosure_status: e.target.value })}>
                      <option value="pending">Pending Disclosure</option>
                      <option value="disclosed">Disclosed to Athletic Dept.</option>
                      <option value="approved">Approved by Compliance</option>
                      <option value="rejected">Rejected by Compliance</option>
                    </select>
                  </div>
                </div>
                <div className="dashboard-form-row">
                  <label>Notes</label>
                  <textarea rows={3} value={nilForm.notes} onChange={(e) => setNilForm({ ...nilForm, notes: e.target.value })} />
                </div>
                {nilMsg && <p className={nilMsg.type === 'success' ? 'success' : 'error'}>{nilMsg.text}</p>}
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setNilFormOpen(false)}>Cancel</button>
                  <button type="submit" className="btn btn-primary btn-sm" disabled={nilSaving}>{nilSaving ? 'Saving…' : 'Save Record'}</button>
                </div>
              </form>
            </div>
          )}

          {nilMsg && !nilFormOpen && <p className={nilMsg.type === 'success' ? 'success' : 'error'}>{nilMsg.text}</p>}

          {!nilLoading && nilRecords.length === 0 && !nilFormOpen && (
            <p className="placeholder">No NIL records yet. Click "Add NIL Record" to start tracking.</p>
          )}

          {nilRecords.length > 0 && (
            <table className="nil-compliance-table">
              <thead>
                <tr>
                  <th>School</th><th>Sponsor</th><th>Activity</th>
                  <th>Income</th><th>Season</th><th>Status</th><th></th>
                </tr>
              </thead>
              <tbody>
                {nilRecords.map((r) => (
                  <tr key={r.id}>
                    <td>{r.school || '—'}</td>
                    <td>{r.sponsor_name || '—'}</td>
                    <td style={{ textTransform: 'capitalize' }}>{r.activity_type?.replace('_', ' ') || '—'}</td>
                    <td>{r.income_amount ? `$${Number(r.income_amount).toLocaleString()}` : '—'}</td>
                    <td>{r.season_start ? `${r.season_start.slice(0, 7)} → ${r.season_end?.slice(0, 7) || ''}` : '—'}</td>
                    <td>
                      <span className={`nil-compliance-status nil-compliance-status--${r.disclosure_status}`}>
                        {r.disclosure_status?.replace('_', ' ')}
                      </span>
                    </td>
                    <td>
                      <button className="btn btn-secondary btn-xs" onClick={() => {
                        setNilEditId(r.id)
                        setNilForm({
                          school: r.school || '', sport: r.sport || '',
                          season_start: r.season_start || '', season_end: r.season_end || '',
                          sponsor_name: r.sponsor_name || '', income_amount: r.income_amount || '',
                          activity_type: r.activity_type || '', disclosure_status: r.disclosure_status || 'pending',
                          notes: r.notes || '',
                        })
                        setNilFormOpen(true)
                        setNilMsg(null)
                      }}>Edit</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="nil-compliance-disclaimer">
            <strong>Disclaimer:</strong> This tool helps you organize your NIL records but does not constitute legal or compliance advice.
            Always consult your school's athletic compliance office before entering into any NIL agreement.
          </div>
        </div>
      )}

      {/* Load NIL compliance records when tab opens */}
      {activeTab === 'nil-compliance' && !nilFetched && !nilLoading && (() => {
        setNilLoading(true)
        getNILCompliance(token)
          .then((d) => { setNilRecords(d.records || []); setNilFetched(true) })
          .catch(() => { setNilFetched(true) })
          .finally(() => setNilLoading(false))
        return null
      })()}

    </div>

    {cropSrc && (
      <ImageCropModal
        imageSrc={cropSrc}
        aspect={1}
        onCrop={handleCropApply}
        onCancel={handleCropCancel}
      />
    )}
    </>
  )
}

/* --------------------------------------------------------------------------
 * Form field sub-components (keep Dashboard lean)
 * -------------------------------------------------------------------------- */
function AnimalFormFields({ form, setForm }) {
  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }))
  const [animalCropSrc, setAnimalCropSrc] = useState(null)

  const handleImageChange = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onloadend = () => setAnimalCropSrc(reader.result)
    reader.readAsDataURL(file)
    e.target.value = ''
  }

  const handleAnimalCropApply = (blob, previewUrl) => {
    const croppedFile = new File([blob], 'animal-photo.jpg', { type: 'image/jpeg' })
    setForm((p) => ({ ...p, _imageFile: croppedFile, image_url: previewUrl }))
    setAnimalCropSrc(null)
  }

  const setVideoLink = (idx, val) => {
    setForm((p) => {
      const links = [...(p.video_links || ['', '', '', '', ''])]
      links[idx] = val
      return { ...p, video_links: links }
    })
  }

  return (
    <>
      {/* Basic identity */}
      <div className="dashboard-form-row dashboard-form-row--half">
        <div>
          <label>Name *</label>
          <input type="text" value={form.name} onChange={set('name')} required />
        </div>
        <div>
          <label>Animal Type *</label>
          <select value={form.animal_type} onChange={set('animal_type')} required>
            <option value="">Select type</option>
            <option value="Bull">Bull (Adult)</option>
            <option value="Mini Bull">Mini Bull</option>
            <option value="Saddle Bronc Horse">Saddle Bronc Horse</option>
            <option value="Bareback Horse">Bareback Horse</option>
            <option value="Barrel Horse">Barrel Horse</option>
            <option value="Breakaway Horse">Breakaway Horse</option>
            <option value="Rope Horse">Rope Horse</option>
            <option value="Steer Wrestling Horse">Steer Wrestling Horse</option>
            <option value="All-Around Horse">All-Around Horse</option>
            <option value="Other">Other</option>
          </select>
        </div>
      </div>

      <div className="dashboard-form-row dashboard-form-row--half">
        <div>
          <label>Scoring Type</label>
          <select value={form.scoring_type} onChange={set('scoring_type')}>
            <option value="">Select...</option>
            <option value="roughstock">Roughstock</option>
            <option value="timed">Timed</option>
          </select>
        </div>
        <div>
          <label>Unique Number</label>
          <input type="text" value={form.unique_number} onChange={set('unique_number')} />
        </div>
      </div>

      {/* Sex / Sire / Dam */}
      <div className="dashboard-form-row dashboard-form-row--half">
        <div>
          <label>Sex</label>
          <select value={form.sex} onChange={set('sex')}>
            <option value="">Select...</option>
            <option value="Bull">Bull</option>
            <option value="Steer">Steer</option>
            <option value="Stallion">Stallion</option>
            <option value="Gelding">Gelding</option>
            <option value="Mare">Mare</option>
          </select>
        </div>
        <div>
          <label>Currently Active *</label>
          <select value={form.currently_active} onChange={set('currently_active')} required>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </div>
      </div>

      <div className="dashboard-form-row dashboard-form-row--half">
        <div>
          <label>Sire (Father)</label>
          <input type="text" value={form.sire} onChange={set('sire')} />
        </div>
        <div>
          <label>Dam (Mother)</label>
          <input type="text" value={form.dam} onChange={set('dam')} />
        </div>
      </div>

      {/* Physical details */}
      <div className="dashboard-form-row dashboard-form-row--half">
        <div>
          <label>Breed</label>
          <input type="text" value={form.breed} onChange={set('breed')} />
        </div>
        <div>
          <label>Color</label>
          <input type="text" value={form.color} onChange={set('color')} />
        </div>
      </div>

      <div className="dashboard-form-row dashboard-form-row--half">
        <div>
          <label>Year Foaled</label>
          <input type="number" value={form.year_foaled} onChange={set('year_foaled')} min="1960" max={new Date().getFullYear()} />
        </div>
        <div>
          <label>Birth Date</label>
          <input type="date" value={form.birth_date} onChange={set('birth_date')} />
        </div>
      </div>

      <div className="dashboard-form-row dashboard-form-row--half">
        <div>
          <label>Years Competing</label>
          <input type="number" value={form.years_competing} onChange={set('years_competing')} min="0" max="30" />
        </div>
        <div>
          <label>Owner</label>
          <input type="text" value={form.owner} onChange={set('owner')} />
        </div>
      </div>

      {/* Bloodline / breeding */}
      <div className="dashboard-form-row dashboard-form-row--half">
        <div>
          <label>Bloodlines</label>
          <input type="text" value={form.bloodlines} onChange={set('bloodlines')} />
        </div>
        <div>
          <label>Breeding</label>
          <input type="text" value={form.breeding} onChange={set('breeding')} />
        </div>
      </div>

      <div className="dashboard-form-row">
        <label>Breeding Papers URL <span className="optional">(optional)</span></label>
        <input type="url" value={form.breeding_papers_url} onChange={set('breeding_papers_url')} placeholder="https://..." />
      </div>

      {/* Video Links */}
      <div className="dashboard-form-row">
        <label>Video Links <span className="optional">(up to 5)</span></label>
        {(form.video_links || ['', '', '', '', '']).map((link, idx) => (
          <input
            key={idx}
            type="url"
            value={link}
            onChange={(e) => setVideoLink(idx, e.target.value)}
            placeholder={`Video URL ${idx + 1}`}
            style={{ marginBottom: '6px' }}
          />
        ))}
      </div>

      {/* Notes */}
      <div className="dashboard-form-row">
        <label>Notes</label>
        <textarea rows={3} value={form.notes} onChange={set('notes')} />
      </div>

      {/* Featured image */}
      <div className="dashboard-form-row">
        <label>Animal Photo (Featured Image)</label>
        {form.image_url && (
          <div className="animal-image-preview">
            <img src={form.image_url} alt="Animal preview" style={{ maxWidth: '180px', maxHeight: '180px', objectFit: 'cover', borderRadius: '6px', marginBottom: '8px', display: 'block' }} />
          </div>
        )}
        <input type="file" accept="image/*" onChange={handleImageChange} />
        <small style={{ color: '#6b7280' }}>Select a photo to open the crop tool. Supported: JPG, PNG, WebP.</small>
      </div>
      {animalCropSrc && (
        <ImageCropModal
          imageSrc={animalCropSrc}
          aspect={4/3}
          onCrop={handleAnimalCropApply}
          onCancel={() => setAnimalCropSrc(null)}
        />
      )}
    </>
  )
}

function ProducerEventResultsView({ data }) {
  const [activeRound, setActiveRound] = useState('overall')
  const TABS = [
    { id: 'overall',      label: 'Overall' },
    { id: 'round_1',      label: 'Round 1' },
    { id: 'round_2',      label: 'Round 2' },
    { id: 'championship_round', label: 'Championship' },
  ]
  const rows = data[activeRound] ?? []

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            className={`event-round-tab${activeRound === t.id ? ' event-round-tab--active' : ''}`}
            onClick={() => setActiveRound(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className="placeholder">No results for this round yet.</p>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          {activeRound === 'overall' ? (
            <table className="event-results-table leaderboard-table">
              <thead>
                <tr>
                  <th>Place</th>
                  <th>Rider</th>
                  <th>Agg Score</th>
                  <th>R1 Pts</th>
                  <th>R2 Pts</th>
                  <th>CR Pts</th>
                  <th>Earnings</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td>{row.place || i + 1}</td>
                    <td>{row.rider_name || '—'}</td>
                    <td>{row.agg_score != null ? Number(row.agg_score).toFixed(1) : '—'}</td>
                    <td>{row.round_1_points != null ? Number(row.round_1_points).toFixed(1) : '—'}</td>
                    <td>{row.round_2_points != null ? Number(row.round_2_points).toFixed(1) : '—'}</td>
                    <td>{row.championship_round_points != null ? Number(row.championship_round_points).toFixed(1) : '—'}</td>
                    <td>{row.earnings ? `$${Number(row.earnings).toLocaleString()}` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="event-results-table leaderboard-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Rider</th>
                  <th>Animal</th>
                  <th>Score</th>
                  <th>Result</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td>{i + 1}</td>
                    <td>{row.rider_name || '—'}</td>
                    <td>{row.animal_name || row.horse_name || '—'}</td>
                    <td>{row.score != null && row.score !== '' ? Number(row.score).toFixed(1) : (row.final_time != null ? `${Number(row.final_time).toFixed(2)}s` : '—')}</td>
                    <td>{row.bull_score != null ? Number(row.bull_score).toFixed(1) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  )
}

function EventFormFields({ form, setForm }) {
  const set = (field) => (e) => setForm((p) => ({ ...p, [field]: e.target.value }))
  const DISCIPLINES_LIST = [
    'Bull Riding', 'Saddle Bronc', 'Bareback', 'Barrel Racing',
    'Team Roping – Header', 'Team Roping – Heeler', 'Tie-Down Roping',
    'Breakaway Roping', 'Steer Wrestling', 'Junior Bull Riding', 'Steer Riding',
    'Pole Bending', 'Goat Tying', 'Barrel Racing (Youth)', 'Breakaway (Youth)',
  ]
  const toggleDiscipline = (d) => {
    setForm((p) => ({
      ...p,
      disciplines: p.disciplines.includes(d)
        ? p.disciplines.filter((x) => x !== d)
        : [...p.disciplines, d],
    }))
  }
  const US_STATES_LIST = ['AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY']
  return (
    <>
      <div className="dashboard-form-row">
        <label>Event Title *</label>
        <input type="text" value={form.title} onChange={set('title')} required />
      </div>
      <div className="dashboard-form-row dashboard-form-row--half">
        <div>
          <label>Event Date</label>
          <input type="date" value={form.event_date} onChange={set('event_date')} />
        </div>
        <div>
          <label>Season</label>
          <input type="text" value={form.season} onChange={set('season')} placeholder="e.g. 2025" />
        </div>
      </div>
      <div className="dashboard-form-row">
        <label>Venue</label>
        <input type="text" value={form.venue} onChange={set('venue')} />
      </div>
      <div className="dashboard-form-row dashboard-form-row--half">
        <div>
          <label>City</label>
          <input type="text" value={form.city} onChange={set('city')} />
        </div>
        <div>
          <label>State</label>
          <select value={form.state} onChange={set('state')}>
            <option value="">Select state</option>
            {US_STATES_LIST.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="dashboard-form-row dashboard-form-row--half">
        <div>
          <label>Event Tier</label>
          <select value={form.event_tier} onChange={set('event_tier')}>
            <option value="">Select tier</option>
            <option value="local">Local</option>
            <option value="regional">Regional</option>
            <option value="pro">Pro</option>
          </select>
        </div>
        <div>
          <label>Entry Fee</label>
          <input type="text" value={form.entry_fee} onChange={set('entry_fee')} placeholder="e.g. $75" />
        </div>
      </div>
      <div className="dashboard-form-row">
        <label>Prize Money</label>
        <input type="text" value={form.prize_money} onChange={set('prize_money')} placeholder="e.g. $5,000 added" />
      </div>
      <div className="dashboard-form-row">
        <label>Disciplines</label>
        <div className="dashboard-disciplines-checkboxes">
          {DISCIPLINES_LIST.map((d) => (
            <label key={d} className="dashboard-discipline-check">
              <input
                type="checkbox"
                checked={form.disciplines.includes(d)}
                onChange={() => toggleDiscipline(d)}
              />
              {d}
            </label>
          ))}
        </div>
      </div>
      <div className="dashboard-form-row">
        <label>Description</label>
        <textarea rows={4} value={form.description} onChange={set('description')} />
      </div>
    </>
  )
}
