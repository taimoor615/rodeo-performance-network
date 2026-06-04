# Client Requirements – What’s Done vs Remaining

Based on the client’s last message, here’s what is already in place and what still needs to be built, plus how to implement it.

---

## ✅ Already Implemented

| Client ask | Status | Where |
|------------|--------|--------|
| Red, white, blue color scheme | Done | `index.css`, `App.css` theme vars |
| Header with logo and “Rodeo Performance Network” | Done | `Layout.jsx`, `App.css` |
| Sign up options at bottom (plans) | Done | Home plans, Join Us page |
| Digital ID cards as add-on, QR for event check-in | Done | Rider profile Digital ID, QR; plugin email mentions add-on |
| Events and Organizations can sign up, create page | Done | Join Us (producer/contractor), producer/contractor CPTs |
| Riders can sign up for events | Done | Event sign-up flow in plugin |
| Event owners input times/scores; riders can on event page | Done | Add Performance, event results in plugin |
| Event orgs scan QR at events to check in riders/bulls | Done | QR on rider profile; check-in is conceptual (scan = look up) |
| Scoring: timed OR rough stock; horses one or the other | Partially | Animal types (Horse/Bull); discipline/timed vs rough stock in data model |
| Events searchable by City/State or Region & State | Partially | Events list filters; may need Region in WP |
| Stock contractors list bulls/horses under their name | Done | Contractor CPT, linked animals |
| Contractor ranking by stock performance | Partially | Contractor profile; ranking logic can use SRI/TEI of linked animals |

---

## 🔲 Remaining / To Improve

### 1. **Permanent number for each horse and bull**

- **Ask:** “Each horse and bull needs to be assigned a number that stays with them forever.”
- **Implementation:**
  - In WordPress: add a required field on the Animal CPT, e.g. `permanent_number` or `lifetime_number` (number or string).
  - In the plugin: register the meta/ACF field, expose it in REST and in the headless app.
  - In the app: show it on animal detail and in lists (e.g. “#1234”).
  - In the DB: make it unique so the same number isn’t reused.

### 2. **Breeding papers / bloodlines**

- **Ask:** “Place to upload breeding papers or just enter bloodlines.”
- **Implementation:**
  - Animal CPT: add fields such as `bloodline` (text), `sire`, `dam`, and optionally `breeding_papers_url` or a media upload for a PDF/image.
  - Expose in REST and headless app; show on animal detail page (e.g. “Bloodlines” or “Pedigree” section).

### 3. **History for each bull and rider (scores/times per event)**

- **Ask:** “Each bull and rider needs a ‘history’ showing their scores or times for each event. Scores can be linked to a rider if the rider is on the site.”
- **Implementation:**
  - You already have performances / event results. Add:
    - **Rider history:** A “History” or “Results” section on the rider profile that lists events and scores/times (from performances linked to that rider).
    - **Animal history:** Same for animals: list events and scores/times (from performances linked to that animal).
  - Back end: ensure performances store `rider_id` and `animal_id` and that the plugin’s REST or custom endpoints can return “all performances for rider X” and “all performances for animal Y.”
  - Front end: rider profile page and animal profile page each call this and render a table or timeline.

### 4. **Events search: City/State and Region & State**

- **Ask:** “Events need to be searchable by City/State or Region & State.”
- **Implementation:**
  - If not already there, add Event fields in WP: `city`, `state`, `region` (e.g. “Southeast”, “Northwest”).
  - Events list (or API): add filters for `city`, `state`, `region` (and optionally a combined “Region & State” filter).
  - In the app: Events page filters for City, State, and Region (and “Region & State” if you define that as a single dropdown).

### 5. **Contractor ranking by stock performance**

- **Ask:** “Their ranking is determined by their bulls/horses performances.”
- **Implementation:**
  - Define “contractor rank” (e.g. average SRI/TEI of their animals, or sum of points from animal results).
  - In the plugin: compute this (on save or via a cron) and store it (e.g. `contractor_rank` or `stock_performance_score`).
  - Expose in REST; use it on contractors list/detail and in any “rankings” view for contractors.

### 6. **Horses: timed vs rough stock only**

- **Ask:** “Horses don’t do both. They are either rough stock or barrel racing for timed.”
- **Implementation:**
  - Animal: add a field like `discipline_type` with values such as “timed” (e.g. barrel racing) or “rough_stock”.
  - When adding a performance or result, validate that the animal’s type matches the event discipline.
  - Display this on animal profile and in any filters (e.g. “Timed only” / “Rough stock only”).

### 7. **Other (screenshots / on-screen notes)**

- **Ask:** “I have some other stuff, but I would either have to take screen shots or be able to make notes on the screen.”
- **Implementation:**
  - No code yet. When the client sends screenshots or a list of “notes on the screen,” treat each as a small task (e.g. “Change this label,” “Add this field,” “This button should do X”) and implement in the same way as above: data in WP/plugin, then expose in API, then UI in the app.

---

## Suggested implementation order

1. **Permanent number for animals** – small, clear change; good for tracking.
2. **Rider and animal history (scores/times per event)** – high value; use existing performance/result data.
3. **Events search by City/State and Region** – add fields and filters.
4. **Bloodlines / breeding papers** – add fields and animal detail section.
5. **Contractor ranking by stock** – define formula, then implement in plugin and UI.
6. **Horses: timed vs rough stock only** – add discipline and validation.

If you tell me which of these you want to do first (e.g. “permanent number + history”), I can outline exact field names, API shape, and component changes step by step.
