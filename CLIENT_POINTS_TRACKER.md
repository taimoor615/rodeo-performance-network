# RIN — Client Points Tracker

Track every client-requested feature: implementation status and testing steps.

---

## Point 1 — Homepage Pop-Up Message

**Status:** DONE

**What was built:**
- `src/components/HomePopup.jsx` — popup component
- Shown once per browser session (uses `sessionStorage`), dismisses on close/button click
- "Share Your Feedback" → opens `mailto:info@rinrodeo.com`
- "Get Started" → navigates to `/join-us`
- Smooth fade + slide-up animation, fully responsive

**How to test:**

1. Open the app in the browser and go to the homepage (`/`)
2. After ~0.6 seconds, the popup should appear with title **"We're Building Something Big"**
3. Read the full message — verify all 3 paragraphs match the client's text
4. Click **Share Your Feedback** — your email client should open with `info@rinrodeo.com` pre-filled in the To field
5. Go back to the homepage and open the popup again (clear sessionStorage first — see step 7)
6. Click **Get Started** — you should be taken to `/join-us`
7. Click the **X** close button — popup dismisses
8. **Refresh the page** — popup should NOT reappear (it was dismissed this session)
9. To force the popup to show again: open DevTools → Application → Session Storage → delete the `rin_welcome_popup_dismissed` key → refresh
10. Resize the browser to mobile width (< 480px) — buttons should stack vertically, popup should fit the screen

---

## Point 2 — Signup Confirmation Popup

**Status:** DONE

**What was built:**
- Replaced `navigate('/thank-you?type=free')` in `src/pages/JoinUsPage.jsx` with an in-page popup
- Popup shows: *"Thank you for signing up. Please check your email for your login information."*
- Has a "Go to Login →" button that takes the user to `/login`
- Only appears for **free tier** signups — paid tier users are still redirected to WooCommerce checkout as before
- No dismiss/close button by design — user must click "Go to Login →"

**Email check result:**
- ✅ Login URL IS included in the signup email — two places:
  1. Server-side `wp_mail` in plugin (`rpn_join_callback`): `"Login to the site: {login_url}"`
  2. EmailJS template via `login_url: window.location.origin + LOGIN_URL`
- No changes needed to the email — it already contains the login link

**How to test:**

1. Go to `/join-us` and select the **Free** tier ("Fan Pass / Rider Preview")
2. Fill in: First Name, Last Name, a **real email you can check**, select "Rider"
3. Check the Terms checkbox and click **Create Free Profile**
4. The page should stay on `/join-us` — a popup should appear with:
   - Green checkmark icon
   - Title: **"You're in!"**
   - Message: *"Thank you for signing up. Please check your email for your login information."*
   - Button: **"Go to Login →"**
5. Click **"Go to Login →"** — should navigate to `/login`
6. Check the email inbox — you should receive an email with your temporary password and a login link
7. Verify the email contains the login URL (e.g., `https://rinrodeo.com/login`)
8. **Test paid tier is unaffected:** Select "Competitor Pro", fill the form, submit — it should show "Account created! Redirecting to payment…" and redirect to WooCommerce checkout (NOT show the popup)

**Edge case — already registered email:**
- Try submitting with an email that already has a WP account
- Should show an error message (not the popup)

---

## Point 3 — Email From Address & Branding

**Status:** PENDING — awaiting purchase of info@rinrodeo.com inbox

**What needs to happen (your action required):**
- Buy / set up `info@rinrodeo.com` inbox via your hosting provider (cPanel → Email Accounts)
- In EmailJS dashboard → Email Services → connect SMTP with `info@rinrodeo.com` credentials
- In EmailJS → Email Templates → `template_iypgqxr` → update subject to `Welcome to RIN — Your Account Is Ready` and paste the branded HTML template (provided in the chat above)

**What is already done in code:**
- WordPress `wp_mail` (backup email) now sends from `RIN Rodeo <info@rinrodeo.com>` with branded HTML
- Admin notification subject updated from `[RPN]` to `[RIN]`

**How to test (once email is set up):**
1. Sign up as a new free user with a real email you can check
2. Check inbox — should arrive from `info@rinrodeo.com`, subject `Welcome to RIN — Your Account Is Ready`
3. Email should show navy header with "RIN / Rodeo Information Network", red accent bar, credentials box, red "Log In to RIN →" button

---

## Point 4 — Add Score Button Not Working

**Status:** DONE

**Root cause:**
The score form was gated behind `tierGte(tier, 'competitor')` in `DashboardPage.jsx`. Free users clicked the button (it toggled to "Cancel"), but the form condition evaluated to `false` so nothing ever rendered.

**Fixes applied (all in `src/pages/DashboardPage.jsx`):**
1. Removed `tierGte(tier, 'competitor') &&` from the score form condition — form now shows for all users
2. Removed `tierGte(tier, 'competitor')` from the empty-state message — free users now see "No results yet" placeholder

**How to test:**
1. Log in as a **free** user → go to Dashboard → click the "Post Score" tab
2. Click **+ Log Result** button — the full score entry form should appear (not just change button text to Cancel)
3. Fill in the form: select event category, enter scores/time, fill event name → click Submit Score
4. Verify a success message appears with RPI Preview value
5. Verify the result appears in the score history list below the form
6. Log in as a **paid** user → same test → should work identically but without the RPI Preview message

---

## Point 5 — Free Plan Can Log Results, Cannot See RPI

**Status:** DONE

**Behavior after fix:**

| User | Can log results | Can see RPI |
|------|----------------|-------------|
| Free | ✅ Yes | ❌ No (sees blurred Preview after first result) |
| Paid | ✅ Yes | ✅ Yes (full RPI) |

**All places this was fixed or verified:**

| Location | What | Status |
|---|---|---|
| `DashboardPage.jsx` score form | Removed tier gate | Fixed |
| `DashboardPage.jsx` RPI display block | Free users now always enter the free branch — never see actual `rpi` value | Fixed |
| `DashboardPage.jsx` RPI "no data" state | Free users with no scores see "Log your first result" + upgrade link | Fixed |
| `DashboardPage.jsx` empty score history | Removed tier gate | Fixed |
| Plugin `rpn_my_scores_post_callback` | `$is_free` stores only `rpi_preview`, never updates actual `rpi` | Already correct |
| Plugin `rpn_my_scores_get_callback` | No tier gate — free users can fetch their score history | Already correct |
| Plugin `rpn_profile_get_callback` | Returns `rpi_preview` in profile response | Already correct |

**How to test:**

1. **Free user — first login, no scores yet:**
   - Log in as a free user
   - Go to Stats & Rankings tab
   - RPI card should show a locked "RPI 🔒" with a dash (—) and "Log your first result" prompt
   - No actual RPI number should be visible

2. **Free user — submit a score:**
   - Go to Post Score tab → click + Log Result
   - Fill out form completely (event category, covered/time, event name) → Submit
   - Success message should say: `Result logged! Your RPI would be X.X — upgrade to unlock it.`
   - Go back to Stats & Rankings → RPI card should now show a **blurred** number with "Your RPI would be X.X — upgrade to Competitor Pro"

3. **Free user — verify RPI stays hidden:**
   - Refresh the page
   - Stats tab → RPI card → blurred preview visible, no plain RPI number
   - Open browser DevTools → Network → check `/rpn/v1/profile` response — `rpi` field should be `0` or unchanged; `rpi_preview` should have the value

4. **Paid user — verify RPI shows normally:**
   - Log in as a competitor/contractor/organizer user
   - Stats tab → should show clear "Overall RPI" number (not blurred, no preview message)
   - Post Score → Submit → success message should NOT say "RPI Preview"

5. **Score history visible to both:**
   - Both free and paid users should see their submitted scores listed under the form
   - Score rows should NOT show any RPI values (they show event name, score, date only)

---

## Point 6 — Users Added From Backend / Password Flow

**Status:** DONE

**Problems fixed:**
1. Users created from WP Admin backend were being redirected to the WooCommerce My Account page instead of the React dashboard
2. Password reset/new-user emails contained WP admin URLs (`/wp-admin/...`) instead of React app URLs
3. No React-side page existed to set or reset a password — users had to go through WordPress UI

**What was built:**

| Item | Location | What |
|------|----------|-------|
| Login redirect fix | Plugin `login_redirect` filter | All non-admin users → React `/dashboard` |
| WooCommerce redirect fix | Plugin `woocommerce_login_redirect` filter | Non-admin WC logins → React `/dashboard` |
| `rpn_get_react_app_url()` | Plugin helper | Reads `rpn_react_app_url` WP option (default: `https://rinrodeo.com`) |
| Password reset email | Plugin `retrieve_password_message` filter | Branded HTML, React `/set-password?key=&login=` URL |
| New user welcome email | Plugin `wp_new_user_notification_email` filter | Branded HTML, React `/set-password?key=&login=` URL |
| `/forgot-password` | `src/pages/ForgotPasswordPage.jsx` | Email form → calls `/rpn/v1/request-password-reset` |
| `/set-password` | `src/pages/SetPasswordPage.jsx` | `?key` + `?login` params → calls `/rpn/v1/set-password` |
| "Forgot password?" link | `src/pages/LoginPage.jsx` | Link above "New to RIN?" footer |
| New REST endpoints | Plugin | `POST /rpn/v1/request-password-reset`, `POST /rpn/v1/set-password` |

**One-time WordPress setup required (production):**
- Go to WP Admin → Settings → General (or any options page)
- Or run in WP CLI: `wp option update rpn_react_app_url https://rinrodeo.com`
- This is what gets prepended to all React URLs in emails — defaults to `https://rinrodeo.com` if not set

**How to test:**

### A — Login redirect (user added from WP backend)

1. Log into WP Admin → Users → Add New
2. Create a user with role "Subscriber" (or any non-admin role) — note the username/email
3. Log out of WordPress
4. Go to `https://rinrodeo.com/wp-login.php` and log in with those credentials
5. You should be redirected to the **React dashboard** (`/dashboard`), NOT to `/my-account` or WP Admin
6. Repeat the same test but log in via WooCommerce My Account (`/my-account`) — should also land on React `/dashboard`

### B — Password reset email (forgot password flow)

1. Go to `/forgot-password` in the React app
2. Enter a registered email address and submit
3. You should see: *"Check your email — we sent a reset link to [email]"*
4. Check the inbox — email should:
   - Come from `info@rinrodeo.com` (or configured from address)
   - Subject: `Reset your RIN password`
   - Contain a button/link that goes to `/set-password?key=...&login=...` on the **React app** (not WP admin)
   - Be formatted with navy header, red accent bar (branded HTML)
5. Click the link — you should land on the React `/set-password` page with the form visible (not an "Invalid Link" message)

### C — Set password page

1. Using a valid reset link from step B above, land on `/set-password`
2. Enter a new password (at least 8 characters) in both fields
3. Passwords must match — if they don't, you should see an inline error and the form should NOT submit
4. If password is under 8 characters, you should see an error: *"Password must be at least 8 characters"*
5. Submit valid matching passwords — success message should appear: *"Password updated! Redirecting to login…"*
6. After ~2.5 seconds you should be auto-redirected to `/login`
7. Log in with the new password — it should work

### D — New user email (user added from backend)

1. Log into WP Admin → Users → Add New → create a new user (Subscriber role)
2. Check the **new user's inbox** — they should receive:
   - Subject: `Set Your RIN Password` (or similar branded subject)
   - A link to `/set-password?key=...&login=...` on the React app (not WP admin)
   - Branded HTML (navy header, red bar, CTA button)
3. Click the link and complete the password set flow (steps C above)

### E — Invalid / expired reset link

1. Manually visit `/set-password` with no query params (e.g., `http://localhost:5173/set-password`)
2. Should show: *"Invalid or expired link"* with a link back to `/forgot-password`
3. Try an expired key (use an old reset link) — WordPress will reject it and the form should show an error

---

---

## Point 7 — Rider ↔ Animal Bidirectional Linking

**Status:** DONE

**Problem:**
- Rider profile pages showed linked animals correctly (via `linked_animals` meta on the rider post)
- But animal profile pages always showed "No riders linked" even when a rider had claimed or added that animal
- The claim-animal and add-animal flows were a one-way street: they added the animal to the rider's list but never added the rider to the animal's list

**Root cause:**
Both `rpn_claim_animal_callback` and `rpn_my_animals_post_callback` in the plugin updated the rider profile post's `linked_animals` array, but neither one updated the animal post's `linked_riders` array. `AnimalDetailPage.jsx` already had the full "Rider History" section built — it just had no data to display.

**What was changed:**

| File | Function | Change |
|------|----------|--------|
| `wordpress-plugin/rpn-headless-plugin.php` | `rpn_claim_animal_callback` | After claiming, adds `$linked_rider_id` to animal's `linked_riders` meta array |
| `wordpress-plugin/rpn-headless-plugin.php` | `rpn_my_animals_post_callback` | After creating, adds `$linked_rider_id` to new animal's `linked_riders` meta array |

No frontend changes were needed — `AnimalDetailPage.jsx` already reads `linked_riders` and renders the Rider History section with profile cards and links.

**How the link works:**
- User meta `rpn_linked_rider_id` → rider CPT post ID
- When claim/add succeeds, that rider post ID is appended to the animal's `linked_riders` array (stored in post meta, exposed via REST)
- `AnimalDetailPage.jsx` reads `animal.meta.linked_riders`, fetches those rider posts, and renders them as clickable profile cards

**How to test:**

### A — Claim an existing animal (rider dashboard)

1. Log in as a rider user (must have a linked rider profile post, i.e. `rpn_linked_rider_id` set in user meta)
2. Go to Dashboard → Animals tab → search for an unclaimed animal by name
3. Click **Claim** on a result
4. You should see a success message
5. Now go to `/animals/[that-animal-slug]` in the browser
6. Scroll to the **Rider History** section — you should see the rider's profile card with their name and RPI badge
7. Click the rider card — it should link to `/riders/[rider-slug]`
8. On the rider's detail page, verify the animal also appears in their linked animals section

### B — Add a new animal (rider dashboard)

1. Log in as a rider user
2. Go to Dashboard → Animals tab → click **Add New Animal**
3. Fill in animal name, type (Bull/Horse/Steer), scoring type, and any other details → Submit
4. Once added, navigate to the new animal's public profile (go to `/animals` and find it, or note the `animal_id` from the success response)
5. Open the animal's page → scroll to **Rider History** — the creating rider should appear as a linked rider card
6. Also verify the animal appears under the rider's profile on `/riders/[rider-slug]`

### C — Verify animals with no rider (edge case)

1. Go to `/animals` and find an animal that has never been claimed or added via the dashboard (e.g., one imported by admin with no `linked_riders` set)
2. Open that animal's page → Rider History section should show: *"No riders linked to this animal yet."* — not an error, just the placeholder

### D — WP Admin manual linking (admin override)

1. In WP Admin → Animals → edit any animal
2. Find the `linked_riders` custom field and add a rider post ID (integer)
3. Save the post
4. Visit the animal's public page → that rider should appear in Rider History

**Note:** The fix only applies to **new** claim/add actions going forward. Animals that were claimed before this fix was deployed will not automatically show their riders. To backfill: in WP Admin, manually add the rider post ID to the `linked_riders` field of those animals, OR the rider can unclaim and re-claim (if an unclaim feature is added).

---

---

## Point 8 — Image Crop Tool

**Status:** DONE

**What was built:**
- `src/components/ImageCropModal.jsx` — reusable crop modal using `react-image-crop`
- Opens as a fullscreen overlay over the dashboard when user selects a photo
- Drag the crop box to reposition; drag corners to resize — the selected area becomes the thumbnail
- On "Apply Crop →": canvas renders the crop at full resolution → saved as JPEG → uploaded to WP on form save
- "Cancel" closes without making any change
- Integrated in two places:
  - **Profile photo** (DashboardPage.jsx) — 1:1 aspect ratio (square)
  - **Animal featured image** (AnimalFormFields in DashboardPage.jsx) — 4:3 aspect ratio

**How to test:**

1. Log in and go to **Dashboard → Edit Profile**
2. Scroll to **Profile Photo** and click "Choose File" (or "Browse")
3. Select any JPG or PNG — the **crop modal opens immediately** instead of just showing a preview
4. Drag the square crop box to frame the desired area; drag corner handles to resize
5. Click **Apply Crop →** — the modal closes and the cropped square preview appears in the form
6. Save the profile — the cropped image should appear as your profile photo
7. Go to **Dashboard → Animals → Add New Animal** (or edit an existing one)
8. Scroll to **Animal Photo** and select a photo — the crop modal opens with a 4:3 frame
9. Crop to the desired area → Apply Crop → preview shows in the form
10. Save — the cropped photo should appear on the animal's public profile page

**Edge cases:**
- Clicking outside the crop modal (on the dark overlay) dismisses it without changing anything
- Selecting a file then cancelling crop leaves the form unchanged (no broken preview)
- Re-selecting a file after cancel opens a fresh crop session

---

## Point 9 — Manually Added Users – Password System

**Status:** DONE

**Problem:**
When an admin manually adds a user from WP Admin → Users → Add New, there was no clear way to send them login credentials or a password setup link.

**What was built (all in `wordpress-plugin/rpn-headless-plugin.php`):**

| Feature | Where | What it does |
|---------|-------|-------------|
| **"Send RIN Credentials" button** | WP Admin → Users → Edit User → RIN section | Shows a "Send RIN Set-Password Email" button with inline success/fail feedback |
| **Row action** | WP Admin → Users list | "Send RIN Credentials" link appears under each non-admin user's name |
| **Bulk action** | WP Admin → Users list → Bulk Actions dropdown | Select multiple users → "Send RIN Credentials" → sends all at once |
| **Admin notice** | Users list page | Green/red dismissible notice after any send showing email address and result |

**Email sent:** Same branded set-password email as Point 6 — navy header, red accent, "Set My Password →" button pointing to `/set-password?key=...&login=...` on the React app. Link expires in 24 hours.

**Note:** The new-user notification email already fires automatically when a user is added via WP Admin (from Point 6). This feature adds the ability to **resend** credentials at any time — for users who missed the email, or who were added before the plugin was deployed.

---

**How to test:**

### A — Auto email on Add New User (from Point 6, verify still works)

1. Log into WP Admin → Users → Add New
2. Fill in username, email, set role to Subscriber — **check "Send User Notification"**
3. Click Add New User
4. Check the new user's inbox — they should receive:
   - Subject: `Welcome to RIN — Set Your Password`
   - A link to `/set-password?key=...&login=...` on the React app (not WP admin)
   - Branded HTML (navy header, red accent bar, CTA button)

### B — Row action (resend to a single user)

1. WP Admin → Users
2. Hover over any non-admin user's name — below the name you'll see extra links: Edit | Delete | **Send RIN Credentials**
3. Click **Send RIN Credentials**
4. You'll be redirected back to the Users list with a green notice: *"RIN set-password email sent successfully to user@email.com."*
5. Check that user's inbox — they should receive the same branded set-password email
6. Click the link in the email → lands on React `/set-password` → set a password → redirects to `/login`

### C — User profile edit button

1. WP Admin → Users → click **Edit** on any non-admin user
2. Scroll down to the **RIN — Rodeo Identification Network** section
3. Find the **Send RIN Credentials** subsection
4. Click **Send RIN Set-Password Email**
5. Page redirects to the Users list with a green/red notice
6. If sent successfully: check that user's inbox for the branded email

### D — Bulk action (send to multiple users at once)

1. WP Admin → Users
2. Check the checkboxes next to 2–3 non-admin users
3. In the **Bulk actions** dropdown at the top, select **Send RIN Credentials** → click **Apply**
4. The page refreshes with a notice: *"RIN Credentials: X emails sent successfully"* (or partial if some failed)
5. Check the inboxes of those users — each should have received the set-password email

### E — Error case (bad email config)

1. If email is not configured, the notice will show in red: *"Failed to send RIN credentials — check your WordPress email configuration."*
2. Fix: install and configure WP Mail SMTP plugin, or ensure your hosting SMTP is set up

### F — Admin users excluded

1. On the Users list, hover over an **Administrator** account
2. The "Send RIN Credentials" row action should **not** appear for admins (they don't need it)

---

## Point 15 — Membership Rules

**Status:** DONE

**Requirements implemented:**
1. Stock contractors and event producers get a **3-month free trial** (no payment required at signup)
2. Competitor Pro riders see **no upgrade path** to Stock Contractor or Event Organizer from the dashboard
3. The only upgrade path for riders is **Free Plan → Competitor Pro**

---

**What was built:**

### WordPress Plugin (`rpn-headless-plugin.php`)
- **Trial tier assignment on signup:** When `joining_as` is `contractor` or `producer`, the correct tier (`contractor` or `organizer`) is granted immediately. `rpn_trial_expires` (3 months ahead) and `rpn_trial_tier` are saved as user meta.
- **Server-side enforcement:** Even if the client submits a wrong plan, the server overrides the tier based on `joining_as`.
- **No checkout URL for trial roles:** `checkout_url` is skipped — no payment needed at signup.
- **Branded trial email block:** Welcome email for contractors/producers includes a green "3-Month Free Trial Active" section showing the expiry date and post-trial rate.
- **Profile GET endpoint:** Now returns `trial_expires`, `trial_tier`, and `joining_as` fields.
- **Trial expiration cron:** Daily WP cron job (`rpn_check_trial_expirations`) finds users with expired `rpn_trial_expires` and downgrades them to `free`. Cron schedules itself on `init`.
- **Admin profile display:** Membership Tier row in WP Admin user profile shows "(Free trial — expires YYYY-MM-DD)" if a trial is active.

### React — `src/pages/JoinUsPage.jsx`
- `TIERS` constant: `rin_contractor` and `rin_organizer` now have `trialMonths: 3` and CTA `'Start 3-Month Free Trial'`.
- **Auto-select plan by role:** `useEffect` auto-selects `rin_contractor` when `joiningAs === 'contractor'` and `rin_organizer` when `joiningAs === 'producer'`; resets for rider/pickup_team.
- **Filtered plan dropdown:** `availableTiers` filters by `joiningAs` — riders/pickup_team see only Free + Competitor Pro; contractors see only Stock Contractor; producers see only Event Organizer.
- **Trial badge on plan cards:** Contractor and Organizer cards show a green "3 months free to start" badge.
- **Submit button text:** Shows "Start 3-Month Free Trial →" when a trial plan is selected.
- **Page description:** Updated to mention 3-month trial for contractor/organizer tiers.

### React — `src/pages/DashboardPage.jsx` (Membership tab)
- **Free tier:** Shows upgrade card for **Competitor Pro only** (contractor/organizer cards removed).
- **Competitor tier:** Shows "You're on Competitor Pro" message explaining why contractor/organizer upgrades are not available from the dashboard.
- **Contractor/Organizer/Enterprise:** Shows "You are on the [Plan] plan" message.
- **Trial expiry banner:** If `profile.trial_expires` is set, shows a green banner with the expiry date and link to contact for billing.

### `src/App.css`
- `.dashboard-trial-banner` — green left-bordered info card for trial status in dashboard
- `.join-plan-trial-tag` — small green pill badge on contractor/organizer plan cards

---

---

## Complete Step-by-Step Testing Guide (Point 15)

> **What you need before starting:**
> - WordPress running (XAMPP — `http://localhost/rodeo-performance-network/wp-admin/`)
> - React app running (`npm run dev` in the project folder — usually `http://localhost:5173`)
> - The updated plugin uploaded to WordPress (`wordpress-plugin/rpn-headless-plugin.php` → replace in WP)
> - A browser window open for the React app and another for WP Admin

---

### STEP 1 — Test: Stock Contractor signup gets 3-month free trial

**Goal:** Verify that a contractor who signs up gets their tier immediately, with no payment, and a trial expiry date saved.

1. Open the React app → go to **`/join-us`**
2. Scroll down to the **"Create Your Account"** form
3. In the **"Joining As"** dropdown → select **Stock Contractor**
4. **Check the plan dropdown immediately** — it should auto-switch to **Stock Contractor** (only option; Fan Pass and Competitor Pro disappear)
5. Scroll back up to the plan cards — the **Stock Contractor card** should show a small green **"3 months free to start"** badge near the top
6. Back in the form: fill in First Name, Last Name, Email (use a test email you can check), agree to terms
7. The submit button should say **"Start 3-Month Free Trial →"**
8. Click submit
9. **Expected result:** You see "Account created. Check your email…" — NOT redirected to any payment page

**Verify in WP Admin:**
1. Go to `wp-admin → Users`
2. Find the user you just created
3. Hover over their name → click **Edit**
4. Scroll down to the **"RIN — Rodeo Identification Network"** section
5. Look at **Membership Tier** — it should say: `Contractor (Free trial — expires YYYY-MM-DD)` (date 3 months from today)
6. Look at **Trial Expiry Date** field — should show the same date (e.g., `2026-08-02`)

---

### STEP 2 — Test: Event Producer signup gets 3-month free trial

Same as Step 1 but:
1. **"Joining As"** → select **Producer**
2. Plan auto-selects **Event Organizer**
3. Submit → no payment redirect
4. In WP Admin: tier shows `Organizer (Free trial — expires YYYY-MM-DD)`

---

### STEP 3 — Test: Rider sees only Free + Competitor Pro (no contractor/organizer options)

**Goal:** Confirm riders cannot accidentally pick contractor/organizer plans.

1. Go to **`/join-us`**
2. **"Joining As"** → select **Rider / Competitor** (default)
3. Look at the **Membership Plan** dropdown in the form
4. **Should show:** Fan Pass (Free) and Competitor Pro only
5. **Should NOT show:** Stock Contractor or Event Organizer
6. Optional: switch to **Producer** then back to **Rider** — the dropdown should reset and only show rider options

---

### STEP 4 — Test: Dashboard for a free-tier rider (only Competitor Pro upgrade visible)

**Goal:** Verify free riders can only upgrade to Competitor Pro, not to contractor/organizer tiers.

1. Log in to the React app as a **free-tier rider**
   - If you don't have one: sign up via `/join-us` as a Rider with Fan Pass plan
2. Go to **Dashboard → Membership tab** (click "Membership" in the sidebar)
3. **Should see:**
   - "Your Current Plan: Fan Pass / Rider Preview (Free)"
   - One upgrade card: **Competitor Pro — $9.99/mo** with "Upgrade to Competitor Pro" button
4. **Should NOT see:** Stock Contractor or Event Organizer upgrade cards
5. Toggle the **Monthly / Yearly** button — Competitor Pro price should change to $89/yr
6. Click **Upgrade to Competitor Pro** — should go to the checkout page

---

### STEP 5 — Test: Dashboard for a Competitor Pro rider (no upgrade path shown)

**Goal:** Confirm competitor-tier riders see a clear "you're at the top" message with no upgrade buttons.

1. Log in as a **competitor-tier rider**
   - You can manually set a user's tier: WP Admin → Users → Edit user → RIN section → change **Membership Tier** dropdown to `Competitor` → click **Update User**
2. Go to **Dashboard → Membership tab**
3. **Should see:**
   - "Your Current Plan: Competitor Pro"
   - A card titled **"You're on Competitor Pro"** with a message explaining contractor/organizer are separate roles
4. **Should NOT see:** Any upgrade buttons or pricing

---

### STEP 6 — Test: Dashboard trial banner for contractor/organizer users

**Goal:** Verify the green trial banner appears for active trial users.

1. Log in as the contractor user you created in Step 1
2. Go to **Dashboard → Membership tab**
3. **Should see at the top:**
   - A green card: **"Free Trial Active"**
   - Message: "Your 3-month free trial expires on [date]. After that your account will be downgraded to the free plan. Contact us at info@rinrodeo.com to set up billing before then."
4. Below the banner: "You are on the **Stock Contractor** plan. Thank you for being a top RIN member!"
5. **No** upgrade pricing cards visible

---

### STEP 7 — Test: Manually expire the trial and run the cron

**Goal:** Simulate what happens when a trial expires — the user gets downgraded to free.

**Step 7a — Set the trial date to a past date:**
1. WP Admin → Users → Edit the contractor/organizer test user
2. Scroll to the **RIN section → "Override RIN Fields"** table
3. Find the **"Trial Expiry Date"** field — it shows a date picker with the current trial date
4. Change the date to a past date: type `2020-01-01`
5. Click **Update User** (the blue button at the bottom of the page)
6. The field should now show `2020-01-01` and the Membership Tier line should still show the contractor/organizer tier

**Step 7b — Run the trial expiration cron:**
1. Still on the same user edit page, scroll to the Trial Expiry Date field
2. Click the **"Run Trial Expiration Check Now"** button that appears below the date field
3. WP Admin refreshes and shows a green notice: **"RIN: Trial expiration check ran — expired trial accounts have been downgraded to free."**

**Step 7c — Verify the user was downgraded:**
1. Stay on the user edit page (or re-open it)
2. Scroll to the RIN section
3. **Membership Tier** should now show: `Free` (no trial label)
4. **Trial Expiry Date** field should be empty
5. Log in to the React app as this user → Dashboard → Membership tab should now show the free-tier upgrade card for Competitor Pro

---

### STEP 8 — Restore the user after testing

After testing the expiry, you can restore the user to contractor tier:
1. WP Admin → Users → Edit the user
2. **Membership Tier** dropdown → change back to `Contractor`
3. **Trial Expiry Date** → set to a future date (e.g., 3 months from today: `2026-08-02`)
4. Click **Update User**
5. Log back in to the React app → the green trial banner should reappear with the new date

---

### STEP 9 — Quick summary checklist

| Test | What to check | Expected |
|------|--------------|----------|
| Contractor signup | Plan dropdown in form | Only "Stock Contractor" visible |
| Contractor signup | Submit button text | "Start 3-Month Free Trial →" |
| Contractor signup | After submit | No payment redirect; "Account created" message |
| Contractor signup | WP Admin → User tier | "Contractor (Free trial — expires YYYY-MM-DD)" |
| Producer signup | After submit | Organizer tier, no checkout |
| Rider signup | Plan dropdown | Only Free + Competitor Pro |
| Dashboard (free rider) | Membership tab | One card: Competitor Pro only |
| Dashboard (competitor) | Membership tab | "You're on Competitor Pro" message, no buttons |
| Dashboard (contractor on trial) | Membership tab | Green "Free Trial Active" banner |
| Trial expiry | After setting past date + running cron | Tier → free, date field cleared |

---

## Point 20 — Membership Upgrade Layout (Yearly Billing Prominent)

**Status:** DONE

**What was built:**
- **JoinUsPage** — The billing interval toggle (Monthly/Yearly) was already present visually but the selected interval was not being passed to the WooCommerce checkout URL. Fixed `effectiveTierKey` logic to resolve to yearly product keys (`rin_competitor_yearly`, `rin_contractor_yearly`, `rin_organizer_yearly`) when the user selects Yearly billing. The product ID and checkout URL now correctly reflect the chosen billing cycle.
- **CheckoutPage** — Updated `PLAN_INFO` with current pricing: Competitor Pro ($9.99/mo | $89/yr), Stock Contractor ($29.99/mo | $249/yr), Event Organizer ($79.99/mo | $649/yr). Added contractor and organizer plan entries. Fixed trial description from "1st month free" to "3 months free".  Added a "Save ~25% vs monthly billing" badge when yearly is selected.
- **DashboardPage** — Changed default billing toggle from Monthly to **Yearly** so yearly pricing is pre-selected. Updated "Save ~15%" label to "Save ~25%". The upgrade button now uses the pre-fetched WooCommerce URL directly (instant redirect) when available; falls back to the internal checkout page route if the URL hasn't loaded yet.

**Files changed:**
- `src/pages/JoinUsPage.jsx` — `effectiveTierKey` computation (resolves yearly product keys)
- `src/pages/CheckoutPage.jsx` — `PLAN_INFO` pricing update; yearly savings badge
- `src/pages/DashboardPage.jsx` — default billing toggle is now 'year'; uses `upgradeUrls` for direct WC redirect
- `src/App.css` — added `.checkout-yearly-save` style

---

### How to test

#### STEP 1 — JoinUsPage: Verify yearly plan selection during signup

1. Go to `/join-us` in the browser
2. Scroll to the **Membership Plans** section — you should see a **Monthly / Yearly** toggle above the plan cards
3. Click **Yearly** — plan prices should update:
   - Fan Pass: Free (unchanged)
   - Competitor Pro: **$89/year** (was $9.99/month)
   - Stock Contractor: **$249/year** (was $29.99/month)
   - Event Organizer: **$649/year** (was $79.99/month)
4. Select **Competitor Pro** (yearly) → scroll down to the form
5. The **Selected:** summary in the form should show `Competitor Pro — $89/year`
6. Fill in the form with a test email and submit
7. Verify the WooCommerce checkout URL that you are redirected to contains `rin-competitor-yearly` (or the yearly product SKU) — NOT the monthly product

#### STEP 2 — JoinUsPage: Verify monthly still works

1. On `/join-us`, select **Monthly** from the billing toggle
2. Select **Competitor Pro** — the selected summary should show `$9.99/month`
3. Submit → WooCommerce checkout should add the monthly product (not yearly)

#### STEP 3 — JoinUsPage: Contractor and Organizer yearly

1. Change "Joining As" to **Producer** (auto-selects Organizer plan)
2. Click **Yearly** on the billing toggle
3. Form summary should show `Event Organizer — $649/year`
4. Submit → should redirect to WooCommerce with the yearly organizer product

#### STEP 4 — CheckoutPage: Verify updated pricing

1. Log in as a **free tier** user
2. Go to the Dashboard → Membership tab
3. The upgrade section should default to **Yearly** tab selected (not Monthly)
4. Click the **Upgrade to Competitor Pro** button → you should be taken to `/checkout?tier=competitor&billing=year` OR directly to WooCommerce (depending on whether the URL pre-loaded)
5. On the CheckoutPage, verify:
   - Plan name shows **"Competitor Pro"** (not "RIN Competitor")
   - Price shows **$89/year** (not $199/year — the old stale price)
   - "Save ~25% vs monthly billing" badge appears in the order summary
   - No "Free for 1st month" text (competitor doesn't have a trial)

#### STEP 5 — DashboardPage: Yearly is the default

1. Log in as a free tier user → go to Dashboard → Membership tab
2. The billing toggle should have **Yearly** selected by default (highlighted in red)
3. The price card should show **$89/yr** immediately without needing to click Yearly
4. Switch to **Monthly** → price updates to **$9.99/mo**
5. Switch back to **Yearly** → price returns to **$89/yr** with "Save ~25% vs monthly — renews October 1" note

#### STEP 6 — Quick checklist

| Test | What to check | Expected |
|------|--------------|----------|
| JoinUsPage billing toggle | Yearly clicked, Competitor Pro selected | Plan cards show $89/yr |
| JoinUsPage form summary | Yearly + Competitor Pro selected | Shows "$89/year" in summary |
| JoinUsPage submit (yearly) | WC redirect URL | Contains yearly product slug |
| JoinUsPage submit (monthly) | WC redirect URL | Contains monthly product slug |
| CheckoutPage plan name | `/checkout?tier=competitor&billing=year` | Shows "Competitor Pro" (not "RIN Competitor") |
| CheckoutPage price (yearly) | Yearly billing param | Shows "$89/year" + savings badge |
| CheckoutPage price (monthly) | Monthly billing param | Shows "$9.99/month" |
| DashboardPage default | Load membership tab | Yearly tab is pre-selected |
| DashboardPage upgrade btn | Yearly selected, WC URL loaded | Button is `<a>` linking directly to WC |

*Updated: 2026-05-02 — Points 1–2 done, 3 pending (email setup), 4–9 done, 15 done*
