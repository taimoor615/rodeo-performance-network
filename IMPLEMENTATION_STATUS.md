# RPN Implementation Status

## Completed

### UI – Red/White/Blue Theme
- All brown/tan/gold colors replaced with red (#B22234), white (#FFFFFF), blue (#002868)
- Legacy CSS variables mapped to new theme
- Buttons, links, cards use red/blue accents

### Header & Footer
- Header: Logo + "Rodeo Performance Network", "More" dropdown (About, Organizations, Pickup Teams, Contractors)
- Footer: Explore (Rankings, Riders, Animals, Events), More (About, Organizations, Contractors, Join, Login/Dashboard), Contact, Social
- Professional nav structure

### Join Us – Plans & Payment
- Plan dropdown fetches from `/rpn/v1/revenue-products` (WooCommerce)
- Shows product label + price
- Sends `product_id` to join API
- **Backend**: Join API includes checkout URL in welcome email when `product_id` is set
- User receives: password + login link + payment (checkout) link

### Dashboard – Activate / Payment
- When user has no linked rider/contractor/producer: shows "Complete payment to activate"
- Displays revenue products with "Pay now" buttons (checkout links)
- Note for contractors/producers: admin will link profile after payment; premium required for animals/events

### Producer – linked_events
- Plugin: `linked_events` meta on producer (array of event IDs)
- ProducerDetailPage: uses `linked_events` first; falls back to producer_id filter

### Digital ID / QR
- QR shown on rider profile (dummy URL when not active: `https://rodeoperformance.com/demo-check-in?id=X`)
- When `digital_card_status === 'active'`: uses real profile URL
- Copy: "Purchase a Digital ID to get your personal check-in QR code" when inactive

### Contractor/Producer Premium
- Plugin: `premium_member` meta on contractor and producer CPTs
- Admin must set this when they have paid (or via WooCommerce webhook)
- Dashboard shows note: "Premium membership required to add animals (contractors) or events (producers)"

---

## Pending (Requires Backend API)

### Contractor – Animal Add/Edit/Delete
- **Done**: List animals in dashboard, premium gate message
- **Todo**: REST routes for POST (create), PUT (update), DELETE animals. Contractor can manage only animals in `linked_animals`. For now, use WordPress admin to add animals and link to contractor.

### Producer – Event Add/Edit/Delete
- **Done**: List events in dashboard, premium gate message, `linked_events` on producer
- **Todo**: REST routes for POST (create), PUT (update), DELETE events. Producer can manage only events in `linked_events`. For now, use WordPress admin to add events and link to producer via `linked_events`

### Send Payment Link Email
- Optional: button "Email me payment link" on dashboard that calls `POST /rpn/v1/send-payment-link` with `product_id`
- Backend emails user the checkout URL for that product

---

## How to Test

1. **Colors**: Run app, verify no brown/gold; red/blue/white throughout
2. **Join Us**: Select plan from products, submit; check email for password + checkout link
3. **Dashboard**: Login as new user (no linked profile); see plans with Pay now buttons
4. **Producer**: Add `linked_events` in WordPress (ACF relationship to events); producer detail shows those events
5. **QR**: Visit rider profile; QR shows (dummy or real based on digital_card_status)
