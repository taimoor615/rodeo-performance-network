# RPN Deployment Guide — Hostinger Live Server

Deploy the RPN React app + WordPress backend to `https://forestgreen-eland-205241.hostingersite.com`

---

## Your Current Structure (Correct)

```
public_html/
├── index.html          ← React app (from dist/)
├── assets/
│   ├── index-xxx.js
│   └── index-xxx.css
├── favicon.svg
├── .htaccess           ← REQUIRED for React Router (see below)
└── wp/                 ← WordPress installation
    ├── wp-admin/
    ├── wp-includes/
    ├── wp-content/
    ├── wp-config.php
    ├── index.php
    └── ...
```

This structure is valid. The React app serves the root; WordPress serves `/wp/`.

---

## Step-by-Step Deployment

### 1. Build the React App for Production

Set the WordPress URL and build:

```bash
# On your local machine, in project root
VITE_WORDPRESS_URL=https://forestgreen-eland-205241.hostingersite.com/wp npm run build
```

This creates a `dist/` folder with the production build.

**Important:** Because WordPress lives in `/wp`, the API base URL must include `/wp`:
- API base: `https://forestgreen-eland-205241.hostingersite.com/wp`
- REST API: `https://forestgreen-eland-205241.hostingersite.com/wp/wp-json`

---

### 2. Upload Files

| Source | Destination |
|--------|-------------|
| `dist/*` (all contents) | `public_html/` (root) |
| WordPress files | `public_html/wp/` |

Ensure:
- `public_html/index.html` exists (from dist)
- `public_html/assets/` exists with JS/CSS
- `public_html/wp/` contains the full WordPress installation

---

### 3. Add .htaccess for React Router (SPA)

React Router uses client-side routes (`/riders`, `/animals/123`, etc.). Without a server rule, direct visits or refreshes on these URLs return 404.

Create or update `public_html/.htaccess`:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /

  # Don't rewrite files or directories
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d

  # Don't rewrite WordPress (let /wp/ be handled by WordPress)
  RewriteCond %{REQUEST_URI} !^/wp/

  # Send everything else to index.html (React app)
  RewriteRule ^ index.html [QSA,L]
</IfModule>
```

This sends non-file requests (except `/wp/`) to `index.html`, so React Router can handle them.

---

### 4. Fix Product / Checkout URLs (localhost → production)

If "Join RPN" product links point to localhost, WordPress `siteurl`/`home` are still set to your dev URL.

**Option A – Update WordPress (recommended):**  
In **Settings → General**, set both URLs to:
`https://forestgreen-eland-205241.hostingersite.com/wp`

**Option B – Override in wp-config.php:**  
If you can't change WP options, add this to `public_html/wp/wp-config.php`:

```php
// Force correct base for checkout/product links (Join RPN section)
define('RPN_CHECKOUT_BASE_URL', 'https://forestgreen-eland-205241.hostingersite.com/wp');
```

The RPN plugin will use this as the base for all product checkout URLs.

---

### 5. WordPress Configuration

In `public_html/wp/wp-config.php`, ensure:

```php
define('WP_HOME', 'https://forestgreen-eland-205241.hostingersite.com/wp');
define('WP_SITEURL', 'https://forestgreen-eland-205241.hostingersite.com/wp');
```

Or in WordPress Admin → **Settings → General**:
- **WordPress Address (URL):** `https://forestgreen-eland-205241.hostingersite.com/wp`
- **Site Address (URL):** `https://forestgreen-eland-205241.hostingersite.com/wp`

Use **https** if your domain has SSL (Hostinger usually provides it).

---

### 6. WordPress .htaccess (inside wp folder)

Ensure `public_html/wp/.htaccess` exists with standard WordPress rules:

```apache
# BEGIN WordPress
<IfModule mod_rewrite.c>
RewriteEngine On
RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]
RewriteBase /wp/
RewriteRule ^index\.php$ - [L]
RewriteCond %{REQUEST_FILENAME} !-f
RewriteCond %{REQUEST_FILENAME} !-d
RewriteRule . /wp/index.php [L]
</IfModule>
# END WordPress
```

`RewriteBase /wp/` is important because WordPress is in a subfolder.

---

### 7. CORS (Cross-Origin Requests)

The React app (`https://forestgreen-eland-205241.hostingersite.com`) calls the WordPress API (`https://forestgreen-eland-205241.hostingersite.com/wp/wp-json`). Same domain = **same origin** in most cases, so CORS usually isn’t an issue.

If you get CORS errors, the RPN plugin’s CORS headers should handle it. Ensure the plugin is active and that `Access-Control-Allow-Origin` or `Access-Control-Allow-Credentials` headers are set if needed.

---

### 8. Asset Paths (Base URL)

Vite defaults to `/` for assets, so `index.html` will load `/assets/index-xxx.js`. With your structure that resolves to `https://yourdomain.com/assets/...`, which is correct.

If you ever host the app in a subfolder (e.g. `/app/`), set `base: '/app/'` in `vite.config.js` before building.

---

## Checklist

- [ ] Build with: `VITE_WORDPRESS_URL=https://forestgreen-eland-205241.hostingersite.com/wp npm run build`
- [ ] Upload `dist/*` to `public_html/`
- [ ] WordPress in `public_html/wp/`
- [ ] `public_html/.htaccess` with SPA rewrite rules
- [ ] `public_html/wp/.htaccess` with `RewriteBase /wp/`
- [ ] WordPress URLs set to `https://forestgreen-eland-205241.hostingersite.com/wp`
- [ ] RPN plugin active in WordPress
- [ ] SSL enabled (https)

---

## Alternative: WordPress in Root

If you prefer WordPress at the root (`domain.com/wp-json`) and the React app in a subfolder (e.g. `/app/`):

- Put WordPress in `public_html/`
- Put the React `dist/` contents in `public_html/app/`
- Build with `base: '/app/'` and `VITE_WORDPRESS_URL=https://forestgreen-eland-205241.hostingersite.com`
- Add `.htaccess` in `public_html/app/` for the SPA fallback

Your current setup (React in root, WordPress in `/wp`) is simpler and keeps the main site as the React app.

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| 404 on `/riders` or `/animals/123` | Add/update root `.htaccess` with SPA rewrite rules |
| Blank page / white screen | Check browser console; verify asset paths and API URL |
| API returns 404 | Confirm WordPress URL includes `/wp` and REST is at `/wp/wp-json` |
| Product links point to localhost | 1) Clear server/cache and hard-refresh (Ctrl+Shift+R). 2) Test API directly: `/wp/wp-json/rpn/v1/revenue-products` – if `checkout_url` still has localhost, add `define('RPN_CHECKOUT_BASE_URL','https://yourdomain.com/wp');` in wp-config.php (before "That's all"). 3) Or add to theme functions.php: `add_filter('rpn_revenue_product_checkout_url', fn($u,$id,$k)=>str_replace('http://localhost/rodeo-performance-network','https://yourdomain.com/wp',$u), 10, 3);` |
| CORS errors | Ensure RPN plugin is active; check `rest_allowed_cors_headers` filter |
| Images/media broken | Verify `WP_HOME` / `WP_SITEURL` are correct and use https |

---

## Quick Build Script

Create `build-production.sh` (or `.bat` on Windows):

```bash
#!/bin/bash
export VITE_WORDPRESS_URL=https://forestgreen-eland-205241.hostingersite.com/wp
npm run build
echo "Upload dist/ contents to public_html/"
```

Windows (PowerShell):

```powershell
$env:VITE_WORDPRESS_URL="https://forestgreen-eland-205241.hostingersite.com/wp"
npm run build
```
