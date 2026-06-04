# Contractors & Producers – ACF Fields, REST, and Frontend

**Contractors** = stock contractors (bulls/broncs). **Producers** = event producers.  
Both support an index (CRI / PRI), **verification badge**, and optional promotion on the frontend.

---

## 1. Contractors (rpn_contractor)

**Location rule:** Post Type is equal to Contractor (or `rpn_contractor`).

| ACF Field Name     | Field Label     | Type    | Description                          | Example    |
|--------------------|-----------------|---------|--------------------------------------|------------|
| `cri`              | CRI             | Number  | Contractor Rating Index              | `84.5`     |
| `contractor_code`  | Contractor Code | Text    | Short code (PBR-style: DDE, 3BC)     | `DDE`      |
| `verified`         | Verified        | True/False | Show verification badge            | 1          |
| `state`            | State           | Text    | State                                | `Texas`    |
| `city`             | City            | Text    | City                                 | `Decatur`  |
| `description`      | Description     | Textarea| Bio / company description            | —          |
| `website`          | Website         | URL     | Company website                      | —          |
| `contact_email`   | Contact Email   | Email   | Contact email                        | —          |

**Featured Image** = contractor logo (optional).

REST: these are registered in the RPN plugin and exposed on `rpn_contractor` (rest_base `contractors`).  
Endpoint: `GET /wp-json/wp/v2/contractors` (or `/wp/v2/rpn_contractor` depending on WP version).

---

## 2. Producers (rpn_producer)

**Location rule:** Post Type is equal to Producer (or `rpn_producer`).

| ACF Field Name | Field Label   | Type     | Description               | Example |
|----------------|---------------|----------|---------------------------|---------|
| `pri`          | PRI           | Number   | Producer Rating Index     | `88.2`  |
| `verified`     | Verified      | True/False | Show verification badge | 1       |
| `state`        | State         | Text     | State                     | `Oklahoma` |
| `city`         | City          | Text     | City                      | `Oklahoma City` |
| `description`  | Description   | Textarea | Bio / company description | —       |
| `website`      | Website       | URL      | Company website           | —       |
| `contact_email`| Contact Email | Email    | Contact email             | —       |

**Featured Image** = producer logo (optional).

REST: `GET /wp-json/wp/v2/producers` (or `/wp/v2/rpn_producer`).

---

## 3. How to show on the frontend

### Contractors

1. **List page (e.g. /contractors)**  
   - Fetch: `GET /wp-json/wp/v2/contractors?per_page=20`  
   - Show cards: logo (featured image), title (name), `contractor_code`, `cri`, `city`, `state`.  
   - If `meta.verified === true`, show a “Verified” badge.

2. **Detail page (e.g. /contractors/:slug)**  
   - Fetch single contractor by slug.  
   - Show: name, code, CRI, verified badge, description, city/state, website, contact.

3. **Inside Event Results (round tables)**  
   - Each round result has `contractor_id`.  
   - Resolve to contractor name/code via your contractors list or `GET /wp-json/wp/v2/contractors/<id>`.

### Producers

1. **List page (e.g. /producers)**  
   - Fetch: `GET /wp-json/wp/v2/producers?per_page=20`  
   - Show cards: logo, title, PRI, verified badge, city, state.

2. **Detail page (e.g. /producers/:slug)**  
   - Same idea as contractor: name, PRI, verified, description, contact, website.

3. **Event relationship**  
   - Events have `producer_id`. On event detail, resolve to producer name and link to producer profile.

---

## 4. Dummy data – Contractors

Create these as **Contractor** posts (rpn_contractor) with ACF (or native custom fields).

**Contractor 1**  
- Title: `Diamond D Ranch`  
- cri: `84.5`  
- contractor_code: `DDE`  
- verified: `1`  
- state: `Texas`  
- city: `Decatur`  
- description: `Premium bucking stock for PBR and regional events.`  
- website: `https://example.com/diamond-d`  
- contact_email: `stock@example.com`

**Contractor 2**  
- Title: `3BC Bucking Bulls`  
- cri: `82.1`  
- contractor_code: `3BC`  
- verified: `1`  
- state: `Oklahoma`  
- city: `Tulsa`  
- description: `Elite bull pen, multiple PBR World Finals appearances.`

**Contractor 3**  
- Title: `Lone Star Livestock`  
- cri: `78.0`  
- contractor_code: `LSL`  
- verified: `0`  
- state: `Texas`  
- city: `Fort Worth`

**Contractor 4**  
- Title: `FSDZ Bucking Stock`  
- cri: `80.2`  
- contractor_code: `FSDZ`  
- verified: `1`  
- state: `Kansas`  
- city: `Wichita`

**Contractor 5**  
- Title: `MDBB Bulls`  
- cri: `79.5`  
- contractor_code: `MDBB`  
- verified: `0`  
- state: `Missouri`  
- city: `Springfield`

---

## 5. Dummy data – Producers

Create these as **Producer** posts (rpn_producer).

**Producer 1**  
- Title: `Rodeo Nation Events`  
- pri: `88.2`  
- verified: `1`  
- state: `Texas`  
- city: `Fort Worth`  
- description: `Pro and regional rodeo production across the Southwest.`  
- website: `https://example.com/rodeo-nation`  
- contact_email: `events@example.com`

**Producer 2**  
- Title: `Heartland Rodeo Co`  
- pri: `85.0`  
- verified: `1`  
- state: `Oklahoma`  
- city: `Oklahoma City`  
- description: `Premier events and fair circuits.`

**Producer 3**  
- Title: `Prairie Star Productions`  
- pri: `82.5`  
- verified: `0`  
- state: `Kansas`  
- city: `Wichita`

**Producer 4**  
- Title: `Modo Casino Rodeo Series`  
- pri: `90.1`  
- verified: `1`  
- state: `Illinois`  
- city: `Chicago`  
- description: `Major tour events and televised rodeo.`

**Producer 5**  
- Title: `Sunset Rodeo LLC`  
- pri: `79.0`  
- verified: `0`  
- state: `Arizona`  
- city: `Phoenix`

---

## 6. Quick reference – field names only

**Contractors:**  
`cri`, `contractor_code`, `verified`, `state`, `city`, `description`, `website`, `contact_email`

**Producers:**  
`pri`, `verified`, `state`, `city`, `description`, `website`, `contact_email`

All of these are registered in the RPN Headless plugin and exposed in the REST API for `rpn_contractor` and `rpn_producer`.
