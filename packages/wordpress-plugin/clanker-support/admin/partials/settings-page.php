<?php
/**
 * Settings → Clanker Support page template. Included from
 * Clanker_Support_Admin::render_page() with `$settings` and `$status` in
 * scope.
 *
 * @package Clanker_Support
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

$clanker_status_labels = array(
	'unconfigured' => __( 'Not connected', 'clanker-support' ),
	'connected'    => __( 'Connected', 'clanker-support' ),
	'invalid_key'  => __( 'Invalid project key', 'clanker-support' ),
	'unreachable'  => __( 'API unreachable', 'clanker-support' ),
);
$clanker_recheck_url   = wp_nonce_url(
	admin_url( 'options-general.php?page=clanker-support&clanker-recheck=1' ),
	'clanker-support-recheck'
);
?>
<div class="wrap clanker-support-wrap">
	<div class="clanker-support-header">
		<span class="clanker-support-mark" aria-hidden="true">
			<svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" focusable="false">
				<rect width="512" height="512" rx="112" fill="#4f46e5" />
				<path d="M256 118c-77 0-140 50-140 112 0 36 21 68 54 88l-14 54c-2 8 6 14 13 10l62-35c8 1 17 2 25 2 77 0 140-50 140-111S333 118 256 118z" fill="#fff" />
				<path d="M276 158l-64 88h42l-22 70 70-96h-44l18-62z" fill="#4f46e5" />
			</svg>
		</span>
		<h1><?php esc_html_e( 'Clanker Support', 'clanker-support' ); ?></h1>
		<span class="clanker-support-version">v<?php echo esc_html( CLANKER_SUPPORT_VERSION ); ?></span>
		<span class="clanker-support-status clanker-support-status--<?php echo esc_attr( $status ); ?>">
			<?php echo esc_html( isset( $clanker_status_labels[ $status ] ) ? $clanker_status_labels[ $status ] : $status ); ?>
		</span>
		<?php if ( 'unconfigured' !== $status ) : ?>
			<a class="clanker-support-recheck" href="<?php echo esc_url( $clanker_recheck_url ); ?>"><?php esc_html_e( 'Re-check', 'clanker-support' ); ?></a>
		<?php endif; ?>
	</div>

	<div class="clanker-support-columns">
		<form action="options.php" method="post" class="clanker-support-main">
			<?php settings_fields( 'clanker_support' ); ?>

			<div class="clanker-support-card">
				<h2><?php esc_html_e( 'Connection', 'clanker-support' ); ?></h2>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row">
							<label for="clanker-support-project-key"><?php esc_html_e( 'Project key', 'clanker-support' ); ?></label>
						</th>
						<td>
							<input
								type="text"
								id="clanker-support-project-key"
								class="regular-text code"
								name="<?php echo esc_attr( Clanker_Support_Settings::OPTION ); ?>[project_key]"
								value="<?php echo esc_attr( $settings['project_key'] ); ?>"
								placeholder="pk_…"
								autocomplete="off"
							/>
							<p class="description">
								<?php
								printf(
									/* translators: %s: link to the Clanker Support dashboard. */
									esc_html__( 'Your project’s public widget key, from the %s under Project → Embed. This key is safe to expose publicly.', 'clanker-support' ),
									'<a href="https://app.clankersupport.com" target="_blank" rel="noopener noreferrer">' . esc_html__( 'dashboard', 'clanker-support' ) . '</a>'
								);
								?>
							</p>
						</td>
					</tr>
				</table>
			</div>

			<div class="clanker-support-card">
				<h2><?php esc_html_e( 'Widget', 'clanker-support' ); ?></h2>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><?php esc_html_e( 'Floating widget', 'clanker-support' ); ?></th>
						<td>
							<label>
								<input
									type="checkbox"
									name="<?php echo esc_attr( Clanker_Support_Settings::OPTION ); ?>[enabled]"
									value="1"
									<?php checked( 1, $settings['enabled'] ); ?>
								/>
								<?php esc_html_e( 'Show the floating support bubble on every page', 'clanker-support' ); ?>
							</label>
							<p class="description"><?php esc_html_e( 'The [clanker_support] shortcode keeps working when this is off.', 'clanker-support' ); ?></p>
						</td>
					</tr>
					<tr>
						<th scope="row">
							<label for="clanker-support-brand-color"><?php esc_html_e( 'Brand color', 'clanker-support' ); ?></label>
						</th>
						<td>
							<input
								type="color"
								id="clanker-support-brand-color"
								name="<?php echo esc_attr( Clanker_Support_Settings::OPTION ); ?>[brand_color]"
								value="<?php echo esc_attr( $settings['brand_color'] ); ?>"
							/>
							<p class="description"><?php esc_html_e( 'Accent color for the launcher, header, and visitor message bubbles.', 'clanker-support' ); ?></p>
						</td>
					</tr>
					<tr>
						<th scope="row">
							<label for="clanker-support-escalation-threshold"><?php esc_html_e( 'Escalation threshold', 'clanker-support' ); ?></label>
						</th>
						<td>
							<input
								type="number"
								id="clanker-support-escalation-threshold"
								class="small-text"
								min="0"
								step="1"
								name="<?php echo esc_attr( Clanker_Support_Settings::OPTION ); ?>[escalation_threshold]"
								value="<?php echo esc_attr( $settings['escalation_threshold'] ); ?>"
								placeholder="3"
							/>
							<p class="description"><?php esc_html_e( 'Visitor messages before “Talk to a human” appears. Leave blank for the widget default.', 'clanker-support' ); ?></p>
						</td>
					</tr>
				</table>
			</div>

			<div class="clanker-support-card">
				<h2><?php esc_html_e( 'Self-hosting', 'clanker-support' ); ?></h2>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row">
							<label for="clanker-support-api-url"><?php esc_html_e( 'API URL', 'clanker-support' ); ?></label>
						</th>
						<td>
							<input
								type="url"
								id="clanker-support-api-url"
								class="regular-text code"
								name="<?php echo esc_attr( Clanker_Support_Settings::OPTION ); ?>[api_url]"
								value="<?php echo esc_attr( $settings['api_url'] ); ?>"
								placeholder="<?php echo esc_attr( Clanker_Support_Settings::DEFAULT_API_URL ); ?>"
							/>
							<p class="description"><?php esc_html_e( 'Only change this when self-hosting Clanker Support — point it at your own deployment’s API origin.', 'clanker-support' ); ?></p>
						</td>
					</tr>
				</table>
			</div>

			<?php submit_button(); ?>
		</form>

		<aside class="clanker-support-sidebar">
			<div class="clanker-support-card">
				<h2><?php esc_html_e( 'Inline chat', 'clanker-support' ); ?></h2>
				<p><?php esc_html_e( 'Embed the chat inside any page or post — for example a Contact page — with the shortcode:', 'clanker-support' ); ?></p>
				<code class="clanker-support-code">[clanker_support width="400" height="600"]</code>
				<p class="description"><?php esc_html_e( 'Both attributes are optional. The inline chat works even when the floating bubble is turned off.', 'clanker-support' ); ?></p>
			</div>

			<div class="clanker-support-card">
				<h2><?php esc_html_e( 'How it works', 'clanker-support' ); ?></h2>
				<ol class="clanker-support-steps">
					<li><?php esc_html_e( 'Add your docs, snippets, and Q&A to the knowledge base in the dashboard.', 'clanker-support' ); ?></li>
					<li><?php esc_html_e( 'Visitors get streaming AI answers grounded in that knowledge.', 'clanker-support' ); ?></li>
					<li><?php esc_html_e( 'Escalations notify you by email and Slack; your replies appear in the widget live.', 'clanker-support' ); ?></li>
				</ol>
			</div>

			<div class="clanker-support-card">
				<h2><?php esc_html_e( 'Resources', 'clanker-support' ); ?></h2>
				<ul class="clanker-support-links">
					<li><a href="https://app.clankersupport.com" target="_blank" rel="noopener noreferrer"><?php esc_html_e( 'Dashboard', 'clanker-support' ); ?></a></li>
					<li><a href="https://clankersupport.com/docs" target="_blank" rel="noopener noreferrer"><?php esc_html_e( 'Documentation', 'clanker-support' ); ?></a></li>
					<li><a href="https://github.com/theopenco/llmchat" target="_blank" rel="noopener noreferrer"><?php esc_html_e( 'Source code (GitHub)', 'clanker-support' ); ?></a></li>
				</ul>
			</div>
		</aside>
	</div>
</div>
