<?php
/**
 * Option storage, defaults, and sanitization.
 *
 * @package Clanker_Support
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Clanker_Support_Settings {

	const OPTION           = 'clanker_support_settings';
	const STATUS_TRANSIENT = 'clanker_support_status';
	const DEFAULT_API_URL  = 'https://api.clankersupport.com';

	/**
	 * `escalation_threshold` stays an empty string when unset so the widget
	 * applies its own server-side default instead of a hardcoded copy.
	 *
	 * @return array
	 */
	public static function defaults() {
		return array(
			'enabled'              => 1,
			'project_key'          => '',
			'api_url'              => self::DEFAULT_API_URL,
			'brand_color'          => '#111827',
			'escalation_threshold' => '',
		);
	}

	/**
	 * @return array Saved settings merged over defaults.
	 */
	public static function get() {
		$saved = get_option( self::OPTION, array() );
		if ( ! is_array( $saved ) ) {
			$saved = array();
		}
		return wp_parse_args( $saved, self::defaults() );
	}

	/**
	 * register_setting sanitize callback.
	 *
	 * @param mixed $input Raw submitted value.
	 * @return array
	 */
	public static function sanitize( $input ) {
		// Any save may change the key or API URL, so the cached connection
		// status is stale either way.
		delete_transient( self::STATUS_TRANSIENT );

		$defaults = self::defaults();
		if ( ! is_array( $input ) ) {
			return $defaults;
		}

		$out            = array();
		$out['enabled'] = empty( $input['enabled'] ) ? 0 : 1;

		$out['project_key'] = isset( $input['project_key'] )
			? sanitize_text_field( $input['project_key'] )
			: '';

		$api_url        = isset( $input['api_url'] ) ? esc_url_raw( trim( (string) $input['api_url'] ) ) : '';
		$out['api_url'] = $api_url ? untrailingslashit( $api_url ) : $defaults['api_url'];

		$out['brand_color'] = self::sanitize_color(
			isset( $input['brand_color'] ) ? $input['brand_color'] : '',
			$defaults['brand_color']
		);

		$threshold                   = isset( $input['escalation_threshold'] ) ? trim( (string) $input['escalation_threshold'] ) : '';
		$out['escalation_threshold'] = ( '' === $threshold ) ? '' : (string) absint( $threshold );

		return $out;
	}

	/**
	 * `sanitize_hex_color()` is not guaranteed to be loaded outside the
	 * customizer on older WordPress versions, so validate locally. Expands
	 * 3-digit hex to 6 digits because `<input type="color">` only accepts
	 * the long form.
	 *
	 * @param string $color    Submitted color.
	 * @param string $fallback Value to use when invalid.
	 * @return string
	 */
	public static function sanitize_color( $color, $fallback ) {
		$color = trim( (string) $color );
		if ( ! preg_match( '/^#([A-Fa-f0-9]{3}|[A-Fa-f0-9]{6})$/', $color ) ) {
			return $fallback;
		}
		if ( 4 === strlen( $color ) ) {
			$color = '#' . $color[1] . $color[1] . $color[2] . $color[2] . $color[3] . $color[3];
		}
		return strtolower( $color );
	}
}
