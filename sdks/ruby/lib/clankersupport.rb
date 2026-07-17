# frozen_string_literal: true

# Render the Clanker Support widget embed for Ruby web apps.
#
# The widget itself is client-side JavaScript served by the Clanker Support
# API (+/widget.js+); a backend's job is only to emit the script tag with the
# right +data-*+ attributes. {ClankerSupport.script_tag} does that with
# HTML-attribute escaping, mirroring the snippet the dashboard's Embed page
# generates.
#
#   require "clankersupport"
#
#   tag = ClankerSupport.script_tag("pk_your_project_key")
#
# The return value is a plain +String+. In Rails, use the +clanker_support_tag+
# view helper (see ClankerSupport::Helper), which marks the tag +html_safe+.

require "cgi"

require_relative "clankersupport/version"

module ClankerSupport
	DEFAULT_API_URL = "https://api.clankersupport.com"

	# +data-mode+ values the widget understands. +bubble+ (the default) is the
	# floating launcher; +inline+ mounts the panel in place.
	MODES = ["bubble", "inline"].freeze

	# +data-theme+ values the widget understands. Absent means +light+.
	THEMES = ["light", "dark", "auto"].freeze

	# Build the Clanker Support widget +<script>+ tag.
	#
	# @param project_key [String] the project's public widget key (dashboard →
	#   Project → Embed). Safe to expose — it's the same key the script embed uses.
	# @param api_url [String] API origin. Point at your own deployment when
	#   self-hosting; trailing slashes are stripped.
	# @param brand_color [String, nil] accent color for the launcher/header,
	#   e.g. "#4f46e5". Omitted → the widget default.
	# @param mode [String, nil] "bubble" (floating launcher, default) or "inline".
	# @param theme [String, nil] "light" (default), "dark", or "auto" (follow OS).
	# @param escalation_threshold [Integer, nil] visitor messages before
	#   "Talk to a human" appears. Omitted → the project's configured default.
	# @return [String]
	# @raise [ArgumentError] on an empty project key, an unknown mode/theme, or
	#   a non-positive escalation threshold — misconfiguration should fail at
	#   render time in development, not silently ship a broken widget.
	def self.script_tag(
		project_key,
		api_url: DEFAULT_API_URL,
		brand_color: nil,
		mode: nil,
		theme: nil,
		escalation_threshold: nil
	)
		key = project_key.to_s
		raise ArgumentError, "project_key is required" if key.strip.empty?
		if !mode.nil? && !MODES.include?(mode)
			raise ArgumentError, "mode must be one of #{MODES.inspect}, got #{mode.inspect}"
		end
		if !theme.nil? && !THEMES.include?(theme)
			raise ArgumentError, "theme must be one of #{THEMES.inspect}, got #{theme.inspect}"
		end
		if !escalation_threshold.nil?
			unless escalation_threshold.is_a?(Integer) && escalation_threshold >= 1
				raise ArgumentError,
					"escalation_threshold must be a positive Integer, got #{escalation_threshold.inspect}"
			end
		end

		base = api_url.to_s.sub(%r{/+\z}, "")
		parts = [
			%(<script src="#{escape_attr(base)}/widget.js"),
			%(data-project="#{escape_attr(key)}"),
			%(data-api="#{escape_attr(base)}"),
		]
		parts << %(data-brand="#{escape_attr(brand_color)}") unless brand_color.nil?
		parts << %(data-mode="#{escape_attr(mode)}") unless mode.nil?
		parts << %(data-theme="#{escape_attr(theme)}") unless theme.nil?
		unless escalation_threshold.nil?
			parts << %(data-escalation-threshold="#{escalation_threshold}")
		end
		parts << "async></script>"
		parts.join(" ")
	end

	# HTML-attribute escaping, mirroring the dashboard snippet generator.
	def self.escape_attr(value)
		CGI.escapeHTML(value.to_s)
	end
	private_class_method :escape_attr
end

require_relative "clankersupport/railtie" if defined?(Rails::Railtie)
