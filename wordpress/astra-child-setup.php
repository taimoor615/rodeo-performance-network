<?php
/**
 * RPN Astra Child Theme – Setup snippet
 *
 * INSTRUCTIONS:
 * 1. Create a child theme of Astra (e.g. "astra-child" or "rpn-astra").
 * 2. Copy rpn-theme.css into the child theme root.
 * 3. Copy rpn-header.php and rpn-footer.php into the child theme root (or a subfolder and adjust paths below).
 * 4. In the child theme's functions.php, add: require_once get_stylesheet_directory() . '/astra-child-setup.php';
 *    OR copy the code below into your child theme's functions.php.
 *
 * Menu: Assign a menu to "Primary" in Appearance > Menus so the header and footer use it.
 */
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Declare theme features.
 * custom-logo: enables the Logo upload field in Appearance > Customize > Site Identity.
 * Must run on after_setup_theme so WordPress registers it before the Customizer loads.
 */
add_action( 'after_setup_theme', 'rpn_child_theme_setup' );
function rpn_child_theme_setup() {
	add_theme_support(
		'custom-logo',
		array(
			'height'      => 80,
			'width'       => 200,
			'flex-height' => true,
			'flex-width'  => true,
		)
	);
}

/**
 * Enqueue RPN theme styles (same colors as frontend app).
 */
add_action( 'wp_enqueue_scripts', 'rpn_astra_enqueue_styles', 20 );
function rpn_astra_enqueue_styles() {
	wp_enqueue_style(
		'rpn-theme',
		get_stylesheet_directory_uri() . '/rpn-theme.css',
		array( 'astra-theme-css' ),
		'1.0'
	);
}

// Nav JS is handled inline in header.php to avoid double event listener attachment.

/**
 * Optional: Replace Astra header with RPN header (uncomment to use).
 * Requires rpn-header.php in child theme root.
 */
// add_action( 'astra_header', 'rpn_render_header', 1 );
// function rpn_render_header() {
// 	astra_markup_close( 'header' );
// 	ob_start();
// 	get_template_part( 'rpn-header' );
// 	$header = ob_get_clean();
// 	echo $header;
// 	astra_markup_open( 'header' );
// }
// Or simpler: use Astra Customizer to set a custom header layout, or in child theme override header.php and call get_template_part( 'rpn-header' ).

/**
 * Optional: Replace Astra footer with RPN footer (uncomment to use).
 * Requires rpn-footer.php in child theme root.
 */
// add_action( 'astra_footer', 'rpn_render_footer', 1 );
// function rpn_render_footer() {
// 	astra_markup_close( 'footer' );
// 	get_template_part( 'rpn-footer' );
// 	astra_markup_open( 'footer' );
// }

/**
 * Add body class for RPN styling on WooCommerce pages.
 */
add_filter( 'body_class', 'rpn_body_classes' );
function rpn_body_classes( $classes ) {
	$classes[] = 'rpn-woocommerce-theme';
	return $classes;
}

/**
 * Load the RIN WooCommerce checkout funnel customizations.
 * Handles link removal on cart / checkout / thank-you pages.
 */
$rpn_checkout_file = get_stylesheet_directory() . '/rpn-woo-checkout.php';
if ( file_exists( $rpn_checkout_file ) ) {
	require_once $rpn_checkout_file;
}

/**
 * Inject the funnel step-tracker HTML just before the WooCommerce main content.
 * Shows:  1 Cart  ——  2 Checkout  ——  3 Complete
 */
add_action( 'woocommerce_before_main_content', 'rin_render_funnel_steps', 5 );
function rin_render_funnel_steps() {
	if ( ! is_cart() && ! is_checkout() ) {
		return;
	}
	$cart_active     = is_cart()     ? 'active' : 'done';
	$checkout_active = is_checkout() && ! is_wc_endpoint_url( 'order-received' ) ? 'active' : ( is_wc_endpoint_url( 'order-received' ) ? 'done' : '' );
	$complete_active = is_wc_endpoint_url( 'order-received' ) ? 'active' : '';
	$line1_done      = ( $cart_active === 'done' || $checkout_active !== '' ) ? 'done' : '';
	$line2_done      = $complete_active === 'active' ? 'done' : '';
	?>
	<div class="rin-steps" role="navigation" aria-label="Checkout progress">
		<div class="rin-step <?php echo esc_attr( $cart_active ); ?>">
			<span class="rin-step-num"><?php echo $cart_active === 'done' ? '✓' : '1'; ?></span>
			<span>Cart</span>
		</div>
		<div class="rin-step-line <?php echo esc_attr( $line1_done ); ?>"></div>
		<div class="rin-step <?php echo esc_attr( $checkout_active ); ?>">
			<span class="rin-step-num"><?php echo $checkout_active === 'done' ? '✓' : '2'; ?></span>
			<span>Checkout</span>
		</div>
		<div class="rin-step-line <?php echo esc_attr( $line2_done ); ?>"></div>
		<div class="rin-step <?php echo esc_attr( $complete_active ); ?>">
			<span class="rin-step-num">3</span>
			<span>Complete</span>
		</div>
	</div>
	<?php
}
