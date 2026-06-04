# RPN Roles, Linking & Activation – Complete Guide

How each role works, how linking happens, how to activate users manually, and how to test from the database.

---

## 1. Role Overview

| Role | Join As | WP Role | Dashboard | How to Activate |
|------|---------|---------|-----------|-----------------|
| **Rider** | Rider / Competitor | `rpn_rider` | Rider dashboard (RPI, analytics) | Purchase Premium at checkout → auto-linked |
| **Premium Rider** | — | `rpn_premium_rider` | Same as Rider | Set automatically when Premium is purchased |
| **Contractor** | Event Producer (contractor) | `rpn_contractor` | Contractor dashboard (CRI) | Admin links user ↔ Contractor post |
| **Producer** | Event Producer | `rpn_producer` | Producer dashboard (PRI) | Admin links user ↔ Producer post |
| **Pickup Team** | Pickup Team | `subscriber` | No dashboard yet | — |
| **Fan** | Fan / General | `subscriber` | No dashboard | — |

---

## 2. Complete Flow by Role

### Rider / Competitor

1. **Register** at Join Us → selects "Rider / Competitor" → WP user created with role `rpn_rider`, email with password sent.
2. **Login** → user can sign in, sees Dashboard.
3. **Dashboard (before payment)**: "Activate your account – Purchase Premium membership to link your rider profile and access RPI, analytics, and verified badge."
4. **To activate**:
   - User goes to Homepage → Join RPN section → clicks "Get started" on Premium ($9.99/mo).
   - Redirects to WooCommerce checkout with Premium product in cart.
   - At checkout: **Rider** dropdown appears (from RPN plugin) → user selects their rider profile.
   - User pays (Stripe).
5. **After payment**:
   - Plugin sets `premium_member = true` on the selected rider.
   - Plugin finds WP user by billing email → links `rpn_linked_rider_id` (user) and `rpn_linked_user_id` (rider).
   - User role upgraded to `rpn_premium_rider`.
6. **Next login** → Rider dashboard shows RPI, analytics, verified badge.

**Important**: The rider profile (Rider CPT) must **already exist** in WordPress. Admin creates Rider posts (Riders → Add New). At checkout, the user selects which rider profile is theirs.

---

### Contractor

1. **Register** at Join Us → selects "Contractor (stock contractor)" → WP user created with role `rpn_contractor`.
2. **Login** → Dashboard.
3. **Dashboard (before link)**: "No contractor profile linked. Contact admin to link your contractor profile."
4. **To activate** (admin):
   - Create Contractor post in WordPress (Contractors → Add New).
   - Users → find the user → add user meta `rpn_linked_contractor_id` = contractor post ID.
   - Edit Contractor post → add post meta `rpn_linked_user_id` = that user's ID.
5. **Next login** → Contractor dashboard shows CRI, verification, etc.

---

### Producer

Same flow as Contractor, but with Producer posts and `rpn_linked_producer_id` / `rpn_linked_user_id`.

---

### Fan / Pickup Team

- Register → WP user created, can login.
- No dashboard (or a basic "Welcome" view). No linking required.

---

## 3. How Rider Linking Works (Step by Step)

### Prerequisites

1. **Rider CPT exists**: In WordPress, go to **Riders → Add New**. Create a rider (e.g. "John Smith"). Publish. Note the rider's ID or slug.
2. **WooCommerce products**: Digital ID, Printed Card, Premium Membership – with correct slugs in `rpn_wc_product_slugs()`.

### Flow

1. User registers as Rider → gets WP account (email, password).
2. User goes to **Homepage** → "Join RPN" section → clicks **Get started** on Premium.
3. User is redirected to **WordPress checkout** (e.g. `yoursite.com/checkout/?add-to-cart=123`).
4. On checkout page, **Rider** dropdown shows all published riders. User selects "John Smith".
5. User enters billing info (email must match their WP account if you want auto-link) and pays.
6. On payment complete:
   - `_rpn_rider_id` from order = selected rider (e.g. John Smith, ID 42).
   - Billing email = `john@example.com`.
   - Plugin finds `get_user_by('email', 'john@example.com')`.
   - If found: `update_user_meta(user_id, 'rpn_linked_rider_id', 42)` and `update_post_meta(42, 'rpn_linked_user_id', user_id)`.
   - Rider 42 gets `premium_member = true`, `premium_expires = +1 month`.
   - User role → `rpn_premium_rider`.

### Why You Don’t See a “Link Rider” Option in WP

Linking happens **automatically at checkout** when Premium is purchased. There is no built-in admin UI to link manually. For manual linking (e.g. for testing), use the methods in Section 5.

---

## 4. Manual Linking from WordPress (No Plugin UI)

Because there is no custom "Link rider" screen, use one of these:

### Option A: User Meta (Users table)

1. **Users → All Users** → click the user.
2. Scroll to **User Meta** (or use a plugin like "User Meta Manager").
3. Add:
   - `rpn_linked_rider_id` = rider post ID (e.g. 42)
4. **Riders → Edit** the rider post.
5. In Custom Fields (or ACF), add:
   - `rpn_linked_user_id` = that user's ID (e.g. 5)

### Option B: Database (phpMyAdmin / MySQL)

```sql
-- Link user 5 to rider 42
INSERT INTO wp_usermeta (user_id, meta_key, meta_value) VALUES (5, 'rpn_linked_rider_id', '42');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (42, 'rpn_linked_user_id', '5');
```

### Option C: Code (temporary test code in theme functions.php)

```php
add_action('admin_init', function() {
    if (isset($_GET['rpn_link_test']) && current_user_can('manage_options')) {
        $user_id = 5;   // replace with your user ID
        $rider_id = 42; // replace with your rider ID
        update_user_meta($user_id, 'rpn_linked_rider_id', $rider_id);
        update_post_meta($rider_id, 'rpn_linked_user_id', $user_id);
        update_post_meta($rider_id, 'premium_member', true);
        update_post_meta($rider_id, 'premium_expires', date('Y-m-d', strtotime('+1 month')));
        wp_update_user(array('ID' => $user_id, 'role' => 'rpn_premium_rider'));
        wp_die('Linked. Remove this code.');
    }
});
// Visit: yoursite.com/wp-admin/?rpn_link_test=1
```

---

## 5. Activate User from Database (For Testing)

### Give a rider premium and link (MySQL)

```sql
-- 1. Set rider 42 as premium
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (42, 'premium_member', '1');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (42, 'premium_expires', '2025-12-31');

-- 2. Link user 5 to rider 42
INSERT INTO wp_usermeta (user_id, meta_key, meta_value) VALUES (5, 'rpn_linked_rider_id', '42');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (42, 'rpn_linked_user_id', '5');

-- 3. Set user role to premium rider (replace 'subscriber' etc. with 'rpn_premium_rider')
UPDATE wp_usermeta SET meta_value = 'a:1:{s:18:"rpn_premium_rider";b:1;}' 
WHERE user_id = 5 AND meta_key = 'wp_capabilities';
```

WordPress stores capabilities as serialized PHP. Simpler approach: use WP admin or the code snippet in 4C.

### Simpler: Use WordPress Admin

1. **Users → Edit user** → set Role to "RPN Premium Rider".
2. Add user meta `rpn_linked_rider_id` = rider ID (via plugin or code).
3. **Riders → Edit rider** → add `rpn_linked_user_id` = user ID, `premium_member` = true, `premium_expires` = future date.

---

## 6. Browser-Side Manual Process

1. **Register**: Go to /join-us → fill form → submit.
2. **Check email**: Receive password and login link.
3. **Login**: Go to /login (or link from email) → enter email + password → Sign in.
4. **Dashboard**: 
   - If not linked: "Activate your account – Purchase Premium to unlock rider dashboard" (or equivalent for contractor/producer).
   - If linked + premium: Rider/Contractor/Producer dashboard with stats.
5. **Purchase Premium**: Homepage → Join RPN → Get started (Premium) → WooCommerce checkout → select Rider → pay.
6. **Refresh dashboard**: Logout and login again (or refresh) → Rider dashboard appears.

---

## 7. Enable / Activate a User Directly from DB (Testing)

### Quick activation (MySQL)

Replace `5` with your user ID and `42` with your rider post ID:

```sql
-- Link user 5 to rider 42
INSERT INTO wp_usermeta (user_id, meta_key, meta_value) VALUES (5, 'rpn_linked_rider_id', '42')
ON DUPLICATE KEY UPDATE meta_value = '42';
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (42, 'rpn_linked_user_id', '5');

-- Set rider 42 as premium
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (42, 'premium_member', '1');
INSERT INTO wp_postmeta (post_id, meta_key, meta_value) VALUES (42, 'premium_expires', '2026-12-31');
```

To set the user role to `rpn_premium_rider` in the DB, you need to update `wp_usermeta` where `meta_key = 'wp_capabilities'`. The value is serialized PHP. Easier: use **Users → Edit User** in WP Admin and change the role to "RPN Premium Rider".

### PHP snippet (temporary, in theme or plugin)

Add to `functions.php` or a custom plugin, then visit `yoursite.com/wp-admin/?rpn_activate_user=1` (as admin):

```php
add_action('admin_init', function() {
    if (!isset($_GET['rpn_activate_user']) || !current_user_can('manage_options')) return;
    $user_id = 5;   // CHANGE: your user ID
    $rider_id = 42; // CHANGE: your rider post ID
    update_user_meta($user_id, 'rpn_linked_rider_id', $rider_id);
    update_post_meta($rider_id, 'rpn_linked_user_id', $user_id);
    update_post_meta($rider_id, 'premium_member', true);
    update_post_meta($rider_id, 'premium_expires', date('Y-m-d', strtotime('+1 year')));
    $u = get_userdata($user_id);
    if ($u) $u->set_role('rpn_premium_rider');
    wp_die('User activated. Remove this code from functions.php.');
});
```

---

## 8. Summary Table: What Happens When

| Action | Rider | Contractor | Producer | Fan |
|--------|-------|------------|----------|-----|
| Register | WP user, rpn_rider | WP user, rpn_contractor | WP user, rpn_producer | WP user, subscriber |
| Login | ✓ | ✓ | ✓ | ✓ |
| Dashboard before link | "Activate – Purchase Premium" | "Contact admin to link" | "Contact admin to link" | No dashboard |
| How to link | Purchase Premium at checkout | Admin links manually | Admin links manually | — |
| Dashboard after link | RPI, analytics, verified | CRI, verified | PRI, verified | — |
