# RPN Revenue Features – Complete Implementation Guide

Digital ID Card ($5), Printed Card ($25), Premium Membership ($9.99/month). Stripe for payments; PassKit or VPass.me for wallet passes.

---

## 1. Revenue Items Overview

| Product | Price | What It Grants |
|---------|-------|----------------|
| **Custom Digital ID Card** | $5 | Digital card status, wallet pass |
| **Printed Card + Lanyard** | $25 | Physical card, shipping |
| **Premium Membership** | $9.99/month | Vanity URL, early leaderboard access, front-page exposure, NIL kit |

These are linked to **Rider** posts via meta fields already in the plugin.

---

## 2. Rider Meta Fields (Already in Plugin)

The RPN plugin registers these on the Rider CPT:

| Meta Key | Type | Purpose |
|----------|------|---------|
| `premium_member` | boolean | Has active Premium |
| `premium_expires` | string | ISO date when Premium ends |
| `digital_card_status` | string | `pending` / `active` / `cancelled` |
| `printed_card_status` | string | `pending` / `fulfilled` / `cancelled` |
| `nil_kit_url` | string | Link to NIL kit |
| `leaderboard_preview_access` | boolean | Early leaderboard access |
| `featured_homepage` | boolean | Show on homepage |
| `vanity_url` | string | Custom slug (e.g. `marco-rizzo`) |

You’ll set these from Stripe webhooks or a custom admin flow.

---

## 3. WordPress Plugins to Install

| Plugin | Purpose |
|--------|---------|
| **Stripe for WooCommerce** or **WP Simple Pay** or **Stripe Payments** | Process payments |
| **WooCommerce** (optional) | Products, orders, subscriptions |
| **PassKit** or **VPass.me** integration | Generate Apple Wallet / Google Pay passes |

**Recommended paths:**

- **Simple:** WP Simple Pay or Stripe Payments – create payment forms, use webhooks to update rider meta.
- **Flexible:** WooCommerce – create products, link rider ID to order, update meta on payment complete.

---

## 4. Option A – Stripe with WP Simple Pay / Stripe Payments

### Step 1: Install plugin

1. Plugins → Add New.
2. Search “WP Simple Pay” or “Stripe Payments”.
3. Install and activate.
4. Connect your Stripe account (test or live keys).

### Step 2: Create payment forms

1. Create three forms/products:
   - **Digital ID Card** – $5 one-time.
   - **Printed Card** – $25 one-time.
   - **Premium Membership** – $9.99/month recurring.

2. Add a custom field on each form: `rider_id` (hidden, passed from the page or selected by user).

### Step 3: Stripe webhooks

1. In Stripe Dashboard → Developers → Webhooks.
2. Add endpoint: `https://yoursite.com/wp-json/your-webhook-path` (your plugin’s webhook URL).
3. Events: `checkout.session.completed`, `invoice.paid` (for subscriptions).

### Step 4: Webhook handler (custom code)

Create a webhook handler that:

1. Verifies the Stripe signature.
2. Reads the product/price ID and metadata (e.g. `rider_id`).
3. Updates the rider’s meta:

**For Digital ID Card ($5):**

```
digital_card_status = 'active'
```

**For Printed Card ($25):**

```
printed_card_status = 'pending'  (change to 'fulfilled' after shipping)
```

**For Premium Membership ($9.99/month):**

```
premium_member = true
premium_expires = (now + 1 month)
leaderboard_preview_access = true
featured_homepage = true
nil_kit_url = (link from your system)
vanity_url = (set when they choose one)
```

---

## 5. Option B – Stripe with WooCommerce

### Step 1: Install WooCommerce + Stripe

1. Install **WooCommerce**.
2. WooCommerce → Settings → Payments → enable **Stripe**.
3. Add Stripe keys.

### Step 2: Create products

| Product | Price | Type |
|---------|-------|------|
| Custom Digital ID Card | $5 | Simple |
| Printed Card + Lanyard | $25 | Simple |
| Premium Membership | $9.99 | Subscription (WooCommerce Subscriptions) |

### Step 3: Rider field on checkout + update rider meta (in RPN plugin)

The **RPN Headless** plugin already includes: (1) Rider dropdown on checkout (only when cart has an RPN product); (2) validation so customer must select a rider; (3) saving rider ID as order meta `_rpn_rider_id`; (4) on payment/order complete, updating that rider's meta by product. Code lives in `wordpress-plugin/rpn-headless-plugin.php` at the end (inside `if (class_exists('WooCommerce'))`). **Set your product slugs** in `rpn_wc_product_slugs()` to match your WooCommerce product slugs (defaults: `digital-id-card`, `printed-card`, `premium-membership`). Quick test: add product to cart, checkout, select rider, pay with Stripe test card, then check rider custom fields in WP.

- *(Rider field and order meta are implemented in the plugin.)* “Rider” (dropdown or search of riders).
- Store `rider_id` in order meta (e.g. `_rider_id`).

### Step 4: Update rider meta on payment (reference)

The plugin uses `woocommerce_payment_complete` and `woocommerce_order_status_completed`. Example:

```php
add_action('woocommerce_payment_complete', 'rpn_update_rider_on_purchase', 10, 2);
function rpn_update_rider_on_purchase($order_id, $order = null) {
    $order = wc_get_order($order_id);
    if (!$order) return;
    $rider_id = $order->get_meta('_rider_id');
    if (!$rider_id) return;

    foreach ($order->get_items() as $item) {
        $product = $item->get_product();
        if (!$product) continue;
        $slug = $product->get_slug();

        if ($slug === 'digital-id-card') {
            update_post_meta($rider_id, 'digital_card_status', 'active');
        }
        if ($slug === 'printed-card') {
            update_post_meta($rider_id, 'printed_card_status', 'pending');
        }
        if ($slug === 'premium-membership') {
            update_post_meta($rider_id, 'premium_member', true);
            update_post_meta($rider_id, 'premium_expires', date('Y-m-d', strtotime('+1 month')));
            update_post_meta($rider_id, 'leaderboard_preview_access', true);
            update_post_meta($rider_id, 'featured_homepage', true);
            // nil_kit_url, vanity_url set elsewhere or via form
        }
    }
}
```

---

## 6. Wallet Passes (PassKit or VPass.me)

### PassKit

1. Sign up at [passkit.com](https://passkit.com).
2. Design a pass template (card with rider name, photo, etc.).
3. Use their API or WordPress plugin to create a pass when `digital_card_status` = active.
4. Store the pass URL or pass ID in rider meta (e.g. `wallet_pass_url`).
5. Frontend shows “Add to Apple Wallet” / “Add to Google Pay” linking to that URL.

### VPass.me

1. Sign up at [vpass.me](https://vpass.me).
2. Create a pass design and configure dynamic fields.
3. On purchase, call their API with rider data to generate a pass.
4. Save the pass URL in rider meta and link from the frontend.

### Flow

1. User pays $5 for Digital ID Card.
2. Webhook / order complete handler:
   - Sets `digital_card_status` = `active`.
   - Calls PassKit/VPass API with rider name, photo, etc.
   - Saves pass URL in `wallet_pass_url` (or similar) on the rider.
3. Rider profile page shows “Add to Wallet” button pointing to that URL.

---

## 7. Where to Add and Manage Data

| Data | Where | How |
|------|-------|-----|
| Products/Prices | Stripe Dashboard or WooCommerce | Define products, prices, subscriptions |
| Rider selection | Checkout / payment form | Custom field `rider_id` |
| Rider entitlements | Rider meta (automated) | Webhook / order hooks |
| Vanity URL | Rider profile or checkout | User chooses; save to `vanity_url` |
| NIL kit URL | Admin or custom flow | Manual or automated; save to `nil_kit_url` |
| Printed card fulfillment | Admin | Change `printed_card_status` to `fulfilled` when shipped |

---

## 8. Flow Summary

```
User selects product (Digital/Printed/Premium) + Rider
    → Pays via Stripe
    → Webhook / WooCommerce hook fires
    → Update rider meta (digital_card_status, premium_member, etc.)
    → Optionally call PassKit/VPass for wallet pass
    → Frontend reads rider meta and shows benefits (badges, wallet button, early access)
```

---

## 9. Frontend Behavior (React App)

- **Rider profile:** Read `premium_member`, `vanity_url`, `digital_card_status`, `printed_card_status`, `nil_kit_url`, `leaderboard_preview_access`, `featured_homepage`.
- **Premium badge:** Show when `premium_member` is true.
- **“Add to Wallet”:** Show when `digital_card_status` = `active` and `wallet_pass_url` exists.
- **Leaderboard:** If `leaderboard_preview_access` is true, allow early access (e.g. before public release).
- **Homepage:** Use `featured_homepage` to decide which riders appear in featured sections.

---

## 10. Checklist

- [ ] Install Stripe plugin (WP Simple Pay, Stripe Payments, or WooCommerce + Stripe)
- [ ] Create products: Digital Card $5, Printed Card $25, Premium $9.99/month
- [ ] Add rider selection to checkout/form
- [ ] Set up Stripe webhooks (or WooCommerce hooks)
- [ ] Write webhook/hook handler to update rider meta
- [ ] Sign up for PassKit or VPass.me
- [ ] Generate wallet pass on Digital Card purchase
- [ ] Store pass URL in rider meta
- [ ] Update frontend to show premium features and wallet button
