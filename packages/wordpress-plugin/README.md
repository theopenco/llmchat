=== Clanker Support — AI Chat & Customer Support Widget ===
Contributors: bidbogs
Tags: ai, chatbot, live chat, customer support, helpdesk
Requires at least: 5.8
Tested up to: 7.0
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

AI customer support widget — streaming answers from your knowledge base, human handoff, and live operator replies from your inbox.

== Description ==

[Clanker Support](https://clankersupport.com) puts an AI support agent on your WordPress site. Visitors get streaming answers sourced from your knowledge base, can escalate to a human when the AI isn't enough, and replies you send from the dashboard inbox (or by email) appear in the widget live.

= Features =

* **One-minute setup** — install, paste your project key under Settings → Clanker Support, done. The launcher bubble appears on every page.
* **Answers from your knowledge base** — feed it docs URLs, text snippets, and hand-written Q&A in the dashboard; the AI answers with that context.
* **Human handoff** — configure how many messages a visitor sends before "Talk to a human" appears; escalations notify you by email and Slack.
* **Live operator replies** — answer from the dashboard inbox or simply reply to the notification email; either way the visitor sees it in the widget.
* **Floating bubble or inline** — use the site-wide bubble, the `[clanker_support]` shortcode to embed the chat inside a page (e.g. Contact), or both.
* **Brand color** — match the launcher and chat bubbles to your site, straight from the settings page.
* **Connection check** — the settings page verifies your project key against the API and tells you when something is misconfigured.
* **Open source & self-hostable** — the whole platform is open source ([theopenco/llmchat](https://github.com/theopenco/llmchat)); point the API URL setting at your own deployment if you self-host.

= External services =

This plugin is a connector for the Clanker Support service. When enabled, it loads the widget script from your configured Clanker Support API origin (`https://api.clankersupport.com` by default) on your site's public pages, and messages that visitors type into the widget are sent to that service to generate answers and manage conversations. The settings page additionally makes a server-side request to the same API origin to verify your project key. No visitor data is sent until a visitor interacts with the widget.

* Service: [Clanker Support](https://clankersupport.com)
* [Terms of use](https://clankersupport.com/terms-of-use)
* [Privacy policy](https://clankersupport.com/privacy-policy)

If you self-host Clanker Support, all of the above requests go to your own deployment instead.

== Installation ==

= From the plugin directory =

1. In your WordPress admin, go to Plugins → Add New and search for "Clanker Support".
2. Install and activate the plugin.
3. In your [Clanker Support dashboard](https://app.clankersupport.com), copy your project's public key (Project → Embed).
4. In WordPress, go to Settings → Clanker Support, paste the key, and save.

= Manual installation =

1. Download the plugin ZIP.
2. In your WordPress admin, go to Plugins → Add New → Upload Plugin, choose the ZIP, and activate.
3. Configure it under Settings → Clanker Support as above.

The support bubble now shows on every page. To embed the chat inline instead, add the `[clanker_support]` shortcode to any page or post (optional attributes: `width`, `height`).

== Frequently Asked Questions ==

= Do I need a Clanker Support account? =

Yes — the plugin connects your site to a Clanker Support project. Create one at [clankersupport.com](https://clankersupport.com) (there's a free way to try it), or self-host the open-source platform and point the plugin at your own deployment.

= Is the project key secret? =

No — it is the same public key the script embed uses and is safe to expose in your site's HTML.

= Can I use my own self-hosted deployment? =

Yes. Clanker Support is open source. Set the API URL under Settings → Clanker Support to your own deployment's API origin.

= Does the widget slow my site down? =

No. The script loads asynchronously and renders after the page is interactive, so it does not block rendering. Nothing loads in the admin area.

= Can I put the chat inside a page instead of the floating bubble? =

Yes — add the `[clanker_support]` shortcode to any page or post. It accepts optional `width` and `height` attributes and works even when the site-wide floating bubble is turned off.

= Where do escalated conversations go? =

Escalations notify the email address and/or Slack webhook configured on your project in the dashboard. Replying to the notification email threads your answer straight back into the visitor's widget.

= What data does the plugin store in WordPress? =

Only its settings (one option) and a short-lived connection-status cache (one transient). Conversations live in your Clanker Support project, not in your WordPress database. Uninstalling removes both stored values.

== Screenshots ==

1. Settings → Clanker Support: connection status, widget appearance, and self-hosting options.
2. The floating support bubble answering a visitor from the knowledge base.
3. Inline chat embedded in a page with the [clanker_support] shortcode.
4. The dashboard inbox where escalated conversations land.

== Changelog ==

= 1.0.0 =
* Initial release: floating widget bubble, `[clanker_support]` inline shortcode, brand color, escalation threshold, self-host API URL, and a live connection check on the settings page.

== Upgrade Notice ==

= 1.0.0 =
Initial release.
