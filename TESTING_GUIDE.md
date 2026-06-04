# RIN App — Feature Implementation & Testing Guide

**Project:** Rodeo Identification Network (RIN)  
**Period covered:** May 11–13, 2026  
**Stack:** React SPA (Vite) + Headless WordPress + WooCommerce

---

## Table of Contents

1. [Yearly Billing Toggle (Signup + Dashboard)](#1-yearly-billing-toggle)
2. [WooCommerce Products Setup](#2-woocommerce-products-setup)
3. [SMTP Email via Hostinger (Replace EmailJS)](#3-smtp-email-via-hostinger)
4. [Duplicate Email Registration Block](#4-duplicate-email-registration-block)
5. [Admin Notification Email on New Registration](#5-admin-notification-email)
6. [Contact Info Standardized Across App](#6-contact-info-standardized)
7. [RIN ID Auto-Assignment](#7-rin-id-auto-assignment)
8. [New User Created from WP Admin — Password Email + CPT Auto-Creation](#8-wp-admin-user-creation)
9. [404 Not Found Page](#9-404-page)
10. [404 "View Rankings" Button Visibility Fix](#10-404-button-fix)
11. [WooCommerce Checkout Auto-Fill (Auth Token)](#11-woocommerce-checkout-auto-fill)
12. [Delete User → Delete Linked CPT Posts](#12-delete-user-cleanup)
13. [Contractor & Organizer Dashboard Redesign](#13-contractor-organizer-dashboard)
14. [Animal Delete Feature](#14-animal-delete)

---

## 1. Yearly Billing Toggle

### What was done

- Added a **monthly/yearly billing toggle** directly on the **JoinUsPage** signup form so users can choose their billing interval at registration time instead of only at the bottom of the dashboard
- Made yearly pricing the **default selection** on the DashboardPage membership upgrade section
- Fixed `effectiveTierKey` so yearly plans correctly resolve to their WooCommerce product slugs (e.g., `rin_competitor_yearly`)
- Changed "Save ~15%" label to **"Save ~25%"** to reflect actual savings

### Files changed

- `src/pages/JoinUsPage.jsx`
- `src/pages/DashboardPage.jsx`
- `src/pages/CheckoutPage.jsx`

### How to test

**Signup flow:**

1. Go to `/join-us`
2. Select a paid tier (e.g., Competitor Pro)
3. Verify a **Monthly / Yearly** billing toggle appears near the plan selection
4. Switch to Yearly — price should update to the yearly rate
5. Complete registration — you should be directed to WooCommerce checkout for the yearly product

**Dashboard upgrade:**

1. Log in as a free rider at `/dashboard → Membership tab`
2. Yearly should be pre-selected by default (not monthly)
3. Toggle to Monthly — price changes; toggle back to Yearly — shows yearly price with "Save ~25%" badge
4. Click an upgrade button — it should redirect directly to WooCommerce checkout for the correct yearly product

---

## 2. WooCommerce Products Setup

### What was done

Documented the 8 WooCommerce products that must exist for the upgrade flow to work.

### Products required (exact slugs)

| Product Name                 | Slug                     | Price     |
| ---------------------------- | ------------------------ | --------- |
| RIN Competitor Pro Monthly   | `rin-competitor`         | $9.99/mo  |
| RIN Competitor Pro Yearly    | `rin-competitor-yearly`  | $89/yr    |
| RIN Stock Contractor Monthly | `rin-contractor`         | $29.99/mo |
| RIN Stock Contractor Yearly  | `rin-contractor-yearly`  | $249/yr   |
| RIN Event Organizer Monthly  | `rin-organizer`          | $79.99/mo |
| RIN Event Organizer Yearly   | `rin-organizer-yearly`   | $649/yr   |
| RIN Competitor Bundle        | `rin-competitor-bundle`  | custom    |
| RIN Competitor Student       | `rin-competitor-student` | custom    |

### How to test

1. Go to **WP Admin → Products**
2. Confirm all 8 products exist with the exact slugs above
3. Log in as a free rider on the React app → Dashboard → Membership
4. Click an upgrade button — it should land on the WooCommerce checkout page for the correct product (check the URL)

---

## 3. SMTP Email via Hostinger

### What was done

- Removed all **EmailJS** code from the app (was unreliable and exposed keys)
- Added WordPress SMTP configuration via the `phpmailer_init` hook using Hostinger SMTP server
- All emails (registration, password reset, admin notifications) now route through `info@rinrodeo.com` on `smtp.hostinger.com:465`

### Files changed

- `wordpress-plugin/rpn-headless-plugin.php` — added `rpn_smtp_config()` hook
- `D:\xampp\htdocs\rodeo-performance-network\wp-config.php` — added SMTP constants

### wp-config.php constants added

```php
define( 'RPN_SMTP_HOST',      'smtp.hostinger.com' );
define( 'RPN_SMTP_PORT',      465 );
define( 'RPN_SMTP_SECURE',    'ssl' );
define( 'RPN_SMTP_USER',      'info@rinrodeo.com' );
define( 'RPN_SMTP_PASS',      'Xena2026!' );
define( 'RPN_SMTP_FROM',      'info@rinrodeo.com' );
define( 'RPN_SMTP_FROM_NAME', 'Rodeo Identification Network' );
define( 'RPN_REACT_APP_URL',  'https://rinrodeo.com' );
```

> **Note:** These constants must also be added to the **live Hostinger wp-config.php** manually via cPanel file manager or SSH.

### How to test

1. Register a new account on `/join-us` with a real email address
2. Check the inbox — you should receive a welcome email **from** `info@rinrodeo.com`
3. The email should contain a **Log In to RIN** link pointing to `https://rinrodeo.com/login` (not `/wp/login` or localhost)
4. On live: go to **WP Admin → Tools → Site Health** or use a SMTP test plugin to verify the connection works

---

## 4. Duplicate Email Registration Block

### What was done

- When a user tries to register with an email that already exists in WordPress, the API now returns a clear, user-friendly error message instead of a generic failure
- Different messages for different situations: existing rider trying to join as contractor, existing account with no RIN role, etc.

### How to test

1. Register a new account with email `test@example.com`
2. Try to register again with the same email on `/join-us`
3. You should see an error: **"An account with this email address is already registered. Please log in to access your dashboard."**
4. If you try to register an existing rider as a contractor, you get: **"You already have a rider account with this email address..."**

---

## 5. Admin Notification Email

### What was done

- When any new user registers through the React app `/join-us`, an **HTML notification email** is automatically sent to `info@rinrodeo.com`
- Email includes: RIN ID, full name, email, role, membership plan, organization/license number, registration timestamp

### Files changed

- `wordpress-plugin/rpn-headless-plugin.php` — updated `rpn_join_callback()`

### How to test

1. Register a new test account on `/join-us` (use a unique email)
2. Check `info@rinrodeo.com` inbox
3. You should receive an email with the subject **"New RIN Registration"** containing a table of the new user's details
4. Verify the RIN ID in the email matches what the user sees in their dashboard

---

## 6. Contact Info Standardized

### What was done

Phone number `434-604-0972` and email `info@rinrodeo.com` are now consistent across:

- Footer (via WordPress site settings API)
- NotFoundPage (404)
- ThankYouPage
- LegalPage
- JoinUsPage
- Layout footer

### Files changed

- `src/pages/Layout.jsx`
- `src/pages/LegalPage.jsx`
- `src/pages/ThankYouPage.jsx`
- `src/pages/NotFoundPage.jsx`
- `wordpress-plugin/rpn-headless-plugin.php` — footer defaults

### How to test

1. Visit `/legal`, `/privacy-policy`, `/thank-you`, `/not-found-test` (any invalid URL)
2. All pages should show `info@rinrodeo.com` and `434-604-0972`
3. Check the site footer — same contact info

---

## 7. RIN ID Auto-Assignment

### What was done

- Every new user registration (via the React app OR from WP Admin) automatically gets a **unique RIN ID** in the format `RIN-XXXXXXXX` (e.g., `RIN-AD2165`)
- Existing users without a RIN ID get one assigned automatically when an admin visits WP Admin (one-time backfill)

### Files changed

- `wordpress-plugin/rpn-headless-plugin.php` — added `rpn_auto_assign_rin_id()` on `user_register` hook + admin_init backfill

### How to test

1. Register a new account on `/join-us`
2. Log into the dashboard — the header should show **RIN ID: RIN-XXXXXX**
3. In WP Admin → Users → click the user — they should have a **RIN ID** custom field populated
4. For existing users: log into WP Admin (any page) — all users without a RIN ID will get one assigned automatically

---

## 8. WP Admin User Creation

### What was done

When an admin creates a user manually from **WP Admin → Users → Add New**:

**Password in welcome email:**

- The generated password is captured before WordPress hashes it and included in the notification email sent to the new user
- Email has two action buttons: **Log In to RIN** and **Change Password**

**Auto CPT creation by role:**

- Assign role `RPN Rider` → a `rider` CPT post is auto-created and linked to the user; tier set to `free`
- Assign role `RPN Contractor` → an `rpn_contractor` CPT post is auto-created; tier set to `contractor` with 3-month trial
- Assign role `RPN Producer` → an `rpn_producer` CPT post is auto-created; tier set to `organizer` with 3-month trial

**Tier sync:**

- If admin changes a user's role in the User Profile edit screen, the membership tier updates automatically

### Files changed

- `wordpress-plugin/rpn-headless-plugin.php` — `rpn_on_role_assigned()`, `check_passwords` hook, `wp_new_user_notification_email` filter, `rpn_late_sync_tier_on_role_change()`

### How to test

1. Go to **WP Admin → Users → Add New**
2. Fill in name and email, set role to **RPN Rider**, save
3. Check the new user's email — they should receive a welcome email **with the generated password included**
4. Log in as that user on the React app → Dashboard should show **Free** tier (not Fan Pass or blank)
5. Go to **WP Admin → Riders** — the new rider CPT post should exist
6. Repeat with role **RPN Contractor** → contractor CPT should exist; Dashboard should show **Stock Contractor** tier
7. Repeat with role **RPN Producer** → producer CPT should exist; Dashboard should show **Event Organizer** tier
8. Go to **WP Admin → Users**, edit the contractor, change role to RPN Producer → tier should auto-update to `organizer`

---

## 9. 404 Not Found Page

### What was done

Created a branded 404 page (`NotFoundPage`) that shows for any URL that doesn't match a defined route.

### Files changed

- `src/pages/NotFoundPage.jsx` — new file
- `src/App.jsx` — added `<Route path="*" element={<NotFoundPage />} />`
- `src/App.css` — added 404 page styles

### How to test

1. In your browser, go to `http://localhost:5173/this-page-does-not-exist`
2. You should see:
   - Large **"404"** number in red
   - "Page Not Found" heading
   - Two buttons: **Go to Homepage** and **View Rankings**
   - Contact info: `info@rinrodeo.com` and `434-604-0972`
3. Click both buttons — they should navigate to the correct pages

---

## 10. 404 "View Rankings" Button Fix

### What was done

The **"View Rankings"** button on the 404 page was invisible — white text on white background.  
Fixed by adding a CSS override that gives the button a dark navy background in the 404 context.

### Files changed

- `src/App.css` — added `.not-found-actions .btn-secondary` override

### How to test

1. Go to any invalid URL (e.g., `/xyz-does-not-exist`)
2. Both buttons — **Go to Homepage** (red) and **View Rankings** (navy) — should be clearly visible

---

## 11. WooCommerce Checkout Auto-Fill

### What was done

When a logged-in user clicks an upgrade button in the Dashboard, they used to land on the WooCommerce checkout as a guest (no pre-filled info).  
Fixed by passing the auth token when fetching the upgrade URL, which triggers the autologin flow — WordPress recognizes the user and pre-fills their WooCommerce billing details.

### Files changed

- `src/pages/DashboardPage.jsx` — `getUpgradeUrl(t, interval, token)` now passes the token
- `wordpress-plugin/rpn-headless-plugin.php` — `rpn_handle_autologin()` and `rpn_upgrade_url_callback()`

### How to test

1. Log in as any user on the React app
2. Go to Dashboard → Membership tab
3. Click an upgrade button (e.g., Competitor Pro — Yearly)
4. You should land on the WooCommerce checkout page **already logged in** with your name and email pre-filled
5. You should NOT be prompted to create a WooCommerce account or enter your email again

---

## 12. Delete User → Delete Linked CPT Posts

### What was done

**Problem:** When an admin deleted a user from WP Admin and chose "Delete all content," the linked rider/contractor/producer CPT posts were NOT deleted. This happened because WordPress only removes posts where `post_author = deleted user`, but many CPT posts had `post_author = 1` (admin) due to a previous bug.

**Fix:** Added a `deleted_user` WordPress action hook that reads the deleted user's stored meta links (`rpn_linked_rider_id`, `rpn_linked_contractor_id`, `rpn_linked_producer_id`) and force-deletes those CPT posts — regardless of who the `post_author` is.

### Files changed

- `wordpress-plugin/rpn-headless-plugin.php` — added `rpn_delete_linked_cpt_posts()` on `deleted_user` hook

### How to test

1. Go to **WP Admin → Users → Add New**, create a test user with role **RPN Rider**
2. Confirm the rider CPT post was created: check **WP Admin → Riders** — new entry should exist
3. Note the rider's name
4. Go back to **WP Admin → Users**, click **Delete** on the test user
5. On the confirmation screen, select **"Delete all content"** and click **Confirm Deletion**
6. Go to **WP Admin → Riders** — the rider CPT post should now be **gone**
7. Go to `/riders` on the React app — the deleted rider should no longer appear
8. Repeat the test with **RPN Contractor** and **RPN Producer** roles to verify all three CPT types are cleaned up

---

## 13. Contractor & Organizer Dashboard Redesign

### What was done

**Problem:** Stock contractors and event organizers were seeing the same rider-centric profile form (with fields like Date of Birth, Division, Primary Event, Secondary Events, NIL/Sponsorship, etc.) — which is irrelevant for businesses.

**Changes made:**

**Business Profile Form (contractors and organizers):**

- Business Name / Organization Name
- Point of Contact (person's full name — optional)
- Street Address, City, State, ZIP
- Phone, Business Email (read-only, tied to account), Website
- Stock Types — **Bulls / Broncs checkboxes** (contractors only)
- Description / About
- Logo upload

**Role-aware Dashboard Tabs:**

| Tab              | Rider | Contractor only | Producer only |
| ---------------- | ----- | --------------- | ------------- |
| Profile          | ✅    | ✅              | ✅            |
| Stats & Rankings | ✅    | ❌              | ❌            |
| My Animals       | ✅    | ✅              | ❌            |
| Post Score       | ✅    | ❌              | ❌            |
| My Events        | ❌    | ❌              | ✅            |
| Submit Results   | ❌    | ❌              | ✅            |
| Membership       | ✅    | ✅              | ✅            |
| API Keys / NIL   | ✅    | ❌              | ❌            |

**Other changes:**

- "Claim Your Existing Profile" section hidden for contractors/producers (it's rider-specific)
- Contractor and producer QR codes link to `/contractors/[slug]` and `/producers/[slug]`
- Dashboard form-actions show the correct public page link per role

**Public detail pages updated:**

- `/contractors/[slug]` — now shows full address, Bulls/Broncs stock type badges, Point of Contact, Phone, Email, Website in a structured list
- `/producers/[slug]` — now shows full address, Point of Contact, Phone, Email, Website

### Files changed

- `wordpress-plugin/rpn-headless-plugin.php` — profile GET/POST: added `business_name`, `address_street`, `address_zip`, `contact_name`, `stock_types` fields
- `src/pages/DashboardPage.jsx` — `isContractor`, `hasContractorLink`, `isBusinessOnly` variables; role-aware tabs; conditional profile form
- `src/pages/ContractorDetailPage.jsx` — displays all new business fields
- `src/pages/ProducerDetailPage.jsx` — displays all new business fields
- `src/App.css` — added `.dashboard-form-row--third`, `.input-disabled`, `.form-hint`, `.index-badge--stock`, `.profile-detail-dl`

### How to test

**Contractor profile form:**

1. Log in as a stock contractor account on the React app
2. Go to Dashboard → **Profile tab**
3. You should see: **Business Name**, Point of Contact, Website, then Location section (Street, City, State, ZIP), Contact section (Phone, Email — greyed out), Stock section with **Bulls / Broncs checkboxes**, Description, Logo upload
4. You should NOT see: Age Group, Primary Event, Secondary Events, Social Media, NIL/Sponsorship, Video Highlights
5. Fill in Business Name = "Circle T Rodeo Stock", check Bulls and Broncs, click Save Profile
6. Go to `/contractors/[your-slug]` — the public page should show the business name, address, stock type badges (Bulls, Broncs), and the contact section

**Contractor tabs:**

1. Log in as contractor → verify you see only: Profile, My Animals, Membership
2. Verify you do NOT see: Stats & Rankings, Post Score, API Keys, NIL Compliance

**Organizer profile form:**

1. Log in as an event organizer/producer account
2. Dashboard → Profile tab should show: **Organization Name**, Point of Contact, Website, Location, Contact, Description, Logo
3. No Bulls/Broncs section (producer-only)
4. Tabs visible: Profile, My Events, Submit Results, Membership

**Public pages:**

1. Visit `/contractors/[slug]` for a contractor you updated
2. Contact section should be a clean list: Point of Contact | [name], Phone | [clickable], Email | [clickable], Website | [clickable]

---

## 14. Animal Delete Feature

### What was done

**Problem:** A contractor accidentally added the same bull twice and had no way to remove it from their account.

**Fix:** Added a full delete flow — backend API endpoint, frontend handler, and a two-step confirmation UI to prevent accidental deletion.

**How deletion works:**

- The animal post is moved to **WordPress Trash** (not permanently deleted) — admin can restore it from WP Admin if needed
- The animal ID is removed from the user's profile `linked_animals` meta — so it immediately disappears from all public views
- The contractor's animal count drops so they can add a new animal

**Ownership check:** Only the user who created the animal (or has it linked via meta) can delete it. No one can delete another user's animal.

### Files changed

- `wordpress-plugin/rpn-headless-plugin.php` — added `DELETE /rpn/v1/my-animals/{id}` endpoint and `rpn_my_animals_delete_callback()`
- `src/services/wordpressApi.js` — added `deleteMyAnimal(token, id)`
- `src/pages/DashboardPage.jsx` — added `deletingAnimal` state, `deleteAnimalLoading` state, `handleDeleteAnimal()` handler, Delete button with inline two-step confirmation
- `src/App.css` — added `.btn-danger-outline`, `.animal-delete-confirm`, `.animal-delete-confirm-label`

### How to test

**Normal delete flow:**

1. Log in as a stock contractor on the React app
2. Go to Dashboard → **My Animals** tab
3. Find the duplicate animal
4. Click the red outlined **Delete** button on the right side of the animal card
5. The card expands to show: **"Delete? | Yes, Delete | Cancel"** (red background confirmation bar)
6. Click **Yes, Delete**
7. The animal disappears from the list immediately
8. A success message appears: "Animal removed from your herd."
9. The herd count (X/25 animals) decreases by 1

**Cancel flow:**

1. Click **Delete** on any animal
2. Click **Cancel** — the confirmation dismisses and nothing is deleted

**Public page verification:**

1. After deleting an animal, go to `/contractors/[slug]` (the contractor's public page)
2. The deleted animal should no longer appear in the Stock section

**WordPress Trash verification:**

1. After deleting an animal from the dashboard, go to **WP Admin → Animals**
2. Click **Trash** at the top — the deleted animal should appear there
3. You can click **Restore** to undo the deletion if it was a mistake

**Duplicate bull fix:**

1. If a contractor has the same bull listed twice, delete one of them using the steps above
2. The remaining entry stays untouched

---

## Quick Reference: All Endpoints Added/Modified

| Endpoint                         | Method | What it does                                                                          |
| -------------------------------- | ------ | ------------------------------------------------------------------------------------- |
| `POST /rpn/v1/join`              | POST   | Registration (fixed duplicate email, admin email, SMTP)                               |
| `GET /rpn/v1/profile`            | GET    | Added `business_name`, `address_street`, `address_zip`, `contact_name`, `stock_types` |
| `POST /rpn/v1/profile`           | POST   | Saves all new business profile fields                                                 |
| `DELETE /rpn/v1/my-animals/{id}` | DELETE | New — deletes (trashes) an animal with ownership check                                |
| `GET /rpn/v1/upgrade-url`        | GET    | Now requires auth token to enable WC autologin                                        |

---

## Quick Reference: WordPress Hooks Added

| Hook                       | Function                            | Purpose                                                  |
| -------------------------- | ----------------------------------- | -------------------------------------------------------- |
| `user_register`            | `rpn_auto_assign_rin_id`            | Auto-assigns RIN ID on every new registration            |
| `set_user_role`            | `rpn_on_role_assigned`              | Creates rider/contractor/producer CPT when role assigned |
| `deleted_user`             | `rpn_delete_linked_cpt_posts`       | Cleans up CPT posts when a WP user is deleted            |
| `phpmailer_init`           | `rpn_smtp_config`                   | Routes all WP emails through Hostinger SMTP              |
| `check_passwords`          | _(closure)_                         | Captures plaintext password for welcome email            |
| `edit_user_profile_update` | `rpn_late_sync_tier_on_role_change` | Syncs membership tier when role changed in WP Admin      |

---

_Last updated: May 13, 2026_
