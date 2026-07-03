<?php
/**
 * Admin integration: the Settings → Clanker Support page, connection
 * verification against the API, and plugins-list links.
 *
 * @package Clanker_Support
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

final class Clanker_Support_Admin {

	const PAGE_SLUG = 'clanker-support';

	public function __construct() {
		add_action( 'admin_menu', array( $this, 'register_menu' ) );
		add_action( 'admin_init', array( $this, 'register_settings' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue_assets' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( CLANKER_SUPPORT_PLUGIN_FILE ), array( $this, 'action_links' ) );
		add_filter( 'plugin_row_meta', array( $this, 'row_meta' ), 10, 2 );
	}

	public function register_menu() {
		add_options_page(
			__( 'Clanker Support', 'clanker-support' ),
			__( 'Clanker Support', 'clanker-support' ),
			'manage_options',
			self::PAGE_SLUG,
			array( $this, 'render_page' )
		);
	}

	public function register_settings() {
		register_setting(
			'clanker_support',
			Clanker_Support_Settings::OPTION,
			array(
				'type'              => 'array',
				'sanitize_callback' => array( 'Clanker_Support_Settings', 'sanitize' ),
				'default'           => Clanker_Support_Settings::defaults(),
			)
		);
	}

	/**
	 * @param string $hook_suffix Current admin page hook.
	 */
	public function enqueue_assets( $hook_suffix ) {
		if ( 'settings_page_' . self::PAGE_SLUG !== $hook_suffix ) {
			return;
		}
		wp_enqueue_style(
			'clanker-support-admin',
			CLANKER_SUPPORT_PLUGIN_URL . 'admin/css/clanker-support-admin.css',
			array(),
			CLANKER_SUPPORT_VERSION
		);
	}

	/**
	 * @param array $links Existing action links.
	 * @return array
	 */
	public function action_links( $links ) {
		$settings_link = sprintf(
			'<a href="%s">%s</a>',
			esc_url( admin_url( 'options-general.php?page=' . self::PAGE_SLUG ) ),
			esc_html__( 'Settings', 'clanker-support' )
		);
		array_unshift( $links, $settings_link );
		return $links;
	}

	/**
	 * @param array  $meta Plugin row meta links.
	 * @param string $file Plugin basename the row belongs to.
	 * @return array
	 */
	public function row_meta( $meta, $file ) {
		if ( plugin_basename( CLANKER_SUPPORT_PLUGIN_FILE ) !== $file ) {
			return $meta;
		}
		$meta[] = sprintf(
			'<a href="%s" target="_blank" rel="noopener noreferrer">%s</a>',
			esc_url( 'https://clankersupport.com/docs' ),
			esc_html__( 'Docs', 'clanker-support' )
		);
		$meta[] = sprintf(
			'<a href="%s" target="_blank" rel="noopener noreferrer">%s</a>',
			esc_url( 'https://github.com/theopenco/llmchat' ),
			esc_html__( 'Source code', 'clanker-support' )
		);
		return $meta;
	}

	/**
	 * Verify the configured project key against the API's public config
	 * endpoint (`GET /v1/config/{key}` — 200 for a valid key, 404 otherwise).
	 * The result is cached for five minutes; saving the settings clears it.
	 *
	 * @return string One of 'unconfigured' | 'connected' | 'invalid_key' | 'unreachable'.
	 */
	public function connection_status() {
		$settings = Clanker_Support_Settings::get();
		if ( '' === $settings['project_key'] ) {
			return 'unconfigured';
		}

		$force = false;
		if ( isset( $_GET['clanker-recheck'] ) ) {
			check_admin_referer( 'clanker-support-recheck' );
			$force = true;
		}

		$cached = get_transient( Clanker_Support_Settings::STATUS_TRANSIENT );
		if ( ! $force && false !== $cached ) {
			return $cached;
		}

		$url      = $settings['api_url'] . '/v1/config/' . rawurlencode( $settings['project_key'] );
		$response = wp_remote_get( $url, array( 'timeout' => 5 ) );

		if ( is_wp_error( $response ) ) {
			$status = 'unreachable';
		} else {
			$code = (int) wp_remote_retrieve_response_code( $response );
			if ( 200 === $code ) {
				$status = 'connected';
			} elseif ( 404 === $code ) {
				$status = 'invalid_key';
			} else {
				$status = 'unreachable';
			}
		}

		set_transient( Clanker_Support_Settings::STATUS_TRANSIENT, $status, 5 * MINUTE_IN_SECONDS );
		return $status;
	}

	public function render_page() {
		if ( ! current_user_can( 'manage_options' ) ) {
			return;
		}
		$settings = Clanker_Support_Settings::get();
		$status   = $this->connection_status();
		require CLANKER_SUPPORT_PLUGIN_DIR . 'admin/partials/settings-page.php';
	}
}
