# Rankings & Event Results – ACF Fields (PBR-style)

Use this structure to build the **Rankings** page by **event**: season → event → Event Results tab (Place, Rider, Agg Score, Total Points, Round 1/2/Championship, Earnings, Ride %) and **per-round results** (Rider, Bull, Score, Bull Score, Contractor).

**Reference:** [PBR Event Results](https://www.pbr.com/results/171259) – event logo/name, top 3, full table, rounds with rider/bull/contractor.

---

## 1. Event (rpn_event) – Base + Results

**Location rule:** Post Type is equal to Event (or `rpn_event`).

Use **Featured Image** for the **Event logo**. Add the fields below.

### 1.1 Single fields (event-level)

| ACF Field Name | Field Label           | Type   | Description                    | Example        |
|----------------|-----------------------|--------|--------------------------------|----------------|
| `season`       | Season                | Text   | Season label for filtering     | `2025 Season`  |
| `rpn_event_logo` | Event Logo (optional) | Image  | Override logo if not using Featured Image | — |

**Note:** The plugin already exposes `event_date`, `event_end_date`, `venue`, `city`, `state`, `arena_condition`, `weather_condition`, `event_tier`, `producer_id`. The plugin now also registers `season` in REST. Event **name** = post **Title**. Event **logo** = Featured Image (or `rpn_event_logo` if you add it and expose it).

---

### 1.2 Event Results (aggregate table – first tab)

One row per rider at this event: **Place, Rider, Agg Score, Total Points, Round 1, Round 2, Championship Round, Earnings, Ride %**.

| ACF Field Name | Field Label        | Type        | Description                          |
|----------------|--------------------|-------------|--------------------------------------|
| `rpn_event_results` | Event Results   | **Repeater** | One row per rider in event standings |

**Sub-fields of `rpn_event_results`** (use these **exact** names so the plugin can normalize for REST):

| Sub-field Name                 | Label               | Type          | Notes                    |
|--------------------------------|---------------------|---------------|--------------------------|
| `rpn_er_place`                 | Place               | Number        | 1, 2, 3, …               |
| `rpn_er_rider`                 | Rider               | Post Object   | Relationship → Riders. **Return Format: Post ID** recommended so each row gets the correct rider. |
| `rpn_er_agg_score`             | Agg Score           | Number        | Aggregate score          |
| `rpn_er_total_points`         | Total Points        | Number        | Total points             |
| `rpn_er_round_1_points`       | Round 1 Points      | Number        | Score/points Round 1     |
| `rpn_er_round_2_points`       | Round 2 Points      | Number        | Score/points Round 2     |
| `rpn_er_championship_round_points` | Championship Round Points | Number | Championship round   |
| `rpn_er_earnings`              | Earnings            | Number        | Dollar amount            |
| `rpn_er_ride_percentage`      | Ride Percentage     | Text or Number| e.g. `100%`, `67%`       |

---

### 1.3 Round 1 Results (per-ride: Rider, Bull, Score, Bull Score, Contractor)

| ACF Field Name       | Field Label     | Type        | Description                    |
|----------------------|-----------------|-------------|--------------------------------|
| `rpn_round_1_results` | Round 1 Results | **Repeater** | One row per ride in Round 1   |

**Sub-fields of `rpn_round_1_results`:**  
Set each **Relationship / Post Object** field **Return Format** to **Post ID** so each repeater row gets the correct ID (avoids “Rider #1” / “#1” in every row).

| Sub-field Name        | Label        | Type        | Notes                         |
|-----------------------|--------------|-------------|-------------------------------|
| `rpn_r1_rider`        | Rider        | Post Object | Relationship → Riders. Return: **Post ID** |
| `rpn_r1_animal`       | Bull / Animal| Post Object | Relationship → Animals. Return: **Post ID** |
| `rpn_r1_score`        | Score        | Text or Number | Ride score or e.g. `(5.81)` for buck-off |
| `rpn_r1_bull_score`  | Bull Score   | Number      | Bull score                    |
| `rpn_r1_contractor`   | Contractor   | Post Object | Relationship → Contractors. Return: **Post ID** |

---

### 1.4 Round 2 Results

| ACF Field Name       | Field Label     | Type        |
|----------------------|-----------------|-------------|
| `rpn_round_2_results` | Round 2 Results | **Repeater** |

**Sub-fields** (same structure as Round 1, use `rpn_r2_*`):

| Sub-field Name        | Label      | Type        |
|-----------------------|------------|-------------|
| `rpn_r2_rider`        | Rider      | Post Object |
| `rpn_r2_animal`       | Bull       | Post Object |
| `rpn_r2_score`        | Score      | Text/Number |
| `rpn_r2_bull_score`  | Bull Score | Number      |
| `rpn_r2_contractor`   | Contractor | Post Object |

---

### 1.5 Championship Round Results

| ACF Field Name                    | Field Label            | Type        |
|-----------------------------------|------------------------|-------------|
| `rpn_championship_round_results`  | Championship Round Results | **Repeater** |

**Sub-fields** (use `rpn_cr_*`):

| Sub-field Name        | Label      | Type        |
|-----------------------|------------|-------------|
| `rpn_cr_rider`        | Rider      | Post Object |
| `rpn_cr_animal`       | Bull       | Post Object |
| `rpn_cr_score`        | Score      | Text/Number |
| `rpn_cr_bull_score`  | Bull Score | Number      |
| `rpn_cr_contractor`   | Contractor | Post Object |

---

## 2. REST API output (plugin)

For each **Event** requested via the RPN plugin (e.g. single event or list that uses `rpn_format_event_for_rest`), the API returns:

- **event_results** – array of `{ place, rider_id, agg_score, total_points, round_1_points, round_2_points, championship_round_points, earnings, ride_percentage }`
- **round_1_results** – array of `{ rider_id, animal_id, score, bull_score, contractor_id }`
- **round_2_results** – same structure
- **championship_round_results** – same structure

Rider/animal/contractor are exposed as **IDs** so the frontend can resolve names from `/wp/v2/riders`, `/wp/v2/animals`, `/wp/v2/rpn_contractor` (or your contractor rest_base).

---

## 3. Frontend (Rankings page) – How to use

1. **List events** by season/date (e.g. `GET /wp-json/wp/v2/rpn_event` or your custom events endpoint that returns `rpn_format_event_for_rest`).
2. **Per event:** show event **name** (title), **logo** (featured image or `rpn_event_logo`), **date**, **venue**.
3. **First tab – Event Results:**  
   Use `event_results` to render the table: Place, Rider (resolve `rider_id` to name/link), Agg Score, Total Points, Round 1, Round 2, Championship Round, Earnings, Ride %.
4. **Other tabs – Round 1 / Round 2 / Championship Round:**  
   Use `round_1_results`, `round_2_results`, `championship_round_results` to render each table: Rider, Bull, Score, Bull Score, Contractor (resolve `contractor_id` to name/code).
5. **Top 3:** Use `event_results` and filter `place <= 3` to highlight the podium, then show the rest in the table.

---

## 4. Quick reference – ACF field names only

**Event (single):**  
`season`, `rpn_event_logo`

**Event Results repeater:**  
`rpn_event_results`  
→ `rpn_er_place`, `rpn_er_rider`, `rpn_er_agg_score`, `rpn_er_total_points`, `rpn_er_round_1_points`, `rpn_er_round_2_points`, `rpn_er_championship_round_points`, `rpn_er_earnings`, `rpn_er_ride_percentage`

**Round repeaters:**  
`rpn_round_1_results` → `rpn_r1_rider`, `rpn_r1_animal`, `rpn_r1_score`, `rpn_r1_bull_score`, `rpn_r1_contractor`  
`rpn_round_2_results` → `rpn_r2_rider`, `rpn_r2_animal`, `rpn_r2_score`, `rpn_r2_bull_score`, `rpn_r2_contractor`  
`rpn_championship_round_results` → `rpn_cr_rider`, `rpn_cr_animal`, `rpn_cr_score`, `rpn_cr_bull_score`, `rpn_cr_contractor`
