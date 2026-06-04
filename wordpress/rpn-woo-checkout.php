<?php
/**
 * RIN WooCommerce Checkout Funnel — Link Removal & Page Lock
 *
 * Removes every outbound link on cart, checkout, and thank-you pages so users
 * cannot leave the purchase funnel. Also enqueues the custom RIN checkout CSS.
 *
 * INSTALL: In your child theme's functions.php add:
 *   require_once get_stylesheet_directory() . '/rpn-woo-checkout.php';
 */

if ( ! defined( 'ABSPATH' ) ) {
    exit;
}


/* ==========================================================================
   SECTION 1 — CART PAGE: strip product + shop links
   ========================================================================== */

/**
 * Remove <a> wrapper from product names in the cart table.
 * Leaves plain text only — no clickable product title.
 */
add_filter( 'woocommerce_cart_item_name', 'rin_cart_item_name_no_link', 99, 3 );
function rin_cart_item_name_no_link( $name, $cart_item, $cart_item_key ) {
    // Strip ALL anchor tags, keep inner text
    return wp_strip_all_tags( $name );
}

/**
 * Remove <a> wrapper from product thumbnails in the cart table.
 * Leaves a plain <img> — no clickable thumbnail.
 */
add_filter( 'woocommerce_cart_item_thumbnail', 'rin_cart_item_thumbnail_no_link', 99, 3 );
function rin_cart_item_thumbnail_no_link( $thumbnail, $cart_item, $cart_item_key ) {
    return preg_replace( '#<a\b[^>]*>(.*?)</a>#is', '$1', $thumbnail );
}

/**
 * Replace the cart actions row (below the table).
 * Default WooCommerce renders a "Continue shopping" link and an "Update cart" button.
 * We keep ONLY the "Update cart" button — no shop link.
 */
remove_action( 'woocommerce_cart_actions', 'woocommerce_button_proceed_to_checkout', 20 );
add_action( 'woocommerce_cart_actions', 'rin_cart_update_button_only', 10 );
function rin_cart_update_button_only() {
    // Update cart button (already rendered by WC inside the actions hook via nonce)
    // We just ensure the continue-shopping link never appears by re-filtering the template.
}

/**
 * Remove the "Continue Shopping" / "Return to shop" button that WooCommerce
 * appends inside woocommerce_cart_coupon and cart actions areas.
 */
add_filter( 'woocommerce_continue_shopping_redirect', 'rin_disable_continue_shopping' );
function rin_disable_continue_shopping( $url ) {
    // Return empty string — the button will have no href; CSS hides it.
    return '';
}

/**
 * Override the empty-cart page message + hide the "Return to shop" button.
 */
add_filter( 'wc_empty_cart_message', 'rin_empty_cart_message' );
function rin_empty_cart_message( $message ) {
    return '<span class="rin-empty-cart-text">Your cart is currently empty.</span>';
}

// WooCommerce renders return-to-shop via woocommerce_return_to_shop() called in
// woocommerce/cart/cart-empty.php — override with a blank template part hook.
add_action( 'woocommerce_cart_is_empty', 'rin_hide_return_to_shop_button', 1 );
function rin_hide_return_to_shop_button() {
    // Remove the hook that WooCommerce adds inside cart-empty.php
    remove_action( 'woocommerce_cart_is_empty', 'woocommerce_return_to_shop' );
}

/**
 * Cart totals: replace the default "Proceed to Checkout" button with our styled one.
 * The default anchor already links to checkout — we keep it but add our CSS class.
 */
add_filter( 'woocommerce_order_button_html', 'rin_style_place_order_button' );
function rin_style_place_order_button( $html ) {
    return str_replace( 'class="button', 'class="rin-place-order-btn button', $html );
}


/* ==========================================================================
   SECTION 1a — PRICE DISPLAY: replace $0 with "Free" on funnel pages
   ========================================================================== */

/**
 * Helper: return the "Free" badge HTML.
 */
function rin_free_badge() {
    return '<span class="rin-price-free">Free</span>';
}

/**
 * Cart / checkout order-review table: replace $0 line-item subtotal.
 */
add_filter( 'woocommerce_cart_item_subtotal', 'rin_free_cart_item_subtotal', 20, 3 );
function rin_free_cart_item_subtotal( $subtotal, $cart_item, $cart_item_key ) {
    if ( floatval( $cart_item['line_subtotal'] ?? 0 ) == 0 ) {
        return rin_free_badge();
    }
    return $subtotal;
}

/**
 * Cart totals sidebar / checkout review: replace $0 cart subtotal.
 */
add_filter( 'woocommerce_cart_subtotal', 'rin_free_cart_subtotal', 20, 3 );
function rin_free_cart_subtotal( $subtotal, $compound, $cart ) {
    if ( floatval( $cart->get_subtotal() ) == 0 ) {
        return rin_free_badge();
    }
    return $subtotal;
}

/**
 * Thank-you page: replace $0 order line-item subtotal.
 */
add_filter( 'woocommerce_order_formatted_line_subtotal', 'rin_free_order_line_subtotal', 20, 3 );
function rin_free_order_line_subtotal( $subtotal, $item, $order ) {
    if ( floatval( $item->get_subtotal() ) == 0 ) {
        return rin_free_badge();
    }
    return $subtotal;
}

/**
 * Thank-you page + checkout review: replace $0 order total.
 */
add_filter( 'woocommerce_get_formatted_order_total', 'rin_free_order_total', 20, 2 );
function rin_free_order_total( $total, $order ) {
    if ( floatval( $order->get_total() ) == 0 ) {
        return rin_free_badge();
    }
    return $total;
}

/**
 * Checkout order review tfoot: replace $0 in cart total display.
 * (Covers the "Total" row rendered from WC()->cart->get_total().)
 */
add_filter( 'woocommerce_cart_total', 'rin_free_cart_total', 20 );
function rin_free_cart_total( $total ) {
    // $total is already HTML-formatted — check for $0.00 / £0.00 pattern
    if ( floatval( WC()->cart->get_total( 'edit' ) ) == 0 ) {
        return rin_free_badge();
    }
    return $total;
}


/* ==========================================================================
   SECTION 1b — CHECKOUT: simplified fields (name + email only)
   ========================================================================== */

/**
 * Keep only billing_first_name, billing_last_name, billing_email.
 * Strip address, phone, company, and all shipping fields.
 */
add_filter( 'woocommerce_checkout_fields', 'rin_simplify_checkout_fields' );
function rin_simplify_checkout_fields( $fields ) {
    // Billing: keep only what we need
    $keep_billing = array( 'billing_first_name', 'billing_last_name', 'billing_email' );
    foreach ( array_keys( $fields['billing'] ) as $key ) {
        if ( ! in_array( $key, $keep_billing, true ) ) {
            unset( $fields['billing'][ $key ] );
        }
    }
    // Remove all shipping fields
    $fields['shipping'] = array();
    // Remove order comments / additional fields
    $fields['order'] = array();
    return $fields;
}

/**
 * Pre-fill billing name and email from the logged-in WordPress user.
 */
add_filter( 'woocommerce_checkout_get_value', 'rin_prefill_checkout_from_user', 10, 2 );
function rin_prefill_checkout_from_user( $value, $input ) {
    if ( ! is_user_logged_in() ) {
        return $value;
    }
    $user = wp_get_current_user();
    switch ( $input ) {
        case 'billing_first_name':
            return $user->first_name ?: $value;
        case 'billing_last_name':
            return $user->last_name ?: $value;
        case 'billing_email':
            return $user->user_email ?: $value;
    }
    return $value;
}

/**
 * Change the "Place Order" button text to "Upgrade".
 */
add_filter( 'woocommerce_order_button_text', 'rin_change_place_order_text' );
function rin_change_place_order_text( $text ) {
    return __( 'Upgrade →', 'woocommerce' );
}

/**
 * Inject a 15-minute countdown timer above the checkout form.
 */
add_action( 'woocommerce_before_checkout_form', 'rin_checkout_countdown_timer', 5 );
function rin_checkout_countdown_timer() {
    if ( ! is_checkout() ) {
        return;
    }
    ?>
    <div class="rin-checkout-timer" id="rin-checkout-timer">
        <div class="rin-checkout-timer-inner">
            <span class="rin-timer-lock">&#128274;</span>
            <span class="rin-timer-label">Plan reserved for</span>
            <span class="rin-timer-digits" id="rin-timer-digits">15:00</span>
            <span class="rin-timer-label">— Complete your upgrade before time runs out</span>
        </div>
    </div>
    <script>
    (function () {
        var total = 15 * 60;
        var el    = document.getElementById('rin-timer-digits');
        var wrap  = document.getElementById('rin-checkout-timer');
        if ( ! el ) return;
        var t = setInterval(function () {
            total--;
            if ( total <= 0 ) {
                total = 0;
                clearInterval(t);
                wrap.classList.add('rin-checkout-timer--expired');
                el.textContent = '00:00';
                var label = wrap.querySelector('.rin-timer-label');
                if (label) label.textContent = 'Session expired — please refresh to continue.';
            }
            var m = String(Math.floor(total / 60)).padStart(2, '0');
            var s = String(total % 60).padStart(2, '0');
            el.textContent = m + ':' + s;
        }, 1000);
    })();
    </script>
    <?php
}


/* ==========================================================================
   SECTION 1c — CHECKOUT: replace plain "must be logged in" text with a link
   ========================================================================== */

/**
 * WooCommerce outputs this message through esc_html(), so any HTML in the
 * filter value gets escaped. Solution: blank the default message and output
 * our own notice with a real login link via woocommerce_before_checkout_form.
 */
add_filter( 'woocommerce_checkout_must_be_logged_in_message', '__return_empty_string' );

add_action( 'woocommerce_before_checkout_form', 'rin_checkout_must_login_notice', 2 );
function rin_checkout_must_login_notice() {
    if ( is_user_logged_in() ) {
        return;
    }
    $checkout = WC()->checkout();
    // Only fires when WooCommerce requires login (same condition WC checks internally).
    if ( $checkout->is_registration_enabled() || ! $checkout->is_registration_required() ) {
        return;
    }
    $login_url = wc_get_page_permalink( 'myaccount' );
    echo '<div class="woocommerce-info rin-login-notice" role="status">'
        . esc_html__( 'You must be logged in to checkout.', 'woocommerce' )
        . ' <a href="' . esc_url( $login_url ) . '" class="rin-login-link">'
        . esc_html__( 'Log in here', 'woocommerce' )
        . '</a>'
        . '</div>';
}


/* ==========================================================================
   SECTION 2 — CHECKOUT PAGE: strip order-review links
   ========================================================================== */

/**
 * Remove <a> links from order-item names in the checkout review table.
 * Covers both the checkout review pane and the thank-you order details.
 */
add_filter( 'woocommerce_order_item_name', 'rin_order_item_name_no_link', 99, 3 );
function rin_order_item_name_no_link( $name, $item, $is_visible ) {
    return wp_strip_all_tags( $name );
}

/**
 * Output-buffer the checkout form so we can strip any remaining
 * anchor tags inside the order-review table that WooCommerce renders
 * (e.g. product thumbnails, coupon edit links, etc.)
 */
add_action( 'woocommerce_before_checkout_form', 'rin_checkout_ob_start', 1 );
function rin_checkout_ob_start() {
    ob_start( 'rin_checkout_ob_callback' );
}

add_action( 'woocommerce_after_checkout_form', 'rin_checkout_ob_end', 9999 );
function rin_checkout_ob_end() {
    if ( ob_get_level() ) {
        ob_end_flush();
    }
}

function rin_checkout_ob_callback( $html ) {
    // Strip <a> tags inside the order review table only.
    // Uses a regex that targets the review table block.
    $html = preg_replace_callback(
        '#(<table[^>]+class="[^"]*woocommerce-checkout-review-order-table[^"]*"[^>]*>)(.*?)(</table\s*>)#is',
        function ( $m ) {
            $inner = preg_replace( '#<a\b[^>]*>(.*?)</a>#is', '$1', $m[2] );
            return $m[1] . $inner . $m[3];
        },
        $html
    );

    // Remove "Edit cart" link that appears in the order review header.
    $html = preg_replace(
        '#<a\b[^>]*class="[^"]*woocommerce-remove-coupon[^"]*"[^>]*>.*?</a>#is',
        '',
        $html
    );
    $html = preg_replace(
        '#<a\b[^>]*>\s*' . preg_quote( __( 'Edit cart', 'woocommerce' ), '#' ) . '\s*</a>#i',
        '',
        $html
    );

    return $html;
}

/**
 * Remove product thumbnail link on checkout order-review.
 */
add_filter( 'woocommerce_checkout_product_thumbnail', 'rin_checkout_thumbnail_no_link', 99 );
function rin_checkout_thumbnail_no_link( $thumbnail ) {
    return preg_replace( '#<a\b[^>]*>(.*?)</a>#is', '$1', $thumbnail );
}


/* ==========================================================================
   SECTION 3 — THANK-YOU PAGE: strip all outbound links
   ========================================================================== */

/**
 * Remove the "Order Again" button on the thank-you page.
 */
remove_action( 'woocommerce_order_details_after_order_table', 'woocommerce_order_again_button' );

/**
 * Also remove via hook registered inside WC (belt-and-suspenders).
 */
add_action( 'init', function () {
    remove_action( 'woocommerce_order_details_after_order_table', 'woocommerce_order_again_button' );
} );

/**
 * Output-buffer the thank-you page to strip shop/product navigation links.
 * We keep only the page content (order summary) — strip anything that goes
 * back to shop or other WP pages.
 */
add_action( 'woocommerce_before_thankyou', 'rin_thankyou_ob_start', 1 );
function rin_thankyou_ob_start( $order_id ) {
    ob_start( 'rin_thankyou_ob_callback' );
}

add_action( 'woocommerce_after_order_details', 'rin_thankyou_ob_end', 9999 );
function rin_thankyou_ob_end() {
    if ( ob_get_level() ) {
        ob_end_flush();
    }
}

function rin_thankyou_ob_callback( $html ) {
    // Strip <a> tags from order item names / thumbnails
    $html = preg_replace_callback(
        '#(<table[^>]+class="[^"]*woocommerce-table--order-details[^"]*"[^>]*>)(.*?)(</table\s*>)#is',
        function ( $m ) {
            $inner = preg_replace( '#<a\b[^>]*>(.*?)</a>#is', '$1', $m[2] );
            return $m[1] . $inner . $m[3];
        },
        $html
    );
    return $html;
}

/**
 * Add "Go Back to Home" button at the bottom of the WooCommerce thank-you page.
 */
add_action( 'woocommerce_thankyou', 'rin_thankyou_home_button', 20 );
function rin_thankyou_home_button( $order_id ) {
    $btn1_label = function_exists( 'get_field' ) ? get_field( 'rin_thankyou_btn1_label', 'option' ) : '';
    $btn1_url   = function_exists( 'get_field' ) ? get_field( 'rin_thankyou_btn1_url',   'option' ) : '';
    $btn2_label = function_exists( 'get_field' ) ? get_field( 'rin_thankyou_btn2_label', 'option' ) : '';
    $btn2_url   = function_exists( 'get_field' ) ? get_field( 'rin_thankyou_btn2_url',   'option' ) : '';

    // Fall back to defaults if ACF fields are empty
    if ( ! $btn1_label ) $btn1_label = 'Go to Home';
    if ( ! $btn1_url )   $btn1_url   = home_url( '/' );
    if ( ! $btn2_label ) $btn2_label = 'Go to Dashboard';
    if ( ! $btn2_url )   $btn2_url   = home_url( '/dashboard' );

    echo '<div class="rin-thankyou-actions">'
        . '<a href="' . esc_url( $btn1_url ) . '" class="rin-btn rin-btn-primary">'  . esc_html( $btn1_label ) . '</a>'
        . '<a href="' . esc_url( $btn2_url ) . '" class="rin-btn rin-btn-secondary">' . esc_html( $btn2_label ) . '</a>'
        . '</div>';
}


/* ==========================================================================
   SECTION 4 — GLOBAL FUNNEL LOCK: hide site navigation on funnel pages
   ========================================================================== */

/**
 * Add `rpn-checkout-funnel` body class on cart, checkout, order-received pages.
 * The CSS file uses this class to hide the header nav, footer links, etc.
 */
add_filter( 'body_class', 'rin_funnel_body_class' );
function rin_funnel_body_class( $classes ) {
    if ( is_cart() || is_checkout() ) {
        $classes[] = 'rpn-checkout-funnel';
    }
    return $classes;
}

/**
 * Disable the Astra breadcrumb on funnel pages (the breadcrumb links back to shop).
 */
add_filter( 'astra_breadcrumbs_enabled', 'rin_disable_funnel_breadcrumbs' );
function rin_disable_funnel_breadcrumbs( $enabled ) {
    if ( is_cart() || is_checkout() ) {
        return false;
    }
    return $enabled;
}

/**
 * Remove WooCommerce's built-in breadcrumb on funnel pages.
 */
add_action( 'init', function () {
    if ( is_admin() ) {
        return;
    }
    add_action( 'wp', function () {
        if ( is_cart() || is_checkout() ) {
            remove_action( 'woocommerce_before_main_content', 'woocommerce_breadcrumb', 20 );
        }
    } );
} );


/* ==========================================================================
   SECTION 5 — ENQUEUE STYLES
   ========================================================================== */

add_action( 'wp_enqueue_scripts', 'rin_checkout_enqueue_styles', 50 );
function rin_checkout_enqueue_styles() {
    if ( ! ( is_cart() || is_checkout() || is_wc_endpoint_url( 'order-received' ) ) ) {
        return;
    }
    wp_enqueue_style(
        'rin-woo-checkout',
        get_stylesheet_directory_uri() . '/rpn-woo-checkout.css',
        array( 'woocommerce-general' ),
        '1.1'
    );
}
