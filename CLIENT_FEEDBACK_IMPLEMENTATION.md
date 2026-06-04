# Client Feedback Implementation Guide

All requested changes have been implemented. This guide explains **what was done**, **where to check**, and **dummy data** for testing.

---

## 1. Red, White & Blue Theme (rodeoperformance.com colors)

**Where:** Site-wide (header, footer, buttons, links)

**Colors used:**
- Red: `#B22234`
- White: `#FFFFFF`
- Blue: `#002868` (navy)
- Light background: `#f8fafc`

**How to check:** Run the app and visit any page. Header and footer use blue/red; buttons use blue primary, red hover.

---

## 2. Header: Logo + "Rodeo Performance Network"

**Where:** `src/pages/Layout.jsx`

**Change:** Logo shows "RPN" in a red badge + "Rodeo Performance Network" text. On mobile, only "RPN" shows.

**How to check:** View the header. You should see the full name next to the RPN badge.

---

## 3. Join Us: Plans at Bottom, Digital ID as Add-on

**Where:** `src/pages/JoinUsPage.jsx`

**Changes:**
- Plans (Basic, Premium, Pro) appear at the bottom with sign-up buttons
- Digital ID and Printed Card shown as add-ons: *"Custom ID cards ($5 digital, $25 printed with lanyard) can be added to any membership plan after sign-up. Digital ID includes a QR code for event check-in."*
- Plans link to WooCommerce checkout when products are configured

**How to check:** Go to `/join-us` and scroll to the bottom. Plans section uses a dark blue background with red accents.

---

## 4. Event Organizations (Producers)

**Where:** `/producers`, `/producers/:slug`

**New pages:**
- **ProducersPage** – Lists event organizations
- **ProducerDetailPage** – Organization profile with events, contact info

**Nav:** "Organizations" link added to header and footer.

**WordPress:** Create Producers in WordPress (CPT `rpn_producer`). Fields: `pri`, `verified`, `state`, `city`, `region`, `description`, `website`, `contact_email`.

**Dummy data (WordPress):**
- Title: `Texas Rodeo Association`
- pri: `85.2`
- city: `Fort Worth`
- state: `TX`
- region: `Southwest`
- description: `Premier rodeo event producer in Texas.`

---

## 5. Events: Search by City, State, Region

**Where:** `src/pages/EventsPage.jsx`

**Change:** Filters added:
- **City** – text input
- **State** – dropdown (US states)
- **Region** – dropdown (Southeast, Southwest, Midwest, etc.)

**WordPress:** Add `region` to events (e.g. `Southwest`, `Plains`).

**Dummy data:** Create events with:
- city: `Denver`
- state: `CO`
- region: `Mountain`

Then filter by City "Denver", State "CO", or Region "Mountain" on the Events page.

---

## 6. Animals: Unique Number, Timed vs Rough Stock, Bloodlines

**Where:** `src/pages/AnimalDetailPage.jsx` + WordPress plugin

**New WordPress fields (Animal CPT):**
| Field          | Type   | Description                                                |
|----------------|--------|------------------------------------------------------------|
| `unique_number`| string | Permanent ID for the animal (e.g. `B-1042`, `H-0891`)     |
| `scoring_type` | string | `timed` (barrel racing, etc.) or `rough_stock`            |
| `bloodlines`   | string | Bloodline / lineage text                                   |

**Logic:** Horses are either timed (barrel racing) or rough stock. Bulls are rough stock.

**Dummy data:**
- Bull: unique_number `B-1042`, scoring_type `rough_stock`, bloodlines `Diamond K x Longhorn`
- Horse: unique_number `H-0891`, scoring_type `timed`, bloodlines `Frenchmans Fancy x Dash Ta Fame`

---

## 7. Stock Contractors: List Bulls & Bucking Horses

**Where:** `src/pages/ContractorDetailPage.jsx` + WordPress plugin

**Change:** Contractor detail page shows a "Bulls & Bucking Horses" section with linked animals.

**WordPress:** Add `linked_animals` (Relationship) to Contractor – select Animal posts. Or set `contractor_id` on each Animal to the contractor post ID.

**Dummy data:**
- Contractor: `Smith Livestock`
- linked_animals: [ID of bull 1, ID of bull 2, ID of horse 1]

---

## 8. Digital ID Card & QR Code for Event Check-in

**Where:** `src/pages/RiderDetailPage.jsx`

**Behavior:** When a rider has `digital_card_status === 'active'`, a Digital ID card with QR code appears on their profile. Event organizers can scan the QR to verify the rider (URL contains rider ID).

**How to enable:**
1. In WordPress, set rider meta `digital_card_status` = `active` (or via WooCommerce purchase of Digital ID product).
2. The QR encodes: `{site_url}/riders/{slug}?id={rider_id}`

**Integration options for check-in:**
- **Option A – Manual:** Organizers open a QR scanner app, scan, and verify the rider page.
- **Option B – PassKit/VPass.me:** Use [PassKit](https://www.passkit.com/) or [VPass](https://vpass.me/) to create Apple/Google Wallet passes with QR. See `RPN_REVENUE_FEATURES_GUIDE.md`.
- **Option C – Custom scanner:** Build a simple check-in page that:
  1. Uses device camera or file upload to read QR
  2. Parses the URL to get rider ID
  3. Calls an API to mark rider as checked in for an event

**Where to create Digital ID account:**
- Digital ID is sold as a WooCommerce product (slug `digital-id-card`).
- Purchase flow: User buys on site → Stripe/WooCommerce processes payment → webhook or manual step sets `digital_card_status` = `active`.
- No external "Digital ID account" is required; RPN handles it via WordPress + WooCommerce.

---

## 9. Event Producer Linking

**WordPress:** Add `producer_id` or `event_producer` (Post Object to Producer) on each Event. ProducerDetailPage will show events linked to that producer.

---

## Quick Checklist

| Feature                  | Where to check             | WordPress setup                          |
|--------------------------|----------------------------|------------------------------------------|
| Red/white/blue theme     | Any page                   | None                                     |
| Header logo + name       | Header                     | None                                     |
| Join Us plans at bottom  | `/join-us`                 | WooCommerce products                     |
| Organizations            | `/producers`               | Add Producers, fill meta                 |
| Events search            | `/events`                  | Add `region` to events                   |
| Animal unique #, type    | `/animals/:slug`           | Add `unique_number`, `scoring_type`, `bloodlines` |
| Contractor animals       | `/contractors/:slug`       | Add `linked_animals` to contractors      |
| Digital ID QR            | `/riders/:slug` (with active digital card) | Set `digital_card_status` = `active` |

---

## Dummy Data Summary (WordPress)

**Rider (with Digital ID):**
- digital_card_status: `active`

**Animal (Bull):**
- unique_number: `B-1042`
- scoring_type: `rough_stock`
- bloodlines: `Diamond K x Longhorn`

**Animal (Horse):**
- unique_number: `H-0891`
- scoring_type: `timed`
- bloodlines: `Frenchmans Fancy x Dash Ta Fame`

**Event:**
- region: `Mountain`
- city: `Denver`
- state: `CO`

**Contractor:**
- linked_animals: [animal IDs]

**Producer:**
- pri: `85.2`
- region: `Southwest`
