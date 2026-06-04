# WordPress Dashboard Access, Payments & QR Check-In – Complete Guide

This guide explains how contractors, producers, and riders can use the **WordPress admin** to add/edit/delete their own content, how payments work with your 3 products, and how the QR Digital ID and check-in flow work.

---

## Part 1: Logging in contractors, producers, and riders

### What you already have

- When someone joins via **Join Us**, you create a **WordPress user** (email + generated password).
- You send a **welcome email** with that password and a **login link**.
- The link currently points to your **front-end login page** (e.g. `yoursite.com/login`), which uses the headless app.

### Two places they can log in

| Where | URL | Use case |
|-------|-----|----------|
| **Front-end (React app)** | `yoursite.com/login` | Dashboard on the headless site, view profile, etc. |
| **WordPress admin** | `yoursite.com/wp-admin` | Add/edit/delete their own contractors, producers, riders, animals, events. |

They use the **same email and password** for both. No second dashboard: once verified or payment is active, they use **wp-admin** for managing their posts.

### What to put in the welcome email

1. **Email** and **password** (you already send these).
2. **Front-end login:**  
   `Login to the RPN site: https://yoursite.com/login`
3. **WordPress dashboard (for managing their content):**  
   `Manage your profile & content: https://yoursite.com/wp-admin`  
   (Optional: only include this for contractor/producer, or for riders who have premium.)

You can change the welcome email in the plugin (see below) so it includes the wp-admin link and a short line like: “Use the same email and password to manage your content in the WordPress dashboard.”

---

## Part 2: Letting them add / edit / delete their own posts in wp-admin

### Idea

- Each **contractor**, **producer**, and **rider** post should be “owned” by the linked WordPress user (`post_author` = that user).
- Animals “belong” to a contractor (or rider); events “belong” to a producer.
- In wp-admin, users should only see and edit **their own** posts (and related animals/events), not everyone’s.

So you need:

1. **Capabilities** so the roles can create/edit/delete the right post types.
2. **Ownership** so each CPT post has `post_author` = the linked user.
3. **Restrictions** in the admin so they only see their own posts (and for contractors: only their animals; for producers: only their events).

### 2.1 Who “owns” which post type

| Post type | Owner | How to set |
|-----------|--------|------------|
| **Rider** | Linked WP user | When rider is created (Join or by admin), set `post_author` = that user’s ID. |
| **Contractor** | Linked WP user | When contractor is created/linked, set `post_author` = that user. |
| **Producer** | Linked WP user | When producer is created/linked, set `post_author` = that user. |
| **Animal** | Contractor (or rider) | Either set `post_author` = contractor’s linked user, or filter by `contractor_id` meta so only “their” animals show. |
| **Event (rpn_event)** | Producer | Set `post_author` = producer’s linked user so they only see their events. |

### 2.2 Grant capabilities to roles

WordPress custom post types use **capability_type** (e.g. `post` or a custom one). By default, only admins can edit CPTs. You need to give:

- **rpn_rider:** edit their own rider profile (and maybe performances).
- **rpn_contractor:** edit their own contractor profile + create/edit/delete animals linked to them.
- **rpn_producer:** edit their own producer profile + create/edit/delete events they own.

The plugin can:

- Add **custom capabilities** for each CPT (e.g. `edit_animals`, `edit_rpn_contractor`, `edit_rpn_event`), and grant them to the right role.
- Or use **map_meta_cap** so “edit this animal” is allowed only if the current user is the linked contractor (or author).

Then in **wp-admin**, WordPress will only show “Animals” (or “Events”) and only list posts they’re allowed to edit.

### 2.3 Restrict admin lists to “their” content

- **Contractors:** In the Animals list in wp-admin, show only animals where `contractor_id` = their contractor post ID (or where `post_author` = their user ID if you set author when creating the animal).
- **Producers:** In the Events list, show only events where `post_author` = their user ID (or where `producer_id` = their producer post ID).
- **Riders:** In the Riders list, show only the rider post where `rpn_linked_user_id` = current user (or where `post_author` = current user).

This is done with **pre_get_posts** (and possibly **map_meta_cap**) in the plugin so that in wp-admin they never see other people’s posts.

### 2.4 When contractor/producer posts are created

Right now, Join creates a **rider** post for riders, but not contractor or producer posts. So either:

- **Option A:** When someone joins as contractor or producer, the plugin **creates** a draft (or published) contractor/producer post and links it to the new user (`rpn_linked_user_id`, and `post_author` = user ID). Then they can log in to wp-admin and edit that post and add animals/events.
- **Option B:** You keep creating contractor/producer posts **manually** in wp-admin, then link them: set **rpn_linked_user_id** to the user and **post_author** to that user. After that, they can log in and edit.

The guide and plugin changes below assume you want **Option A** for a smoother flow (and optionally keep Option B for manual linking).

---

## Part 3: Payment and “payment status active”

### Your 3 products

- You have **WooCommerce** (or similar) with 3 products; Join Us can send a **checkout link** in the email.
- “Payment status active” = the user has a **completed order** (or active subscription) for one of those products.

### How to know if a user’s payment is active

1. **Link orders to the user**  
   WooCommerce already ties orders to the customer (user) by email or account.

2. **Check “has active product”**  
   - When the user logs in (front-end or wp-admin), you can check:  
     “Does this user have at least one completed order for product X (e.g. premium)?”  
   - Store that in user meta (e.g. `rpn_payment_active`) and set it when an order is completed (WooCommerce hook `woocommerce_order_status_completed`), or compute it on each login.

3. **Use it to gate access**  
   - **Front-end:** Your React app already has a “dashboard”; you can show “Pay to activate” if `rpn_payment_active` is false (using your existing `/me` or dashboard API that can include a `payment_active` flag).
   - **wp-admin:** Before showing “Contractors / Animals / Events” and allowing edit, check the same. You can do this in the plugin: if the user has role contractor/producer/rider and `payment_active` is false, redirect them to a “Please complete payment” page or show a notice.

So: **no separate “payment dashboard”** – you use WooCommerce orders as the source of truth and expose “payment active” via your API and in wp-admin.

### Contractors/producers “collecting payment by themselves”

The client likely means: **event organizers (producers) or contractors can charge for events/entries**, and they get that money (or you handle it and pay them).

- **Option 1 – WooCommerce per event**  
  - Each event can have a **product** (e.g. “Entry – Event X”).  
  - Producer (or you) creates the product and event; customers buy on your site.  
  - Money goes to your Stripe/WooCommerce; you can later pay out producers/contractors (manual or with a plugin).

- **Option 2 – Event-specific checkout**  
  - “Register for this event” on the headless app sends the user to a WooCommerce checkout with the right product (event + price).  
  - Same as above: one order per registration; you know who paid for which event.

- **Option 3 – Producers have “their” products**  
  - If producers can create events in wp-admin, they could also create a **WooCommerce product** per event (or you provide a simple “Event product” template).  
  - Orders for that product are tied to the event; you can report “Event X sold Y entries” and use that for payouts.

So: **manage payments with WooCommerce (your 3 products + event products)**; “they collect payment” = you enable them to have events/products that people pay for, and you track it in WooCommerce and can report or pay out.

---

## Part 4: QR code (Digital ID) and check-in – how it works

### Where the member gets the QR code

- **Already:** The **rider profile** on the headless site shows a **Digital ID** card with a **QR code** (for premium members or when active).
- You can also:
  - Show the same QR (or a link to the profile) in the **React dashboard** after login.
  - Optionally show it in **wp-admin** on a simple “Your Digital ID” page for riders.
  - Optionally attach a **link or image** in the welcome email after payment (“Your Digital ID: [link]”).

So: **primary place = rider profile page on the headless site**; optional = dashboard, wp-admin, or email.

### What’s inside the QR code

- The QR should encode a **URL** that your site or API can understand, for example:
  - `https://yoursite.com/checkin/TOKEN` or  
  - `https://yoursite.com/verify?id=RIDER_ID` or  
  - A signed token that contains rider ID + expiry.

So when someone **scans** the QR, their phone opens that URL. No separate “QR app” is required unless you want a dedicated scanner app.

### How check-in works (event staff scanning)

1. **At the event:** Staff (producer/contractor) has a phone or tablet with a camera.
2. **Member shows** the QR on their phone (or a printed Digital ID).
3. **Staff scans** the QR with:
   - The **phone’s camera** (opens the URL in the browser), or  
   - A **simple scanner page** on your site (e.g. “Event check-in” page that uses the device camera to scan and then opens the URL), or  
   - A **dedicated scanner app** that reads the QR and calls your API.
4. **URL is opened** (or API is called):
   - Your backend receives: “This QR = rider X (or token).”
   - You **record check-in:** e.g. “Rider X checked in at Event Y at time Z” (store in DB or post meta).
   - You show a **success screen**: “Checked in: Rider Name.”

### What you need to build (minimal)

| Piece | Where | Purpose |
|-------|--------|--------|
| **QR content** | Rider profile (already there) | Encode URL like `https://yoursite.com/checkin?token=...` or `.../verify?id=123`. |
| **Check-in / verify page** | Headless app or WordPress | Route like `/checkin?token=...` or `/verify?id=...` that: (1) validates token or ID, (2) records check-in for current event (event ID can be in URL or selected by staff), (3) shows “Checked in” or “Invalid”. |
| **Check-in API** (optional) | Plugin REST | e.g. `POST /rpn/v1/checkin` with `token` or `rider_id` + `event_id`; only allowed for logged-in producers/contractors (or staff). Saves check-in in DB. |
| **Scanner UI** (optional) | Headless app | A page “Event check-in” where staff selects event and uses device camera to scan QR; on scan, open the URL or call the check-in API. |

So: **you don’t “scan” inside WordPress** – the scan happens on a phone/tablet; the **result** is opening a URL (or calling an API) that your **site/plugin** handles. That URL/API is “where” the QR is “scanned” from a logic perspective.

### Summary flow

1. **Member** gets QR on rider profile (and optionally email/dashboard).
2. **At event**, member shows QR.
3. **Staff** scans with camera or scanner page; browser (or app) opens your URL.
4. **Your site/API** validates, records “Rider X checked in at Event Y,” shows success.
5. You can later show “Who checked in” for that event in wp-admin or in the headless app.

---

## Part 5: What to do next (implementation checklist)

### A. WordPress dashboard access

- [ ] **Welcome email:** Add the WordPress dashboard link (`yoursite.com/wp-admin`) and a line: “Use the same email and password to manage your content.”
- [ ] **Plugin: capabilities** – Grant `rpn_contractor` / `rpn_producer` / `rpn_rider` the right `edit_*` / `delete_*` capabilities for the CPTs they’re allowed to manage.
- [ ] **Plugin: ownership** – When creating or linking contractor/producer/rider, set `post_author` to the linked user; when a contractor creates an animal, set `post_author` or `contractor_id` so it’s “theirs”; same for producer and events.
- [ ] **Plugin: restrict admin** – Use `pre_get_posts` (and optionally `map_meta_cap`) so in wp-admin they only see and edit their own contractor/producer/rider and their animals/events.
- [ ] **Optional:** On Join as contractor/producer, auto-create a contractor/producer post and link it to the user so they have something to edit in wp-admin right away.

### B. Payments

- [ ] **WooCommerce:** Ensure your 3 products are set up and the Join flow sends the correct checkout link.
- [ ] **“Payment active”:** On `woocommerce_order_status_completed`, set user meta (e.g. `rpn_payment_active`) or a “product X purchased” flag; expose it in your `/me` or dashboard API for the React app.
- [ ] **Gate wp-admin** (optional): If payment is required before managing content, check that flag when they load wp-admin and redirect or show a notice if not active.
- [ ] **Contractors/producers collect payment:** Use WooCommerce products per event (or one product “Event entry”) and tie orders to events; use reports or a simple admin view for “payments per event.”

### C. QR and check-in

- [ ] **QR URL:** Ensure the Digital ID QR on the rider profile encodes a URL like `https://yoursite.com/checkin?token=...` (or `id=...`) that your site will handle.
- [ ] **Check-in page or API:** Add a route (e.g. `/checkin`) that accepts the token or rider ID, optionally event ID (or “current event” chosen by staff), and records check-in; return a simple “Checked in” page or JSON.
- [ ] **Check-in storage:** In the plugin, store check-ins (e.g. post meta on the event, or a custom table: rider_id, event_id, time, scanned_by).
- [ ] **Optional:** A “Scanner” page on the headless app where staff selects event and scans QR; on scan, open the check-in URL or call the check-in API.

Once these are in place, contractors and producers can log in to **wp-admin** with the same credentials from the welcome email, and you’ll have a clear path for payments and QR check-in as described above.
