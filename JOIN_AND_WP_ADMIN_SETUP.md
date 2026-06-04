# Join Us & WordPress Admin Access – Setup

## 1. Join Us page (React)

- **Logged-out only:** If a user is already logged in, they are redirected to the home page. Join Us is only for new sign-ups.
- **Plans shown:** The client’s membership tiers (Free, Premium $9.99/mo, Pro $24.99/mo) are shown as **static content** above the form. No WooCommerce fetch is used for that display.
- **Form → WooCommerce:** The form still sends `product_id` to the RPN join API when the user picks Premium or Pro. That requires your WooCommerce products to be exposed by the plugin (see below).

## 2. Managing Free vs paid (WooCommerce)

- **Free plan:** No product. User selects “Free” in the form; the join API is called with **no** `product_id`. The welcome email can omit a checkout link.
- **Premium / Pro:** Create two WooCommerce products and give them the **slugs** the plugin expects, so the Join form can resolve their IDs via `/rpn/v1/revenue-products`:

| Plan    | Product slug (in WooCommerce) | Plugin key        |
|---------|--------------------------------|--------------------|
| Premium | `premium-membership`          | `premium_membership` |
| Pro     | `pro-membership`              | `pro`               |

In WooCommerce: **Products → Edit product → Permalink** (or slug): set to `premium-membership` and `pro-membership` respectively. The RPN plugin returns these in the revenue-products API so the Join form can send the correct `product_id` when the user chooses Premium or Pro.

If your products use different slugs, either:

- Change the product slugs in WooCommerce to the ones above, or  
- Filter the plugin’s slugs in your theme (see plugin code for `rpn_wc_product_slugs` and use the `rpn_wc_product_slugs` filter to map your slugs to the same keys).

## 3. WordPress login → Dashboard (producers & contractors)

WooCommerce sends everyone to **My Account** after login. To send **producers** and **contractors** (and riders) to the **WordPress dashboard** instead so they can manage Events or Animals:

### Option A – Theme `functions.php` (recommended)

1. Open your **theme’s** `functions.php` (e.g. Appearance → Theme File Editor, or edit the file on disk).
2. Copy the **entire contents** of the file:
   `wordpress-theme-rpn-login-redirect.php`
   from this project (everything after the `<?php` and comment block).
3. Paste it at the **end** of `functions.php` (before the closing `?>` if present) and save.

That code does two things:

- **`login_redirect` (priority 999):** When the user was trying to reach wp-admin (or gets sent to my-account), it sends RPN roles to `admin_url()`.
- **`woocommerce_login_redirect` (priority 999):** When WooCommerce redirects after login, it sends producers, contractors, riders, and editors to the dashboard instead of My Account.

### Option B – Code Snippets plugin

1. Install a “Code Snippets” (or similar) plugin.
2. Add a new snippet, paste the same code from `wordpress-theme-rpn-login-redirect.php`, and set it to run “Everywhere”.
3. Activate the snippet.

### After adding the code

- Producers: log in at **yoursite.com/wp-admin** with the email/password from the welcome email. You should land on the **dashboard** and see **Events** in the menu; you can add/edit/delete your own events.
- Contractors: same login; you should see **Contractors** and **Animals** and can add/edit/delete your own.

The RPN plugin already gives these roles the right capabilities and restricts the admin list to their own posts; the theme snippet only fixes the **redirect** so they don’t end up on My Account.

## 4. If you still land on My Account

- Clear browser cache and cookies for the site, or try an incognito window.
- Confirm the snippet is in the **active theme’s** `functions.php` (not a child theme’s if you’re not using one).
- Confirm there are no PHP errors (check **WP_DEBUG** in `wp-config.php` or the server error log).
- Try disabling other plugins that might change login redirects, then test again.
