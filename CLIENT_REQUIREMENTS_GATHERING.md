# RPN Client Requirements & Information Gathering

**Purpose:** Use this document to gather all required information, content, and approvals from the Rodeo Performance Network (RPN) client before finalizing the application.

---

## 1. Business & Scope

| # | Question | Why We Need It | Your Answer |
|---|----------|----------------|-------------|
| 1.1 | Who are the primary users? (riders, producers, fans, admins) | Determines features, UI, and permissions | |
| 1.2 | Who can add/edit performances? (anyone, verified users, admins only) | Affects submission flow and auth requirements | |
| 1.3 | Who can add/edit events? (producers only, admins, anyone) | Affects event verification workflow | |
| 1.4 | Is there a paid tier or subscription planned? | Affects Join Us flow, vanity URLs, future features | |
| 1.5 | Target go-live date? | Timeline planning and prioritization | |
| 1.6 | Who will manage WordPress content post-launch? (client staff, you, third party) | Training and documentation needs | |

---

## 2. Scoring & Index Formulas

**Current formulas in the app** are based on industry patterns. **We need client confirmation** that these are correct or what to change.

### 2.1 Condition Modifiers (Arena, Weather, Event Tier)

| Modifier Type | Values | Current Multipliers | Client OK? | Notes |
|---------------|--------|---------------------|------------|-------|
| **Arena** | Smooth, Chopped, Muddy, Deep, Slick | 1.00, 0.90, 0.95, 0.92, 0.93 | ☐ Yes ☐ No | |
| **Weather** | Clear, Rainy, Windy, Hot, Cold | 1.00, 0.95, 0.97, 0.96, 0.96 | ☐ Yes ☐ No | |
| **Event Tier** | Local, Regional, Pro | 1.00, 1.10, 1.25 | ☐ Yes ☐ No | |

**Questions for client:**
- Are there additional arena or weather conditions we should support?
- Are the tier multipliers (Local / Regional / Pro) correct per your rules?
- Do you have an official rulebook or spec document we can reference?

### 2.2 Rider Performance Index (RPI) – Roughstock

**Current formula:** `(Avg Qualified Ride Score × Completion Rate) + (Win Count × 5)`

- Completion Rate = Qualified Rides ÷ Total Rides
- Base score = roughstock formula result
- Adjusted score = Base × Arena Mod × Weather Mod × Tier Mod

**Client confirmation:** ☐ Formula is correct  ☐ Needs changes: ___________

### 2.3 Timed Event Index (THI)

**Current formula:** `((Benchmark / Avg Time) × 100 × Completion Rate) − (Penalties × Penalty Weight)`

**Client confirmation:** ☐ Formula is correct  ☐ Needs changes: ___________

### 2.4 Stock Rating Index (SRI) / Barrel Horse Index (BHI)

**Current implementation:** Stored on animals; calculation logic not yet defined in the plugin.

**Questions for client:**
- How is SRI calculated for roughstock animals (bulls, broncs)?
- How is BHI or TEI calculated for barrel horses?
- Do you have formulas or reference documents?

### 2.5 Pickup Team Index (PTI)

**Current implementation:** Stored as a number on pickup teams; formula not defined.

**Questions for client:**
- How is PTI calculated?
- What inputs are used? (tagged rescues, years experience, event tier, etc.)

---

## 3. Event Categories & Performance Types

| # | Question | Why We Need It | Your Answer |
|---|----------|----------------|-------------|
| 3.1 | What event categories should we support? | Dropdown options in Add Performance form | e.g. Bull Riding, Saddle Bronc, Bareback, Barrel Racing, Tie-Down Roping, etc. |
| 3.2 | Which are roughstock vs timed? | Form and calculation logic differ | Roughstock: ___  Timed: ___ |
| 3.3 | Does Barrel Racing need pattern size? (for benchmark) | Add Performance form includes this field | ☐ Yes ☐ No |
| 3.4 | Should we support additional timed event types (Breakaway, Team Roping, etc.)? | Affects forms and indexes | |
| 3.5 | Any age divisions? (Youth, Senior, Open) | Rankings filtering and performance categorization | |

---

## 4. Content & Data

### 4.1 Branding

| # | Item | Required | Status |
|---|------|----------|--------|
| 4.1.1 | Logo (PNG/SVG, light and dark variants if needed) | Yes | ☐ Received |
| 4.1.2 | Brand colors (hex codes) | Optional – app has western theme | ☐ Received |
| 4.1.3 | Hero background image for homepage | Yes | ☐ Received |
| 4.1.4 | Favicon | Optional | ☐ Received |

### 4.2 Static Content

| # | Content | Location | Status |
|---|---------|----------|--------|
| 4.2.1 | About Us page – mission, team, values | About Us page | ☐ Received |
| 4.2.2 | Join Us page – benefits, form copy | Join Us page | ☐ Received |
| 4.2.3 | Contact email, phone | Footer, Join Us | ☐ Received |
| 4.2.4 | Social links (Facebook, Twitter/X, Instagram) | Footer | ☐ Received |
| 4.2.5 | FAQ questions and answers | Homepage FAQ | ☐ Received |
| 4.2.6 | Reviews / testimonials (name, text, rating, optional photo) | Homepage | ☐ Received |
| 4.2.7 | Plans/pricing (if applicable) | Homepage | ☐ N/A ☐ Received |

### 4.3 Seed Data

| # | Data | Notes | Status |
|---|------|-------|--------|
| 4.3.1 | Initial riders (names, locations, stats) | At least 3–5 for testing | ☐ Received |
| 4.3.2 | Initial animals (names, types, owners) | At least 3–5 for testing | ☐ Received |
| 4.3.3 | Initial events (dates, venues, conditions) | At least 2–3 for testing | ☐ Received |
| 4.3.4 | Pickup teams (names, PTI, experience) | At least 2–3 for testing | ☐ Received |

### 4.4 Imagery

| # | Question | Your Answer |
|---|----------|-------------|
| 4.4.1 | Do you have photo release / usage rights for rider/animal images? | ☐ Yes ☐ No ☐ N/A |
| 4.4.2 | Preferred placeholder when no image exists? (initials, generic icon, stock image) | |
| 4.4.3 | Max image dimensions / file size limits? | |

---

## 5. WordPress & Technical

| # | Question | Why We Need It | Your Answer |
|---|----------|----------------|-------------|
| 5.1 | WordPress URL (production) | API configuration | |
| 5.2 | Will you use ACF (Advanced Custom Fields) or native Custom Fields? | Field setup and REST exposure | ☐ ACF ☐ Native |
| 5.3 | Existing WordPress users/roles? | Auth and permissions | |
| 5.4 | Any existing data to migrate? (spreadsheets, old site) | Migration planning | ☐ Yes ☐ No |
| 5.5 | SSL (HTTPS) available on WordPress? | Required for secure API calls | ☐ Yes ☐ No |

---

## 6. Features & Workflows

### 6.1 Performance Submission

| # | Question | Your Answer |
|---|----------|-------------|
| 6.1.1 | Should submissions require login? | ☐ Yes ☐ No |
| 6.1.2 | Should submissions be reviewed before affecting rankings? | ☐ Yes ☐ No |
| 6.1.3 | Who can submit? (riders, producers, anyone) | |
| 6.1.4 | Can users propose new events if event isn’t in the list? | ☐ Yes ☐ No |

### 6.2 Event Management

| # | Question | Your Answer |
|---|----------|-------------|
| 6.2.1 | How are events added? (admin only, producer pre-fill, user-proposed) | |
| 6.2.2 | Should producers have a pre-fill flow for their events? | ☐ Yes ☐ No |
| 6.2.3 | Event verification workflow? (e.g., user-proposed → admin approves) | ☐ Yes ☐ No |

### 6.3 Profiles

| # | Question | Your Answer |
|---|----------|-------------|
| 6.3.1 | Can riders edit their own profile? (age, location, photo) | ☐ Yes ☐ No |
| 6.3.2 | Can producers edit their events? | ☐ Yes ☐ No |
| 6.3.3 | Vanity URLs (e.g., /riders/jake-hanshew) – who gets them? | ☐ All ☐ Paid only ☐ N/A |

### 6.4 Pickup Teams

| # | Question | Your Answer |
|---|----------|-------------|
| 6.4.1 | Additional fields needed? (bio, certifications, contact) | |
| 6.4.2 | How is PTI calculated or entered? | ☐ Manual ☐ Calculated: ___________ |

### 6.5 Animals

| # | Question | Your Answer |
|---|----------|-------------|
| 6.5.1 | Pedigree / breeding display? | ☐ Yes ☐ No |
| 6.5.2 | Transfer history (ownership changes)? | ☐ Yes ☐ No |
| 6.5.3 | Deceased flag for retired animals? | ☐ Yes ☐ No |
| 6.5.4 | Permanent ID (e.g., brand registry)? | ☐ Yes ☐ No |

---

## 7. Legal & Compliance

| # | Item | Status |
|---|------|--------|
| 7.1 | Terms of Service | ☐ Will provide ☐ We draft ☐ N/A |
| 7.2 | Privacy Policy | ☐ Will provide ☐ We draft ☐ N/A |
| 7.3 | Cookie consent (if using analytics/tracking) | ☐ Required ☐ Not required |
| 7.4 | Data retention (how long to keep performance data?) | |
| 7.5 | GDPR / CCPA considerations (if applicable) | ☐ Yes ☐ No |

---

## 8. Launch & Support

| # | Question | Your Answer |
|---|----------|-------------|
| 8.1 | Who will be trained on WordPress content management? | |
| 8.2 | Preferred training format? (video, written guide, live call) | |
| 8.3 | Post-launch support expectations? (hours, response time) | |
| 8.4 | Staging/UAT URL for client testing before go-live? | ☐ Yes ☐ No |
| 8.5 | Who will handle bug reports and change requests post-launch? | |

---

## 9. Summary Checklist

Before considering the project complete, ensure:

- [ ] All scoring formulas (RPI, THI, SRI, PTI) are confirmed
- [ ] Condition modifiers (arena, weather, tier) are approved
- [ ] Event categories and performance types are defined
- [ ] Branding assets (logo, hero image) are received
- [ ] Static content (About, Join Us, FAQ, etc.) is received
- [ ] Seed data (riders, animals, events) is provided
- [ ] WordPress URL and tech setup are confirmed
- [ ] Auth/permission rules are agreed upon
- [ ] Legal docs (ToS, Privacy) are in place or planned
- [ ] Launch date and support expectations are documented

---

## 10. Reference Documents to Request from Client

Ask the client to provide (if available):

1. **Rulebook or scoring specification** – official formulas for RPI, THI, SRI, PTI
2. **Event list** – sanctioned event types and categories
3. **Brand guidelines** – logo usage, colors, tone
4. **Sample data** – spreadsheets with riders, animals, events for import
5. **Competitor references** – sites they like (e.g., PBR, PRCA) for UX inspiration

---

*Document version: 1.0 | Last updated: February 2025*
