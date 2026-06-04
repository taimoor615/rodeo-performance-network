# RIN App — New Feature Testing Guide

This file documents each new feature point as it is implemented, with step-by-step testing instructions.  
New points will be added to the bottom as they are completed.

---

## PDF Reference Check

Before each feature, the **Final-feedback-rodeo.pdf** file (Full Developer Specification v2.0) was checked to see if the point is covered.

---

## Point History — At a Glance

| Point | Title | Session | Status |
|-------|-------|---------|--------|
| 15 | Barrel Racing Divisions (1D–5D) | May 13, 2026 — Session 1 | Done |
| 16 | Team Roping Handicap Divisions (#7.5–#15.5) | May 13, 2026 — Session 1 | Done |
| 17 | Division Reset When Event Changes | May 13, 2026 — Session 1 | Done |
| 18 | Division Field Added to Organizer Submit Results | May 13, 2026 — Session 1 | Done |
| **19** | **Mini Bull as a Separate Animal Type** | **May 14, 2026 — Session 2 (NEW)** | **Done** |
| **20** | **Earnings / Payout Input Fix** | **May 14, 2026 — Session 2 (NEW)** | **Done** |
| **21** | **Team Roping — Slide Division Added** | **May 19, 2026 — Session 3 (NEW)** | **Done** |
| **22** | **Goat Tying — Correct Youth Divisions** | **May 19, 2026 — Session 3 (NEW)** | **Done** |

---

<!-- ══════════════════════════════════════════════════════════════════════
     SESSION 1 — May 13, 2026
     Points 15–18
══════════════════════════════════════════════════════════════════════ -->

## Point 15 — Barrel Racing Divisions (1D, 2D, 3D, 4D, 5D)

### PDF Status
**NOT in the PDF.** The PDF (Final-feedback-rodeo.pdf) lists only generic divisions: Youth, High School, College, Amateur, Open/Pro, Senior (pages 5, 8, 13). The 1D–5D barrel racing split-division system is **new client feedback**, not in the original specification.

### What was done
- Added a `BARREL_RACING_DIVISIONS` constant: `['1D', '2D', '3D', '4D', '5D']`
- Added a `getDivisionsForEvent(eventCategory)` helper function that returns the correct division list based on what event is selected
- Barrel Racing, Barrel Racing (Youth), Pole Bending, and Goat Tying now show 1D–5D instead of the generic divisions
- Applied to BOTH the **rider Post Score form** (timed section) AND the **organizer Submit Results form**
- When the rider changes event type, division resets to blank so they must re-select (avoids wrong division carried over)
- A hint appears below the dropdown: *"1D = fastest; 5D = slowest. Set by the event based on your run time."*

### What the divisions mean
| Division | Meaning |
|---|---|
| 1D | Fastest times — top-level competitors |
| 2D | Within 0.5 sec of the 1D leader |
| 3D | Within 1.0 sec of the 1D leader |
| 4D | Within 2.0 sec of the 1D leader |
| 5D | Within 3.0+ sec of the 1D leader (slowest) |

### Files changed
- `src/pages/DashboardPage.jsx` — new constants, `getDivisionsForEvent()`, updated timed division dropdowns in both Post Score and Submit Results tabs

### How to test

**Rider Post Score — Barrel Racing division:**
1. Log in as a rider → Dashboard → **Post Score** tab
2. Select **Timed** as score type
3. Select **Barrel Racing** as the event category
4. Look at the **Division** dropdown — it should now show: `1D, 2D, 3D, 4D, 5D`
5. It should NOT show: Youth, High School, College, etc.
6. Select **2D** → proceed to enter run time
7. Switch the event to **Bull Riding** (roughstock) — the Division resets to blank and shows generic divisions (Youth, Open, Pro, etc.)
8. Switch back to **Barrel Racing (Youth)** — should again show 1D–5D
9. Check that **Pole Bending** and **Goat Tying** also show 1D–5D

**Organizer Submit Results — Barrel Racing division:**
1. Log in as an event organizer → Dashboard → **Submit Results** tab
2. Set Performance Type to **Timed**
3. Set Event Category to **Barrel Racing**
4. The **Division** dropdown (new field) should show: `1D, 2D, 3D, 4D, 5D`
5. Select a division → submit a result → verify it saves
6. Switch Event Category to something else (e.g., Tie-Down Roping) — Division resets and shows generic divisions

---

## Point 16 — Team Roping Handicap Divisions

### PDF Status
**NOT in the PDF.** Team roping is covered in Sections 6.2 and 6.5 (pages 13–15), but only discusses Header/Heeler roles and completion status. The handicap division numbering system (#7.5–#15.5, Open) is **new client feedback**, not in the original specification.

### What was done
- Added a `TEAM_ROPING_DIVISIONS` constant with the client-provided division structure:
  - `Open` — No age or handicap cap, for high-level ropers
  - `#14.5 – #15.5` — High-numbered, often with Slide formats
  - `#12.5 – #13.5` — Mid-level, often age restricted (21+)
  - `#10.5 – #11.5` — Lower-mid level, often capped heeler max
  - `#7.5 – #9.5` — Beginner to intermediate with strict caps
- Team Roping – Header and Team Roping – Heeler now show these divisions in both the rider Post Score form and organizer Submit Results form
- A hint appears: *"Combined header + heeler handicap number. Open = no cap."*

### Background: How roping divisions work
- Each roper (header and heeler) has an individual skill number (#3 beginner to #9/#10 professional)
- The **combined number** (header's # + heeler's #) determines which division they can enter
- Example: a #6 header + #5 heeler = combined #11 → qualifies for #10.5–#11.5 division
- Open division has no combined cap

### Files changed
- `src/pages/DashboardPage.jsx` — `TEAM_ROPING_DIVISIONS` constant, `getDivisionsForEvent()` updated

### How to test

**Rider Post Score — Team Roping division:**
1. Log in as a rider → Dashboard → **Post Score** tab
2. Select **Timed** as score type
3. Select **Team Roping – Header** as event category
4. The **Division** dropdown should show:
   - Open
   - #14.5 – #15.5
   - #12.5 – #13.5
   - #10.5 – #11.5
   - #7.5 – #9.5
5. A hint should show: *"Combined header + heeler handicap number. Open = no cap."*
6. Select a division and complete the form (also requires Role: Header/Heeler and Partner name)
7. Switch to **Team Roping – Heeler** — same division list should appear
8. Switch to **Tie-Down Roping** — should revert to generic divisions (Youth, Open, Pro, etc.)

**Organizer Submit Results — Team Roping division:**
1. Log in as an event organizer → Dashboard → **Submit Results** tab
2. Set Performance Type to **Timed**
3. Set Event Category to **Team Roping – Header**
4. Division dropdown should show the 5 handicap options above
5. Select `#10.5 – #11.5` → enter a time → submit → verify success

---

## Point 17 — Division Reset When Event Changes

### PDF Status
**Not explicitly specified in the PDF** — this is a UX improvement that prevents wrong data entry.

### What was done
- When a user changes the **Event Category** in the timed score form, the Division field automatically resets to blank
- This forces the user to consciously select the correct division for the new event type
- Without this, switching from Barrel Racing (where you had "2D" selected) to Team Roping would carry "2D" over — which is meaningless for roping

### How to test
1. Log in as a rider → Dashboard → **Post Score** → Timed
2. Select **Barrel Racing** → select division **3D**
3. Now change the event to **Team Roping – Header**
4. The division should clear back to *"Select division…"* (blank)
5. Confirm: you must re-select a division before submitting

---

## Point 18 — Division Field Added to Organizer Submit Results

### PDF Status
**Partially in PDF.** The PDF (Section 6.3, pages 13-14) defines how result entry works for timed events and mentions "division" as a data field. The organizer submit results form existed but was MISSING the division field entirely — this fills that gap.

### What was done
- Added a **Division** dropdown to the organizer's Submit Results form (it was missing before)
- The division is required — the form won't submit without it
- Division options adapt based on the selected Event Category (same `getDivisionsForEvent()` logic as the rider form)
- Division resets when Performance Type or Event Category changes

### How to test
1. Log in as an event organizer → Dashboard → **Submit Results** tab
2. The form now has a **Division** field right after Event Category
3. Leave Division blank → try to submit → it should block with a browser validation message
4. Set it to **Barrel Racing** + **2D** → fill in rider name, time → submit → success
5. After successful submit, Division resets to blank

---

---

<!-- ══════════════════════════════════════════════════════════════════════
     SESSION 2 — May 14, 2026
     Points 19–20  (NEW)
══════════════════════════════════════════════════════════════════════ -->

## Point 19 — Mini Bull as a Separate Animal Type

### PDF Status
**Partially in PDF.** Junior Bull Riding appears on page 8 as a distinct event type. However, "Mini Bull" as a specific animal sub-type (separate from Adult Bull) is **not explicitly listed** in the PDF specification — this is new client feedback.

### Background
- Adult bulls are used in standard Bull Riding events (all ages/divisions)
- Mini bulls are smaller bulls used primarily in youth divisions (Junior Bull Riding)
- However, some mini bull riders also compete on adult bulls, so the two are not exclusive to one event
- The system now tracks which type of bull was used in each ride

### What was done
- Renamed `Bull` → `Bull (Adult)` in the animal type dropdown in **My Animals**
- Added `Mini Bull` as a new animal type option in **My Animals** (contractors can now add mini bulls to their herd)
- Added a **Bull Type** dropdown (Adult Bull / Mini Bull) to the **rider Post Score roughstock form** — appears only when the event is Bull Riding or Junior Bull Riding
- Added the same **Bull Type** dropdown to the **organizer Submit Results roughstock form** — same conditional logic
- `bull_type` is included in the API payload for both rider and organizer submissions
- A hint shows: *"Mini bulls are typically used in youth divisions"*
- `bull_type` resets when the score form is cleared after submission

### Files changed
- `src/pages/DashboardPage.jsx` — AnimalFormFields dropdown, `scoreForm` state, `orgForm` state, roughstock form UI for rider and organizer, API payloads

### How to test

**My Animals — Mini Bull animal type:**
1. Log in as a contractor → Dashboard → **My Animals** tab
2. Click **Add New Animal**
3. Open the **Animal Type** dropdown
4. You should see:
   - `Bull (Adult)` — renamed from plain "Bull"
   - `Mini Bull` — new option
5. Select `Mini Bull` → fill in name and other fields → save → it should appear in the animal list

**Rider Post Score — Bull Type:**
1. Log in as a rider → Dashboard → **Post Score** tab
2. Select **Roughstock** as score type
3. Choose an event from Step 1 → proceed to Step 2
4. In the Step 2 grid, set **Event Category** to **Bull Riding**
5. A **Bull Type** dropdown should appear below the Animal Name field
6. Options: `Select bull type…`, `Adult Bull`, `Mini Bull`
7. A hint text appears: *"Mini bulls are typically used in youth divisions"*
8. Change Event Category to **Junior Bull Riding** — Bull Type dropdown should still appear
9. Change Event Category to **Saddle Bronc** — Bull Type dropdown should disappear

**Organizer Submit Results — Bull Type:**
1. Log in as an event organizer → Dashboard → **Submit Results** tab
2. Set Performance Type to **Roughstock**
3. Confirm Event Category is **Bull Riding** (or select it)
4. A **Bull Type** row should appear below the Animal Name / Covered? row
5. Select `Mini Bull` → submit a result → verify success
6. Change Event Category to **Saddle Bronc** — Bull Type row should disappear

---

## Point 20 — Earnings / Payout Input Fix

### PDF Status
**In the PDF.** Section 4.5 (page 10) mentions prize money / payout as a recorded data field for performance entries. The bug where the input refused entry is **not in the specification** — it is a browser behavior issue with `type="number"` inputs in React.

### What was done
- Changed the **Payout / Prize Money** input from `type="number"` to `type="text"` with `inputMode="decimal"` in **three places**:
  1. Rider Post Score — Roughstock Step 5 (Placement & Payout)
  2. Rider Post Score — Timed Step 4 (Placement & Payout)
  3. Organizer Submit Results — Payout ($) field
- The submit handlers already used `Number(value)` to convert to a number before sending — no change needed there
- `inputMode="decimal"` preserves the numeric keyboard on mobile devices while removing the problematic browser validation that was blocking input on desktop

### Why this bug occurred
`type="number"` in React controlled components can show a browser validation popup ("Please enter a number") even when the value is a valid number string — especially on initial render with an empty string value or after certain state updates. This is a known cross-browser quirk with controlled React inputs.

### Files changed
- `src/pages/DashboardPage.jsx` — three payout `<input>` elements changed from `type="number"` to `type="text" inputMode="decimal"`

### How to test

**Rider roughstock payout:**
1. Log in as a rider → Dashboard → **Post Score** → select Roughstock
2. Complete Step 1 (event search) and Step 2 (event category, animal, etc.)
3. Complete Step 3 (covered / buck-off)
4. Scroll to **Step 5 — Placement & Payout**
5. Click inside the **Payout / Prize Money** field → type `250.50`
6. No browser validation popup should appear
7. You should be able to type freely and submit the form

**Rider timed payout:**
1. Log in as a rider → Dashboard → **Post Score** → select Timed
2. Complete Steps 1–3 → at **Step 4 — Placement & Payout**
3. Click the **Payout / Prize Money** field → type `125`
4. No error message → should submit successfully

**Organizer payout:**
1. Log in as an event organizer → Dashboard → **Submit Results** tab
2. Scroll to the bottom of the form — the **Payout ($)** field
3. Click it → type `500`
4. No browser validation error
5. Submit → verify success message

---

---

<!-- ══════════════════════════════════════════════════════════════════════
     SESSION 3 — May 19, 2026
     Points 21–22  (NEW)
══════════════════════════════════════════════════════════════════════ -->

## Point 21 — Team Roping: Slide Division Added

### PDF Status
**NOT in the PDF.** Team roping divisions are in Sections 6.2/6.5 but the Slide format is not mentioned. This is new client feedback from WSTR (World Series of Team Roping) format data.

### Background — What "Slide" Means
A "Slide" event is a specific handicap bracket format used by major associations like WSTR:
- It raises the combined number cap beyond the standard range (e.g., above #13.5 or #15.5)
- Acts as a handicap bracket that lets higher-skilled teams compete against each other fairly
- Sometimes includes time adjustments so differently-matched teams remain competitive

### What Was Done
- Added `#15.5 Slide` to `TEAM_ROPING_DIVISIONS` (between Open and #14.5–#15.5)
- Added `#13.5 Slide` to `TEAM_ROPING_DIVISIONS` (between #14.5–#15.5 and #12.5–#13.5)
- Updated the hint text: *"Slide = raised cap handicap bracket (WSTR format)"*
- Both rider Post Score and organizer Submit Results forms now show these options

### Updated Division List
| Division | Type | Notes |
|---|---|---|
| Open | Standard | No number cap |
| #15.5 Slide | Slide format | Raised cap, WSTR handicap bracket |
| #14.5 – #15.5 | Standard | High-skill range |
| #13.5 Slide | Slide format | Raised cap, WSTR handicap bracket |
| #12.5 – #13.5 | Standard | Mid-level, often age restricted |
| #10.5 – #11.5 | Standard | Lower-mid, capped heeler |
| #7.5 – #9.5 | Standard | Beginner to intermediate |

### Files Changed
- `src/pages/DashboardPage.jsx` — `TEAM_ROPING_DIVISIONS` constant updated, hint text updated in rider and organizer forms

### How to Test

**Rider Post Score — Team Roping Slide:**
1. Log in as a rider → Dashboard → **Post Score** tab
2. Select **Timed** as score type
3. Select **Team Roping – Header** as event category
4. The **Division** dropdown should now show 7 options:
   - Open
   - #15.5 Slide
   - #14.5 – #15.5
   - #13.5 Slide
   - #12.5 – #13.5
   - #10.5 – #11.5
   - #7.5 – #9.5
5. The hint should read: *"Combined header + heeler handicap number. 'Slide' = raised cap handicap bracket (WSTR format)."*
6. Select **#15.5 Slide** → complete and submit the form → verify success
7. Repeat test with **Team Roping – Heeler** — same division list should appear

**Organizer Submit Results — Slide Division:**
1. Log in as an event organizer → Dashboard → **Submit Results** tab
2. Set Performance Type to **Timed**
3. Set Event Category to **Team Roping – Header**
4. Division dropdown should show all 7 options including the two Slide options
5. Select **#13.5 Slide** → enter a time → submit → verify success

---

## Point 22 — Goat Tying: Correct Youth Divisions

### PDF Status
**NOT explicitly in the PDF** for goat tying divisions specifically. The client confirmed goat tying is a youth sport — divisons should be age/grade based, not the 1D–5D time-spread system used in barrel racing.

### Background
- Goat tying is a **youth sport** — competitors are Junior High, Senior High, or College level
- The 1D–5D division system (previously used) is for barrel racing where times are split by proximity to the fastest time
- For goat tying, divisions reflect the competitor's age/grade level, not their time bracket
- Scoring: fastest time wins; 5-second penalty if horse crosses rope; no-time if goat gets up before 6 seconds

### What Was Done
- Added a new `GOAT_TYING_DIVISIONS` constant: `['Junior High', 'Senior High', 'College', 'Open']`
- Removed Goat Tying from the barrel racing 1D–5D group in `getDivisionsForEvent()`
- Goat Tying now returns `GOAT_TYING_DIVISIONS` instead of `BARREL_RACING_DIVISIONS`
- Updated the hint text for Goat Tying: *"Youth event — select your age division. 5-sec penalty if horse crosses the rope."*
- Scoring logic unchanged — the existing 5-second penalty system and no-time option already handle goat tying correctly

### What the Existing Scoring Already Covers
| Goat Tying Rule | How It's Handled in the App |
|---|---|
| Fastest time wins | Standard timed event scoring |
| No-time if goat gets up | "Did you receive an official time?" → No |
| 5-sec penalty (horse crosses rope) | `PENALTY_VALUE['Goat Tying'] = 5`, num_penalties field |
| 3 legs tied (piggin' string + hooey) | Not tracked — rules knowledge only |

### Files Changed
- `src/pages/DashboardPage.jsx` — `GOAT_TYING_DIVISIONS` constant added, `getDivisionsForEvent()` updated, hint text updated

### How to Test

**Rider Post Score — Goat Tying Divisions:**
1. Log in as a rider → Dashboard → **Post Score** tab
2. Select **Timed** as score type
3. Select **Goat Tying** as event category
4. The **Division** dropdown should show: `Junior High`, `Senior High`, `College`, `Open`
5. It should NOT show: 1D, 2D, 3D, 4D, 5D
6. The hint should read: *"Youth event — select your age division. 5-sec penalty if horse crosses the rope."*
7. Switch to **Barrel Racing** — should show 1D–5D again (confirming Goat Tying was correctly separated)

**Organizer Submit Results — Goat Tying Divisions:**
1. Log in as an event organizer → Dashboard → **Submit Results** tab
2. Set Performance Type to **Timed**
3. Set Event Category to **Goat Tying**
4. Division dropdown should show: Junior High, Senior High, College, Open
5. Select **Senior High** → enter a time and rider name → submit → verify success

**Goat Tying Penalty (existing system, confirm still works):**
1. Log in as a rider → Post Score → Timed → Goat Tying
2. If horse crossed the rope during the run, set **Number of Penalties** to `1`
3. The system adds 5 seconds to the raw run time automatically
4. Final time shown = raw time + 5 seconds

---

*Last updated: May 19, 2026*

---
<!-- ─────────────────────────────────────────────────────────────────────────
     FUTURE POINTS GO BELOW THIS LINE
     Each point follows the same format:
     ## Point N — Title
     ### PDF Status
     ### What was done
     ### Files changed
     ### How to test
───────────────────────────────────────────────────────────────────────────── -->
