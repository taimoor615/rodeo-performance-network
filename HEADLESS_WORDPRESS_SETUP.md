# RPN Headless WordPress Setup Guide

This guide explains how to run the **Rodeo Performance Network (RPN)** React app as a headless frontend with WordPress as the CMS/backend.

## Architecture Overview

```
┌─────────────────────┐         REST API          ┌──────────────────────────┐
│   React App (Vite)  │ ◄───────────────────────► │   WordPress (Headless)   │
│   localhost:5173    │   /wp-json/wp/v2/*        │   rodeo-performance-     │
│   (Frontend)        │                           │   network (Backend/CMS)  │
└─────────────────────┘                           └──────────────────────────┘
```

- **WordPress**: Content management, custom post types (Riders, Animals, Events, etc.), media, users
- **React App**: UI, routing, displays data fetched from WordPress REST API

---

## 1. WordPress Setup (XAMPP)

**WordPress path:** `D:\xampp\htdocs\rodeo-performance-network`  
**Site URL:** `http://localhost/rodeo-performance-network`

### Enable REST API

WordPress REST API is enabled by default. Verify at:
`http://localhost/rodeo-performance-network/wp-json`

### Install the RPN Plugin

The RPN plugin is installed at:
`D:\xampp\htdocs\rodeo-performance-network\wp-content\plugins\rpn-headless\rpn-headless.php`

1. In WordPress Admin go to **Plugins**.
2. Find **RPN Headless WordPress** and click **Activate**.
3. This registers custom post types: **Riders**, **Animals**, **Pickup Teams**, **Events** with REST API support.
4. After activation you’ll see **Riders**, **Animals**, **Pickup Teams**, and **Events** in the admin menu—add content there to see it in the React app.

### Permalink Settings

Go to **Settings → Permalinks** and choose **Post name** (or any non-plain option) so REST routes work correctly.

---

## 2. React App Configuration

### Environment Variables

1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```

2. Set your WordPress URL in `.env`:
   ```
   VITE_WORDPRESS_URL=http://localhost/rodeo-performance-network
   ```

### CORS (if needed)

If the React app runs on a different port/domain (e.g. `http://localhost:5173`), WordPress may block cross-origin requests. Options:

- **Option A**: Use a proxy in `vite.config.js` (recommended for dev):

```js
// vite.config.js
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/wp-json': {
        target: 'http://localhost/rodeo-performance-network',
        changeOrigin: true,
      },
    },
  },
})
```

Then set `VITE_WORDPRESS_URL` to `''` or `/` so the app uses relative URLs and the proxy forwards `/wp-json` to WordPress.

- **Option B**: Enable CORS in WordPress (e.g. via plugin or the commented code in `rpn-headless-plugin.php`).

---

## 3. Available Endpoints

| Endpoint | Description |
|----------|-------------|
| `/wp/v2/posts` | Blog posts |
| `/wp/v2/pages` | Static pages |
| `/wp/v2/riders` | Riders (custom post type) |
| `/wp/v2/animals` | Animals (horses, bulls) |
| `/wp/v2/pickup-teams` | Pickup teams |
| `/wp/v2/events` | Events |
| `/wp/v2/media` | Media/attachments |
| `/wp/v2/categories` | Categories |

---

## 4. RPN Spec Alignment

### Index Metrics (to be stored/calculated)

- **RPI** – Rider Performance Index  
- **TEI** – Timed Event Index  
- **SRI** – Stock Rating Index  
- **BHI** – Barrel Horse Index  
- **CRI** – Contractor Rating Index  
- **PRI** – Producer Rating Index  
- **PTI** – Pickup Team Index  

**Recommendation**: Use Advanced Custom Fields (ACF) or custom meta in WordPress to store index values, stats, and condition modifiers. Expose them via REST using `register_rest_field()` or ACF's REST integration.

### Condition Modifier System

- Arena: Smooth (1.00), Chopped (0.90), Muddy (0.95), etc.
- Weather: Clear (1.00), Rainy (0.95), Windy (0.97), etc.
- Event Tier: Local (1.00), Regional (1.10), Pro (1.25)

Store these as meta/ACF on events and apply in your scoring engine (can live in the React app or a separate API).

---

## 5. Next Steps

1. Add ACF (or similar) for RPI, TEI, arena/weather/tier fields.
2. Implement scoring formulas in a service layer (React or WP REST custom endpoint).
3. Build profile pages for Riders, Animals, Pickup Teams using CPT data.
4. Add Buckle Rankings with filters (State, City, Age Group) and raw/adjusted toggle.
5. Integrate Stripe for memberships, custom cards, and premium features.
6. Add media tagging and one-way social feed as specified.

---

## 6. Run the App

```bash
npm install
npm run dev
```

Open `http://localhost:5173`. The home page fetches posts from WordPress. If WordPress is not running or the URL is wrong, an error message will appear.
