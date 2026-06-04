<?php
/**
 * Astra Child Theme — index.php
 *
 * This is the fallback template WordPress uses when no more specific template
 * (page.php, single.php, archive.php, etc.) is found. For an Astra child theme
 * this file must exist and must output real content, otherwise WordPress shows
 * a blank page.
 *
 * For normal posts, pages, shop pages, etc. Astra's own template files take
 * over — this file is only hit as the last-resort fallback.
 *
 * @package Astra Child
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

get_header();
?>

<div id="primary" class="content-area primary-content-area">
	<main id="main" class="site-main">

		<?php
		if ( have_posts() ) :

			/* Start the loop */
			while ( have_posts() ) :
				the_post();
				?>
				<article id="post-<?php the_ID(); ?>" <?php post_class( 'ast-article-post' ); ?>>
					<?php if ( has_post_thumbnail() ) : ?>
						<div class="post-thumb">
							<?php the_post_thumbnail( 'large' ); ?>
						</div>
					<?php endif; ?>

					<div class="entry-header">
						<?php if ( ! is_singular() ) : ?>
							<h2 class="entry-title">
								<a href="<?php the_permalink(); ?>"><?php the_title(); ?></a>
							</h2>
						<?php else : ?>
							<h1 class="entry-title"><?php the_title(); ?></h1>
						<?php endif; ?>
					</div>

					<div class="entry-content">
						<?php
						if ( is_singular() ) {
							the_content();
						} else {
							the_excerpt();
						}
						?>
					</div>
				</article>
				<?php
			endwhile;

			/* Pagination */
			the_posts_pagination( array(
				'prev_text' => '&larr; Previous',
				'next_text' => 'Next &rarr;',
			) );

		else :
			?>
			<p class="no-results">
				<?php esc_html_e( 'No content found. Please check back later.', 'astra-child' ); ?>
			</p>
			<?php
		endif;
		?>

	</main>
</div>

<?php
get_sidebar();
get_footer();
