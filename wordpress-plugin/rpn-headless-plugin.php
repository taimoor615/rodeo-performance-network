    <?php
    /**
     * Plugin Name: RPN Headless WordPress
     * Description: Registers custom post types and REST API support for Rodeo Performance Network headless frontend.
     * Version: 1.2.0
     * Author: RPN
     */

    if (!defined('ABSPATH')) {
        exit;
    }

    /* ============================================================
    * AUTO-LOGIN: process one-time token after registration.
    *
    * After /rpn/v1/join creates a WP user it issues a short-lived
    * token (15 min).  The React app receives a URL like:
    *   https://yoursite.com/?rpn_autologin=TOKEN&redir=ENCODED_CHECKOUT_URL
    *
    * This handler:
    *  1. Validates & deletes the token (single-use).
    *  2. Sets the WP auth cookie → user is logged in.
    *  3. Pre-fills WooCommerce billing fields from the WP profile.
    *  4. Redirects to the WooCommerce checkout page.
    * ============================================================ */
    add_action('init', 'rpn_handle_autologin');
    function rpn_handle_autologin() {
        if (empty($_GET['rpn_autologin'])) {
            return;
        }

        $token   = sanitize_text_field(wp_unslash($_GET['rpn_autologin']));
        $user_id = get_transient('rpn_autologin_' . $token);

        if (!$user_id) {
            // Token is invalid or expired — send to login page.
            wp_safe_redirect(home_url('/login'));
            exit;
        }

        // One-time use: delete immediately.
        delete_transient('rpn_autologin_' . $token);

        $user = get_user_by('id', (int) $user_id);
        if (!$user) {
            wp_safe_redirect(home_url('/login'));
            exit;
        }

        // Log the user in via auth cookie.
        wp_set_current_user($user_id);
        wp_set_auth_cookie($user_id, false);

        // Pre-fill WooCommerce billing fields from the RIN profile.
        // Always sync name + email so the checkout form is never blank.
        $first_name = (string) get_user_meta($user_id, 'first_name', true);
        $last_name  = (string) get_user_meta($user_id, 'last_name',  true);
        if ($first_name) update_user_meta($user_id, 'billing_first_name', $first_name);
        if ($last_name)  update_user_meta($user_id, 'billing_last_name',  $last_name);
        if ($user->user_email) update_user_meta($user_id, 'billing_email', $user->user_email);

        // Determine redirect target (must be same site).
        $redirect    = '';
        $site_host   = wp_parse_url(home_url(), PHP_URL_HOST);
        if (!empty($_GET['redir'])) {
            $candidate  = esc_url_raw(rawurldecode(sanitize_text_field(wp_unslash($_GET['redir']))));
            $redir_host = wp_parse_url($candidate, PHP_URL_HOST);
            if ($redir_host && $redir_host === $site_host) {
                $redirect = $candidate;
            }
        }

        // Fallback to WooCommerce checkout or home.
        if (!$redirect) {
            $redirect = class_exists('WooCommerce') ? wc_get_checkout_url() : home_url('/');
        }

        wp_redirect($redirect);
        exit;
    }

    /**
     * Allow custom auth headers for CORS (headless React app on different origin)
     */
    add_filter('rest_allowed_cors_headers', function ($allow_headers, $request) {
        $allow_headers[] = 'X-RPN-Auth';
        $allow_headers[] = 'Authorization';
        return $allow_headers;
    }, 10, 2);

    /**
     * Ensure that when users go to /wp-admin and log in, they land on the WordPress dashboard
     * instead of being forced to the WooCommerce \"My Account\" page or another front-end page.
     *
     * This only changes the redirect when the login was trying to reach wp-admin.
     * Front-end logins (e.g. WooCommerce My Account) keep their normal behaviour.
     */
    /**
     * React app base URL — used for all links in emails and login redirects.
     * Override via WordPress option 'rpn_react_app_url' if needed.
     */
    function rpn_get_react_app_url() {
        // Prefer wp-config.php constant, then WP option, then hard-coded default.
        if (defined('RPN_REACT_APP_URL') && RPN_REACT_APP_URL) {
            return rtrim(RPN_REACT_APP_URL, '/');
        }
        return rtrim(get_option('rpn_react_app_url', 'https://rinrodeo.com'), '/');
    }

    // ── Hostinger SMTP ────────────────────────────────────────────────────────
    add_action('phpmailer_init', 'rpn_smtp_config');
    function rpn_smtp_config($phpmailer) {
        $phpmailer->isSMTP();
        $phpmailer->Host       = defined('RPN_SMTP_HOST') ? RPN_SMTP_HOST : 'smtp.hostinger.com';
        $phpmailer->SMTPAuth   = true;
        $phpmailer->Port       = defined('RPN_SMTP_PORT') ? (int) RPN_SMTP_PORT : 465;
        $phpmailer->SMTPSecure = defined('RPN_SMTP_SECURE') ? RPN_SMTP_SECURE : 'ssl';
        $phpmailer->Username   = defined('RPN_SMTP_USER') ? RPN_SMTP_USER : 'info@rinrodeo.com';
        $phpmailer->Password   = defined('RPN_SMTP_PASS') ? RPN_SMTP_PASS : '';
        $phpmailer->From       = defined('RPN_SMTP_FROM') ? RPN_SMTP_FROM : 'info@rinrodeo.com';
        $phpmailer->FromName   = defined('RPN_SMTP_FROM_NAME') ? RPN_SMTP_FROM_NAME : 'Rodeo Identification Network';
    }

    function rpn_login_redirect_to_admin_for_rpn_roles($redirect_to, $requested_redirect_to, $user) {
        if (!($user instanceof WP_User)) return $redirect_to;

        $roles    = (array) $user->roles;
        $is_admin = in_array('administrator', $roles, true);

        if ($is_admin) {
            $requested = $requested_redirect_to ?: $redirect_to;
            if (strpos($requested, 'wp-admin') !== false) return admin_url();
            return $redirect_to;
        }

        // All non-admin users (riders, producers, contractors) → React dashboard
        return rpn_get_react_app_url() . '/dashboard';
    }
    add_filter('login_redirect', 'rpn_login_redirect_to_admin_for_rpn_roles', 999, 3);

    // Override WooCommerce login redirect — non-admin users → React dashboard
    add_filter('woocommerce_login_redirect', function($redirect, $user) {
        if (!($user instanceof WP_User)) return $redirect;
        if (!in_array('administrator', (array) $user->roles, true)) {
            return rpn_get_react_app_url() . '/dashboard';
        }
        return $redirect;
    }, 999, 2);

    // ── Password reset email (Forgot Password flow) ─────────────────────────
    add_filter('retrieve_password_title', function($title, $user_login, $user_data) {
        return 'Reset your RIN password';
    }, 10, 3);

    add_filter('retrieve_password_message', function($message, $key, $user_login, $user_data) {
        $reset_url = rpn_get_react_app_url() . '/set-password?key=' . rawurlencode($key) . '&login=' . rawurlencode($user_login);
        return rpn_build_password_email($user_data->display_name ?: $user_login, $reset_url, 'reset');
    }, 10, 4);

    add_filter('retrieve_password_notification_email', function($defaults) {
        $defaults['headers'] = array('Content-Type: text/html; charset=UTF-8', 'From: RIN Rodeo <info@rinrodeo.com>');
        return $defaults;
    }, 10, 1);

    // ── Capture plaintext password before WordPress hashes it ────────────────
    // Fires during the WP admin Add New User form submission.
    add_action('check_passwords', function($user_login, &$pass1, &$pass2) {
        if ($pass1) {
            set_transient('rpn_new_user_pass_' . md5($user_login), $pass1, 300);
        }
    }, 10, 3);

    // ── New user notification (added from WP backend) ───────────────────────
    add_filter('wp_new_user_notification_email', function($email_data, $user, $blogname) {
        $key = get_password_reset_key($user);
        if (is_wp_error($key)) return $email_data;
        $set_url = rpn_get_react_app_url() . '/set-password?key=' . rawurlencode($key) . '&login=' . rawurlencode($user->user_login);
        $login_url = rpn_get_login_url();

        // Retrieve the plaintext password if captured (only available on fresh creation)
        $pass_transient = 'rpn_new_user_pass_' . md5($user->user_login);
        $generated_pass = (string) get_transient($pass_transient);
        delete_transient($pass_transient);

        $email_data['subject'] = 'Welcome to RIN — Your Account Details';
        $email_data['headers'] = array('Content-Type: text/html; charset=UTF-8', 'From: RIN Rodeo <info@rinrodeo.com>');

        $display_name = $user->first_name ?: ($user->display_name ?: $user->user_login);
        $pass_block = $generated_pass
            ? '<table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;border:1px solid #E5E7EB;border-left:4px solid #FD0000;border-radius:8px;margin:0 0 28px;">
                 <tr><td style="padding:20px 24px;">
                   <p style="margin:0 0 12px;font-size:12px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.08em;">Your Login Details</p>
                   <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Email:</strong>&nbsp;&nbsp;' . esc_html($user->user_email) . '</p>
                   <p style="margin:0;font-size:14px;color:#374151;"><strong>Temporary Password:</strong>&nbsp;&nbsp;<code style="background:#e5e7eb;padding:2px 8px;border-radius:4px;font-size:13px;">' . esc_html($generated_pass) . '</code></p>
                 </td></tr>
               </table>'
            : '<table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;border:1px solid #E5E7EB;border-left:4px solid #FD0000;border-radius:8px;margin:0 0 28px;">
                 <tr><td style="padding:20px 24px;">
                   <p style="margin:0 0 8px;font-size:12px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.08em;">Your Login Email</p>
                   <p style="margin:0;font-size:14px;color:#374151;"><strong>Email:</strong>&nbsp;&nbsp;' . esc_html($user->user_email) . '</p>
                 </td></tr>
               </table>';

        $email_data['message'] = '<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">
      <tr><td style="background:#111827;border-radius:12px 12px 0 0;padding:28px 40px;text-align:center;">
        <p style="margin:0;color:#fff;font-size:24px;font-weight:900;letter-spacing:-1px;">RIN</p>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Rodeo Identification Network</p>
      </td></tr>
      <tr><td style="background:#FD0000;height:4px;"></td></tr>
      <tr><td style="background:#fff;padding:36px 40px;">
        <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Welcome, ' . esc_html($display_name) . '!</p>
        <p style="margin:0 0 28px;font-size:15px;color:#4B5563;line-height:1.7;">Your RIN account has been created. Here are your login details.</p>
        ' . $pass_block . '
        ' . ($generated_pass ? '<p style="margin:0 0 20px;font-size:13px;color:#6B7280;line-height:1.65;">We recommend changing your password after your first login. Click the button below to set a new one.</p>' : '') . '
        <table cellpadding="0" cellspacing="0" style="margin:0 0 20px;">
          <tr>
            <td style="background:#FD0000;border-radius:8px;margin-right:8px;">
              <a href="' . esc_url($login_url) . '" style="display:inline-block;padding:12px 28px;color:#fff;text-decoration:none;font-size:14px;font-weight:700;">Log In to RIN &rarr;</a>
            </td>
            <td width="12"></td>
            <td style="background:#111827;border-radius:8px;">
              <a href="' . esc_url($set_url) . '" style="display:inline-block;padding:12px 28px;color:#fff;text-decoration:none;font-size:14px;font-weight:700;">Change Password</a>
            </td>
          </tr>
        </table>
        <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.65;">Questions? Email us at <a href="mailto:info@rinrodeo.com" style="color:#FD0000;text-decoration:none;">info@rinrodeo.com</a> or call <a href="tel:4346040972" style="color:#FD0000;text-decoration:none;">434-604-0972</a></p>
      </td></tr>
      <tr><td style="background:#F9FAFB;border-top:1px solid #E5E7EB;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#9CA3AF;">&copy; ' . date('Y') . ' Rodeo Identification Network Inc. &middot; <a href="https://rinrodeo.com" style="color:#9CA3AF;text-decoration:none;">rinrodeo.com</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>';
        return $email_data;
    }, 10, 3);

    /**
     * Shared branded HTML email builder for password set/reset flows.
     * $type: 'set' (new user) or 'reset' (forgot password)
     */
    function rpn_build_password_email($display_name, $action_url, $type = 'reset') {
        $heading     = $type === 'set'   ? 'Set Your Password'      : 'Reset Your Password';
        $intro       = $type === 'set'
            ? 'An account has been created for you on the Rodeo Information Network. Click the button below to set your password and access your dashboard.'
            : 'We received a request to reset the password for your RIN account. Click the button below to choose a new password.';
        $btn_label   = $type === 'set'   ? 'Set My Password &rarr;' : 'Reset My Password &rarr;';
        $expire_note = 'This link expires in 24 hours. If you did not request this, you can safely ignore this email.';

        return '<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">
      <tr><td style="background:#111827;border-radius:12px 12px 0 0;padding:28px 40px;text-align:center;">
        <p style="margin:0;color:#fff;font-size:24px;font-weight:900;letter-spacing:-1px;">RIN</p>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Rodeo Information Network</p>
      </td></tr>
      <tr><td style="background:#FD0000;height:4px;"></td></tr>
      <tr><td style="background:#fff;padding:36px 40px;">
        <p style="margin:0 0 8px;font-size:20px;font-weight:700;color:#111827;">' . esc_html($heading) . '</p>
        <p style="margin:0 0 8px;font-size:14px;color:#6B7280;">Hi ' . esc_html($display_name) . ',</p>
        <p style="margin:0 0 28px;font-size:15px;color:#4B5563;line-height:1.7;">' . $intro . '</p>
        <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
          <tr><td style="background:#FD0000;border-radius:8px;">
            <a href="' . esc_url($action_url) . '" style="display:inline-block;padding:14px 36px;color:#fff;text-decoration:none;font-size:15px;font-weight:700;">' . $btn_label . '</a>
          </td></tr>
        </table>
        <p style="margin:0 0 12px;font-size:13px;color:#6B7280;line-height:1.65;">' . $expire_note . '</p>
        <p style="margin:0;font-size:13px;color:#6B7280;">Questions? <a href="mailto:info@rinrodeo.com" style="color:#FD0000;text-decoration:none;">info@rinrodeo.com</a></p>
      </td></tr>
      <tr><td style="background:#F9FAFB;border-top:1px solid #E5E7EB;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#9CA3AF;">&copy; 2026 Rodeo Information Network Inc. &middot; <a href="https://rinrodeo.com" style="color:#9CA3AF;text-decoration:none;">rinrodeo.com</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>';
    }

    /* ========== Condition Modifier Lookup Table (RPN Spec) ========== */
    define('RPN_ARENA_MODIFIERS', array(
        'smooth' => 1.00, 'chopped' => 0.90, 'muddy' => 0.95, 'deep' => 0.92, 'slick' => 0.93,
    ));
    define('RPN_WEATHER_MODIFIERS', array(
        'clear' => 1.00, 'rainy' => 0.95, 'windy' => 0.97, 'hot' => 0.96, 'cold' => 0.96,
    ));
    define('RPN_TIER_MODIFIERS', array(
        'local' => 1.00, 'regional' => 1.10, 'pro' => 1.25, 'championship' => 1.30,
    ));

    function rpn_get_arena_modifier($condition) {
        $key = strtolower(trim((string) $condition));
        return isset(RPN_ARENA_MODIFIERS[$key]) ? RPN_ARENA_MODIFIERS[$key] : 1.00;
    }
    function rpn_get_weather_modifier($condition) {
        $key = strtolower(trim((string) $condition));
        return isset(RPN_WEATHER_MODIFIERS[$key]) ? RPN_WEATHER_MODIFIERS[$key] : 1.00;
    }
    function rpn_get_tier_modifier($tier) {
        $key = strtolower(trim((string) $tier));
        return isset(RPN_TIER_MODIFIERS[$key]) ? RPN_TIER_MODIFIERS[$key] : 1.00;
    }

    function rpn_get_adjusted_score($base_score, $arena_condition, $weather_condition, $event_tier) {
        $arena = rpn_get_arena_modifier($arena_condition);
        $weather = rpn_get_weather_modifier($weather_condition);
        $tier = rpn_get_tier_modifier($event_tier);
        return round((float) $base_score * $arena * $weather * $tier, 2);
    }

    function rpn_get_condition_modifiers_for_rest() {
        return array(
            'arena' => array(
                'smooth' => array('value' => 1.00, 'label' => 'Smooth'),
                'chopped' => array('value' => 0.90, 'label' => 'Chopped'),
                'muddy' => array('value' => 0.95, 'label' => 'Muddy'),
                'deep' => array('value' => 0.92, 'label' => 'Deep'),
                'slick' => array('value' => 0.93, 'label' => 'Slick'),
            ),
            'weather' => array(
                'clear' => array('value' => 1.00, 'label' => 'Clear'),
                'rainy' => array('value' => 0.95, 'label' => 'Rainy'),
                'windy' => array('value' => 0.97, 'label' => 'Windy'),
                'hot' => array('value' => 0.96, 'label' => 'Hot'),
                'cold' => array('value' => 0.96, 'label' => 'Cold'),
            ),
            'tier' => array(
                'local' => array('value' => 1.00, 'label' => 'Local'),
                'regional' => array('value' => 1.10, 'label' => 'Regional'),
                'pro' => array('value' => 1.25, 'label' => 'Pro'),
            ),
            'tooltips' => array(
                'arena' => 'Arena surface affects traction and ride difficulty. Muddy/slick conditions may reduce scores.',
                'weather' => 'Weather conditions can affect performance. Rainy or extreme temps may apply a modifier.',
                'tier' => 'Event tier reflects competitive level. Pro events apply a higher multiplier.',
            ),
        );
    }

    /**
     * Register RPN Custom Post Types
     */
    function rpn_register_post_types() {
        register_post_type('rider', array(
            'labels' => array(
                'name' => 'Riders',
                'singular_name' => 'Rider',
                'add_new' => 'Add Rider',
                'add_new_item' => 'Add New Rider',
                'edit_item' => 'Edit Rider',
            ),
            'public' => true,
            'show_ui' => true,
            'show_in_rest' => true,
            'rest_base' => 'riders',
            'supports' => array('title', 'editor', 'thumbnail', 'custom-fields'),
            'has_archive' => true,
            'capability_type' => array('rider', 'riders'),
            'map_meta_cap' => true,
        ));

        register_post_type('animal', array(
            'labels' => array(
                'name' => 'Animals',
                'singular_name' => 'Animal',
                'add_new' => 'Add Animal',
                'add_new_item' => 'Add New Animal',
            ),
            'public' => true,
            'show_ui' => true,
            'show_in_rest' => true,
            'rest_base' => 'animals',
            'supports' => array('title', 'editor', 'thumbnail', 'custom-fields'),
            'has_archive' => true,
            'capability_type' => array('animal', 'animals'),
            'map_meta_cap' => true,
        ));

        register_post_type('pickup_team', array(
            'labels' => array(
                'name' => 'Pickup Teams',
                'singular_name' => 'Pickup Team',
            ),
            'public' => true,
            'show_in_rest' => true,
            'rest_base' => 'pickup-teams',
            'supports' => array('title', 'editor', 'thumbnail', 'custom-fields'),
            'has_archive' => true,
        ));

        register_post_type('rpn_event', array(
            'labels' => array(
                'name' => 'Events',
                'singular_name' => 'Event',
            ),
            'public' => true,
            'show_ui' => true,
            'show_in_rest' => true,
            'rest_base' => 'events',
            'supports' => array('title', 'editor', 'thumbnail', 'custom-fields'),
            'has_archive' => true,
            'capability_type' => array('rpn_event', 'rpn_events'),
            'map_meta_cap' => true,
        ));

        // Media highlights (video / image clips that can be liked and tagged)
        register_post_type('rpn_media', array(
            'labels' => array(
                'name' => 'Media',
                'singular_name' => 'Media Item',
            ),
            'public' => true,
            'show_in_rest' => true,
            'rest_base' => 'media-highlights',
            'supports' => array('title', 'editor', 'thumbnail', 'custom-fields'),
            'has_archive' => true,
        ));

        // Stock contractors (for CRI – Contractor Rating Index)
        register_post_type('rpn_contractor', array(
            'labels' => array(
                'name' => 'Contractors',
                'singular_name' => 'Contractor',
            ),
            'public' => true,
            'show_ui' => true,
            'show_in_rest' => true,
            'rest_base' => 'contractors',
            'supports' => array('title', 'editor', 'thumbnail', 'custom-fields'),
            'has_archive' => true,
            'capability_type' => array('rpn_contractor', 'rpn_contractors'),
            'map_meta_cap' => true,
        ));

        // Event producers (for PRI – Producer Rating Index)
        register_post_type('rpn_producer', array(
            'labels' => array(
                'name' => 'Producers',
                'singular_name' => 'Producer',
            ),
            'public' => true,
            'show_ui' => true,
            'show_in_rest' => true,
            'rest_base' => 'producers',
            'supports' => array('title', 'editor', 'thumbnail', 'custom-fields'),
            'has_archive' => true,
            'capability_type' => array('rpn_producer', 'rpn_producers'),
            'map_meta_cap' => true,
        ));

        register_post_type('rpn_performance', array(
            'labels' => array(
                'name'               => 'Performances',
                'singular_name'      => 'Performance',
                'add_new'            => 'Add Performance',
                'all_items'          => 'All Performances',
                'edit_item'          => 'Edit Performance',
                'view_item'          => 'View Performance',
                'search_items'       => 'Search Performances',
                'not_found'          => 'No performances found',
                'not_found_in_trash' => 'No performances found in trash',
            ),
            'public'            => false,
            'show_ui'           => true,
            'show_in_menu'      => true,
            'show_in_nav_menus' => false,
            'show_in_rest'      => true,
            'rest_base'         => 'performances',
            'supports'          => array('title', 'custom-fields'),
            'menu_icon'         => 'dashicons-chart-bar',
            'capability_type'   => 'post',
            'map_meta_cap'      => true,
        ));
    }
    add_action('init', 'rpn_register_post_types');

    /* ==========================================================================
    * PERFORMANCE META BOX — editable form in WP Admin + save hook
    * ========================================================================== */
    add_action('add_meta_boxes', 'rpn_performance_add_meta_box');
    function rpn_performance_add_meta_box() {
        add_meta_box(
            'rpn_performance_details',
            'Performance Details',
            'rpn_performance_meta_box_cb',
            'rpn_performance',
            'normal',
            'high'
        );
    }

    function rpn_performance_meta_box_cb($post) {
        wp_nonce_field('rpn_perf_meta_save', 'rpn_perf_meta_nonce');

        $g = function($key, $default = '') use ($post) {
            $v = get_post_meta($post->ID, $key, true);
            return ($v !== '' && $v !== false && $v !== null) ? $v : $default;
        };

        $perf_type = $g('performance_type');
        $rider_id  = (int) $g('rider_id');

        // All rider posts for the dropdown
        $riders = get_posts(array('post_type' => 'rider', 'post_status' => 'publish', 'numberposts' => -1, 'orderby' => 'title', 'order' => 'ASC'));

        $arena_opts   = array('smooth' => 'Smooth', 'chopped' => 'Chopped', 'muddy' => 'Muddy', 'deep' => 'Deep', 'slick' => 'Slick');
        $weather_opts = array('clear' => 'Clear', 'rainy' => 'Rainy', 'windy' => 'Windy', 'hot' => 'Hot', 'cold' => 'Cold');
        $tier_opts    = array('local' => 'Local', 'regional' => 'Regional', 'pro' => 'Pro');
        $cat_rough    = array('Bareback Riding', 'Saddle Bronc', 'Bull Riding');
        $cat_timed    = array('Barrel Racing', 'Pole Bending', 'Goat Tying', 'Breakaway Roping', 'Tie-Down Roping', 'Steer Wrestling', 'Team Roping – Header', 'Team Roping – Heeler');

        $sel = function($name, $options, $current, $attrs = '') {
            echo "<select name='" . esc_attr($name) . "' id='" . esc_attr($name) . "' {$attrs} style='width:100%;max-width:320px;'>";
            foreach ($options as $k => $label) {
                $selected = selected($current, $k, false);
                echo "<option value='" . esc_attr($k) . "' {$selected}>" . esc_html($label) . "</option>";
            }
            echo "</select>";
        };

        $inp = function($name, $type, $current, $attrs = '') {
            echo "<input type='" . esc_attr($type) . "' name='" . esc_attr($name) . "' id='" . esc_attr($name) . "' value='" . esc_attr($current) . "' {$attrs} style='width:100%;max-width:200px;'>";
        };

        $chk = function($name, $current, $true_val = 'true') {
            $checked = checked($current, $true_val, false);
            echo "<input type='checkbox' name='" . esc_attr($name) . "' id='" . esc_attr($name) . "' value='true' {$checked}>";
        };

        $row = function($label, $content, $hint = '') {
            echo "<tr><td style='padding:7px 10px;font-weight:600;color:#374151;width:200px;vertical-align:middle;'><label>" . esc_html($label) . "</label>";
            if ($hint) echo "<br><small style='color:#9ca3af;font-weight:400;'>" . esc_html($hint) . "</small>";
            echo "</td><td style='padding:7px 10px;'>{$content}</td></tr>";
        };

        echo "<style>
            .rpn-mb-section{margin:14px 0 4px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;
                color:#6b7280;border-bottom:2px solid #e5e7eb;padding-bottom:3px;}
            .rpn-mb-table{width:100%;border-collapse:collapse;margin-bottom:4px;}
            .rpn-mb-table tr:nth-child(even) td{background:#f9fafb;}
            .rpn-mb-table td{padding:6px 10px;}
            .rpn-score-out{display:inline-block;background:#111827;color:#fff;padding:3px 12px;border-radius:20px;font-weight:700;font-size:13px;min-width:40px;text-align:center;}
            .rpn-rpi-out{display:inline-block;background:#dc2626;color:#fff;padding:3px 12px;border-radius:20px;font-weight:700;font-size:13px;min-width:40px;text-align:center;}
            #rpn-rough-section,#rpn-timed-section{display:none;}
        </style>";

        // ── Overview ─────────────────────────────────────────────────────────────
        echo "<p class='rpn-mb-section'>Overview</p><table class='rpn-mb-table'>";

        // Rider dropdown
        ob_start();
        echo "<select name='rpn_rider_id' id='rpn_rider_id' style='width:100%;max-width:320px;'>";
        echo "<option value=''>— Select Rider —</option>";
        foreach ($riders as $r) {
            $selected = selected($rider_id, $r->ID, false);
            echo "<option value='" . esc_attr($r->ID) . "' {$selected}>" . esc_html($r->post_title) . " (ID: {$r->ID})</option>";
        }
        echo "</select>";
        $row('Rider', ob_get_clean());

        ob_start();
        echo "<select name='rpn_performance_type' id='rpn_performance_type' style='width:100%;max-width:200px;' onchange='rpnToggleType(this.value)'>";
        foreach (array('' => '— Select —', 'roughstock' => 'Roughstock', 'timed' => 'Timed') as $k => $l) {
            $selected = selected($perf_type, $k, false);
            echo "<option value='" . esc_attr($k) . "' {$selected}>" . esc_html($l) . "</option>";
        }
        echo "</select>";
        $row('Performance Type', ob_get_clean());

        ob_start();
        $all_cats = array_merge($cat_rough, $cat_timed);
        $event_cat = $g('event_category');
        echo "<select name='rpn_event_category' id='rpn_event_category' style='width:100%;max-width:320px;'>";
        echo "<option value=''>— Select Category —</option>";
        echo "<optgroup label='Roughstock'>";
        foreach ($cat_rough as $c) { $sel2 = selected($event_cat, $c, false); echo "<option value='" . esc_attr($c) . "' {$sel2}>" . esc_html($c) . "</option>"; }
        echo "</optgroup><optgroup label='Timed'>";
        foreach ($cat_timed as $c) { $sel2 = selected($event_cat, $c, false); echo "<option value='" . esc_attr($c) . "' {$sel2}>" . esc_html($c) . "</option>"; }
        echo "</optgroup></select>";
        $row('Event Category', ob_get_clean());

        ob_start(); $inp('rpn_event_name', 'text', $g('event_name'), 'style="width:100%;max-width:320px;"'); $row('Event Name', ob_get_clean());
        ob_start(); $inp('rpn_event_id_field', 'number', (int) get_post_meta($post->ID, 'event_id', true) ?: '', 'placeholder="WP post ID of the event (for field strength)"'); $row('Event ID', ob_get_clean());
        ob_start(); $inp('rpn_performance_date', 'date', $g('performance_date')); $row('Performance Date', ob_get_clean());
        ob_start(); $inp('rpn_go_round', 'text', $g('go_round', 'Round 1'), 'placeholder="Round 1"'); $row('Go Round', ob_get_clean());
        ob_start(); $inp('rpn_division', 'text', $g('division'), 'placeholder="Open, Youth, etc."'); $row('Division', ob_get_clean());
        echo "</table>";

        // ── Conditions & Tier ─────────────────────────────────────────────────────
        echo "<p class='rpn-mb-section'>Conditions & Tier</p><table class='rpn-mb-table'>";
        ob_start(); $sel('rpn_arena_condition', $arena_opts, $g('arena_condition', 'smooth')); $row('Arena Condition', ob_get_clean());
        ob_start(); $sel('rpn_weather_condition', $weather_opts, $g('weather_condition', 'clear')); $row('Weather Condition', ob_get_clean());
        $tier_opts_full = array('local' => 'Local (1.0×)', 'regional' => 'Regional (1.1×)', 'pro' => 'Pro (1.25×)', 'championship' => 'Championship (1.3×)');
        ob_start(); $sel('rpn_event_tier', $tier_opts_full, $g('event_tier', 'local')); $row('Event Tier', ob_get_clean());
        $verify_opts = array('self_reported' => 'Self-Reported (0.90×)', 'official' => 'Official / API Verified (1.05×)');
        ob_start(); $sel('rpn_verification_status', $verify_opts, $g('verification_status', 'self_reported')); $row('Verification Status', ob_get_clean(), 'Official data gets a 1.05× boost; self-reported 0.90×');
        echo "</table>";

        // ── Roughstock Section ────────────────────────────────────────────────────
        echo "<div id='rpn-rough-section'>";
        echo "<p class='rpn-mb-section'>Roughstock Scores</p><table class='rpn-mb-table'>";
        ob_start(); $inp('rpn_animal_name', 'text', $g('animal_name'), 'placeholder="Animal name"'); $row('Animal Name', ob_get_clean());
        ob_start(); $inp('rpn_animal_id', 'number', $g('animal_id', ''), 'min="0" placeholder="WP Post ID (0 = none)"'); $row('Animal Post ID', ob_get_clean(), 'Optional — links to Animal CPT; enables auto SRI calculation');

        ob_start();
        $chk('rpn_qualified_ride', $g('qualified_ride'), 'true');
        echo " <label for='rpn_qualified_ride'>Qualified (covered 8 seconds)</label>";
        $row('Covered / Qualified', ob_get_clean(), 'Uncheck = buckoff');

        ob_start(); $inp('rpn_judge1_score', 'number', $g('judge1_score', ''), 'min="0" max="25" placeholder="0–25"'); $row('Judge 1 Score', ob_get_clean(), 'max 25');
        ob_start(); $inp('rpn_judge2_score', 'number', $g('judge2_score', ''), 'min="0" max="25" placeholder="0–25"'); $row('Judge 2 Score', ob_get_clean(), 'max 25');
        ob_start(); $inp('rpn_animal_score', 'number', $g('animal_score', ''), 'min="0" max="50" placeholder="0–50"'); $row('Animal Score', ob_get_clean(), 'max 50');

        ob_start();
        $fin = (int)$g('final_score');
        echo "<span class='rpn-score-out' id='rpn_final_score_display'>" . esc_html($fin ?: '—') . "</span>";
        echo "<input type='hidden' name='rpn_final_score' id='rpn_final_score' value='" . esc_attr($fin) . "'>";
        $row('Final Score', ob_get_clean(), 'Auto-calculated: J1 + J2 + Animal');

        ob_start(); $inp('rpn_placement_rough', 'number', $g('placement', ''), 'min="1" placeholder="1, 2, 3…"'); $row('Placement', ob_get_clean(), '1 = win');
        ob_start(); $inp('rpn_payout_rough', 'number', $g('payout', ''), 'min="0" step="0.01" placeholder="0.00"'); $row('Payout ($)', ob_get_clean());
        echo "</table>";
        echo "</div><!-- /rpn-rough-section -->";

        // ── Timed Section ─────────────────────────────────────────────────────────
        echo "<div id='rpn-timed-section'>";
        echo "<p class='rpn-mb-section'>Timed Run Data</p><table class='rpn-mb-table'>";
        ob_start(); $inp('rpn_horse_name', 'text', $g('horse_name'), 'placeholder="Horse name"'); $row('Horse Name', ob_get_clean());
        ob_start(); $inp('rpn_horse_id', 'number', $g('animal_id', ''), 'min="0" placeholder="WP Post ID (0 = none)"'); $row('Horse Post ID', ob_get_clean(), 'Optional — links to Animal CPT; enables auto TEI/BHI calculation');

        ob_start();
        $chk('rpn_no_time', $g('no_time'), 'true');
        echo " <label for='rpn_no_time'>No Time (knocked barrel, broke barrier, etc.)</label>";
        $row('No Time', ob_get_clean());

        ob_start(); $inp('rpn_raw_run_time', 'number', $g('raw_run_time', ''), 'min="0" step="0.001" placeholder="e.g. 14.823"'); $row('Raw Run Time (s)', ob_get_clean());
        ob_start(); $inp('rpn_field_best_time', 'number', $g('field_best_time', ''), 'min="0" step="0.001" placeholder="e.g. 14.100"'); $row('Field Best Time (s)', ob_get_clean(), 'Fastest time in this go-round — used to compute relative score (100 − ratio × 30)');
        ob_start(); $inp('rpn_num_penalties', 'number', $g('num_penalties', '0'), 'min="0" placeholder="0"'); $row('Number of Penalties', ob_get_clean(), 'Infractions (not seconds)');

        ob_start();
        $fin_t = $g('final_time');
        $pen_s = $g('penalty_seconds');
        echo "<span class='rpn-score-out'>" . ($fin_t !== '' ? esc_html($fin_t) . 's' : '—') . "</span>";
        echo " <small style='color:#6b7280;'>penalty seconds: " . esc_html($pen_s ?: '0') . "s</small>";
        echo "<input type='hidden' name='rpn_final_time' id='rpn_final_time' value='" . esc_attr($fin_t) . "'>";
        echo "<input type='hidden' name='rpn_penalty_seconds' id='rpn_penalty_seconds' value='" . esc_attr($pen_s) . "'>";
        echo "<input type='hidden' name='rpn_clean_run' id='rpn_clean_run' value='" . esc_attr($g('clean_run')) . "'>";
        $row('Final Time (s)', ob_get_clean(), 'Auto-calculated on save');

        ob_start(); $inp('rpn_placement_timed', 'number', $g('placement', ''), 'min="1" placeholder="1, 2, 3…"'); $row('Placement', ob_get_clean(), '1 = win');
        ob_start(); $inp('rpn_payout_timed', 'number', $g('payout', ''), 'min="0" step="0.01" placeholder="0.00"'); $row('Payout ($)', ob_get_clean());
        echo "</table>";
        echo "</div><!-- /rpn-timed-section -->";

        // ── RPI & Scoring (read-only output) ──────────────────────────────────────
        echo "<p class='rpn-mb-section'>RPI & Scoring (auto-calculated on save)</p><table class='rpn-mb-table'>";

        ob_start();
        $use_rpi = $g('use_for_rpi', 'true');
        $chk('rpn_use_for_rpi', $use_rpi, 'true');
        echo " <label for='rpn_use_for_rpi'>Count toward RPI</label>";
        $row('Counts Toward RPI', ob_get_clean());

        $raw_es  = $g('raw_event_score', '0');
        $fs_mult = $g('field_strength_mult', '1.0');
        $wes     = $g('weighted_event_score', '0');
        $row('Raw Event Score',      "<span class='rpn-score-out'>" . esc_html($raw_es)  . "</span> <small style='color:#9ca3af;'>(judge+placement bonus, or 100−ratio×30)</small>");
        $row('Field Strength Mult.', "<span class='rpn-score-out'>" . esc_html($fs_mult) . "×</span> <small style='color:#9ca3af;'>(0.85–1.20 based on opponents\' RPIs)</small>");
        $row('Weighted Event Score', "<span class='rpn-rpi-out'>"  . esc_html($wes)     . "</span> <small style='color:#9ca3af;'>(raw × field × tier × verification, capped 100)</small>");
        echo "</table>";

        // JS: show/hide sections + live final score
        $init_type = esc_js($perf_type);
        echo "<script>
        function rpnToggleType(t) {
            document.getElementById('rpn-rough-section').style.display = (t === 'roughstock') ? 'block' : 'none';
            document.getElementById('rpn-timed-section').style.display = (t === 'timed')      ? 'block' : 'none';
        }
        rpnToggleType('" . $init_type . "');

        // Live final score preview for roughstock
        ['rpn_judge1_score','rpn_judge2_score','rpn_animal_score'].forEach(function(id) {
            var el = document.getElementById(id);
            if (el) el.addEventListener('input', function() {
                var j1 = parseInt(document.getElementById('rpn_judge1_score').value) || 0;
                var j2 = parseInt(document.getElementById('rpn_judge2_score').value) || 0;
                var an = parseInt(document.getElementById('rpn_animal_score').value) || 0;
                var fin = j1 + j2 + an;
                var disp = document.getElementById('rpn_final_score_display');
                var inp  = document.getElementById('rpn_final_score');
                if (disp) disp.textContent = fin;
                if (inp)  inp.value = fin;
            });
        });
        </script>";
    }

    /* ---------- Save performance meta on WP Admin publish/update ---------- */
    add_action('save_post_rpn_performance', 'rpn_save_performance_meta_box');
    function rpn_save_performance_meta_box($post_id) {
        if (!isset($_POST['rpn_perf_meta_nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['rpn_perf_meta_nonce'])), 'rpn_perf_meta_save')) return;
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
        if (!current_user_can('manage_options')) return;

        $s  = function($key) { return isset($_POST[$key]) ? sanitize_text_field(wp_unslash($_POST[$key])) : ''; };
        $n  = function($key) { return isset($_POST[$key]) && $_POST[$key] !== '' ? (float) $_POST[$key] : ''; };
        $ni = function($key) { return isset($_POST[$key]) && $_POST[$key] !== '' ? (int)   $_POST[$key] : ''; };

        $perf_type = $s('rpn_performance_type');
        $rider_id  = (int) $s('rpn_rider_id');

        update_post_meta($post_id, 'rider_id',          $rider_id);
        update_post_meta($post_id, 'performance_type',  $perf_type);
        update_post_meta($post_id, 'event_category',    $s('rpn_event_category'));
        update_post_meta($post_id, 'event_name',        $s('rpn_event_name'));
        update_post_meta($post_id, 'performance_date',  $s('rpn_performance_date'));
        update_post_meta($post_id, 'go_round',          $s('rpn_go_round'));
        update_post_meta($post_id, 'division',          $s('rpn_division'));
        update_post_meta($post_id, 'arena_condition',   $s('rpn_arena_condition'));
        update_post_meta($post_id, 'weather_condition', $s('rpn_weather_condition'));
        update_post_meta($post_id, 'event_tier',        $s('rpn_event_tier'));
        update_post_meta($post_id, 'use_for_rpi',       isset($_POST['rpn_use_for_rpi']) ? 'true' : 'false');

        $arena               = $s('rpn_arena_condition');
        $weather             = $s('rpn_weather_condition');
        $tier                = $s('rpn_event_tier');
        $verification_status = $s('rpn_verification_status') ?: 'self_reported';
        // Allow admin to set/override event_id via the form field
        $event_id_from_form  = isset($_POST['rpn_event_id_field']) ? (int) $_POST['rpn_event_id_field'] : 0;
        if ( $event_id_from_form > 0 ) {
            update_post_meta( $post_id, 'event_id', $event_id_from_form );
        }
        $event_id_meta       = (int) get_post_meta($post_id, 'event_id', true);

        if ($perf_type === 'roughstock') {
            $qualified   = isset($_POST['rpn_qualified_ride']) ? 'true' : 'false';
            $judge1      = min(25, max(0, (int) $n('rpn_judge1_score')));
            $judge2      = min(25, max(0, (int) $n('rpn_judge2_score')));
            $animal_pts  = min(50, max(0, (int) $n('rpn_animal_score')));
            $final_score = ($qualified === 'true') ? ($judge1 + $judge2 + $animal_pts) : 0;
            $placement   = $ni('rpn_placement_rough');
            $go_round    = $s('rpn_go_round') ?: 'Round 1';

            // Spec formula: raw = judge_total + placement_bonus (0 if no cover)
            $raw_event_score = rpn_calc_roughstock_event_score($final_score, $placement, $qualified === 'true');

            update_post_meta($post_id, 'qualified_ride', $qualified);
            update_post_meta($post_id, 'judge1_score',   $judge1);
            update_post_meta($post_id, 'judge2_score',   $judge2);
            update_post_meta($post_id, 'animal_score',   $animal_pts);
            update_post_meta($post_id, 'final_score',    $final_score);
            update_post_meta($post_id, 'animal_name',    $s('rpn_animal_name'));
            update_post_meta($post_id, 'animal_id',      $ni('rpn_animal_id') ?: 0);
            update_post_meta($post_id, 'placement',      $placement !== '' ? $placement : '');
            update_post_meta($post_id, 'payout',         $n('rpn_payout_rough'));
            update_post_meta($post_id, 'go_round',       $go_round);
            // Defaults for timed fields
            update_post_meta($post_id, 'no_time',        '');
            update_post_meta($post_id, 'raw_run_time',   '');
            update_post_meta($post_id, 'field_best_time','');
            update_post_meta($post_id, 'num_penalties',  '');
            update_post_meta($post_id, 'penalty_seconds','');
            update_post_meta($post_id, 'final_time',     '');
            update_post_meta($post_id, 'clean_run',      '');
            update_post_meta($post_id, 'horse_name',     '');

            rpn_compute_and_store_weighted_score($post_id, $raw_event_score, $event_id_meta, $go_round, $rider_id, $tier, $verification_status);

        } elseif ($perf_type === 'timed') {
            $no_time         = isset($_POST['rpn_no_time']) ? 'true' : 'false';
            $raw_time        = $no_time === 'true' ? '' : $n('rpn_raw_run_time');
            $field_best_time = $n('rpn_field_best_time');
            $num_pen         = $no_time === 'true' ? 0 : max(0, (int) $n('rpn_num_penalties'));
            $event_cat       = $s('rpn_event_category');
            $pen_val         = rpn_timed_penalty_value($event_cat);
            $pen_secs        = $num_pen * $pen_val;
            $final_time      = ($no_time === 'true' || $raw_time === '') ? '' : (float)$raw_time + $pen_secs;
            $clean_run       = ($no_time === 'false' && $num_pen === 0) ? 'true' : 'false';
            $placement       = $ni('rpn_placement_timed');
            $go_round        = $s('rpn_go_round') ?: 'Round 1';

            // Spec formula: raw = 100 − (final_time / field_best_time × 30)
            $raw_event_score = rpn_calc_timed_event_score(
                $final_time !== '' ? (float) $final_time : 0,
                $field_best_time !== '' ? (float) $field_best_time : 0,
                $no_time === 'true'
            );

            update_post_meta($post_id, 'no_time',         $no_time);
            update_post_meta($post_id, 'raw_run_time',    $raw_time);
            update_post_meta($post_id, 'field_best_time', $field_best_time !== '' ? $field_best_time : '');
            update_post_meta($post_id, 'num_penalties',   $num_pen);
            update_post_meta($post_id, 'penalty_seconds', $pen_secs);
            update_post_meta($post_id, 'final_time',      $final_time);
            update_post_meta($post_id, 'clean_run',       $clean_run);
            update_post_meta($post_id, 'horse_name',      $s('rpn_horse_name'));
            update_post_meta($post_id, 'animal_id',       $ni('rpn_horse_id') ?: 0);
            update_post_meta($post_id, 'placement',       $placement !== '' ? $placement : '');
            update_post_meta($post_id, 'payout',          $n('rpn_payout_timed'));
            update_post_meta($post_id, 'go_round',        $go_round);
            // Defaults for roughstock fields
            update_post_meta($post_id, 'qualified_ride',  '');
            update_post_meta($post_id, 'judge1_score',    '');
            update_post_meta($post_id, 'judge2_score',    '');
            update_post_meta($post_id, 'animal_score',    '');
            update_post_meta($post_id, 'final_score',     '');
            update_post_meta($post_id, 'animal_name',     '');

            rpn_compute_and_store_weighted_score($post_id, $raw_event_score, $event_id_meta, $go_round, $rider_id, $tier, $verification_status);
        }

        // Recalculate RPI for the linked rider
        if ($rider_id > 0) {
            rpn_update_rider_index_from_performances($rider_id);
            rpn_refresh_rider_season_stats($rider_id);
        }

        // Section 9 — Recalculate SRI/TEI for the linked animal
        $linked_animal_id = (int) get_post_meta($post_id, 'animal_id', true);
        if ($linked_animal_id > 0) {
            rpn_update_animal_sri($linked_animal_id);
        }

        // Update PRI for the event's producer
        $event_id_for_pri = (int) get_post_meta($post_id, 'event_id', true);
        if ($event_id_for_pri > 0) {
            $producer_id_for_pri = (int) get_post_meta($event_id_for_pri, 'producer_id', true);
            if ($producer_id_for_pri > 0) {
                rpn_update_producer_pri($producer_id_for_pri);
            }
        }
    }

    /* =====================================================================
    * Animal CPT — WordPress Admin Meta Box
    * Gives admins a structured UI instead of raw custom fields.
    * Featured image (thumbnail) is set via the native WP Featured Image panel.
    * ===================================================================== */
    add_action('add_meta_boxes', 'rpn_animal_add_meta_box');
    function rpn_animal_add_meta_box() {
        add_meta_box(
            'rpn_animal_details',
            'Animal Details',
            'rpn_animal_meta_box_cb',
            'animal',
            'normal',
            'high'
        );
    }

    function rpn_animal_meta_box_cb($post) {
        wp_nonce_field('rpn_animal_meta_save', 'rpn_animal_meta_nonce');

        $g  = function($key, $default = '') use ($post) {
            $v = get_post_meta($post->ID, $key, true);
            return ($v !== '' && $v !== false && $v !== null) ? $v : $default;
        };
        $gn = function($key) use ($post) {
            return (float)(get_post_meta($post->ID, $key, true) ?: 0);
        };

        $video_links = get_post_meta($post->ID, 'video_links', true);
        $video_links = is_array($video_links) ? array_pad($video_links, 5, '') : ['','','','',''];

        echo '<style>
            .rpn-mb-section{margin:14px 0 4px;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.07em;
                color:#6b7280;border-bottom:2px solid #e5e7eb;padding-bottom:3px;}
            .rpn-mb-table{width:100%;border-collapse:collapse;margin-bottom:4px;}
            .rpn-mb-table tr:nth-child(even) td{background:#f9fafb;}
            .rpn-mb-table td{padding:6px 10px;vertical-align:middle;}
            .rpn-mb-table label{font-weight:600;color:#374151;}
            .rpn-mb-table input[type=text],.rpn-mb-table input[type=number],
            .rpn-mb-table input[type=url],.rpn-mb-table input[type=date],
            .rpn-mb-table select,.rpn-mb-table textarea{width:100%;max-width:420px;box-sizing:border-box;}
            .rpn-stat-badge{display:inline-block;background:#111827;color:#fff;padding:3px 12px;border-radius:20px;
                font-weight:700;font-size:12px;margin-right:6px;}
            .rpn-hint{font-size:11px;color:#9ca3af;display:block;margin-top:2px;}
        </style>';

        // ── Identity ─────────────────────────────────────────────────────────────
        echo "<p class='rpn-mb-section'>Identity</p><table class='rpn-mb-table'>";

        // Animal Type
        $type_options = ['Bull','Saddle Bronc Horse','Bareback Horse','Barrel Horse',
                        'Breakaway Horse','Rope Horse','Steer Wrestling Horse','All-Around Horse','Other'];
        $cur_type = $g('animal_type');
        ob_start();
        echo "<select name='rpn_animal_type' style='width:100%;max-width:250px;'>";
        echo "<option value=''>— Select Type —</option>";
        foreach ($type_options as $t) {
            $sel = selected($cur_type, $t, false);
            echo "<option value='" . esc_attr($t) . "' {$sel}>" . esc_html($t) . "</option>";
        }
        echo "</select>";
        $type_html = ob_get_clean();
        echo "<tr><td style='width:180px;'><label>Animal Type</label></td><td>{$type_html}</td></tr>";

        // Scoring Type
        $cur_scoring = $g('scoring_type');
        ob_start();
        echo "<select name='rpn_scoring_type' style='width:100%;max-width:200px;'>";
        foreach (['' => '— Select —', 'roughstock' => 'Roughstock', 'timed' => 'Timed', 'barrel' => 'Barrel'] as $k => $l) {
            $sel = selected($cur_scoring, $k, false);
            echo "<option value='" . esc_attr($k) . "' {$sel}>" . esc_html($l) . "</option>";
        }
        echo "</select>";
        $scoring_html = ob_get_clean();
        echo "<tr><td><label>Scoring Type</label></td><td>{$scoring_html}</td></tr>";

        // Unique Number / Sex / Currently Active
        $ain_val = $g('unique_number');
        echo "<tr><td><label>Animal ID (AIN)</label></td><td>";
        if ($ain_val) {
            echo "<code style='background:#f3f4f6;padding:3px 8px;border-radius:4px;font-size:13px;font-weight:700;color:#111827;'>" . esc_html($ain_val) . "</code> <em style='color:#9ca3af;font-size:11px;'>auto-generated, read-only</em>";
        } else {
            echo "<em style='color:#9ca3af;font-size:12px;'>Will be assigned on first save.</em>";
        }
        echo "</td></tr>";

        $cur_sex = $g('sex');
        ob_start();
        echo "<select name='rpn_sex' style='max-width:180px;'>";
        foreach (['' => '— Select —', 'Bull' => 'Bull', 'Steer' => 'Steer', 'Stallion' => 'Stallion', 'Gelding' => 'Gelding', 'Mare' => 'Mare'] as $k => $l) {
            $sel = selected($cur_sex, $k, false);
            echo "<option value='" . esc_attr($k) . "' {$sel}>" . esc_html($l) . "</option>";
        }
        echo "</select>";
        $sex_html = ob_get_clean();
        echo "<tr><td><label>Sex</label></td><td>{$sex_html}</td></tr>";

        $cur_active = $g('currently_active', 'yes');
        ob_start();
        echo "<select name='rpn_currently_active' style='max-width:120px;'>";
        echo "<option value='yes'" . selected($cur_active, 'yes', false) . ">Yes</option>";
        echo "<option value='no'" . selected($cur_active, 'no', false) . ">No</option>";
        echo "</select>";
        $active_html = ob_get_clean();
        echo "<tr><td><label>Currently Active <em style='color:#dc2626;'>*</em></label></td><td>{$active_html}</td></tr>";

        echo "</table>";

        // ── Parentage & Physical ──────────────────────────────────────────────────
        echo "<p class='rpn-mb-section'>Parentage & Physical</p><table class='rpn-mb-table'>";
        foreach (['sire' => 'Sire (Father)', 'dam' => 'Dam (Mother)', 'breed' => 'Breed', 'color' => 'Color'] as $k => $l) {
            echo "<tr><td style='width:180px;'><label>" . esc_html($l) . "</label></td>";
            echo "<td><input type='text' name='rpn_" . esc_attr($k) . "' value='" . esc_attr($g($k)) . "'></td></tr>";
        }
        echo "<tr><td><label>Year Foaled</label></td><td><input type='number' name='rpn_year_foaled' value='" . esc_attr($g('year_foaled')) . "' min='1960' max='" . date('Y') . "' style='max-width:100px;'></td></tr>";
        echo "<tr><td><label>Birth Date</label></td><td><input type='date' name='rpn_birth_date' value='" . esc_attr($g('birth_date')) . "' style='max-width:160px;'></td></tr>";
        echo "<tr><td><label>Years Competing</label></td><td><input type='number' name='rpn_years_competing' value='" . esc_attr($g('years_competing', '0')) . "' min='0' max='30' style='max-width:80px;'></td></tr>";
        echo "</table>";

        // ── Bloodline & Ownership ─────────────────────────────────────────────────
        echo "<p class='rpn-mb-section'>Bloodline & Ownership</p><table class='rpn-mb-table'>";
        foreach (['bloodlines' => 'Bloodlines', 'breeding' => 'Breeding', 'owner' => 'Owner'] as $k => $l) {
            echo "<tr><td style='width:180px;'><label>" . esc_html($l) . "</label></td>";
            echo "<td><input type='text' name='rpn_" . esc_attr($k) . "' value='" . esc_attr($g($k)) . "'></td></tr>";
        }
        echo "<tr><td><label>Breeding Papers URL</label></td>";
        echo "<td><input type='url' name='rpn_breeding_papers_url' value='" . esc_attr($g('breeding_papers_url')) . "' placeholder='https://'></td></tr>";
        echo "</table>";

        // ── Videos ───────────────────────────────────────────────────────────────
        echo "<p class='rpn-mb-section'>Video Links (up to 5)</p><table class='rpn-mb-table'>";
        for ($i = 0; $i < 5; $i++) {
            $val = isset($video_links[$i]) ? esc_attr($video_links[$i]) : '';
            echo "<tr><td style='width:180px;'><label>Video " . ($i + 1) . "</label></td>";
            echo "<td><input type='url' name='rpn_video_links[]' value='{$val}' placeholder='https://'></td></tr>";
        }
        echo "</table>";

        // ── Notes ────────────────────────────────────────────────────────────────
        echo "<p class='rpn-mb-section'>Notes</p>";
        echo "<textarea name='rpn_animal_notes' rows='3' style='width:100%;max-width:700px;'>" . esc_textarea($g('notes')) . "</textarea>";

        // ── Computed Stats (read-only) ────────────────────────────────────────────
        $sri         = $gn('sri_current') ?: $gn('sri');
        $sri_season  = $gn('sri_season');
        $sri_career  = $gn('sri_career');
        $sri_status  = $g('sri_status', '');
        $sri_trend   = $gn('sri_trend_90d');
        $tei = $gn('tei'); $bhi = $gn('bhi');
        $bor = $gn('buckoff_rate'); $aas = $gn('avg_animal_score');
        $tar = (int)$g('total_animal_rides', 0);
        $art = $gn('avg_run_time'); $crr = $gn('clean_run_rate');
        $tar2 = (int)$g('total_animal_runs', 0);
        $tpi_current = $gn('tpi_current'); $tpi_status = $g('tpi_status', '');

        echo "<p class='rpn-mb-section'>Computed Stats (auto-calculated)</p>";
        echo "<p style='color:#6b7280;font-size:12px;'>Recalculated automatically when a linked performance is saved.</p>";

        // SRI block
        if ($sri > 0 || $tar > 0) {
            echo "<p style='margin:6px 0 2px;font-size:11px;font-weight:700;color:#374151;'>SRI — Stock Rating Index</p>";
            if ($sri > 0)         echo "<span class='rpn-stat-badge'>Current " . number_format($sri,2) . "</span>";
            if ($sri_season > 0)  echo "<span class='rpn-stat-badge'>Season " . number_format($sri_season,2) . "</span>";
            if ($sri_career > 0)  echo "<span class='rpn-stat-badge'>Career " . number_format($sri_career,2) . "</span>";
            if ($sri_status)      echo "<span class='rpn-stat-badge'>" . esc_html($sri_status) . "</span>";
            if ($bor > 0)         echo "<span class='rpn-stat-badge'>Buck-off " . number_format($bor,1) . "%</span>";
            if ($aas > 0)         echo "<span class='rpn-stat-badge'>Avg Score " . number_format($aas,1) . "/50</span>";
            if ($tar > 0)         echo "<span class='rpn-stat-badge'>{$tar} Rides</span>";
            if ($sri_trend != 0)  echo "<span class='rpn-stat-badge'>Trend90d " . ($sri_trend > 0 ? '+' : '') . number_format($sri_trend,2) . "</span>";
            echo "<br>";
        }

        // TEI / BHI / TPI block
        if ($tei > 0 || $tar2 > 0) {
            echo "<p style='margin:6px 0 2px;font-size:11px;font-weight:700;color:#374151;'>TEI / BHI / TPI — Timed Indexes</p>";
            if ($tei > 0)         echo "<span class='rpn-stat-badge'>TEI " . number_format($tei,2) . "</span>";
            if ($bhi > 0)         echo "<span class='rpn-stat-badge'>BHI " . number_format($bhi,2) . "</span>";
            if ($tpi_current > 0) echo "<span class='rpn-stat-badge'>TPI " . number_format($tpi_current,2) . "</span>";
            if ($tpi_status)      echo "<span class='rpn-stat-badge'>" . esc_html($tpi_status) . "</span>";
            if ($art > 0)         echo "<span class='rpn-stat-badge'>Avg Time " . number_format($art,3) . "s</span>";
            if ($crr > 0)         echo "<span class='rpn-stat-badge'>Clean " . number_format($crr,1) . "%</span>";
            if ($tar2 > 0)        echo "<span class='rpn-stat-badge'>{$tar2} Runs</span>";
            echo "<br>";
        }

        if ($sri === 0.0 && $tei === 0.0 && $tar === 0 && $tar2 === 0) {
            echo "<em style='color:#9ca3af;font-size:12px;'>No performances linked yet.</em>";
        }
    }

    add_action('save_post_animal', 'rpn_animal_meta_box_save', 10, 2);
    function rpn_animal_meta_box_save($post_id, $post) {
        if (!isset($_POST['rpn_animal_meta_nonce'])) return;
        if (!wp_verify_nonce($_POST['rpn_animal_meta_nonce'], 'rpn_animal_meta_save')) return;
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
        if (!current_user_can('edit_post', $post_id)) return;

        $s  = function($key) { return isset($_POST[$key]) ? sanitize_text_field($_POST[$key]) : ''; };
        $su = function($key) { return isset($_POST[$key]) ? esc_url_raw($_POST[$key]) : ''; };
        $ni = function($key) { return isset($_POST[$key]) ? (int) $_POST[$key] : 0; };
        $st = function($key) { return isset($_POST[$key]) ? sanitize_textarea_field($_POST[$key]) : ''; };

        update_post_meta($post_id, 'animal_type',        $s('rpn_animal_type'));
        update_post_meta($post_id, 'scoring_type',       $s('rpn_scoring_type'));
        // unique_number is auto-generated — never saved from form input
        update_post_meta($post_id, 'sex',                $s('rpn_sex'));
        update_post_meta($post_id, 'currently_active',   $s('rpn_currently_active') ?: 'yes');
        update_post_meta($post_id, 'sire',               $s('rpn_sire'));
        update_post_meta($post_id, 'dam',                $s('rpn_dam'));
        update_post_meta($post_id, 'breed',              $s('rpn_breed'));
        update_post_meta($post_id, 'color',              $s('rpn_color'));
        update_post_meta($post_id, 'year_foaled',        $s('rpn_year_foaled'));
        update_post_meta($post_id, 'birth_date',         $s('rpn_birth_date'));
        update_post_meta($post_id, 'years_competing',    $ni('rpn_years_competing'));
        update_post_meta($post_id, 'bloodlines',         $s('rpn_bloodlines'));
        update_post_meta($post_id, 'breeding',           $s('rpn_breeding'));
        update_post_meta($post_id, 'breeding_papers_url', $su('rpn_breeding_papers_url'));
        update_post_meta($post_id, 'owner',              $s('rpn_owner'));
        update_post_meta($post_id, 'notes',              $st('rpn_animal_notes'));

        if (isset($_POST['rpn_video_links']) && is_array($_POST['rpn_video_links'])) {
            $links = array_map('esc_url_raw', array_slice($_POST['rpn_video_links'], 0, 5));
            $links = array_filter($links); // remove empty entries
            update_post_meta($post_id, 'video_links', array_values($links));
        }
    }

    /* =====================================================================
    * Producer CPT — WordPress Admin Meta Box
    * ===================================================================== */
    add_action('add_meta_boxes', 'rpn_producer_add_meta_box');
    function rpn_producer_add_meta_box() {
        add_meta_box(
            'rpn_producer_details',
            'Producer Details',
            'rpn_producer_meta_box_cb',
            'rpn_producer',
            'normal',
            'high'
        );
    }

    function rpn_producer_meta_box_cb($post) {
        wp_nonce_field('rpn_producer_meta_save', 'rpn_producer_meta_nonce');
        $g = function($key, $default = '') use ($post) {
            $v = get_post_meta($post->ID, $key, true);
            return ($v !== '' && $v !== false && $v !== null) ? $v : $default;
        };
        $verified         = $g('verified') === '1' || $g('verified') === true || $g('verified') === 1;
        $verified_partner = $g('verified_event_partner') === '1' || $g('verified_event_partner') === true || $g('verified_event_partner') === 1;
        echo '<style>
            .rpn-prod-row{display:flex;align-items:center;gap:12px;padding:7px 10px;border-bottom:1px solid #f3f4f6;}
            .rpn-prod-row:last-child{border-bottom:none;}
            .rpn-prod-row label{font-weight:600;color:#374151;min-width:200px;}
            .rpn-prod-row input[type=text],.rpn-prod-row input[type=email],.rpn-prod-row input[type=url],.rpn-prod-row textarea,.rpn-prod-row select{flex:1;max-width:420px;box-sizing:border-box;}
            .rpn-prod-hint{font-size:11px;color:#9ca3af;margin-top:3px;}
        </style>';
        ?>
        <div class="rpn-prod-row">
            <label for="rpn_prod_verified">Verified</label>
            <div>
                <input type="checkbox" name="rpn_prod_verified" id="rpn_prod_verified" value="1" <?php checked($verified, true); ?>>
                <span style="font-size:13px;color:#374151;margin-left:6px;">Show "Verified" green badge on public profile</span>
            </div>
        </div>
        <div class="rpn-prod-row">
            <label for="rpn_prod_verified_event_partner">Verified Event Partner</label>
            <div>
                <input type="checkbox" name="rpn_prod_verified_event_partner" id="rpn_prod_verified_event_partner" value="1" <?php checked($verified_partner, true); ?>>
                <span style="font-size:13px;color:#374151;margin-left:6px;">Show blue "Verified Event Partner" badge — for producers submitting results via RIN</span>
            </div>
        </div>
        <div class="rpn-prod-row">
            <label for="rpn_prod_state">State</label>
            <input type="text" name="rpn_prod_state" id="rpn_prod_state" value="<?php echo esc_attr($g('state')); ?>" style="max-width:100px;">
        </div>
        <div class="rpn-prod-row">
            <label for="rpn_prod_city">City</label>
            <input type="text" name="rpn_prod_city" id="rpn_prod_city" value="<?php echo esc_attr($g('city')); ?>">
        </div>
        <div class="rpn-prod-row">
            <label for="rpn_prod_region">Region</label>
            <input type="text" name="rpn_prod_region" id="rpn_prod_region" value="<?php echo esc_attr($g('region')); ?>" placeholder="e.g. Southwest, Mountain West">
        </div>
        <div class="rpn-prod-row">
            <label for="rpn_prod_website">Website</label>
            <input type="url" name="rpn_prod_website" id="rpn_prod_website" value="<?php echo esc_attr($g('website')); ?>" placeholder="https://">
        </div>
        <div class="rpn-prod-row">
            <label for="rpn_prod_contact_email">Contact Email</label>
            <input type="email" name="rpn_prod_contact_email" id="rpn_prod_contact_email" value="<?php echo esc_attr($g('contact_email')); ?>">
        </div>
        <div class="rpn-prod-row">
            <label for="rpn_prod_description">Description</label>
            <textarea name="rpn_prod_description" id="rpn_prod_description" rows="3" style="max-width:420px;width:100%;"><?php echo esc_textarea($g('description')); ?></textarea>
        </div>
        <?php
    }

    add_action('save_post_rpn_producer', 'rpn_producer_meta_box_save');
    function rpn_producer_meta_box_save($post_id) {
        if (!isset($_POST['rpn_producer_meta_nonce'])) return;
        if (!wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['rpn_producer_meta_nonce'])), 'rpn_producer_meta_save')) return;
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
        if (!current_user_can('edit_post', $post_id)) return;

        update_post_meta($post_id, 'verified',               isset($_POST['rpn_prod_verified'])               ? '1' : '0');
        update_post_meta($post_id, 'verified_event_partner', isset($_POST['rpn_prod_verified_event_partner']) ? '1' : '0');
        $text_fields = array(
            'rpn_prod_state'         => 'state',
            'rpn_prod_city'          => 'city',
            'rpn_prod_region'        => 'region',
            'rpn_prod_website'       => 'website',
            'rpn_prod_contact_email' => 'contact_email',
        );
        foreach ($text_fields as $post_key => $meta_key) {
            if (isset($_POST[$post_key])) {
                update_post_meta($post_id, $meta_key, sanitize_text_field(wp_unslash($_POST[$post_key])));
            }
        }
        if (isset($_POST['rpn_prod_description'])) {
            update_post_meta($post_id, 'description', sanitize_textarea_field(wp_unslash($_POST['rpn_prod_description'])));
        }
    }

    /**
     * Grant RPN CPT capabilities to Administrator and to RPN roles (riders/contractors/producers).
     * RPN roles can only edit/delete their own posts (enforced by post_author + pre_get_posts).
     */
    function rpn_grant_rpn_cpt_capabilities() {
        $admin = get_role('administrator');
        if ($admin) {
            foreach (array('rider', 'animal', 'rpn_event', 'rpn_contractor', 'rpn_producer') as $type) {
                $plural = $type . 's';
                if ($type === 'rider') $plural = 'riders';
                if ($type === 'animal') $plural = 'animals';
                if ($type === 'rpn_event') $plural = 'rpn_events';
                if ($type === 'rpn_contractor') $plural = 'rpn_contractors';
                if ($type === 'rpn_producer') $plural = 'rpn_producers';
                $admin->add_cap('edit_' . $type);
                $admin->add_cap('edit_' . $plural);
                $admin->add_cap('edit_others_' . $plural);
                $admin->add_cap('edit_published_' . $plural);
                $admin->add_cap('publish_' . $plural);
                $admin->add_cap('read_private_' . $plural);
                $admin->add_cap('delete_' . $type);
                $admin->add_cap('delete_' . $plural);
                $admin->add_cap('delete_others_' . $plural);
                $admin->add_cap('delete_published_' . $plural);
                $admin->add_cap('delete_private_' . $plural);
            }
        }

        $rpn_rider = get_role('rpn_rider');
        if ($rpn_rider) {
            foreach (array('rider' => 'riders') as $s => $p) {
                $rpn_rider->add_cap('edit_' . $s);
                $rpn_rider->add_cap('edit_' . $p);
                $rpn_rider->add_cap('edit_published_' . $p);
                $rpn_rider->add_cap('publish_' . $p);
                $rpn_rider->add_cap('read_private_' . $p);
                $rpn_rider->add_cap('delete_' . $s);
                $rpn_rider->add_cap('delete_' . $p);
                $rpn_rider->add_cap('delete_published_' . $p);
                $rpn_rider->add_cap('delete_private_' . $p);
            }
        }

        $rpn_contractor = get_role('rpn_contractor');
        if ($rpn_contractor) {
            foreach (array('rpn_contractor' => 'rpn_contractors', 'animal' => 'animals') as $s => $p) {
                $rpn_contractor->add_cap('edit_' . $s);
                $rpn_contractor->add_cap('edit_' . $p);
                $rpn_contractor->add_cap('edit_published_' . $p);
                $rpn_contractor->add_cap('publish_' . $p);
                $rpn_contractor->add_cap('read_private_' . $p);
                $rpn_contractor->add_cap('delete_' . $s);
                $rpn_contractor->add_cap('delete_' . $p);
                $rpn_contractor->add_cap('delete_published_' . $p);
                $rpn_contractor->add_cap('delete_private_' . $p);
            }
        }

        $rpn_producer = get_role('rpn_producer');
        if ($rpn_producer) {
            foreach (array('rpn_producer' => 'rpn_producers', 'rpn_event' => 'rpn_events') as $s => $p) {
                $rpn_producer->add_cap('edit_' . $s);
                $rpn_producer->add_cap('edit_' . $p);
                $rpn_producer->add_cap('edit_published_' . $p);
                $rpn_producer->add_cap('publish_' . $p);
                $rpn_producer->add_cap('read_private_' . $p);
                $rpn_producer->add_cap('delete_' . $s);
                $rpn_producer->add_cap('delete_' . $p);
                $rpn_producer->add_cap('delete_published_' . $p);
                $rpn_producer->add_cap('delete_private_' . $p);
            }
        }
    }
    add_action('init', 'rpn_grant_rpn_cpt_capabilities', 11);

    /**
     * Restrict wp-admin list to own content for RPN roles (riders, contractors, producers).
     */
    function rpn_restrict_admin_to_own_posts($query) {
        if (!is_admin() || !$query->is_main_query()) {
            return;
        }
        $user = wp_get_current_user();
        if (!$user->ID) {
            return;
        }
        $screen = function_exists('get_current_screen') ? get_current_screen() : null;
        if (!$screen) {
            return;
        }
        $post_type = $query->get('post_type');
        if (in_array($post_type, array('rider', 'animal', 'rpn_event', 'rpn_contractor', 'rpn_producer'), true)) {
            if ($user->has_cap('manage_options')) {
                return;
            }
            if (in_array('rpn_rider', $user->roles, true) && $post_type === 'rider') {
                $query->set('author', $user->ID);
                return;
            }
            if (in_array('rpn_contractor', $user->roles, true)) {
                if ($post_type === 'rpn_contractor') {
                    $query->set('author', $user->ID);
                    return;
                }
                if ($post_type === 'animal') {
                    $contractor_id = (int) get_user_meta($user->ID, 'rpn_linked_contractor_id', true);
                    if ($contractor_id > 0) {
                        $query->set('meta_query', array(array('key' => 'contractor_id', 'value' => $contractor_id, 'compare' => '=')));
                    } else {
                        $query->set('author', $user->ID);
                    }
                    return;
                }
            }
            if (in_array('rpn_producer', $user->roles, true)) {
                if ($post_type === 'rpn_producer' || $post_type === 'rpn_event') {
                    $query->set('author', $user->ID);
                    return;
                }
            }
        }
    }
    add_action('pre_get_posts', 'rpn_restrict_admin_to_own_posts');

    /**
     * When a contractor creates/updates an animal in wp-admin, set contractor_id to their linked contractor.
     * post_author is set by WordPress to the current user when they create the post.
     */
    function rpn_set_animal_author_for_contractor($post_id) {
        if (get_post_type($post_id) !== 'animal') {
            return;
        }
        $user = wp_get_current_user();
        if (!$user->ID || !in_array('rpn_contractor', $user->roles, true)) {
            return;
        }
        $contractor_id = (int) get_user_meta($user->ID, 'rpn_linked_contractor_id', true);
        if ($contractor_id > 0) {
            update_post_meta($post_id, 'contractor_id', $contractor_id);
        }
    }
    add_action('save_post_animal', 'rpn_set_animal_author_for_contractor', 10, 1);

    /**
     * Register meta fields for REST API
     */
    function rpn_register_rest_meta() {
        $rider_fields = array(
            'rpi', 'rpi_base', 'rpi_roughstock', 'rpi_timed',
            // Section 8 — three RPI variants
            'rpi_current', 'rpi_season', 'rpi_career',
            'state', 'city', 'age_group', 'event_type',
            'total_rides', 'qualified_rides', 'completion_rate', 'win_count',
            'twitter_url', 'instagram_url', 'vanity_url',
            // Extended profile fields
            'nickname', 'date_of_birth', 'gender', 'country', 'division',
            'primary_event', 'years_competing', 'tiktok_url', 'facebook_url',
            'youtube_url', 'personal_website',
            // Phase 2 — NIL / sponsor / confidence
            'nil_open_to_sponsorship', 'sponsor_name', 'sponsor_url',
        );
        foreach ($rider_fields as $key) {
            register_post_meta('rider', $key, array(
                'show_in_rest' => true,
                'single' => true,
                'type' => in_array($key, array('rpi', 'rpi_base', 'rpi_current', 'rpi_season', 'rpi_career', 'total_rides', 'qualified_rides', 'completion_rate', 'win_count', 'years_competing')) ? 'number' : 'string',
                'auth_callback' => function () { return true; }
            ));
        }
        // Phase 2 — confidence score (number)
        register_post_meta('rider', 'rpi_confidence_score', array(
            'show_in_rest'  => true,
            'single'        => true,
            'type'          => 'number',
            'auth_callback' => function () { return true; }
        ));

        // Reliability status — string type
        register_post_meta('rider', 'reliability_status', array(
            'show_in_rest'  => true,
            'single'        => true,
            'type'          => 'string',
            'auth_callback' => function () { return true; }
        ));

        // Rider array fields (multi-select)
        $rider_array_fields = array('secondary_events', 'association_memberships', 'video_highlights');
        foreach ($rider_array_fields as $key) {
            register_post_meta('rider', $key, array(
                'show_in_rest' => array('schema' => array('items' => array('type' => 'string'))),
                'single'       => true,
                'type'         => 'array',
                'auth_callback' => function () { return true; }
            ));
        }

        // Rider premium / revenue-related fields (set from WordPress or Stripe webhooks)
        $rider_premium_fields = array(
            'premium_member' => 'boolean',              // true if rider has an active premium membership
            'premium_expires' => 'string',              // ISO date string when premium ends
            'digital_card_status' => 'string',          // pending / active / cancelled
            'printed_card_status' => 'string',          // pending / fulfilled / cancelled
            'nil_kit_url' => 'string',                  // link to NIL kit or asset
            'leaderboard_preview_access' => 'boolean',  // early access to rankings
            'featured_homepage' => 'boolean',           // promote on homepage / carousels
        );
        foreach ($rider_premium_fields as $key => $type) {
            register_post_meta('rider', $key, array(
                'show_in_rest' => true,
                'single' => true,
                'type' => $type,
                'auth_callback' => function () { return true; }
            ));
        }

        register_post_meta('rider', 'linked_animals', array(
            'show_in_rest' => array('schema' => array('items' => array('type' => 'integer'))),
            'single' => true,
            'type' => 'array',
            'auth_callback' => function () { return true; }
        ));
        register_post_meta('rider', 'rpn_linked_user_id', array(
            'show_in_rest' => true,
            'single' => true,
            'type' => 'integer',
            'auth_callback' => function () { return true; }
        ));

        // Animal string fields exposed in REST
        $animal_string_fields = array(
            'animal_type', 'scoring_type', 'unique_number',
            'sex', 'sire', 'dam',
            'breed', 'color', 'year_foaled', 'birth_date',
            'bloodlines', 'breeding', 'breeding_papers_url',
            'owner', 'currently_active', 'notes',
            'linked_rider_ids', 'contractor_id',
        );
        foreach ($animal_string_fields as $key) {
            register_post_meta('animal', $key, array(
                'show_in_rest' => true,
                'single'       => true,
                'type'         => 'string',
                'auth_callback' => function () { return true; }
            ));
        }

        // Animal numeric fields
        $animal_number_fields = array(
            'sri', 'tei', 'bhi',
            'buckoff_rate', 'avg_animal_score', 'avg_run_time', 'clean_run_rate',
            // SRI variants (Section 10 — Stock Rating Index)
            'sri_current', 'sri_season', 'sri_career', 'sri_trend_90d',
            // TPI (Section 9 — Timed Performance Index)
            'tpi_current', 'tpi_season', 'tpi_career', 'tpi_trend_90d', 'avg_time_clean_runs',
        );
        foreach ($animal_number_fields as $key) {
            register_post_meta('animal', $key, array(
                'show_in_rest' => true,
                'single'       => true,
                'type'         => 'number',
                'auth_callback' => function () { return true; }
            ));
        }

        // Animal integer fields
        $animal_int_fields = array('years_competing', 'total_animal_rides', 'total_animal_runs');
        foreach ($animal_int_fields as $key) {
            register_post_meta('animal', $key, array(
                'show_in_rest' => true,
                'single'       => true,
                'type'         => 'integer',
                'auth_callback' => function () { return true; }
            ));
        }

        // TPI status string (Provisional / Emerging / Established)
        register_post_meta('animal', 'tpi_status', array(
            'show_in_rest'  => true,
            'single'        => true,
            'type'          => 'string',
            'auth_callback' => function () { return true; },
        ));

        // SRI status string (Provisional / Emerging / Established)
        register_post_meta('animal', 'sri_status', array(
            'show_in_rest'  => true,
            'single'        => true,
            'type'          => 'string',
            'auth_callback' => function () { return true; },
        ));

        // Animal array fields
        register_post_meta('animal', 'video_links', array(
            'show_in_rest' => array('schema' => array('items' => array('type' => 'string'))),
            'single'       => true,
            'type'         => 'array',
            'auth_callback' => function () { return true; }
        ));

        register_post_meta('animal', 'linked_riders', array(
            'show_in_rest' => array('schema' => array('items' => array('type' => 'integer'))),
            'single'       => true,
            'type'         => 'array',
            'auth_callback' => function () { return true; }
        ));

        add_filter('rest_prepare_animal', 'rpn_animal_breeding_papers_url_to_string', 10, 3);

        $pickup_fields = array('pti', 'years_experience', 'horses_used', 'tagged_rescues', 'state', 'city');
        foreach ($pickup_fields as $key) {
            register_post_meta('pickup_team', $key, array(
                'show_in_rest' => true,
                'single' => true,
                'type' => in_array($key, array('pti', 'years_experience', 'tagged_rescues')) ? 'number' : 'string',
                'auth_callback' => function () { return true; }
            ));
        }

        $event_fields = array('event_date', 'event_end_date', 'venue', 'city', 'state', 'region', 'arena_condition', 'weather_condition', 'event_tier', 'producer_id', 'event_producer', 'season');
        foreach ($event_fields as $key) {
            register_post_meta('rpn_event', $key, array(
                'show_in_rest' => true,
                'single' => true,
                'type' => $key === 'producer_id' ? 'number' : 'string',
                'auth_callback' => function () { return true; }
            ));
        }

        $perf_fields = array(
            'rider_id' => 'number', 'animal_id' => 'number', 'event_id' => 'number',
            'performance_type' => 'string', 'event_category' => 'string',
            'performance_date' => 'string', 'event_name' => 'string', 'event_location' => 'string',
            'arena_condition' => 'string', 'weather_condition' => 'string', 'event_tier' => 'string',
            'total_rides' => 'number', 'qualified_rides' => 'number', 'avg_ride_score' => 'number',
            'win_count' => 'number', 'completion_rate' => 'number',
            'total_runs' => 'number', 'clean_runs' => 'number', 'avg_time' => 'number',
            'penalties' => 'number', 'penalty_weight' => 'number', 'benchmark' => 'number',
            'pattern_size' => 'string',
            'base_score' => 'number', 'adjusted_score' => 'number',
            // Per-ride roughstock fields (Section 4 + 5)
            'judge1_score'       => 'number',
            'judge2_score'       => 'number',
            'animal_score'       => 'number',
            'final_score'        => 'number',
            'qualified_ride'     => 'string',   // 'true' | 'false'
            'go_round'           => 'string',
            'division'           => 'string',
            'animal_name'        => 'string',
            'placement'          => 'number',
            'payout'             => 'number',
            // Re-ride fields
            'reride_offered'     => 'string',   // 'true' | 'false'
            'reride_accepted'    => 'string',
            'reride_result_id'   => 'number',
            'is_reride'          => 'string',
            'original_result_id' => 'number',
            'use_for_rpi'        => 'string',   // 'true' | 'false'
            // Per-run timed fields (Section 6)
            'no_time'            => 'string',   // 'true' | 'false'
            'raw_run_time'       => 'number',
            'num_penalties'      => 'number',
            'penalty_seconds'    => 'number',
            'final_time'         => 'number',
            'clean_run'          => 'string',   // 'true' | 'false'
            'horse_name'         => 'string',
            // Team roping fields
            'role'               => 'string',   // 'header' | 'heeler'
            'partner_name'       => 'string',
            'partner_rin_id'     => 'string',
            'run_id'             => 'string',   // shared UUID for team roping pair
            // Section 8 — new spec scoring fields
            'verification_status'  => 'string',  // 'official' | 'self_reported'
            'field_best_time'      => 'number',  // fastest time in go-round (timed events)
            'raw_event_score'      => 'number',  // judge+bonus or 100-(ratio×30)
            'field_strength_mult'  => 'number',  // 0.85–1.20
            'weighted_event_score' => 'number',  // raw × field × tier × verify, capped 100
        );
        foreach ($perf_fields as $key => $type) {
            register_post_meta('rpn_performance', $key, array(
                'show_in_rest' => true,
                'single' => true,
                'type' => $type,
                'auth_callback' => function () { return true; }
            ));
        }

        // Media meta: type, source, likes, and tags
        $media_fields = array(
            'media_type' => 'string',       // image / video
            'video_url' => 'string',        // external video URL (YouTube, Vimeo, etc.)
            'attachment_id' => 'number',    // WP media attachment ID
            'likes_count' => 'number',      // cached like count
        );
        foreach ($media_fields as $key => $type) {
            register_post_meta('rpn_media', $key, array(
                'show_in_rest' => true,
                'single' => true,
                'type' => $type,
                'auth_callback' => function () { return true; }
            ));
        }

        // Media tag arrays (stored as integer arrays, exposed to REST)
        $media_array_fields = array('liked_user_ids', 'tagged_riders', 'tagged_animals', 'tagged_pickup_teams', 'tagged_users');
        foreach ($media_array_fields as $key) {
            register_post_meta('rpn_media', $key, array(
                'show_in_rest' => array('schema' => array('items' => array('type' => 'integer'))),
                'single' => true,
                'type' => 'array',
                'auth_callback' => function () { return true; }
            ));
        }

        // Contractor meta (CRI and verification)
        $contractor_fields = array(
            'cri' => 'number',           // Contractor Rating Index
            'contractor_code' => 'string', // Short code e.g. DDE, 3BC (PBR-style)
            'verified' => 'boolean',
            'premium_member' => 'boolean', // Required to add/edit/delete animals
            'state' => 'string',
            'city' => 'string',
            'description' => 'string',
            'website' => 'string',
            'contact_email' => 'string',
        );
        foreach ($contractor_fields as $key => $type) {
            register_post_meta('rpn_contractor', $key, array(
                'show_in_rest' => true,
                'single' => true,
                'type' => $type,
                'auth_callback' => function () { return true; }
            ));
        }
        register_post_meta('rpn_contractor', 'rpn_linked_user_id', array(
            'show_in_rest' => true,
            'single' => true,
            'type' => 'integer',
            'auth_callback' => function () { return true; }
        ));
        register_post_meta('rpn_contractor', 'linked_animals', array(
            'show_in_rest' => array('schema' => array('items' => array('type' => 'integer'))),
            'single' => true,
            'type' => 'array',
            'auth_callback' => function () { return true; }
        ));

        // Producer meta (PRI and verification)
        $producer_fields = array(
            'pri' => 'number',      // Producer Rating Index
            'verified' => 'boolean',
            'premium_member' => 'boolean', // Required to add/edit/delete events
            'state' => 'string',
            'city' => 'string',
            'region' => 'string',
            'description' => 'string',
            'website' => 'string',
            'contact_email' => 'string',
        );
        foreach ($producer_fields as $key => $type) {
            register_post_meta('rpn_producer', $key, array(
                'show_in_rest' => true,
                'single' => true,
                'type' => $type,
                'auth_callback' => function () { return true; }
            ));
        }
        register_post_meta('rpn_producer', 'rpn_linked_user_id', array(
            'show_in_rest' => true,
            'single' => true,
            'type' => 'integer',
            'auth_callback' => function () { return true; }
        ));
        register_post_meta('rpn_producer', 'linked_events', array(
            'show_in_rest' => array('schema' => array('items' => array('type' => 'integer'))),
            'single' => true,
            'type' => 'array',
            'auth_callback' => function () { return true; }
        ));
    }
    add_action('init', 'rpn_register_rest_meta', 20);

    /**
     * Expose breeding_papers_url as a URL string in REST (ACF File may store ID or array with url).
     */
    function rpn_animal_breeding_papers_url_to_string($response, $post, $request) {
        if (!$response || !isset($response->data['meta']['breeding_papers_url'])) return $response;
        $raw = get_post_meta($post->ID, 'breeding_papers_url', true);
        if (is_numeric($raw)) {
            $url = wp_get_attachment_url((int) $raw);
            if ($url) $response->data['meta']['breeding_papers_url'] = $url;
        } elseif (is_array($raw) && !empty($raw['url'])) {
            $response->data['meta']['breeding_papers_url'] = $raw['url'];
        }
        return $response;
    }

    /**
     * RPN custom roles for riders, contractors, producers
     */
    function rpn_add_roles() {
        if (!get_role('rpn_rider')) {
            add_role('rpn_rider', 'RPN Rider', array('read' => true));
        }
        if (!get_role('rpn_contractor')) {
            add_role('rpn_contractor', 'RPN Contractor', array('read' => true));
        }
        if (!get_role('rpn_producer')) {
            add_role('rpn_producer', 'RPN Producer', array('read' => true));
        }
        if (!get_role('rpn_pickup_team')) {
            add_role('rpn_pickup_team', 'RPN Pickup Team', array('read' => true));
        }
    }
    add_action('init', 'rpn_add_roles', 5);

    /**
     * When a user gets role rpn_rider and has no linked rider, create a Rider post and link.
     * Covers: registration (already done in join callback) and manually added users.
     */
    add_action('set_user_role', 'rpn_on_role_assigned', 10, 3);
    function rpn_on_role_assigned($user_id, $role, $old_roles) {
        $user = get_user_by('id', $user_id);
        if (!$user) return;
        $display_name = trim($user->first_name . ' ' . $user->last_name) ?: $user->display_name ?: $user->user_login;

        if ($role === 'rpn_rider') {
            // Set membership tier to free if not already set
            if (!get_user_meta($user_id, 'rpn_membership_tier', true)) {
                update_user_meta($user_id, 'rpn_membership_tier', 'free');
            }
            update_user_meta($user_id, 'rpn_joining_as', 'rider');

            // Create linked rider CPT if not already linked
            if ((int) get_user_meta($user_id, 'rpn_linked_rider_id', true) > 0) return;
            $slug = sanitize_title($display_name);
            if (get_page_by_path($slug, OBJECT, 'rider')) $slug = $slug . '-' . $user_id;
            $post_id = wp_insert_post(array(
                'post_type'   => 'rider',
                'post_title'  => $display_name,
                'post_name'   => $slug,
                'post_status' => 'publish',
                'post_author' => $user_id,
            ), true);
            if (!is_wp_error($post_id) && $post_id > 0) {
                update_user_meta($user_id, 'rpn_linked_rider_id', $post_id);
                update_post_meta($post_id, 'rpn_linked_user_id', $user_id);
            }
        }

        if ($role === 'rpn_contractor') {
            // Set contractor tier + 3-month trial
            update_user_meta($user_id, 'rpn_membership_tier', 'contractor');
            update_user_meta($user_id, 'rpn_joining_as', 'contractor');
            update_user_meta($user_id, 'rpn_trial_tier', 'contractor');
            if (!get_user_meta($user_id, 'rpn_trial_expires', true)) {
                update_user_meta($user_id, 'rpn_trial_expires', date('Y-m-d', strtotime('+3 months')));
            }

            // Create linked contractor CPT if not already linked
            if ((int) get_user_meta($user_id, 'rpn_linked_contractor_id', true) > 0) return;
            $slug = sanitize_title($display_name);
            if (get_page_by_path($slug, OBJECT, 'rpn_contractor')) $slug = $slug . '-' . $user_id;
            $post_id = wp_insert_post(array(
                'post_type'   => 'rpn_contractor',
                'post_title'  => $display_name,
                'post_name'   => $slug,
                'post_status' => 'publish',
                'post_author' => $user_id,
            ), true);
            if (!is_wp_error($post_id) && $post_id > 0) {
                update_user_meta($user_id, 'rpn_linked_contractor_id', $post_id);
                update_post_meta($post_id, 'rpn_linked_user_id', $user_id);
            }
        }

        if ($role === 'rpn_producer') {
            // Set organizer tier + 3-month trial
            update_user_meta($user_id, 'rpn_membership_tier', 'organizer');
            update_user_meta($user_id, 'rpn_joining_as', 'producer');
            update_user_meta($user_id, 'rpn_trial_tier', 'organizer');
            if (!get_user_meta($user_id, 'rpn_trial_expires', true)) {
                update_user_meta($user_id, 'rpn_trial_expires', date('Y-m-d', strtotime('+3 months')));
            }

            // Create linked producer CPT if not already linked
            if ((int) get_user_meta($user_id, 'rpn_linked_producer_id', true) > 0) return;
            $slug = sanitize_title($display_name);
            if (get_page_by_path($slug, OBJECT, 'rpn_producer')) $slug = $slug . '-' . $user_id;
            $post_id = wp_insert_post(array(
                'post_type'   => 'rpn_producer',
                'post_title'  => $display_name,
                'post_name'   => $slug,
                'post_status' => 'publish',
                'post_author' => $user_id,
            ), true);
            if (!is_wp_error($post_id) && $post_id > 0) {
                update_user_meta($user_id, 'rpn_linked_producer_id', $post_id);
                update_post_meta($post_id, 'rpn_linked_user_id', $user_id);
            }
        }
    }

    /**
     * When a WP user is deleted, also hard-delete any linked rider/contractor/producer CPT posts.
     * WordPress's built-in "delete all content" only removes posts where post_author = deleted user,
     * but CPT posts created before the post_author fix (or manually) may have post_author = 1 (admin).
     * This hook uses the stored meta links so it always finds the right posts regardless of post_author.
     */
    add_action('deleted_user', 'rpn_delete_linked_cpt_posts', 10, 2);
    function rpn_delete_linked_cpt_posts($user_id, $reassign) {
        $rider_id = (int) get_user_meta($user_id, 'rpn_linked_rider_id', true);
        if ($rider_id > 0) {
            wp_delete_post($rider_id, true);
        }

        $contractor_id = (int) get_user_meta($user_id, 'rpn_linked_contractor_id', true);
        if ($contractor_id > 0) {
            wp_delete_post($contractor_id, true);
        }

        $producer_id = (int) get_user_meta($user_id, 'rpn_linked_producer_id', true);
        if ($producer_id > 0) {
            wp_delete_post($producer_id, true);
        }
    }

    /**
     * Expose event results and round results in WP REST API for rpn_event
     */
    function rpn_register_event_results_rest_fields() {
        $fields = array('event_results', 'round_1_results', 'round_2_results', 'championship_round_results');
        foreach ($fields as $field) {
            $acf_key = $field === 'event_results' ? 'rpn_event_results' : ($field === 'round_1_results' ? 'rpn_round_1_results' : ($field === 'round_2_results' ? 'rpn_round_2_results' : 'rpn_championship_round_results'));
            $normalizer = $field === 'event_results' ? 'rpn_normalize_event_results' : 'rpn_normalize_round_results';
            register_rest_field('rpn_event', $field, array(
                'get_callback' => function ($post) use ($acf_key, $normalizer) {
                    if (!function_exists('get_field')) return array();
                    return call_user_func($normalizer, get_field($acf_key, $post['id']));
                },
                'schema' => array('type' => 'array', 'items' => array('type' => 'object'), 'description' => $field),
            ));
        }
    }
    add_action('rest_api_init', 'rpn_register_event_results_rest_fields');

    /* ==========================================================================
    SITE SETTINGS — header logo, nav menu, footer content
    ========================================================================== */

    /**
     * REST API: Site settings (logo, nav menu, footer fields)
     * GET /rpn/v1/site-settings
     */
    add_action( 'rest_api_init', 'rpn_register_site_settings_route' );
    function rpn_register_site_settings_route() {
        register_rest_route( 'rpn/v1', '/site-settings', array(
            'methods'             => 'GET',
            'permission_callback' => '__return_true',
            'callback'            => 'rpn_site_settings_callback',
        ) );
    }

    function rpn_site_settings_callback() {
        // --- Logo: Customizer custom_logo ---
        $logo_url = '';
        $custom_logo_id = get_theme_mod( 'custom_logo' );
        if ( $custom_logo_id ) {
            $logo_img = wp_get_attachment_image_src( $custom_logo_id, 'full' );
            if ( $logo_img ) {
                $logo_url = $logo_img[0];
            }
        }

        // --- Primary nav menu items ---
        $nav_items = array();
        $locations = get_nav_menu_locations();
        if ( ! empty( $locations['primary'] ) ) {
            $raw = wp_get_nav_menu_items( $locations['primary'] );
            if ( is_array( $raw ) ) {
                foreach ( $raw as $item ) {
                    $nav_items[] = array(
                        'id'     => $item->ID,
                        'parent' => (int) $item->menu_item_parent,
                        'label'  => $item->title,
                        'url'    => $item->url,
                    );
                }
            }
        }

        // --- ACF options helper ---
        $acf = function( $key, $default = '' ) {
            if ( function_exists( 'get_field' ) ) {
                $val = get_field( $key, 'option' );
                return ( $val !== null && $val !== false && $val !== '' ) ? $val : $default;
            }
            return $default;
        };

        // --- Site Icon (favicon) — use WP's canonical function ---
        $site_icon_url = function_exists( 'get_site_icon_url' ) ? get_site_icon_url( 64 ) : '';

        return new WP_REST_Response( array(
            'site_name'        => get_bloginfo( 'name' ),
            'site_icon_url'    => $site_icon_url,
            'logo_url'         => $logo_url,
            'logo_text'        => $acf( 'logo_text', get_bloginfo( 'name' ) ),
            'nav_menu'         => $nav_items,
            'footer_tagline'   => $acf( 'footer_tagline', 'Performance-based scoring for rodeo athletes, horses, bulls, and pickup teams.' ),
            'footer_email'     => $acf( 'footer_email', 'info@rinrodeo.com' ),
            'footer_phone'     => $acf( 'footer_phone', '434-604-0972' ),
            'footer_facebook'  => $acf( 'footer_facebook', '' ),
            'footer_twitter'   => $acf( 'footer_twitter', '' ),
            'footer_instagram' => $acf( 'footer_instagram', '' ),
            'footer_copyright'     => $acf( 'footer_copyright', '' ),
            'footer_explore_links' => rpn_get_footer_links( 'footer_explore_links' ),
            'footer_more_links'    => rpn_get_footer_links( 'footer_more_links' ),
        ), 200 );
    }

    /**
     * Helper: return footer link repeater as [ ['label'=>..., 'url'=>...], ... ]
     * Falls back to wp_options JSON if ACF is not active.
     */
    function rpn_get_footer_links( $key ) {
        if ( function_exists( 'get_field' ) ) {
            $rows = get_field( $key, 'option' );
            if ( is_array( $rows ) ) {
                return array_values( array_map( function( $row ) {
                    return array(
                        'label' => isset( $row['label'] ) ? $row['label'] : '',
                        'url'   => isset( $row['url'] )   ? $row['url']   : '',
                    );
                }, $rows ) );
            }
        }
        $json = get_option( 'rin_' . $key, '' );
        if ( $json ) {
            $decoded = json_decode( $json, true );
            if ( is_array( $decoded ) ) return $decoded;
        }
        return array();
    }

    /**
     * ACF: register options page so ACF field groups can target it.
     * Requires Advanced Custom Fields Pro or Free (v6+) to be active.
     * This creates "RIN Settings" in the sidebar and makes it selectable
     * as a Location Rule inside ACF → Field Groups → Settings → Location Rules.
     */
    add_action( 'acf/init', 'rpn_register_acf_options_page' );
    function rpn_register_acf_options_page() {
        if ( ! function_exists( 'acf_add_options_page' ) ) {
            return;
        }
        acf_add_options_page( array(
            'page_title'  => 'RIN Site Settings',
            'menu_title'  => 'RIN Settings',
            'menu_slug'   => 'rin-site-settings',
            'capability'  => 'manage_options',
            'icon_url'    => 'dashicons-chart-bar',
            'position'    => 30,
            'redirect'    => false,
        ) );
    }

    /* -- Fallback settings page removed; ACF options page handles all settings -- */
    // (The rin_register_acf_options_page() function above registers the ACF options page.)
    // If ACF is not installed, site settings must be entered via wp_options directly.

    /* ── Stub save handler kept only to avoid fatal errors if old bookmarks are hit ── */
    add_action( 'admin_post_rin_save_settings', 'rin_handle_save_settings' );
    function rin_handle_save_settings() {
        wp_safe_redirect( admin_url( 'admin.php?page=rin-site-settings' ) );
        exit;
    }

    /* ========================================================================== */

    /**
     * REST API: Homepage sections (FAQ, Reviews, Top Riders, Events, Plans, Hero)
     */
    function rpn_register_homepage_rest_route() {
        register_rest_route('rpn/v1', '/homepage', array(
            'methods' => 'GET',
            'permission_callback' => '__return_true',
            'callback' => 'rpn_homepage_callback',
        ));
    }
    add_action('rest_api_init', 'rpn_register_homepage_rest_route');

    /**
     * REST API: Contractor rankings (by linked animals' SRI/TEI performance)
     */
    function rpn_register_contractor_rankings_route() {
        register_rest_route('rpn/v1', '/contractor-rankings', array(
            'methods' => 'GET',
            'permission_callback' => '__return_true',
            'callback' => 'rpn_contractor_rankings_callback',
        ));
    }
    add_action('rest_api_init', 'rpn_register_contractor_rankings_route');

    function rpn_contractor_rankings_callback($request) {
        $contractors = get_posts(array(
            'post_type' => 'rpn_contractor',
            'post_status' => 'publish',
            'numberposts' => -1,
            'orderby' => 'title',
            'order' => 'ASC',
        ));
        $list = array();
        foreach ($contractors as $post) {
            $id = $post->ID;
            $linked = get_post_meta($id, 'linked_animals', true);
            $animal_ids = is_array($linked) ? $linked : (is_string($linked) ? array_filter(array_map('intval', explode(',', $linked))) : array());
            $scores = array();
            foreach ($animal_ids as $aid) {
                $sri = get_post_meta($aid, 'sri', true);
                $tei = get_post_meta($aid, 'tei', true);
                if ($sri !== '' && $sri !== null) $scores[] = (float) $sri;
                if ($tei !== '' && $tei !== null) $scores[] = (float) $tei;
            }
            $rank_score = count($scores) > 0 ? (array_sum($scores) / count($scores)) : null;
            $cri = get_post_meta($id, 'cri', true);
            if ($rank_score === null && ($cri !== '' && $cri !== null)) $rank_score = (float) $cri;
            $list[] = array(
                'id' => $id,
                'title' => $post->post_title,
                'slug' => $post->post_name,
                'cri' => $cri !== '' && $cri !== null ? (float) $cri : null,
                'rank_score' => $rank_score,
                'animal_count' => count($animal_ids),
            );
        }
        usort($list, function ($a, $b) {
            $sa = $a['rank_score'] ?? 0;
            $sb = $b['rank_score'] ?? 0;
            if ($sa != $sb) return $sb > $sa ? 1 : -1;
            return 0;
        });
        $rank = 1;
        foreach ($list as &$row) {
            $row['rank'] = $rank++;
        }
        return new WP_REST_Response(array('rankings' => $list), 200);
    }

    /**
     * REST API: Join / registration form (POST). Sends email; optionally integrate with Contact Form 7.
     */
    function rpn_register_join_route() {
        register_rest_route('rpn/v1', '/join', array(
            'methods' => 'POST',
            'permission_callback' => '__return_true',
            'callback' => 'rpn_join_callback',
            'args' => array(
                'joining_as' => array('required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
                'membership_plan' => array('required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
                'product_id' => array('required' => false, 'type' => 'integer', 'sanitize_callback' => 'absint'),
                'first_name' => array('required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
                'last_name' => array('required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
                'email' => array('required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_email'),
                'organization_name' => array('required' => false, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
                'producer_license_id' => array('required' => false, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
            ),
        ));
    }
    add_action('rest_api_init', 'rpn_register_join_route');

    /**
     * REST API: Rider profile search (public) — GET /rpn/v1/search-riders?name=X
     * Used by the profile-claim flow so an athlete can find their existing rider record.
     */
    function rpn_register_search_riders_route() {
        register_rest_route('rpn/v1', '/search-riders', array(
            'methods'             => 'GET',
            'permission_callback' => '__return_true',
            'callback'            => 'rpn_search_riders_callback',
            'args'                => array(
                'name' => array('required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
            ),
        ));
    }
    add_action('rest_api_init', 'rpn_register_search_riders_route');

    function rpn_search_riders_callback($request) {
        $name = trim($request->get_param('name'));
        if (strlen($name) < 2) {
            return new WP_REST_Response(array('results' => array()), 200);
        }
        $posts = get_posts(array(
            'post_type'      => 'rider',
            'post_status'    => 'publish',
            'posts_per_page' => 20,
            's'              => $name,
        ));
        $results = array();
        foreach ($posts as $p) {
            $already_claimed = (int) get_post_meta($p->ID, 'rpn_linked_user_id', true) > 0;
            $results[] = array(
                'id'              => $p->ID,
                'name'            => $p->post_title,
                'slug'            => $p->post_name,
                'rin_id'          => get_post_meta($p->ID, 'rin_id', true) ?: '',
                'city'            => get_post_meta($p->ID, 'city', true) ?: '',
                'state'           => get_post_meta($p->ID, 'state', true) ?: '',
                'primary_event'   => get_post_meta($p->ID, 'primary_event', true) ?: '',
                'already_claimed' => $already_claimed,
            );
        }
        return new WP_REST_Response(array('results' => $results), 200);
    }

    /**
     * REST API: Claim an existing rider profile — POST /rpn/v1/claim-profile
     * Authenticated. Rider must supply date_of_birth matching the target rider post.
     */
    function rpn_register_claim_profile_route() {
        register_rest_route('rpn/v1', '/claim-profile', array(
            'methods'             => 'POST',
            'permission_callback' => '__return_true',
            'callback'            => 'rpn_claim_profile_callback',
            'args'                => array(
                'rider_id'      => array('required' => true, 'type' => 'integer', 'sanitize_callback' => 'absint'),
                'date_of_birth' => array('required' => true, 'type' => 'string',  'sanitize_callback' => 'sanitize_text_field'),
            ),
        ));
    }
    add_action('rest_api_init', 'rpn_register_claim_profile_route');

    function rpn_claim_profile_callback($request) {
        $user_id = rpn_get_user_from_token($request);
        if ($user_id instanceof WP_REST_Response) return $user_id;

        $rider_post_id = (int) $request->get_param('rider_id');
        $dob_input     = trim($request->get_param('date_of_birth'));

        // Already has a linked rider?
        $existing_link = (int) get_user_meta($user_id, 'rpn_linked_rider_id', true);
        if ($existing_link > 0) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'Your account is already linked to a rider profile.',
            ), 400);
        }

        // Target rider post must exist and be published
        $rider_post = get_post($rider_post_id);
        if (!$rider_post || $rider_post->post_type !== 'rider' || $rider_post->post_status !== 'publish') {
            return new WP_REST_Response(array('success' => false, 'message' => 'Rider profile not found.'), 404);
        }

        // Must not already be claimed by another user
        $owner_user_id = (int) get_post_meta($rider_post_id, 'rpn_linked_user_id', true);
        if ($owner_user_id > 0 && $owner_user_id !== $user_id) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'This profile has already been claimed. Contact support if you believe this is an error.',
            ), 409);
        }

        // Verify date of birth
        $dob_stored = trim(get_post_meta($rider_post_id, 'date_of_birth', true));
        if (empty($dob_stored)) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'This profile does not have a date of birth on file. Please contact support to claim it.',
            ), 400);
        }

        // Normalise both to Y-m-d for comparison
        $dob_stored_norm = date('Y-m-d', strtotime($dob_stored));
        $dob_input_norm  = date('Y-m-d', strtotime($dob_input));
        if ($dob_stored_norm !== $dob_input_norm) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => 'Date of birth does not match our records. Please try again or contact support.',
            ), 403);
        }

        // All checks passed — link the profile
        update_user_meta($user_id, 'rpn_linked_rider_id', $rider_post_id);
        update_post_meta($rider_post_id, 'rpn_linked_user_id', $user_id);

        // Sync user's display name / email to the rider post if blank
        $user = get_user_by('id', $user_id);
        if ($user && empty(get_the_title($rider_post_id))) {
            wp_update_post(array('ID' => $rider_post_id, 'post_title' => $user->display_name));
        }

        return new WP_REST_Response(array(
            'success'        => true,
            'message'        => 'Profile claimed successfully.',
            'linked_rider_id'=> $rider_post_id,
            'rider_slug'     => $rider_post->post_name,
        ), 200);
    }

    /**
     * REST API: Auth – login, me, dashboard
     */
    function rpn_register_auth_routes() {
        register_rest_route('rpn/v1', '/login', array(
            'methods' => array('POST', 'OPTIONS'),
            'permission_callback' => '__return_true',
            'callback' => 'rpn_login_callback',
            'args' => array(
                'email' => array('required' => false, 'type' => 'string', 'sanitize_callback' => 'sanitize_email'),
                'password' => array('required' => false, 'type' => 'string'),
            ),
        ));
        register_rest_route('rpn/v1', '/me', array(
            'methods' => array('GET', 'OPTIONS'),
            'permission_callback' => '__return_true',
            'callback' => 'rpn_me_callback',
        ));
        register_rest_route('rpn/v1', '/dashboard/rider', array(
            'methods' => 'GET',
            'permission_callback' => '__return_true',
            'callback' => 'rpn_dashboard_rider_callback',
        ));
        register_rest_route('rpn/v1', '/dashboard/contractor', array(
            'methods' => 'GET',
            'permission_callback' => '__return_true',
            'callback' => 'rpn_dashboard_contractor_callback',
        ));
        register_rest_route('rpn/v1', '/dashboard/producer', array(
            'methods' => 'GET',
            'permission_callback' => '__return_true',
            'callback' => 'rpn_dashboard_producer_callback',
        ));
    }
    add_action('rest_api_init', 'rpn_register_auth_routes');

    function rpn_register_password_routes() {
        register_rest_route('rpn/v1', '/request-password-reset', array(
            'methods'             => array('POST', 'OPTIONS'),
            'permission_callback' => '__return_true',
            'callback'            => 'rpn_request_password_reset_callback',
            'args'                => array(
                'email' => array('required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_email'),
            ),
        ));
        register_rest_route('rpn/v1', '/set-password', array(
            'methods'             => array('POST', 'OPTIONS'),
            'permission_callback' => '__return_true',
            'callback'            => 'rpn_set_password_callback',
            'args'                => array(
                'login'        => array('required' => true,  'type' => 'string', 'sanitize_callback' => 'sanitize_user'),
                'key'          => array('required' => true,  'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
                'new_password' => array('required' => true,  'type' => 'string'),
            ),
        ));
    }
    add_action('rest_api_init', 'rpn_register_password_routes');

    function rpn_request_password_reset_callback($request) {
        if ($request->get_method() === 'OPTIONS') return new WP_REST_Response(null, 204);
        $email = $request->get_param('email');
        $user  = get_user_by('email', $email);
        // Always respond the same way — do not leak whether email exists
        if (!$user) {
            return new WP_REST_Response(array('success' => true, 'message' => 'If that email is registered, a reset link has been sent.'), 200);
        }
        $key = get_password_reset_key($user);
        if (is_wp_error($key)) {
            return new WP_REST_Response(array('success' => false, 'message' => 'Could not generate reset link. Please try again.'), 500);
        }
        $reset_url = rpn_get_react_app_url() . '/set-password?key=' . rawurlencode($key) . '&login=' . rawurlencode($user->user_login);
        $headers   = array('Content-Type: text/html; charset=UTF-8', 'From: RIN Rodeo <info@rinrodeo.com>');
        wp_mail($user->user_email, 'Reset your RIN password', rpn_build_password_email($user->display_name ?: $user->user_login, $reset_url, 'reset'), $headers);
        return new WP_REST_Response(array('success' => true, 'message' => 'If that email is registered, a reset link has been sent.'), 200);
    }

    function rpn_set_password_callback($request) {
        if ($request->get_method() === 'OPTIONS') return new WP_REST_Response(null, 204);
        $login        = $request->get_param('login');
        $key          = $request->get_param('key');
        $new_password = $request->get_param('new_password');

        if (strlen($new_password) < 8) {
            return new WP_REST_Response(array('success' => false, 'message' => 'Password must be at least 8 characters.'), 400);
        }
        $user = check_password_reset_key($key, $login);
        if (is_wp_error($user)) {
            return new WP_REST_Response(array('success' => false, 'message' => 'This link has expired or is invalid. Please request a new one.'), 400);
        }
        reset_password($user, $new_password);
        return new WP_REST_Response(array('success' => true, 'message' => 'Password updated. You can now log in.'), 200);
    }

    /* ==========================================================================
     * EMAIL VERIFICATION — confirm-your-email-before-login flow
     * ========================================================================== */
    function rpn_register_email_verification_routes() {
        register_rest_route('rpn/v1', '/verify-email', array(
            'methods'             => array('GET', 'OPTIONS'),
            'permission_callback' => '__return_true',
            'callback'            => 'rpn_verify_email_callback',
            'args'                => array(
                'token' => array('required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
            ),
        ));
        register_rest_route('rpn/v1', '/resend-verification', array(
            'methods'             => array('POST', 'OPTIONS'),
            'permission_callback' => '__return_true',
            'callback'            => 'rpn_resend_verification_callback',
            'args'                => array(
                'email' => array('required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_email'),
            ),
        ));
    }
    add_action('rest_api_init', 'rpn_register_email_verification_routes');

    /**
     * Generates a verification token for a user, stores it, and emails a confirmation link.
     * Called on registration and from the resend-verification endpoint.
     */
    function rpn_send_verification_email($user_id) {
        $user = get_user_by('id', $user_id);
        if (!$user) return false;

        $token = bin2hex(random_bytes(20));
        update_user_meta($user_id, 'rpn_email_verify_token', $token);
        update_user_meta($user_id, 'rpn_email_verified', '0');

        $verify_url = rpn_get_react_app_url() . '/verify-email?token=' . rawurlencode($token);
        $first_name = get_user_meta($user_id, 'first_name', true) ?: $user->display_name ?: $user->user_login;

        $headers = array('Content-Type: text/html; charset=UTF-8', 'From: RIN Rodeo <info@rinrodeo.com>');
        $subject = 'Confirm your email — RIN';
        $msg = '<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">
      <tr><td style="background:#111827;border-radius:12px 12px 0 0;padding:28px 40px;text-align:center;">
        <p style="margin:0;color:#fff;font-size:24px;font-weight:900;letter-spacing:-1px;">RIN</p>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Rodeo Information Network</p>
      </td></tr>
      <tr><td style="background:#FD0000;height:4px;"></td></tr>
      <tr><td style="background:#fff;padding:36px 40px;">
        <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Confirm your email, ' . esc_html($first_name) . '</p>
        <p style="margin:0 0 28px;font-size:15px;color:#4B5563;line-height:1.7;">Please confirm your email address to activate your RIN account. You will not be able to log in until it is verified.</p>
        <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
          <tr><td style="background:#FD0000;border-radius:8px;">
            <a href="' . esc_url($verify_url) . '" style="display:inline-block;padding:14px 36px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">Verify Email Address &rarr;</a>
          </td></tr>
        </table>
        <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.65;">If the button doesn\'t work, copy and paste this link into your browser:<br>' . esc_html($verify_url) . '</p>
      </td></tr>
      <tr><td style="background:#F9FAFB;border-top:1px solid #E5E7EB;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#9CA3AF;">&copy; ' . date('Y') . ' Rodeo Information Network Inc. &middot; <a href="https://rinrodeo.com" style="color:#9CA3AF;text-decoration:none;">rinrodeo.com</a></p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>';
        return wp_mail($user->user_email, $subject, $msg, $headers);
    }

    function rpn_verify_email_callback($request) {
        if ($request->get_method() === 'OPTIONS') return new WP_REST_Response(null, 204);
        $token = $request->get_param('token');
        if (empty($token)) {
            return new WP_REST_Response(array('success' => false, 'message' => 'Missing verification token.'), 400);
        }
        $users = get_users(array(
            'meta_key'   => 'rpn_email_verify_token',
            'meta_value' => $token,
            'number'     => 1,
        ));
        if (empty($users)) {
            return new WP_REST_Response(array('success' => false, 'message' => 'This verification link is invalid or has already been used.'), 400);
        }
        $user = $users[0];
        update_user_meta($user->ID, 'rpn_email_verified', '1');
        delete_user_meta($user->ID, 'rpn_email_verify_token');

        // Log the user straight in after verifying, same token mechanism as /rpn/v1/login.
        $auth_token = bin2hex(random_bytes(24));
        set_transient('rpn_auth_' . $auth_token, array(
            'user_id' => $user->ID,
            'expires' => time() + DAY_IN_SECONDS,
        ), DAY_IN_SECONDS);

        return new WP_REST_Response(array(
            'success' => true,
            'message' => 'Email verified. You are now logged in.',
            'token'   => $auth_token,
            'user'    => rpn_build_me_payload($user->ID),
        ), 200);
    }

    function rpn_resend_verification_callback($request) {
        if ($request->get_method() === 'OPTIONS') return new WP_REST_Response(null, 204);
        $email = $request->get_param('email');
        $user  = get_user_by('email', $email);
        // Always respond the same way — do not leak whether email exists
        $generic = array('success' => true, 'message' => 'If that email is registered and not yet verified, a new verification link has been sent.');
        if (!$user) {
            return new WP_REST_Response($generic, 200);
        }
        if (get_user_meta($user->ID, 'rpn_email_verified', true) === '1') {
            return new WP_REST_Response(array('success' => true, 'message' => 'This email is already verified. You can log in.'), 200);
        }
        rpn_send_verification_email($user->ID);
        return new WP_REST_Response($generic, 200);
    }

    function rpn_verify_token($token) {
        if (empty($token)) return null;
        $data = get_transient('rpn_auth_' . $token);
        if (!$data || empty($data['user_id'])) return null;
        if (!empty($data['expires']) && $data['expires'] < time()) return null;
        return (int) $data['user_id'];
    }

    function rpn_login_callback($request) {
        if ($request->get_method() === 'OPTIONS') {
            return new WP_REST_Response(null, 204);
        }
        $email = $request->get_param('email');
        $password = $request->get_param('password');
        if (empty($email) || empty($password)) {
            $json = $request->get_json_params();
            if (is_array($json)) {
                if (empty($email)) $email = isset($json['email']) ? $json['email'] : '';
                if (empty($password)) $password = isset($json['password']) ? $json['password'] : '';
            }
        }
        if (empty($email) || empty($password)) {
            return new WP_REST_Response(array('success' => false, 'message' => 'Email and password are required.'), 400);
        }
        $user = get_user_by('email', $email);
        if (!$user || !wp_check_password($password, $user->user_pass, $user->ID)) {
            return new WP_REST_Response(array('success' => false, 'message' => 'Invalid email or password.'), 401);
        }
        // Accounts created before email verification existed have no rpn_email_verified meta at
        // all — only block login for accounts explicitly marked unverified ('0').
        if (get_user_meta($user->ID, 'rpn_email_verified', true) === '0') {
            return new WP_REST_Response(array(
                'success' => false,
                'code'    => 'email_not_verified',
                'message' => 'Please verify your email before logging in. Check your inbox for the verification link.',
            ), 403);
        }
        $token = bin2hex(random_bytes(24));
        set_transient('rpn_auth_' . $token, array(
            'user_id' => $user->ID,
            'expires' => time() + DAY_IN_SECONDS,
        ), DAY_IN_SECONDS);
        $payload = rpn_build_me_payload($user->ID);
        return new WP_REST_Response(array(
            'success' => true,
            'token' => $token,
            'user' => $payload,
        ), 200);
    }

    function rpn_me_callback($request) {
        if ($request->get_method() === 'OPTIONS') {
            return new WP_REST_Response(null, 204);
        }
        $token = $request->get_header('X-RPN-Auth') ?: $request->get_header('Authorization');
        if ($token && strpos($token, 'Bearer ') === 0) $token = substr($token, 7);
        $user_id = rpn_verify_token($token);
        if (!$user_id) {
            return new WP_REST_Response(array('success' => false, 'message' => 'Invalid or expired token.'), 401);
        }
        return new WP_REST_Response(array('success' => true, 'user' => rpn_build_me_payload($user_id)), 200);
    }

    function rpn_build_me_payload($user_id) {
        $user = get_user_by('id', $user_id);
        if (!$user) return null;
        $roles = $user->roles;
        $linked_rider_id      = (int) get_user_meta($user_id, 'rpn_linked_rider_id', true);
        $linked_contractor_id = (int) get_user_meta($user_id, 'rpn_linked_contractor_id', true);
        $linked_producer_id   = (int) get_user_meta($user_id, 'rpn_linked_producer_id', true);
        $rin_id               = get_user_meta($user_id, 'rpn_rin_id', true) ?: '';
        $membership_tier      = get_user_meta($user_id, 'rpn_membership_tier', true) ?: 'free';
        $first_name           = get_user_meta($user_id, 'first_name', true) ?: '';
        $last_name            = get_user_meta($user_id, 'last_name', true) ?: '';
        return array(
            'id'                   => $user->ID,
            'email'                => $user->user_email,
            'display_name'         => $user->display_name,
            'first_name'           => $first_name,
            'last_name'            => $last_name,
            'roles'                => $roles,
            'linked_rider_id'      => $linked_rider_id ?: null,
            'linked_contractor_id' => $linked_contractor_id ?: null,
            'linked_producer_id'   => $linked_producer_id ?: null,
            'rin_id'               => $rin_id,
            'membership_tier'      => $membership_tier,
        );
    }

    function rpn_generate_rin_id() {
        return 'RIN-' . strtoupper(substr(md5(uniqid('', true)), 0, 6));
    }

    // ── Auto-assign RIN ID for users created anywhere (WP Admin, REST API, etc.) ─
    add_action('user_register', 'rpn_auto_assign_rin_id', 20);
    function rpn_auto_assign_rin_id($user_id) {
        if (!get_user_meta($user_id, 'rpn_rin_id', true)) {
            update_user_meta($user_id, 'rpn_rin_id', rpn_generate_rin_id());
        }
    }

    // ── Backfill RIN IDs for existing users who don't have one yet ───────────
    add_action('admin_init', function() {
        if (get_option('rpn_rin_id_backfill_done')) return;
        $users_without = get_users(array(
            'meta_query' => array(
                array('key' => 'rpn_rin_id', 'compare' => 'NOT EXISTS'),
            ),
            'fields' => 'ids',
            'number' => 500,
        ));
        foreach ($users_without as $uid) {
            update_user_meta($uid, 'rpn_rin_id', rpn_generate_rin_id());
        }
        update_option('rpn_rin_id_backfill_done', '1');
    });

    /* ==========================================================================
    * AUTO ID GENERATION — AIN (animals), Contractor Code; CRI + PRI auto-calc
    * ========================================================================== */

    // ── Animal Identification Number (AIN) ─────────────────────────────────────

    function rpn_generate_ain() {
        return 'AIN-' . strtoupper(substr(md5(uniqid('rpn-ain-', true)), 0, 6));
    }

    add_action('save_post_animal', 'rpn_auto_assign_animal_ain', 20, 2);
    function rpn_auto_assign_animal_ain($post_id, $post) {
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
        if (in_array($post->post_status, array('auto-draft', 'trash', 'inherit'), true)) return;
        $existing = get_post_meta($post_id, 'unique_number', true);
        if (!empty($existing)) return;
        update_post_meta($post_id, 'unique_number', rpn_generate_ain());
    }

    // Late save_post hook — runs at priority 99, after ACF (priority 1) saves its fields,
    // so ACF cannot overwrite the AIN with an empty form value from WP admin.
    add_action('save_post', 'rpn_ensure_animal_ain_late', 99, 2);
    function rpn_ensure_animal_ain_late($post_id, $post) {
        if (!isset($post->post_type) || $post->post_type !== 'animal') return;
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
        if (in_array($post->post_status, array('auto-draft', 'trash', 'inherit'), true)) return;
        $existing = get_post_meta($post_id, 'unique_number', true);
        if (!empty($existing)) return;
        update_post_meta($post_id, 'unique_number', rpn_generate_ain());
    }

    // ACF-specific hook — fires after ACF has committed all field values to post meta.
    add_action('acf/save_post', 'rpn_ensure_animal_ain_acf', 20);
    function rpn_ensure_animal_ain_acf($post_id) {
        $post = get_post($post_id);
        if (!$post || $post->post_type !== 'animal') return;
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
        if (in_array($post->post_status, array('auto-draft', 'trash', 'inherit'), true)) return;
        $existing = get_post_meta($post_id, 'unique_number', true);
        if (!empty($existing)) return;
        update_post_meta($post_id, 'unique_number', rpn_generate_ain());
    }

    // ── Contractor Code (PBR-style 3-char alphanumeric) ─────────────────────────

    function rpn_generate_contractor_code() {
        $chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no I/O/0/1 for readability
        $attempts = 0;
        do {
            $code = '';
            for ($i = 0; $i < 3; $i++) {
                $code .= $chars[random_int(0, strlen($chars) - 1)];
            }
            $taken = get_posts(array(
                'post_type'      => 'rpn_contractor',
                'post_status'    => 'any',
                'posts_per_page' => 1,
                'fields'         => 'ids',
                'meta_query'     => array(
                    array('key' => 'contractor_code', 'value' => $code, 'compare' => '='),
                ),
            ));
            $attempts++;
        } while (!empty($taken) && $attempts < 30);
        return $code;
    }

    add_action('save_post_rpn_contractor', 'rpn_auto_assign_contractor_code', 20, 2);
    function rpn_auto_assign_contractor_code($post_id, $post) {
        if (defined('DOING_AUTOSAVE') && DOING_AUTOSAVE) return;
        if (in_array($post->post_status, array('auto-draft', 'trash', 'inherit'), true)) return;
        $existing = get_post_meta($post_id, 'contractor_code', true);
        if (!empty($existing)) return;
        update_post_meta($post_id, 'contractor_code', rpn_generate_contractor_code());
    }

    // ── CRI (Contractor Rating Index) ───────────────────────────────────────────
    // Average SRI/TPI of all animals linked to the contractor.
    // Called automatically after rpn_update_animal_sri() recalculates an animal's index.

    function rpn_update_contractor_cri($contractor_id) {
        if ($contractor_id <= 0) return;

        $animal_ids = get_posts(array(
            'post_type'      => 'animal',
            'post_status'    => 'publish',
            'posts_per_page' => 300,
            'fields'         => 'ids',
            'meta_query'     => array(
                array('key' => 'contractor_id', 'value' => $contractor_id, 'compare' => '='),
            ),
        ));

        $scores = array();
        foreach ($animal_ids as $aid) {
            $scoring_type = get_post_meta($aid, 'scoring_type', true);
            if ($scoring_type === 'timed') {
                $score = (float) get_post_meta($aid, 'tpi_current', true);
            } else {
                $score = (float) get_post_meta($aid, 'sri_current', true);
                if ($score <= 0) $score = (float) get_post_meta($aid, 'sri', true);
            }
            if ($score > 0) $scores[] = $score;
        }

        if (empty($scores)) return;

        $avg = array_sum($scores) / count($scores);
        // Small diversity bonus: each additional scored animal adds 0.5%, capped at +5%
        $diversity = min(1.05, 1.0 + (count($scores) - 1) * 0.005);
        $cri = min(100.0, round($avg * $diversity, 2));
        update_post_meta($contractor_id, 'cri', $cri);
    }

    // ── PRI (Producer Rating Index) ─────────────────────────────────────────────
    // Weighted average of event-tier scores for all events run by this producer,
    // with a participation bonus based on rider count per event.
    // Called automatically when a performance is submitted for any event.

    function rpn_update_producer_pri($producer_id) {
        if ($producer_id <= 0) return;

        $linked_user_id = (int) get_post_meta($producer_id, 'rpn_linked_user_id', true);

        // Primary: events with producer_id meta pointing to this CPT post
        $event_ids = get_posts(array(
            'post_type'      => 'rpn_event',
            'post_status'    => 'publish',
            'posts_per_page' => 300,
            'fields'         => 'ids',
            'meta_query'     => array(
                array('key' => 'producer_id', 'value' => $producer_id, 'compare' => '=', 'type' => 'NUMERIC'),
            ),
        ));

        // Fallback: events authored by the linked user
        if (empty($event_ids) && $linked_user_id > 0) {
            $event_ids = get_posts(array(
                'post_type'      => 'rpn_event',
                'post_status'    => 'publish',
                'posts_per_page' => 300,
                'fields'         => 'ids',
                'author'         => $linked_user_id,
            ));
        }

        if (empty($event_ids)) return;

        $tier_base = array(
            'national'           => 95,
            'world championship' => 100,
            'major'              => 90,
            'regional'           => 70,
            'circuit'            => 60,
            'local'              => 50,
        );

        $event_scores = array();
        foreach ($event_ids as $eid) {
            $tier = strtolower(trim((string) get_post_meta($eid, 'event_tier', true)));
            $base = isset($tier_base[$tier]) ? $tier_base[$tier] : 50;

            // Count submitted performances as a rider participation signal
            $perf_count = count(get_posts(array(
                'post_type'      => 'rpn_performance',
                'post_status'    => 'publish',
                'posts_per_page' => 500,
                'fields'         => 'ids',
                'meta_query'     => array(
                    array('key' => 'event_id', 'value' => $eid, 'compare' => '='),
                ),
            )));

            // +2 pts per 5 riders, capped at +20
            $participation_bonus = min(20, (int) floor($perf_count / 5) * 2);
            $event_scores[] = min(100, $base + $participation_bonus);
        }

        if (empty($event_scores)) return;

        $pri = round(array_sum($event_scores) / count($event_scores), 2);
        update_post_meta($producer_id, 'pri', $pri);
    }

    /* ==========================================================================
    * SHOW RIN ID + MEMBERSHIP INFO ON WP ADMIN USER PROFILE PAGE
    * ========================================================================== */
    add_action('show_user_profile', 'rpn_show_rin_fields_on_profile');
    add_action('edit_user_profile', 'rpn_show_rin_fields_on_profile');

    function rpn_show_rin_fields_on_profile($user) {
        $rin_id          = get_user_meta($user->ID, 'rpn_rin_id',          true) ?: '—';
        $membership_tier = get_user_meta($user->ID, 'rpn_membership_tier', true) ?: 'free';
        $joining_as      = get_user_meta($user->ID, 'rpn_joining_as',      true) ?: '—';
        $pending_tier    = get_user_meta($user->ID, 'rpn_pending_tier',    true) ?: '';
        $trial_expires   = get_user_meta($user->ID, 'rpn_trial_expires',   true) ?: '';
        $linked_rider_id = (int) get_user_meta($user->ID, 'rpn_linked_rider_id',      true);
        $linked_con_id   = (int) get_user_meta($user->ID, 'rpn_linked_contractor_id', true);
        $linked_pro_id   = (int) get_user_meta($user->ID, 'rpn_linked_producer_id',   true);
        ?>
        <h2>RIN — Rodeo Identification Network</h2>
        <table class="form-table" role="presentation">
            <tr>
                <th><label>RIN ID</label></th>
                <td>
                    <strong style="font-size:1.1em;letter-spacing:.05em;"><?php echo esc_html($rin_id); ?></strong>
                    <?php if ($rin_id !== '—') : ?>
                        &nbsp;
                        <a href="#" onclick="navigator.clipboard.writeText('<?php echo esc_attr($rin_id); ?>');this.textContent='Copied!';setTimeout(()=>this.textContent='Copy',1500);return false;"
                        style="font-size:0.85em;">Copy</a>
                    <?php endif; ?>
                    <p class="description">Auto-generated on registration. Used for the public athlete profile URL: <code>/athletes/<?php echo esc_html($rin_id); ?></code></p>
                </td>
            </tr>
            <tr>
                <th><label>Membership Tier</label></th>
                <td>
                    <strong><?php echo esc_html(ucfirst($membership_tier)); ?></strong>
                    <?php if ($pending_tier) : ?>
                        &nbsp;<em style="color:#b45309;">(Pending upgrade to <?php echo esc_html(ucfirst($pending_tier)); ?> — awaiting payment)</em>
                    <?php endif; ?>
                    <?php if ($trial_expires) : ?>
                        &nbsp;<em style="color:#15803d;">(Free trial — expires <?php echo esc_html($trial_expires); ?>)</em>
                    <?php endif; ?>
                </td>
            </tr>
            <tr>
                <th><label>Joining As</label></th>
                <td><?php echo esc_html(ucfirst(str_replace('_', ' ', $joining_as))); ?></td>
            </tr>
            <?php if ($linked_rider_id) : ?>
            <tr>
                <th><label>Linked Rider Post</label></th>
                <td>
                    <a href="<?php echo esc_url(get_edit_post_link($linked_rider_id)); ?>">
                        <?php echo esc_html(get_the_title($linked_rider_id)); ?>
                    </a>
                    <span style="color:#6b7280;">(ID: <?php echo esc_html($linked_rider_id); ?>)</span>
                </td>
            </tr>
            <?php endif; ?>
            <?php if ($linked_con_id) : ?>
            <tr>
                <th><label>Linked Contractor</label></th>
                <td>
                    <a href="<?php echo esc_url(get_edit_post_link($linked_con_id)); ?>">
                        <?php echo esc_html(get_the_title($linked_con_id)); ?>
                    </a>
                    <span style="color:#6b7280;">(ID: <?php echo esc_html($linked_con_id); ?>)</span>
                </td>
            </tr>
            <?php endif; ?>
            <?php if ($linked_pro_id) : ?>
            <tr>
                <th><label>Linked Producer</label></th>
                <td>
                    <a href="<?php echo esc_url(get_edit_post_link($linked_pro_id)); ?>">
                        <?php echo esc_html(get_the_title($linked_pro_id)); ?>
                    </a>
                    <span style="color:#6b7280;">(ID: <?php echo esc_html($linked_pro_id); ?>)</span>
                </td>
            </tr>
            <?php endif; ?>
        </table>

        <?php if (current_user_can('manage_options')) : ?>
        <h3 style="margin-top:1.5rem;">Admin: Override RIN Fields</h3>
        <table class="form-table" role="presentation">
            <tr>
                <th><label for="rpn_rin_id_override">RIN ID</label></th>
                <td>
                    <input type="text" name="rpn_rin_id_override" id="rpn_rin_id_override"
                        value="<?php echo esc_attr($rin_id === '—' ? '' : $rin_id); ?>"
                        class="regular-text" placeholder="e.g. RIN-A3F7C2" />
                    <p class="description">Leave blank to keep current. Must match format RIN-XXXXXX.</p>
                </td>
            </tr>
            <tr>
                <th><label for="rpn_membership_tier_override">Membership Tier</label></th>
                <td>
                    <select name="rpn_membership_tier_override" id="rpn_membership_tier_override">
                        <?php foreach (array('free', 'competitor', 'contractor', 'organizer', 'enterprise') as $t) : ?>
                            <option value="<?php echo esc_attr($t); ?>" <?php selected($membership_tier, $t); ?>>
                                <?php echo esc_html(ucfirst($t)); ?>
                            </option>
                        <?php endforeach; ?>
                    </select>
                </td>
            </tr>
            <tr>
                <th><label for="rpn_trial_expires_override">Trial Expiry Date</label></th>
                <td>
                    <input type="date" name="rpn_trial_expires_override" id="rpn_trial_expires_override"
                        value="<?php echo esc_attr($trial_expires); ?>"
                        class="regular-text" />
                    <p class="description">
                        Set to a <strong>past date</strong> (e.g. 2020-01-01) then save, then run the cron below to simulate trial expiry.
                        Clear the field (leave blank) and save to remove the trial entirely.
                    </p>
                    <?php
                    $cron_nonce = wp_create_nonce('rpn_run_trial_cron');
                    $cron_url   = add_query_arg(array(
                        'action'   => 'rpn_run_trial_cron',
                        '_wpnonce' => $cron_nonce,
                    ), admin_url('users.php'));
                    ?>
                    <a href="<?php echo esc_url($cron_url); ?>" class="button button-secondary" style="margin-top:6px;">
                        Run Trial Expiration Check Now
                    </a>
                    <p class="description" style="margin-top:4px;">Click this to immediately run the expiration job (for testing — checks all users with past trial dates).</p>
                </td>
            </tr>
        </table>

        <h3 style="margin-top:1.5rem;">Send RIN Credentials</h3>
        <table class="form-table" role="presentation">
            <tr>
                <th>Set-Password Email</th>
                <td>
                    <?php
                    $cred_nonce   = wp_create_nonce('rpn_send_credentials_' . $user->ID);
                    $cred_url     = add_query_arg(array(
                        'action'   => 'rpn_send_credentials',
                        'user_id'  => $user->ID,
                        '_wpnonce' => $cred_nonce,
                    ), admin_url('users.php'));
                    $cred_just_sent = isset($_GET['rpn_cred_sent']) && absint($_GET['rpn_cred_user_id'] ?? 0) === $user->ID;
                    $cred_ok        = $cred_just_sent && $_GET['rpn_cred_sent'] === '1';
                    ?>
                    <a href="<?php echo esc_url($cred_url); ?>" class="button button-secondary">
                        Send RIN Set-Password Email
                    </a>
                    <?php if ($cred_just_sent) : ?>
                        <span style="margin-left:10px;font-weight:600;color:<?php echo $cred_ok ? '#16a34a' : '#dc2626'; ?>">
                            <?php echo $cred_ok ? '✓ Email sent!' : '✗ Failed — check email settings'; ?>
                        </span>
                    <?php endif; ?>
                    <p class="description">
                        Sends a branded RIN email to <strong><?php echo esc_html($user->user_email); ?></strong> with a secure
                        link to <code>/set-password</code> on the React app. Link expires in 24&nbsp;hours. Use this any time
                        a manually added user hasn't received their credentials.
                    </p>
                </td>
            </tr>
        </table>
        <?php endif; ?>
        <?php
    }

    add_action('personal_options_update',  'rpn_save_rin_fields_on_profile');
    add_action('edit_user_profile_update', 'rpn_save_rin_fields_on_profile');

    function rpn_save_rin_fields_on_profile($user_id) {
        if (!current_user_can('manage_options')) return;
        if (!isset($_POST['rpn_rin_id_override']) && !isset($_POST['rpn_membership_tier_override'])) return;

        // Save RIN ID override (only if non-empty and format is valid)
        if (!empty($_POST['rpn_rin_id_override'])) {
            $new_rin = strtoupper(sanitize_text_field(wp_unslash($_POST['rpn_rin_id_override'])));
            if (preg_match('/^RIN-[A-Z0-9]{6}$/', $new_rin)) {
                update_user_meta($user_id, 'rpn_rin_id', $new_rin);
            }
        }

        // Save membership tier override
        if (isset($_POST['rpn_membership_tier_override'])) {
            $allowed = array('free', 'competitor', 'contractor', 'organizer', 'enterprise');
            $new_tier = sanitize_text_field(wp_unslash($_POST['rpn_membership_tier_override']));
            if (in_array($new_tier, $allowed, true)) {
                update_user_meta($user_id, 'rpn_membership_tier', $new_tier);
                // Clear pending tier if admin is setting the tier directly
                delete_user_meta($user_id, 'rpn_pending_tier');
            }
        }

        // Save trial expiry date override (blank = delete)
        if (isset($_POST['rpn_trial_expires_override'])) {
            $trial_val = sanitize_text_field(wp_unslash($_POST['rpn_trial_expires_override']));
            if ($trial_val && preg_match('/^\d{4}-\d{2}-\d{2}$/', $trial_val)) {
                update_user_meta($user_id, 'rpn_trial_expires', $trial_val);
            } else {
                delete_user_meta($user_id, 'rpn_trial_expires');
                delete_user_meta($user_id, 'rpn_trial_tier');
            }
        }

        // If the admin explicitly set the tier via the dropdown, honour it and don't
        // let the role-based auto-sync (below) override it.
        if (isset($_POST['rpn_membership_tier_override'])) {
            $allowed = array('free', 'competitor', 'contractor', 'organizer', 'enterprise');
            $chosen  = sanitize_text_field(wp_unslash($_POST['rpn_membership_tier_override']));
            if (in_array($chosen, $allowed, true)) {
                set_transient('rpn_tier_admin_set_' . $user_id, $chosen, 30);
            }
        }
    }

    // Late hook (priority 99) — if role changed to an RPN role and admin did NOT
    // explicitly pick a tier, auto-set the tier to match the new role.
    add_action('edit_user_profile_update', 'rpn_late_sync_tier_on_role_change', 99);
    add_action('personal_options_update',  'rpn_late_sync_tier_on_role_change', 99);
    function rpn_late_sync_tier_on_role_change($user_id) {
        if (!current_user_can('manage_options')) return;

        // If the admin explicitly picked a tier, respect that and bail.
        $explicit = get_transient('rpn_tier_admin_set_' . $user_id);
        delete_transient('rpn_tier_admin_set_' . $user_id);

        $user  = get_user_by('id', $user_id);
        if (!$user) return;
        $roles = (array) $user->roles;
        $tier  = get_user_meta($user_id, 'rpn_membership_tier', true);

        // Only auto-sync if the current tier doesn't match the expected one for this role.
        if (in_array('rpn_producer', $roles) && $tier !== 'organizer' && !$explicit) {
            update_user_meta($user_id, 'rpn_membership_tier', 'organizer');
            update_user_meta($user_id, 'rpn_joining_as', 'producer');
            if (!get_user_meta($user_id, 'rpn_trial_expires', true)) {
                update_user_meta($user_id, 'rpn_trial_tier', 'organizer');
                update_user_meta($user_id, 'rpn_trial_expires', date('Y-m-d', strtotime('+3 months')));
            }
        } elseif (in_array('rpn_contractor', $roles) && $tier !== 'contractor' && !$explicit) {
            update_user_meta($user_id, 'rpn_membership_tier', 'contractor');
            update_user_meta($user_id, 'rpn_joining_as', 'contractor');
            if (!get_user_meta($user_id, 'rpn_trial_expires', true)) {
                update_user_meta($user_id, 'rpn_trial_tier', 'contractor');
                update_user_meta($user_id, 'rpn_trial_expires', date('Y-m-d', strtotime('+3 months')));
            }
        } elseif (in_array('rpn_rider', $roles) && !$tier && !$explicit) {
            update_user_meta($user_id, 'rpn_membership_tier', 'free');
            update_user_meta($user_id, 'rpn_joining_as', 'rider');
        }
    }

    // Manual cron trigger for trial expiration (testing tool on user profile page)
    add_action('admin_action_rpn_run_trial_cron', function() {
        if (!current_user_can('manage_options')) wp_die('Unauthorized');
        check_admin_referer('rpn_run_trial_cron');
        do_action('rpn_check_trial_expirations');
        wp_redirect(add_query_arg('rpn_trial_cron_ran', '1', wp_get_referer() ?: admin_url('users.php')));
        exit;
    });

    // Show notice after cron ran
    add_action('admin_notices', function() {
        if (!isset($_GET['rpn_trial_cron_ran'])) return;
        echo '<div class="notice notice-success is-dismissible"><p><strong>RIN:</strong> Trial expiration check ran — expired trial accounts have been downgraded to free.</p></div>';
    });

    /* ==========================================================================
     * SEND RIN CREDENTIALS — row action, bulk action, handler, notices
     * ========================================================================== */

    // ── Row action in Users list ─────────────────────────────────────────────
    add_filter('user_row_actions', function($actions, $user) {
        if (!current_user_can('manage_options')) return $actions;
        if (in_array('administrator', (array) $user->roles, true)) return $actions;
        $nonce = wp_create_nonce('rpn_send_credentials_' . $user->ID);
        $url   = add_query_arg(array(
            'action'   => 'rpn_send_credentials',
            'user_id'  => $user->ID,
            '_wpnonce' => $nonce,
        ), admin_url('users.php'));
        $actions['rpn_send_credentials'] = '<a href="' . esc_url($url) . '">Send RIN Credentials</a>';
        return $actions;
    }, 10, 2);

    // ── Bulk action ──────────────────────────────────────────────────────────
    add_filter('bulk_actions-users', function($actions) {
        if (current_user_can('manage_options')) {
            $actions['rpn_send_credentials'] = 'Send RIN Credentials';
        }
        return $actions;
    });

    add_filter('handle_bulk_actions-users', function($redirect_url, $action, $user_ids) {
        if ($action !== 'rpn_send_credentials') return $redirect_url;
        if (!current_user_can('manage_options'))  return $redirect_url;

        $sent = 0; $failed = 0;
        foreach ($user_ids as $uid) {
            $u = get_userdata((int) $uid);
            if (!$u) { $failed++; continue; }
            $key = get_password_reset_key($u);
            if (is_wp_error($key)) { $failed++; continue; }
            $set_url = rpn_get_react_app_url() . '/set-password?key=' . rawurlencode($key) . '&login=' . rawurlencode($u->user_login);
            $msg     = rpn_build_password_email($u->display_name ?: $u->user_login, $set_url, 'set');
            $headers = array('Content-Type: text/html; charset=UTF-8', 'From: RIN Rodeo <info@rinrodeo.com>');
            wp_mail($u->user_email, 'Set Your RIN Password', $msg, $headers) ? $sent++ : $failed++;
        }

        return add_query_arg(array(
            'rpn_bulk_sent'   => $sent,
            'rpn_bulk_failed' => $failed,
        ), $redirect_url);
    }, 10, 3);

    // ── Single-user action handler ───────────────────────────────────────────
    add_action('admin_action_rpn_send_credentials', function() {
        if (!current_user_can('manage_options')) wp_die('Unauthorized.');

        $user_id = absint($_GET['user_id'] ?? 0);
        if (!$user_id || !check_admin_referer('rpn_send_credentials_' . $user_id)) {
            wp_die('Invalid or expired request. Please go back and try again.');
        }

        $user = get_userdata($user_id);
        if (!$user) wp_die('User not found.');

        $ok = false;
        $key = get_password_reset_key($user);
        if (!is_wp_error($key)) {
            $set_url = rpn_get_react_app_url() . '/set-password?key=' . rawurlencode($key) . '&login=' . rawurlencode($user->user_login);
            $msg     = rpn_build_password_email($user->display_name ?: $user->user_login, $set_url, 'set');
            $headers = array('Content-Type: text/html; charset=UTF-8', 'From: RIN Rodeo <info@rinrodeo.com>');
            $ok      = (bool) wp_mail($user->user_email, 'Set Your RIN Password', $msg, $headers);
        }

        wp_safe_redirect(add_query_arg(array(
            'rpn_cred_sent'    => $ok ? '1' : '0',
            'rpn_cred_user_id' => $user_id,
        ), admin_url('users.php')));
        exit;
    });

    // ── Admin notices (single + bulk feedback) ───────────────────────────────
    add_action('admin_notices', function() {
        // Single send
        if (isset($_GET['rpn_cred_sent'])) {
            $ok   = $_GET['rpn_cred_sent'] === '1';
            $uid  = absint($_GET['rpn_cred_user_id'] ?? 0);
            $u    = $uid ? get_userdata($uid) : null;
            $to   = $u ? ' to <strong>' . esc_html($u->user_email) . '</strong>' : '';
            $cls  = $ok ? 'notice-success' : 'notice-error';
            $text = $ok
                ? 'RIN set-password email sent successfully' . $to . '.'
                : 'Failed to send RIN credentials' . $to . '. Check your WordPress email configuration.';
            echo '<div class="notice ' . esc_attr($cls) . ' is-dismissible"><p>' . wp_kses($text, array('strong' => array())) . '</p></div>';
        }

        // Bulk send
        if (isset($_GET['rpn_bulk_sent'])) {
            $sent   = absint($_GET['rpn_bulk_sent']);
            $failed = absint($_GET['rpn_bulk_failed'] ?? 0);
            $cls    = $failed === 0 ? 'notice-success' : ($sent === 0 ? 'notice-error' : 'notice-warning');
            $parts  = array();
            if ($sent)   $parts[] = $sent . ' email' . ($sent  !== 1 ? 's' : '') . ' sent successfully';
            if ($failed) $parts[] = $failed . ' failed';
            echo '<div class="notice ' . esc_attr($cls) . ' is-dismissible"><p>RIN Credentials: ' . esc_html(implode(', ', $parts)) . '.</p></div>';
        }
    });

    function rpn_dashboard_rider_callback($request) {
        $token = $request->get_header('X-RPN-Auth') ?: $request->get_header('Authorization');
        if ($token && strpos($token, 'Bearer ') === 0) $token = substr($token, 7);
        $user_id = rpn_verify_token($token);
        if (!$user_id) {
            return new WP_REST_Response(array('success' => false, 'message' => 'Please log in.'), 401);
        }
        $rider_id = (int) get_user_meta($user_id, 'rpn_linked_rider_id', true);
        if (!$rider_id) {
            return new WP_REST_Response(array('success' => false, 'message' => 'No rider linked to your account. Purchase Premium to link your rider profile.'), 403);
        }
        $rider = get_post($rider_id);
        if (!$rider || $rider->post_type !== 'rider' || $rider->post_status !== 'publish') {
            return new WP_REST_Response(array('success' => false, 'message' => 'Rider profile not found.'), 404);
        }
        $membership_tier = get_user_meta($user_id, 'rpn_membership_tier', true) ?: 'free';
        $rin_id          = get_user_meta($user_id, 'rpn_rin_id', true) ?: '';
        $rpi             = get_post_meta($rider_id, 'rpi', true);
        $state           = get_post_meta($rider_id, 'state', true);
        $city            = get_post_meta($rider_id, 'city', true);
        $bio             = get_post_meta($rider_id, 'bio', true);
        $age_group       = get_post_meta($rider_id, 'age_group', true);
        $event_type      = get_post_meta($rider_id, 'event_type', true);
        $total_rides     = get_post_meta($rider_id, 'total_rides', true);
        $qualified_rides = get_post_meta($rider_id, 'qualified_rides', true);
        $completion_rate = get_post_meta($rider_id, 'completion_rate', true);
        $win_count       = get_post_meta($rider_id, 'win_count', true);
        // linked animals for contractor-style tracking
        $linked_animals  = get_post_meta($rider_id, 'linked_animals', true);
        $animal_ids      = is_array($linked_animals) ? $linked_animals : array();
        return new WP_REST_Response(array(
            'success' => true,
            'rider' => array(
                'id'               => $rider_id,
                'name'             => $rider->post_title,
                'slug'             => $rider->post_name,
                'rin_id'           => $rin_id,
                'membership_tier'  => $membership_tier,
                'rpi'              => $rpi ? (float) $rpi : null,
                'state'            => $state,
                'city'             => $city,
                'bio'              => $bio,
                'age_group'        => $age_group,
                'event_type'       => $event_type,
                'total_rides'      => $total_rides ? (int) $total_rides : null,
                'qualified_rides'  => $qualified_rides ? (int) $qualified_rides : null,
                'completion_rate'  => $completion_rate ? (float) $completion_rate : null,
                'win_count'        => $win_count ? (int) $win_count : null,
                'linked_animal_ids'=> $animal_ids,
            ),
        ), 200);
    }

    function rpn_dashboard_contractor_callback($request) {
        $token = $request->get_header('X-RPN-Auth') ?: $request->get_header('Authorization');
        if ($token && strpos($token, 'Bearer ') === 0) $token = substr($token, 7);
        $user_id = rpn_verify_token($token);
        if (!$user_id) {
            return new WP_REST_Response(array('success' => false, 'message' => 'Please log in.'), 401);
        }
        $contractor_id = (int) get_user_meta($user_id, 'rpn_linked_contractor_id', true);
        if (!$contractor_id) {
            return new WP_REST_Response(array('success' => false, 'message' => 'No contractor profile linked to your account.'), 403);
        }
        $post = get_post($contractor_id);
        $post_type = $post ? $post->post_type : '';
        if (!$post || !in_array($post_type, array('contractor', 'rpn_contractor'), true) || $post->post_status !== 'publish') {
            return new WP_REST_Response(array('success' => false, 'message' => 'Contractor profile not found.'), 404);
        }
        $cri = get_post_meta($contractor_id, 'cri', true);
        $verified = get_post_meta($contractor_id, 'verified', true);
        $code = get_post_meta($contractor_id, 'contractor_code', true);
        $state = get_post_meta($contractor_id, 'state', true);
        $city = get_post_meta($contractor_id, 'city', true);
        $premium = get_post_meta($contractor_id, 'premium_member', true);
        $linked = get_post_meta($contractor_id, 'linked_animals', true);
        $animal_ids = is_array($linked) ? $linked : (is_string($linked) ? array_filter(array_map('intval', explode(',', $linked))) : array());
        return new WP_REST_Response(array(
            'success' => true,
            'contractor' => array(
                'id' => $contractor_id,
                'name' => $post->post_title,
                'slug' => $post->post_name,
                'cri' => $cri ? (float) $cri : null,
                'verified' => (bool) $verified,
                'contractor_code' => $code,
                'state' => $state,
                'city' => $city,
                'premium_member' => (bool) $premium,
                'linked_animal_ids' => $animal_ids,
            ),
        ), 200);
    }

    function rpn_dashboard_producer_callback($request) {
        $token = $request->get_header('X-RPN-Auth') ?: $request->get_header('Authorization');
        if ($token && strpos($token, 'Bearer ') === 0) $token = substr($token, 7);
        $user_id = rpn_verify_token($token);
        if (!$user_id) {
            return new WP_REST_Response(array('success' => false, 'message' => 'Please log in.'), 401);
        }
        $producer_id = (int) get_user_meta($user_id, 'rpn_linked_producer_id', true);
        if (!$producer_id) {
            return new WP_REST_Response(array('success' => false, 'message' => 'No producer profile linked to your account.'), 403);
        }
        $post = get_post($producer_id);
        $post_type = $post ? $post->post_type : '';
        if (!$post || !in_array($post_type, array('producer', 'rpn_producer'), true) || $post->post_status !== 'publish') {
            return new WP_REST_Response(array('success' => false, 'message' => 'Producer profile not found.'), 404);
        }
        $pri = get_post_meta($producer_id, 'pri', true);
        $verified = get_post_meta($producer_id, 'verified', true);
        $premium = get_post_meta($producer_id, 'premium_member', true);
        $linked = get_post_meta($producer_id, 'linked_events', true);
        $event_ids = is_array($linked) ? $linked : (is_string($linked) ? array_filter(array_map('intval', explode(',', $linked))) : array());
        $state = get_post_meta($producer_id, 'state', true);
        $city = get_post_meta($producer_id, 'city', true);
        return new WP_REST_Response(array(
            'success' => true,
            'producer' => array(
                'id' => $producer_id,
                'name' => $post->post_title,
                'slug' => $post->post_name,
                'pri' => $pri ? (float) $pri : null,
                'verified' => (bool) $verified,
                'state' => $state,
                'city' => $city,
                'premium_member' => (bool) $premium,
                'linked_event_ids' => $event_ids,
            ),
        ), 200);
    }

    /**
     * REST API: Condition modifiers (lookup table + tooltips)
     */
    function rpn_register_condition_modifiers_route() {
        register_rest_route('rpn/v1', '/condition-modifiers', array(
            'methods' => 'GET',
            'permission_callback' => '__return_true',
            'callback' => function () {
                return rpn_get_condition_modifiers_for_rest();
            },
        ));
    }
    add_action('rest_api_init', 'rpn_register_condition_modifiers_route');

    /**
     * Check if current user is allowed to tag media.
     * You can mark a WordPress user as verified by setting user meta key `rpn_verified` to true.
     */
    function rpn_media_can_tag() {
        if (!is_user_logged_in()) {
            return false;
        }
        $user_id = get_current_user_id();
        $verified = get_user_meta($user_id, 'rpn_verified', true);
        return (bool) $verified;
    }

    /**
     * REST API: Media highlights (list, likes, tags)
     */
    function rpn_register_media_routes() {
        // List / filter media, optionally by tagged rider/animal/pickup team
        register_rest_route('rpn/v1', '/media', array(
            'methods' => 'GET',
            'permission_callback' => '__return_true',
            'callback' => 'rpn_media_index',
            'args' => array(
                'rider_id' => array('required' => false, 'type' => 'integer'),
                'animal_id' => array('required' => false, 'type' => 'integer'),
                'pickup_team_id' => array('required' => false, 'type' => 'integer'),
            ),
        ));

        // Like / unlike media item
        register_rest_route('rpn/v1', '/media/(?P<id>\d+)/like', array(
            'methods' => 'POST',
            'permission_callback' => function () {
                return is_user_logged_in();
            },
            'callback' => 'rpn_media_like_callback',
        ));

        // Add tags to media – only verified users may tag
        register_rest_route('rpn/v1', '/media/(?P<id>\d+)/tags', array(
            'methods' => 'POST',
            'permission_callback' => 'rpn_media_can_tag',
            'callback' => 'rpn_media_add_tags_callback',
        ));

        // Remove tag for the current user (so tagged users can remove themselves)
        register_rest_route('rpn/v1', '/media/(?P<id>\d+)/tags', array(
            'methods' => 'DELETE',
            'permission_callback' => function () {
                return is_user_logged_in();
            },
            'callback' => 'rpn_media_remove_tag_callback',
        ));
    }
    add_action('rest_api_init', 'rpn_register_media_routes');

    function rpn_media_index($request) {
        $args = array(
            'post_type' => 'rpn_media',
            'post_status' => 'publish',
            'posts_per_page' => 20,
        );

        $meta_query = array('relation' => 'OR');
        $has_filter = false;

        $rider_id = (int) $request->get_param('rider_id');
        $animal_id = (int) $request->get_param('animal_id');
        $pickup_team_id = (int) $request->get_param('pickup_team_id');

        if ($rider_id > 0) {
            $meta_query[] = array(
                'key' => 'tagged_riders',
                'value' => $rider_id,
                'compare' => 'LIKE',
            );
            $has_filter = true;
        }
        if ($animal_id > 0) {
            $meta_query[] = array(
                'key' => 'tagged_animals',
                'value' => $animal_id,
                'compare' => 'LIKE',
            );
            $has_filter = true;
        }
        if ($pickup_team_id > 0) {
            $meta_query[] = array(
                'key' => 'tagged_pickup_teams',
                'value' => $pickup_team_id,
                'compare' => 'LIKE',
            );
            $has_filter = true;
        }

        if ($has_filter) {
            $args['meta_query'] = $meta_query;
        }

        $query = new WP_Query($args);
        $items = array();
        foreach ($query->posts as $post) {
            $media_type = get_post_meta($post->ID, 'media_type', true);
            $video_url = get_post_meta($post->ID, 'video_url', true);
            $attachment_id = (int) get_post_meta($post->ID, 'attachment_id', true);
            $thumbnail_url = '';
            if ($media_type === 'image' && $attachment_id > 0) {
                $thumbnail_url = wp_get_attachment_image_url($attachment_id, 'medium');
            }
            if (empty($thumbnail_url) && $media_type === 'video' && $video_url) {
                if (preg_match('#(?:youtube\.com/watch\?v=|youtu\.be/)([a-zA-Z0-9_-]+)#', $video_url, $m)) {
                    $thumbnail_url = 'https://img.youtube.com/vi/' . $m[1] . '/mqdefault.jpg';
                } elseif (preg_match('#vimeo\.com/(?:video/)?(\d+)#', $video_url, $m)) {
                    $thumbnail_url = 'https://vumbnail.com/' . $m[1] . '.jpg';
                }
            }
            if (empty($thumbnail_url)) {
                $thumb_id = get_post_thumbnail_id($post->ID);
                if ($thumb_id > 0) {
                    $thumbnail_url = wp_get_attachment_image_url($thumb_id, 'medium');
                }
            }
            $items[] = array(
                'id' => $post->ID,
                'title' => get_the_title($post),
                'excerpt' => wp_trim_words($post->post_content, 30),
                'media_type' => $media_type,
                'video_url' => $video_url,
                'attachment_id' => $attachment_id,
                'thumbnail_url' => $thumbnail_url ?: null,
                'likes_count' => (int) get_post_meta($post->ID, 'likes_count', true),
            );
        }

        return $items;
    }

    function rpn_media_like_callback($request) {
        $post_id = isset($request['id']) ? (int) $request['id'] : 0;
        $user_id = get_current_user_id();

        if ($post_id <= 0 || $user_id <= 0) {
            return new WP_REST_Response(array('success' => false, 'message' => 'Invalid media ID or user.'), 400);
        }

        $liked = get_post_meta($post_id, 'liked_user_ids', true);
        if (!is_array($liked)) {
            $liked = array();
        }

        if (in_array($user_id, $liked, true)) {
            // Unlike
            $liked = array_values(array_diff($liked, array($user_id)));
            $action = 'unliked';
        } else {
            // Like
            $liked[] = $user_id;
            $liked = array_values(array_unique($liked));
            $action = 'liked';
        }

        update_post_meta($post_id, 'liked_user_ids', $liked);
        update_post_meta($post_id, 'likes_count', count($liked));

        return array(
            'success' => true,
            'action' => $action,
            'likes_count' => count($liked),
        );
    }

    function rpn_media_add_tags_callback($request) {
        $post_id = isset($request['id']) ? (int) $request['id'] : 0;
        if ($post_id <= 0) {
            return new WP_REST_Response(array('success' => false, 'message' => 'Invalid media ID.'), 400);
        }

        $map = array(
            'tagged_riders' => 'rider_ids',
            'tagged_animals' => 'animal_ids',
            'tagged_pickup_teams' => 'pickup_team_ids',
            'tagged_users' => 'user_ids',
        );

        foreach ($map as $meta_key => $param) {
            $ids = $request->get_param($param);
            if (is_array($ids) && !empty($ids)) {
                $ids = array_map('intval', $ids);
                $existing = get_post_meta($post_id, $meta_key, true);
                if (!is_array($existing)) {
                    $existing = array();
                }
                $merged = array_values(array_unique(array_merge($existing, $ids)));
                update_post_meta($post_id, $meta_key, $merged);
            }
        }

        return array('success' => true);
    }

    function rpn_media_remove_tag_callback($request) {
        $post_id = isset($request['id']) ? (int) $request['id'] : 0;
        $user_id = get_current_user_id();
        if ($post_id <= 0 || $user_id <= 0) {
            return new WP_REST_Response(array('success' => false, 'message' => 'Invalid media ID or user.'), 400);
        }

        // Allow tagged users to remove themselves from tagged_users
        $tagged_users = get_post_meta($post_id, 'tagged_users', true);
        if (!is_array($tagged_users)) {
            $tagged_users = array();
        }

        if (in_array($user_id, $tagged_users, true)) {
            $tagged_users = array_values(array_diff($tagged_users, array($user_id)));
            update_post_meta($post_id, 'tagged_users', $tagged_users);
        }

        return array('success' => true);
    }

    /* ==========================================================================
    * Section 8 — RPI Calculation Engine (Client Spec v2)
    *
    * STEP A  Raw Event Score
    *   Roughstock : judge_score + placement_bonus  (0 if no cover)
    *   Timed      : 100 − (rider_time / field_best_time × 30)  (0 if no-time)
    *   Max clamped at 100.
    *
    * STEP B  Multipliers (applied in order)
    *   Field Strength  : 0.85–1.20 based on avg RPI of riders in same go-round
    *   Event Tier      : local 1.0 | regional 1.1 | pro 1.25 | championship 1.3
    *   Verification    : official_api 1.05 | self_reported 0.90
    *
    * STEP C  Weighted Event Score  = clamp(raw × field × tier × verify, 0, 100)
    *
    * STEP D  Three RPI Variants
    *   Current RPI : last 365 days, time-decayed weights, + consistency bonus ±5
    *   Season RPI  : simple average of all weighted scores in current calendar year
    *   Career RPI  : simple average of all weighted scores ever
    *
    * Time decay
    *   0–90 days   weight = 1.0
    *   91–365 days weight = (365 − days) / 275   (linear 1.0→0)
    *   > 365 days  excluded from Current RPI
    *
    * Consistency bonus/penalty  (applied only to Current RPI)
    *   success_rate = qualified / total_attempts  (last 365 days)
    *   adjustment   = clamp((success_rate − 0.5) × 10, −5, +5)
    *
    * Reliability status (based on total verified career results)
    *   0–4  → Provisional
    *   5–9  → Emerging
    *   10+  → Established
    * ========================================================================== */

    /**
     * Placement bonus table (client spec).
     */
    function rpn_get_placement_bonus( $placement ) {
        $p = (int) $placement;
        if ( $p === 1 )             return 8;
        if ( $p === 2 )             return 6;
        if ( $p === 3 )             return 4;
        if ( $p === 4 )             return 3;
        if ( $p === 5 )             return 2;
        if ( $p >= 6 && $p <= 10 ) return 1;
        return 0;
    }

    /**
     * Raw event score — roughstock.
     * Returns judge_total + placement_bonus if covered, else 0. Clamped at 100.
     */
    function rpn_calc_roughstock_event_score( $judge_total, $placement, $qualified ) {
        if ( ! $qualified ) return 0.0;
        return (float) min( 100, $judge_total + rpn_get_placement_bonus( $placement ) );
    }

    /**
     * Raw event score — timed.
     * Returns 100 − (rider_time / field_best_time × 30), clamped 0–100.
     * Returns 0 if no-time, DQ, or missing times.
     */
    function rpn_calc_timed_event_score( $rider_time, $field_best_time, $no_time ) {
        if ( $no_time || $rider_time <= 0 || $field_best_time <= 0 ) return 0.0;
        $ratio = (float) $rider_time / (float) $field_best_time;
        return (float) max( 0, min( 100, 100 - ( $ratio * 30 ) ) );
    }

    /**
     * Field Strength multiplier (0.85–1.20).
     * Queries all riders in the same event/go-round, averages their current RPI,
     * then maps linearly: avg_rpi=0 → 0.85, avg_rpi=50 → 1.00, avg_rpi=100 → 1.20.
     */
    function rpn_calc_field_strength_multiplier( $event_id, $go_round, $exclude_rider_id ) {
        // Require event_id — go_round alone would match across ALL events (wrong)
        if ( ! $event_id ) return 1.00;

        $meta_query = array( 'relation' => 'AND' );
        if ( $event_id ) {
            $meta_query[] = array( 'key' => 'event_id', 'value' => $event_id, 'type' => 'NUMERIC' );
        }
        if ( $go_round ) {
            $meta_query[] = array( 'key' => 'go_round', 'value' => $go_round );
        }

        $perfs = get_posts( array(
            'post_type'      => 'rpn_performance',
            'post_status'    => 'publish',
            'posts_per_page' => 200,
            'meta_query'     => $meta_query,
        ) );

        $rpi_values = array();
        foreach ( $perfs as $p ) {
            $r_id = (int) get_post_meta( $p->ID, 'rider_id', true );
            if ( $r_id === (int) $exclude_rider_id || $r_id <= 0 ) continue;
            $r_rpi = (float) get_post_meta( $r_id, 'rpi', true );
            $rpi_values[] = $r_rpi;
        }

        if ( empty( $rpi_values ) ) return 1.00;

        $avg_rpi = array_sum( $rpi_values ) / count( $rpi_values );
        // Linear map: 0→0.85, 50→1.00, 100→1.20
        $multiplier = 0.85 + ( $avg_rpi / 100 ) * 0.35;
        return (float) min( 1.20, max( 0.85, round( $multiplier, 4 ) ) );
    }

    /**
     * Verification multiplier.
     * 'official'     → 1.05
     * 'self_reported' → 0.90
     * anything else  → 0.90 (treat as self-reported for safety)
     */
    function rpn_calc_verification_multiplier( $status ) {
        if ( $status === 'official' ) return 1.05;
        return 0.90;
    }

    /**
     * Time-decay weight for a performance N days old.
     * 0–90  days → 1.0
     * 91–365 days → linear decay to 0
     * >365 days  → 0 (excluded from Current RPI)
     */
    function rpn_get_time_decay_weight( $days_old ) {
        $days_old = (int) $days_old;
        if ( $days_old <= 90 )  return 1.0;
        if ( $days_old >= 365 ) return 0.0;
        return round( ( 365 - $days_old ) / 275, 6 ); // 275 = 365 − 90
    }

    /**
     * Consistency bonus/penalty for Current RPI (±5 pts).
     * success_rate = qualified_attempts / total_attempts
     * adjustment   = clamp((rate − 0.5) × 10, −5, +5)
     */
    function rpn_calc_consistency_adjustment( $qualified, $total ) {
        if ( $total <= 0 ) return 0.0;
        $rate = (float) $qualified / (float) $total;
        return (float) max( -5, min( 5, ( $rate - 0.5 ) * 10 ) );
    }

    /**
     * Compute and store the weighted event score on a performance post.
     * Called whenever a performance is saved (admin or REST).
     * Returns the weighted_event_score.
     */
    function rpn_compute_and_store_weighted_score( $post_id, $raw_event_score, $event_id, $go_round, $rider_id, $event_tier, $verification_status ) {
        $field_strength     = rpn_calc_field_strength_multiplier( $event_id, $go_round, $rider_id );
        $tier_multiplier    = rpn_get_tier_modifier( $event_tier );
        $verify_multiplier  = rpn_calc_verification_multiplier( $verification_status );
        $weighted           = (float) min( 100, max( 0, $raw_event_score * $field_strength * $tier_multiplier * $verify_multiplier ) );

        update_post_meta( $post_id, 'raw_event_score',         round( (float) $raw_event_score, 2 ) );
        update_post_meta( $post_id, 'field_strength_mult',     round( $field_strength, 4 ) );
        update_post_meta( $post_id, 'weighted_event_score',    round( $weighted, 2 ) );
        update_post_meta( $post_id, 'verification_status',     $verification_status );

        return round( $weighted, 2 );
    }

    /* ========== Legacy Formulas (kept for backward compatibility) ========== */
    function rpn_calc_rpi_roughstock($avg_qualified_score, $completion_rate, $win_count) {
        $avg = (float) $avg_qualified_score;
        $cr = (float) $completion_rate;
        $wins = (int) $win_count;
        return round(($avg * $cr) + ($wins * 5), 2);
    }

    /**
     * Return the per-infraction penalty seconds for a given timed event category (Section 6).
     */
    function rpn_timed_penalty_value($event_category) {
        $map = array(
            'Barrel Racing'          => 5,
            'Pole Bending'           => 5,
            'Goat Tying'             => 5,
            'Breakaway Roping'       => 0,   // no partial penalty — either clean or no-time
            'Tie-Down Roping'        => 10,
            'Steer Wrestling'        => 10,
            'Team Roping – Header'   => 10,
            'Team Roping – Heeler'   => 10,
        );
        return isset($map[$event_category]) ? $map[$event_category] : 5;
    }

    function rpn_calc_thi_timed($benchmark, $avg_time, $completion_rate, $penalties, $penalty_weight = 2) {
        if ($avg_time <= 0) return 0;
        $bm = (float) $benchmark;
        $at = (float) $avg_time;
        $cr = (float) $completion_rate;
        $pen = (int) $penalties;
        $pw = (float) $penalty_weight;
        return round((($bm / $at) * 100 * $cr) - ($pen * $pw), 2);
    }

    /**
     * REST API: Submit performance (ride/run)
     */
    function rpn_register_performance_submit_route() {
        register_rest_route('rpn/v1', '/performances', array(
            'methods' => 'POST',
            'permission_callback' => function () {
                return current_user_can('manage_options');
            },
            'callback' => 'rpn_performance_submit_callback',
            'args' => array(
                'rider_id' => array('required' => true, 'type' => 'integer', 'sanitize_callback' => 'absint'),
                'animal_id' => array('required' => false, 'type' => 'integer', 'sanitize_callback' => 'absint'),
                'event_id' => array('required' => false, 'type' => 'integer', 'sanitize_callback' => 'absint'),
                'performance_type' => array('required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
                'event_category' => array('required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
                'performance_date' => array('required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
                'event_name' => array('required' => false, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
                'event_location' => array('required' => false, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
                'arena_condition' => array('required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
                'weather_condition' => array('required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
                'event_tier' => array('required' => true, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
                'total_rides' => array('required' => false, 'type' => 'number'),
                'qualified_rides' => array('required' => false, 'type' => 'number'),
                'avg_ride_score' => array('required' => false, 'type' => 'number'),
                'win_count' => array('required' => false, 'type' => 'number'),
                'total_runs' => array('required' => false, 'type' => 'number'),
                'clean_runs' => array('required' => false, 'type' => 'number'),
                'avg_time' => array('required' => false, 'type' => 'number'),
                'penalties' => array('required' => false, 'type' => 'number'),
                'penalty_weight' => array('required' => false, 'type' => 'number'),
                'benchmark' => array('required' => false, 'type' => 'number'),
                'pattern_size' => array('required' => false, 'type' => 'string', 'sanitize_callback' => 'sanitize_text_field'),
            ),
        ));
    }
    add_action('rest_api_init', 'rpn_register_performance_submit_route');

    function rpn_performance_submit_callback($request) {
        $type = strtolower($request->get_param('performance_type'));
        $base_score = 0;

        if ($type === 'roughstock') {
            $total = (int) $request->get_param('total_rides');
            $qualified = (int) $request->get_param('qualified_rides');
            $avg_score = (float) $request->get_param('avg_ride_score');
            $wins = (int) $request->get_param('win_count');
            $cr = $total > 0 ? $qualified / $total : 0;
            $base_score = rpn_calc_rpi_roughstock($avg_score, $cr, $wins);
        } elseif ($type === 'timed') {
            $benchmark = (float) $request->get_param('benchmark');
            $avg_time = (float) $request->get_param('avg_time');
            $total = (int) $request->get_param('total_runs');
            $clean = (int) $request->get_param('clean_runs');
            $penalties = (int) $request->get_param('penalties');
            $pw = (float) ($request->get_param('penalty_weight') ?: 2);
            $cr = $total > 0 ? $clean / $total : 0;
            $base_score = rpn_calc_thi_timed($benchmark, $avg_time, $cr, $penalties, $pw);
        } else {
            return new WP_REST_Response(array('success' => false, 'message' => 'Invalid performance_type. Use roughstock or timed.'), 400);
        }

        $arena = $request->get_param('arena_condition');
        $weather = $request->get_param('weather_condition');
        $tier = $request->get_param('event_tier');
        $adjusted = rpn_get_adjusted_score($base_score, $arena, $weather, $tier);

        $post_id = wp_insert_post(array(
            'post_type' => 'rpn_performance',
            'post_status' => 'publish',
            'post_title' => 'Performance ' . date('Y-m-d', strtotime($request->get_param('performance_date'))),
        ));
        if (is_wp_error($post_id)) {
            return new WP_REST_Response(array('success' => false, 'message' => $post_id->get_error_message()), 500);
        }

        $meta = array(
            'rider_id' => $request->get_param('rider_id'),
            'animal_id' => $request->get_param('animal_id') ?: 0,
            'event_id' => $request->get_param('event_id') ?: 0,
            'performance_type' => $type,
            'event_category' => $request->get_param('event_category'),
            'performance_date' => $request->get_param('performance_date'),
            'event_name' => $request->get_param('event_name') ?: '',
            'event_location' => $request->get_param('event_location') ?: '',
            'arena_condition' => $arena,
            'weather_condition' => $weather,
            'event_tier' => $tier,
            'base_score' => $base_score,
            'adjusted_score' => $adjusted,
        );
        foreach (array('total_rides', 'qualified_rides', 'avg_ride_score', 'win_count', 'completion_rate',
            'total_runs', 'clean_runs', 'avg_time', 'penalties', 'penalty_weight', 'benchmark', 'pattern_size') as $k) {
            $v = $request->get_param($k);
            if ($v !== null && $v !== '') $meta[$k] = $v;
        }
        foreach ($meta as $k => $v) {
            update_post_meta($post_id, $k, $v);
        }

        rpn_update_rider_index_from_performances($request->get_param('rider_id'));

        return new WP_REST_Response(array(
            'success' => true,
            'id' => $post_id,
            'base_score' => $base_score,
            'adjusted_score' => $adjusted,
        ), 201);
    }

    /**
     * Section 8 — Full RPI calculation (8-step spec).
     *
     * ROUGHSTOCK RPI (8 steps):
     *  1. Collect roughstock performances flagged use_for_rpi=true
     *  2. total_roughstock  = count of all records
     *  3. qualified_rides   = count where qualified_ride=true
     *  4. Completion Rate   = qualified_rides / total_roughstock
     *  5. qualified_adj[]   = adjusted_score for QUALIFIED rides only
     *  6. avg_qualified_adj = mean of qualified_adj (0 if none)
     *  7. win_count         = placements of 1
     *  8. RPI_rough         = (avg_qualified_adj × CR) + (wins × 5)
     *
     * TIMED THI (8 steps):
     *  1. Collect timed performances flagged use_for_rpi=true
     *  2. total_timed_runs  = count of all records
     *  3. timed_runs        = count where no_time=false (got official time)
     *  4. Completion Rate   = timed_runs / total_timed_runs
     *  5. timed_adj[]       = adjusted_score for runs with official time
     *  6. avg_timed_adj     = mean of timed_adj (0 if none)
     *  7. penalty_total     = sum of num_penalties across all timed runs
     *  8. THI               = (avg_timed_adj × CR) − (penalty_total × 0.5)
     *
     * OVERALL RPI:
     *  - Roughstock only  → RPI = RPI_rough
     *  - Timed only       → RPI = THI
     *  - Both disciplines → RPI = weighted avg (60% primary, 40% secondary)
     *    Primary = whichever discipline has more records.
     */
    function rpn_update_rider_index_from_performances( $rider_id ) {
        if ( $rider_id <= 0 ) return;

        $all_perfs = get_posts( array(
            'post_type'      => 'rpn_performance',
            'post_status'    => 'publish',
            'posts_per_page' => 500,
            'meta_query'     => array( array( 'key' => 'rider_id', 'value' => $rider_id, 'type' => 'NUMERIC' ) ),
        ) );

        $today        = new DateTime( 'now', new DateTimeZone( 'UTC' ) );
        $current_year = (int) $today->format( 'Y' );

        // ── Buckets ──────────────────────────────────────────────────────────
        $current_weighted = array(); // [ 'score' => float, 'weight' => float ]
        $current_qualified = 0;
        $current_total     = 0;
        $season_scores     = array();
        $career_scores     = array();

        foreach ( $all_perfs as $p ) {
            if ( get_post_meta( $p->ID, 'use_for_rpi', true ) === 'false' ) continue;

            $ptype       = get_post_meta( $p->ID, 'performance_type', true );
            $date_str    = get_post_meta( $p->ID, 'performance_date', true );

            // Weighted event score (new spec). Fall back to adjusted_score for old records.
            $wes = (float) get_post_meta( $p->ID, 'weighted_event_score', true );
            if ( $wes <= 0 ) {
                $wes = (float) get_post_meta( $p->ID, 'adjusted_score', true );
            }

            $is_qualified = false;
            if ( $ptype === 'roughstock' ) {
                $is_qualified = get_post_meta( $p->ID, 'qualified_ride', true ) === 'true';
            } elseif ( $ptype === 'timed' ) {
                $is_qualified = get_post_meta( $p->ID, 'no_time', true ) !== 'true';
            }

            // Career: all verified results
            $career_scores[] = $wes;

            // Parse performance date
            if ( ! $date_str ) continue;
            try {
                $event_dt = new DateTime( $date_str, new DateTimeZone( 'UTC' ) );
            } catch ( Exception $e ) {
                continue;
            }

            $days_old   = (int) $today->diff( $event_dt )->days;
            $event_year = (int) $event_dt->format( 'Y' );

            // Season: current calendar year
            if ( $event_year === $current_year ) {
                $season_scores[] = $wes;
            }

            // Current: only last 365 days
            if ( $days_old < 365 ) {
                $weight = rpn_get_time_decay_weight( $days_old );
                $current_weighted[] = array( 'score' => $wes, 'weight' => $weight );
                $current_total++;
                if ( $is_qualified ) $current_qualified++;
            }
        }

        // ── Current RPI (time-decayed + consistency) ──────────────────────
        $current_rpi = 0.0;
        if ( ! empty( $current_weighted ) ) {
            $weighted_sum = 0.0;
            $total_weight = 0.0;
            foreach ( $current_weighted as $item ) {
                $weighted_sum += $item['score'] * $item['weight'];
                $total_weight += $item['weight'];
            }
            $base_current = $total_weight > 0 ? $weighted_sum / $total_weight : 0.0;
            $consistency  = rpn_calc_consistency_adjustment( $current_qualified, $current_total );
            $current_rpi  = (float) max( 0, min( 100, round( $base_current + $consistency, 2 ) ) );
        }

        // ── Season RPI (simple average, current year) ─────────────────────
        $season_rpi = 0.0;
        if ( ! empty( $season_scores ) ) {
            $season_rpi = (float) max( 0, min( 100, round( array_sum( $season_scores ) / count( $season_scores ), 2 ) ) );
        }

        // ── Career RPI (simple average, all-time) ─────────────────────────
        $career_rpi = 0.0;
        if ( ! empty( $career_scores ) ) {
            $career_rpi = (float) max( 0, min( 100, round( array_sum( $career_scores ) / count( $career_scores ), 2 ) ) );
        }

        // ── Reliability Status ────────────────────────────────────────────
        $total_results = count( $career_scores );
        if ( $total_results >= 10 ) {
            $reliability = 'established';
        } elseif ( $total_results >= 5 ) {
            $reliability = 'emerging';
        } else {
            $reliability = 'provisional';
        }

        // ── Persist ───────────────────────────────────────────────────────
        update_post_meta( $rider_id, 'rpi',               $current_rpi ); // backward-compat alias
        update_post_meta( $rider_id, 'rpi_current',        $current_rpi );
        update_post_meta( $rider_id, 'rpi_season',         $season_rpi );
        update_post_meta( $rider_id, 'rpi_career',         $career_rpi );
        update_post_meta( $rider_id, 'reliability_status', $reliability );

        // ── Confidence Score (0–100) ───────────────────────────────────────
        // Volume component: 5 pts per performance, capped at 40
        $conf_volume = min( 40, count( $career_scores ) * 5 );
        // Verified component: % of official-verified results × 30
        $conf_verified = 0;
        $verified_count = 0;
        $most_recent_date = null;
        foreach ( $all_perfs as $p ) {
            if ( get_post_meta( $p->ID, 'verification_status', true ) === 'official' ) {
                $verified_count++;
            }
            $d = get_post_meta( $p->ID, 'performance_date', true );
            if ( $d && ( $most_recent_date === null || $d > $most_recent_date ) ) {
                $most_recent_date = $d;
            }
        }
        if ( count( $all_perfs ) > 0 ) {
            $conf_verified = (int) round( ( $verified_count / count( $all_perfs ) ) * 30 );
        }
        // Recency component: based on how recent the last performance was (max 30)
        $conf_recency = 0;
        if ( $most_recent_date ) {
            try {
                $last_dt  = new DateTime( $most_recent_date, new DateTimeZone( 'UTC' ) );
                $days_ago = (int) $today->diff( $last_dt )->days;
                if      ( $days_ago <= 30  ) $conf_recency = 30;
                elseif  ( $days_ago <= 90  ) $conf_recency = 20;
                elseif  ( $days_ago <= 180 ) $conf_recency = 10;
                elseif  ( $days_ago <= 365 ) $conf_recency = 5;
            } catch ( Exception $e ) {}
        }
        $confidence_score = (int) min( 100, $conf_volume + $conf_verified + $conf_recency );
        update_post_meta( $rider_id, 'rpi_confidence_score', $confidence_score );
    }

    /**
     * Recompute a rider's season stat totals from their rpn_performance posts.
     * Filters out re-ride originals (use_for_rpi = false) so stats are accurate.
     */
    function rpn_refresh_rider_season_stats($rider_id) {
        $all_perfs = get_posts(array(
            'post_type'      => 'rpn_performance',
            'post_status'    => 'publish',
            'posts_per_page' => 500,
            'meta_query'     => array(array('key' => 'rider_id', 'value' => $rider_id, 'type' => 'NUMERIC')),
        ));
        $total_attempts = 0; $qualified_sum = 0; $wins_sum = 0;
        foreach ($all_perfs as $ap) {
            if (get_post_meta($ap->ID, 'use_for_rpi', true) === 'false') continue;
            $ptype = get_post_meta($ap->ID, 'performance_type', true);
            if ($ptype === 'timed') {
                // Per-run timed: each record = 1 run
                $total_attempts += 1;
                $qualified_sum  += get_post_meta($ap->ID, 'clean_run', true) === 'true' ? 1 : 0;
            } else {
                // Per-ride roughstock: each record is 1 ride
                $total_attempts += 1;
                $qualified_sum  += get_post_meta($ap->ID, 'qualified_ride', true) === 'true' ? 1 : 0;
            }
            $placement = get_post_meta($ap->ID, 'placement', true);
            if ($placement !== '' && (int) $placement === 1) $wins_sum++;
        }
        update_post_meta($rider_id, 'total_rides',     $total_attempts);
        update_post_meta($rider_id, 'qualified_rides',  $qualified_sum);
        update_post_meta($rider_id, 'win_count',        $wins_sum);
        if ($total_attempts > 0) {
            update_post_meta($rider_id, 'completion_rate', round($qualified_sum / $total_attempts * 100, 1));
        }
    }

    function rpn_join_callback($request) {
        $joining_as = $request->get_param('joining_as');
        $membership_plan = $request->get_param('membership_plan');
        $product_id = (int) $request->get_param('product_id');

        // Fallback: if no product_id provided by client, resolve it from the membership_plan key.
        // This covers cases where the revenue-products API was unavailable when the form loaded.
        if ($product_id <= 0 && $membership_plan && $membership_plan !== 'rin_free' && $membership_plan !== 'basic' && class_exists('WooCommerce')) {
            $plan_slugs = rpn_wc_product_slugs();
            $plan_slug  = isset($plan_slugs[$membership_plan]) ? $plan_slugs[$membership_plan] : '';
            if ($plan_slug) {
                $plan_post = get_page_by_path($plan_slug, OBJECT, 'product');
                if ($plan_post) {
                    $plan_wc = wc_get_product($plan_post->ID);
                    if ($plan_wc) {
                        $product_id = $plan_wc->get_id();
                    }
                }
            }
        }

        $first_name = $request->get_param('first_name');
        $last_name = $request->get_param('last_name');
        $email = $request->get_param('email');
        $organization_name = $request->get_param('organization_name') ?: '';
        $producer_license_id = $request->get_param('producer_license_id') ?: '';

        if (!is_email($email)) {
            return new WP_REST_Response(array('success' => false, 'message' => 'Invalid email address.'), 400);
        }

        $login_url = apply_filters('rpn_login_url', rpn_get_login_url());
        $user_created = false;
        $password_sent = false;

        $create_roles = array('rider', 'producer', 'contractor', 'pickup_team');

        if (in_array($joining_as, $create_roles, true)) {
            $user = get_user_by('email', $email);
            if (!$user) {
                $password = wp_generate_password(12, true, true);
                $username = sanitize_user(str_replace(array('.', '+'), '', $email), true);
                if (username_exists($username)) {
                    $username = $username . '_' . wp_rand(100, 999);
                }
                $user_id = wp_create_user($username, $password, $email);
                if (is_wp_error($user_id)) {
                    return new WP_REST_Response(array(
                        'success' => false,
                        'message' => 'Could not create account: ' . $user_id->get_error_message(),
                    ), 400);
                }
                if (!is_wp_error($user_id)) {
                    $user = get_user_by('id', $user_id);
                    wp_update_user(array(
                        'ID' => $user_id,
                        'first_name' => $first_name,
                        'last_name' => $last_name,
                        'display_name' => trim($first_name . ' ' . $last_name) ?: $username,
                    ));
                    if ($joining_as === 'rider') {
                        $rider_name = trim($first_name . ' ' . $last_name) ?: $username;
                        $rider_slug = sanitize_title($rider_name);
                        if (get_page_by_path($rider_slug, OBJECT, 'rider')) {
                            $rider_slug = $rider_slug . '-' . $user_id;
                        }
                        $rider_id = wp_insert_post(array(
                            'post_type'   => 'rider',
                            'post_title'  => $rider_name,
                            'post_name'   => $rider_slug,
                            'post_status' => 'publish',
                            'post_author' => $user_id,
                        ), true);
                        if (!is_wp_error($rider_id) && $rider_id > 0) {
                            update_user_meta($user_id, 'rpn_linked_rider_id', $rider_id);
                            update_post_meta($rider_id, 'rpn_linked_user_id', $user_id);
                        }
                    }
                    if ($joining_as === 'contractor') {
                        $contractor_name = trim($first_name . ' ' . $last_name) ?: $username;
                        $contractor_slug = sanitize_title($contractor_name);
                        if (get_page_by_path($contractor_slug, OBJECT, 'rpn_contractor')) {
                            $contractor_slug = $contractor_slug . '-' . $user_id;
                        }
                        $contractor_id = wp_insert_post(array(
                            'post_type'   => 'rpn_contractor',
                            'post_title'  => $contractor_name,
                            'post_name'   => $contractor_slug,
                            'post_status' => 'publish',
                            'post_author' => $user_id,
                        ), true);
                        if (!is_wp_error($contractor_id) && $contractor_id > 0) {
                            update_user_meta($user_id, 'rpn_linked_contractor_id', $contractor_id);
                            update_post_meta($contractor_id, 'rpn_linked_user_id', $user_id);
                        }
                    }
                    if ($joining_as === 'producer') {
                        $producer_name = $organization_name ?: trim($first_name . ' ' . $last_name) ?: $username;
                        $producer_slug = sanitize_title($producer_name);
                        if (get_page_by_path($producer_slug, OBJECT, 'rpn_producer')) {
                            $producer_slug = $producer_slug . '-' . $user_id;
                        }
                        $producer_id = wp_insert_post(array(
                            'post_type'   => 'rpn_producer',
                            'post_title'  => $producer_name,
                            'post_name'   => $producer_slug,
                            'post_status' => 'publish',
                            'post_author' => $user_id,
                        ), true);
                        if (!is_wp_error($producer_id) && $producer_id > 0) {
                            update_user_meta($user_id, 'rpn_linked_producer_id', $producer_id);
                            update_post_meta($producer_id, 'rpn_linked_user_id', $user_id);
                        }
                    }
                    if ($joining_as === 'pickup_team') {
                        $pt_name = trim($first_name . ' ' . $last_name) ?: $username;
                        $pt_slug = sanitize_title($pt_name);
                        if (get_page_by_path($pt_slug, OBJECT, 'pickup_team')) {
                            $pt_slug = $pt_slug . '-' . $user_id;
                        }
                        $pt_id = wp_insert_post(array(
                            'post_type'   => 'pickup_team',
                            'post_title'  => $pt_name,
                            'post_name'   => $pt_slug,
                            'post_status' => 'publish',
                            'post_author' => $user_id,
                        ), true);
                        if (!is_wp_error($pt_id) && $pt_id > 0) {
                            update_user_meta($user_id, 'rpn_linked_pickup_team_id', $pt_id);
                            update_post_meta($pt_id, 'rpn_linked_user_id', $user_id);
                        }
                    }
                    $role_map = array(
                        'rider'       => 'rpn_rider',
                        'contractor'  => 'rpn_contractor',
                        'producer'    => 'rpn_producer',
                        'pickup_team' => 'rpn_pickup_team',
                    );
                    $role = isset($role_map[$joining_as]) ? $role_map[$joining_as] : 'subscriber';
                    $user->set_role($role);
                    update_user_meta($user_id, 'rpn_joining_as', $joining_as);

                    // Generate RIN ID (e.g. RIN-A3F7C2)
                    $rin_id = rpn_generate_rin_id();
                    update_user_meta($user_id, 'rpn_rin_id', $rin_id);

                    // Set membership tier from plan key
                    $plan_tier_map = array(
                        'rin_free'              => 'free',
                        'basic'                 => 'free',
                        'rin_competitor'        => 'competitor',
                        'rin_competitor_bundle' => 'competitor', // Team Roping Partner Bundle — both accounts get competitor tier
                        'rin_competitor_student'=> 'competitor', // Youth/Student rate — same competitor tier
                        'premium_membership'    => 'competitor',
                        'rin_contractor'        => 'contractor',
                        'rin_organizer'         => 'organizer',
                        'rin_enterprise'        => 'enterprise',
                        // Legacy slugs kept for backward compatibility
                        'rin_elite'             => 'contractor',
                        'rin_producer'          => 'organizer',
                        'pro'                   => 'contractor',
                        'pro-membership'        => 'contractor',
                    );
                    $tier = isset($plan_tier_map[$membership_plan]) ? $plan_tier_map[$membership_plan] : 'free';

                    // Contractor and producer roles get a 3-month free trial — no immediate payment required.
                    $is_trial_role = in_array($joining_as, array('contractor', 'producer'), true);
                    if ($is_trial_role) {
                        // Server-side enforcement: set the correct tier for the role regardless of submitted plan.
                        $tier = ($joining_as === 'producer') ? 'organizer' : 'contractor';
                    }

                    // Tier activation: free = immediate; trial roles = granted now; paid = after WooCommerce payment.
                    if ($tier === 'free' || !class_exists('WooCommerce') || $is_trial_role) {
                        update_user_meta($user_id, 'rpn_membership_tier', $tier);
                        if ($is_trial_role) {
                            update_user_meta($user_id, 'rpn_trial_expires', date('Y-m-d', strtotime('+3 months')));
                            update_user_meta($user_id, 'rpn_trial_tier', $tier);
                        }
                    } else {
                        update_user_meta($user_id, 'rpn_membership_tier', 'free'); // upgraded after payment
                        update_user_meta($user_id, 'rpn_pending_tier', $tier);
                    }

                    $user_created = true;

                    // Email verification — user cannot log in until they click the link below.
                    $verify_token = bin2hex(random_bytes(20));
                    update_user_meta($user_id, 'rpn_email_verify_token', $verify_token);
                    update_user_meta($user_id, 'rpn_email_verified', '0');
                    $verify_url = rpn_get_react_app_url() . '/verify-email?token=' . rawurlencode($verify_token);

                    $checkout_url = '';
                    if (!$is_trial_role && $product_id > 0 && class_exists('WooCommerce')) {
                        $checkout_url = wc_get_checkout_url();
                        $checkout_url = add_query_arg('add-to-cart', $product_id, $checkout_url);
                        if (defined('RPN_CHECKOUT_BASE_URL') && RPN_CHECKOUT_BASE_URL) {
                            $base = rtrim(RPN_CHECKOUT_BASE_URL, '/');
                            $parsed = wp_parse_url($checkout_url);
                            $query = isset($parsed['query']) ? '?' . $parsed['query'] : '';
                            $checkout_url = $base . '/checkout/' . $query;
                        } elseif (strpos($checkout_url, 'localhost') !== false) {
                            $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
                            $host = isset($_SERVER['HTTP_HOST']) ? wp_unslash($_SERVER['HTTP_HOST']) : '';
                            if ($host && strpos($host, 'localhost') === false) {
                                $req = isset($_SERVER['REQUEST_URI']) ? wp_unslash($_SERVER['REQUEST_URI']) : '';
                                $wp_path = preg_match('#^(/[^/]+)/wp-json/#', $req, $m) ? $m[1] : '/wp';
                                $checkout_url = $scheme . '://' . $host . $wp_path . '/checkout/?add-to-cart=' . $product_id;
                            }
                        }
                    }

                    // Wrap the checkout URL with a one-time auto-login token.
                    // The React app redirects the user here; rpn_handle_autologin() (see top of file)
                    // logs them in automatically and forwards them to WooCommerce checkout.
                    if ($checkout_url) {
                        $autologin_token = wp_generate_password(32, false, false);
                        set_transient('rpn_autologin_' . $autologin_token, $user_id, 15 * MINUTE_IN_SECONDS);
                        $checkout_url = add_query_arg(array(
                            'rpn_autologin' => $autologin_token,
                            'redir'         => rawurlencode($checkout_url),
                        ), home_url('/'));
                    }

                    $rin_headers = array(
                        'Content-Type: text/html; charset=UTF-8',
                        'From: RIN Rodeo <info@rinrodeo.com>',
                    );
                    $subj = 'Welcome to RIN — Your Account Is Ready';
                    $checkout_block = '';
                    if ($is_trial_role) {
                        $trial_label  = ($tier === 'organizer') ? 'Event Organizer' : 'Stock Contractor';
                        $trial_price  = ($tier === 'organizer') ? '$79.99/mo' : '$29.99/mo';
                        $trial_expire = date('F j, Y', strtotime('+3 months'));
                        $checkout_block = '
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                          <tr><td style="background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #16a34a;border-radius:8px;padding:16px 20px;">
                            <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:0.05em;">3-Month Free Trial Active</p>
                            <p style="margin:0 0 8px;font-size:14px;color:#374151;">Your <strong>' . esc_html($trial_label) . '</strong> plan is active and free until <strong>' . esc_html($trial_expire) . '</strong>.</p>
                            <p style="margin:0;font-size:13px;color:#6B7280;">After your trial, the standard rate of ' . esc_html($trial_price) . ' applies. We\'ll reach out before billing begins.</p>
                          </td></tr>
                        </table>';
                    } elseif ($checkout_url) {
                        $checkout_block = '
                        <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
                          <tr><td style="background:#fff7ed;border:1px solid #fed7aa;border-left:4px solid #f97316;border-radius:8px;padding:16px 20px;">
                            <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#c2410c;text-transform:uppercase;letter-spacing:0.05em;">Complete Your Membership</p>
                            <p style="margin:0 0 12px;font-size:14px;color:#374151;">Your account is ready — finish setting up your membership to unlock all features.</p>
                            <a href="' . esc_url($checkout_url) . '" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:10px 24px;border-radius:6px;">Complete Payment →</a>
                          </td></tr>
                        </table>';
                    }
                    $msg = '<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:40px 16px;">
  <tr><td align="center">
    <table width="100%" style="max-width:560px;" cellpadding="0" cellspacing="0">

      <!-- Header -->
      <tr><td style="background:#111827;border-radius:12px 12px 0 0;padding:28px 40px;text-align:center;">
        <p style="margin:0;color:#fff;font-size:24px;font-weight:900;letter-spacing:-1px;">RIN</p>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.5);font-size:11px;letter-spacing:2px;text-transform:uppercase;">Rodeo Information Network</p>
      </td></tr>
      <tr><td style="background:#FD0000;height:4px;"></td></tr>

      <!-- Body -->
      <tr><td style="background:#fff;padding:36px 40px;">
        <p style="margin:0 0 8px;font-size:22px;font-weight:700;color:#111827;">Welcome, ' . esc_html($first_name) . '!</p>
        <p style="margin:0 0 28px;font-size:15px;color:#4B5563;line-height:1.7;">Your RIN account has been created. Confirm your email address to activate it, then use the credentials below to log in and start building your rodeo performance profile.</p>

        <!-- Verify CTA -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">
          <tr><td style="background:#f0fdf4;border:1px solid #bbf7d0;border-left:4px solid #16a34a;border-radius:8px;padding:16px 20px;">
            <p style="margin:0 0 10px;font-size:13px;font-weight:700;color:#15803d;text-transform:uppercase;letter-spacing:0.05em;">Step 1 — Confirm Your Email</p>
            <p style="margin:0 0 12px;font-size:14px;color:#374151;">You must verify your email before you can log in.</p>
            <a href="' . esc_url($verify_url) . '" style="display:inline-block;background:#16a34a;color:#fff;text-decoration:none;font-size:14px;font-weight:700;padding:10px 24px;border-radius:6px;">Verify Email Address &rarr;</a>
          </td></tr>
        </table>

        <!-- Credentials -->
        <table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;border:1px solid #E5E7EB;border-left:4px solid #FD0000;border-radius:8px;margin:0 0 28px;">
          <tr><td style="padding:20px 24px;">
            <p style="margin:0 0 12px;font-size:12px;font-weight:700;color:#111827;text-transform:uppercase;letter-spacing:0.08em;">Step 2 — Your Login Details</p>
            <p style="margin:0 0 8px;font-size:14px;color:#374151;"><strong>Email:</strong>&nbsp;&nbsp;' . esc_html($email) . '</p>
            <p style="margin:0;font-size:14px;color:#374151;"><strong>Temporary Password:</strong>&nbsp;&nbsp;<code style="background:#e5e7eb;padding:2px 8px;border-radius:4px;font-size:13px;">' . esc_html($password) . '</code></p>
          </td></tr>
        </table>

        ' . $checkout_block . '

        <!-- Login CTA -->
        <table cellpadding="0" cellspacing="0" style="margin:0 0 28px;">
          <tr><td style="background:#FD0000;border-radius:8px;">
            <a href="' . esc_url($login_url) . '" style="display:inline-block;padding:14px 36px;color:#ffffff;text-decoration:none;font-size:15px;font-weight:700;">Log In to RIN &rarr;</a>
          </td></tr>
        </table>

        <p style="margin:0 0 8px;font-size:13px;color:#6B7280;line-height:1.65;">We recommend changing your password after your first login.</p>
        <p style="margin:0;font-size:13px;color:#6B7280;line-height:1.65;">Questions? Email us at <a href="mailto:info@rinrodeo.com" style="color:#FD0000;text-decoration:none;">info@rinrodeo.com</a></p>
      </td></tr>

      <!-- Footer -->
      <tr><td style="background:#F9FAFB;border-top:1px solid #E5E7EB;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;">
        <p style="margin:0;font-size:12px;color:#9CA3AF;">&copy; 2026 Rodeo Information Network Inc. &middot; <a href="https://rinrodeo.com" style="color:#9CA3AF;text-decoration:none;">rinrodeo.com</a></p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>';
                    $password_sent = wp_mail($email, $subj, $msg, $rin_headers);
                }
            } else {
                // Email already exists in WordPress — block re-registration and direct to login.
                $current_roles = (array) $user->roles;
                $has_rpn_role  = (bool) array_intersect($current_roles, array('rpn_rider', 'rpn_contractor', 'rpn_producer', 'rpn_pickup_team'));
                $current_tier  = get_user_meta($user->ID, 'rpn_membership_tier', true);

                if ($has_rpn_role || $current_tier) {
                    // They are already a registered RIN member.
                    if (in_array('rpn_rider', $current_roles, true) && in_array($joining_as, array('contractor', 'producer', 'pickup_team'), true)) {
                        return new WP_REST_Response(array(
                            'success' => false,
                            'message' => 'You already have a rider account with this email address. Please log in to your dashboard to upgrade your membership.',
                        ), 409);
                    }
                    return new WP_REST_Response(array(
                        'success' => false,
                        'message' => 'An account with this email address is already registered. Please log in to access your dashboard.',
                    ), 409);
                }

                // They exist in WordPress (e.g. old WP subscriber) but have no RIN role yet.
                // Grant the requested role and trial — skip CPT creation to avoid duplicates.
                $user_id       = $user->ID;
                $is_trial_role = in_array($joining_as, array('contractor', 'producer'), true);
                $trial_tier    = ($joining_as === 'producer') ? 'organizer' : (($joining_as === 'contractor') ? 'contractor' : 'free');
                $new_role      = ($joining_as === 'rider') ? 'rpn_rider' : (($joining_as === 'contractor') ? 'rpn_contractor' : (($joining_as === 'producer') ? 'rpn_producer' : 'subscriber'));

                $user->set_role($new_role);
                update_user_meta($user_id, 'rpn_joining_as', $joining_as);

                if (!get_user_meta($user_id, 'rpn_rin_id', true)) {
                    update_user_meta($user_id, 'rpn_rin_id', rpn_generate_rin_id());
                }

                if ($is_trial_role) {
                    update_user_meta($user_id, 'rpn_membership_tier', $trial_tier);
                    update_user_meta($user_id, 'rpn_trial_tier', $trial_tier);
                    if (!get_user_meta($user_id, 'rpn_trial_expires', true)) {
                        update_user_meta($user_id, 'rpn_trial_expires', date('Y-m-d', strtotime('+3 months')));
                    }
                } elseif ($joining_as === 'rider') {
                    if (!get_user_meta($user_id, 'rpn_membership_tier', true)) {
                        update_user_meta($user_id, 'rpn_membership_tier', 'free');
                    }
                }

                $user_created = true;
            }
        }

        // ── Admin notification — only sent on successful new-user creation ─────
        if ($user_created) {
            $admin_to      = 'info@rinrodeo.com';
            $admin_subject = '[RIN] New registration: ' . $first_name . ' ' . $last_name;

            $role_label = array(
                'rider'       => 'Rider / Competitor',
                'producer'    => 'Producer (Event Organizer)',
                'contractor'  => 'Stock Contractor',
                'pickup_team' => 'Pickup Team',
            );
            $plan_label = array(
                'rin_free'               => 'Fan Pass (Free)',
                'rin_competitor'         => 'Competitor Pro — Monthly ($9.99)',
                'rin_competitor_yearly'  => 'Competitor Pro — Yearly ($89)',
                'rin_contractor'         => 'Stock Contractor — Monthly ($29.99)',
                'rin_contractor_yearly'  => 'Stock Contractor — Yearly ($249)',
                'rin_organizer'          => 'Event Organizer — Monthly ($79.99)',
                'rin_organizer_yearly'   => 'Event Organizer — Yearly ($649)',
                'rin_competitor_bundle'  => 'Team Roping Partner Bundle ($149/yr)',
                'rin_competitor_student' => 'Student Rate — Competitor Pro ($39/yr)',
            );
            $display_role = isset($role_label[$joining_as]) ? $role_label[$joining_as] : ucfirst($joining_as);
            $display_plan = isset($plan_label[$membership_plan]) ? $plan_label[$membership_plan] : $membership_plan;
            $display_org  = $organization_name ? esc_html($organization_name) : '—';
            $display_lic  = $producer_license_id ? esc_html($producer_license_id) : '—';
            $email_status = $password_sent ? '<span style="color:#16a34a;font-weight:700;">Sent ✓</span>' : '<span style="color:#dc2626;font-weight:700;">Failed ✗</span>';
            $rin_id_val   = get_user_meta(isset($user_id) ? $user_id : 0, 'rpn_rin_id', true);
            $rin_id_display = $rin_id_val ?: '—';

            $admin_body = '<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background:#F9FAFB;font-family:Arial,Helvetica,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#F9FAFB;padding:32px 16px;">
  <tr><td align="center">
    <table width="100%" style="max-width:540px;" cellpadding="0" cellspacing="0">

      <tr><td style="background:#111827;border-radius:10px 10px 0 0;padding:22px 32px;text-align:center;">
        <p style="margin:0;color:#fff;font-size:20px;font-weight:900;letter-spacing:-0.5px;">RIN Admin</p>
        <p style="margin:4px 0 0;color:rgba(255,255,255,0.45);font-size:10px;letter-spacing:2px;text-transform:uppercase;">New Member Registration</p>
      </td></tr>
      <tr><td style="background:#FD0000;height:3px;"></td></tr>

      <tr><td style="background:#fff;padding:28px 32px;">
        <p style="margin:0 0 20px;font-size:18px;font-weight:700;color:#111827;">New account registered</p>

        <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #E5E7EB;border-radius:8px;overflow:hidden;">
          <tr style="background:#F9FAFB;"><td style="padding:10px 16px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;width:38%;">Field</td><td style="padding:10px 16px;font-size:12px;font-weight:700;color:#6B7280;text-transform:uppercase;letter-spacing:0.06em;">Value</td></tr>
          <tr style="border-top:1px solid #E5E7EB;"><td style="padding:10px 16px;font-size:13px;color:#6B7280;">RIN ID</td><td style="padding:10px 16px;font-size:13px;font-weight:700;color:#111827;">' . esc_html($rin_id_display) . '</td></tr>
          <tr style="border-top:1px solid #E5E7EB;background:#FAFAFA;"><td style="padding:10px 16px;font-size:13px;color:#6B7280;">Name</td><td style="padding:10px 16px;font-size:13px;color:#111827;">' . esc_html($first_name . ' ' . $last_name) . '</td></tr>
          <tr style="border-top:1px solid #E5E7EB;"><td style="padding:10px 16px;font-size:13px;color:#6B7280;">Email</td><td style="padding:10px 16px;font-size:13px;color:#111827;"><a href="mailto:' . esc_attr($email) . '" style="color:#FD0000;text-decoration:none;">' . esc_html($email) . '</a></td></tr>
          <tr style="border-top:1px solid #E5E7EB;background:#FAFAFA;"><td style="padding:10px 16px;font-size:13px;color:#6B7280;">Joining As</td><td style="padding:10px 16px;font-size:13px;color:#111827;">' . esc_html($display_role) . '</td></tr>
          <tr style="border-top:1px solid #E5E7EB;"><td style="padding:10px 16px;font-size:13px;color:#6B7280;">Membership Plan</td><td style="padding:10px 16px;font-size:13px;color:#111827;">' . esc_html($display_plan) . '</td></tr>
          <tr style="border-top:1px solid #E5E7EB;background:#FAFAFA;"><td style="padding:10px 16px;font-size:13px;color:#6B7280;">Organization</td><td style="padding:10px 16px;font-size:13px;color:#111827;">' . $display_org . '</td></tr>
          <tr style="border-top:1px solid #E5E7EB;"><td style="padding:10px 16px;font-size:13px;color:#6B7280;">License / ID</td><td style="padding:10px 16px;font-size:13px;color:#111827;">' . $display_lic . '</td></tr>
          <tr style="border-top:1px solid #E5E7EB;background:#FAFAFA;"><td style="padding:10px 16px;font-size:13px;color:#6B7280;">Welcome Email</td><td style="padding:10px 16px;font-size:13px;">' . $email_status . '</td></tr>
          <tr style="border-top:1px solid #E5E7EB;"><td style="padding:10px 16px;font-size:13px;color:#6B7280;">Registered At</td><td style="padding:10px 16px;font-size:13px;color:#111827;">' . date('F j, Y — g:i A T') . '</td></tr>
        </table>

        <p style="margin:20px 0 0;font-size:12px;color:#9CA3AF;">This is an automated notification from the RIN registration system.</p>
      </td></tr>

      <tr><td style="background:#F9FAFB;border-top:1px solid #E5E7EB;border-radius:0 0 10px 10px;padding:16px 32px;text-align:center;">
        <p style="margin:0;font-size:11px;color:#9CA3AF;">&copy; ' . date('Y') . ' Rodeo Identification Network</p>
      </td></tr>

    </table>
  </td></tr>
</table>
</body>
</html>';

            $admin_headers = array('Content-Type: text/html; charset=UTF-8', 'From: RIN System <info@rinrodeo.com>');
            wp_mail($admin_to, $admin_subject, $admin_body, $admin_headers);
        }

        $message = $user_created
            ? ($password_sent ? 'Account created. Check your email for your password and login link.' : 'Account created. Contact us if you did not receive the password email.')
            : 'Thank you. Your registration has been submitted.';
        return new WP_REST_Response(array(
            'success'      => true,
            'message'      => $message,
            'checkout_url' => isset($checkout_url) && $checkout_url ? $checkout_url : null,
        ), 200);
    }

    function rpn_get_login_url() {
        return rpn_get_react_app_url() . '/login';
    }


    /**
     * Get option field (FAQ, reviews, top riders, plans) from wp_options.
     */
    function rpn_get_acf_option($field_name) {
        $option_keys = array('options_' . $field_name, 'rpn_homepage_' . $field_name, $field_name);
        foreach ($option_keys as $key) {
            $val = get_option($key, null);
            if ($val !== null && $val !== false && $val !== '') {
                // Decode JSON strings saved by the admin settings textarea fields
                if (is_string($val)) {
                    $decoded = json_decode($val, true);
                    if (json_last_error() === JSON_ERROR_NONE && is_array($decoded)) {
                        return $decoded;
                    }
                }
                return $val;
            }
        }
        return null;
    }

    function rpn_homepage_callback() {
        $today = date('Y-m-d');

        // Hero fields live on the homepage (front page) post — read via ACF get_field()
        $front_id = (int) get_option('page_on_front');
        if ( function_exists('get_field') && $front_id ) {
            $hero = rpn_normalize_hero(array(
                'rpn_hero_title'                 => get_field('rpn_hero_title',                 $front_id),
                'rpn_hero_subtitle'              => get_field('rpn_hero_subtitle',              $front_id),
                'rpn_hero_background_image'      => get_field('rpn_hero_background_image',      $front_id),
                'rpn_hero_primary_button_text'   => get_field('rpn_hero_primary_button_text',   $front_id),
                'rpn_hero_primary_button_link'   => get_field('rpn_hero_primary_button_link',   $front_id),
                'rpn_hero_secondary_button_text' => get_field('rpn_hero_secondary_button_text', $front_id),
                'rpn_hero_secondary_button_link' => get_field('rpn_hero_secondary_button_link', $front_id),
            ));
        } else {
            $hero = array();
        }

        // Options-page fields — read via ACF get_field( $key, 'option' )
        if ( function_exists('get_field') ) {
            $faq_raw        = get_field('rpn_faq_items',          'option');
            $reviews_raw    = get_field('rpn_reviews',            'option');
            $top_riders_raw = get_field('rpn_top_riders',         'option');
            $plans_raw      = get_field('rpn_membership_plans',   'option');
        } else {
            $faq_raw        = null;
            $reviews_raw    = null;
            $top_riders_raw = null;
            $plans_raw      = null;
        }

        $faq           = rpn_normalize_faq($faq_raw);
        $reviews       = rpn_normalize_reviews($reviews_raw);
        $top_rider_ids = rpn_normalize_top_rider_ids($top_riders_raw);
        $plans         = rpn_normalize_plans($plans_raw);

        $upcoming = rpn_get_events(array('after' => $today, 'per_page' => 5));
        $recent = rpn_get_events(array('before' => $today, 'per_page' => 5));

        $top_riders = array();
        if (!empty($top_rider_ids)) {
            $ids = is_array($top_rider_ids) ? $top_rider_ids : array_map('intval', explode(',', $top_rider_ids));
            $q = new WP_Query(array('post_type' => 'rider', 'post__in' => $ids, 'posts_per_page' => count($ids), 'orderby' => 'post__in', 'post_status' => 'publish'));
            foreach ($q->posts as $p) {
                $top_riders[] = rpn_format_rider_for_rest($p);
            }
        }

        return array(
            'hero' => $hero ?: array(),
            'faq' => $faq ?: array(),
            'reviews' => $reviews ?: array(),
            'top_riders' => $top_riders,
            'top_rider_ids' => $top_rider_ids ?: array(),
            'upcoming_events' => $upcoming,
            'recent_events' => $recent,
            'membership_plans' => $plans ?: array(),
        );
    }

    function rpn_normalize_hero($raw) {
        if ($raw === null || $raw === false || !is_array($raw)) return array();
        $row = (isset($raw[0]) && is_array($raw[0])) ? $raw[0] : $raw;

        $get = function ($keys) use ($row) {
            foreach ((array) $keys as $key) {
                if (isset($row[$key]) && $row[$key] !== '' && $row[$key] !== null) return $row[$key];
            }
            return '';
        };

        $bg = $get(array('rpn_hero_background_image', 'hero_background_image', 'background_image'));
        $img_url = '';
        if (is_string($bg) && $bg !== '') $img_url = $bg;
        elseif (is_array($bg) && !empty($bg['url'])) $img_url = $bg['url'];
        elseif (is_object($bg) && !empty($bg->url)) $img_url = $bg->url;
        elseif (is_numeric($bg)) $img_url = (string) wp_get_attachment_image_url($bg, 'full');

        return array(
            'title' => (string) $get(array('rpn_hero_title', 'hero_title', 'title')),
            'subtitle' => (string) $get(array('rpn_hero_subtitle', 'hero_subtitle', 'subtitle')),
            'background_image_url' => $img_url,
            'primary_button_text' => (string) $get(array('rpn_hero_primary_button_text', 'hero_primary_button_text', 'primary_button_text')),
            'primary_button_link' => (string) $get(array('rpn_hero_primary_button_link', 'hero_primary_button_link', 'primary_button_link')),
            'secondary_button_text' => (string) $get(array('rpn_hero_secondary_button_text', 'hero_secondary_button_text', 'secondary_button_text')),
            'secondary_button_link' => (string) $get(array('rpn_hero_secondary_button_link', 'hero_secondary_button_link', 'secondary_button_link')),
        );
    }




    function rpn_normalize_faq($raw) {
        if (!is_array($raw)) return array();
        $out = array();
        foreach ($raw as $row) {
            $q = isset($row['rpn_faq_question']) ? $row['rpn_faq_question'] : (isset($row['question']) ? $row['question'] : (isset($row['faq_question']) ? $row['faq_question'] : ''));
            $a = isset($row['rpn_faq_answer']) ? $row['rpn_faq_answer'] : (isset($row['answer']) ? $row['answer'] : (isset($row['faq_answer']) ? $row['faq_answer'] : ''));
            if ($q || $a) $out[] = array('question' => $q, 'answer' => $a);
        }
        return $out;
    }

    function rpn_normalize_reviews($raw) {
        if (!is_array($raw)) return array();
        $out = array();
        foreach ($raw as $row) {
            $img = isset($row['rpn_review_image']) ? $row['rpn_review_image'] : (isset($row['review_image']) ? $row['review_image'] : null);
            $img_url = '';
            if (is_string($img) && $img !== '') $img_url = $img;
            elseif (is_array($img) && !empty($img['url'])) $img_url = $img['url'];
            elseif (is_numeric($img)) $img_url = (string) wp_get_attachment_image_url($img, 'medium');
            $out[] = array(
                'reviewer_name' => isset($row['rpn_reviewer_name']) ? $row['rpn_reviewer_name'] : (isset($row['reviewer_name']) ? $row['reviewer_name'] : ''),
                'review_text' => isset($row['rpn_review_text']) ? $row['rpn_review_text'] : (isset($row['review_text']) ? $row['review_text'] : ''),
                'rating' => isset($row['rpn_review_rating']) ? (int) $row['rpn_review_rating'] : (isset($row['rating']) ? (int) $row['rating'] : (isset($row['review_rating']) ? (int) $row['review_rating'] : 5)),
                'image_url' => $img_url,
            );
        }
        return $out;
    }

    function rpn_normalize_top_rider_ids($raw) {
        if (is_array($raw)) {
            $ids = array();
            foreach ($raw as $item) {
                if (is_object($item) && isset($item->ID)) $ids[] = (int) $item->ID;
                elseif (is_numeric($item)) $ids[] = (int) $item;
            }
            return $ids;
        }
        if (is_string($raw)) return array_map('intval', array_filter(explode(',', $raw)));
        return array();
    }

    function rpn_normalize_plans($raw) {
        if (!is_array($raw)) return array();
        $out = array();
        foreach ($raw as $row) {
            $features = isset($row['rpn_plan_features']) ? $row['rpn_plan_features'] : (isset($row['features']) ? $row['features'] : '');
            if (is_string($features)) $features = array_filter(array_map('trim', explode("\n", $features)));
            $out[] = array(
                'name' => isset($row['rpn_plan_name']) ? $row['rpn_plan_name'] : (isset($row['name']) ? $row['name'] : ''),
                'price' => isset($row['rpn_plan_price']) ? $row['rpn_plan_price'] : (isset($row['price']) ? $row['price'] : ''),
                'interval' => isset($row['rpn_plan_interval']) ? $row['rpn_plan_interval'] : (isset($row['interval']) ? $row['interval'] : ''),
                'features' => is_array($features) ? $features : array($features),
                'button_text' => isset($row['rpn_plan_button_text']) ? $row['rpn_plan_button_text'] : (isset($row['button_text']) ? $row['button_text'] : 'Sign Up'),
                'button_link' => isset($row['rpn_plan_button_link']) ? $row['rpn_plan_button_link'] : (isset($row['button_link']) ? $row['button_link'] : '#'),
                'highlighted' => !empty($row['rpn_plan_highlighted']) || !empty($row['highlighted']),
            );
        }
        return $out;
    }

    function rpn_get_events($args) {
        $after = isset($args['after']) ? $args['after'] : null;
        $before = isset($args['before']) ? $args['before'] : null;
        $per_page = isset($args['per_page']) ? (int) $args['per_page'] : 5;
        $query_args = array(
            'post_type' => 'rpn_event',
            'posts_per_page' => $per_page,
            'post_status' => 'publish',
            'meta_key' => 'event_date',
            'orderby' => 'meta_value',
            'order' => $after ? 'ASC' : 'DESC',
            'meta_query' => array(array('key' => 'event_date', 'compare' => 'EXISTS')),
        );
        if ($after) $query_args['meta_query'][] = array('key' => 'event_date', 'value' => $after, 'compare' => '>=');
        if ($before) $query_args['meta_query'][] = array('key' => 'event_date', 'value' => $before, 'compare' => '<');
        $query = new WP_Query($query_args);
        $events = array();
        foreach ($query->posts as $p) {
            $events[] = rpn_format_event_for_rest($p);
        }
        return $events;
    }

    function rpn_format_rider_for_rest($post) {
        $id = $post->ID;
        return array(
            'id' => $id,
            'slug' => $post->post_name,
            'title' => $post->post_title,
            'rpi' => get_post_meta($id, 'rpi', true) !== '' ? (float) get_post_meta($id, 'rpi', true) : null,
            'state' => get_post_meta($id, 'state', true),
            'city' => get_post_meta($id, 'city', true),
            'image_url' => get_the_post_thumbnail_url($id, 'medium') ?: null,
        );
    }

    function rpn_format_event_for_rest($post) {
        $id = $post->ID;
        $arr = array(
            'id' => $id,
            'slug' => $post->post_name,
            'title' => $post->post_title,
            'event_date' => get_post_meta($id, 'event_date', true),
            'event_end_date' => get_post_meta($id, 'event_end_date', true),
            'venue' => get_post_meta($id, 'venue', true),
            'city' => get_post_meta($id, 'city', true),
            'state' => get_post_meta($id, 'state', true),
            'event_tier' => get_post_meta($id, 'event_tier', true),
            'arena_condition' => get_post_meta($id, 'arena_condition', true),
            'weather_condition' => get_post_meta($id, 'weather_condition', true),
            'season' => get_post_meta($id, 'season', true),
            'image_url' => get_the_post_thumbnail_url($id, 'medium') ?: null,
        );
        if (function_exists('get_field')) {
            $arr['event_results'] = rpn_normalize_event_results(get_field('rpn_event_results', $id));
            $arr['round_1_results'] = rpn_normalize_round_results(get_field('rpn_round_1_results', $id));
            $arr['round_2_results'] = rpn_normalize_round_results(get_field('rpn_round_2_results', $id));
            $arr['championship_round_results'] = rpn_normalize_round_results(get_field('rpn_championship_round_results', $id));
        } else {
            $arr['event_results'] = array();
            $arr['round_1_results'] = array();
            $arr['round_2_results'] = array();
            $arr['championship_round_results'] = array();
        }
        return $arr;
    }

    /**
     * Get post ID from ACF relationship value.
     * ACF can return: single ID, single object, single array with ID, or array of IDs/objects (multi-select).
     */
    function rpn_acf_post_id($value) {
        if ($value === null || $value === '') return 0;
        if (is_numeric($value)) return (int) $value;
        if (is_object($value) && isset($value->ID)) return (int) $value->ID;
        if (is_array($value)) {
            if (isset($value['ID'])) return (int) $value['ID'];
            if (isset($value['id'])) return (int) $value['id'];
            // Indexed array (multi-select): [53], [WP_Post], etc. – use first element
            $first = reset($value);
            if ($first !== false) return rpn_acf_post_id($first);
        }
        return 0;
    }

    function rpn_normalize_event_results($rows) {
        if (!is_array($rows)) return array();
        $out = array();
        foreach ($rows as $row) {
            $rider    = isset($row['rpn_er_rider']) ? $row['rpn_er_rider'] : (isset($row['rider_id']) ? $row['rider_id'] : null);
            $rider_id = rpn_acf_post_id($rider);
            $out[] = array(
                'place'          => isset($row['rpn_er_place']) ? (int) $row['rpn_er_place'] : (isset($row['place']) ? (int) $row['place'] : 0),
                'rider_id'       => $rider_id,
                'rider_name'     => $rider_id ? get_the_title($rider_id) : '',
                'rider_image'    => $rider_id ? (get_the_post_thumbnail_url($rider_id, 'thumbnail') ?: '') : '',
                'agg_score'      => isset($row['rpn_er_agg_score']) ? (float) $row['rpn_er_agg_score'] : (isset($row['agg_score']) ? (float) $row['agg_score'] : 0),
                'total_points'   => isset($row['rpn_er_total_points']) ? (int) $row['rpn_er_total_points'] : (isset($row['total_points']) ? (int) $row['total_points'] : 0),
                'round_1_points' => isset($row['rpn_er_round_1_points']) ? (float) $row['rpn_er_round_1_points'] : (isset($row['round_1_points']) ? (float) $row['round_1_points'] : null),
                'round_2_points' => isset($row['rpn_er_round_2_points']) ? (float) $row['rpn_er_round_2_points'] : (isset($row['round_2_points']) ? (float) $row['round_2_points'] : null),
                'championship_round_points' => isset($row['rpn_er_championship_round_points']) ? (float) $row['rpn_er_championship_round_points'] : (isset($row['championship_round_points']) ? (float) $row['championship_round_points'] : null),
                'earnings'       => isset($row['rpn_er_earnings']) ? (float) $row['rpn_er_earnings'] : (isset($row['earnings']) ? (float) $row['earnings'] : 0),
                'ride_percentage'=> isset($row['rpn_er_ride_percentage']) ? $row['rpn_er_ride_percentage'] : (isset($row['ride_percentage']) ? $row['ride_percentage'] : ''),
            );
        }
        return $out;
    }

    function rpn_normalize_round_results($rows) {
        if (!is_array($rows)) return array();
        $out = array();
        foreach ($rows as $row) {
            $rider      = isset($row['rpn_r1_rider'])      ? $row['rpn_r1_rider']      : (isset($row['rpn_r2_rider'])      ? $row['rpn_r2_rider']      : (isset($row['rpn_cr_rider'])      ? $row['rpn_cr_rider']      : (isset($row['rider_id'])      ? $row['rider_id']      : null)));
            $animal     = isset($row['rpn_r1_animal'])     ? $row['rpn_r1_animal']     : (isset($row['rpn_r2_animal'])     ? $row['rpn_r2_animal']     : (isset($row['rpn_cr_animal'])     ? $row['rpn_cr_animal']     : (isset($row['animal_id'])     ? $row['animal_id']     : null)));
            $contractor = isset($row['rpn_r1_contractor']) ? $row['rpn_r1_contractor'] : (isset($row['rpn_r2_contractor']) ? $row['rpn_r2_contractor'] : (isset($row['rpn_cr_contractor']) ? $row['rpn_cr_contractor'] : (isset($row['contractor_id']) ? $row['contractor_id'] : null)));
            $score      = isset($row['rpn_r1_score'])      ? $row['rpn_r1_score']      : (isset($row['rpn_r2_score'])      ? $row['rpn_r2_score']      : (isset($row['rpn_cr_score'])      ? $row['rpn_cr_score']      : (isset($row['score'])      ? $row['score']      : '')));
            $bull_score = isset($row['rpn_r1_bull_score']) ? (float) $row['rpn_r1_bull_score'] : (isset($row['rpn_r2_bull_score']) ? (float) $row['rpn_r2_bull_score'] : (isset($row['rpn_cr_bull_score']) ? (float) $row['rpn_cr_bull_score'] : (isset($row['bull_score']) ? (float) $row['bull_score'] : null)));

            $rider_id  = rpn_acf_post_id($rider);
            $animal_id = rpn_acf_post_id($animal);

            $out[] = array(
                'rider_id'       => $rider_id,
                'rider_name'     => $rider_id  ? get_the_title($rider_id)  : '',
                'rider_image'    => $rider_id  ? (get_the_post_thumbnail_url($rider_id,  'thumbnail') ?: '') : '',
                'animal_id'      => $animal_id,
                'animal_name'    => $animal_id ? get_the_title($animal_id) : '',
                'animal_image'   => $animal_id ? (get_the_post_thumbnail_url($animal_id, 'thumbnail') ?: '') : '',
                'score'          => $score,
                'bull_score'     => $bull_score,
                'contractor_id'  => rpn_acf_post_id($contractor),
            );
        }
        return $out;
    }

    /* ========== WooCommerce: Rider field on checkout + update rider meta on payment ========== */

    /**
     * Product slugs that trigger rider meta updates. Change these to match your WooCommerce product slugs.
     */
    function rpn_wc_product_slugs() {
        return apply_filters('rpn_wc_product_slugs', array(
            // Monthly RIN tier products
            'rin_competitor'               => 'rin-competitor',
            'rin_contractor'               => 'rin-contractor',
            'rin_organizer'                => 'rin-organizer',
            // Yearly RIN tier products
            'rin_competitor_yearly'        => 'rin-competitor-yearly',
            'rin_contractor_yearly'        => 'rin-contractor-yearly',
            'rin_organizer_yearly'         => 'rin-organizer-yearly',
            // Strategic bundles / discounts (yearly only)
            'rin_competitor_bundle_yearly' => 'rin-competitor-bundle-yearly', // Team Roping Partner Bundle $149/yr
            'rin_competitor_student_yearly'=> 'rin-competitor-student-yearly', // Youth/Student $39/yr
        ));
    }

    /**
     * Hook WooCommerce payment events to upgrade RIN membership tier on completed payment.
     */
    add_action('plugins_loaded', function () {
        if (!class_exists('WooCommerce')) {
            return;
        }
        // Regular orders: completed or processing (covers $0 free-trial first payments)
        add_action('woocommerce_payment_complete',        'rpn_wc_update_rider_on_payment', 20, 1);
        add_action('woocommerce_order_status_completed',  'rpn_wc_update_rider_on_payment', 20, 1);
        add_action('woocommerce_order_status_processing', 'rpn_wc_update_rider_on_payment', 20, 1);

        // WooCommerce Subscriptions: fires when a subscription becomes active (free trial start)
        add_action('woocommerce_subscription_status_active', 'rpn_wc_update_rider_on_subscription', 20, 1);
    });

    /**
     * Shared helper: resolve RIN tier from a WooCommerce order and update user meta.
     */
    function rpn_wc_apply_tier_from_order($order, $billing_user) {
        $rin_tier_slugs = array(
            'rin-competitor'                => 'competitor',
            'rin-competitor-yearly'         => 'competitor',
            'rin-competitor-bundle-yearly'  => 'competitor', // Team Roping Partner Bundle
            'rin-competitor-student-yearly' => 'competitor', // Youth/Student rate
            'rin-contractor'                => 'contractor',
            'rin-contractor-yearly'         => 'contractor',
            'rin-organizer'                 => 'organizer',
            'rin-organizer-yearly'          => 'organizer',
            // Legacy slugs kept for backward compatibility
            'rin-elite'                     => 'contractor',
            'rin-elite-yearly'              => 'contractor',
            'rin-producer'                  => 'organizer',
            'rin-producer-yearly'           => 'organizer',
        );

        $updated = false;
        foreach ($order->get_items() as $item) {
            $product = $item->get_product();
            if (!$product) continue;
            $slug = $product->get_slug();
            if (isset($rin_tier_slugs[$slug])) {
                update_user_meta($billing_user->ID, 'rpn_membership_tier', $rin_tier_slugs[$slug]);
                delete_user_meta($billing_user->ID, 'rpn_pending_tier');
                $updated = true;
            }
        }
        return $updated;
    }

    /**
     * Fires on order payment_complete / status_completed / status_processing.
     * Covers standard products and the initial $0 order for free-trial subscriptions.
     */
    function rpn_wc_update_rider_on_payment($order_id) {
        if (!class_exists('WooCommerce')) {
            return;
        }

        $order = wc_get_order($order_id);
        if (!$order || $order->get_meta('_rpn_rider_updated')) {
            return;
        }

        $billing_email = $order->get_billing_email();
        $billing_user  = ($billing_email && is_email($billing_email)) ? get_user_by('email', $billing_email) : null;
        if (!$billing_user) {
            // Fall back to order's customer ID if no billing email match
            $customer_id = $order->get_customer_id();
            if ($customer_id) {
                $billing_user = get_user_by('id', $customer_id);
            }
        }

        if ($billing_user && rpn_wc_apply_tier_from_order($order, $billing_user)) {
            $order->update_meta_data('_rpn_rider_updated', 'yes');
            $order->save();
        }
    }

    /**
     * Fires when a WooCommerce Subscription becomes active.
     * Handles free-trial activations where the subscription plugin manages status
     * independently from the parent order.
     */
    function rpn_wc_update_rider_on_subscription($subscription) {
        if (!is_a($subscription, 'WC_Subscription')) {
            return;
        }

        // Avoid double-update if the parent order already handled it
        $parent_order = $subscription->get_parent();
        if ($parent_order && $parent_order->get_meta('_rpn_rider_updated')) {
            return;
        }

        $customer_id = $subscription->get_customer_id();
        $billing_user = $customer_id ? get_user_by('id', $customer_id) : null;

        if (!$billing_user) {
            $billing_email = $subscription->get_billing_email();
            $billing_user  = ($billing_email && is_email($billing_email)) ? get_user_by('email', $billing_email) : null;
        }

        if ($billing_user) {
            rpn_wc_apply_tier_from_order($subscription, $billing_user);
        }
    }

    /**
     * REST API: return WooCommerce revenue products (+ checkout URLs) for the React app.
     * Endpoint: GET /wp-json/rpn/v1/revenue-products
     */
    function rpn_register_revenue_products_route() {
        register_rest_route('rpn/v1', '/revenue-products', array(
            'methods'             => 'GET',
            'permission_callback' => '__return_true',
            'callback'            => 'rpn_wc_get_revenue_products',
        ));
    }
    add_action('rest_api_init', 'rpn_register_revenue_products_route');

    function rpn_wc_get_revenue_products($request) {
        if (!class_exists('WooCommerce')) {
            return new WP_Error('woocommerce_inactive', 'WooCommerce is not active.', array('status' => 500));
        }

        $slugs = rpn_wc_product_slugs();
        $currency = function_exists('get_woocommerce_currency') ? get_woocommerce_currency() : get_option('woocommerce_currency', 'USD');

        $map = array(
            'rin_competitor'         => array('label' => 'Competitor Pro (Monthly)',       'description' => 'Full RPI/TPI, score history, verified badge, NIL-ready profile.'),
            'rin_contractor'         => array('label' => 'Stock Contractor (Monthly)',     'description' => 'SRI per animal, herd dashboard, buck-off tracking, 25 animal profiles.'),
            'rin_organizer'          => array('label' => 'Event Organizer (Monthly)',      'description' => 'Direct score entry, verified event badge, CSV import, event analytics.'),
            'rin_competitor_yearly'  => array('label' => 'Competitor Pro (Yearly)',        'description' => 'Full RPI/TPI, score history, verified badge — save ~25%.'),
            'rin_contractor_yearly'  => array('label' => 'Stock Contractor (Yearly)',      'description' => 'SRI per animal, herd dashboard — save ~25%.'),
            'rin_organizer_yearly'   => array('label' => 'Event Organizer (Yearly)',       'description' => 'Direct score entry, verified event badge — save ~25%.'),
        );

        $items = array();

        foreach ($slugs as $key => $slug) {
            // Get WooCommerce product by slug.
            $product_post = get_page_by_path($slug, OBJECT, 'product');
            if (!$product_post) {
                continue;
            }

            $product = wc_get_product($product_post->ID);
            if (!$product) {
                continue;
            }

            $checkout_url = wc_get_checkout_url();
            // Add the product to cart when user hits checkout.
            $checkout_url = add_query_arg('add-to-cart', $product->get_id(), $checkout_url);
            // Fix localhost URLs: replace with production base (siteurl/home often wrong after migration).
            $is_local = (strpos($checkout_url, 'localhost') !== false || strpos($checkout_url, '127.0.0.1') !== false);
            if ($is_local) {
                $base = null;
                if (defined('RPN_CHECKOUT_BASE_URL') && RPN_CHECKOUT_BASE_URL) {
                    $base = rtrim(RPN_CHECKOUT_BASE_URL, '/');
                } else {
                    // Auto-detect from current request (API called from production domain).
                    $scheme = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || (!empty($_SERVER['SERVER_PORT']) && (int) $_SERVER['SERVER_PORT'] === 443) ? 'https' : 'http';
                    $host = isset($_SERVER['HTTP_HOST']) ? wp_unslash($_SERVER['HTTP_HOST']) : '';
                    if ($host && strpos($host, 'localhost') === false && strpos($host, '127.0.0.1') === false) {
                        $req = isset($_SERVER['REQUEST_URI']) ? wp_unslash($_SERVER['REQUEST_URI']) : '';
                        $wp_path = '';
                        if (preg_match('#^(/[^/]+)/wp-json/#', $req, $m)) {
                            $wp_path = $m[1]; // e.g. /wp when URL is /wp/wp-json/rpn/v1/revenue-products
                        }
                        $base = $scheme . '://' . $host . $wp_path;
                    }
                }
                if ($base) {
                    $parsed = wp_parse_url($checkout_url);
                    $query = isset($parsed['query']) ? '?' . $parsed['query'] : '';
                    $checkout_url = $base . '/checkout/' . $query;
                }
            }

            $meta = isset($map[$key]) ? $map[$key] : array('label' => $product->get_name(), 'description' => '');

            $checkout_url = apply_filters('rpn_revenue_product_checkout_url', $checkout_url, $product->get_id(), $key);

            $items[] = array(
                'key'          => $key,
                'product_id'   => $product->get_id(),
                'slug'         => $product->get_slug(),
                'name'         => $product->get_name(),
                'price'        => (float) $product->get_price(),
                'currency'     => $currency,
                'description'  => $meta['description'],
                'label'        => $meta['label'],
                'checkout_url' => $checkout_url,
            );
        }

        return rest_ensure_response(array(
            'products' => $items,
        ));
    } // end if WooCommerce

    /* ==========================================================================
    * RIN PROFILE MANAGEMENT ENDPOINTS
    * GET/POST /rpn/v1/profile          – view and edit the user's own profile
    * GET/POST /rpn/v1/my-animals       – list and create animals linked to user
    * POST     /rpn/v1/my-animals/{id}  – update an animal
    * GET/POST /rpn/v1/my-events        – list and create events (producers only)
    * POST     /rpn/v1/my-events/{id}   – update an event
    * ========================================================================== */

    /* ---------- helper: extract token from request ---------- */
    function rpn_token_from_request($request) {
        $token = $request->get_header('X-RPN-Auth') ?: $request->get_header('Authorization');
        if ($token && strpos($token, 'Bearer ') === 0) $token = substr($token, 7);
        return $token;
    }

    /* ---------- helper: get user id or return WP_REST_Response error ---------- */
    function rpn_require_auth($request) {
        $user_id = rpn_verify_token(rpn_token_from_request($request));
        if (!$user_id) {
            return new WP_REST_Response(array('success' => false, 'message' => 'Please log in.'), 401);
        }
        return $user_id;
    }

    /* =====================================================================
    * /rpn/v1/profile   GET + POST
    * ===================================================================== */
    function rpn_register_profile_route() {
        register_rest_route('rpn/v1', '/profile', array(
            array(
                'methods'             => 'GET',
                'permission_callback' => '__return_true',
                'callback'            => 'rpn_profile_get_callback',
            ),
            array(
                'methods'             => 'POST',
                'permission_callback' => '__return_true',
                'callback'            => 'rpn_profile_post_callback',
                'args' => array(
                    'first_name'  => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                    'last_name'   => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                    'display_name'=> array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                    'bio'         => array('required' => false, 'sanitize_callback' => 'sanitize_textarea_field'),
                    'state'       => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                    'city'        => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                    'event_type'  => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                    'age_group'   => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                    'phone'       => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                    'website'     => array('required' => false, 'sanitize_callback' => 'esc_url_raw'),
                ),
            ),
        ));
    }
    add_action('rest_api_init', 'rpn_register_profile_route');

    function rpn_profile_get_callback($request) {
        $user_id = rpn_require_auth($request);
        if ($user_id instanceof WP_REST_Response) return $user_id;

        $user             = get_user_by('id', $user_id);
        $membership_tier  = get_user_meta($user_id, 'rpn_membership_tier', true) ?: 'free';
        $rin_id           = get_user_meta($user_id, 'rpn_rin_id', true) ?: '';
        $first_name       = get_user_meta($user_id, 'first_name', true) ?: '';
        $last_name        = get_user_meta($user_id, 'last_name', true) ?: '';

        // Determine which linked profile post to read from
        $profile_data = array();
        $linked_rider_id      = (int) get_user_meta($user_id, 'rpn_linked_rider_id', true);
        $linked_contractor_id = (int) get_user_meta($user_id, 'rpn_linked_contractor_id', true);
        $linked_producer_id   = (int) get_user_meta($user_id, 'rpn_linked_producer_id', true);

        $profile_post_id = $linked_rider_id ?: ($linked_contractor_id ?: $linked_producer_id);
        if ($profile_post_id) {
            $profile_data = array(
                'bio'             => get_post_meta($profile_post_id, 'bio',        true) ?: '',
                'state'           => get_post_meta($profile_post_id, 'state',      true) ?: '',
                'city'            => get_post_meta($profile_post_id, 'city',       true) ?: '',
                'event_type'      => get_post_meta($profile_post_id, 'event_type', true) ?: '',
                'age_group'       => get_post_meta($profile_post_id, 'age_group',  true) ?: '',
                'phone'           => get_post_meta($profile_post_id, 'phone',      true) ?: '',
                'website'         => get_post_meta($profile_post_id, 'website',    true) ?: '',
                'rpi'             => $linked_rider_id ? (float)(get_post_meta($linked_rider_id, 'rpi',            true) ?: 0) : null,
                'rpi_preview'     => $linked_rider_id ? (float)(get_post_meta($linked_rider_id, 'rpi_preview',   true) ?: 0) : null,
                'rpi_roughstock'  => $linked_rider_id ? (float)(get_post_meta($linked_rider_id, 'rpi_roughstock', true) ?: 0) : null,
                'rpi_timed'       => $linked_rider_id ? (float)(get_post_meta($linked_rider_id, 'rpi_timed',      true) ?: 0) : null,
                'rpi_base'        => $linked_rider_id ? (float)(get_post_meta($linked_rider_id, 'rpi_base',       true) ?: 0) : null,
                'pri'             => $linked_producer_id ? (float)(get_post_meta($linked_producer_id, 'pri', true) ?: 0) : null,
                'verified'        => (bool) get_post_meta($profile_post_id, 'verified', true),
                'profile_slug'    => get_post_field('post_name', $profile_post_id) ?: '',
                // Rider season stats
                'total_rides'     => $linked_rider_id ? (int)(get_post_meta($linked_rider_id, 'total_rides',    true) ?: 0) : 0,
                'qualified_rides' => $linked_rider_id ? (int)(get_post_meta($linked_rider_id, 'qualified_rides', true) ?: 0) : 0,
                'completion_rate' => $linked_rider_id ? (float)(get_post_meta($linked_rider_id, 'completion_rate', true) ?: 0) : 0,
                'win_count'       => $linked_rider_id ? (int)(get_post_meta($linked_rider_id, 'win_count',      true) ?: 0) : 0,
                // Social media (rider)
                'twitter_url'     => $linked_rider_id ? (get_post_meta($linked_rider_id, 'twitter_url',     true) ?: '') : '',
                'instagram_url'   => $linked_rider_id ? (get_post_meta($linked_rider_id, 'instagram_url',   true) ?: '') : '',
                'tiktok_url'      => $linked_rider_id ? (get_post_meta($linked_rider_id, 'tiktok_url',      true) ?: '') : '',
                'facebook_url'    => $linked_rider_id ? (get_post_meta($linked_rider_id, 'facebook_url',    true) ?: '') : '',
                'youtube_url'     => $linked_rider_id ? (get_post_meta($linked_rider_id, 'youtube_url',     true) ?: '') : '',
                'personal_website' => $linked_rider_id ? (get_post_meta($linked_rider_id, 'personal_website', true) ?: '') : '',
                // Extended personal info (rider)
                'nickname'        => $linked_rider_id ? (get_post_meta($linked_rider_id, 'nickname',        true) ?: '') : '',
                'date_of_birth'   => $linked_rider_id ? (get_post_meta($linked_rider_id, 'date_of_birth',   true) ?: '') : '',
                'gender'          => $linked_rider_id ? (get_post_meta($linked_rider_id, 'gender',          true) ?: '') : '',
                'country'         => $linked_rider_id ? (get_post_meta($linked_rider_id, 'country',         true) ?: 'United States') : '',
                // Competition classification (rider)
                'division'        => $linked_rider_id ? (get_post_meta($linked_rider_id, 'division',        true) ?: '') : '',
                'primary_event'   => $linked_rider_id ? (get_post_meta($linked_rider_id, 'primary_event',   true) ?: '') : '',
                'years_competing' => $linked_rider_id ? (int)(get_post_meta($linked_rider_id, 'years_competing', true) ?: 0) : 0,
                'secondary_events' => $linked_rider_id ? (array)(maybe_unserialize(get_post_meta($linked_rider_id, 'secondary_events', true)) ?: []) : [],
                'association_memberships' => $linked_rider_id ? (array)(maybe_unserialize(get_post_meta($linked_rider_id, 'association_memberships', true)) ?: []) : [],
                'video_highlights' => $linked_rider_id ? (array)(maybe_unserialize(get_post_meta($linked_rider_id, 'video_highlights', true)) ?: []) : [],
                // NIL / Sponsorship
                'nil_open_to_sponsorship' => $linked_rider_id ? (get_post_meta($linked_rider_id, 'nil_open_to_sponsorship', true) === '1') : false,
                'sponsor_name'            => $linked_rider_id ? (get_post_meta($linked_rider_id, 'sponsor_name', true) ?: '') : '',
                'sponsor_url'             => $linked_rider_id ? (get_post_meta($linked_rider_id, 'sponsor_url', true) ?: '') : '',
                // Confidence score & RPI trend history
                'rpi_confidence_score'    => $linked_rider_id ? (int)(get_post_meta($linked_rider_id, 'rpi_confidence_score', true) ?: 0) : 0,
                'rpi_history'             => $linked_rider_id ? rpn_get_rpi_history($linked_rider_id) : array(),
                // Business profile fields (contractor / producer)
                'business_name'  => ($linked_contractor_id || $linked_producer_id)
                    ? (get_post_meta($profile_post_id, 'business_name', true) ?: get_post_field('post_title', $profile_post_id))
                    : '',
                'address_street' => get_post_meta($profile_post_id, 'address_street', true) ?: '',
                'address_zip'    => get_post_meta($profile_post_id, 'address_zip',    true) ?: '',
                'contact_name'   => get_post_meta($profile_post_id, 'contact_name',   true) ?: '',
                'stock_types'    => $linked_contractor_id
                    ? (array)(maybe_unserialize(get_post_meta($linked_contractor_id, 'stock_types', true)) ?: array())
                    : array(),
                // Profile photo URL (featured image of the linked profile post)
                'photo_url'        => (function() use ($profile_post_id) {
                    $thumb_id = get_post_thumbnail_id($profile_post_id);
                    if (!$thumb_id) return '';
                    $img = wp_get_attachment_image_src($thumb_id, 'large');
                    return $img ? $img[0] : '';
                })(),
            );
        }

        return new WP_REST_Response(array(
            'success'          => true,
            'user_id'          => $user_id,
            'email'            => $user->user_email,
            'display_name'     => $user->display_name,
            'first_name'       => $first_name,
            'last_name'        => $last_name,
            'rin_id'           => $rin_id,
            'membership_tier'  => $membership_tier,
            'trial_expires'    => get_user_meta($user_id, 'rpn_trial_expires', true) ?: null,
            'trial_tier'       => get_user_meta($user_id, 'rpn_trial_tier', true) ?: null,
            'joining_as'       => get_user_meta($user_id, 'rpn_joining_as', true) ?: null,
            'linked_rider_id'      => $linked_rider_id ?: null,
            'linked_contractor_id' => $linked_contractor_id ?: null,
            'linked_producer_id'   => $linked_producer_id ?: null,
            'profile'          => $profile_data,
        ), 200);
    }

    function rpn_profile_post_callback($request) {
        $user_id = rpn_require_auth($request);
        if ($user_id instanceof WP_REST_Response) return $user_id;

        $params     = $request->get_params();
        $json       = $request->get_json_params();
        if (is_array($json)) $params = array_merge($params, $json);

        // Update WP user fields
        $user_update = array('ID' => $user_id);
        if (!empty($params['first_name']))   { $user_update['first_name']   = $params['first_name'];   update_user_meta($user_id, 'first_name', $params['first_name']); }
        if (!empty($params['last_name']))    { $user_update['last_name']    = $params['last_name'];    update_user_meta($user_id, 'last_name',  $params['last_name']); }
        if (!empty($params['display_name'])) { $user_update['display_name'] = $params['display_name']; }
        if (count($user_update) > 1) wp_update_user($user_update);

        // Update linked profile post meta
        $linked_rider_id      = (int) get_user_meta($user_id, 'rpn_linked_rider_id', true);
        $linked_contractor_id = (int) get_user_meta($user_id, 'rpn_linked_contractor_id', true);
        $linked_producer_id   = (int) get_user_meta($user_id, 'rpn_linked_producer_id', true);
        $profile_post_id = $linked_rider_id ?: ($linked_contractor_id ?: $linked_producer_id);

        $meta_fields = array(
            'bio', 'state', 'city', 'event_type', 'age_group', 'phone', 'website',
            // Extended rider fields (string/number — safe to save for any profile type, ignored if key absent)
            'nickname', 'date_of_birth', 'gender', 'country', 'division',
            'primary_event', 'years_competing',
            'twitter_url', 'instagram_url', 'tiktok_url', 'facebook_url',
            'youtube_url', 'personal_website',
            // NIL / Sponsorship
            'sponsor_name', 'sponsor_url',
            // Business profile fields (contractor / producer)
            'business_name', 'address_street', 'address_zip', 'contact_name',
        );
        if ($profile_post_id) {
            foreach ($meta_fields as $field) {
                if (isset($params[$field])) {
                    update_post_meta($profile_post_id, $field, $params[$field]);
                }
            }

            // Boolean toggle — store as '1' / '0'
            if (isset($params['nil_open_to_sponsorship'])) {
                update_post_meta($profile_post_id, 'nil_open_to_sponsorship', $params['nil_open_to_sponsorship'] ? '1' : '0');
            }

            // Array fields (multi-select) — validate as arrays before saving
            $array_fields = array('secondary_events', 'association_memberships', 'video_highlights', 'stock_types');
            foreach ($array_fields as $field) {
                if (isset($params[$field]) && is_array($params[$field])) {
                    update_post_meta($profile_post_id, $field, array_map('sanitize_text_field', $params[$field]));
                }
            }

            // Profile photo — set as post thumbnail
            if (!empty($params['featured_image_id'])) {
                set_post_thumbnail($profile_post_id, (int) $params['featured_image_id']);
            }

            // Keep post title in sync: for business profiles use business_name; for riders use first+last name
            $linked_contractor_id_check = (int) get_user_meta($user_id, 'rpn_linked_contractor_id', true);
            $linked_producer_id_check   = (int) get_user_meta($user_id, 'rpn_linked_producer_id',   true);
            $is_business_profile = ($linked_contractor_id_check > 0 || $linked_producer_id_check > 0) && !((int) get_user_meta($user_id, 'rpn_linked_rider_id', true) > 0);

            if ($is_business_profile && !empty($params['business_name'])) {
                wp_update_post(array('ID' => $profile_post_id, 'post_title' => sanitize_text_field($params['business_name'])));
            } elseif (!$is_business_profile && (!empty($params['first_name']) || !empty($params['last_name']) || !empty($params['display_name']))) {
                // Display Name takes priority (shows on the public riders listing and rider profile);
                // falls back to First + Last Name when no display name is set.
                $dn = !empty($params['display_name']) ? sanitize_text_field($params['display_name']) : '';
                if ($dn) {
                    $new_title = $dn;
                } else {
                    $fn = get_user_meta($user_id, 'first_name', true) ?: '';
                    $ln = get_user_meta($user_id, 'last_name',  true) ?: '';
                    $new_title = trim("$fn $ln");
                }
                if ($new_title) {
                    wp_update_post(array('ID' => $profile_post_id, 'post_title' => $new_title));
                }
            }
        }

        return new WP_REST_Response(array('success' => true, 'message' => 'Profile updated.'), 200);
    }

    /* =====================================================================
    * /rpn/v1/upload-media   POST (multipart/form-data)
    * ===================================================================== */
    function rpn_register_upload_media_route() {
        register_rest_route('rpn/v1', '/upload-media', array(
            'methods'             => 'POST',
            'permission_callback' => '__return_true',
            'callback'            => 'rpn_upload_media_callback',
        ));
    }
    add_action('rest_api_init', 'rpn_register_upload_media_route');

    function rpn_upload_media_callback($request) {
        $user_id = rpn_require_auth($request);
        if ($user_id instanceof WP_REST_Response) return $user_id;

        if (empty($_FILES['file'])) {
            return new WP_REST_Response(array('success' => false, 'message' => 'No file uploaded.'), 400);
        }

        require_once ABSPATH . 'wp-admin/includes/image.php';
        require_once ABSPATH . 'wp-admin/includes/file.php';
        require_once ABSPATH . 'wp-admin/includes/media.php';

        // Override current user so media is owned by the authenticated user
        wp_set_current_user($user_id);

        $attachment_id = media_handle_upload('file', 0);
        if (is_wp_error($attachment_id)) {
            return new WP_REST_Response(array('success' => false, 'message' => $attachment_id->get_error_message()), 500);
        }

        return new WP_REST_Response(array(
            'success'       => true,
            'attachment_id' => $attachment_id,
            'url'           => wp_get_attachment_url($attachment_id),
        ), 200);
    }

    /* =====================================================================
    * /rpn/v1/my-animals   GET + POST + POST /{id}
    * ===================================================================== */
    function rpn_register_my_animals_route() {
        $shared_args = array(
            'name'                 => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
            'animal_type'          => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
            'scoring_type'         => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
            'unique_number'        => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
            'sex'                  => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
            'sire'                 => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
            'dam'                  => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
            'breed'                => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
            'color'                => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
            'year_foaled'          => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
            'birth_date'           => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
            'bloodlines'           => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
            'breeding'             => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
            'breeding_papers_url'  => array('required' => false, 'sanitize_callback' => 'esc_url_raw'),
            'owner'                => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
            'years_competing'      => array('required' => false, 'sanitize_callback' => 'absint'),
            'currently_active'     => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
            'video_links'          => array('required' => false),
            'notes'                => array('required' => false, 'sanitize_callback' => 'sanitize_textarea_field'),
            'featured_image_id'    => array('required' => false, 'sanitize_callback' => 'absint'),
        );

        register_rest_route('rpn/v1', '/my-animals', array(
            array(
                'methods'             => 'GET',
                'permission_callback' => '__return_true',
                'callback'            => 'rpn_my_animals_get_callback',
            ),
            array(
                'methods'             => 'POST',
                'permission_callback' => '__return_true',
                'callback'            => 'rpn_my_animals_post_callback',
                'args'                => array_merge($shared_args, array(
                    'name'        => array('required' => true, 'sanitize_callback' => 'sanitize_text_field'),
                    'animal_type' => array('required' => true, 'sanitize_callback' => 'sanitize_text_field'),
                )),
            ),
        ));
        register_rest_route('rpn/v1', '/my-animals/(?P<id>\d+)', array(
            array(
                'methods'             => 'POST',
                'permission_callback' => '__return_true',
                'callback'            => 'rpn_my_animals_update_callback',
                'args'                => array_merge($shared_args, array(
                    'id' => array('required' => true, 'validate_callback' => function($v) { return is_numeric($v); }),
                )),
            ),
            array(
                'methods'             => 'DELETE',
                'permission_callback' => '__return_true',
                'callback'            => 'rpn_my_animals_delete_callback',
                'args'                => array(
                    'id' => array('required' => true, 'validate_callback' => function($v) { return is_numeric($v); }),
                ),
            ),
        ));
    }
    add_action('rest_api_init', 'rpn_register_my_animals_route');

    function rpn_my_animals_get_callback($request) {
        $user_id = rpn_require_auth($request);
        if ($user_id instanceof WP_REST_Response) return $user_id;

        // Animals can be linked to rider, contractor, or producer profile
        $linked_rider_id      = (int) get_user_meta($user_id, 'rpn_linked_rider_id', true);
        $linked_contractor_id = (int) get_user_meta($user_id, 'rpn_linked_contractor_id', true);
        $linked_producer_id   = (int) get_user_meta($user_id, 'rpn_linked_producer_id', true);
        $profile_post_id = $linked_rider_id ?: ($linked_contractor_id ?: $linked_producer_id);

        // Get animals where rpn_linked_user_id matches, or where post_author matches
        $animal_posts = get_posts(array(
            'post_type'      => 'animal',
            'post_status'    => 'publish',
            'posts_per_page' => 100,
            'author'         => $user_id,
        ));

        // Also include animals linked via profile post meta
        if ($profile_post_id) {
            $linked_ids = get_post_meta($profile_post_id, 'linked_animals', true);
            $linked_ids = is_array($linked_ids) ? $linked_ids : array();
            if (!empty($linked_ids)) {
                $extra = get_posts(array(
                    'post_type'      => 'animal',
                    'post_status'    => 'publish',
                    'posts_per_page' => 100,
                    'post__in'       => array_map('intval', $linked_ids),
                ));
                foreach ($extra as $ep) {
                    $found = false;
                    foreach ($animal_posts as $ap) { if ($ap->ID === $ep->ID) { $found = true; break; } }
                    if (!$found) $animal_posts[] = $ep;
                }
            }
        }

        // Also include animals claimed via rpn_owner_user_id (claim-animal flow)
        $claimed_by_user = get_posts(array(
            'post_type'      => 'animal',
            'post_status'    => 'publish',
            'posts_per_page' => 100,
            'meta_query'     => array(
                array( 'key' => 'rpn_owner_user_id', 'value' => $user_id, 'type' => 'NUMERIC' ),
            ),
        ));
        foreach ($claimed_by_user as $cp) {
            $found = false;
            foreach ($animal_posts as $ap) { if ($ap->ID === $cp->ID) { $found = true; break; } }
            if (!$found) $animal_posts[] = $cp;
        }

        $animals = array();
        foreach ($animal_posts as $p) {
            $thumb_id  = get_post_thumbnail_id($p->ID);
            $image_url = $thumb_id ? wp_get_attachment_url($thumb_id) : '';
            $video_links_raw = get_post_meta($p->ID, 'video_links', true);
            $video_links = is_array($video_links_raw) ? $video_links_raw : array();
            $animals[] = array(
                'id'                   => $p->ID,
                'name'                 => $p->post_title,
                'slug'                 => $p->post_name,
                'animal_type'          => get_post_meta($p->ID, 'animal_type',         true) ?: '',
                'scoring_type'         => get_post_meta($p->ID, 'scoring_type',        true) ?: '',
                'unique_number'        => get_post_meta($p->ID, 'unique_number',       true) ?: '',
                'sex'                  => get_post_meta($p->ID, 'sex',                 true) ?: '',
                'sire'                 => get_post_meta($p->ID, 'sire',                true) ?: '',
                'dam'                  => get_post_meta($p->ID, 'dam',                 true) ?: '',
                'breed'                => get_post_meta($p->ID, 'breed',               true) ?: '',
                'color'                => get_post_meta($p->ID, 'color',               true) ?: '',
                'year_foaled'          => get_post_meta($p->ID, 'year_foaled',         true) ?: '',
                'birth_date'           => get_post_meta($p->ID, 'birth_date',          true) ?: '',
                'bloodlines'           => get_post_meta($p->ID, 'bloodlines',          true) ?: '',
                'breeding'             => get_post_meta($p->ID, 'breeding',            true) ?: '',
                'breeding_papers_url'  => get_post_meta($p->ID, 'breeding_papers_url', true) ?: '',
                'owner'                => get_post_meta($p->ID, 'owner',               true) ?: '',
                'years_competing'      => (int)(get_post_meta($p->ID, 'years_competing', true) ?: 0),
                'currently_active'     => get_post_meta($p->ID, 'currently_active',   true) ?: 'yes',
                'video_links'          => $video_links,
                'notes'                => get_post_meta($p->ID, 'notes',               true) ?: '',
                'sri'                  => (float)(get_post_meta($p->ID, 'sri',         true) ?: 0),
                'tei'                  => (float)(get_post_meta($p->ID, 'tei',         true) ?: 0),
                // Roughstock computed stats
                'buckoff_rate'         => (float)(get_post_meta($p->ID, 'buckoff_rate',      true) ?: 0),
                'avg_animal_score'     => (float)(get_post_meta($p->ID, 'avg_animal_score',  true) ?: 0),
                'total_animal_rides'   => (int)(get_post_meta($p->ID,   'total_animal_rides',true) ?: 0),
                // Timed computed stats
                'avg_run_time'         => (float)(get_post_meta($p->ID, 'avg_run_time',      true) ?: 0),
                'clean_run_rate'       => (float)(get_post_meta($p->ID, 'clean_run_rate',    true) ?: 0),
                'total_animal_runs'    => (int)(get_post_meta($p->ID,   'total_animal_runs', true) ?: 0),
                'featured_image_id'    => $thumb_id ?: 0,
                'image_url'            => $image_url,
            );
        }

        return new WP_REST_Response(array('success' => true, 'animals' => $animals), 200);
    }

    function rpn_my_animals_post_callback($request) {
        $user_id = rpn_require_auth($request);
        if ($user_id instanceof WP_REST_Response) return $user_id;

        $params      = $request->get_params();
        $json        = $request->get_json_params();
        if (is_array($json)) $params = array_merge($params, $json);

        $name        = isset($params['name'])        ? sanitize_text_field($params['name'])     : '';
        $animal_type = isset($params['animal_type']) ? sanitize_text_field($params['animal_type']) : '';
        if (empty($name) || empty($animal_type)) {
            return new WP_REST_Response(array('success' => false, 'message' => 'Name and animal type are required.'), 400);
        }

        // Enforce animal profile limits by tier
        $user_obj = get_user_by('id', $user_id);
        $is_admin  = $user_obj && in_array('administrator', (array) $user_obj->roles, true);
        $tier      = get_user_meta($user_id, 'rpn_membership_tier', true) ?: 'free';
        $limits    = array('free' => 3, 'competitor' => 5, 'contractor' => 25, 'organizer' => 25, 'enterprise' => 999);
        $limit     = $is_admin ? 999 : ($limits[$tier] ?? 3);

        $existing_count = count(get_posts(array(
            'post_type'      => 'animal',
            'author'         => $user_id,
            'posts_per_page' => -1,
            'post_status'    => 'publish',
            'fields'         => 'ids',
        )));
        if ($existing_count >= $limit) {
            return new WP_REST_Response(array(
                'success' => false,
                'message' => sprintf('Animal profile limit reached (%d of %d). Upgrade your plan to add more.', $existing_count, $limit),
                'limit'   => $limit,
                'count'   => $existing_count,
            ), 403);
        }

        $slug = sanitize_title($name);
        if (get_page_by_path($slug, OBJECT, 'animal')) {
            $slug = $slug . '-' . $user_id . '-' . time();
        }

        $post_id = wp_insert_post(array(
            'post_type'   => 'animal',
            'post_title'  => $name,
            'post_name'   => $slug,
            'post_status' => 'publish',
            'post_author' => $user_id,
        ), true);

        if (is_wp_error($post_id)) {
            return new WP_REST_Response(array('success' => false, 'message' => $post_id->get_error_message()), 500);
        }

        update_post_meta($post_id, 'animal_type', $animal_type);
        update_post_meta($post_id, 'rpn_linked_user_id', $user_id);
        $text_fields = array('scoring_type', 'sex', 'sire', 'dam', 'breed', 'color',
                            'year_foaled', 'birth_date', 'bloodlines', 'breeding',
                            'breeding_papers_url', 'owner', 'currently_active', 'notes');
        foreach ($text_fields as $f) {
            if (isset($params[$f])) update_post_meta($post_id, $f, $params[$f]);
        }
        if (isset($params['years_competing'])) {
            update_post_meta($post_id, 'years_competing', (int) $params['years_competing']);
        }
        if (isset($params['video_links']) && is_array($params['video_links'])) {
            $clean_links = array_map('esc_url_raw', array_slice($params['video_links'], 0, 5));
            update_post_meta($post_id, 'video_links', $clean_links);
        }
        if (!empty($params['featured_image_id'])) {
            set_post_thumbnail($post_id, (int) $params['featured_image_id']);
        }

        // Link animal to the user's profile post
        $linked_rider_id      = (int) get_user_meta($user_id, 'rpn_linked_rider_id', true);
        $linked_contractor_id = (int) get_user_meta($user_id, 'rpn_linked_contractor_id', true);
        $linked_producer_id   = (int) get_user_meta($user_id, 'rpn_linked_producer_id', true);
        $profile_post_id = $linked_rider_id ?: ($linked_contractor_id ?: $linked_producer_id);
        if ($profile_post_id) {
            $existing = get_post_meta($profile_post_id, 'linked_animals', true);
            $existing = is_array($existing) ? $existing : array();
            $existing[] = $post_id;
            update_post_meta($profile_post_id, 'linked_animals', array_unique($existing));
        }

        // Bidirectional: add this rider to the new animal's linked_riders array
        if ($linked_rider_id) {
            $existing_riders = get_post_meta($post_id, 'linked_riders', true);
            $existing_riders = is_array($existing_riders) ? $existing_riders : array();
            if (!in_array($linked_rider_id, array_map('intval', $existing_riders), true)) {
                $existing_riders[] = $linked_rider_id;
                update_post_meta($post_id, 'linked_riders', $existing_riders);
            }
        }

        return new WP_REST_Response(array(
            'success'   => true,
            'message'   => 'Animal added.',
            'animal_id' => $post_id,
        ), 201);
    }

    function rpn_my_animals_update_callback($request) {
        $user_id = rpn_require_auth($request);
        if ($user_id instanceof WP_REST_Response) return $user_id;

        $animal_id = (int) $request->get_param('id');
        $post      = get_post($animal_id);
        if (!$post || $post->post_type !== 'animal') {
            return new WP_REST_Response(array('success' => false, 'message' => 'Animal not found.'), 404);
        }
        // Ownership check: author or linked via profile
        $owner_user_id = (int) get_post_meta($animal_id, 'rpn_linked_user_id', true);
        if ($post->post_author != $user_id && $owner_user_id != $user_id) {
            return new WP_REST_Response(array('success' => false, 'message' => 'Not authorized.'), 403);
        }

        $params = $request->get_params();
        $json   = $request->get_json_params();
        if (is_array($json)) $params = array_merge($params, $json);

        if (!empty($params['name'])) {
            wp_update_post(array('ID' => $animal_id, 'post_title' => sanitize_text_field($params['name'])));
        }
        $text_fields = array('animal_type', 'scoring_type', 'sex', 'sire', 'dam',
                            'breed', 'color', 'year_foaled', 'birth_date', 'bloodlines', 'breeding',
                            'breeding_papers_url', 'owner', 'currently_active', 'notes');
        foreach ($text_fields as $f) {
            if (isset($params[$f])) update_post_meta($animal_id, $f, $params[$f]);
        }
        if (isset($params['years_competing'])) {
            update_post_meta($animal_id, 'years_competing', (int) $params['years_competing']);
        }
        if (isset($params['video_links']) && is_array($params['video_links'])) {
            $clean_links = array_map('esc_url_raw', array_slice($params['video_links'], 0, 5));
            update_post_meta($animal_id, 'video_links', $clean_links);
        }
        if (!empty($params['featured_image_id'])) {
            set_post_thumbnail($animal_id, (int) $params['featured_image_id']);
        }

        return new WP_REST_Response(array('success' => true, 'message' => 'Animal updated.'), 200);
    }

    function rpn_my_animals_delete_callback($request) {
        $user_id   = rpn_require_auth($request);
        if ($user_id instanceof WP_REST_Response) return $user_id;

        $animal_id = (int) $request->get_param('id');
        $post      = get_post($animal_id);

        if (!$post || $post->post_type !== 'animal') {
            return new WP_REST_Response(array('success' => false, 'message' => 'Animal not found.'), 404);
        }

        // Ownership check: must be post_author OR have rpn_linked_user_id meta pointing to this user
        $owner_user_id = (int) get_post_meta($animal_id, 'rpn_linked_user_id', true);
        if ((int) $post->post_author !== $user_id && $owner_user_id !== $user_id) {
            return new WP_REST_Response(array('success' => false, 'message' => 'Not authorized to delete this animal.'), 403);
        }

        // Move to trash (reversible — admin can restore from WP Admin if deleted by mistake)
        $result = wp_trash_post($animal_id);
        if (!$result) {
            return new WP_REST_Response(array('success' => false, 'message' => 'Could not delete animal. Please try again.'), 500);
        }

        // Remove from the user's profile post linked_animals array so it no longer appears
        $linked_rider_id      = (int) get_user_meta($user_id, 'rpn_linked_rider_id', true);
        $linked_contractor_id = (int) get_user_meta($user_id, 'rpn_linked_contractor_id', true);
        $linked_producer_id   = (int) get_user_meta($user_id, 'rpn_linked_producer_id', true);
        $profile_post_id = $linked_rider_id ?: ($linked_contractor_id ?: $linked_producer_id);

        if ($profile_post_id) {
            $linked = get_post_meta($profile_post_id, 'linked_animals', true);
            $linked = is_array($linked) ? $linked : array();
            $linked = array_values(array_filter($linked, function($id) use ($animal_id) {
                return (int) $id !== $animal_id;
            }));
            update_post_meta($profile_post_id, 'linked_animals', $linked);
        }

        return new WP_REST_Response(array('success' => true, 'message' => 'Animal deleted.'), 200);
    }

    /* =====================================================================
    * /rpn/v1/my-events   GET + POST + POST /{id}
    * ===================================================================== */
    function rpn_register_my_events_route() {
        register_rest_route('rpn/v1', '/my-events', array(
            array(
                'methods'             => 'GET',
                'permission_callback' => '__return_true',
                'callback'            => 'rpn_my_events_get_callback',
            ),
            array(
                'methods'             => 'POST',
                'permission_callback' => '__return_true',
                'callback'            => 'rpn_my_events_post_callback',
                'args' => array(
                    'title'       => array('required' => true,  'sanitize_callback' => 'sanitize_text_field'),
                    'event_date'  => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                    'venue'       => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                    'city'        => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                    'state'       => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                    'event_tier'  => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                    'season'      => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                    'description' => array('required' => false, 'sanitize_callback' => 'wp_kses_post'),
                    'entry_fee'   => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                    'prize_money' => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                    'disciplines' => array('required' => false),
                ),
            ),
        ));
        register_rest_route('rpn/v1', '/my-events/(?P<id>\d+)', array(
            'methods'             => 'POST',
            'permission_callback' => '__return_true',
            'callback'            => 'rpn_my_events_update_callback',
            'args' => array(
                'id'          => array('required' => true, 'validate_callback' => function($v) { return is_numeric($v); }),
                'title'       => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                'event_date'  => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                'venue'       => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                'city'        => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                'state'       => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                'event_tier'  => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                'season'      => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                'description' => array('required' => false, 'sanitize_callback' => 'wp_kses_post'),
                'entry_fee'   => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                'prize_money' => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                'disciplines' => array('required' => false),
            ),
        ));
    }
    add_action('rest_api_init', 'rpn_register_my_events_route');

    function rpn_my_events_get_callback($request) {
        $user_id = rpn_require_auth($request);
        if ($user_id instanceof WP_REST_Response) return $user_id;

        $event_posts = get_posts(array(
            'post_type'      => 'rpn_event',
            'post_status'    => array('publish', 'draft', 'pending'),
            'posts_per_page' => 100,
            'author'         => $user_id,
        ));

        $events = array();
        foreach ($event_posts as $p) {
            $disciplines_raw = get_post_meta($p->ID, 'disciplines', true);
            $disciplines = is_array($disciplines_raw) ? $disciplines_raw : array();
            $events[] = array(
                'id'          => $p->ID,
                'title'       => $p->post_title,
                'slug'        => $p->post_name,
                'status'      => $p->post_status,
                'event_date'  => get_post_meta($p->ID, 'event_date',  true) ?: '',
                'venue'       => get_post_meta($p->ID, 'venue',       true) ?: '',
                'city'        => get_post_meta($p->ID, 'city',        true) ?: '',
                'state'       => get_post_meta($p->ID, 'state',       true) ?: '',
                'event_tier'  => get_post_meta($p->ID, 'event_tier',  true) ?: '',
                'season'      => get_post_meta($p->ID, 'season',      true) ?: '',
                'description' => get_post_meta($p->ID, 'description', true) ?: '',
                'entry_fee'        => get_post_meta($p->ID, 'entry_fee',        true) ?: '',
                'prize_money'      => get_post_meta($p->ID, 'prize_money',      true) ?: '',
                'disciplines'      => $disciplines,
                'priority_listing' => (bool) get_post_meta($p->ID, 'priority_listing', true),
                'verified_event'   => (bool) get_post_meta($p->ID, 'verified_event',   true),
            );
        }

        return new WP_REST_Response(array('success' => true, 'events' => $events), 200);
    }

    function rpn_my_events_post_callback($request) {
        $user_id = rpn_require_auth($request);
        if ($user_id instanceof WP_REST_Response) return $user_id;

        // Only producers (and admins) may create events from the dashboard
        $membership_tier  = get_user_meta($user_id, 'rpn_membership_tier', true) ?: 'free';
        $user             = get_user_by('id', $user_id);
        $is_producer_role = $user && in_array('rpn_producer', (array) $user->roles, true);
        $is_admin         = $user && in_array('administrator', (array) $user->roles, true);
        if (!$is_producer_role && !$is_admin) {
            return new WP_REST_Response(array('success' => false, 'message' => 'A Producer account is required to create events.'), 403);
        }

        // Enforce per-year event limits: organizer = 50, enterprise = unlimited
        if (!$is_admin && $membership_tier !== 'enterprise') {
            $event_limit      = 50; // organizer tier max per year
            $current_year     = (int) date('Y');
            $events_this_year = count(get_posts(array(
                'post_type'   => 'rpn_event',
                'post_status' => array('publish', 'draft', 'pending'),
                'author'      => $user_id,
                'date_query'  => array(array('year' => $current_year)),
                'fields'      => 'ids',
                'posts_per_page' => -1,
            )));
            if ($events_this_year >= $event_limit) {
                return new WP_REST_Response(array(
                    'success' => false,
                    'message' => sprintf('You have reached the %d event per year limit for your plan. Upgrade to Enterprise for unlimited events.', $event_limit),
                    'limit'   => $event_limit,
                    'count'   => $events_this_year,
                ), 403);
            }
        }

        $params = $request->get_params();
        $json   = $request->get_json_params();
        if (is_array($json)) $params = array_merge($params, $json);

        $title = isset($params['title']) ? sanitize_text_field($params['title']) : '';
        if (empty($title)) {
            return new WP_REST_Response(array('success' => false, 'message' => 'Event title is required.'), 400);
        }

        $slug = sanitize_title($title);
        if (get_page_by_path($slug, OBJECT, 'rpn_event')) {
            $slug = $slug . '-' . $user_id . '-' . time();
        }

        $post_id = wp_insert_post(array(
            'post_type'    => 'rpn_event',
            'post_title'   => $title,
            'post_name'    => $slug,
            'post_status'  => 'draft', // admin publishes after review
            'post_author'  => $user_id,
            'post_content' => isset($params['description']) ? wp_kses_post($params['description']) : '',
        ), true);

        if (is_wp_error($post_id)) {
            return new WP_REST_Response(array('success' => false, 'message' => $post_id->get_error_message()), 500);
        }

        $meta_fields = array('event_date', 'venue', 'city', 'state', 'event_tier', 'season', 'entry_fee', 'prize_money');
        foreach ($meta_fields as $f) {
            if (isset($params[$f])) update_post_meta($post_id, $f, $params[$f]);
        }
        if (isset($params['disciplines']) && is_array($params['disciplines'])) {
            update_post_meta($post_id, 'disciplines', array_map('sanitize_text_field', $params['disciplines']));
        }
        update_post_meta($post_id, 'rpn_linked_user_id', $user_id);

        // Organizer+ events get priority listing and verified badge flag
        $org_tiers = array('organizer', 'enterprise');
        if ($is_admin || in_array($membership_tier, $org_tiers, true)) {
            update_post_meta($post_id, 'priority_listing', '1');
            update_post_meta($post_id, 'verified_event',   '1');
        }

        // Link event to producer profile
        $linked_producer_id = (int) get_user_meta($user_id, 'rpn_linked_producer_id', true);
        if ($linked_producer_id) {
            $existing = get_post_meta($linked_producer_id, 'linked_events', true);
            $existing = is_array($existing) ? $existing : array();
            $existing[] = $post_id;
            update_post_meta($linked_producer_id, 'linked_events', array_unique($existing));
        }

        return new WP_REST_Response(array(
            'success'  => true,
            'message'  => 'Event submitted for review.',
            'event_id' => $post_id,
        ), 201);
    }

    function rpn_my_events_update_callback($request) {
        $user_id = rpn_require_auth($request);
        if ($user_id instanceof WP_REST_Response) return $user_id;

        $event_id = (int) $request->get_param('id');
        $post     = get_post($event_id);
        if (!$post || $post->post_type !== 'rpn_event') {
            return new WP_REST_Response(array('success' => false, 'message' => 'Event not found.'), 404);
        }
        $owner_user_id = (int) get_post_meta($event_id, 'rpn_linked_user_id', true);
        if ($post->post_author != $user_id && $owner_user_id != $user_id) {
            return new WP_REST_Response(array('success' => false, 'message' => 'Not authorized.'), 403);
        }

        $params = $request->get_params();
        $json   = $request->get_json_params();
        if (is_array($json)) $params = array_merge($params, $json);

        $post_update = array('ID' => $event_id);
        if (!empty($params['title']))       $post_update['post_title']   = sanitize_text_field($params['title']);
        if (!empty($params['description'])) $post_update['post_content'] = wp_kses_post($params['description']);
        if (count($post_update) > 1) wp_update_post($post_update);

        $meta_fields = array('event_date', 'venue', 'city', 'state', 'event_tier', 'season', 'entry_fee', 'prize_money');
        foreach ($meta_fields as $f) {
            if (isset($params[$f])) update_post_meta($event_id, $f, $params[$f]);
        }
        if (isset($params['disciplines']) && is_array($params['disciplines'])) {
            update_post_meta($event_id, 'disciplines', array_map('sanitize_text_field', $params['disciplines']));
        }

        return new WP_REST_Response(array('success' => true, 'message' => 'Event updated.'), 200);
    }

    /* ==========================================================================
    * EVENT RESULTS — computed from submitted rpn_performance posts
    * GET  /rpn/v1/event-results/{event_id}
    * Aggregates rider submissions into per-round and overall leaderboards.
    * ========================================================================== */
    function rpn_register_event_results_route() {
        register_rest_route('rpn/v1', '/event-results/(?P<event_id>\d+)', array(
            'methods'             => 'GET',
            'callback'            => 'rpn_event_results_callback',
            'permission_callback' => '__return_true',
            'args'                => array(
                'event_id' => array('required' => true, 'validate_callback' => function($v) { return is_numeric($v); }),
            ),
        ));
    }
    add_action('rest_api_init', 'rpn_register_event_results_route');

    function rpn_event_results_callback($request) {
        $event_id = (int) $request->get_param('event_id');
        if (!$event_id) {
            return new WP_REST_Response(array('error' => 'Invalid event ID.'), 400);
        }

        $perf_posts = get_posts(array(
            'post_type'      => 'rpn_performance',
            'post_status'    => 'publish',
            'posts_per_page' => 500,
            'meta_query'     => array(
                array(
                    'key'     => 'event_id',
                    'value'   => $event_id,
                    'compare' => '=',
                ),
            ),
        ));

        $round_map    = array();
        $rider_rounds = array();
        $rider_meta   = array();

        foreach ($perf_posts as $p) {
            $pid          = $p->ID;
            $rider_id     = (int) get_post_meta($pid, 'rider_id', true);
            $rider_name   = get_post_meta($pid, 'rider_name', true) ?: $p->post_title;
            $animal_id    = (int) get_post_meta($pid, 'animal_id', true);
            $animal_name  = get_post_meta($pid, 'animal_name', true);
            $go_round_raw = strtolower(trim(get_post_meta($pid, 'go_round', true) ?: 'round 1'));
            $perf_type    = get_post_meta($pid, 'performance_type', true);

            if (strpos($go_round_raw, 'round 1') !== false || $go_round_raw === '1') {
                $round_key = 'round1';
            } elseif (strpos($go_round_raw, 'round 2') !== false || $go_round_raw === '2') {
                $round_key = 'round2';
            } else {
                $round_key = 'championship';
            }

            $score      = null;
            $bull_score = null;

            if ($perf_type === 'roughstock') {
                $qualified  = get_post_meta($pid, 'qualified_ride', true) === 'true';
                $j1         = (float) get_post_meta($pid, 'judge1_score', true);
                $j2         = (float) get_post_meta($pid, 'judge2_score', true);
                $ani        = (float) get_post_meta($pid, 'animal_score', true);
                $score      = $qualified ? ($j1 + $j2) : 0;
                $bull_score = $ani > 0 ? $ani : null;
            } else {
                $no_time    = get_post_meta($pid, 'no_time', true) === 'true';
                $final_time = (float) get_post_meta($pid, 'raw_run_time', true);
                $score      = $no_time ? null : ($final_time > 0 ? $final_time : null);
            }

            $raw_event_score = (float) get_post_meta($pid, 'raw_event_score', true);

            if (!isset($round_map[$round_key])) $round_map[$round_key] = array();

            $round_map[$round_key][] = array(
                'rider_id'        => $rider_id,
                'rider_name'      => $rider_name,
                'animal_id'       => $animal_id ?: null,
                'animal_name'     => $animal_name ?: null,
                'score'           => $score,
                'bull_score'      => $bull_score,
                'raw_event_score' => $raw_event_score,
            );

            if (!isset($rider_rounds[$rider_id])) {
                $rider_rounds[$rider_id] = array('round1' => null, 'round2' => null, 'championship' => null);
                $rider_meta[$rider_id]   = array('name' => $rider_name, 'id' => $rider_id);
            }
            if ($rider_rounds[$rider_id][$round_key] === null || $raw_event_score > $rider_rounds[$rider_id][$round_key]) {
                $rider_rounds[$rider_id][$round_key] = $raw_event_score;
            }
        }

        foreach ($round_map as $key => &$rows) {
            usort($rows, function($a, $b) { return $b['raw_event_score'] <=> $a['raw_event_score']; });
        }
        unset($rows);

        $overall = array();
        foreach ($rider_rounds as $rider_id => $rounds) {
            $pts = array_values(array_filter($rounds, function($v) { return $v !== null; }));
            $agg = array_sum($pts);
            $overall[] = array(
                'rider_id'                  => $rider_id,
                'rider_name'                => $rider_meta[$rider_id]['name'],
                'agg_score'                 => $agg,
                'round_1_points'            => $rounds['round1'],
                'round_2_points'            => $rounds['round2'],
                'championship_round_points' => $rounds['championship'],
                'earnings'                  => null,
            );
        }
        usort($overall, function($a, $b) { return $b['agg_score'] <=> $a['agg_score']; });
        foreach ($overall as $i => &$row) { $row['place'] = $i + 1; }
        unset($row);

        return new WP_REST_Response(array(
            'event_id'           => $event_id,
            'computed'           => true,
            'overall'            => $overall,
            'round_1'            => $round_map['round1']       ?? array(),
            'round_2'            => $round_map['round2']       ?? array(),
            'championship_round' => $round_map['championship'] ?? array(),
            'total_performances' => count($perf_posts),
        ), 200);
    }

    /* ==========================================================================
    * MY SCORES — self-service score entry for authenticated riders
    * GET  /rpn/v1/my-scores          — list own performances
    * POST /rpn/v1/my-scores          — submit a new performance
    * ========================================================================== */
    function rpn_register_my_scores_route() {
        register_rest_route('rpn/v1', '/my-scores', array(
            array(
                'methods'             => 'GET',
                'callback'            => 'rpn_my_scores_get_callback',
                'permission_callback' => '__return_true',
            ),
            array(
                'methods'             => 'POST',
                'callback'            => 'rpn_my_scores_post_callback',
                'permission_callback' => '__return_true',
                'args'                => array(
                    'performance_type'  => array('required' => true,  'sanitize_callback' => 'sanitize_text_field'),
                    'event_category'    => array('required' => true,  'sanitize_callback' => 'sanitize_text_field'),
                    'performance_date'  => array('required' => true,  'sanitize_callback' => 'sanitize_text_field'),
                    'arena_condition'   => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                    'weather_condition' => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                    'event_tier'        => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                    'event_id'          => array('required' => false, 'sanitize_callback' => 'absint'),
                    'event_name'        => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                    'event_city'        => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                    'event_state'       => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                    'organization_name' => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                    // Roughstock per-ride fields (Section 4+5)
                    'go_round'               => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                    'division'               => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                    'animal_name'            => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                    'covered'                => array('required' => false),
                    'judge1_score'           => array('required' => false),
                    'judge2_score'           => array('required' => false),
                    'animal_score'           => array('required' => false),
                    'reride_offered'         => array('required' => false),
                    'reride_accepted'        => array('required' => false),
                    'reride_covered'         => array('required' => false),
                    'reride_judge1_score'    => array('required' => false),
                    'reride_judge2_score'    => array('required' => false),
                    'reride_animal_score'    => array('required' => false),
                    'reride_animal_name'     => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                    'placement'              => array('required' => false),
                    'payout'                 => array('required' => false),
                    // Timed per-run fields (Section 6)
                    'no_time'                => array('required' => false),
                    'raw_run_time'           => array('required' => false),
                    'num_penalties'          => array('required' => false),
                    'horse_name'             => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                    'animal_id'              => array('required' => false, 'type' => 'integer', 'sanitize_callback' => 'absint'),
                    // Team roping
                    'role'                   => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                    'partner_name'           => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                    'partner_rin_id'         => array('required' => false, 'sanitize_callback' => 'sanitize_text_field'),
                    // Legacy aggregate timed (keep for backwards compatibility)
                    'total_runs'             => array('required' => false),
                    'clean_runs'             => array('required' => false),
                    'avg_time'               => array('required' => false),
                    'benchmark_time'         => array('required' => false),
                    'penalties'              => array('required' => false),
                ),
            ),
        ));
    }
    add_action('rest_api_init', 'rpn_register_my_scores_route');

    function rpn_my_scores_get_callback($request) {
        $user_id = rpn_require_auth($request);
        if ($user_id instanceof WP_REST_Response) return $user_id;

        $rider_id = (int) get_user_meta($user_id, 'rpn_linked_rider_id', true);
        if (!$rider_id) {
            return new WP_REST_Response(array('success' => true, 'scores' => array()), 200);
        }

        $posts = get_posts(array(
            'post_type'      => 'rpn_performance',
            'post_status'    => 'publish',
            'posts_per_page' => 200,
            'meta_query'     => array(
                array('key' => 'rider_id', 'value' => $rider_id, 'compare' => '='),
            ),
            'orderby'        => 'date',
            'order'          => 'DESC',
        ));

        $scores = array();
        foreach ($posts as $p) {
            $scores[] = array(
                'id'                 => $p->ID,
                'performance_type'   => get_post_meta($p->ID, 'performance_type',   true),
                'event_category'     => get_post_meta($p->ID, 'event_category',     true),
                'event_name'         => get_post_meta($p->ID, 'event_name',         true),
                'performance_date'   => get_post_meta($p->ID, 'performance_date',   true),
                'arena_condition'    => get_post_meta($p->ID, 'arena_condition',     true),
                'weather_condition'  => get_post_meta($p->ID, 'weather_condition',  true),
                'event_tier'           => get_post_meta($p->ID, 'event_tier',           true),
                'verification_status'  => get_post_meta($p->ID, 'verification_status',  true) ?: 'self_reported',
                'raw_event_score'      => (float) get_post_meta($p->ID, 'raw_event_score',      true),
                'field_strength_mult'  => (float) get_post_meta($p->ID, 'field_strength_mult',  true) ?: 1.0,
                'weighted_event_score' => (float) get_post_meta($p->ID, 'weighted_event_score', true),
                // Roughstock per-ride fields
                'go_round'           => get_post_meta($p->ID, 'go_round',           true),
                'division'           => get_post_meta($p->ID, 'division',           true),
                'animal_name'        => get_post_meta($p->ID, 'animal_name',        true),
                'judge1_score'       => (int)   get_post_meta($p->ID, 'judge1_score',      true),
                'judge2_score'       => (int)   get_post_meta($p->ID, 'judge2_score',      true),
                'animal_score'       => (int)   get_post_meta($p->ID, 'animal_score',      true),
                'final_score'        => (int)   get_post_meta($p->ID, 'final_score',       true),
                'qualified_ride'     => get_post_meta($p->ID, 'qualified_ride',     true) === 'true',
                'placement'          => get_post_meta($p->ID, 'placement',          true) !== '' ? (int) get_post_meta($p->ID, 'placement', true) : null,
                'use_for_rpi'        => get_post_meta($p->ID, 'use_for_rpi',        true) !== 'false',
                'is_reride'          => get_post_meta($p->ID, 'is_reride',          true) === 'true',
                'reride_offered'     => get_post_meta($p->ID, 'reride_offered',     true) === 'true',
                'reride_accepted'    => get_post_meta($p->ID, 'reride_accepted',    true) === 'true',
                'reride_result_id'   => (int)   get_post_meta($p->ID, 'reride_result_id',  true),
                'original_result_id' => (int)   get_post_meta($p->ID, 'original_result_id', true),
                // Timed per-run fields
                'no_time'            => get_post_meta($p->ID, 'no_time',            true) === 'true',
                'raw_run_time'       => get_post_meta($p->ID, 'raw_run_time',       true) !== '' ? (float) get_post_meta($p->ID, 'raw_run_time', true) : null,
                'field_best_time'    => get_post_meta($p->ID, 'field_best_time',    true) !== '' ? (float) get_post_meta($p->ID, 'field_best_time', true) : null,
                'num_penalties'      => (int)   get_post_meta($p->ID, 'num_penalties',   true),
                'penalty_seconds'    => (float) get_post_meta($p->ID, 'penalty_seconds', true),
                'final_time'         => get_post_meta($p->ID, 'final_time',         true) !== '' ? (float) get_post_meta($p->ID, 'final_time', true) : null,
                'clean_run'          => get_post_meta($p->ID, 'clean_run',          true) === 'true',
                'horse_name'         => get_post_meta($p->ID, 'horse_name',         true),
                'role'               => get_post_meta($p->ID, 'role',               true),
                'partner_name'       => get_post_meta($p->ID, 'partner_name',       true),
                'run_id'             => get_post_meta($p->ID, 'run_id',             true),
            );
        }

        return new WP_REST_Response(array('success' => true, 'scores' => $scores), 200);
    }

    function rpn_my_scores_post_callback($request) {
        $user_id = rpn_require_auth($request);
        if ($user_id instanceof WP_REST_Response) return $user_id;

        $tier     = get_user_meta($user_id, 'rpn_membership_tier', true) ?: 'free';
        $user     = get_user_by('id', $user_id);
        $is_admin = $user && in_array('administrator', (array) $user->roles, true);
        // Free tier: can log results manually but gets RPI Preview only (not stored as actual RPI)
        $is_free  = (!$is_admin && $tier === 'free');

        $rider_id = (int) get_user_meta($user_id, 'rpn_linked_rider_id', true);
        if (!$rider_id) {
            return new WP_REST_Response(array('success' => false, 'message' => 'No rider profile linked to your account.'), 400);
        }

        $params = $request->get_params();
        $json   = $request->get_json_params();
        if (is_array($json)) $params = array_merge($params, $json);

        $perf_type  = sanitize_text_field($params['performance_type'] ?? '');
        $event_cat  = sanitize_text_field($params['event_category'] ?? '');
        $perf_date  = sanitize_text_field($params['performance_date'] ?? date('Y-m-d'));
        $arena               = sanitize_text_field($params['arena_condition'] ?? 'smooth');
        $weather             = sanitize_text_field($params['weather_condition'] ?? 'clear');
        $tier_mod            = sanitize_text_field($params['event_tier'] ?? 'local');
        $verification_status = sanitize_text_field($params['verification_status'] ?? 'self_reported');
        $event_name          = sanitize_text_field($params['event_name'] ?? '');
        $event_id            = absint($params['event_id'] ?? 0);
        $event_city          = sanitize_text_field($params['event_city'] ?? '');
        $event_state         = sanitize_text_field($params['event_state'] ?? '');
        $organization_name   = sanitize_text_field($params['organization_name'] ?? '');
        $perf_date_tmp       = sanitize_text_field($params['performance_date'] ?? date('Y-m-d'));

        // ---- Auto-create event post if name given but no event_id ----
        if ($event_id === 0 && !empty($event_name)) {
            // Reuse an existing draft/published event with the same name + date first
            $existing_events = get_posts(array(
                'post_type'      => 'rpn_event',
                'post_status'    => array('publish', 'draft'),
                'posts_per_page' => 1,
                'fields'         => 'ids',
                'title'          => $event_name,
                'meta_query'     => array(
                    array('key' => 'event_date', 'value' => $perf_date_tmp, 'compare' => '='),
                ),
            ));
            if (!empty($existing_events)) {
                $event_id = (int) $existing_events[0];
            } else {
                $slug_candidate = sanitize_title($event_name) . '-' . str_replace('-', '', $perf_date_tmp);
                $new_event_id = wp_insert_post(array(
                    'post_type'   => 'rpn_event',
                    'post_title'  => $event_name,
                    'post_name'   => $slug_candidate,
                    'post_status' => 'draft',    // admin reviews before it goes public
                    'post_author' => $user_id,
                ), true);
                if (!is_wp_error($new_event_id) && $new_event_id > 0) {
                    $event_id = $new_event_id;
                    update_post_meta($event_id, 'event_date',        $perf_date_tmp);
                    update_post_meta($event_id, 'city',              $event_city);
                    update_post_meta($event_id, 'state',             $event_state);
                    update_post_meta($event_id, 'event_tier',        sanitize_text_field($params['event_tier'] ?? 'local'));
                    update_post_meta($event_id, 'organization_name', $organization_name);
                    update_post_meta($event_id, 'auto_created',      '1'); // flag for admin
                }
            }
        }

        // ---- Per-ride roughstock fields ----
        $go_round    = sanitize_text_field($params['go_round']    ?? 'Round 1');
        $division_rs = sanitize_text_field($params['division']    ?? '');
        $animal_name = sanitize_text_field($params['animal_name'] ?? '');
        $placement   = isset($params['placement']) && $params['placement'] !== '' ? (int) $params['placement'] : null;
        $payout      = isset($params['payout'])    && $params['payout']    !== '' ? (float) $params['payout']  : null;

        // Spec score variables
        $raw_event_score    = 0.0;
        $weighted_score     = 0.0;

        if ($perf_type === 'roughstock') {
            // --- Per-ride scoring — Section 8 spec formula ---
            $covered      = filter_var($params['covered'] ?? false, FILTER_VALIDATE_BOOLEAN);
            $judge1       = $covered ? min(25, max(0, (float) ($params['judge1_score'] ?? 0))) : 0;
            $judge2       = $covered ? min(25, max(0, (float) ($params['judge2_score'] ?? 0))) : 0;
            $animal_pts   = $covered ? min(50, max(0, (float) ($params['animal_score'] ?? 0))) : 0;
            $final_score  = $covered ? ($judge1 + $judge2 + $animal_pts) : 0;

            // Spec: raw = judge_total + placement_bonus (0 if no cover)
            $raw_event_score = rpn_calc_roughstock_event_score($final_score, $placement ?? 0, $covered);

            // --- Re-ride logic (spec Section 5) ---
            $reride_offered  = filter_var($params['reride_offered']  ?? false, FILTER_VALIDATE_BOOLEAN);
            $reride_accepted = $reride_offered && filter_var($params['reride_accepted'] ?? false, FILTER_VALIDATE_BOOLEAN);

            // Build original ride meta
            $use_for_rpi_original = $reride_accepted ? 'false' : 'true';

            $post_title = $event_name ?: ($event_id ? get_the_title($event_id) : 'Performance');
            $orig_id = wp_insert_post(array(
                'post_type'   => 'rpn_performance',
                'post_title'  => $post_title . ' — ' . $perf_date . ($go_round ? ' (' . $go_round . ')' : ''),
                'post_status' => 'publish',
                'post_author' => $user_id,
            ), true);

            if (is_wp_error($orig_id)) {
                return new WP_REST_Response(array('success' => false, 'message' => $orig_id->get_error_message()), 500);
            }

            $orig_meta = array(
                'rider_id'            => $rider_id,
                'event_id'            => $event_id,
                'event_name'          => $event_name,
                'event_city'          => $event_city,
                'event_state'         => $event_state,
                'organization_name'   => $organization_name,
                'performance_type'    => 'roughstock',
                'event_category'      => $event_cat,
                'performance_date'    => $perf_date,
                'arena_condition'     => $arena,
                'weather_condition'   => $weather,
                'event_tier'          => $tier_mod,
                'go_round'            => $go_round,
                'division'            => $division_rs,
                'animal_name'         => $animal_name,
                'animal_id'           => absint($params['animal_id'] ?? 0),
                'judge1_score'        => $judge1,
                'judge2_score'        => $judge2,
                'animal_score'        => $animal_pts,
                'final_score'         => $final_score,
                'qualified_ride'      => $covered ? 'true' : 'false',
                'reride_offered'      => $reride_offered ? 'true' : 'false',
                'reride_accepted'     => $reride_accepted ? 'true' : 'false',
                'is_reride'           => 'false',
                'use_for_rpi'         => $use_for_rpi_original,
                'verification_status' => $verification_status,
                'placement'           => $placement !== null ? $placement : '',
                'payout'              => $payout !== null ? $payout : '',
            );
            foreach ($orig_meta as $key => $val) update_post_meta($orig_id, $key, $val);
            // Compute and store spec scores on original ride
            $weighted_score = rpn_compute_and_store_weighted_score($orig_id, $raw_event_score, $event_id, $go_round, $rider_id, $tier_mod, $verification_status);

            // --- If re-ride was accepted: create the re-ride record ---
            $reride_id = null;
            if ($reride_accepted) {
                $rr_covered    = filter_var($params['reride_covered']      ?? false, FILTER_VALIDATE_BOOLEAN);
                $rr_judge1     = $rr_covered ? min(25, max(0, (float) ($params['reride_judge1_score'] ?? 0))) : 0;
                $rr_judge2     = $rr_covered ? min(25, max(0, (float) ($params['reride_judge2_score'] ?? 0))) : 0;
                $rr_animal     = $rr_covered ? min(50, max(0, (float) ($params['reride_animal_score'] ?? 0))) : 0;
                $rr_final      = $rr_covered ? ($rr_judge1 + $rr_judge2 + $rr_animal) : 0;
                $rr_cr         = $rr_covered ? 1.0 : 0.0;
                $rr_base       = rpn_calc_rpi_roughstock($rr_final, $rr_cr, $wins_this);
                $rr_adj        = rpn_get_adjusted_score($rr_base, $arena, $weather, $tier_mod);
                $rr_animal_name = sanitize_text_field($params['reride_animal_name'] ?? '');

                $reride_id = wp_insert_post(array(
                    'post_type'   => 'rpn_performance',
                    'post_title'  => $post_title . ' — ' . $perf_date . ' (Re-ride)',
                    'post_status' => 'publish',
                    'post_author' => $user_id,
                ), true);

                if (!is_wp_error($reride_id)) {
                    $rr_meta = array(
                        'rider_id'           => $rider_id,
                        'event_id'           => $event_id,
                        'event_name'         => $event_name,
                        'event_city'         => $event_city,
                        'event_state'        => $event_state,
                        'organization_name'  => $organization_name,
                        'performance_type'   => 'roughstock',
                        'event_category'     => $event_cat,
                        'performance_date'   => $perf_date,
                        'arena_condition'    => $arena,
                        'weather_condition'  => $weather,
                        'event_tier'         => $tier_mod,
                        'go_round'           => $go_round,
                        'division'           => $division_rs,
                        'animal_name'        => $rr_animal_name,
                        'judge1_score'       => $rr_judge1,
                        'judge2_score'       => $rr_judge2,
                        'animal_score'       => $rr_animal,
                        'final_score'        => $rr_final,
                        'qualified_ride'     => $rr_covered ? 'true' : 'false',
                        'is_reride'           => 'true',
                        'original_result_id'  => $orig_id,
                        'reride_offered'      => 'false',
                        'reride_accepted'     => 'false',
                        'use_for_rpi'         => 'true',
                        'verification_status' => $verification_status,
                        'placement'           => $placement !== null ? $placement : '',
                        'payout'              => $payout !== null ? $payout : '',
                    );
                    foreach ($rr_meta as $key => $val) update_post_meta($reride_id, $key, $val);
                    // Compute spec scores for the re-ride
                    $rr_raw   = rpn_calc_roughstock_event_score($rr_final, $placement ?? 0, $rr_covered);
                    $weighted_score = rpn_compute_and_store_weighted_score($reride_id, $rr_raw, $event_id, $go_round, $rider_id, $tier_mod, $verification_status);
                    // Point original at re-ride
                    update_post_meta($orig_id, 'reride_result_id', $reride_id);
                }
            }

            // Recalculate RPI and stats
            $old_rpi = (float) get_post_meta($rider_id, 'rpi', true);
            rpn_update_rider_index_from_performances($rider_id);
            rpn_refresh_rider_season_stats($rider_id);
            $new_rpi = (float) get_post_meta($rider_id, 'rpi', true);

            $rpi_preview = null;
            if ($is_free) {
                // Store computed value as preview; revert actual RPI so free tier never accumulates it
                $rpi_preview = $new_rpi;
                update_post_meta($rider_id, 'rpi_preview', $rpi_preview);
                update_post_meta($rider_id, 'rpi', $old_rpi);
                $new_rpi = $old_rpi;
            }

            // Section 9 — Recalculate SRI for the linked animal
            $rs_animal_id = absint($params['animal_id'] ?? 0);
            if ($rs_animal_id > 0) {
                rpn_update_animal_sri($rs_animal_id);
            }

            // Update PRI for the event's producer
            if (!empty($event_id)) {
                $rs_producer_id = (int) get_post_meta((int)$event_id, 'producer_id', true);
                if ($rs_producer_id > 0) rpn_update_producer_pri($rs_producer_id);
            }

            // Email notification to rider
            $notif_user = get_user_by('id', $user_id);
            if ($notif_user && $notif_user->user_email) {
                $notif_subject = '[RIN] Your roughstock performance has been recorded';
                $rpi_line      = $is_free
                    ? "RPI Preview: " . number_format($rpi_preview, 1) . " (upgrade to unlock)"
                    : "Updated RPI: " . number_format($new_rpi, 1);
                $notif_body    = "Hi {$notif_user->display_name},\n\nYour roughstock performance has been logged on RIN.\n\n"
                            . "Date: {$perf_date}\nEvent: " . ($event_name ?: 'N/A') . "\nCategory: {$event_cat}\nFinal Score: " . ($reride_accepted ? ($rr_final ?? 0) : $final_score) . "\n{$rpi_line}\n\n"
                            . "Log in to your dashboard to view full stats.\n\nhttps://rodeoidnetwork.com";
                wp_mail($notif_user->user_email, $notif_subject, $notif_body);
            }

            return new WP_REST_Response(array(
                'success'             => true,
                'message'             => 'Score submitted.',
                'performance_id'      => $orig_id,
                'reride_id'           => $reride_id,
                'final_score'         => $reride_accepted ? ($rr_final ?? 0) : $final_score,
                'raw_event_score'     => $raw_event_score,
                'weighted_event_score'=> $weighted_score,
                'rpi_updated'         => $new_rpi,
                'rpi_preview'         => $rpi_preview,
                'free_tier'           => $is_free,
            ), 201);

        } elseif ($perf_type === 'timed') {

            // --- Per-run timed fields (Section 6) ---
            $no_time         = filter_var($params['no_time'] ?? false, FILTER_VALIDATE_BOOLEAN);
            $raw_time        = $no_time ? null : (float) ($params['raw_run_time'] ?? 0);
            $field_best_time = isset($params['field_best_time']) && $params['field_best_time'] !== '' ? (float) $params['field_best_time'] : 0.0;
            $num_pen         = $no_time ? 0 : max(0, (int) ($params['num_penalties'] ?? 0));
            $pen_val         = rpn_timed_penalty_value($event_cat);
            $pen_secs        = $num_pen * $pen_val;
            $final_time      = $no_time ? null : ($raw_time + $pen_secs);
            $clean_run       = (!$no_time && $num_pen === 0);
            $horse_name      = sanitize_text_field($params['horse_name']      ?? '');
            $role            = sanitize_text_field($params['role']            ?? '');
            $partner_name    = sanitize_text_field($params['partner_name']    ?? '');
            $partner_rin     = sanitize_text_field($params['partner_rin_id']  ?? '');
            $is_team_roping  = in_array($event_cat, array('Team Roping – Header', 'Team Roping – Heeler'), true);

            // Spec formula: raw = 100 − (final_time / field_best_time × 30)
            $raw_event_score = rpn_calc_timed_event_score(
                $final_time !== null ? (float) $final_time : 0,
                $field_best_time,
                $no_time
            );

            $post_title = $event_name ?: ($event_id ? get_the_title($event_id) : 'Performance');
            $go_round_t = sanitize_text_field($params['go_round'] ?? 'Round 1');
            $division_t = sanitize_text_field($params['division'] ?? '');

            // Generate shared run_id for team roping pair
            $run_id = $is_team_roping ? wp_generate_uuid4() : '';

            $post_id = wp_insert_post(array(
                'post_type'   => 'rpn_performance',
                'post_title'  => $post_title . ' — ' . $perf_date . ($go_round_t ? ' (' . $go_round_t . ')' : ''),
                'post_status' => 'publish',
                'post_author' => $user_id,
            ), true);

            if (is_wp_error($post_id)) {
                return new WP_REST_Response(array('success' => false, 'message' => $post_id->get_error_message()), 500);
            }

            $timed_meta = array(
                'rider_id'            => $rider_id,
                'event_id'            => $event_id,
                'event_name'          => $event_name,
                'event_city'          => $event_city,
                'event_state'         => $event_state,
                'organization_name'   => $organization_name,
                'performance_type'    => 'timed',
                'event_category'      => $event_cat,
                'performance_date'    => $perf_date,
                'arena_condition'     => $arena,
                'weather_condition'   => $weather,
                'event_tier'          => $tier_mod,
                'go_round'            => $go_round_t,
                'division'            => $division_t,
                'horse_name'          => $horse_name,
                'animal_id'           => absint($params['animal_id'] ?? 0),
                'no_time'             => $no_time     ? 'true' : 'false',
                'raw_run_time'        => $raw_time    !== null ? $raw_time   : '',
                'field_best_time'     => $field_best_time > 0 ? $field_best_time : '',
                'num_penalties'       => $num_pen,
                'penalty_seconds'     => $pen_secs,
                'final_time'          => $final_time  !== null ? $final_time : '',
                'clean_run'           => $clean_run   ? 'true' : 'false',
                'verification_status' => $verification_status,
                'use_for_rpi'         => 'true',
                'placement'           => $placement !== null ? $placement : '',
                'payout'              => $payout    !== null ? $payout    : '',
                // Team roping
                'role'                => $role,
                'partner_name'        => $partner_name,
                'partner_rin_id'      => $partner_rin,
                'run_id'              => $run_id,
            );
            foreach ($timed_meta as $key => $val) update_post_meta($post_id, $key, $val);
            // Compute and store spec scores
            $weighted_score = rpn_compute_and_store_weighted_score($post_id, $raw_event_score, $event_id, $go_round_t, $rider_id, $tier_mod, $verification_status);

            $old_rpi_t = (float) get_post_meta($rider_id, 'rpi', true);
            rpn_update_rider_index_from_performances($rider_id);
            rpn_refresh_rider_season_stats($rider_id);
            $new_rpi = (float) get_post_meta($rider_id, 'rpi', true);

            $rpi_preview_t = null;
            if ($is_free) {
                $rpi_preview_t = $new_rpi;
                update_post_meta($rider_id, 'rpi_preview', $rpi_preview_t);
                update_post_meta($rider_id, 'rpi', $old_rpi_t);
                $new_rpi = $old_rpi_t;
            }

            // Section 9 — Recalculate TEI/BHI for the linked horse/animal
            $timed_animal_id = absint($params['animal_id'] ?? 0);
            if ($timed_animal_id > 0) {
                rpn_update_animal_sri($timed_animal_id);
            }

            // Update PRI for the event's producer
            if (!empty($event_id)) {
                $tm_producer_id = (int) get_post_meta((int)$event_id, 'producer_id', true);
                if ($tm_producer_id > 0) rpn_update_producer_pri($tm_producer_id);
            }

            // Email notification to rider
            $notif_user_t = get_user_by('id', $user_id);
            if ($notif_user_t && $notif_user_t->user_email) {
                $notif_subject_t = '[RIN] Your timed run has been recorded';
                $rpi_line_t      = $is_free
                    ? "RPI Preview: " . number_format($rpi_preview_t, 1) . " (upgrade to unlock)"
                    : "Updated RPI: " . number_format($new_rpi, 1);
                $notif_body_t    = "Hi {$notif_user_t->display_name},\n\nYour timed run has been logged on RIN.\n\n"
                                . "Date: {$perf_date}\nEvent: " . ($event_name ?: 'N/A') . "\nCategory: {$event_cat}\nTime: " . ($clean_run ? number_format($final_time, 3) . 's' : 'No Time') . "\n{$rpi_line_t}\n\n"
                                . "Log in to your dashboard to view full stats.\n\nhttps://rodeoidnetwork.com";
                wp_mail($notif_user_t->user_email, $notif_subject_t, $notif_body_t);
            }

            return new WP_REST_Response(array(
                'success'              => true,
                'message'              => 'Score submitted.',
                'performance_id'       => $post_id,
                'final_time'           => $final_time,
                'clean_run'            => $clean_run,
                'raw_event_score'      => $raw_event_score,
                'weighted_event_score' => $weighted_score,
                'rpi_updated'          => $new_rpi,
                'rpi_preview'          => $rpi_preview_t,
                'free_tier'            => $is_free,
            ), 201);
        }

        return new WP_REST_Response(array('success' => false, 'message' => 'Unknown performance type.'), 400);
    }

    /* ==========================================================================
    * EVENT ANALYTICS — aggregate stats for producer's events
    * GET /rpn/v1/event-analytics  (auth required, organizer+ tier)
    * ========================================================================== */
    function rpn_register_event_analytics_route() {
        register_rest_route('rpn/v1', '/event-analytics', array(
            'methods'             => 'GET',
            'callback'            => 'rpn_event_analytics_callback',
            'permission_callback' => '__return_true',
        ));
    }
    add_action('rest_api_init', 'rpn_register_event_analytics_route');

    function rpn_event_analytics_callback($request) {
        $user_id = rpn_require_auth($request);
        if ($user_id instanceof WP_REST_Response) return $user_id;

        $tier  = get_user_meta($user_id, 'rpn_membership_tier', true) ?: 'free';
        $user  = get_user_by('id', $user_id);
        $is_admin = $user && in_array('administrator', (array) $user->roles, true);
        if (!$is_admin && !in_array($tier, array('organizer', 'enterprise'), true)) {
            return new WP_Error('tier_required', 'Event analytics requires Event Organizer or higher.', array('status' => 403));
        }

        $current_year  = (int) date('Y');
        $event_ids_all = get_posts(array(
            'post_type'      => 'rpn_event',
            'post_status'    => array('publish', 'draft', 'pending'),
            'author'         => $user_id,
            'posts_per_page' => -1,
            'fields'         => 'ids',
        ));
        $event_ids_year = get_posts(array(
            'post_type'      => 'rpn_event',
            'post_status'    => array('publish', 'draft', 'pending'),
            'author'         => $user_id,
            'date_query'     => array(array('year' => $current_year)),
            'posts_per_page' => -1,
            'fields'         => 'ids',
        ));

        // Aggregate performances across all producer events
        $total_performances = 0;
        $unique_rider_ids   = array();
        $rider_score_map    = array(); // rider_id => [scores]
        $event_participant_counts = array();

        foreach ($event_ids_all as $eid) {
            $perfs = get_posts(array(
                'post_type'      => 'rpn_performance',
                'post_status'    => 'publish',
                'meta_query'     => array(array('key' => 'event_id', 'value' => $eid, 'type' => 'NUMERIC')),
                'posts_per_page' => -1,
                'fields'         => 'ids',
            ));
            $event_rider_ids = array();
            foreach ($perfs as $pid) {
                $total_performances++;
                $rid   = (int) get_post_meta($pid, 'rider_id', true);
                $score = (float) get_post_meta($pid, 'weighted_event_score', true);
                if ($rid > 0) {
                    $unique_rider_ids[$rid] = true;
                    $event_rider_ids[$rid]  = true;
                    $rider_score_map[$rid][] = $score;
                }
            }
            $event_participant_counts[] = count($event_rider_ids);
        }

        $unique_rider_count = count($unique_rider_ids);
        $avg_participants   = count($event_ids_all) > 0
            ? round(array_sum($event_participant_counts) / count($event_ids_all), 1)
            : 0;

        // Top 5 performers by average weighted score
        $top_performers = array();
        foreach ($rider_score_map as $rid => $scores) {
            $avg = count($scores) > 0 ? array_sum($scores) / count($scores) : 0;
            $top_performers[] = array(
                'rider_id'    => $rid,
                'rider_name'  => get_the_title($rid),
                'avg_score'   => round($avg, 2),
                'appearances' => count($scores),
            );
        }
        usort($top_performers, function($a, $b) { return $b['avg_score'] <=> $a['avg_score']; });
        $top_performers = array_slice($top_performers, 0, 5);

        return new WP_REST_Response(array(
            'total_events_all'  => count($event_ids_all),
            'total_events_year' => count($event_ids_year),
            'event_limit'       => $tier === 'enterprise' ? null : 50,
            'total_performances'=> $total_performances,
            'unique_riders'     => $unique_rider_count,
            'avg_participants'  => $avg_participants,
            'top_performers'    => $top_performers,
        ), 200);
    }

    /* ==========================================================================
    * RESULTS EXPORT — enterprise+ download all results for an event as JSON
    * GET /rpn/v1/export-results?event_id=X  (auth required, enterprise tier)
    * ========================================================================== */
    function rpn_register_export_results_route() {
        register_rest_route('rpn/v1', '/export-results', array(
            'methods'             => 'GET',
            'callback'            => 'rpn_export_results_callback',
            'permission_callback' => '__return_true',
            'args'                => array(
                'event_id' => array('required' => false, 'sanitize_callback' => 'absint'),
            ),
        ));
    }
    add_action('rest_api_init', 'rpn_register_export_results_route');

    function rpn_export_results_callback($request) {
        $user_id = rpn_require_auth($request);
        if ($user_id instanceof WP_REST_Response) return $user_id;

        $tier  = get_user_meta($user_id, 'rpn_membership_tier', true) ?: 'free';
        $user  = get_user_by('id', $user_id);
        $is_admin = $user && in_array('administrator', (array) $user->roles, true);
        if (!$is_admin && $tier !== 'enterprise') {
            return new WP_Error('tier_required', 'Data export requires Enterprise / Association plan.', array('status' => 403));
        }

        $event_id = (int) ($request->get_param('event_id') ?? 0);

        // Build meta_query: if event_id given, filter by it; else all producer events
        $meta_query = array();
        if ($event_id > 0) {
            // Ownership check
            $event_owner = (int) get_post_meta($event_id, 'rpn_linked_user_id', true);
            $event_post  = get_post($event_id);
            if (!$is_admin && $event_post && $event_post->post_author != $user_id && $event_owner != $user_id) {
                return new WP_Error('not_authorized', 'You do not own this event.', array('status' => 403));
            }
            $meta_query[] = array('key' => 'event_id', 'value' => $event_id, 'type' => 'NUMERIC');
        } else {
            // Get all organizer's event IDs then filter performances
            $producer_event_ids = get_posts(array(
                'post_type'      => 'rpn_event',
                'author'         => $user_id,
                'post_status'    => array('publish', 'draft', 'pending'),
                'posts_per_page' => -1,
                'fields'         => 'ids',
            ));
            if (empty($producer_event_ids)) {
                return new WP_REST_Response(array('rows' => array(), 'count' => 0), 200);
            }
            $meta_query[] = array('key' => 'event_id', 'value' => $producer_event_ids, 'compare' => 'IN', 'type' => 'NUMERIC');
        }

        $perfs = get_posts(array(
            'post_type'      => 'rpn_performance',
            'post_status'    => 'publish',
            'meta_query'     => $meta_query,
            'posts_per_page' => 500,
            'orderby'        => 'date',
            'order'          => 'DESC',
        ));

        $rows = array();
        foreach ($perfs as $p) {
            $rid = (int) get_post_meta($p->ID, 'rider_id', true);
            $rows[] = array(
                'performance_id'      => $p->ID,
                'rider_name'          => get_the_title($rid) ?: '',
                'event_name'          => get_post_meta($p->ID, 'event_name',          true) ?: '',
                'event_id'            => get_post_meta($p->ID, 'event_id',            true) ?: '',
                'performance_date'    => get_post_meta($p->ID, 'performance_date',    true) ?: '',
                'performance_type'    => get_post_meta($p->ID, 'performance_type',    true) ?: '',
                'event_category'      => get_post_meta($p->ID, 'event_category',      true) ?: '',
                'event_tier'          => get_post_meta($p->ID, 'event_tier',          true) ?: '',
                'final_score'         => get_post_meta($p->ID, 'final_score',         true) ?: '',
                'final_time'          => get_post_meta($p->ID, 'final_time',          true) ?: '',
                'qualified_ride'      => get_post_meta($p->ID, 'qualified_ride',      true) ?: '',
                'clean_run'           => get_post_meta($p->ID, 'clean_run',           true) ?: '',
                'placement'           => get_post_meta($p->ID, 'placement',           true) ?: '',
                'payout'              => get_post_meta($p->ID, 'payout',              true) ?: '',
                'verification_status' => get_post_meta($p->ID, 'verification_status', true) ?: '',
                'weighted_event_score'=> get_post_meta($p->ID, 'weighted_event_score',true) ?: '',
                'go_round'            => get_post_meta($p->ID, 'go_round',            true) ?: '',
            );
        }

        return new WP_REST_Response(array('rows' => $rows, 'count' => count($rows)), 200);
    }

    /* ==========================================================================
    * PEER RANK — compare current rider's RPI vs state and discipline peers
    * GET /rpn/v1/my-rank  (auth required, competitor+ tier)
    * ========================================================================== */
    function rpn_register_my_rank_route() {
        register_rest_route('rpn/v1', '/my-rank', array(
            'methods'             => 'GET',
            'callback'            => 'rpn_my_rank_callback',
            'permission_callback' => '__return_true',
        ));
    }
    add_action('rest_api_init', 'rpn_register_my_rank_route');

    function rpn_my_rank_callback($request) {
        $user_id = rpn_require_auth($request);
        if ($user_id instanceof WP_REST_Response) return $user_id;

        $tier = get_user_meta($user_id, 'rpn_membership_tier', true) ?: 'free';
        if (!in_array($tier, array('competitor', 'contractor', 'organizer', 'enterprise'), true)) {
            $user = get_user_by('id', $user_id);
            $is_admin = $user && in_array('administrator', (array) $user->roles, true);
            if (!$is_admin) {
                return new WP_Error('tier_required', 'Peer comparison requires Competitor Pro or higher.', array('status' => 403));
            }
        }

        $rider_id = (int) get_user_meta($user_id, 'rpn_linked_rider_id', true);
        if (!$rider_id) {
            return new WP_REST_Response(array(
                'state_rank' => null, 'state_total' => 0,
                'discipline_rank' => null, 'discipline_total' => 0,
                'state' => '', 'discipline' => '', 'my_rpi' => 0,
            ), 200);
        }

        $my_state      = get_post_meta($rider_id, 'state', true) ?: '';
        $my_discipline = get_post_meta($rider_id, 'primary_event', true) ?: '';
        $my_rpi        = (float) get_post_meta($rider_id, 'rpi', true);

        $all_rider_ids = get_posts(array(
            'post_type'      => 'rider',
            'posts_per_page' => -1,
            'post_status'    => 'publish',
            'fields'         => 'ids',
        ));

        // State rank
        $state_rank = null;
        $state_total = 0;
        if ($my_state) {
            $state_rpis = array();
            foreach ($all_rider_ids as $rid) {
                $s = get_post_meta($rid, 'state', true) ?: '';
                if ($s === $my_state) {
                    $state_rpis[$rid] = (float) get_post_meta($rid, 'rpi', true);
                    $state_total++;
                }
            }
            arsort($state_rpis);
            $rank = 1;
            foreach ($state_rpis as $rid => $rpi_val) {
                if ((int) $rid === $rider_id) { $state_rank = $rank; break; }
                $rank++;
            }
        }

        // Discipline rank
        $discipline_rank = null;
        $discipline_total = 0;
        if ($my_discipline) {
            $disc_rpis = array();
            foreach ($all_rider_ids as $rid) {
                $d = get_post_meta($rid, 'primary_event', true) ?: '';
                if ($d === $my_discipline) {
                    $disc_rpis[$rid] = (float) get_post_meta($rid, 'rpi', true);
                    $discipline_total++;
                }
            }
            arsort($disc_rpis);
            $rank = 1;
            foreach ($disc_rpis as $rid => $rpi_val) {
                if ((int) $rid === $rider_id) { $discipline_rank = $rank; break; }
                $rank++;
            }
        }

        return new WP_REST_Response(array(
            'state'            => $my_state,
            'state_rank'       => $state_rank,
            'state_total'      => $state_total,
            'discipline'       => $my_discipline,
            'discipline_rank'  => $discipline_rank,
            'discipline_total' => $discipline_total,
            'my_rpi'           => $my_rpi,
        ), 200);
    }

    /* ==========================================================================
    * UPGRADE URL — return WooCommerce checkout URL for a given RIN tier
    * GET /rpn/v1/upgrade-url?tier=competitor|contractor|organizer
    * ========================================================================== */
    function rpn_register_upgrade_url_route() {
        register_rest_route('rpn/v1', '/upgrade-url', array(
            'methods'             => 'GET',
            'callback'            => 'rpn_upgrade_url_callback',
            'permission_callback' => '__return_true',
            'args'                => array(
                'tier'     => array('required' => true,  'sanitize_callback' => 'sanitize_text_field'),
                'interval' => array('required' => false, 'sanitize_callback' => 'sanitize_text_field', 'default' => 'month'),
            ),
        ));
    }
    add_action('rest_api_init', 'rpn_register_upgrade_url_route');

    function rpn_upgrade_url_callback($request) {
        $tier     = $request->get_param('tier');
        $interval = $request->get_param('interval') ?: 'month';

        // Monthly and yearly WooCommerce product slugs per tier
        $slug_map = array(
            'competitor' => array('month' => 'rin-competitor',  'year' => 'rin-competitor-yearly'),
            'contractor' => array('month' => 'rin-contractor',  'year' => 'rin-contractor-yearly'),
            'organizer'  => array('month' => 'rin-organizer',   'year' => 'rin-organizer-yearly'),
            // Legacy aliases kept for backward compatibility
            'elite'      => array('month' => 'rin-contractor',  'year' => 'rin-contractor-yearly'),
            'producer'   => array('month' => 'rin-organizer',   'year' => 'rin-organizer-yearly'),
        );

        if (!isset($slug_map[$tier])) {
            return new WP_REST_Response(array('success' => false, 'message' => 'Invalid tier.'), 400);
        }

        $product_slug = isset($slug_map[$tier][$interval]) ? $slug_map[$tier][$interval] : $slug_map[$tier]['month'];

        if (!class_exists('WooCommerce')) {
            return new WP_REST_Response(array('success' => false, 'checkout_url' => null), 200);
        }

        $product_post = get_page_by_path($product_slug, OBJECT, 'product');
        if (!$product_post) {
            // Fall back to monthly if yearly product not found
            if ($interval === 'year') {
                $product_post = get_page_by_path($slug_map[$tier]['month'], OBJECT, 'product');
            }
            if (!$product_post) {
                return new WP_REST_Response(array('success' => false, 'checkout_url' => null, 'message' => 'Product not found: ' . $product_slug), 200);
            }
        }

        $product = wc_get_product($product_post->ID);
        if (!$product) {
            return new WP_REST_Response(array('success' => false, 'checkout_url' => null), 200);
        }

        $checkout_url = add_query_arg('add-to-cart', $product->get_id(), wc_get_checkout_url());

        // Wrap with a one-time auto-login token so the WP session is established
        // before WooCommerce checks login. Mirrors the same logic in /rpn/v1/join.
        $token   = $request->get_header('X-RPN-Auth') ?: $request->get_header('Authorization');
        if ($token && strpos($token, 'Bearer ') === 0) $token = substr($token, 7);
        $user_id = rpn_verify_token($token);

        if ($user_id) {
            $autologin_token = wp_generate_password(32, false, false);
            set_transient('rpn_autologin_' . $autologin_token, $user_id, 15 * MINUTE_IN_SECONDS);
            $checkout_url = add_query_arg(array(
                'rpn_autologin' => $autologin_token,
                'redir'         => rawurlencode($checkout_url),
            ), home_url('/'));
        }

        return new WP_REST_Response(array('success' => true, 'checkout_url' => $checkout_url), 200);
    }

    /* ==========================================================================
    * TRIAL EXPIRATION CRON — daily job that downgrades expired trial accounts
    * ========================================================================== */
    add_action('init', function() {
        if (!wp_next_scheduled('rpn_check_trial_expirations')) {
            wp_schedule_event(time(), 'daily', 'rpn_check_trial_expirations');
        }
    });

    add_action('rpn_check_trial_expirations', function() {
        $today = date('Y-m-d');
        $expired_users = get_users(array(
            'meta_key'     => 'rpn_trial_expires',
            'meta_compare' => '<=',
            'meta_value'   => $today,
            'fields'       => 'ids',
            'number'       => 500,
        ));
        foreach ($expired_users as $user_id) {
            update_user_meta($user_id, 'rpn_membership_tier', 'free');
            delete_user_meta($user_id, 'rpn_trial_expires');
            delete_user_meta($user_id, 'rpn_trial_tier');
        }
    });

    /* ==========================================================================
    * PUBLIC ATHLETE PROFILE — GET /rpn/v1/athletes/{rin_id}
    * Looks up a WP user by rpn_rin_id meta, returns the linked rider's public
    * profile in a format compatible with the React RiderDetailPage component.
    * No authentication required — this is a public endpoint.
    * ========================================================================== */
    function rpn_register_athletes_route() {
        register_rest_route('rpn/v1', '/athletes/(?P<rin_id>[A-Z0-9\-]+)', array(
            'methods'             => 'GET',
            'callback'            => 'rpn_athlete_profile_callback',
            'permission_callback' => '__return_true',
            'args'                => array(
                'rin_id' => array(
                    'required'          => true,
                    'sanitize_callback' => 'sanitize_text_field',
                ),
            ),
        ));
    }
    add_action('rest_api_init', 'rpn_register_athletes_route');

    function rpn_athlete_profile_callback($request) {
        $rin_id = strtoupper(trim($request->get_param('rin_id')));
        if (!$rin_id) {
            return new WP_REST_Response(array('success' => false, 'message' => 'RIN ID is required.'), 400);
        }

        // Find the WP user with this RIN ID
        $users = get_users(array(
            'meta_key'   => 'rpn_rin_id',
            'meta_value' => $rin_id,
            'number'     => 1,
            'fields'     => 'ids',
        ));
        if (empty($users)) {
            return new WP_REST_Response(array('success' => false, 'message' => 'Athlete not found.'), 404);
        }
        $user_id = (int) $users[0];

        // Get the linked rider post
        $linked_rider_id = (int) get_user_meta($user_id, 'rpn_linked_rider_id', true);
        if (!$linked_rider_id) {
            return new WP_REST_Response(array('success' => false, 'message' => 'No rider profile linked to this RIN ID.'), 404);
        }

        $rider_post = get_post($linked_rider_id);
        if (!$rider_post || $rider_post->post_status !== 'publish') {
            return new WP_REST_Response(array('success' => false, 'message' => 'Rider profile not found or not published.'), 404);
        }

        $membership_tier = get_user_meta($user_id, 'rpn_membership_tier', true) ?: 'free';

        // Gather all post meta for the rider
        $m = function($key, $default = '') use ($linked_rider_id) {
            $val = get_post_meta($linked_rider_id, $key, true);
            return ($val !== '' && $val !== false && $val !== null) ? $val : $default;
        };

        // Featured image URL
        $featured_image_url = '';
        $thumbnail_id = get_post_thumbnail_id($linked_rider_id);
        if ($thumbnail_id) {
            $img_data = wp_get_attachment_image_src($thumbnail_id, 'large');
            if ($img_data) $featured_image_url = $img_data[0];
        }

        // Secondary events and associations (may be serialized arrays)
        $secondary_events = maybe_unserialize($m('secondary_events', []));
        if (!is_array($secondary_events)) $secondary_events = [];

        $association_memberships = maybe_unserialize($m('association_memberships', []));
        if (!is_array($association_memberships)) $association_memberships = [];

        $video_highlights = maybe_unserialize($m('video_highlights', []));
        if (!is_array($video_highlights)) $video_highlights = [];

        $linked_animals_raw = maybe_unserialize($m('linked_animals', []));
        if (!is_array($linked_animals_raw)) {
            $linked_animals_raw = $linked_animals_raw ? array_map('intval', explode(',', (string)$linked_animals_raw)) : [];
        }

        return new WP_REST_Response(array(
            'success'    => true,
            'id'         => $linked_rider_id,
            'slug'       => $rider_post->post_name,
            'rin_id'     => $rin_id,
            'title'      => array('rendered' => esc_html($rider_post->post_title)),
            'content'    => array('rendered' => apply_filters('the_content', $rider_post->post_content)),
            'membership_tier' => $membership_tier,
            'featured_image_url' => $featured_image_url,
            'meta'       => array(
                // RPI scores
                'rpi'                    => $m('rpi') !== '' ? (float)$m('rpi') : null,
                'rpi_roughstock'         => $m('rpi_roughstock') !== '' ? (float)$m('rpi_roughstock') : null,
                'rpi_timed'              => $m('rpi_timed') !== '' ? (float)$m('rpi_timed') : null,
                // Location
                'state'                  => $m('state'),
                'city'                   => $m('city'),
                'country'                => $m('country', 'United States'),
                // Personal
                'nickname'               => $m('nickname'),
                'date_of_birth'          => $m('date_of_birth'),
                'gender'                 => $m('gender'),
                'age_group'              => $m('age_group'),
                // Competition
                'division'               => $m('division'),
                'primary_event'          => $m('primary_event'),
                'years_competing'        => $m('years_competing') !== '' ? (int)$m('years_competing') : null,
                'secondary_events'       => $secondary_events,
                'association_memberships'=> $association_memberships,
                // Social
                'instagram_url'          => $m('instagram_url'),
                'tiktok_url'             => $m('tiktok_url'),
                'facebook_url'           => $m('facebook_url'),
                'twitter_url'            => $m('twitter_url'),
                'youtube_url'            => $m('youtube_url'),
                'personal_website'       => $m('personal_website'),
                // Video highlights
                'video_highlights'       => $video_highlights,
                // Linked animals
                'linked_animals'         => $linked_animals_raw,
                // Membership
                'premium_member'         => in_array($membership_tier, array('competitor', 'elite', 'producer'), true),
                'digital_card_status'    => $m('digital_card_status', 'inactive'),
            ),
        ), 200);
    }

    /* ==========================================================================
    * Section 9 — SRI (Stock Rating Index) & TEI (Timed Event Index)
    *
    * SRI — roughstock animals (bulls / broncs):
    *   1. Collect all roughstock performances where animal_id = $animal_id & use_for_rpi = true
    *   2. total_rides     = count of all such records
    *   3. covered_rides   = count where qualified_ride = 'true'
    *   4. completion_rate = covered_rides / total_rides
    *   5. animal_pts[]    = animal_score values from COVERED rides (judge pts for the animal, 0–50)
    *   6. avg_animal_pts  = mean of animal_pts (0 if empty)
    *   7. difficulty      = 1 + (1 − completion_rate) × 0.5
    *      — 100 % coverage → 1.00× (easy animal)
    *      — 50 % coverage  → 1.25× (moderate difficulty)
    *      —  0 % coverage  → 1.50× (unrideable; avg=0 so SRI=0)
    *   8. SRI             = round(avg_animal_pts × difficulty, 2)
    *      Range: 0–75; higher = better / harder animal
    *
    * TEI — timed-event horses (barrel, pole, tie-down, etc.):
    *   1. Collect all timed performances where animal_id = $animal_id & use_for_rpi = true
    *   2. total_runs    = count of all such records
    *   3. official[]    = adjusted_score for runs where no_time = 'false'
    *   4. clean_count   = count of those runs where clean_run = 'true'
    *   5. avg_adj       = mean of official[] (0 if empty)
    *   6. clean_rate    = clean_count / count(official)
    *   7. TEI           = round(avg_adj × clean_rate, 2)
    *      BHI            = TEI when scoring_type = 'barrel' or event_category contains 'Barrel'
    * ========================================================================== */

    /**
     * Population standard deviation of an array of floats.
     * Returns 0 if fewer than 2 values.
     */
    function rpn_std_dev( $arr ) {
        $n = count( $arr );
        if ( $n < 2 ) return 0.0;
        $mean     = array_sum( $arr ) / $n;
        $variance = 0.0;
        foreach ( $arr as $v ) {
            $variance += ( (float) $v - $mean ) ** 2;
        }
        return sqrt( $variance / $n );
    }

    function rpn_calc_sri_roughstock_animal( $avg_animal_pts, $completion_rate ) {
        $avg        = (float) $avg_animal_pts;
        $cr         = max( 0.0, min( 1.0, (float) $completion_rate ) );
        $difficulty = 1.0 + ( 1.0 - $cr ) * 0.5;
        return round( $avg * $difficulty, 2 );
    }
    // Note: rpn_calc_sri_roughstock_animal() is kept for backward compatibility only.
    // The full spec formula is implemented in rpn_update_animal_sri() below.

    function rpn_calc_tei_timed_animal( $avg_adjusted_score, $clean_rate ) {
        $avg = (float) $avg_adjusted_score;
        $cr  = max( 0.0, min( 1.0, (float) $clean_rate ) );
        return round( $avg * $cr, 2 );
    }

    /**
     * Query all performances linked to $animal_id and recompute SRI (roughstock)
     * and/or TEI/BHI (timed), then persist the values to the animal post meta.
     *
     * Called automatically whenever a performance with animal_id > 0 is saved
     * (via admin meta box or /rpn/v1/my-scores REST endpoint).
     */
    function rpn_update_animal_sri( $animal_id ) {
        if ( $animal_id <= 0 ) return;

        $scoring_type = (string) get_post_meta( $animal_id, 'scoring_type', true );

        $all_perfs = get_posts( array(
            'post_type'      => 'rpn_performance',
            'post_status'    => 'publish',
            'posts_per_page' => 500,
            'meta_query'     => array(
                array( 'key' => 'animal_id', 'value' => $animal_id, 'type' => 'NUMERIC' ),
            ),
        ) );

        if ( empty( $all_perfs ) ) return;

        $today        = new DateTime( 'now', new DateTimeZone( 'UTC' ) );
        $current_year = (int) $today->format( 'Y' );

        // ── Roughstock buckets (Section 10 — full spec) ───────────────────────
        $rough_total              = 0;
        $rough_covered            = 0;
        $rough_current_weighted   = array(); // recency+tier weighted, last 365 days, covered only
        $rough_season_scores      = array(); // covered score_pct, current calendar year
        $rough_career_scores      = array(); // covered score_pct, all-time
        $rough_recent_90          = array(); // covered score_pct, 0–89 days ago (trend)
        $rough_prior_90           = array(); // covered score_pct, 90–179 days ago (trend)
        $rough_all_score_pct      = array(); // covered score_pct, all-time (for std dev + avg)

        // ── Timed buckets (unchanged) ─────────────────────────────────────────
        $timed_total     = 0;
        $timed_adj       = array();
        $timed_clean     = 0;
        $first_timed_cat = '';

        foreach ( $all_perfs as $p ) {
            if ( get_post_meta( $p->ID, 'use_for_rpi', true ) === 'false' ) continue;

            $ptype = get_post_meta( $p->ID, 'performance_type', true );

            if ( $ptype === 'roughstock' ) {
                $rough_total++;
                $qualified = get_post_meta( $p->ID, 'qualified_ride', true ) === 'true';
                if ( $qualified ) {
                    $rough_covered++;
                    $raw_pts   = (float) get_post_meta( $p->ID, 'animal_score', true ); // 0–50
                    $score_pct = ( $raw_pts / 50.0 ) * 100.0;                           // 0–100
                    $rough_all_score_pct[] = $score_pct;
                    $rough_career_scores[] = $score_pct;

                    $date_str   = (string) get_post_meta( $p->ID, 'performance_date', true );
                    $event_tier = (string) get_post_meta( $p->ID, 'event_tier',       true );

                    if ( $date_str ) {
                        try {
                            $event_dt = new DateTime( $date_str, new DateTimeZone( 'UTC' ) );
                        } catch ( Exception $e ) {
                            $event_dt = null;
                        }
                        if ( $event_dt ) {
                            $days_old   = (int) $today->diff( $event_dt )->days;
                            $event_year = (int) $event_dt->format( 'Y' );

                            if ( $event_year === $current_year ) {
                                $rough_season_scores[] = $score_pct;
                            }
                            if ( $days_old < 365 ) {
                                $weight    = rpn_get_time_decay_weight( $days_old );
                                $tier_mult = rpn_get_tier_modifier( $event_tier );
                                $rough_current_weighted[] = array(
                                    'score'  => min( 100.0, $score_pct * $tier_mult ),
                                    'weight' => $weight,
                                );
                            }
                            if ( $days_old < 90 ) {
                                $rough_recent_90[] = $score_pct;
                            } elseif ( $days_old < 180 ) {
                                $rough_prior_90[] = $score_pct;
                            }
                        }
                    }
                }
            } elseif ( $ptype === 'timed' ) {
                $timed_total++;
                if ( empty( $first_timed_cat ) ) {
                    $first_timed_cat = (string) get_post_meta( $p->ID, 'event_category', true );
                }
                $no_time = get_post_meta( $p->ID, 'no_time', true ) === 'true';
                if ( ! $no_time ) {
                    $timed_adj[] = (float) get_post_meta( $p->ID, 'adjusted_score', true );
                    if ( get_post_meta( $p->ID, 'clean_run', true ) === 'true' ) {
                        $timed_clean++;
                    }
                }
            }
        }

        // ── Compute and persist full SRI (Section 10 spec) ───────────────────
        if ( $rough_total > 0 ) {
            $buckoff_rate      = ( $rough_total - $rough_covered ) / (float) $rough_total;
            $buckoff_component = $buckoff_rate * 100.0;

            // avg_animal_score on 0–50 scale (for display / backward compat)
            $avg_animal_score_raw = count( $rough_all_score_pct ) > 0
                ? ( array_sum( $rough_all_score_pct ) / count( $rough_all_score_pct ) ) * 0.5
                : 0.0;

            // Consistency bonus: std dev of all covered animal_score_pct values
            $std_dev = rpn_std_dev( $rough_all_score_pct );
            if ( $rough_covered === 0 )     $consistency_bonus = 0;
            elseif ( $std_dev < 8.0 )       $consistency_bonus = 3;
            elseif ( $std_dev < 15.0 )      $consistency_bonus = 1;
            else                             $consistency_bonus = -2;

            // sri_current — recency+tier weighted avg (last 365 days covered) + buckoff + bonus
            $sri_current = 0.0;
            if ( ! empty( $rough_current_weighted ) ) {
                $ws = 0.0; $tw = 0.0;
                foreach ( $rough_current_weighted as $item ) {
                    $ws += $item['score'] * $item['weight'];
                    $tw += $item['weight'];
                }
                $avg_w       = $tw > 0 ? $ws / $tw : 0.0;
                $sri_base    = ( $avg_w * 0.60 ) + ( $buckoff_component * 0.40 );
                $sri_current = (float) max( 0.0, min( 100.0, round( $sri_base + $consistency_bonus, 2 ) ) );
            } elseif ( $rough_covered > 0 ) {
                // All covered rides older than 365 days — fall back to career avg
                $avg_c       = array_sum( $rough_career_scores ) / count( $rough_career_scores );
                $sri_base    = ( $avg_c * 0.60 ) + ( $buckoff_component * 0.40 );
                $sri_current = (float) max( 0.0, min( 100.0, round( $sri_base + $consistency_bonus, 2 ) ) );
            }

            // sri_season — current-year covered scores + buckoff + bonus
            $sri_season = 0.0;
            if ( ! empty( $rough_season_scores ) ) {
                $avg_s    = array_sum( $rough_season_scores ) / count( $rough_season_scores );
                $sri_base = ( $avg_s * 0.60 ) + ( $buckoff_component * 0.40 );
                $sri_season = (float) max( 0.0, min( 100.0, round( $sri_base + $consistency_bonus, 2 ) ) );
            }

            // sri_career — all-time covered scores + buckoff + bonus
            $sri_career = 0.0;
            if ( ! empty( $rough_career_scores ) ) {
                $avg_c    = array_sum( $rough_career_scores ) / count( $rough_career_scores );
                $sri_base = ( $avg_c * 0.60 ) + ( $buckoff_component * 0.40 );
                $sri_career = (float) max( 0.0, min( 100.0, round( $sri_base + $consistency_bonus, 2 ) ) );
            }

            // sri_status
            if ( $rough_total >= 10 )    $sri_status = 'Established';
            elseif ( $rough_total >= 5 ) $sri_status = 'Emerging';
            else                          $sri_status = 'Provisional';

            // sri_trend_90d
            $sri_trend_90d = 0.0;
            if ( ! empty( $rough_recent_90 ) && ! empty( $rough_prior_90 ) ) {
                $recent_avg    = array_sum( $rough_recent_90 ) / count( $rough_recent_90 );
                $prior_avg     = array_sum( $rough_prior_90 )  / count( $rough_prior_90 );
                $sri_trend_90d = (float) round( $recent_avg - $prior_avg, 2 );
            }

            update_post_meta( $animal_id, 'sri',               $sri_current ); // backward-compat alias
            update_post_meta( $animal_id, 'sri_current',        $sri_current );
            update_post_meta( $animal_id, 'sri_season',         $sri_season );
            update_post_meta( $animal_id, 'sri_career',         $sri_career );
            update_post_meta( $animal_id, 'sri_status',         $sri_status );
            update_post_meta( $animal_id, 'sri_trend_90d',      $sri_trend_90d );
            update_post_meta( $animal_id, 'buckoff_rate',       round( $buckoff_rate * 100.0, 2 ) );
            update_post_meta( $animal_id, 'avg_animal_score',   round( $avg_animal_score_raw, 2 ) );
            update_post_meta( $animal_id, 'total_animal_rides', $rough_total );
        }

        // ── Compute and persist TEI + timed breakdown ────────────────────────
        if ( $timed_total > 0 && count( $timed_adj ) > 0 ) {
            $avg_adj    = array_sum( $timed_adj ) / count( $timed_adj );
            $clean_rate = $timed_clean / count( $timed_adj );
            $tei        = rpn_calc_tei_timed_animal( $avg_adj, $clean_rate );
            update_post_meta( $animal_id, 'tei',             round( $tei, 2 ) );
            update_post_meta( $animal_id, 'clean_run_rate',  round( $clean_rate * 100, 2 ) );
            update_post_meta( $animal_id, 'total_animal_runs', $timed_total );

            // Average run time — query final_time from timed performances
            $time_values = array();
            foreach ( $all_perfs as $p ) {
                if ( get_post_meta( $p->ID, 'performance_type', true ) !== 'timed' ) continue;
                if ( get_post_meta( $p->ID, 'no_time', true ) === 'true' ) continue;
                $ft = (float) get_post_meta( $p->ID, 'final_time', true );
                if ( $ft > 0 ) $time_values[] = $ft;
            }
            if ( ! empty( $time_values ) ) {
                update_post_meta( $animal_id, 'avg_run_time',
                    round( array_sum( $time_values ) / count( $time_values ), 3 ) );
            }

            // Also set BHI when this is a barrel horse
            $is_barrel = ( $scoring_type === 'barrel' )
                || ( stripos( $first_timed_cat, 'Barrel' ) !== false );
            if ( $is_barrel ) {
                update_post_meta( $animal_id, 'bhi', round( $tei, 2 ) );
            }
        }

        // Always recalculate TPI for timed animals
        rpn_update_animal_tpi( $animal_id );

        // Propagate to CRI: if this animal is linked to a contractor, update their index
        $linked_contractor = (int) get_post_meta( $animal_id, 'contractor_id', true );
        if ( $linked_contractor > 0 ) {
            rpn_update_contractor_cri( $linked_contractor );
        }
    }

    /* ==========================================================================
    * Section 9 — TPI (Timed Performance Index)
    *
    * TPI is a 0–100 index measuring how well a PERFORMANCE HORSE competes in
    * timed events (barrel racing, roping, steer wrestling, etc.).
    *
    * Per-run score:
    *   - no_time OR not a clean run → horse_run_score = 0
    *   - Otherwise: compare final_time to the field's winning_time and
    *     avg_clean_time in the same event + go_round:
    *       relative_ratio = (final_time − winning_time) / (avg_clean_time − winning_time)
    *       horse_run_score = 100 − (relative_ratio × 30), clamped [40, 100]
    *       (special case: denominator ≤ 0 → score = 100)
    *
    * Phase 1 note: when no event_id is available the field comparison is
    * skipped and the run scores 70 (neutral placeholder). TPI improves
    * automatically once performances are properly linked to events.
    *
    * Fields stored on the animal post:
    *   tpi_current        — weighted avg of last 365 days (recency-decayed + consistency)
    *   tpi_season         — simple avg for current calendar year + consistency
    *   tpi_career         — simple avg of all runs (no consistency bonus)
    *   tpi_status         — Provisional (0-4) / Emerging (5-9) / Established (10+)
    *   tpi_trend_90d      — recent 90-day avg minus prior 90-day avg
    *   avg_time_clean_runs — mean final_time across all clean runs
    *   (clean_run_rate and total_animal_runs are maintained by rpn_update_animal_sri)
    * ========================================================================== */

    /**
     * Calculate the per-run horse score for one timed performance.
     * Queries all other performances in the same event + go_round for field context.
     *
     * Returns 0.0 for no-time / unclean runs, 40–100 for clean runs,
     * or 70.0 as a neutral placeholder when field context cannot be determined.
     */
    function rpn_calc_tpi_horse_run_score( $final_time, $no_time, $clean_run, $event_id, $go_round ) {
        // No-time or not a clean run counts against the horse (score = 0)
        if ( $no_time || ! $clean_run || $final_time <= 0 ) return 0.0;

        // No event context → can't compare to field (Phase 1 fallback)
        if ( ! $event_id ) return 70.0;

        // Build meta query to find all official-time runs in same event + go_round
        $meta_q = array(
            'relation' => 'AND',
            array( 'key' => 'event_id',         'value' => $event_id, 'type' => 'NUMERIC' ),
            array( 'key' => 'performance_type',  'value' => 'timed' ),
            array( 'key' => 'no_time',           'value' => 'true',  'compare' => '!=' ),
        );
        if ( $go_round ) {
            $meta_q[] = array( 'key' => 'go_round', 'value' => $go_round );
        }

        $field_ids = get_posts( array(
            'post_type'      => 'rpn_performance',
            'post_status'    => 'publish',
            'posts_per_page' => 200,
            'fields'         => 'ids',
            'meta_query'     => $meta_q,
        ) );

        if ( empty( $field_ids ) ) return 70.0; // Horse ran alone in field

        $official_times    = array();
        $clean_field_times = array();
        foreach ( $field_ids as $fid ) {
            $ft = (float) get_post_meta( $fid, 'final_time', true );
            if ( $ft <= 0 ) continue;
            $official_times[] = $ft;
            if ( get_post_meta( $fid, 'clean_run', true ) === 'true' ) {
                $clean_field_times[] = $ft;
            }
        }

        if ( empty( $official_times ) ) return 70.0;

        $winning_time   = min( $official_times );
        $avg_clean_time = ! empty( $clean_field_times )
            ? array_sum( $clean_field_times ) / count( $clean_field_times )
            : $winning_time;

        $denominator = $avg_clean_time - $winning_time;
        if ( $denominator <= 0.0 ) return 100.0; // All runners tied at best time

        $relative_ratio = ( $final_time - $winning_time ) / $denominator;
        $score          = 100.0 - ( $relative_ratio * 30.0 );
        return (float) min( 100.0, max( 40.0, round( $score, 2 ) ) );
    }

    /**
     * Recalculate and persist all TPI fields for $animal_id.
     * Called automatically at the end of rpn_update_animal_sri().
     */
    function rpn_update_animal_tpi( $animal_id ) {
        if ( $animal_id <= 0 ) return;

        // Only timed performances linked to this animal
        $all_perfs = get_posts( array(
            'post_type'      => 'rpn_performance',
            'post_status'    => 'publish',
            'posts_per_page' => 500,
            'meta_query'     => array(
                'relation' => 'AND',
                array( 'key' => 'animal_id',        'value' => $animal_id, 'type' => 'NUMERIC' ),
                array( 'key' => 'performance_type',  'value' => 'timed' ),
            ),
        ) );

        if ( empty( $all_perfs ) ) return;

        $today        = new DateTime( 'now', new DateTimeZone( 'UTC' ) );
        $current_year = (int) $today->format( 'Y' );

        $current_weighted  = array(); // [ 'score' => float, 'weight' => float ]
        $season_scores     = array();
        $career_scores     = array();
        $recent_90_scores  = array(); // 0–89 days ago (for trend)
        $prior_90_scores   = array(); // 90–179 days ago (for trend)
        $clean_times       = array(); // final_time for clean runs (for avg_time_clean_runs)
        $total_run_count   = 0;
        $clean_run_count   = 0;

        foreach ( $all_perfs as $p ) {
            if ( get_post_meta( $p->ID, 'use_for_rpi', true ) === 'false' ) continue;

            $no_time    = get_post_meta( $p->ID, 'no_time',    true ) === 'true';
            $clean_run  = get_post_meta( $p->ID, 'clean_run',  true ) === 'true';
            $final_time = (float) get_post_meta( $p->ID, 'final_time', true );
            $event_id   = (int) get_post_meta( $p->ID, 'event_id',   true );
            $go_round   = (string) get_post_meta( $p->ID, 'go_round',  true );
            $event_tier = (string) get_post_meta( $p->ID, 'event_tier', true );
            $date_str   = (string) get_post_meta( $p->ID, 'performance_date', true );

            $total_run_count++;

            // Track clean runs and their times
            if ( $clean_run && $final_time > 0 ) {
                $clean_run_count++;
                $clean_times[] = $final_time;
            }

            // Per-run score using field comparison
            $horse_run_score = rpn_calc_tpi_horse_run_score(
                $final_time, $no_time, $clean_run, $event_id, $go_round
            );

            // Apply event tier multiplier, cap at 100
            $tier_multiplier    = rpn_get_tier_modifier( $event_tier );
            $weighted_run_score = min( 100.0, (float) $horse_run_score * $tier_multiplier );

            // Career: every run counted
            $career_scores[] = $weighted_run_score;

            // Date-based buckets require a valid date
            if ( ! $date_str ) continue;
            try {
                $event_dt = new DateTime( $date_str, new DateTimeZone( 'UTC' ) );
            } catch ( Exception $e ) {
                continue;
            }
            $days_old   = (int) $today->diff( $event_dt )->days;
            $event_year = (int) $event_dt->format( 'Y' );

            // Season: current calendar year
            if ( $event_year === $current_year ) {
                $season_scores[] = $weighted_run_score;
            }

            // Current: last 365 days with recency decay
            if ( $days_old < 365 ) {
                $weight = rpn_get_time_decay_weight( $days_old );
                $current_weighted[] = array( 'score' => $weighted_run_score, 'weight' => $weight );
            }

            // Trend buckets
            if ( $days_old < 90 ) {
                $recent_90_scores[] = $weighted_run_score;
            } elseif ( $days_old < 180 ) {
                $prior_90_scores[] = $weighted_run_score;
            }
        }

        if ( $total_run_count === 0 ) return;

        // Consistency bonus/penalty: (clean_rate − 0.50) × 10, clamped ±5
        $consistency = (float) max( -5.0, min( 5.0,
            ( ( (float) $clean_run_count / (float) $total_run_count ) - 0.50 ) * 10.0
        ) );

        // tpi_current — recency-weighted average + consistency
        $tpi_current = 0.0;
        if ( ! empty( $current_weighted ) ) {
            $ws = 0.0; $tw = 0.0;
            foreach ( $current_weighted as $item ) {
                $ws += $item['score'] * $item['weight'];
                $tw += $item['weight'];
            }
            $base        = $tw > 0 ? $ws / $tw : 0.0;
            $tpi_current = (float) max( 0.0, min( 100.0, round( $base + $consistency, 2 ) ) );
        }

        // tpi_season — simple average of current-year runs + consistency
        $tpi_season = 0.0;
        if ( ! empty( $season_scores ) ) {
            $base       = array_sum( $season_scores ) / count( $season_scores );
            $tpi_season = (float) max( 0.0, min( 100.0, round( $base + $consistency, 2 ) ) );
        }

        // tpi_career — simple average of all runs (no consistency adjustment)
        $tpi_career = 0.0;
        if ( ! empty( $career_scores ) ) {
            $tpi_career = (float) max( 0.0, min( 100.0,
                round( array_sum( $career_scores ) / count( $career_scores ), 2 )
            ) );
        }

        // tpi_status
        if ( $total_run_count >= 10 ) {
            $tpi_status = 'Established';
        } elseif ( $total_run_count >= 5 ) {
            $tpi_status = 'Emerging';
        } else {
            $tpi_status = 'Provisional';
        }

        // tpi_trend_90d — recent 90-day avg minus prior 90-day avg
        $tpi_trend_90d = 0.0;
        if ( ! empty( $recent_90_scores ) && ! empty( $prior_90_scores ) ) {
            $recent_avg    = array_sum( $recent_90_scores ) / count( $recent_90_scores );
            $prior_avg     = array_sum( $prior_90_scores )  / count( $prior_90_scores );
            $tpi_trend_90d = (float) round( $recent_avg - $prior_avg, 2 );
        }

        // avg_time_clean_runs
        $avg_time_clean_runs = 0.0;
        if ( ! empty( $clean_times ) ) {
            $avg_time_clean_runs = round( array_sum( $clean_times ) / count( $clean_times ), 3 );
        }

        // Persist all TPI fields
        update_post_meta( $animal_id, 'tpi_current',         $tpi_current );
        update_post_meta( $animal_id, 'tpi_season',           $tpi_season );
        update_post_meta( $animal_id, 'tpi_career',           $tpi_career );
        update_post_meta( $animal_id, 'tpi_status',           $tpi_status );
        update_post_meta( $animal_id, 'tpi_trend_90d',        $tpi_trend_90d );
        update_post_meta( $animal_id, 'avg_time_clean_runs',  $avg_time_clean_runs );
    }

    /* ==========================================================================
    * Section 10 — PTI (Pickup Team Index)
    *
    * Pickup teams work roughstock events. Their PTI is derived from three
    * metadata fields maintained by the admin or the team itself:
    *
    *   tagged_rescues    — number of documented event rescues / assists
    *   years_experience  — years the team has been operating
    *   horses_used       — comma-separated list of horses in the team's string
    *
    * Formula (100-point scale):
    *   rescues_score    = min(tagged_rescues    × 2.0,  50)   → max 50 pts
    *   experience_score = min(years_experience  × 3.0,  30)   → max 30 pts
    *   horse_score      = min(horse_count       × 2.0,  20)   → max 20 pts
    *   PTI              = round(rescues_score + experience_score + horse_score, 2)
    *   Range: 0–100
    *
    * PTI is recalculated automatically every time the pickup_team CPT post
    * is saved in WP Admin (via save_post_pickup_team hook).
    * ========================================================================== */

    function rpn_calc_pickup_team_pti( $tagged_rescues, $years_experience, $horse_count ) {
        $rescues_score    = min( (float) $tagged_rescues   * 2.0, 50.0 );
        $experience_score = min( (float) $years_experience * 3.0, 30.0 );
        $horse_score      = min( (float) $horse_count      * 2.0, 20.0 );
        return round( $rescues_score + $experience_score + $horse_score, 2 );
    }

    /**
     * Read the pickup team's meta fields, compute PTI, and persist it.
     */
    function rpn_update_pickup_team_pti( $pickup_team_id ) {
        if ( $pickup_team_id <= 0 ) return;

        $tagged_rescues   = (int)    get_post_meta( $pickup_team_id, 'tagged_rescues',   true );
        $years_experience = (int)    get_post_meta( $pickup_team_id, 'years_experience', true );
        $horses_used      = (string) get_post_meta( $pickup_team_id, 'horses_used',      true );

        $horse_count = 0;
        if ( ! empty( $horses_used ) ) {
            $horse_list  = array_filter( array_map( 'trim', explode( ',', $horses_used ) ) );
            $horse_count = count( $horse_list );
        }

        $pti = rpn_calc_pickup_team_pti( $tagged_rescues, $years_experience, $horse_count );
        update_post_meta( $pickup_team_id, 'pti', $pti );
    }

    /** Auto-recalculate PTI whenever a pickup_team post is saved in WP Admin. */
    add_action( 'save_post_pickup_team', 'rpn_pickup_team_recalc_pti_on_save' );
    function rpn_pickup_team_recalc_pti_on_save( $post_id ) {
        if ( defined( 'DOING_AUTOSAVE' ) && DOING_AUTOSAVE ) return;
        if ( ! current_user_can( 'edit_post', $post_id ) ) return;
        rpn_update_pickup_team_pti( $post_id );
    }

    /* ==========================================================================
    * Bulk recalculate endpoint — admin-only
    * POST /rpn/v1/recalculate-indexes
    *
    * Recomputes RPI for all riders, SRI/TEI for all animals that have linked
    * performances, and PTI for all pickup teams. Useful after bulk-importing
    * performances or when first deploying the SRI/TPI feature.
    * ========================================================================== */
    add_action( 'rest_api_init', 'rpn_register_recalculate_indexes_route' );
    function rpn_register_recalculate_indexes_route() {
        register_rest_route( 'rpn/v1', '/recalculate-indexes', array(
            'methods'             => 'POST',
            'permission_callback' => function () { return current_user_can( 'manage_options' ); },
            'callback'            => 'rpn_recalculate_indexes_callback',
        ) );
    }

    function rpn_recalculate_indexes_callback( $request ) {
        // ── Riders: RPI ───────────────────────────────────────────────────────
        $riders = get_posts( array(
            'post_type'      => 'rider',
            'post_status'    => 'publish',
            'posts_per_page' => 1000,
            'fields'         => 'ids',
        ) );
        foreach ( $riders as $rid ) {
            rpn_update_rider_index_from_performances( $rid );
            rpn_refresh_rider_season_stats( $rid );
        }

        // ── Animals: SRI / TEI / BHI ──────────────────────────────────────────
        // Only process animals that have at least one linked performance.
        $animal_ids_with_perfs = get_posts( array(
            'post_type'      => 'rpn_performance',
            'post_status'    => 'publish',
            'posts_per_page' => 500,
            'meta_query'     => array(
                array( 'key' => 'animal_id', 'value' => 0, 'compare' => '>', 'type' => 'NUMERIC' ),
            ),
            'fields'         => 'ids',
        ) );

        $unique_animals = array();
        foreach ( $animal_ids_with_perfs as $pid ) {
            $aid = (int) get_post_meta( $pid, 'animal_id', true );
            if ( $aid > 0 ) $unique_animals[ $aid ] = true;
        }
        foreach ( array_keys( $unique_animals ) as $aid ) {
            rpn_update_animal_sri( $aid );
        }

        // ── Pickup Teams: PTI ─────────────────────────────────────────────────
        $teams = get_posts( array(
            'post_type'      => 'pickup_team',
            'post_status'    => 'publish',
            'posts_per_page' => 200,
            'fields'         => 'ids',
        ) );
        foreach ( $teams as $tid ) {
            rpn_update_pickup_team_pti( $tid );
        }

        return new WP_REST_Response( array(
            'success'         => true,
            'riders_updated'  => count( $riders ),
            'animals_updated' => count( $unique_animals ),
            'teams_updated'   => count( $teams ),
        ), 200 );
    }

    /* ==========================================================================
    * Helper: build monthly RPI history for sparkline chart
    * Groups all a rider's performance posts by calendar month and returns
    * the average weighted_event_score per month (last 24 months max).
    * ========================================================================== */
    function rpn_get_rpi_history( $rider_id ) {
        $perfs = get_posts( array(
            'post_type'      => 'rpn_performance',
            'post_status'    => 'publish',
            'posts_per_page' => 500,
            'meta_query'     => array(
                array( 'key' => 'rider_id',    'value' => $rider_id, 'type' => 'NUMERIC' ),
                array( 'key' => 'use_for_rpi', 'value' => 'false',   'compare' => '!=' ),
            ),
        ) );

        $monthly = array();
        foreach ( $perfs as $p ) {
            $date = get_post_meta( $p->ID, 'performance_date', true );
            $wes  = (float) get_post_meta( $p->ID, 'weighted_event_score', true );
            if ( ! $wes ) $wes = (float) get_post_meta( $p->ID, 'adjusted_score', true );
            if ( ! $date || ! $wes ) continue;
            $month = substr( $date, 0, 7 ); // "YYYY-MM"
            $monthly[ $month ][] = $wes;
        }

        ksort( $monthly );
        $history = array();
        foreach ( $monthly as $month => $scores ) {
            $history[] = array(
                'month' => $month,
                'rpi'   => round( array_sum( $scores ) / count( $scores ), 1 ),
                'count' => count( $scores ),
            );
        }
        return array_slice( $history, -24 ); // last 24 months
    }

    /* ==========================================================================
    * /rpn/v1/search-animals  GET (public)
    * Search for animal posts by name — used in the animal-claim flow.
    * ========================================================================== */
    add_action( 'rest_api_init', 'rpn_register_search_animals_route' );
    function rpn_register_search_animals_route() {
        register_rest_route( 'rpn/v1', '/search-animals', array(
            'methods'             => 'GET',
            'permission_callback' => '__return_true',
            'callback'            => 'rpn_search_animals_callback',
        ) );
    }

    function rpn_search_animals_callback( $request ) {
        $name = sanitize_text_field( $request->get_param( 'name' ) ?? '' );
        if ( strlen( $name ) < 2 ) {
            return new WP_REST_Response( array( 'results' => array(), 'message' => 'Enter at least 2 characters.' ), 200 );
        }

        $animals = get_posts( array(
            'post_type'      => 'animal',
            'post_status'    => 'publish',
            'posts_per_page' => 10,
            's'              => $name,
        ) );

        $results = array();
        foreach ( $animals as $a ) {
            $owner_id        = (int) get_post_meta( $a->ID, 'rpn_owner_user_id', true );
            $already_claimed = $owner_id > 0;
            $results[] = array(
                'id'              => $a->ID,
                'name'            => $a->post_title,
                'animal_type'     => get_post_meta( $a->ID, 'animal_type', true ) ?: '',
                'already_claimed' => $already_claimed,
            );
        }

        return new WP_REST_Response( array( 'results' => $results ), 200 );
    }

    /* ==========================================================================
    * /rpn/v1/claim-animal  POST (auth required)
    * Link an existing animal post to the authenticated user's contractor account.
    * ========================================================================== */
    add_action( 'rest_api_init', 'rpn_register_claim_animal_route' );
    function rpn_register_claim_animal_route() {
        register_rest_route( 'rpn/v1', '/claim-animal', array(
            'methods'             => 'POST',
            'permission_callback' => '__return_true',
            'callback'            => 'rpn_claim_animal_callback',
        ) );
    }

    function rpn_claim_animal_callback( $request ) {
        $user_id = rpn_require_auth( $request );
        if ( $user_id instanceof WP_REST_Response ) return $user_id;

        $params    = $request->get_json_params();
        $animal_id = absint( $params['animal_id'] ?? 0 );

        if ( ! $animal_id ) {
            return new WP_REST_Response( array( 'success' => false, 'message' => 'Animal ID required.' ), 400 );
        }

        $animal = get_post( $animal_id );
        if ( ! $animal || $animal->post_type !== 'animal' ) {
            return new WP_REST_Response( array( 'success' => false, 'message' => 'Animal not found.' ), 404 );
        }

        $existing_owner = (int) get_post_meta( $animal_id, 'rpn_owner_user_id', true );
        if ( $existing_owner && $existing_owner !== $user_id ) {
            return new WP_REST_Response( array( 'success' => false, 'message' => 'This animal has already been claimed by another user.' ), 409 );
        }

        update_post_meta( $animal_id, 'rpn_owner_user_id', $user_id );

        // Also link to contractor post if the user has one
        $linked_contractor_id = (int) get_user_meta( $user_id, 'rpn_linked_contractor_id', true );
        if ( $linked_contractor_id ) {
            update_post_meta( $animal_id, 'contractor_id', $linked_contractor_id );
        }

        // Add to profile post's linked_animals array so it appears in my-animals GET
        $linked_rider_id      = (int) get_user_meta( $user_id, 'rpn_linked_rider_id', true );
        $profile_post_id      = $linked_rider_id ?: $linked_contractor_id ?: ( (int) get_user_meta( $user_id, 'rpn_linked_producer_id', true ) );
        if ( $profile_post_id ) {
            $existing_linked = get_post_meta( $profile_post_id, 'linked_animals', true );
            $existing_linked = is_array( $existing_linked ) ? $existing_linked : array();
            if ( ! in_array( $animal_id, array_map( 'intval', $existing_linked ), true ) ) {
                $existing_linked[] = $animal_id;
                update_post_meta( $profile_post_id, 'linked_animals', $existing_linked );
            }
        }

        // Bidirectional: add this rider to the animal's linked_riders array
        if ( $linked_rider_id ) {
            $existing_riders = get_post_meta( $animal_id, 'linked_riders', true );
            $existing_riders = is_array( $existing_riders ) ? $existing_riders : array();
            if ( ! in_array( $linked_rider_id, array_map( 'intval', $existing_riders ), true ) ) {
                $existing_riders[] = $linked_rider_id;
                update_post_meta( $animal_id, 'linked_riders', $existing_riders );
            }
        }

        return new WP_REST_Response( array( 'success' => true, 'message' => 'Animal claimed successfully!' ), 200 );
    }

    /* ==========================================================================
    * /rpn/v1/reviews  GET + POST
    * Event organizer / attendee reviews. Stored as serialized array in event meta.
    * GET  ?event_id=123  → returns reviews array
    * POST { event_id, rating (1-5), review_text }  → adds a review (auth required)
    * ========================================================================== */
    add_action( 'rest_api_init', 'rpn_register_reviews_route' );
    function rpn_register_reviews_route() {
        register_rest_route( 'rpn/v1', '/reviews', array(
            array(
                'methods'             => 'GET',
                'permission_callback' => '__return_true',
                'callback'            => 'rpn_get_reviews_callback',
            ),
            array(
                'methods'             => 'POST',
                'permission_callback' => '__return_true',
                'callback'            => 'rpn_post_review_callback',
            ),
        ) );
    }

    function rpn_get_reviews_callback( $request ) {
        $event_id = absint( $request->get_param( 'event_id' ) ?? 0 );
        if ( ! $event_id ) {
            return new WP_REST_Response( array( 'reviews' => array() ), 200 );
        }
        $reviews_raw = get_post_meta( $event_id, 'rpn_reviews', true );
        $reviews     = is_array( $reviews_raw ) ? $reviews_raw : array();
        return new WP_REST_Response( array( 'reviews' => $reviews ), 200 );
    }

    function rpn_post_review_callback( $request ) {
        $user_id = rpn_require_auth( $request );
        if ( $user_id instanceof WP_REST_Response ) return $user_id;

        $params   = $request->get_json_params();
        $event_id = absint( $params['event_id'] ?? 0 );
        $rating   = (int) ( $params['rating'] ?? 0 );
        $text     = sanitize_textarea_field( $params['review_text'] ?? '' );

        if ( ! $event_id || $rating < 1 || $rating > 5 ) {
            return new WP_REST_Response( array( 'success' => false, 'message' => 'Event ID and a rating between 1 and 5 are required.' ), 400 );
        }

        $event = get_post( $event_id );
        if ( ! $event || $event->post_type !== 'rpn_event' ) {
            return new WP_REST_Response( array( 'success' => false, 'message' => 'Event not found.' ), 404 );
        }

        $user    = get_user_by( 'id', $user_id );
        $reviews = (array)( get_post_meta( $event_id, 'rpn_reviews', true ) ?: array() );

        // One review per user per event
        foreach ( $reviews as $r ) {
            if ( (int)( $r['user_id'] ?? 0 ) === $user_id ) {
                return new WP_REST_Response( array( 'success' => false, 'message' => 'You have already reviewed this event.' ), 409 );
            }
        }

        $reviews[] = array(
            'user_id'     => $user_id,
            'author'      => $user ? $user->display_name : 'Anonymous',
            'rating'      => $rating,
            'review_text' => $text,
            'date'        => date( 'Y-m-d' ),
        );

        update_post_meta( $event_id, 'rpn_reviews', $reviews );

        return new WP_REST_Response( array( 'success' => true, 'message' => 'Review submitted!' ), 200 );
    }

    /* ==========================================================================
    * PHASE 3 — Event Organizer Direct Entry
    *
    * 1. /rpn/v1/organizer/submit-result  POST — single result (auth: producer/admin)
    * 2. /rpn/v1/organizer/submit-csv     POST — batch rows as JSON array
    * 3. /rpn/v1/flag-result              POST — authenticated rider flags a result
    * 4. /rpn/v1/disputes                 GET  — admin: list all disputed performances
    * 5. /rpn/v1/disputes/{id}/resolve    POST — admin: resolve a dispute
    * ========================================================================== */

    /* ---- Register phase 3 meta fields ---- */
    add_action( 'init', 'rpn_register_phase3_meta', 25 );
    function rpn_register_phase3_meta() {
        // Performance dispute fields
        $dispute_fields = array(
            'disputed'            => 'boolean',
            'dispute_reason'      => 'string',
            'dispute_status'      => 'string',  // pending | resolved | rejected
            'dispute_resolved_at' => 'string',
            'dispute_resolution'  => 'string',
        );
        foreach ( $dispute_fields as $key => $type ) {
            register_post_meta( 'rpn_performance', $key, array(
                'show_in_rest'  => true,
                'single'        => true,
                'type'          => $type,
                'auth_callback' => function () { return true; },
            ) );
        }
        // Rider: has at least one officially-verified result
        register_post_meta( 'rider', 'has_verified_results', array(
            'show_in_rest'  => true,
            'single'        => true,
            'type'          => 'boolean',
            'auth_callback' => function () { return true; },
        ) );
        // Producer: verified event partner badge
        register_post_meta( 'rpn_producer', 'verified_event_partner', array(
            'show_in_rest'  => true,
            'single'        => true,
            'type'          => 'boolean',
            'auth_callback' => function () { return true; },
        ) );
    }

    /* ---- Register all phase 3 routes ---- */
    add_action( 'rest_api_init', 'rpn_register_phase3_routes' );
    function rpn_register_phase3_routes() {
        // Organizer: single result submission
        register_rest_route( 'rpn/v1', '/organizer/submit-result', array(
            'methods'             => 'POST',
            'permission_callback' => '__return_true',
            'callback'            => 'rpn_organizer_submit_result_callback',
        ) );
        // Organizer: bulk CSV rows
        register_rest_route( 'rpn/v1', '/organizer/submit-csv', array(
            'methods'             => 'POST',
            'permission_callback' => '__return_true',
            'callback'            => 'rpn_organizer_submit_csv_callback',
        ) );
        // Rider: flag a result
        register_rest_route( 'rpn/v1', '/flag-result', array(
            'methods'             => 'POST',
            'permission_callback' => '__return_true',
            'callback'            => 'rpn_flag_result_callback',
        ) );
        // Admin: list disputes
        register_rest_route( 'rpn/v1', '/disputes', array(
            'methods'             => 'GET',
            'permission_callback' => function () { return current_user_can( 'manage_options' ); },
            'callback'            => 'rpn_get_disputes_callback',
        ) );
        // Admin: resolve dispute
        register_rest_route( 'rpn/v1', '/disputes/(?P<id>\d+)/resolve', array(
            'methods'             => 'POST',
            'permission_callback' => function () { return current_user_can( 'manage_options' ); },
            'callback'            => 'rpn_resolve_dispute_callback',
        ) );
    }

    /* --------------------------------------------------------------------------
    * Organizer: submit a single official result for any rider
    * Required params: rider_id OR rider_name, performance_type, event_category,
    *   performance_date, + relevant score fields. event_id optional.
    * -------------------------------------------------------------------------- */
    function rpn_organizer_submit_result_callback( $request ) {
        $user_id = rpn_require_auth( $request );
        if ( $user_id instanceof WP_REST_Response ) return $user_id;

        // Only producers or admins may submit on behalf of riders
        $user        = get_user_by( 'id', $user_id );
        $is_producer = $user && ( in_array( 'rpn_producer', (array) $user->roles, true ) || in_array( 'administrator', (array) $user->roles, true ) );
        if ( ! $is_producer ) {
            return new WP_REST_Response( array( 'success' => false, 'message' => 'Only producers and admins may submit official results.' ), 403 );
        }

        $params = $request->get_json_params() ?: array();

        // Resolve rider
        $rider_id   = absint( $params['rider_id'] ?? 0 );
        $rider_name = sanitize_text_field( $params['rider_name'] ?? '' );
        if ( ! $rider_id && $rider_name ) {
            $found = get_posts( array(
                'post_type' => 'rider', 'post_status' => 'publish',
                'posts_per_page' => 1, 's' => $rider_name,
            ) );
            if ( ! empty( $found ) ) $rider_id = $found[0]->ID;
        }
        if ( ! $rider_id ) {
            return new WP_REST_Response( array( 'success' => false, 'message' => 'Rider not found. Provide a valid rider_id or rider_name.' ), 404 );
        }

        $result = rpn_organizer_create_performance( $rider_id, $params, $user_id );
        if ( is_wp_error( $result ) ) {
            return new WP_REST_Response( array( 'success' => false, 'message' => $result->get_error_message() ), 500 );
        }

        // Notify rider by email
        $linked_user_id = (int) get_post_meta( $rider_id, 'rpn_linked_user_id', true );
        if ( $linked_user_id ) {
            $notif_user = get_user_by( 'id', $linked_user_id );
            if ( $notif_user && $notif_user->user_email ) {
                $event_name = sanitize_text_field( $params['event_name'] ?? '' );
                $perf_date  = sanitize_text_field( $params['performance_date'] ?? '' );
                wp_mail(
                    $notif_user->user_email,
                    '[RIN] An official result has been recorded for you',
                    "Hi {$notif_user->display_name},\n\nAn event organizer has submitted an official result for you on RIN.\n\n"
                    . "Event: " . ( $event_name ?: 'N/A' ) . "\nDate: " . ( $perf_date ?: 'N/A' ) . "\n\n"
                    . "Log in to your dashboard to view the result and your updated RPI.\n\nhttps://rodeoidnetwork.com"
                );
            }
        }

        return new WP_REST_Response( array(
            'success'        => true,
            'message'        => 'Official result submitted.',
            'performance_id' => $result,
            'rider_id'       => $rider_id,
        ), 201 );
    }

    /* --------------------------------------------------------------------------
    * Organizer: bulk CSV submission
    * Body: { rows: [ { rider_name, ... }, ... ] }
    * -------------------------------------------------------------------------- */
    function rpn_organizer_submit_csv_callback( $request ) {
        $user_id = rpn_require_auth( $request );
        if ( $user_id instanceof WP_REST_Response ) return $user_id;

        $user        = get_user_by( 'id', $user_id );
        $is_producer = $user && ( in_array( 'rpn_producer', (array) $user->roles, true ) || in_array( 'administrator', (array) $user->roles, true ) );
        if ( ! $is_producer ) {
            return new WP_REST_Response( array( 'success' => false, 'message' => 'Only producers and admins may submit bulk results.' ), 403 );
        }

        $params = $request->get_json_params() ?: array();
        $rows   = $params['rows'] ?? array();
        if ( ! is_array( $rows ) || empty( $rows ) ) {
            return new WP_REST_Response( array( 'success' => false, 'message' => 'No rows provided.' ), 400 );
        }

        $created = 0; $errors = array();
        foreach ( $rows as $i => $row ) {
            $rider_id   = absint( $row['rider_id'] ?? 0 );
            $rider_name = sanitize_text_field( $row['rider_name'] ?? '' );
            if ( ! $rider_id && $rider_name ) {
                $found = get_posts( array(
                    'post_type' => 'rider', 'post_status' => 'publish',
                    'posts_per_page' => 1, 's' => $rider_name,
                ) );
                if ( ! empty( $found ) ) $rider_id = $found[0]->ID;
            }
            if ( ! $rider_id ) {
                $errors[] = "Row " . ( $i + 1 ) . ": Rider not found — " . ( $rider_name ?: 'no name' );
                continue;
            }
            $result = rpn_organizer_create_performance( $rider_id, $row, $user_id );
            if ( is_wp_error( $result ) ) {
                $errors[] = "Row " . ( $i + 1 ) . ": " . $result->get_error_message();
            } else {
                $created++;
                // Email notification per rider (throttled — skip if too many rows)
                if ( count( $rows ) <= 20 ) {
                    $linked_user_id = (int) get_post_meta( $rider_id, 'rpn_linked_user_id', true );
                    if ( $linked_user_id ) {
                        $notif_user = get_user_by( 'id', $linked_user_id );
                        if ( $notif_user && $notif_user->user_email ) {
                            wp_mail(
                                $notif_user->user_email,
                                '[RIN] An official result has been recorded for you',
                                "Hi {$notif_user->display_name},\n\nAn event organizer has submitted an official result for you on RIN.\n\nLog in to your dashboard to view your updated stats.\n\nhttps://rodeoidnetwork.com"
                            );
                        }
                    }
                }
            }
        }

        return new WP_REST_Response( array(
            'success' => true,
            'created' => $created,
            'errors'  => $errors,
            'message' => "Created {$created} result(s)" . ( count( $errors ) ? ' with ' . count( $errors ) . ' error(s).' : '.' ),
        ), 200 );
    }

    /* --------------------------------------------------------------------------
    * Shared helper: create one official performance post from organizer data.
    * -------------------------------------------------------------------------- */
    function rpn_organizer_create_performance( $rider_id, $params, $submitted_by_user_id ) {
        $perf_type  = sanitize_text_field( $params['performance_type'] ?? 'roughstock' );
        $event_cat  = sanitize_text_field( $params['event_category']   ?? '' );
        $perf_date  = sanitize_text_field( $params['performance_date']  ?? date( 'Y-m-d' ) );
        $event_name = sanitize_text_field( $params['event_name']        ?? '' );
        $event_id   = absint( $params['event_id'] ?? 0 );
        $arena      = sanitize_text_field( $params['arena_condition']   ?? 'smooth' );
        $weather    = sanitize_text_field( $params['weather_condition'] ?? 'clear' );
        $tier_mod   = sanitize_text_field( $params['event_tier']        ?? 'local' );
        $go_round   = sanitize_text_field( $params['go_round']          ?? 'Round 1' );
        $placement  = isset( $params['placement'] ) && $params['placement'] !== '' ? (int) $params['placement'] : null;
        $payout     = isset( $params['payout'] )    && $params['payout']    !== '' ? (float) $params['payout']  : null;

        // Roughstock scoring
        $raw_event_score = 0.0;
        if ( $perf_type === 'roughstock' ) {
            $covered     = filter_var( $params['covered'] ?? true, FILTER_VALIDATE_BOOLEAN );
            $judge1      = $covered ? min( 25, max( 0, (float) ( $params['judge1_score'] ?? 0 ) ) ) : 0;
            $judge2      = $covered ? min( 25, max( 0, (float) ( $params['judge2_score'] ?? 0 ) ) ) : 0;
            $animal_pts  = $covered ? min( 50, max( 0, (float) ( $params['animal_score'] ?? 0 ) ) ) : 0;
            $final_score = $covered ? ( $judge1 + $judge2 + $animal_pts ) : 0;
            $raw_event_score = rpn_calc_roughstock_event_score( $final_score, $placement ?? 0, $covered );
        } elseif ( $perf_type === 'timed' ) {
            $no_time         = filter_var( $params['no_time'] ?? false, FILTER_VALIDATE_BOOLEAN );
            $raw_time        = $no_time ? 0 : (float) ( $params['raw_run_time'] ?? 0 );
            $field_best_time = (float) ( $params['field_best_time'] ?? 0 );
            $num_pen         = $no_time ? 0 : max( 0, (int) ( $params['num_penalties'] ?? 0 ) );
            $pen_val         = rpn_timed_penalty_value( $event_cat );
            $pen_secs        = $num_pen * $pen_val;
            $final_time      = $no_time ? 0 : $raw_time + $pen_secs;
            $raw_event_score = rpn_calc_timed_event_score( $final_time, $field_best_time, $no_time );
        }

        $post_id = wp_insert_post( array(
            'post_type'   => 'rpn_performance',
            'post_title'  => ( $event_name ?: 'Organizer Result' ) . ' — ' . $perf_date,
            'post_status' => 'publish',
            'post_author' => $submitted_by_user_id,
        ), true );
        if ( is_wp_error( $post_id ) ) return $post_id;

        // Core meta
        update_post_meta( $post_id, 'rider_id',           $rider_id );
        update_post_meta( $post_id, 'performance_type',   $perf_type );
        update_post_meta( $post_id, 'event_category',     $event_cat );
        update_post_meta( $post_id, 'performance_date',   $perf_date );
        update_post_meta( $post_id, 'event_name',         $event_name );
        update_post_meta( $post_id, 'event_id',           $event_id );
        update_post_meta( $post_id, 'arena_condition',    $arena );
        update_post_meta( $post_id, 'weather_condition',  $weather );
        update_post_meta( $post_id, 'event_tier',         $tier_mod );
        update_post_meta( $post_id, 'go_round',           $go_round );
        update_post_meta( $post_id, 'verification_status', 'official' );
        update_post_meta( $post_id, 'use_for_rpi',        'true' );
        update_post_meta( $post_id, 'placement',          $placement !== null ? $placement : '' );
        update_post_meta( $post_id, 'payout',             $payout    !== null ? $payout    : '' );
        update_post_meta( $post_id, 'submitted_by_user',  $submitted_by_user_id );

        if ( $perf_type === 'roughstock' ) {
            update_post_meta( $post_id, 'judge1_score',    $judge1 ?? 0 );
            update_post_meta( $post_id, 'judge2_score',    $judge2 ?? 0 );
            update_post_meta( $post_id, 'animal_score',    $animal_pts ?? 0 );
            update_post_meta( $post_id, 'final_score',     $final_score ?? 0 );
            update_post_meta( $post_id, 'qualified_ride',  isset( $covered ) && $covered ? 'true' : 'false' );
            update_post_meta( $post_id, 'animal_name',     sanitize_text_field( $params['animal_name'] ?? '' ) );
        } elseif ( $perf_type === 'timed' ) {
            update_post_meta( $post_id, 'no_time',         isset( $no_time ) && $no_time ? 'true' : 'false' );
            update_post_meta( $post_id, 'raw_run_time',    $raw_time ?? 0 );
            update_post_meta( $post_id, 'field_best_time', $field_best_time ?? 0 );
            update_post_meta( $post_id, 'num_penalties',   $num_pen ?? 0 );
            update_post_meta( $post_id, 'penalty_seconds', $pen_secs ?? 0 );
            update_post_meta( $post_id, 'final_time',      $final_time ?? 0 );
            update_post_meta( $post_id, 'clean_run',       ( isset( $num_pen ) && $num_pen === 0 && ! ( $no_time ?? false ) ) ? 'true' : 'false' );
            update_post_meta( $post_id, 'horse_name',      sanitize_text_field( $params['horse_name'] ?? '' ) );
        }

        // Compute and store weighted score
        rpn_compute_and_store_weighted_score( $post_id, $raw_event_score, $event_id, $go_round, $rider_id, $tier_mod, 'official' );

        // Recalculate RPI
        rpn_update_rider_index_from_performances( $rider_id );
        rpn_refresh_rider_season_stats( $rider_id );

        // Mark rider as having verified results
        update_post_meta( $rider_id, 'has_verified_results', true );

        return $post_id;
    }

    /* --------------------------------------------------------------------------
    * Dispute: authenticated rider flags a performance result
    * -------------------------------------------------------------------------- */
    function rpn_flag_result_callback( $request ) {
        $user_id = rpn_require_auth( $request );
        if ( $user_id instanceof WP_REST_Response ) return $user_id;

        $params         = $request->get_json_params() ?: array();
        $performance_id = absint( $params['performance_id'] ?? 0 );
        $reason         = sanitize_textarea_field( $params['reason'] ?? '' );

        if ( ! $performance_id ) {
            return new WP_REST_Response( array( 'success' => false, 'message' => 'Performance ID required.' ), 400 );
        }
        if ( empty( $reason ) ) {
            return new WP_REST_Response( array( 'success' => false, 'message' => 'A reason is required to flag a result.' ), 400 );
        }

        $post = get_post( $performance_id );
        if ( ! $post || $post->post_type !== 'rpn_performance' ) {
            return new WP_REST_Response( array( 'success' => false, 'message' => 'Performance not found.' ), 404 );
        }

        // Verify the performance belongs to this rider
        $rider_id = (int) get_user_meta( $user_id, 'rpn_linked_rider_id', true );
        $perf_rider_id = (int) get_post_meta( $performance_id, 'rider_id', true );
        $user = get_user_by( 'id', $user_id );
        $is_admin = $user && in_array( 'administrator', (array) $user->roles, true );
        if ( ! $is_admin && ( ! $rider_id || $perf_rider_id !== $rider_id ) ) {
            return new WP_REST_Response( array( 'success' => false, 'message' => 'You can only flag your own results.' ), 403 );
        }

        update_post_meta( $performance_id, 'disputed',       true );
        update_post_meta( $performance_id, 'dispute_reason', $reason );
        update_post_meta( $performance_id, 'dispute_status', 'pending' );

        // Notify admin
        wp_mail(
            get_option( 'admin_email' ),
            '[RIN] Performance result disputed',
            "A rider has flagged a performance result for review.\n\n"
            . "Performance ID: {$performance_id}\n"
            . "Rider ID: {$perf_rider_id}\n"
            . "Reason: {$reason}\n\n"
            . "Review and resolve at: " . admin_url( 'edit.php?post_type=rpn_performance' )
        );

        return new WP_REST_Response( array( 'success' => true, 'message' => 'Result flagged for admin review.' ), 200 );
    }

    /* --------------------------------------------------------------------------
    * Admin: list all disputed (flagged) performances
    * -------------------------------------------------------------------------- */
    function rpn_get_disputes_callback( $request ) {
        $disputed_posts = get_posts( array(
            'post_type'      => 'rpn_performance',
            'post_status'    => 'publish',
            'posts_per_page' => 200,
            'meta_query'     => array(
                array( 'key' => 'disputed', 'value' => '1', 'compare' => '=' ),
            ),
        ) );

        $disputes = array();
        foreach ( $disputed_posts as $p ) {
            $rider_id  = (int) get_post_meta( $p->ID, 'rider_id', true );
            $disputes[] = array(
                'performance_id'   => $p->ID,
                'title'            => $p->post_title,
                'rider_id'         => $rider_id,
                'rider_name'       => $rider_id ? get_the_title( $rider_id ) : '',
                'event_name'       => get_post_meta( $p->ID, 'event_name', true ) ?: '',
                'performance_date' => get_post_meta( $p->ID, 'performance_date', true ) ?: '',
                'dispute_reason'   => get_post_meta( $p->ID, 'dispute_reason', true ) ?: '',
                'dispute_status'   => get_post_meta( $p->ID, 'dispute_status', true ) ?: 'pending',
                'dispute_resolved_at' => get_post_meta( $p->ID, 'dispute_resolved_at', true ) ?: '',
                'dispute_resolution'  => get_post_meta( $p->ID, 'dispute_resolution', true ) ?: '',
                'verification_status' => get_post_meta( $p->ID, 'verification_status', true ) ?: 'self_reported',
            );
        }

        return new WP_REST_Response( array( 'disputes' => $disputes, 'total' => count( $disputes ) ), 200 );
    }

    /* --------------------------------------------------------------------------
    * Admin: resolve or reject a dispute
    * Body: { resolution: 'resolved' | 'rejected', note: '...' }
    * -------------------------------------------------------------------------- */
    function rpn_resolve_dispute_callback( $request ) {
        $performance_id = (int) $request->get_param( 'id' );
        $params         = $request->get_json_params() ?: array();
        $resolution     = sanitize_text_field( $params['resolution'] ?? 'resolved' );
        $note           = sanitize_textarea_field( $params['note'] ?? '' );

        if ( ! in_array( $resolution, array( 'resolved', 'rejected' ), true ) ) {
            return new WP_REST_Response( array( 'success' => false, 'message' => 'resolution must be resolved or rejected.' ), 400 );
        }

        $post = get_post( $performance_id );
        if ( ! $post || $post->post_type !== 'rpn_performance' ) {
            return new WP_REST_Response( array( 'success' => false, 'message' => 'Performance not found.' ), 404 );
        }

        update_post_meta( $performance_id, 'dispute_status',      $resolution );
        update_post_meta( $performance_id, 'dispute_resolved_at', date( 'Y-m-d H:i:s' ) );
        update_post_meta( $performance_id, 'dispute_resolution',  $note );

        // If resolved (admin agrees result is wrong) → mark as not counting for RPI
        if ( $resolution === 'resolved' ) {
            update_post_meta( $performance_id, 'use_for_rpi', 'false' );
            $rider_id = (int) get_post_meta( $performance_id, 'rider_id', true );
            if ( $rider_id > 0 ) {
                rpn_update_rider_index_from_performances( $rider_id );
                rpn_refresh_rider_season_stats( $rider_id );
            }
        }

        // Notify the rider
        $rider_id       = (int) get_post_meta( $performance_id, 'rider_id', true );
        $linked_user_id = (int) get_post_meta( $rider_id, 'rpn_linked_user_id', true );
        if ( $linked_user_id ) {
            $notif_user = get_user_by( 'id', $linked_user_id );
            if ( $notif_user && $notif_user->user_email ) {
                $status_text = $resolution === 'resolved' ? 'approved — the result has been removed from your RPI calculation' : 'rejected — the original result stands';
                wp_mail(
                    $notif_user->user_email,
                    '[RIN] Your dispute has been reviewed',
                    "Hi {$notif_user->display_name},\n\nYour dispute for performance ID {$performance_id} has been {$status_text}.\n\n"
                    . ( $note ? "Admin note: {$note}\n\n" : '' )
                    . "Log in to your dashboard to view your current stats.\n\nhttps://rodeoidnetwork.com"
                );
            }
        }

        return new WP_REST_Response( array( 'success' => true, 'message' => "Dispute {$resolution}." ), 200 );
    }

/* ==========================================================================
 * WP ADMIN — Disputed Results Page
 * Appears under: WP Admin > RIN > Disputed Results
 * ========================================================================== */

add_action( 'admin_menu', 'rpn_register_admin_disputes_page' );
function rpn_register_admin_disputes_page() {
    add_menu_page(
        'RIN Disputes',
        'RIN Disputes',
        'manage_options',
        'rin-disputes',
        'rpn_render_disputes_admin_page',
        'dashicons-flag',
        30
    );
}

function rpn_render_disputes_admin_page() {
    if ( ! current_user_can( 'manage_options' ) ) {
        wp_die( 'Access denied.' );
    }

    // Handle resolve/reject action
    $action_msg = '';
    if (
        isset( $_POST['rin_dispute_action'], $_POST['rin_dispute_performance_id'], $_POST['_wpnonce'] )
        && wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['_wpnonce'] ) ), 'rin_resolve_dispute' )
    ) {
        $perf_id    = absint( $_POST['rin_dispute_performance_id'] );
        $resolution = in_array( $_POST['rin_dispute_action'], array( 'resolved', 'rejected' ), true )
                      ? sanitize_text_field( $_POST['rin_dispute_action'] )
                      : '';
        $note       = sanitize_textarea_field( $_POST['rin_dispute_note'] ?? '' );

        if ( $perf_id && $resolution ) {
            update_post_meta( $perf_id, 'dispute_status',      $resolution );
            update_post_meta( $perf_id, 'dispute_resolved_at', current_time( 'mysql' ) );
            update_post_meta( $perf_id, 'dispute_resolution',  $note );

            if ( $resolution === 'resolved' ) {
                update_post_meta( $perf_id, 'use_for_rpi', 'false' );
                $rider_id = (int) get_post_meta( $perf_id, 'rider_id', true );
                if ( $rider_id > 0 ) {
                    rpn_update_rider_index_from_performances( $rider_id );
                    rpn_refresh_rider_season_stats( $rider_id );
                }
            }

            // Notify rider by email
            $rider_id       = (int) get_post_meta( $perf_id, 'rider_id', true );
            $linked_user_id = (int) get_post_meta( $rider_id, 'rpn_linked_user_id', true );
            if ( $linked_user_id ) {
                $notif_user  = get_user_by( 'id', $linked_user_id );
                $status_text = $resolution === 'resolved'
                    ? 'approved — the result has been removed from your RPI calculation'
                    : 'rejected — the original result stands';
                if ( $notif_user && $notif_user->user_email ) {
                    wp_mail(
                        $notif_user->user_email,
                        '[RIN] Your dispute has been reviewed',
                        "Hi {$notif_user->display_name},\n\nYour dispute for performance ID {$perf_id} has been {$status_text}.\n\n"
                        . ( $note ? "Admin note: {$note}\n\n" : '' )
                        . "Log in to your dashboard to view your current stats.\n\nhttps://rodeoidnetwork.com"
                    );
                }
            }

            $label      = $resolution === 'resolved' ? 'Approved' : 'Rejected';
            $action_msg = "<div class='notice notice-success is-dismissible'><p>Dispute #{$perf_id} <strong>{$label}</strong>." . ( $note ? " Note sent to rider." : '' ) . "</p></div>";
        }
    }

    // Fetch all disputed performances
    $disputed_posts = get_posts( array(
        'post_type'      => 'rpn_performance',
        'post_status'    => 'publish',
        'posts_per_page' => 200,
        'meta_query'     => array(
            array( 'key' => 'disputed', 'value' => '1', 'compare' => '=' ),
        ),
        'orderby'  => 'date',
        'order'    => 'DESC',
    ) );

    $pending  = array();
    $resolved = array();
    foreach ( $disputed_posts as $p ) {
        $status = get_post_meta( $p->ID, 'dispute_status', true ) ?: 'pending';
        $row = array(
            'id'          => $p->ID,
            'rider_id'    => (int) get_post_meta( $p->ID, 'rider_id', true ),
            'rider_name'  => '',
            'event_name'  => get_post_meta( $p->ID, 'event_name', true ) ?: '—',
            'event_date'  => get_post_meta( $p->ID, 'performance_date', true ) ?: get_post_meta( $p->ID, 'event_date', true ) ?: '—',
            'reason'      => get_post_meta( $p->ID, 'dispute_reason', true ) ?: '—',
            'status'      => $status,
            'resolved_at' => get_post_meta( $p->ID, 'dispute_resolved_at', true ) ?: '',
            'resolution'  => get_post_meta( $p->ID, 'dispute_resolution', true ) ?: '',
        );
        if ( $row['rider_id'] ) {
            $row['rider_name'] = get_the_title( $row['rider_id'] ) ?: "Rider #{$row['rider_id']}";
        }
        if ( $status === 'pending' ) {
            $pending[] = $row;
        } else {
            $resolved[] = $row;
        }
    }

    // Inline styles (no enqueue needed for a simple admin page)
    ?>
    <div class="wrap">
        <h1 class="wp-heading-inline">&#127988; RIN — Disputed Results</h1>
        <hr class="wp-header-end">

        <?php echo wp_kses_post( $action_msg ); ?>

        <h2>Pending Disputes (<?php echo count( $pending ); ?>)</h2>

        <?php if ( empty( $pending ) ) : ?>
            <p style="color:#555;">No pending disputes. All clear!</p>
        <?php else : ?>
            <table class="wp-list-table widefat fixed striped" style="margin-bottom:2rem;">
                <thead>
                    <tr>
                        <th style="width:80px;">Perf ID</th>
                        <th>Rider</th>
                        <th>Event</th>
                        <th style="width:100px;">Date</th>
                        <th>Dispute Reason</th>
                        <th style="width:220px;">Resolve</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ( $pending as $d ) : ?>
                        <tr>
                            <td>
                                <strong>#<?php echo esc_html( $d['id'] ); ?></strong><br>
                                <a href="<?php echo esc_url( get_edit_post_link( $d['id'] ) ); ?>" target="_blank" style="font-size:11px;">Edit post</a>
                            </td>
                            <td><?php echo esc_html( $d['rider_name'] ); ?></td>
                            <td><?php echo esc_html( $d['event_name'] ); ?></td>
                            <td><?php echo esc_html( $d['event_date'] ); ?></td>
                            <td style="white-space:pre-wrap;font-size:13px;"><?php echo esc_html( $d['reason'] ); ?></td>
                            <td>
                                <form method="post" style="margin:0;">
                                    <?php wp_nonce_field( 'rin_resolve_dispute' ); ?>
                                    <input type="hidden" name="rin_dispute_performance_id" value="<?php echo esc_attr( $d['id'] ); ?>">
                                    <textarea name="rin_dispute_note" placeholder="Optional note to rider…" rows="2" style="width:100%;font-size:12px;margin-bottom:6px;border:1px solid #ccd;border-radius:4px;padding:4px;"></textarea>
                                    <div style="display:flex;gap:6px;">
                                        <button type="submit" name="rin_dispute_action" value="resolved" class="button button-primary" style="background:#16a34a;border-color:#16a34a;" onclick="return confirm('Approve dispute? This removes the result from RPI.')">
                                            ✓ Approve
                                        </button>
                                        <button type="submit" name="rin_dispute_action" value="rejected" class="button button-secondary" style="color:#dc2626;border-color:#dc2626;" onclick="return confirm('Reject dispute? The original result stands.')">
                                            ✗ Reject
                                        </button>
                                    </div>
                                </form>
                            </td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>

        <h2>Resolved / Rejected (<?php echo count( $resolved ); ?>)</h2>

        <?php if ( empty( $resolved ) ) : ?>
            <p style="color:#555;">None yet.</p>
        <?php else : ?>
            <table class="wp-list-table widefat fixed striped">
                <thead>
                    <tr>
                        <th style="width:80px;">Perf ID</th>
                        <th>Rider</th>
                        <th>Event</th>
                        <th style="width:100px;">Status</th>
                        <th>Dispute Reason</th>
                        <th>Admin Note</th>
                        <th style="width:120px;">Resolved At</th>
                    </tr>
                </thead>
                <tbody>
                    <?php foreach ( $resolved as $d ) : ?>
                        <tr>
                            <td>
                                <strong>#<?php echo esc_html( $d['id'] ); ?></strong><br>
                                <a href="<?php echo esc_url( get_edit_post_link( $d['id'] ) ); ?>" target="_blank" style="font-size:11px;">Edit post</a>
                            </td>
                            <td><?php echo esc_html( $d['rider_name'] ); ?></td>
                            <td><?php echo esc_html( $d['event_name'] ); ?></td>
                            <td>
                                <?php if ( $d['status'] === 'resolved' ) : ?>
                                    <span style="color:#16a34a;font-weight:700;">✓ Approved</span>
                                <?php else : ?>
                                    <span style="color:#dc2626;font-weight:700;">✗ Rejected</span>
                                <?php endif; ?>
                            </td>
                            <td style="white-space:pre-wrap;font-size:13px;"><?php echo esc_html( $d['reason'] ); ?></td>
                            <td style="font-size:12px;color:#555;"><?php echo esc_html( $d['resolution'] ?: '—' ); ?></td>
                            <td style="font-size:12px;"><?php echo esc_html( $d['resolved_at'] ? substr( $d['resolved_at'], 0, 10 ) : '—' ); ?></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        <?php endif; ?>
    </div>
    <?php
}

/* ============================================================
 * PHASE 4 — NIL BRAND MARKETPLACE
 * GET  /rpn/v1/nil-marketplace   — list NIL-open riders with filters
 * POST /rpn/v1/nil-contact       — brand sends inquiry email to rider
 * ============================================================ */
add_action('rest_api_init', function () {
    register_rest_route('rpn/v1', '/nil-marketplace', [
        'methods'             => 'GET',
        'callback'            => 'rpn_nil_marketplace_get',
        'permission_callback' => '__return_true',
    ]);
    register_rest_route('rpn/v1', '/nil-contact', [
        'methods'             => 'POST',
        'callback'            => 'rpn_nil_contact_post',
        'permission_callback' => '__return_true',
    ]);
});

function rpn_nil_marketplace_get( $request ) {
    $discipline = sanitize_text_field( $request->get_param('discipline') );
    $state      = sanitize_text_field( $request->get_param('state') );
    $min_rpi    = (float) ( $request->get_param('min_rpi') ?: 0 );

    $meta_query = [
        'relation' => 'AND',
        [ 'key' => 'nil_open_to_sponsorship', 'value' => '1', 'compare' => '=' ],
    ];
    if ( $state )      $meta_query[] = [ 'key' => 'state',      'value' => $state,      'compare' => '='    ];
    if ( $discipline ) $meta_query[] = [ 'key' => 'event_type', 'value' => $discipline, 'compare' => 'LIKE' ];

    $posts = get_posts([
        'post_type'      => 'rider',
        'posts_per_page' => 50,
        'post_status'    => 'publish',
        'meta_query'     => $meta_query,
    ]);

    $results = [];
    foreach ( $posts as $p ) {
        $rpi = (float) ( get_post_meta( $p->ID, 'rpi_current', true ) ?: 0 );
        if ( $min_rpi > 0 && $rpi < $min_rpi ) continue;
        $results[] = [
            'id'          => $p->ID,
            'slug'        => $p->post_name,
            'name'        => get_post_meta( $p->ID, 'full_name', true ) ?: $p->post_title,
            'state'       => get_post_meta( $p->ID, 'state', true ),
            'discipline'  => get_post_meta( $p->ID, 'event_type', true ),
            'rpi_current' => $rpi,
            'sponsor'     => get_post_meta( $p->ID, 'sponsor_name', true ),
            'nil_note'    => get_post_meta( $p->ID, 'nil_partnership_note', true ),
            'photo'       => get_the_post_thumbnail_url( $p->ID, 'medium' ) ?: '',
            'rin_id'      => get_post_meta( $p->ID, 'rin_id', true ),
        ];
    }
    usort( $results, fn( $a, $b ) => $b['rpi_current'] <=> $a['rpi_current'] );
    return rest_ensure_response([ 'riders' => $results, 'total' => count( $results ) ]);
}

function rpn_nil_contact_post( $request ) {
    $rider_slug   = sanitize_text_field( $request->get_param('rider_slug') );
    $brand_name   = sanitize_text_field( $request->get_param('brand_name') );
    $brand_email  = sanitize_email( $request->get_param('brand_email') );
    $brand_site   = esc_url_raw( $request->get_param('brand_website') );
    $message      = sanitize_textarea_field( $request->get_param('message') );

    if ( ! $rider_slug || ! $brand_name || ! $brand_email || ! $message ) {
        return new WP_Error( 'missing_fields', 'All fields are required.', [ 'status' => 400 ] );
    }
    $posts = get_posts([ 'post_type' => 'rider', 'name' => $rider_slug, 'posts_per_page' => 1 ]);
    if ( empty( $posts ) ) return new WP_Error( 'not_found', 'Rider not found.', [ 'status' => 404 ] );
    $rider = $posts[0];

    $rider_user_id = (int) get_post_meta( $rider->ID, 'rider_user_id', true );
    $rider_email   = '';
    if ( $rider_user_id ) {
        $u = get_userdata( $rider_user_id );
        if ( $u ) $rider_email = $u->user_email;
    }
    if ( ! $rider_email ) $rider_email = (string) get_post_meta( $rider->ID, 'contact_email', true );
    if ( ! $rider_email ) return new WP_Error( 'no_contact', 'Rider has no contact email on file.', [ 'status' => 422 ] );

    $rider_name = get_post_meta( $rider->ID, 'full_name', true ) ?: $rider->post_title;
    $subject    = "NIL Partnership Inquiry from {$brand_name} — Rodeo Identification Network";
    $body       = "Hello {$rider_name},\n\n"
                . "A brand is interested in partnering with you through the RIN NIL Marketplace.\n\n"
                . "Brand: {$brand_name}\n"
                . "Contact: {$brand_email}\n"
                . ( $brand_site ? "Website: {$brand_site}\n" : '' )
                . "\nMessage:\n{$message}\n\n"
                . "Reply directly to this email to connect.\n\n— Rodeo Identification Network";

    $sent = wp_mail( $rider_email, $subject, $body, [ "Reply-To: {$brand_email}" ] );
    if ( ! $sent ) return new WP_Error( 'mail_failed', 'Could not send inquiry.', [ 'status' => 500 ] );

    wp_mail(
        get_option('admin_email'),
        "NIL Marketplace: {$brand_name} → {$rider_name}",
        "{$brand_name} ({$brand_email}) sent an NIL inquiry to {$rider_name}.\n\nMessage: {$message}"
    );
    return rest_ensure_response([ 'success' => true, 'message' => 'Inquiry sent successfully!' ]);
}

/* ============================================================
 * PHASE 4 — OUTBOUND PUBLIC DATA API (tiered, API-key auth)
 * POST   /rpn/v1/api-keys             — generate a key (auth)
 * GET    /rpn/v1/api-keys             — list my keys (auth)
 * DELETE /rpn/v1/api-keys/{key_id}    — revoke a key (auth)
 * GET    /rpn/v1/public-api/riders    — riders list (API key)
 * GET    /rpn/v1/public-api/events    — events list (API key)
 * GET    /rpn/v1/public-api/animals   — animals list (API key)
 * ============================================================ */
add_action('rest_api_init', function () {
    register_rest_route('rpn/v1', '/api-keys', [
        [ 'methods' => 'GET',  'callback' => 'rpn_api_keys_get',    'permission_callback' => '__return_true' ],
        [ 'methods' => 'POST', 'callback' => 'rpn_api_keys_create', 'permission_callback' => '__return_true' ],
    ]);
    register_rest_route('rpn/v1', '/api-keys/(?P<key_id>[a-zA-Z0-9_-]+)', [
        'methods'             => 'DELETE',
        'callback'            => 'rpn_api_keys_revoke',
        'permission_callback' => '__return_true',
    ]);
    register_rest_route('rpn/v1', '/public-api/riders',  [ 'methods' => 'GET', 'callback' => 'rpn_public_api_riders',  'permission_callback' => '__return_true' ]);
    register_rest_route('rpn/v1', '/public-api/events',  [ 'methods' => 'GET', 'callback' => 'rpn_public_api_events',  'permission_callback' => '__return_true' ]);
    register_rest_route('rpn/v1', '/public-api/animals', [ 'methods' => 'GET', 'callback' => 'rpn_public_api_animals', 'permission_callback' => '__return_true' ]);
});

function rpn_validate_api_key( $request ) {
    $key = $request->get_header('X-RIN-API-Key') ?: sanitize_text_field( $request->get_param('api_key') );
    if ( ! $key ) return new WP_Error( 'no_key', 'API key required. Pass X-RIN-API-Key header or api_key parameter.', [ 'status' => 401 ] );

    global $wpdb;
    $users = $wpdb->get_col("SELECT user_id FROM {$wpdb->usermeta} WHERE meta_key='rpn_api_keys'");
    foreach ( $users as $uid ) {
        $keys = get_user_meta( (int) $uid, 'rpn_api_keys', true );
        if ( ! is_array( $keys ) ) continue;
        foreach ( $keys as &$k ) {
            if ( isset( $k['key'] ) && $k['key'] === $key && ( $k['status'] ?? 'active' ) === 'active' ) {
                $k['last_used'] = current_time('mysql');
                update_user_meta( (int) $uid, 'rpn_api_keys', $keys );
                return [ 'user_id' => (int) $uid, 'tier' => get_user_meta( (int) $uid, 'rpn_membership_tier', true ) ?: 'free' ];
            }
        }
    }
    return new WP_Error( 'invalid_key', 'Invalid or revoked API key.', [ 'status' => 401 ] );
}

function rpn_api_keys_get( $request ) {
    $token   = $request->get_header('X-RPN-Auth') ?: $request->get_header('Authorization');
    if ( $token && strpos( $token, 'Bearer ' ) === 0 ) $token = substr( $token, 7 );
    $user_id = rpn_verify_token( $token );
    if ( ! $user_id ) return new WP_Error( 'unauthorized', 'Auth required.', [ 'status' => 401 ] );

    $keys   = get_user_meta( $user_id, 'rpn_api_keys', true ) ?: [];
    $masked = array_map( function ( $k ) {
        return [
            'key_id'     => $k['key_id'] ?? md5( $k['key'] ),
            'key_prefix' => substr( $k['key'], 0, 12 ) . '••••••••',
            'name'       => $k['name'],
            'created_at' => $k['created_at'],
            'last_used'  => $k['last_used'] ?? null,
            'status'     => $k['status'] ?? 'active',
        ];
    }, $keys );
    return rest_ensure_response([ 'keys' => $masked ]);
}

function rpn_api_keys_create( $request ) {
    $token   = $request->get_header('X-RPN-Auth') ?: $request->get_header('Authorization');
    if ( $token && strpos( $token, 'Bearer ' ) === 0 ) $token = substr( $token, 7 );
    $user_id = rpn_verify_token( $token );
    if ( ! $user_id ) return new WP_Error( 'unauthorized', 'Auth required.', [ 'status' => 401 ] );

    $tier          = get_user_meta( $user_id, 'rpn_membership_tier', true ) ?: 'free';
    $allowed_tiers = [ 'competitor', 'contractor', 'organizer', 'enterprise' ];
    if ( ! in_array( $tier, $allowed_tiers, true ) ) {
        return new WP_Error( 'tier_required', 'API access requires Competitor Pro or higher membership.', [ 'status' => 403 ] );
    }
    $keys   = get_user_meta( $user_id, 'rpn_api_keys', true ) ?: [];
    $active = array_filter( $keys, fn( $k ) => ( $k['status'] ?? 'active' ) === 'active' );
    if ( count( $active ) >= 5 ) return new WP_Error( 'key_limit', 'Maximum of 5 active API keys allowed.', [ 'status' => 400 ] );

    $key_name = sanitize_text_field( $request->get_param('name') ) ?: 'My API Key';
    $new_key  = 'rin_' . bin2hex( random_bytes( 20 ) );
    $key_id   = wp_generate_password( 12, false );
    $keys[]   = [
        'key'        => $new_key,
        'key_id'     => $key_id,
        'name'       => $key_name,
        'created_at' => current_time('mysql'),
        'last_used'  => null,
        'status'     => 'active',
    ];
    update_user_meta( $user_id, 'rpn_api_keys', $keys );
    return rest_ensure_response([
        'key'     => $new_key,
        'key_id'  => $key_id,
        'name'    => $key_name,
        'message' => 'API key created. Copy it now — it will not be shown again.',
    ]);
}

function rpn_api_keys_revoke( $request ) {
    $token   = $request->get_header('X-RPN-Auth') ?: $request->get_header('Authorization');
    if ( $token && strpos( $token, 'Bearer ' ) === 0 ) $token = substr( $token, 7 );
    $user_id = rpn_verify_token( $token );
    if ( ! $user_id ) return new WP_Error( 'unauthorized', 'Auth required.', [ 'status' => 401 ] );

    $key_id_to_revoke = sanitize_text_field( $request->get_param('key_id') );
    $keys             = get_user_meta( $user_id, 'rpn_api_keys', true ) ?: [];
    $found            = false;
    foreach ( $keys as &$k ) {
        if ( ( $k['key_id'] ?? md5( $k['key'] ) ) === $key_id_to_revoke ) {
            $k['status'] = 'revoked';
            $found = true;
            break;
        }
    }
    if ( ! $found ) return new WP_Error( 'not_found', 'Key not found.', [ 'status' => 404 ] );
    update_user_meta( $user_id, 'rpn_api_keys', $keys );
    return rest_ensure_response([ 'success' => true, 'message' => 'Key revoked.' ]);
}

function rpn_public_api_riders( $request ) {
    $auth = rpn_validate_api_key( $request );
    if ( is_wp_error( $auth ) ) return $auth;

    $per_page   = min( (int) ( $request->get_param('per_page') ?: 20 ), 100 );
    $page       = max( 1, (int) ( $request->get_param('page') ?: 1 ) );
    $state      = sanitize_text_field( $request->get_param('state') );
    $discipline = sanitize_text_field( $request->get_param('discipline') );
    $args       = [ 'post_type' => 'rider', 'posts_per_page' => $per_page, 'paged' => $page, 'post_status' => 'publish' ];
    if ( $state || $discipline ) {
        $args['meta_query'] = [];
        if ( $state )      $args['meta_query'][] = [ 'key' => 'state',      'value' => $state ];
        if ( $discipline ) $args['meta_query'][] = [ 'key' => 'event_type', 'value' => $discipline, 'compare' => 'LIKE' ];
    }
    $elite = in_array( $auth['tier'], [ 'elite', 'producer' ], true );
    $posts = get_posts( $args );
    $results = [];
    foreach ( $posts as $p ) {
        $r = [
            'id'          => $p->ID,
            'slug'        => $p->post_name,
            'name'        => get_post_meta( $p->ID, 'full_name', true ) ?: $p->post_title,
            'rin_id'      => get_post_meta( $p->ID, 'rin_id', true ),
            'state'       => get_post_meta( $p->ID, 'state', true ),
            'discipline'  => get_post_meta( $p->ID, 'event_type', true ),
            'rpi_current' => (float) ( get_post_meta( $p->ID, 'rpi_current', true ) ?: 0 ),
        ];
        if ( $elite ) {
            $r['rpi_season']  = (float) ( get_post_meta( $p->ID, 'rpi_season',  true ) ?: 0 );
            $r['rpi_career']  = (float) ( get_post_meta( $p->ID, 'rpi_career',  true ) ?: 0 );
            $r['confidence']  = (float) ( get_post_meta( $p->ID, 'rpi_confidence_score', true ) ?: 0 );
            $r['total_rides'] = (int)   ( get_post_meta( $p->ID, 'total_rides', true ) ?: 0 );
        }
        $results[] = $r;
    }
    return rest_ensure_response([ 'riders' => $results, 'page' => $page, 'per_page' => $per_page ]);
}

function rpn_public_api_events( $request ) {
    $auth = rpn_validate_api_key( $request );
    if ( is_wp_error( $auth ) ) return $auth;

    $per_page = min( (int) ( $request->get_param('per_page') ?: 20 ), 100 );
    $page     = max( 1, (int) ( $request->get_param('page') ?: 1 ) );
    $state    = sanitize_text_field( $request->get_param('state') );
    $args     = [ 'post_type' => 'rpn_event', 'posts_per_page' => $per_page, 'paged' => $page, 'post_status' => 'publish' ];
    if ( $state ) $args['meta_query'] = [[ 'key' => 'state', 'value' => $state ]];
    $posts = get_posts( $args );
    $results = array_map( function ( $p ) {
        return [
            'id'         => $p->ID,
            'slug'       => $p->post_name,
            'name'       => $p->post_title,
            'date'       => get_post_meta( $p->ID, 'event_date', true ),
            'state'      => get_post_meta( $p->ID, 'state',      true ),
            'city'       => get_post_meta( $p->ID, 'city',       true ),
            'tier'       => get_post_meta( $p->ID, 'event_tier', true ),
            'discipline' => get_post_meta( $p->ID, 'discipline', true ),
        ];
    }, $posts );
    return rest_ensure_response([ 'events' => $results, 'page' => $page, 'per_page' => $per_page ]);
}

function rpn_public_api_animals( $request ) {
    $auth = rpn_validate_api_key( $request );
    if ( is_wp_error( $auth ) ) return $auth;

    $per_page = min( (int) ( $request->get_param('per_page') ?: 20 ), 100 );
    $page     = max( 1, (int) ( $request->get_param('page') ?: 1 ) );
    $args     = [ 'post_type' => 'animal', 'posts_per_page' => $per_page, 'paged' => $page, 'post_status' => 'publish' ];
    $posts    = get_posts( $args );
    $results  = array_map( function ( $p ) {
        return [
            'id'          => $p->ID,
            'slug'        => $p->post_name,
            'name'        => $p->post_title,
            'type'        => get_post_meta( $p->ID, 'animal_type',  true ),
            'sri_current' => (float) ( get_post_meta( $p->ID, 'sri_current', true ) ?: 0 ),
            'tpi_current' => (float) ( get_post_meta( $p->ID, 'tpi_current', true ) ?: 0 ),
            'owner'       => get_post_meta( $p->ID, 'owner', true ),
        ];
    }, $posts );
    return rest_ensure_response([ 'animals' => $results, 'page' => $page, 'per_page' => $per_page ]);
}

/* ============================================================
 * PHASE 4 — FANTASY RODEO
 * CPT:   rpn_fantasy_league
 * GET    /rpn/v1/fantasy/leagues          — list public leagues
 * POST   /rpn/v1/fantasy/leagues          — create league (auth)
 * GET    /rpn/v1/fantasy/leagues/{id}     — league + standings
 * POST   /rpn/v1/fantasy/leagues/{id}/join  — join league (auth)
 * POST   /rpn/v1/fantasy/leagues/{id}/picks — set picks (auth)
 * GET    /rpn/v1/fantasy/my-leagues       — leagues I'm in (auth)
 * ============================================================ */
add_action('init', function () {
    register_post_type('rpn_fantasy_league', [
        'label'        => 'Fantasy Leagues',
        'public'       => false,
        'show_ui'      => true,
        'show_in_menu' => true,
        'show_in_rest' => false,
        'supports'     => [ 'title', 'custom-fields' ],
        'menu_icon'    => 'dashicons-awards',
    ]);
});

add_action('rest_api_init', function () {
    register_rest_route('rpn/v1', '/fantasy/leagues', [
        [ 'methods' => 'GET',  'callback' => 'rpn_fantasy_leagues_get',    'permission_callback' => '__return_true' ],
        [ 'methods' => 'POST', 'callback' => 'rpn_fantasy_leagues_create', 'permission_callback' => '__return_true' ],
    ]);
    register_rest_route('rpn/v1', '/fantasy/leagues/(?P<id>\d+)', [
        'methods'             => 'GET',
        'callback'            => 'rpn_fantasy_league_detail',
        'permission_callback' => '__return_true',
    ]);
    register_rest_route('rpn/v1', '/fantasy/leagues/(?P<id>\d+)/join', [
        'methods'             => 'POST',
        'callback'            => 'rpn_fantasy_league_join',
        'permission_callback' => '__return_true',
    ]);
    register_rest_route('rpn/v1', '/fantasy/leagues/(?P<id>\d+)/picks', [
        'methods'             => 'POST',
        'callback'            => 'rpn_fantasy_league_picks',
        'permission_callback' => '__return_true',
    ]);
    register_rest_route('rpn/v1', '/fantasy/my-leagues', [
        'methods'             => 'GET',
        'callback'            => 'rpn_fantasy_my_leagues',
        'permission_callback' => '__return_true',
    ]);
});

function rpn_fantasy_leagues_get( $request ) {
    $posts = get_posts([
        'post_type'      => 'rpn_fantasy_league',
        'posts_per_page' => 30,
        'post_status'    => 'publish',
        'meta_query'     => [[ 'key' => 'fl_is_private', 'value' => '1', 'compare' => '!=' ]],
    ]);
    return rest_ensure_response([ 'leagues' => array_map('rpn_format_fantasy_league', $posts) ]);
}

function rpn_fantasy_leagues_create( $request ) {
    $token   = $request->get_header('X-RPN-Auth') ?: $request->get_header('Authorization');
    if ( $token && strpos( $token, 'Bearer ' ) === 0 ) $token = substr( $token, 7 );
    $user_id = rpn_verify_token( $token );
    if ( ! $user_id ) return new WP_Error( 'unauthorized', 'Auth required.', [ 'status' => 401 ] );

    $name       = sanitize_text_field( $request->get_param('name') );
    $season     = sanitize_text_field( $request->get_param('season') ?: date('Y') );
    $max_picks  = max( 1, min( 10, (int) ( $request->get_param('max_picks') ?: 5 ) ) );
    $is_private = ! empty( $request->get_param('is_private') );
    if ( ! $name ) return new WP_Error( 'missing_name', 'League name is required.', [ 'status' => 400 ] );

    $post_id = wp_insert_post([
        'post_type'   => 'rpn_fantasy_league',
        'post_title'  => $name,
        'post_status' => 'publish',
    ]);
    if ( is_wp_error( $post_id ) ) return $post_id;

    update_post_meta( $post_id, 'fl_commissioner_id', $user_id );
    update_post_meta( $post_id, 'fl_season',          $season );
    update_post_meta( $post_id, 'fl_max_picks',       $max_picks );
    update_post_meta( $post_id, 'fl_is_private',      $is_private ? '1' : '0' );
    update_post_meta( $post_id, 'fl_status',          'open' );
    update_post_meta( $post_id, 'fl_members',         [ $user_id ] );
    update_user_meta( $user_id, "rpn_fantasy_{$post_id}_picks", [] );

    return rest_ensure_response( rpn_format_fantasy_league( get_post( $post_id ) ) );
}

function rpn_fantasy_league_detail( $request ) {
    $id   = (int) $request->get_param('id');
    $post = get_post( $id );
    if ( ! $post || $post->post_type !== 'rpn_fantasy_league' ) {
        return new WP_Error( 'not_found', 'League not found.', [ 'status' => 404 ] );
    }
    $data    = rpn_format_fantasy_league( $post );
    $members = get_post_meta( $id, 'fl_members', true ) ?: [];
    $standings = [];
    foreach ( $members as $uid ) {
        $picks = get_user_meta( (int) $uid, "rpn_fantasy_{$id}_picks", true ) ?: [];
        $score = 0;
        foreach ( $picks as $rider_pid ) {
            $score += (float) ( get_post_meta( (int) $rider_pid, 'rpi_current', true ) ?: 0 );
        }
        $u = get_userdata( (int) $uid );
        $standings[] = [
            'user_id'      => (int) $uid,
            'display_name' => $u ? $u->display_name : 'Unknown',
            'picks_count'  => count( $picks ),
            'total_score'  => round( $score, 2 ),
        ];
    }
    usort( $standings, fn( $a, $b ) => $b['total_score'] <=> $a['total_score'] );
    $data['standings']   = $standings;
    $data['member_list'] = $standings; // alias for frontend convenience
    return rest_ensure_response( $data );
}

function rpn_fantasy_league_join( $request ) {
    $token   = $request->get_header('X-RPN-Auth') ?: $request->get_header('Authorization');
    if ( $token && strpos( $token, 'Bearer ' ) === 0 ) $token = substr( $token, 7 );
    $user_id = rpn_verify_token( $token );
    if ( ! $user_id ) return new WP_Error( 'unauthorized', 'Auth required.', [ 'status' => 401 ] );

    $id   = (int) $request->get_param('id');
    $post = get_post( $id );
    if ( ! $post || $post->post_type !== 'rpn_fantasy_league' ) return new WP_Error( 'not_found', 'League not found.', [ 'status' => 404 ] );
    if ( get_post_meta( $id, 'fl_status', true ) !== 'open' ) return new WP_Error( 'league_closed', 'League is no longer accepting members.', [ 'status' => 409 ] );

    $members = get_post_meta( $id, 'fl_members', true ) ?: [];
    if ( in_array( $user_id, array_map('intval', $members), true ) ) {
        return rest_ensure_response([ 'message' => 'Already a member of this league.' ]);
    }
    $members[] = $user_id;
    update_post_meta( $id, 'fl_members', $members );
    update_user_meta( $user_id, "rpn_fantasy_{$id}_picks", [] );
    return rest_ensure_response([ 'success' => true, 'message' => 'You joined the league! Now set your picks.' ]);
}

function rpn_fantasy_league_picks( $request ) {
    $token   = $request->get_header('X-RPN-Auth') ?: $request->get_header('Authorization');
    if ( $token && strpos( $token, 'Bearer ' ) === 0 ) $token = substr( $token, 7 );
    $user_id = rpn_verify_token( $token );
    if ( ! $user_id ) return new WP_Error( 'unauthorized', 'Auth required.', [ 'status' => 401 ] );

    $id      = (int) $request->get_param('id');
    $post    = get_post( $id );
    if ( ! $post || $post->post_type !== 'rpn_fantasy_league' ) return new WP_Error( 'not_found', 'League not found.', [ 'status' => 404 ] );

    $members = array_map( 'intval', get_post_meta( $id, 'fl_members', true ) ?: [] );
    if ( ! in_array( $user_id, $members, true ) ) return new WP_Error( 'not_member', 'Join the league before setting picks.', [ 'status' => 403 ] );

    $max_picks  = (int) ( get_post_meta( $id, 'fl_max_picks', true ) ?: 5 );
    $rider_ids  = $request->get_param('rider_ids');
    if ( ! is_array( $rider_ids ) ) $rider_ids = array_filter( array_map( 'trim', explode( ',', sanitize_text_field( $rider_ids ) ) ) );
    $rider_ids  = array_unique( array_slice( array_map( 'intval', $rider_ids ), 0, $max_picks ) );
    $valid_ids  = [];
    foreach ( $rider_ids as $rid ) {
        $p = get_post( $rid );
        if ( $p && $p->post_type === 'rider' ) $valid_ids[] = $rid;
    }
    update_user_meta( $user_id, "rpn_fantasy_{$id}_picks", $valid_ids );
    return rest_ensure_response([ 'success' => true, 'picks' => $valid_ids, 'picks_count' => count( $valid_ids ), 'message' => 'Picks saved!' ]);
}

function rpn_fantasy_my_leagues( $request ) {
    $token   = $request->get_header('X-RPN-Auth') ?: $request->get_header('Authorization');
    if ( $token && strpos( $token, 'Bearer ' ) === 0 ) $token = substr( $token, 7 );
    $user_id = rpn_verify_token( $token );
    if ( ! $user_id ) return new WP_Error( 'unauthorized', 'Auth required.', [ 'status' => 401 ] );

    $all     = get_posts([ 'post_type' => 'rpn_fantasy_league', 'posts_per_page' => -1, 'post_status' => 'publish' ]);
    $results = [];
    foreach ( $all as $p ) {
        $members = array_map( 'intval', get_post_meta( $p->ID, 'fl_members', true ) ?: [] );
        if ( ! in_array( $user_id, $members, true ) ) continue;
        $picks = get_user_meta( $user_id, "rpn_fantasy_{$p->ID}_picks", true ) ?: [];
        $score = 0;
        foreach ( $picks as $rid ) $score += (float) ( get_post_meta( (int) $rid, 'rpi_current', true ) ?: 0 );
        $data                   = rpn_format_fantasy_league( $p );
        $data['my_picks']       = $picks;
        $data['my_score']       = round( $score, 2 );
        $data['is_commissioner'] = (int) get_post_meta( $p->ID, 'fl_commissioner_id', true ) === $user_id;
        $results[]              = $data;
    }
    return rest_ensure_response([ 'leagues' => $results ]);
}

function rpn_format_fantasy_league( $post ) {
    $id = $post->ID;
    return [
        'id'               => $id,
        'name'             => $post->post_title,
        'season'           => get_post_meta( $id, 'fl_season',           true ),
        'max_picks'        => (int) ( get_post_meta( $id, 'fl_max_picks', true ) ?: 5 ),
        'status'           => get_post_meta( $id, 'fl_status',            true ) ?: 'open',
        'is_private'       => get_post_meta( $id, 'fl_is_private',        true ) === '1',
        'member_count'     => count( get_post_meta( $id, 'fl_members',    true ) ?: [] ),
        'commissioner_id'  => (int) get_post_meta( $id, 'fl_commissioner_id', true ),
    ];
}

/* ============================================================
 * PHASE 4 — COLLEGE NIL COMPLIANCE TOOL
 * GET  /rpn/v1/nil-compliance  — get my records
 * POST /rpn/v1/nil-compliance  — add / update a record
 * ============================================================ */
add_action('rest_api_init', function () {
    register_rest_route('rpn/v1', '/nil-compliance', [
        [ 'methods' => 'GET',  'callback' => 'rpn_nil_compliance_get',  'permission_callback' => '__return_true' ],
        [ 'methods' => 'POST', 'callback' => 'rpn_nil_compliance_post', 'permission_callback' => '__return_true' ],
    ]);
});

function rpn_nil_compliance_get( $request ) {
    $token   = $request->get_header('X-RPN-Auth') ?: $request->get_header('Authorization');
    if ( $token && strpos( $token, 'Bearer ' ) === 0 ) $token = substr( $token, 7 );
    $user_id = rpn_verify_token( $token );
    if ( ! $user_id ) return new WP_Error( 'unauthorized', 'Auth required.', [ 'status' => 401 ] );
    $records = get_user_meta( $user_id, 'rpn_nil_compliance', true ) ?: [];
    return rest_ensure_response([ 'records' => $records ]);
}

function rpn_nil_compliance_post( $request ) {
    $token   = $request->get_header('X-RPN-Auth') ?: $request->get_header('Authorization');
    if ( $token && strpos( $token, 'Bearer ' ) === 0 ) $token = substr( $token, 7 );
    $user_id = rpn_verify_token( $token );
    if ( ! $user_id ) return new WP_Error( 'unauthorized', 'Auth required.', [ 'status' => 401 ] );

    $tier = get_user_meta( $user_id, 'rpn_membership_tier', true ) ?: 'free';
    if ( ! in_array( $tier, [ 'competitor', 'elite', 'producer' ], true ) ) {
        return new WP_Error( 'tier_required', 'NIL Compliance Tool requires Competitor or higher membership.', [ 'status' => 403 ] );
    }
    $record = [
        'id'                => sanitize_text_field( $request->get_param('id') ) ?: uniqid( 'nil_', true ),
        'school'            => sanitize_text_field( $request->get_param('school') ),
        'sport'             => sanitize_text_field( $request->get_param('sport') ),
        'season_start'      => sanitize_text_field( $request->get_param('season_start') ),
        'season_end'        => sanitize_text_field( $request->get_param('season_end') ),
        'sponsor_name'      => sanitize_text_field( $request->get_param('sponsor_name') ),
        'income_amount'     => (float) ( $request->get_param('income_amount') ?: 0 ),
        'activity_type'     => sanitize_text_field( $request->get_param('activity_type') ),
        'disclosure_status' => sanitize_text_field( $request->get_param('disclosure_status') ?: 'pending' ),
        'notes'             => sanitize_textarea_field( $request->get_param('notes') ),
        'created_at'        => current_time('mysql'),
    ];
    $records = get_user_meta( $user_id, 'rpn_nil_compliance', true ) ?: [];
    $existing_id = $request->get_param('id');
    if ( $existing_id ) {
        foreach ( $records as &$r ) {
            if ( $r['id'] === $existing_id ) {
                $record['created_at'] = $r['created_at'];
                $r = $record;
                update_user_meta( $user_id, 'rpn_nil_compliance', $records );
                return rest_ensure_response([ 'success' => true, 'record' => $record, 'message' => 'Record updated.' ]);
            }
        }
    }
    $records[] = $record;
    update_user_meta( $user_id, 'rpn_nil_compliance', $records );
    return rest_ensure_response([ 'success' => true, 'record' => $record, 'message' => 'Compliance record saved.' ]);
}

/* ============================================================
 * PHASE 4 — ASSOCIATION DATA IMPORT (WP Admin page)
 * ============================================================ */
add_action('admin_menu', 'rpn_register_association_import_page');
function rpn_register_association_import_page() {
    add_menu_page(
        'RIN — Association Import',
        'RIN Import',
        'manage_options',
        'rin-association-import',
        'rpn_render_association_import_page',
        'dashicons-upload',
        31
    );
}

function rpn_render_association_import_page() {
    $msg           = '';
    $preview_rows  = [];
    $did_import    = false;
    $is_preview    = false;

    if ( ! empty( $_POST['rin_import_submit'] ) && wp_verify_nonce( sanitize_text_field( wp_unslash( $_POST['_wpnonce'] ?? '' ) ), 'rin_association_import' ) ) {
        $association = sanitize_text_field( $_POST['rin_import_association'] ?? 'other' );
        $is_preview  = ! empty( $_POST['rin_import_preview'] );
        $rows_raw    = wp_unslash( $_POST['rin_import_csv_data'] ?? '' );
        $lines       = array_filter( array_map( 'trim', explode( "\n", $rows_raw ) ) );
        $headers     = [];
        $row_count   = 0;
        foreach ( $lines as $i => $line ) {
            $cols = str_getcsv( $line );
            if ( $i === 0 ) { $headers = array_map( 'strtolower', array_map( 'trim', $cols ) ); continue; }
            if ( count( $cols ) < 2 || empty( $headers ) ) continue;
            $row = array_combine( $headers, array_pad( array_slice( $cols, 0, count( $headers ) ), count( $headers ), '' ) );
            $preview_rows[] = $row;
            if ( ! $is_preview ) {
                rpn_import_association_row( $row, $association );
                $row_count++;
            }
        }
        if ( $is_preview ) {
            $msg = '<div class="notice notice-info is-dismissible"><p>Preview: <strong>' . count( $preview_rows ) . '</strong> rows parsed. Review below, then click <em>Import Data</em> to commit.</p></div>';
        } else {
            $did_import = true;
            $msg        = '<div class="notice notice-success is-dismissible"><p>Successfully imported <strong>' . count( $preview_rows ) . '</strong> row(s) from <strong>' . esc_html( strtoupper( $association ) ) . '</strong>. Unmatched riders are logged separately.</p></div>';
        }
    }
    ?>
    <div class="wrap">
        <h1>RIN — Association Data Import</h1>
        <p style="color:#555;max-width:720px;">Paste CSV data from PRCA, WPRA, NHSRA, or other associations. The importer matches riders by <code>rin_id</code> first, then by name. Unmatched rows are saved to a review queue.</p>
        <?php echo $msg; // phpcs:ignore WordPress.Security.EscapeOutput ?>

        <form method="post" id="rin-import-form">
            <?php wp_nonce_field('rin_association_import'); ?>
            <input type="hidden" name="rin_import_preview" id="rin_import_preview_flag" value="">
            <table class="form-table" role="presentation">
                <tr>
                    <th scope="row"><label for="rin_import_association">Association</label></th>
                    <td>
                        <select id="rin_import_association" name="rin_import_association" style="min-width:320px;">
                            <option value="prca">PRCA — Professional Rodeo Cowboys Association</option>
                            <option value="wpra">WPRA — Women's Professional Rodeo Association</option>
                            <option value="nhsra">NHSRA — National High School Rodeo Association</option>
                            <option value="nfr">NFR — National Finals Rodeo</option>
                            <option value="other">Other</option>
                        </select>
                    </td>
                </tr>
                <tr>
                    <th scope="row"><label for="rin_import_csv_data">CSV Data</label></th>
                    <td>
                        <textarea id="rin_import_csv_data" name="rin_import_csv_data" rows="14"
                            style="width:100%;font-family:monospace;font-size:12px;border:1px solid #ccd;border-radius:4px;padding:8px;"
                            placeholder="Paste CSV here — first row = headers."></textarea>
                        <p class="description" style="margin-top:6px;">
                            Flexible column order. Supported columns:
                            <code>rin_id</code>, <code>name</code>, <code>dob</code>,
                            <code>event_name</code>, <code>event_date</code>,
                            <code>performance_type</code> (roughstock|timed),
                            <code>judge_1</code>, <code>judge_2</code>, <code>animal_score</code>,
                            <code>score</code> (single combined), <code>time</code>,
                            <code>covered</code> (yes|no), <code>placement</code>,
                            <code>event_tier</code> (local|regional|national|international)
                        </p>
                    </td>
                </tr>
            </table>
            <p class="submit">
                <button type="submit" name="rin_import_submit" value="1" class="button button-secondary"
                    onclick="document.getElementById('rin_import_preview_flag').value='1';">
                    &#128269; Preview CSV
                </button>
                &nbsp;&nbsp;
                <button type="submit" name="rin_import_submit" value="1" class="button button-primary"
                    onclick="document.getElementById('rin_import_preview_flag').value=''; return confirm('Import these rows? Rider RPI will be recalculated for matched riders.');">
                    &#10003; Import Data
                </button>
            </p>
        </form>

        <?php if ( ! empty( $preview_rows ) ) : ?>
            <h2><?php echo $did_import ? 'Imported Rows' : 'Preview'; ?> (<?php echo count( $preview_rows ); ?>)</h2>
            <div style="overflow-x:auto;">
                <table class="wp-list-table widefat fixed striped" style="min-width:600px;">
                    <thead>
                        <tr>
                            <?php foreach ( array_keys( $preview_rows[0] ) as $col ) : ?>
                                <th style="white-space:nowrap;"><?php echo esc_html( $col ); ?></th>
                            <?php endforeach; ?>
                        </tr>
                    </thead>
                    <tbody>
                        <?php foreach ( $preview_rows as $row ) : ?>
                            <tr>
                                <?php foreach ( $row as $val ) : ?>
                                    <td style="font-size:12px;"><?php echo esc_html( $val ); ?></td>
                                <?php endforeach; ?>
                            </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        <?php endif; ?>

        <?php
        $unmatched = get_option('rpn_import_unmatched', []);
        if ( ! empty( $unmatched ) ) :
        ?>
        <h2 style="margin-top:30px;">Unmatched Riders Queue (<?php echo count( $unmatched ); ?>)</h2>
        <p style="color:#555;">These rows could not be matched to an existing rider. Create the rider profile manually and re-import, or add a <code>rin_id</code> to your CSV.</p>
        <div style="overflow-x:auto;">
            <table class="wp-list-table widefat fixed striped" style="min-width:500px;">
                <thead><tr><th>Name</th><th>Event</th><th>Date</th><th>Association</th><th>Imported At</th><th></th></tr></thead>
                <tbody>
                    <?php foreach ( array_reverse( $unmatched ) as $idx => $u ) : ?>
                        <tr>
                            <td><?php echo esc_html( $u['name'] ?? '—' ); ?></td>
                            <td><?php echo esc_html( $u['event_name'] ?? '—' ); ?></td>
                            <td><?php echo esc_html( $u['event_date'] ?? '—' ); ?></td>
                            <td><?php echo esc_html( strtoupper( $u['association'] ?? '' ) ); ?></td>
                            <td><?php echo esc_html( substr( $u['imported_at'] ?? '', 0, 10 ) ); ?></td>
                            <td><span style="color:#dc2626;font-size:11px;">Unmatched</span></td>
                        </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
        <?php endif; ?>
    </div>
    <?php
}

function rpn_import_association_row( $row, $association ) {
    $rin_id = trim( $row['rin_id'] ?? '' );
    $name   = trim( $row['name']   ?? '' );

    // Match rider post by RIN ID, then by name search
    $rider_post_id = null;
    if ( $rin_id ) {
        $posts = get_posts([ 'post_type' => 'rider', 'meta_key' => 'rin_id', 'meta_value' => $rin_id, 'posts_per_page' => 1 ]);
        if ( $posts ) $rider_post_id = $posts[0]->ID;
    }
    if ( ! $rider_post_id && $name ) {
        $posts = get_posts([ 'post_type' => 'rider', 's' => $name, 'posts_per_page' => 1 ]);
        if ( $posts ) $rider_post_id = $posts[0]->ID;
    }
    if ( ! $rider_post_id ) {
        $unmatched   = get_option('rpn_import_unmatched', []);
        $unmatched[] = array_merge( $row, [ 'association' => $association, 'imported_at' => current_time('mysql') ] );
        update_option( 'rpn_import_unmatched', array_slice( $unmatched, -200 ) );
        return;
    }

    $perf_type  = strtolower( trim( $row['performance_type'] ?? 'roughstock' ) );
    $event_name = sanitize_text_field( $row['event_name'] ?? '' );
    $event_date = sanitize_text_field( $row['event_date'] ?? '' );
    $event_tier = sanitize_text_field( $row['event_tier'] ?? 'regional' );
    $placement  = (int) ( $row['placement'] ?? 0 );
    $meta       = [
        'rider_id'            => $rider_post_id,
        'event_name'          => $event_name,
        'performance_date'    => $event_date,
        'performance_type'    => $perf_type,
        'event_tier'          => $event_tier,
        'placement'           => $placement,
        'verification_status' => 'official',
        'data_source'         => strtoupper( $association ),
        'go_round'            => sanitize_text_field( $row['go_round'] ?? 'Round 1' ),
    ];
    if ( $perf_type === 'roughstock' ) {
        $combined             = (float) ( $row['score'] ?? 0 );
        $meta['judge_1_score'] = (float) ( $row['judge_1'] ?? ( $combined / 2 ) );
        $meta['judge_2_score'] = (float) ( $row['judge_2'] ?? ( $combined / 2 ) );
        $meta['animal_score']  = (float) ( $row['animal_score'] ?? 0 );
        $meta['covered']       = ( strtolower( $row['covered'] ?? 'yes' ) === 'yes' ) ? 'yes' : 'no';
        $meta['total_rides']   = 1;
        $meta['qualified_rides'] = $meta['covered'] === 'yes' ? 1 : 0;
    } else {
        $meta['final_time']    = (float) ( $row['time'] ?? $row['score'] ?? 0 );
        $meta['clean_run']     = ( strtolower( $row['clean'] ?? 'yes' ) === 'yes' ) ? '1' : '0';
        $meta['total_runs']    = 1;
        $meta['clean_runs']    = $meta['clean_run'] === '1' ? 1 : 0;
    }

    $post_id = wp_insert_post([
        'post_type'   => 'rpn_performance',
        'post_title'  => "{$event_name} — {$name} — {$event_date}",
        'post_status' => 'publish',
    ]);
    if ( is_wp_error( $post_id ) ) return;
    foreach ( $meta as $k => $v ) update_post_meta( $post_id, $k, $v );

    // Trigger RPI recalculation for matched rider
    $rider_user_id = (int) get_post_meta( $rider_post_id, 'rider_user_id', true );
    if ( $rider_user_id ) rpn_update_rider_index_from_performances( $rider_user_id );
}
