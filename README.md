# Rodeo Performance Network (RPN) App

A headless WordPress frontend for the **Rodeo Performance Network** — the first national performance-based scoring system for rodeo athletes, horses, bulls, pickup teams, and producers.

## Tech Stack

- **Frontend**: React 19 + Vite
- **Backend/CMS**: WordPress (headless via REST API)
- **Routing**: React Router v7

## Quick Start

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

## WordPress Setup

1. Ensure WordPress is running at `http://localhost/rodeo-performance-network`
2. Copy `wordpress-plugin/rpn-headless-plugin.php` to your WP `wp-content/plugins/` and activate it
3. The React app proxies `/wp-json` to WordPress in dev — no CORS config needed

See **[HEADLESS_WORDPRESS_SETUP.md](./HEADLESS_WORDPRESS_SETUP.md)** for full setup, custom post types, and RPN spec alignment.

## Project Structure

```
src/
├── config/wordpress.js      # WordPress API config
├── services/wordpressApi.js # REST API client
├── pages/                   # Route components
│   ├── HomePage.jsx         # Fetches posts from WordPress
│   ├── RankingsPage.jsx     # Buckle Rankings (placeholder)
│   ├── RidersPage.jsx       # Rider profiles (placeholder)
│   ├── AnimalsPage.jsx      # Animals (placeholder)
│   └── PostPage.jsx         # Single post view
└── App.jsx
```

## RPN Spec Summary

- **Indexes**: RPI, TEI, SRI, BHI, CRI, PRI, PTI
- **Condition modifiers**: Arena, Weather, Event Tier
- **Profiles**: Riders, Animals, Pickup Teams
- **Features**: Digital ID cards, rankings, media tagging, monetization (Stripe)
