# WordPress Pages & Join Form Setup

How to set up the **About Us**, **Join Us**, and **footer** content from WordPress.

---

## 1. About Us page

- In WordPress: **Pages → Add New** (or edit existing).
- **Title:** About Us  
- **Slug:** `about-us` (Permalinks: Post name).
- The React app has a static **About Us** page at `/about-us` with mission, what we do, values, and CTA. You do **not** need to add body content in WordPress for the app to show this page; the app renders its own layout.
- **Optional:** To drive content from WordPress later, you can add a REST endpoint that returns the About page content and have the app fetch it. For now the app uses static content.

---

## 2. Join Us page & form

- The React app has a **Join Us** page at `/join-us` with:
  - **Membership Benefits** (static: RPI, Analytics, Verified Status, Producer Toolkit).
  - **Registration form:** Joining as, Membership plan, First/Last name, Email, Organization, Producer License ID (optional), Terms checkbox, “Complete Registration” button.

**Form submission (recommended):**

- The app submits the form to **`POST /wp-json/rpn/v1/join`** (RPN Headless plugin).
- The plugin sends an email to the site **Admin email** (Settings → General) with the submitted data.
- No Contact Form 7 is required for this to work.

**Using Contact Form 7 as well:**

- You can create a CF7 form in WordPress with the same fields for your own records or for a non-headless page.
- To have the **headless app** use CF7 instead of the RPN endpoint, you would need a plugin that exposes CF7 form submission via REST (e.g. “Contact Form 7 REST API”) and then change the app to POST to that CF7 endpoint. The current setup uses the RPN endpoint so you don’t need CF7 for the app.

**Membership plans dropdown:**

- The Join Us “Choose Your Membership Plan” dropdown is filled from the **homepage API** (`/wp-json/rpn/v1/homepage` → `membership_plans`) if you have ACF Options with `rpn_membership_plans`. Otherwise the app shows Basic / Pro / Premium.

---

## 3. Footer (links, social, contact)

- Footer content is **hardcoded in the React app** (Layout): Quick Links, Contact email/phone, Follow Us (Facebook, Twitter, Instagram), copyright.
- To make it editable from WordPress later, you could:
  - Add an ACF Options group for footer (columns, links, social URLs, contact text) and a REST endpoint that returns it, then have the app fetch and render it; or
  - Add a “Footer” options page and expose it via `/wp-json/rpn/v1/footer` (or similar) and wire the app to that.

For now, to change footer text or links, edit `src/pages/Layout.jsx` (footer section).

---

## 4. Summary

| Item           | Where it lives now        | Optional WordPress usage                    |
|----------------|---------------------------|---------------------------------------------|
| About Us       | React static page         | Create page with slug `about-us` (for URL)  |
| Join Us form   | React form → RPN endpoint | Use CF7 only if you add REST integration     |
| Membership plans| Homepage API (ACF)        | Set `rpn_membership_plans` in ACF Options   |
| Footer         | React Layout              | Add ACF/options + endpoint to drive later   |

Ensure the RPN Headless plugin is active so `/wp-json/rpn/v1/homepage` and `POST /wp-json/rpn/v1/join` work.
