<?php
/**
 * Uninstall cleanup: remove the plugin's stored settings.
 */

if ( ! defined( 'WP_UNINSTALL_PLUGIN' ) ) {
	exit;
}

delete_option( 'clanker_support_settings' );
