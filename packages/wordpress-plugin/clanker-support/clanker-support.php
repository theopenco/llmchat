<?php
/**
 * Plugin Name:       Clanker Support
 * Plugin URI:        https://github.com/theopenco/llmchat/tree/main/packages/wordpress-plugin
 * Description:       AI customer support widget — streaming answers from your knowledge base, human handoff, and live operator replies from your inbox.
 * Version:           1.0.0
 * Requires at least: 5.8
 * Requires PHP:      7.4
 * Author:            Clanker Support
 * Author URI:        https://clankersupport.com
 * License:           GPL v2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       clanker-support
 * Domain Path:       /languages
 *
 * @package Clanker_Support
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'CLANKER_SUPPORT_VERSION', '1.0.0' );
define( 'CLANKER_SUPPORT_PLUGIN_FILE', __FILE__ );
define( 'CLANKER_SUPPORT_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );
define( 'CLANKER_SUPPORT_PLUGIN_URL', plugin_dir_url( __FILE__ ) );

require_once CLANKER_SUPPORT_PLUGIN_DIR . 'includes/class-clanker-support-settings.php';
require_once CLANKER_SUPPORT_PLUGIN_DIR . 'includes/class-clanker-support-frontend.php';
require_once CLANKER_SUPPORT_PLUGIN_DIR . 'includes/class-clanker-support-admin.php';
require_once CLANKER_SUPPORT_PLUGIN_DIR . 'includes/class-clanker-support.php';

register_activation_hook( __FILE__, array( 'Clanker_Support', 'activate' ) );

Clanker_Support::instance();
