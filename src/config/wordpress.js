/**
 * WordPress REST API Configuration
 * Used for headless WordPress integration
 *
 * In dev, use relative path so Vite proxy forwards /wp-json to WordPress.
 * Set VITE_WORDPRESS_URL for production or if not using the proxy.
 */

// In dev, leave VITE_WORDPRESS_URL unset so requests go to same origin and Vite proxy forwards /wp-json to WordPress (avoids CORS).
const WP_BASE_URL =
  (import.meta.env.DEV && !import.meta.env.VITE_WORDPRESS_URL) ? '' : (import.meta.env.VITE_WORDPRESS_URL || 'http://localhost/rodeo-performance-network')

export const WP_CONFIG = {
  apiUrl: WP_BASE_URL ? `${WP_BASE_URL}/wp-json` : '/wp-json',
  baseUrl: WP_BASE_URL || (typeof window !== 'undefined' ? window.location.origin : ''),

  endpoints: {
    posts: '/wp/v2/posts',
    pages: '/wp/v2/pages',
    media: '/wp/v2/media',
    categories: '/wp/v2/categories',
    users: '/wp/v2/users',

    riders: '/wp/v2/riders',
    animals: '/wp/v2/animals',
    pickup_teams: '/wp/v2/pickup-teams',
    events: '/wp/v2/events',
    contractors: '/wp/v2/contractors',
    producers: '/wp/v2/producers',

    homepage: '/rpn/v1/homepage',
    conditionModifiers: '/rpn/v1/condition-modifiers',
    performances: '/rpn/v1/performances',
    revenueProducts: '/rpn/v1/revenue-products',
    login: '/rpn/v1/login',
    me: '/rpn/v1/me',
    dashboardRider: '/rpn/v1/dashboard/rider',
    dashboardContractor: '/rpn/v1/dashboard/contractor',
    contractorRankings: '/rpn/v1/contractor-rankings',
    dashboardProducer: '/rpn/v1/dashboard/producer',
    rpnMedia: '/rpn/v1/media',
    profile: '/rpn/v1/profile',
    myAnimals: '/rpn/v1/my-animals',
    myEvents: '/rpn/v1/my-events',
    myScores: '/rpn/v1/my-scores',
    upgradeUrl: '/rpn/v1/upgrade-url',
    join: '/rpn/v1/join',
    siteSettings: '/rpn/v1/site-settings',
  },
}
