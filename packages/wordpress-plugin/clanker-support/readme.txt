=== Clanker Support ===
Contributors: clankersupport
Tags: support, chat, ai, chatbot, live chat
Requires at least: 5.7
Tested up to: 6.8
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

AI customer support widget — streaming answers from your knowledge base, human handoff, and live operator replies.

== Description ==

[Clanker Support](https://clankersupport.com) puts an AI support agent on your site. Visitors get streaming answers sourced from your knowledge base, can escalate to a human when the AI isn't enough, and replies you send from the dashboard inbox (or by email) appear in the widget live.

This plugin adds the widget to your WordPress site without touching any code:

* **One-minute setup** — paste your project key under Settings → Clanker Support and the launcher bubble appears on every page.
* **Floating bubble or inline** — use the site-wide bubble, the `[clanker_support]` shortcode to embed the chat inside a page (e.g. Contact), or both.
* **Brand color** — match the launcher and chat bubbles to your site.
* **Human handoff** — configure how many messages a visitor sends before "Talk to a human" appears; escalations notify you by email and Slack.
* **Self-hosting supported** — Clanker Support is open source ([theopenco/llmchat](https://github.com/theopenco/llmchat)); point the API URL setting at your own deployment.

= External services =

This plugin is a connector for the Clanker Support service. When enabled, it loads the widget script from your configured Clanker Support API origin (`https://api.clankersupport.com` by default) on your site's public pages, and messages that visitors type into the widget are sent to that service to generate answers and manage conversations. No data is sent until a visitor interacts with the widget.

* Service: [Clanker Support](https://clankersupport.com)
* [Terms of use](https://clankersupport.com/terms-of-use)
* [Privacy policy](https://clankersupport.com/privacy-policy)

== Installation ==

1. Install and activate the plugin.
2. In your [Clanker Support dashboard](https://clankersupport.com), copy your project's public key (Project → Embed).
3. In WordPress, go to Settings → Clanker Support, paste the key, and save.

The support bubble now shows on every page. To embed the chat inline instead, add the `[clanker_support]` shortcode to any page or post (optional attributes: `width`, `height`).

== Frequently Asked Questions ==

= Is the project key secret? =

No — it is the same public key the script embed uses and is safe to expose in your site's HTML.

= Can I use my own self-hosted deployment? =

Yes. Clanker Support is open source. Set the API URL under Settings → Clanker Support to your own deployment's API origin.

= Does the widget slow my site down? =

The script loads asynchronously and renders after the page is interactive, so it does not block rendering.

== Changelog ==

= 1.0.0 =
* Initial release: floating widget bubble, `[clanker_support]` inline shortcode, brand color, escalation threshold, and self-host API URL settings.
