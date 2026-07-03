<?php
/**
 * Core plugin orchestrator: loads the text domain and wires the admin and
 * frontend components.
 *
 * @package Clanker_Support
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Clanker_Support {

	/**
	 * @var Clanker_Support|null
	 */
	private static $instance = null;

	/**
	 * @return Clanker_Support
	 */
	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
		}
		return self::$instance;
	}

	private function __construct() {
		add_action( 'init', array( $this, 'load_textdomain' ) );

		new Clanker_Support_Frontend();
		if ( is_admin() ) {
			new Clanker_Support_Admin();
		}
	}

	/**
	 * Activation: seed defaults without overwriting an existing configuration
	 * (add_option is a no-op when the option already exists).
	 */
	public static function activate() {
		add_option( Clanker_Support_Settings::OPTION, Clanker_Support_Settings::defaults() );
	}

	public function load_textdomain() {
		load_plugin_textdomain(
			'clanker-support',
			false,
			dirname( plugin_basename( CLANKER_SUPPORT_PLUGIN_FILE ) ) . '/languages'
		);
	}
}
