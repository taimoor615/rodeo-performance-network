# RPN WordPress Custom Fields Guide

Create these **custom fields** in WordPress for each post type. You can use **Custom Fields** (native) or **ACF** (Advanced Custom Fields). Field names must match **exactly** (lowercase, underscores).

---

## 1. RIDERS

| Field name   | Type   | Description                    | Example / Dummy data |
|-------------|--------|--------------------------------|----------------------|
| `rpi`       | Number | Rider Performance Index         | `67.5`               |
| `state`     | Text   | State                          | `Texas`              |
| `city`      | Text   | City                           | `Fort Worth`         |
| `age_group` | Text   | Age group for rankings         | `18-24` or `Senior` |
| `event_type`| Text   | Primary event (e.g. Bull Riding)| `Bull Riding`        |
| `total_rides`     | Number | Total rides (roughstock)   | `12`                 |
| `qualified_rides` | Number | Qualified rides             | `8`                  |
| `completion_rate`| Number | Completion rate (0–1)        | `0.67`               |
| `win_count` | Number | Win count                     | `2`                  |
| `twitter_url`  | URL  | Twitter / X profile           | `https://twitter.com/johndoe` |
| `instagram_url`| URL  | Instagram profile              | `https://instagram.com/johndoe` |
| `vanity_url`   | Text | Custom vanity slug (premium)  | `jake-hanshew`       |

### Dummy data – Riders (copy/paste)

**Rider 1**
- Title: `Jacob Hanshew`
- rpi: `55.7`
- state: `Texas`
- city: `Fort Worth`
- age_group: `18-24`
- event_type: `Bull Riding`
- total_rides: `10`
- qualified_rides: `6`
- completion_rate: `0.6`
- win_count: `1`

**Rider 2**
- Title: `Wyatt Morgan`
- rpi: `65.61`
- state: `Oklahoma`
- city: `Oklahoma City`
- age_group: `25-34`
- event_type: `Saddle Bronc`
- total_rides: `12`
- qualified_rides: `8`
- completion_rate: `0.67`
- win_count: `2`

**Rider 3**
- Title: `Aubrey Ford`
- rpi: `86.5`
- state: `Texas`
- city: `Dallas`
- age_group: `18-24`
- event_type: `Barrel Racing`

---

## 2. ANIMALS

| Field name    | Type   | Description              | Example / Dummy data   |
|---------------|--------|--------------------------|------------------------|
| `sri`         | Number | Stock Rating Index       | `78.2`                 |
| `tei`         | Number | Timed Event Index        | `82.5`                 |
| `bhi`         | Number | Barrel Horse Index (if horse) | `85.0`           |
| `animal_type` | Text   | Horse / Bull / Bronc      | `Bull` or `Horse`      |
| `unique_number` | Text | Permanent ID (stays forever) | `B-1042` or `H-0891` |
| `scoring_type` | Text | `timed` or `rough_stock` (horses: barrel racing vs rough stock) | `rough_stock` |
| `bloodlines`  | Text   | Bloodline / lineage       | `Diamond K x Longhorn`  |
| `breeding`    | Text   | Breeding / lineage        | `Diamond K x Longhorn`  |
| `owner`       | Text   | Owner name                | `Smith Livestock`      |
| `birth_date`  | Text   | Birth date or year        | `2019` or `March 2019`|
| `linked_rider_ids` | Text | Comma-separated rider post IDs | `12, 15`        |

### Dummy data – Animals

**Animal 1 (Bull)**
- Title: `Smoke Show`
- sri: `82.3`
- animal_type: `Bull`
- breeding: `Diamond K x Longhorn`
- owner: `Smith Livestock`
- birth_date: `2018`

**Animal 2 (Horse)**
- Title: `Lucky Dollar`
- tei: `88.0`
- bhi: `86.5`
- animal_type: `Horse`
- breeding: `Frenchmans Fancy x Dash Ta Fame`
- owner: `Aubrey Ford`
- birth_date: `2016`

**Animal 3 (Horse)**
- Title: `Dusty Rooster`
- tei: `79.2`
- animal_type: `Horse`
- breeding: `Unknown`
- owner: `Morgan Ranch`

---

## 3. PICKUP TEAMS

| Field name      | Type   | Description           | Example / Dummy data   |
|-----------------|--------|-----------------------|------------------------|
| `pti`           | Number | Pickup Team Index     | `72.5`                 |
| `years_experience` | Number | Years experience   | `8`                    |
| `horses_used`   | Text   | Horses used (names or count) | `Duke, Ranger`  |
| `tagged_rescues`| Number | Number of tagged rescues | `24`                |
| `state`         | Text   | State                 | `Texas`                |
| `city`          | Text   | City                  | `Mesquite`             |

### Dummy data – Pickup Teams

**Pickup Team 1**
- Title: `West Brothers Pickup`
- pti: `78.5`
- years_experience: `12`
- horses_used: `Duke, Ranger, Cash`
- tagged_rescues: `45`
- state: `Texas`
- city: `Mesquite`

**Pickup Team 2**
- Title: `Lone Star Rescue`
- pti: `72.0`
- years_experience: `6`
- horses_used: `Buddy, Scout`
- tagged_rescues: `18`
- state: `Oklahoma`
- city: `Tulsa`

---

## 4. EVENTS

| Field name       | Type   | Description                    | Example / Dummy data   |
|------------------|--------|---------------------------------|------------------------|
| `event_date`     | Text   | Date (YYYY-MM-DD or readable)   | `2025-03-15`           |
| `event_end_date` | Text   | End date if multi-day           | `2025-03-16`           |
| `venue`          | Text   | Venue / arena name              | `Fort Worth Stockyards`|
| `city`           | Text   | City                            | `Fort Worth`           |
| `state`          | Text   | State                           | `Texas`                |
| `arena_condition`| Text   | Smooth / Chopped / Muddy / Deep / Slick | `Smooth`   |
| `weather_condition`| Text  | Clear / Rainy / Windy / Hot / Cold | `Clear`        |
| `event_tier`     | Text   | Local / Regional / Pro          | `Regional`             |
| `producer_id`    | Number | Producer (post ID if you have Producers CPT) | `5` |
| `season`         | Text   | Season label for rankings       | `2025 Season`          |

**Event results and round results** (Event Results tab + Round 1/2/Championship tables) are managed via **ACF Repeaters**. See **RPN_RANKINGS_EVENT_RESULTS_ACF.md** for exact ACF field names.

### Dummy data – Events

**Event 1**
- Title: `Fort Worth Spring Rodeo 2025`
- event_date: `2025-03-15`
- event_end_date: `2025-03-16`
- venue: `Fort Worth Stockyards Arena`
- city: `Fort Worth`
- state: `Texas`
- arena_condition: `Smooth`
- weather_condition: `Clear`
- event_tier: `Regional`

**Event 2**
- Title: `Oklahoma State Fair Rodeo`
- event_date: `2025-09-20`
- venue: `State Fair Arena`
- city: `Oklahoma City`
- state: `Oklahoma`
- arena_condition: `Chopped`
- weather_condition: `Hot`
- event_tier: `Pro`

---

## Quick reference – field names only

**Riders:** `rpi`, `state`, `city`, `age_group`, `event_type`, `total_rides`, `qualified_rides`, `completion_rate`, `win_count`, `twitter_url`, `instagram_url`, `vanity_url`

**Animals:** `sri`, `tei`, `bhi`, `animal_type`, `breeding`, `owner`, `birth_date`, `linked_rider_ids`

**Pickup Teams:** `pti`, `years_experience`, `horses_used`, `tagged_rescues`, `state`, `city`

**Events:** `event_date`, `event_end_date`, `venue`, `city`, `state`, `arena_condition`, `weather_condition`, `event_tier`, `producer_id`

---

## How to add in WordPress

### Option A – Native Custom Fields
1. Edit a Rider/Animal/Pickup Team/Event.
2. Scroll to **Custom Fields** (enable in Screen Options if hidden).
3. Under **Name** type the field name exactly (e.g. `rpi`).
4. Under **Value** enter the value (e.g. `67.5`).
5. Click **Add Custom Field**, then **Update**.

### Option B – ACF (Advanced Custom Fields)
1. Install the **Advanced Custom Fields** plugin.
2. Go to **ACF → Field Groups → Add New**.
3. Add a field group, set **Location** to the post type (e.g. Post Type = Rider).
4. Add each field with **Field Name** = the name in the table (e.g. `rpi`, type Number).
5. Save. Fields will appear when editing that post type and are exposed in REST if you use “Show in REST API” in ACF settings.

The RPN Headless plugin registers these field names for the REST API so the React app can read them.
