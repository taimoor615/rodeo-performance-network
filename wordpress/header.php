<?php
/**
 * RIN Child Theme — header.php
 *
 * Overrides Astra's header with the custom RIN navigation:
 *  - Logo (site name)
 *  - Primary menu rendered via wp_nav_menu() with the custom walker
 *  - Desktop: click-based dropdown with chevron toggle button
 *  - Mobile: hamburger toggle that reveals the full menu
 *
 * Copy to your child theme root as header.php.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Custom walker: inserts a chevron <button> after the top-level <a> on any
 * menu item that has child items. The JS below toggles .open on the parent <li>.
 */
if ( ! class_exists( 'RPN_Nav_Walker' ) ) :
	class RPN_Nav_Walker extends Walker_Nav_Menu {
		public function start_el( &$output, $item, $depth = 0, $args = array(), $id = 0 ) {
			parent::start_el( $output, $item, $depth, $args, $id );
			if ( $depth === 0 && in_array( 'menu-item-has-children', $item->classes, true ) ) {
				$output .= '<button class="rpn-dropdown-btn" aria-expanded="false" aria-haspopup="true" tabindex="0">'
					. '<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><polyline points="6 9 12 15 18 9"></polyline></svg>'
					. '</button>';
			}
		}
	}
endif;

?><!DOCTYPE html>
<?php astra_html_before(); ?>
<html <?php language_attributes(); ?>>
<head>
<?php astra_head_top(); ?>
<meta charset="<?php bloginfo( 'charset' ); ?>">
<meta name="viewport" content="width=device-width, initial-scale=1">
<?php wp_head(); ?>
<?php astra_head_bottom(); ?>
</head>

<body <?php astra_schema_body(); ?> <?php body_class(); ?>>
<?php astra_body_top(); ?>
<?php wp_body_open(); ?>

<header id="masthead" class="site-header rpn-header main-nav ast-header-wrap" role="banner">
	<div class="ast-container custom-header-wrapper">

		<!-- Logo -->
		<div class="site-branding">
			<a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="logo" rel="home">
				<?php bloginfo( 'name' ); ?>
			</a>
		</div>

		<!-- Mobile hamburger -->
		<button type="button"
			class="nav-toggle rpn-nav-toggle"
			aria-expanded="false"
			aria-controls="rpn-primary-menu"
			aria-label="<?php esc_attr_e( 'Toggle navigation menu', 'astra' ); ?>">
			<span></span><span></span><span></span>
		</button>

		<!-- Primary nav -->
		<nav id="site-navigation" class="main-navigation" aria-label="<?php esc_attr_e( 'Primary Menu', 'astra' ); ?>">
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
					<li><a href="<?php echo esc_url( home_url( '/' ) ); ?>"><?php esc_html_e( 'Home', 'astra' ); ?></a></li>
				</ul>
			<?php endif; ?>
		</nav>

	</div>
</header>

<script>
(function () {
	'use strict';

	/* ---- Helpers ---- */
	function closeAll() {
		document.querySelectorAll('.menu-item-has-children.open').forEach(function (li) {
			li.classList.remove('open');
			var btn = li.querySelector(':scope > .rpn-dropdown-btn');
			if (btn) btn.setAttribute('aria-expanded', 'false');
		});
	}

	/* ---- Mobile hamburger ---- */
	var toggle = document.querySelector('.rpn-nav-toggle');
	var menu   = document.getElementById('rpn-primary-menu');
	if (toggle && menu) {
		toggle.addEventListener('click', function (e) {
			e.stopPropagation();
			var isOpen = toggle.getAttribute('aria-expanded') === 'true';
			toggle.setAttribute('aria-expanded', String(!isOpen));
			menu.classList.toggle('nav-open', !isOpen);
		});
	}

	/* ---- Desktop dropdown (click chevron button) ---- */
	document.querySelectorAll('.menu-item-has-children').forEach(function (li) {
		var btn = li.querySelector(':scope > .rpn-dropdown-btn');
		if (!btn) return;

		btn.addEventListener('click', function (e) {
			e.stopPropagation();
			var wasOpen = li.classList.contains('open');
			closeAll();
			if (!wasOpen) {
				li.classList.add('open');
				btn.setAttribute('aria-expanded', 'true');
			}
		});
	});

	/* ---- Close on outside click ---- */
	document.addEventListener('click', function () {
		closeAll();
		// Also close mobile menu
		if (toggle && menu) {
			toggle.setAttribute('aria-expanded', 'false');
			menu.classList.remove('nav-open');
		}
	});

	/* ---- Close on Escape ---- */
	document.addEventListener('keydown', function (e) {
		if (e.key === 'Escape') {
			closeAll();
			if (toggle && menu) {
				toggle.setAttribute('aria-expanded', 'false');
				menu.classList.remove('nav-open');
			}
		}
	});
})();
</script>
