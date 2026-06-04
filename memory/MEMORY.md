# RPN App Memory

## Project Overview
Rodeo Performance Network (RPN) — headless WordPress + React 19 SPA.
- Build tool: Vite 7
- Router: React Router 7
- Auth: JWT via custom WP endpoint, stored in localStorage as `rpn_auth_token`
- No Tailwind — pure CSS variables + vanilla CSS in `src/index.css` + `src/App.css`

## Color Palette (do NOT change these)
- `--rpn-red: #FD0000` — primary brand
- `--rpn-red-dark: #B91C1C` — hover/accent
- `--rpn-red-deeper: #7F1D1D` — deep accent (added in UI refresh)
- `--rpn-blue-dark: #1F2937` — dark bg sections
- `--rpn-navy: #111827` — footer / darkest bg
- `--rpn-cream: #F9FAFB` — light bg
- `--rpn-text: #111827` — body text
- `--rpn-text-muted: #6B7280` — secondary text
- `--rpn-border: #E5E7EB`

## Key Files
- `src/index.css` — CSS variables, typography, base button/link styles
- `src/App.css` — all component/page styles (~2800 lines)
- `src/App.jsx` — routing (22 routes under Layout)
- `src/context/AuthContext.jsx` — auth state
- `src/services/wordpressApi.js` — all API calls
- `src/pages/` — 22 page components
- `src/components/Carousel.jsx` — reusable carousel

## Pages Summary
HomePage, RankingsPage, RidersPage, RiderDetailPage, AnimalsPage, AnimalDetailPage,
EventsPage, EventDetailPage, PickupTeamsPage, PickupTeamDetailPage,
ContractorsPage, ContractorDetailPage, ContractorRankingsPage,
ProducersPage, ProducerDetailPage, AboutUsPage, JoinUsPage, LoginPage,
DashboardPage, AddPerformancePage, PostPage + Layout wrapper

## UI Refresh Done (March 2026)
- Removed all leftover `rgba(0,40,104,...)` / `rgba(0,26,61,...)` blue colour references
- Added `--rpn-red-deeper`, `--rpn-red-subtle`, `--rpn-red-glow`, `--rpn-dark-overlay` tokens
- Hero: warm dark overlay, diagonal accent bar, 4px red bottom stripe
- Cards: white bg, border-top accent on hover, red outline glow on hover
- Nav: 64px height, deeper red gradient, dropdown with left-border hover
- Stats strip: vertical dividers between stats
- Leaderboard: alternating rows, top-3 rank colour coding
- Buttons: unified red gradient (removed blue overrides with !important)
- Dashboard stats: dark navy gradient with red top accent stripe
- Section headers: red left-border indicator on discipline titles
- Forms: red focus ring throughout
