<?php
/**
 * RPN: Force wp-admin redirect for Producers & Contractors (and Riders)
 *
 * ADD THIS TO YOUR THEME'S functions.php (copy the code below the line)
 * OR use a "Code Snippets" plugin and add it as a snippet.
 *
 * Why: WooCommerce redirects all logins to My Account. This runs after WooCommerce
 * (priority 999) and sends RPN roles to the WordPress dashboard so they can
 * add/edit/delete Events (producers) or Animals (contractors).
 *
 * How to log in to WordPress as producer/contractor:
 * 1. Go to: https://yoursite.com/wp-admin (or https://yoursite.com/wp-login.php)
 * 2. Enter the email and password from your welcome email.
 * 3. You should land on the dashboard and see Events (producer) or Animals + Contractors (contractor).
 */

if (!defined('ABSPATH')) {
    exit;
}

add_filter('login_redirect', 'rpn_theme_force_wp_admin_for_rpn_roles', 999, 3);

function rpn_theme_force_wp_admin_for_rpn_roles($redirect_to, $requested_redirect_to, $user) {
    if (!($user instanceof WP_User)) {
        return $redirect_to;
    }

    $roles = (array) $user->roles;
    $rpn_roles = array('administrator', 'editor', 'author', 'rpn_rider', 'rpn_contractor', 'rpn_producer');

    if (!array_intersect($rpn_roles, $roles)) {
        return $redirect_to;
    }

    $requested = $requested_redirect_to ?: $redirect_to;
    if (strpos($requested, 'wp-admin') !== false || strpos($redirect_to, 'wp-admin') !== false) {
        return admin_url();
    }
    if (strpos($redirect_to, 'my-account') !== false && array_intersect(array('rpn_producer', 'rpn_contractor', 'rpn_rider'), $roles)) {
        return admin_url();
    }
    return $redirect_to;
}

// WooCommerce: when it redirects to My Account, send RPN roles to wp-admin instead.
add_filter('woocommerce_login_redirect', 'rpn_theme_woo_login_redirect_for_rpn_roles', 999, 2);

function rpn_theme_woo_login_redirect_for_rpn_roles($redirect, $user) {
    if (!($user instanceof WP_User)) {
        return $redirect;
    }
    $roles = (array) $user->roles;
    if (array_intersect(array('rpn_producer', 'rpn_contractor', 'rpn_rider', 'administrator', 'editor'), $roles)) {
        return admin_url();
    }
    return $redirect;
}
