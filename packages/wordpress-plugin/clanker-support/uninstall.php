<?php
/**
 * Uninstall cleanup: remove every value the plugin stores.
 *
 * @package Clanker_Support
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'clanker_support_settings' );
delete_transient( 'clanker_support_status' );
