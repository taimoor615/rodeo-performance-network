<?php
/**
 * The template for displaying the footer.
 *
 * Contains the closing of the #content div and all content after.
 *
 * @link https://developer.wordpress.org/themes/basics/template-files/#template-partials
 *
 * @package Astra
 * @since 1.0.0
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit; // Exit if accessed directly.
}

?>
<footer id="colophon" class="site-footer main-footer rpn-footer" role="contentinfo">
<!-- 	<div class="footer-inner ast-container"> -->
<!-- 		<div class="footer-col footer-brand"> -->
<!-- 			<a href="<?php// echo esc_url( home_url( '/' ) ); ?>" class="footer-logo"><?php bloginfo( 'name' ); ?></a> -->
<!-- // 			<p><?php// esc_html_e( 'Rodeo Performance Network — Performance-based scoring for rodeo athletes, horses, bulls, and pickup teams.', 'astra' ); ?></p> -->
<!-- 		</div> -->
<!-- 		<div class="footer-col footer-links"> -->
<!-- 			<h4><?php //esc_html_e( 'Quick Links', 'astra' ); ?></h4> -->
			<?php
// 			if ( has_nav_menu( 'primary' ) ) {
// 				wp_nav_menu(
// 					array(
// 						'theme_location' => 'primary',
// 						'menu_class'     => '',
// 						'container'      => false,
// 					)
// 				);
// 			} else {
// 				echo '<ul>';
// 				echo '<li><a href="' . esc_url( home_url( '/' ) ) . '">' . esc_html__( 'Home', 'astra' ) . '</a></li>';
// 				if ( function_exists( 'wc_get_page_id' ) && wc_get_page_id( 'shop' ) > 0 ) {
// 					echo '<li><a href="' . esc_url( get_permalink( wc_get_page_id( 'shop' ) ) ) . '">' . esc_html__( 'Shop', 'astra' ) . '</a></li>';
// 					echo '<li><a href="' . esc_url( wc_get_cart_url() ) . '">' . esc_html__( 'Cart', 'astra' ) . '</a></li>';
// 				}
// 				echo '</ul>';
// 			}
			?>
<!-- 		</div>
		<div class="footer-col footer-contact">
			<h4><?php // esc_html_e( 'Contact', 'astra' ); ?></h4>
			<p><?php //esc_html_e( 'Email:', 'astra' ); ?> <a href="mailto:info@rodeoperformance.com">info@rodeoperformance.com</a></p>
			<p><?php //esc_html_e( 'Phone:', 'astra' ); ?> <a href="tel:+18005551234">1-800-555-1234</a></p>
		</div>
		<div class="footer-col footer-social">
			<h4><?php //esc_html_e( 'Follow Us', 'astra' ); ?></h4>
			<div class="footer-social-links">
				<a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook">Facebook</a>
				<a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter">Twitter</a>
				<a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram">Instagram</a>
			</div>
		</div>
	</div> -->
	<div class="footer-bottom">
		<p>&copy; <?php echo esc_html( date( 'Y' ) ); ?> <?php bloginfo( 'name' ); ?>. <?php esc_html_e( 'All rights reserved.', 'astra' ); ?></p>
	</div>
</footer>
<?php
	astra_body_bottom();
	wp_footer();
?>
	</body>
</html>
