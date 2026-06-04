# RPN Media System – Complete Guide

Video highlights, media tagging, one-way social feed with likes. Verified users can tag riders/animals; tags appear on profiles; tagged users can remove themselves.

---

## 1. Media CPT and Meta (Already in Plugin)

The RPN plugin registers:

- **Post Type:** `rpn_media` (REST: `/wp/v2/media-highlights`)
- **Native meta** (no ACF required, but ACF optional for admin UI):

| Meta Key | Type | Description |
|----------|------|-------------|
| `media_type` | string | `image` or `video` |
| `video_url` | string | External video URL (YouTube, Vimeo, etc.) |
| `attachment_id` | number | WP Media attachment ID (for uploaded video/image) |
| `likes_count` | number | Cached like count |
| `liked_user_ids` | array | WordPress user IDs who liked |
| `tagged_riders` | array | Rider post IDs |
| `tagged_animals` | array | Animal post IDs |
| `tagged_pickup_teams` | array | Pickup team post IDs |
| `tagged_users` | array | WP user IDs (for people tagged) |

You can manage these via **Custom Fields** in the post editor, or use **ACF** for a nicer admin UI (see below).

---

## 2. ACF Fields for Media (Optional – Easier Admin UI)

If you prefer ACF for selecting riders/animals when creating media:

**Location rule:** Post Type = Media (or `rpn_media`).

| ACF Field Name | Type | Description | Return Format |
|----------------|------|-------------|---------------|
| `media_type` | Select | image / video | Value |
| `video_url` | URL | External video link | — |
| `attachment_id` | Number | WP Media ID | — |
| `event_id` | Post Object | Link to Event (for "logging the event") | Post ID |
| `tagged_riders` | Relationship | Riders in this media | Post ID, Allow multiple |
| `tagged_animals` | Relationship | Animals (bulls/horses) in this media | Post ID, Allow multiple |
| `tagged_pickup_teams` | Relationship | Pickup teams in this media | Post ID, Allow multiple |

Important: ACF field names must match the meta keys above if you want the plugin to read them. The plugin uses `get_post_meta()` and `update_post_meta()`. ACF stores values in post meta with the field name as the key, so `tagged_riders` in ACF will write to the same meta the plugin expects.

If you use different ACF names, you’d need to sync them in the plugin or keep using the same keys.

---

## 3. Where Media Shows in the App

| Location | What to show | API / Logic |
|----------|--------------|-------------|
| **Media Feed** | Main feed of highlights (one-way) | `GET /wp-json/rpn/v1/media` |
| **Rider Profile** | Media where this rider is tagged | `GET /rpn/v1/media?rider_id=12` |
| **Animal Profile** | Media where this animal is tagged | `GET /rpn/v1/media?animal_id=5` |
| **Pickup Team Profile** | Media where this team is tagged | `GET /rpn/v1/media?pickup_team_id=3` |
| **Event Detail** | Media linked to this event | Filter by `event_id` (add field if needed) |

---

## 4. How Media Links to Riders, Animals, Events

- **Riders:** `tagged_riders` – IDs of rider posts.
- **Animals:** `tagged_animals` – IDs of animal posts.
- **Pickup Teams:** `tagged_pickup_teams` – IDs of pickup team posts.
- **Events:** Add an optional `event_id` meta if you want “logging the event.” The plugin can be extended to support it.

Tagging flow:

1. **Admin:** When creating media, set `tagged_riders` and `tagged_animals` (Custom Fields or ACF).
2. **Verified users:** Use `POST /rpn/v1/media/:id/tags` with `rider_ids`, `animal_ids`, etc.
3. Tags show up on rider/animal profiles via the media API filtered by ID.

---

## 5. Tagging – Who Can Do What

| Action | Who | Requirement |
|--------|-----|-------------|
| Add tags | Verified users | User meta `rpn_verified` = true |
| Remove self | Tagged user | Logged-in WP user in `tagged_users` |
| Like / Unlike | Logged-in users | `POST /rpn/v1/media/:id/like` |

To mark a user verified: set user meta `rpn_verified` = 1 (e.g. via plugin or User Meta Manager).

---

## 6. REST Endpoints (Plugin)

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/rpn/v1/media` | GET | List media, optional `?rider_id=`, `?animal_id=`, `?pickup_team_id=` |
| `/rpn/v1/media/:id/like` | POST | Toggle like (logged-in) |
| `/rpn/v1/media/:id/tags` | POST | Add tags (verified only). Body: `rider_ids`, `animal_ids`, `pickup_team_ids`, `user_ids` |
| `/rpn/v1/media/:id/tags` | DELETE | Remove self from `tagged_users` (logged-in) |

---

## 7. Dummy Media Data

Create these as **Media** (`rpn_media`) posts:

**Media 1 – Video highlight**
- Title: `Marco Rizzo 90pt Ride – Fort Worth`
- Content: `Championship round ride at Modo Casino PBR Chicago.`
- Featured image: thumbnail
- media_type: `video`
- video_url: `https://www.youtube.com/watch?v=EXAMPLE`
- tagged_riders: Rider post ID (e.g. 12)
- tagged_animals: Bull post ID (e.g. 8)
- event_id: 61 (optional)

**Media 2 – Image**
- Title: `Eduardo Aparecido – 85.90 Red Hot`
- Content: `Round 1 at PBR Chicago.`
- Featured image: action photo
- media_type: `image`
- tagged_riders: 15
- tagged_animals: 9

**Media 3 – Multi-tag**
- Title: `Round 1 Top Scores – PBR Chicago`
- Content: `Top rides from Round 1.`
- media_type: `video`
- video_url: (any highlight)
- tagged_riders: 12, 15, 20 (multiple)
- tagged_animals: 8, 9, 10

---

## 8. “Tag Appearing on Profile” and “Logging the Event”

- **On profile:** When you load `/rpn/v1/media?rider_id=12`, you get all media where that rider is in `tagged_riders`. Same for animals and pickup teams. The frontend renders this on the profile.
- **Event logging:** If you add `event_id` to media, you can filter media by event and show “Media from this event” on the event detail page. The plugin would need a small change to support `event_id` in the media index query.

---

## 9. Frontend Pages to Build

1. **Media feed** (`/media`): List recent media, like button, tags.
2. **Rider profile:** Section “Tagged in” → media where `rider_id` is in `tagged_riders`.
3. **Animal profile:** Same for `animal_id`.
4. **Pickup team profile:** Same for `pickup_team_id`.
5. **Event detail:** “Media from this event” if `event_id` is stored.

---

## 10. Quick Reference – Meta Keys

```
media_type, video_url, attachment_id, likes_count
liked_user_ids, tagged_riders, tagged_animals, tagged_pickup_teams, tagged_users
```

Optional: `event_id` for event association.
