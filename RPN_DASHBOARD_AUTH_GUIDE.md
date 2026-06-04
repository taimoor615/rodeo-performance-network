# RPN Dashboard & Auth – Implementation Guide

Complete architecture for Premium Rider Dashboard, Contractor/Producer Dashboards, Login, Registration, and role-based access.

---

## 1. Overview

| Feature | Description |
|--------|-------------|
| **Filters** | Riders: search, state, sort by RPI. Animals: search, type, sort by SRI/TEI. |
| **Verified Badge** | Shown on rider profile and list when `premium_member` = true. |
| **Registration** | Creates WP user, sends password + login link via email. |
| **Login** | React login page → REST API → returns token. Token used for protected API calls. |
| **Premium Rider Dashboard** | RPI, analytics, verified status. Access only after payment. |
| **Contractor Dashboard** | CRI, events, verification status. |
| **Producer Dashboard** | PRI, events, verification status. |
| **WordPress Roles** | `rider`, `premium_rider`, `contractor`, `producer` (custom roles or WP subscriber + meta). |

---

## 2. Flow: Registration → Login → Dashboard

```
1. User fills Join form (rider / contractor / producer)
2. Plugin creates WP user with role, generates random password
3. Email sent: password + login link (e.g. https://yoursite.com/login)
4. User logs in on React /login page
5. API returns token; React stores in localStorage
6. User visits /dashboard/rider (or /dashboard/contractor, /dashboard/producer)
7. API checks: logged-in user + linked entity + premium (for riders)
8. If valid → return dashboard data; else → 403
```

---

## 3. Link User ↔ Rider / Contractor / Producer

- **Rider**: `rider` post has meta `rpn_linked_user_id` (WP user ID). User has meta `rpn_linked_rider_id` (rider post ID).
- **Contractor**: Same pattern with `rpn_linked_user_id` on contractor post.
- **Producer**: Same pattern on producer post.
- **When is the link set?**
  - **Riders**: At WooCommerce checkout when premium is purchased. Order has `_rpn_rider_id` + billing email. We find/create user by email, link user ↔ rider.
  - **Contractors / Producers**: Admin links manually in WP, or we add a "link my account" flow later.

---

## 4. WordPress: Custom Roles

Add in `rpn-headless-plugin.php`:

```php
add_action('init', 'rpn_add_roles');
function rpn_add_roles() {
    add_role('rpn_rider', 'RPN Rider', array('read' => true));
    add_role('rpn_premium_rider', 'RPN Premium Rider', array('read' => true));
    add_role('rpn_contractor', 'RPN Contractor', array('read' => true));
    add_role('rpn_producer', 'RPN Producer', array('read' => true));
}
```

When premium is purchased → set user role to `rpn_premium_rider`.

---

## 5. REST Endpoints

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/rpn/v1/register` | POST | — | Create user, send password email. |
| `/rpn/v1/login` | POST | — | Email + password → token. |
| `/rpn/v1/me` | GET | Token | Current user + roles + linked rider/contractor/producer. |
| `/rpn/v1/dashboard/rider` | GET | Token | Rider dashboard (RPI, analytics). Requires premium. |
| `/rpn/v1/dashboard/contractor` | GET | Token | Contractor dashboard. |
| `/rpn/v1/dashboard/producer` | GET | Token | Producer dashboard. |

---

## 6. Token Auth

- Login returns `{ token, user: { id, email, roles, linked_rider_id, ... } }`
- Client stores token in localStorage.
- Protected requests: `Authorization: Bearer <token>` or `X-RPN-Auth: <token>`.
- Server stores token in transient: `rpn_auth_{token}` → user_id, expiry 24h.

---

## 7. Dashboard Access Rules

| Dashboard | Requirement |
|-----------|-------------|
| Rider | Logged in + linked to rider + rider has `premium_member` = true (and `premium_expires` > today) |
| Contractor | Logged in + linked to contractor |
| Producer | Logged in + linked to producer |

---

## 8. Configure Login URL (Headless)

The registration email includes a login link. By default it uses WordPress `home_url()` + `/login`. For headless React, the React app URL may differ. Set the correct login URL in your theme `functions.php` or a small plugin:

```php
add_filter('rpn_login_url', function() {
    return 'https://your-react-app.com/login';
});
```

---

## 9. Link Contractor / Producer to User

Riders are linked automatically when Premium is purchased at checkout (billing email → user). For contractors and producers, link manually in WordPress:

1. Users → edit user
2. Add user meta: `rpn_linked_contractor_id` = contractor post ID, or `rpn_linked_producer_id` = producer post ID
3. Edit the contractor/producer post and set `rpn_linked_user_id` = that user's ID

Or use a custom admin UI / import script.

---

## 10. Linking Flow Summary

| Role | How link is created | Where it happens |
|------|---------------------|------------------|
| **Rider** | User purchases Premium at checkout, selects Rider from dropdown | WooCommerce checkout (billing email must match WP user) |
| **Contractor** | Admin sets `rpn_linked_contractor_id` on user + `rpn_linked_user_id` on contractor post | WordPress (Users → edit user; Contractors → edit contractor) or DB |
| **Producer** | Same as Contractor | Same |

**There is no built-in "Link Rider" screen in WP.** Rider linking happens only at checkout when Premium is purchased. For manual testing, use DB queries or the PHP snippet in `RPN_ROLES_AND_LINKING_GUIDE.md`.

---

## 11. File Changes Summary

**WordPress Plugin:**
- Register roles
- Register meta `rpn_linked_user_id` on rider, contractor, producer
- Register meta `rpn_linked_rider_id`, `rpn_linked_contractor_id`, `rpn_linked_producer_id` on user
- Modify `/rpn/v1/join` → create user, send email (or add new `/rpn/v1/register`)
- Add `/rpn/v1/login`, `/rpn/v1/me`, `/rpn/v1/dashboard/rider`, `/rpn/v1/dashboard/contractor`, `/rpn/v1/dashboard/producer`
- On WooCommerce payment complete: find/create user by billing email, link user ↔ rider, set role `rpn_premium_rider`

**React:**
- AuthContext (token, user, login, logout)
- LoginPage
- DashboardRiderPage, DashboardContractorPage, DashboardProducerPage (or one DashboardPage with tabs)
- ProtectedRoute component
- Nav: Login / Logout / Dashboard links
