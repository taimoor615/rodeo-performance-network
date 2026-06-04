# Image Links & Pickup Teams Guide

## Free Image Links for RPN

Use these in WordPress as featured images for Riders, Animals, Events, and Pickup Teams.  
**Source:** Unsplash (free to use; attribution appreciated but not required per Unsplash license).

### Riders
- https://images.unsplash.com/photo-1547036967-23d11aacaee0 (rodeo rider in action)
- https://images.unsplash.com/photo-1558618666-fcd25c85cd64 (cowboy portrait)
- https://images.unsplash.com/photo-1595273670150-bd0c3c392e46 (rodeo competitor)
- https://images.unsplash.com/photo-1578662996442-48f60103fc96 (cowboy silhouette)

### Animals (Horses & Bulls)
- https://images.unsplash.com/photo-1553284965-83fd3e82fa5a (horse close-up)
- https://images.unsplash.com/photo-1577102570693-11cebfd2028a (horse in arena)
- https://images.unsplash.com/photo-1558611848-73f7eb4001a1 (cattle/stock)
- https://images.unsplash.com/photo-1553284965-83fd3e82fa5a (bucking horse)

### Events (Arenas, Rodeo)
- https://images.unsplash.com/photo-1595273670150-bd0c3c392e46 (rodeo arena)
- https://images.unsplash.com/photo-1547036967-23d11aacaee0 (rodeo crowd/arena)
- https://images.unsplash.com/photo-1553284965-83fd3e82fa5a (arena with horses)

### Pickup Teams
- https://images.unsplash.com/photo-1553284965-83fd3e82fa5a (horses – pickup teams use horses)
- https://images.unsplash.com/photo-1577102570693-11cebfd2028a (horse team)
- https://images.unsplash.com/photo-1558611848-73f7eb4001a1 (rodeo crew/stock)

**Tip:** In WordPress, add an image via Media → Add New, then paste the URL (or use a plugin like “Add From URL”) and set it as the featured image for the post.

---

## Pickup Teams: How They Work

### What Are Pickup Teams?
Pickup teams are the crew that rescues riders after a ride (e.g. helping dismount, moving animals). They’re scored via the **Pickup Team Index (PTI)** for safety, consistency, and performance.

### Where to Add Pickup Teams in WordPress
1. **WordPress Admin** → **Pickup Teams** (custom post type from the RPN Headless plugin).
2. Add a new Pickup Team:
   - **Title:** Team or organization name
   - **Featured Image:** Team photo or representative image
   - **Meta fields** (from the plugin): `pti`, `years_experience`, `horses_used`, `tagged_rescues`, `state`, `city`

### Where Pickup Teams Are Used in the App (Currently)
- **About Us page** – Mentions PTI in the “What We Do” section.
- **Join Us form** – “I am joining as” includes “Pickup Team”.
- **Footer** – Tagline mentions “pickup teams”.

### What’s Not Built Yet
The React app does **not** have:
- A **Pickup Teams list page** (like Riders/Animals).
- A **Pickup Team detail page**.
- PTI **rankings** for pickup teams.

To add these, you would:
1. Create `PickupTeamsPage.jsx` and `PickupTeamDetailPage.jsx`.
2. Add routes `/pickup-teams` and `/pickup-teams/:slug`.
3. Add nav and footer links.
4. Use `getCustomPosts('pickup_teams', ...)` from `wordpressApi.js`.

The WordPress plugin already registers the `pickup_team` CPT and REST endpoint (`/wp/v2/pickup-teams`), so the data is available once you add pickup teams in WP.
