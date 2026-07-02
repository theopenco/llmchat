<?php
/**
 * Plugin Name:       Clanker Support
 * Plugin URI:        https://clankersupport.com
 * Description:       AI customer support widget — streaming answers from your knowledge base, human handoff, and live operator replies from your inbox.
 * Version:           1.0.0
 * Requires at least: 5.7
 * Requires PHP:      7.4
 * Author:            Clanker Support
 * Author URI:        https://clankersupport.com
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       clanker-support
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'CLANKER_SUPPORT_VERSION', '1.0.0' );
define( 'CLANKER_SUPPORT_OPTION', 'clanker_support_settings' );
define( 'CLANKER_SUPPORT_DEFAULT_API_URL', 'https://api.clankersupport.com' );
define( 'CLANKER_SUPPORT_SCRIPT_HANDLE', 'clanker-support-widget' );

/**
 * Option defaults. `escalation_threshold` stays an empty string when unset so
 * the widget applies its own server-side default instead of a hardcoded copy.
 */
function clanker_support_defaults() {
	return array(
		'enabled'              => 1,
		'project_key'          => '',
		'api_url'              => CLANKER_SUPPORT_DEFAULT_API_URL,
		'brand_color'          => '#111827',
		'escalation_threshold' => '',
	);
}

function clanker_support_get_settings() {
	$saved = get_option( CLANKER_SUPPORT_OPTION, array() );
	if ( ! is_array( $saved ) ) {
		$saved = array();
	}
	return wp_parse_args( $saved, clanker_support_defaults() );
}

/**
 * `sanitize_hex_color()` is not guaranteed to be loaded outside the
 * customizer on older WordPress versions, so validate locally.
 */
function clanker_support_sanitize_color( $color, $fallback ) {
	$color = trim( (string) $color );
	if ( preg_match( '/^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/', $color ) ) {
		return $color;
	}
	return $fallback;
}

function clanker_support_sanitize_settings( $input ) {
	$defaults = clanker_support_defaults();
	if ( ! is_array( $input ) ) {
		return $defaults;
	}

	$out            = array();
	$out['enabled'] = empty( $input['enabled'] ) ? 0 : 1;

	$out['project_key'] = isset( $input['project_key'] )
		? sanitize_text_field( $input['project_key'] )
		: '';

	$api_url        = isset( $input['api_url'] ) ? esc_url_raw( trim( $input['api_url'] ) ) : '';
	$out['api_url'] = $api_url ? untrailingslashit( $api_url ) : $defaults['api_url'];

	$out['brand_color'] = clanker_support_sanitize_color(
		isset( $input['brand_color'] ) ? $input['brand_color'] : '',
		$defaults['brand_color']
	);

	$threshold = isset( $input['escalation_threshold'] ) ? trim( (string) $input['escalation_threshold'] ) : '';
	$out['escalation_threshold'] = ( '' === $threshold ) ? '' : (string) absint( $threshold );

	return $out;
}

/**
 * Front end: enqueue the widget loader when enabled and configured.
 */
add_action( 'wp_enqueue_scripts', 'clanker_support_enqueue_widget' );
function clanker_support_enqueue_widget() {
	$settings = clanker_support_get_settings();
	if ( empty( $settings['enabled'] ) || empty( $settings['project_key'] ) ) {
		return;
	}
	$src = $settings['api_url'] . '/widget.js';
	// null version: the script is evergreen on the API origin; a ?ver= pinned
	// to the plugin release would defeat its cache busting.
	wp_enqueue_script( CLANKER_SUPPORT_SCRIPT_HANDLE, $src, array(), null, true );
}

/**
 * The widget reads its configuration from data attributes on its own script
 * tag (and `document.currentScript` requires classic execution), so add the
 * attributes and `async` to the tag WordPress prints.
 */
add_filter( 'script_loader_tag', 'clanker_support_filter_script_tag', 10, 3 );
function clanker_support_filter_script_tag( $tag, $handle, $src ) {
	if ( CLANKER_SUPPORT_SCRIPT_HANDLE !== $handle ) {
		return $tag;
	}
	$settings = clanker_support_get_settings();

	$attributes = sprintf(
		' async data-project="%s" data-api="%s" data-brand="%s"',
		esc_attr( $settings['project_key'] ),
		esc_attr( $settings['api_url'] ),
		esc_attr( $settings['brand_color'] )
	);
	if ( '' !== $settings['escalation_threshold'] ) {
		$attributes .= sprintf(
			' data-escalation-threshold="%s"',
			esc_attr( $settings['escalation_threshold'] )
		);
	}

	return str_replace( ' src=', $attributes . ' src=', $tag );
}

/**
 * `[clanker_support]` — inline chat via the API's /embed page in an iframe.
 * Works independently of the floating-bubble toggle so a contact page can
 * embed the chat even when the site-wide bubble is off.
 */
add_shortcode( 'clanker_support', 'clanker_support_shortcode' );
function clanker_support_shortcode( $atts ) {
	$settings = clanker_support_get_settings();
	if ( empty( $settings['project_key'] ) ) {
		return '';
	}
	$atts = shortcode_atts(
		array(
			'width'  => '400',
			'height' => '600',
		),
		$atts,
		'clanker_support'
	);
	$src = $settings['api_url'] . '/embed/' . rawurlencode( $settings['project_key'] );

	return sprintf(
		'<iframe src="%s" width="%d" height="%d" title="%s" style="border: 0; border-radius: 12px; max-width: 100%%;" allow="clipboard-write" loading="lazy"></iframe>',
		esc_url( $src ),
		absint( $atts['width'] ),
		absint( $atts['height'] ),
		esc_attr__( 'Support chat', 'clanker-support' )
	);
}

/**
 * Admin: Settings → Clanker Support.
 */
add_action( 'admin_menu', 'clanker_support_admin_menu' );
function clanker_support_admin_menu() {
	add_options_page(
		__( 'Clanker Support', 'clanker-support' ),
		__( 'Clanker Support', 'clanker-support' ),
		'manage_options',
		'clanker-support',
		'clanker_support_render_settings_page'
	);
}

add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), 'clanker_support_action_links' );
function clanker_support_action_links( $links ) {
	$settings_link = sprintf(
		'<a href="%s">%s</a>',
		esc_url( admin_url( 'options-general.php?page=clanker-support' ) ),
		esc_html__( 'Settings', 'clanker-support' )
	);
	array_unshift( $links, $settings_link );
	return $links;
}

add_action( 'admin_init', 'clanker_support_register_settings' );
function clanker_support_register_settings() {
	register_setting(
		'clanker_support',
		CLANKER_SUPPORT_OPTION,
		array(
			'type'              => 'array',
			'sanitize_callback' => 'clanker_support_sanitize_settings',
			'default'           => clanker_support_defaults(),
		)
	);

	add_settings_section(
		'clanker_support_main',
		'',
		'__return_false',
		'clanker-support'
	);

	add_settings_field(
		'clanker_support_project_key',
		__( 'Project key', 'clanker-support' ),
		'clanker_support_field_project_key',
		'clanker-support',
		'clanker_support_main'
	);
	add_settings_field(
		'clanker_support_enabled',
		__( 'Floating widget', 'clanker-support' ),
		'clanker_support_field_enabled',
		'clanker-support',
		'clanker_support_main'
	);
	add_settings_field(
		'clanker_support_brand_color',
		__( 'Brand color', 'clanker-support' ),
		'clanker_support_field_brand_color',
		'clanker-support',
		'clanker_support_main'
	);
	add_settings_field(
		'clanker_support_escalation_threshold',
		__( 'Escalation threshold', 'clanker-support' ),
		'clanker_support_field_escalation_threshold',
		'clanker-support',
		'clanker_support_main'
	);
	add_settings_field(
		'clanker_support_api_url',
		__( 'API URL', 'clanker-support' ),
		'clanker_support_field_api_url',
		'clanker-support',
		'clanker_support_main'
	);
}

function clanker_support_field_project_key() {
	$settings = clanker_support_get_settings();
	printf(
		'<input type="text" class="regular-text code" name="%s[project_key]" value="%s" placeholder="pk_…" autocomplete="off" />',
		esc_attr( CLANKER_SUPPORT_OPTION ),
		esc_attr( $settings['project_key'] )
	);
	printf(
		'<p class="description">%s</p>',
		esc_html__( 'Your project’s public widget key, from the dashboard under Project → Embed. This key is safe to expose publicly.', 'clanker-support' )
	);
}

function clanker_support_field_enabled() {
	$settings = clanker_support_get_settings();
	printf(
		'<label><input type="checkbox" name="%s[enabled]" value="1" %s /> %s</label>',
		esc_attr( CLANKER_SUPPORT_OPTION ),
		checked( 1, $settings['enabled'], false ),
		esc_html__( 'Show the floating support bubble on every page', 'clanker-support' )
	);
	printf(
		'<p class="description">%s</p>',
		esc_html__( 'The [clanker_support] shortcode keeps working when this is off.', 'clanker-support' )
	);
}

function clanker_support_field_brand_color() {
	$settings = clanker_support_get_settings();
	printf(
		'<input type="color" name="%s[brand_color]" value="%s" />',
		esc_attr( CLANKER_SUPPORT_OPTION ),
		esc_attr( $settings['brand_color'] )
	);
	printf(
		'<p class="description">%s</p>',
		esc_html__( 'Accent color for the launcher, header, and visitor message bubbles.', 'clanker-support' )
	);
}

function clanker_support_field_escalation_threshold() {
	$settings = clanker_support_get_settings();
	printf(
		'<input type="number" class="small-text" min="0" step="1" name="%s[escalation_threshold]" value="%s" placeholder="3" />',
		esc_attr( CLANKER_SUPPORT_OPTION ),
		esc_attr( $settings['escalation_threshold'] )
	);
	printf(
		'<p class="description">%s</p>',
		esc_html__( 'Visitor messages before “Talk to a human” appears. Leave blank for the widget default.', 'clanker-support' )
	);
}

function clanker_support_field_api_url() {
	$settings = clanker_support_get_settings();
	printf(
		'<input type="url" class="regular-text code" name="%s[api_url]" value="%s" placeholder="%s" />',
		esc_attr( CLANKER_SUPPORT_OPTION ),
		esc_attr( $settings['api_url'] ),
		esc_attr( CLANKER_SUPPORT_DEFAULT_API_URL )
	);
	printf(
		'<p class="description">%s</p>',
		esc_html__( 'Only change this when self-hosting Clanker Support — point it at your own deployment’s API origin.', 'clanker-support' )
	);
}

function clanker_support_render_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	?>
	<div class="wrap">
		<h1><?php esc_html_e( 'Clanker Support', 'clanker-support' ); ?></h1>
		<form action="options.php" method="post">
			<?php
			settings_fields( 'clanker_support' );
			do_settings_sections( 'clanker-support' );
			submit_button();
			?>
		</form>
	</div>
	<?php
}
