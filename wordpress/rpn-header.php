<?php
/**
 * RIN Child Theme — header.php
 *
 * Complete WordPress header template: DOCTYPE, <html>, <head> with wp_head(),
 * opening <body>, and the custom RIN site navigation header.
 *
 * INSTALL: Copy this file to your child theme root as header.php
 *          (wp-content/themes/your-child-theme/header.php)
 *
 * @package RIN Child
 */
?><!DOCTYPE html>
<html <?php language_attributes(); ?>>
<head>
	<meta charset="<?php bloginfo( 'charset' ); ?>">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<link rel="profile" href="https://gmpg.org/xfn/11">
	<?php wp_head(); ?>
</head>

<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

<div id="page" class="site">
	<a class="skip-link screen-reader-text" href="#main"><?php esc_html_e( 'Skip to content', 'astra-child' ); ?></a>

	<?php
	/**
	 * Custom walker: adds a dropdown toggle button with SVG chevron after the
	 * anchor on any top-level item that has children.
	 */
	if ( ! class_exists( 'RPN_Nav_Walker' ) ) :
		class RPN_Nav_Walker extends Walker_Nav_Menu {
			public function start_el( &$output, $item, $depth = 0, $args = array(), $id = 0 ) {
				parent::start_el( $output, $item, $depth, $args, $id );
				if ( $depth === 0 && in_array( 'menu-item-has-children', $item->classes, true ) ) {
					$output .= '<button class="rpn-dropdown-btn" aria-expanded="false" aria-haspopup="true" tabindex="0">'
						. '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>'
						. '</button>';
				}
			}
		}
	endif;
	?>

	<header id="masthead" class="site-header rpn-header main-nav ast-header-wrap" role="banner">
		<div class="ast-container ast-flex ast-justify-content-space-between ast-align-items-center">
			<div class="site-branding">
				<a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="logo" rel="home">
					<?php bloginfo( 'name' ); ?>
				</a>
			</div>

			<button type="button"
				class="nav-toggle rpn-nav-toggle"
				aria-expanded="false"
				aria-label="<?php esc_attr_e( 'Toggle menu', 'astra-child' ); ?>"
				aria-controls="rpn-primary-menu">
				<span></span><span></span><span></span>
			</button>

			<nav id="site-navigation" class="main-navigation ast-flex-grow-1" aria-label="<?php esc_attr_e( 'Primary Menu', 'astra-child' ); ?>">
				<?php
				wp_nav_menu(
					array(
						'theme_location' => 'primary',
						'menu_id'        => 'rpn-primary-menu',
						'menu_class'     => 'rpn-nav-menu',
						'container'      => false,
						'fallback_cb'    => false,
						'depth'          => 2,
						'walker'         => new RPN_Nav_Walker(),
					)
				);
				?>
				<?php if ( ! has_nav_menu( 'primary' ) ) : ?>
					<ul id="rpn-primary-menu" class="rpn-nav-menu">
						<li><a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'Home', 'astra-child' ); ?></a></li>
						<?php if ( function_exists( 'wc_get_page_id' ) && wc_get_page_id( 'shop' ) > 0 ) : ?>
							<li><a href="<?php echo esc_url( get_permalink( wc_get_page_id( 'shop' ) ) ); ?>"><?php esc_html_e( 'Shop', 'astra-child' ); ?></a></li>
							<li><a href="<?php echo esc_url( wc_get_cart_url() ); ?>"><?php esc_html_e( 'Cart', 'astra-child' ); ?></a></li>
						<?php endif; ?>
					</ul>
				<?php endif; ?>
			</nav>
		</div>
	</header>
