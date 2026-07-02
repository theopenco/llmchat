<?php
/**
 * Public site integration: enqueues the widget loader and registers the
 * `[clanker_support]` inline-chat shortcode.
 *
 * @package Clanker_Support
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Clanker_Support_Frontend {

	const SCRIPT_HANDLE = 'clanker-support-widget';

	public function __construct() {
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue_widget' ) );
		add_filter( 'script_loader_tag', array( $this, 'filter_script_tag' ), 10, 3 );
		add_shortcode( 'clanker_support', array( $this, 'render_shortcode' ) );
	}

	/**
	 * Enqueue the widget loader when the floating bubble is enabled and a
	 * project key is configured.
	 */
	public function enqueue_widget() {
		$settings = Clanker_Support_Settings::get();
		if ( empty( $settings['enabled'] ) || empty( $settings['project_key'] ) ) {
			return;
		}
		$src = $settings['api_url'] . '/widget.js';
		// null version: the script is evergreen on the API origin; a ?ver=
		// pinned to the plugin release would defeat its cache busting.
		wp_enqueue_script( self::SCRIPT_HANDLE, $src, array(), null, true ); // phpcs:ignore WordPress.WP.EnqueuedResourceParameters.NoExplicitVersion
	}

	/**
	 * The widget reads its configuration from data attributes on its own
	 * script tag (and `document.currentScript` requires classic execution),
	 * so add the attributes and `async` to the tag WordPress prints.
	 *
	 * @param string $tag    The complete script tag.
	 * @param string $handle The script handle.
	 * @param string $src    The script source URL.
	 * @return string
	 */
	public function filter_script_tag( $tag, $handle, $src ) {
		if ( self::SCRIPT_HANDLE !== $handle ) {
			return $tag;
		}
		$settings = Clanker_Support_Settings::get();

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
	 * `[clanker_support]` — inline chat via the API's /embed page in an
	 * iframe. Works independently of the floating-bubble toggle so a contact
	 * page can embed the chat even when the site-wide bubble is off.
	 *
	 * @param array|string $atts Shortcode attributes.
	 * @return string
	 */
	public function render_shortcode( $atts ) {
		$settings = Clanker_Support_Settings::get();
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
		$src  = $settings['api_url'] . '/embed/' . rawurlencode( $settings['project_key'] );

		return sprintf(
			'<iframe src="%s" width="%d" height="%d" title="%s" style="border: 0; border-radius: 12px; max-width: 100%%;" allow="clipboard-write" loading="lazy"></iframe>',
			esc_url( $src ),
			absint( $atts['width'] ),
			absint( $atts['height'] ),
			esc_attr__( 'Support chat', 'clanker-support' )
		);
	}
}
