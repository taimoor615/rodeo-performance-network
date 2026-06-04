# RPN WordPress – Header, Footer & Cart/Checkout Styling

This folder contains templates and CSS to match your React frontend (RPN) on WordPress with the **Astra free** theme. Header menu is loaded from the **default/primary** WordPress menu; footer content is static for now (you can make it dynamic later with ACF).

## Files

| File | Purpose |
|------|--------|
| `rpn-header.php` | Header template: logo + nav (menu from **Appearance → Menus**, assign to **Primary**). Uses Astra-friendly classes. |
| `rpn-footer.php` | Footer template: brand, Quick Links (same menu), Contact, Follow Us, copyright. Static content. |
| `rpn-theme.css` | Full RPN theme: CSS variables (same colors as frontend), header, footer, and **WooCommerce cart/checkout** styling. |
| `astra-child-setup.php` | Optional: enqueue `rpn-theme.css` and add body class. Include from child theme `functions.php`. |

## Quick setup (Astra child theme)

1. **Create an Astra child theme** (e.g. “RPN Astra”).
2. **Copy into the child theme root:**
   - `rpn-theme.css`
   - `rpn-header.php`
   - `rpn-footer.php`
   - (optional) `astra-child-setup.php`
3. **In the child theme `functions.php`:**

```php
<?php
// Enqueue RPN styles
add_action( 'wp_enqueue_scripts', function () {
    wp_enqueue_style(
        'rpn-theme',
        get_stylesheet_directory_uri() . '/rpn-theme.css',
        array( 'astra-theme-css' ),
        '1.0'
    );
}, 20 );

// Use RPN header (replace Astra default header)
add_action( 'astra_header_before', function () {
    remove_all_actions( 'astra_header' );
}, 1 );
add_action( 'astra_header', function () {
    get_template_part( 'rpn-header' );
}, 1 );

// Use RPN footer (replace Astra default footer)
add_action( 'astra_footer_before', function () {
    remove_all_actions( 'astra_footer' );
}, 1 );
add_action( 'astra_footer', function () {
    get_template_part( 'rpn-footer' );
}, 1 );
```

**Note:** If your Astra version uses different hook names, check Astra’s docs or use the child theme’s `header.php`/`footer.php` override approach described above.

Or, if you prefer to **replace the child theme’s `header.php` and `footer.php`** entirely, copy Astra’s `header.php`/`footer.php` from the parent, then replace the header/footer markup with:

- `<?php get_template_part( 'rpn-header' ); ?>` in `header.php`
- `<?php get_template_part( 'rpn-footer' ); ?>` in `footer.php`

4. **Menu:** In **Appearance → Menus**, create a menu and assign it to **Primary**. That menu is used in both the RPN header and the footer “Quick Links”.

## Colors (same as frontend)

Defined in `rpn-theme.css` as CSS variables, e.g.:

- `--rpn-gold`, `--rpn-cream`, `--rpn-bg`, `--rpn-card`, `--rpn-border`, etc.

Cart and checkout (WooCommerce) use these same variables so they match the frontend theme.

## Cart & checkout

- **Shortcode-based** cart/checkout and **WooCommerce Blocks** (Cart/Checkout blocks) are both styled by `rpn-theme.css`.
- Buttons, inputs, tables, totals, and messages use the same RPN look and colors.

## Footer and ACF

Footer content is static in `rpn-footer.php`. To make it dynamic later with ACF, replace the static text (brand tagline, contact, social links) with `get_field( 'field_name' )` (or equivalent) where needed.

## Astra classes

- Header uses `.ast-container`, `.ast-flex`, etc., so it fits Astra’s layout.
- Footer uses `.ast-container` in `.footer-inner` for width; you can keep or remove it depending on how you integrate the template.
