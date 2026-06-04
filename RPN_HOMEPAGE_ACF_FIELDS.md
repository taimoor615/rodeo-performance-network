# RPN Homepage – ACF Fields (Manage in WordPress)

Use **Advanced Custom Fields (ACF)** to manage homepage sections. The API reads from a **Page** first (recommended), then from an ACF Options page if no page is set.

**Reference:** [PBR-style homepage](https://www.pbr.com/) – standings, events, athletes, news, signup.

---

## 1. Create ACF Options Page

1. Install **ACF** (or ACF Pro).
2. Go to **ACF → Options** (or **Add-ons → Options Page**).
3. Add an Options Page:
   - **Page Title:** `RPN Homepage`
   - **Menu Slug:** `rpn-homepage`
   - **Parent:** None (top-level)

---

## 2. Field Group: “RPN Homepage Sections”

**Location rule:** Options Page is equal to RPN Homepage (or `rpn-homepage`).

Use these **exact** field names so the React app and REST API can read them.

**If nothing shows on the frontend:** The plugin looks for ACF options under these slugs (in order): `option`, `options`, `acf-options`, `rpn-homepage`, `rpn_homepage`, `rpn_home_page`. Set your ACF Options page **Menu Slug** to one of these (e.g. `rpn-homepage` or `option`). If you used a different slug, add it to the plugin’s `rpn_get_acf_option()` contexts or change the Options page slug in ACF to `rpn-homepage`.

**Debugging:** Call `/wp-json/rpn/v1/homepage?debug=1` — the response includes `_debug.homepage_page_id`, `_debug.hero_raw`, and `_debug.hero_from_page` so you can see which page is used and what ACF returns.

---

### Hero Section (homepage banner)

| Field Name | Field Label | Type | Notes |
|------------|-------------|------|--------|
| `rpn_hero` | Hero | **Group** (not Repeater) | Single group for hero content |
| ↳ `rpn_hero_title` | Title | Text | Main headline |
| ↳ `rpn_hero_subtitle` | Subtitle | Textarea | Tagline below title |
| ↳ `rpn_hero_background_image` | Background Image | Image | Hero background (full bleed) |
| ↳ `rpn_hero_primary_button_text` | Primary Button Text | Text | e.g. View Buckle Rankings |
| ↳ `rpn_hero_primary_button_link` | Primary Button Link | URL or Text | e.g. /rankings |
| ↳ `rpn_hero_secondary_button_text` | Secondary Button Text | Text | e.g. Browse Riders |
| ↳ `rpn_hero_secondary_button_link` | Secondary Button Link | URL or Text | e.g. /riders |

**Example:**  
Title: `Rodeo Performance Network`  
Subtitle: `The first national performance-based scoring system for rodeo athletes, horses, bulls, pickup teams, and producers.`  
Primary: `View Buckle Rankings` → `/rankings`  
Secondary: `Browse Riders` → `/riders`

---

### FAQ Section

| Field Name       | Field Label   | Type    | Notes                    |
|------------------|---------------|---------|--------------------------|
| `rpn_faq_items`  | FAQ Items     | Repeater|                          |
| ↳ `rpn_faq_question` | Question  | Text    | Sub field of repeater   |
| ↳ `rpn_faq_answer`   | Answer    | Textarea| Sub field of repeater   |

**Example row:**  
Question: `How is RPI calculated?`  
Answer: `RPI is based on qualified rides, completion rate, and win count, adjusted for event tier and conditions.`

---

### Reviews Section

| Field Name          | Field Label   | Type    | Notes                    |
|---------------------|---------------|---------|--------------------------|
| `rpn_reviews`       | Reviews       | Repeater|                          |
| ↳ `rpn_reviewer_name`  | Reviewer Name | Text    |                         |
| ↳ `rpn_review_text`    | Review Text   | Textarea|                         |
| ↳ `rpn_review_rating`  | Rating (1-5)  | Number  | Min 1, Max 5             |
| ↳ `rpn_review_image`   | Photo         | Image   | Optional                 |

**Example row:**  
Reviewer Name: `Jake M.`  
Review Text: `Finally a fair way to compare riders across events. RPN is the future.`  
Rating: `5`

---

### Top Riders Section

| Field Name        | Field Label | Type        | Notes                          |
|-------------------|-------------|------------|---------------------------------|
| `rpn_top_riders`  | Top Riders  | Relationship | Post Type: **Rider**           |
|                   |             |             | Return: Post Object (or ID)    |
|                   |             |             | Order by: Order (drag & drop)  |

Select the riders you want to show in “Top Riders” and order them. The REST API returns these as `top_riders` with full rider data.

---

### Membership / Signup Plans Section

| Field Name              | Field Label    | Type     | Notes                    |
|-------------------------|----------------|----------|--------------------------|
| `rpn_membership_plans`  | Membership Plans | Repeater|                       |
| ↳ `rpn_plan_name`      | Plan Name      | Text     | e.g. Free, Premium       |
| ↳ `rpn_plan_price`      | Price          | Text     | e.g. `0`, `9.99`, `25`   |
| ↳ `rpn_plan_interval`   | Interval       | Text     | e.g. `month`, `year`, `one-time` |
| ↳ `rpn_plan_features`   | Features       | Textarea | One feature per line     |
| ↳ `rpn_plan_button_text`| Button Text    | Text     | e.g. Sign Up, Get Started |
| ↳ `rpn_plan_button_link`| Button Link    | URL      | e.g. /signup, #contact   |
| ↳ `rpn_plan_highlighted`| Highlighted   | True/False | Recommended plan       |

**Example rows:**

- **Free:** Price `0`, Interval `—`, Features: `Profile`, `Basic ranking`, Button: `Join Free`, Link `#signup`
- **Premium:** Price `9.99`, Interval `month`, Features: `Vanity URL`, `Leaderboard preview`, `NIL kit`, Highlighted: Yes
- **Printed Card:** Price `25`, Interval `one-time`, Features: `Printed card + lanyard`, Button: `Order Now`

---

## 3. Relationship Fields (Riders ↔ Animals)

So the **React app** can show “Linked horses/stock” and “Rider history”, add relationship fields on the post types.

### On Rider post type

| Field Name       | Field Label   | Type        | Notes                    |
|------------------|---------------|-------------|--------------------------|
| `linked_animals` | Linked Animals| Relationship| Post Type: **Animal**   |
|                  |               |             | Return: Post Object (or ID) |

The plugin exposes this as `meta.linked_animals` in the REST API (array of animal IDs). The React app fetches those animals and displays them on the rider profile.

### On Animal post type

| Field Name     | Field Label  | Type        | Notes                   |
|----------------|--------------|-------------|-------------------------|
| `linked_riders`| Linked Riders| Relationship| Post Type: **Rider**    |
|                |             |             | Return: Post Object (or ID) |

Exposed as `meta.linked_riders` (array of rider IDs). React uses this for “Rider history” on the animal profile.

**Note:** If you use “Post Object” with “Return: Post ID”, the API will get an array of IDs. The plugin already registers `linked_animals` and `linked_riders` for REST.

---

## 4. Events (Upcoming / Recent)

Events are **not** managed in the Homepage Options. They come from the **Events** custom post type.

- **Upcoming events:** REST API returns events with `event_date` ≥ today, ordered by date.
- **Recent events:** Events with `event_date` < today, ordered by date descending.

Ensure each Event has the **event_date** custom field (see `WORDPRESS_FIELDS_GUIDE.md`).

---

## 5. Quick Reference – All Homepage ACF Field Names

| Section        | Field name (exact)   | Type         |
|----------------|----------------------|--------------|
| **Hero**       | `rpn_hero`           | Group        |
| Hero subfields | `rpn_hero_title`, `rpn_hero_subtitle`, `rpn_hero_background_image`, `rpn_hero_primary_button_text`, `rpn_hero_primary_button_link`, `rpn_hero_secondary_button_text`, `rpn_hero_secondary_button_link` | Text, Textarea, Image, Text, URL, Text, URL |
| FAQ            | `rpn_faq_items`      | Repeater     |
| FAQ row        | `rpn_faq_question`, `rpn_faq_answer` | Text, Textarea |
| Reviews        | `rpn_reviews`        | Repeater     |
| Review row     | `rpn_reviewer_name`, `rpn_review_text`, `rpn_review_rating`, `rpn_review_image` | Text, Textarea, Number, Image |
| Top Riders     | `rpn_top_riders`     | Relationship (Rider) |
| Plans          | `rpn_membership_plans` | Repeater   |
| Plan row       | `rpn_plan_name`, `rpn_plan_price`, `rpn_plan_interval`, `rpn_plan_features`, `rpn_plan_button_text`, `rpn_plan_button_link`, `rpn_plan_highlighted` | Text, Text, Text, Textarea, Text, URL, True/False |

---

## 6. REST API

The RPN plugin exposes:

**GET** `/wp-json/rpn/v1/homepage`

Returns:

- `faq` – array of `{ question, answer }`
- `reviews` – array of `{ reviewer_name, review_text, rating, image_url }`
- `top_riders` – array of rider objects (id, slug, title, rpi, state, city, image_url)
- `upcoming_events` – array of event objects
- `recent_events` – array of event objects
- `membership_plans` – array of `{ name, price, interval, features[], button_text, button_link, highlighted }`

The React app fetches this and renders FAQ, Reviews, Top Riders, Upcoming/Recent Events, and Signup/Plans on the homepage.
