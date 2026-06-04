<?php
/**
 * RIN Child Theme — footer.php
 *
 * Complete WordPress footer template: site footer markup, wp_footer()
 * (loads all plugin/theme JS), closing </body> and </html>.
 *
 * INSTALL: Copy this file to your child theme root as footer.php
 *          (wp-content/themes/your-child-theme/footer.php)
 *
 * @package RIN Child
 */
?>
	<footer id="colophon" class="site-footer main-footer rpn-footer" role="contentinfo">
		<div class="footer-inner ast-container">
			<div class="footer-col footer-brand">
				<a href="<?php echo esc_url( home_url( '/' ) ); ?>" class="footer-logo">
					<?php bloginfo( 'name' ); ?>
				</a>
				<p><?php esc_html_e( 'Rodeo Identification Network — Performance-based scoring for rodeo athletes, horses, bulls, and pickup teams.', 'astra-child' ); ?></p>
			</div>

			<div class="footer-col footer-links">
				<h4><?php esc_html_e( 'Quick Links', 'astra-child' ); ?></h4>
				<?php
				if ( has_nav_menu( 'primary' ) ) {
					wp_nav_menu(
						array(
							'theme_location' => 'primary',
							'menu_class'     => 'footer-menu',
							'container'      => false,
							'depth'          => 1,
						)
					);
				} else {
					echo '<ul class="footer-menu">';
					echo '<li><a href="' . esc_url( home_url( '/' ) ) . '">' . esc_html__( 'Home', 'astra-child' ) . '</a></li>';
					if ( function_exists( 'wc_get_page_id' ) && wc_get_page_id( 'shop' ) > 0 ) {
						echo '<li><a href="' . esc_url( get_permalink( wc_get_page_id( 'shop' ) ) ) . '">' . esc_html__( 'Shop', 'astra-child' ) . '</a></li>';
						echo '<li><a href="' . esc_url( wc_get_cart_url() ) . '">' . esc_html__( 'Cart', 'astra-child' ) . '</a></li>';
					}
					echo '</ul>';
				}
				?>
			</div>

			<div class="footer-col footer-contact">
				<h4><?php esc_html_e( 'Contact', 'astra-child' ); ?></h4>
				<p><?php esc_html_e( 'Email:', 'astra-child' ); ?> <a href="mailto:info@rodeoperformance.com">info@rodeoperformance.com</a></p>
				<p><?php esc_html_e( 'Phone:', 'astra-child' ); ?> <a href="tel:+18005551234">1-800-555-1234</a></p>
			</div>

			<div class="footer-col footer-social">
				<h4><?php esc_html_e( 'Follow Us', 'astra-child' ); ?></h4>
				<div class="footer-social-links">
					<a href="https://facebook.com" target="_blank" rel="noopener noreferrer" aria-label="Facebook">Facebook</a>
					<a href="https://twitter.com" target="_blank" rel="noopener noreferrer" aria-label="Twitter">Twitter</a>
					<a href="https://instagram.com" target="_blank" rel="noopener noreferrer" aria-label="Instagram">Instagram</a>
				</div>
			</div>
		</div>

		<div class="footer-bottom">
			<p>&copy; <?php echo esc_html( gmdate( 'Y' ) ); ?> <?php bloginfo( 'name' ); ?>. <?php esc_html_e( 'All rights reserved.', 'astra-child' ); ?></p>
		</div>
	</footer>

</div><!-- #page -->

<?php wp_footer(); ?>
</body>
</html>
