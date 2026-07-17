# frozen_string_literal: true

# Contract tests for ClankerSupport.script_tag.
#
# The emitted tag must mirror the dashboard's Embed-page snippet
# (apps/dashboard/src/lib/embed-snippets.ts) and the attribute names the
# widget actually reads (packages/widget/src/config.ts): data-project,
# data-api, data-brand, data-mode, data-theme, data-escalation-threshold,
# async. These cases mirror the Python SDK's tests 1:1
# (sdks/python/tests/test_script_tag.py).

require "minitest/autorun"
require "clankersupport"

class ClankerSupportTest < Minitest::Test
	def test_minimal_tag_mirrors_the_dashboard_snippet
		tag = ClankerSupport.script_tag("pk_abc123")
		assert_equal(
			'<script src="https://api.clankersupport.com/widget.js" ' \
				'data-project="pk_abc123" ' \
				'data-api="https://api.clankersupport.com" ' \
				"async></script>",
			tag,
		)
	end

	def test_all_options
		tag = ClankerSupport.script_tag(
			"pk_abc123",
			api_url: "https://support-api.example.com",
			brand_color: "#4f46e5",
			mode: "inline",
			theme: "auto",
			escalation_threshold: 5,
		)
		assert_includes tag, 'src="https://support-api.example.com/widget.js"'
		assert_includes tag, 'data-api="https://support-api.example.com"'
		assert_includes tag, 'data-brand="#4f46e5"'
		assert_includes tag, 'data-mode="inline"'
		assert_includes tag, 'data-theme="auto"'
		assert_includes tag, 'data-escalation-threshold="5"'
	end

	def test_optional_attributes_are_omitted_not_emptied
		tag = ClankerSupport.script_tag("pk_abc123")
		["data-brand", "data-mode", "data-theme", "data-escalation"].each do |absent|
			refute_includes tag, absent
		end
	end

	def test_api_url_trailing_slashes_are_stripped
		tag = ClankerSupport.script_tag("pk_abc123", api_url: "https://api.example.com///")
		assert_includes tag, 'src="https://api.example.com/widget.js"'
		assert_includes tag, 'data-api="https://api.example.com"'
	end

	def test_attribute_values_are_html_escaped
		# A hostile key must not be able to break out of the attribute or
		# close the script element.
		tag = ClankerSupport.script_tag('pk_"><script>alert(1)</script>')
		refute_includes tag, '"><script>alert(1)'
		assert_includes tag, "&quot;&gt;&lt;script&gt;"
		# The tag still has exactly one opening and one closing script element.
		assert_equal 1, tag.scan("<script ").length
		assert_equal 1, tag.scan("</script>").length
	end

	def test_returns_a_plain_string
		# html_safe marking is the Rails helper's job (ClankerSupport::Helper),
		# not script_tag's — outside Rails the return value is a plain String.
		tag = ClankerSupport.script_tag("pk_abc123")
		assert_instance_of String, tag
		if tag.respond_to?(:html_safe?)
			refute_predicate tag, :html_safe?
		end
	end

	def test_empty_project_key_raises
		["", "   "].each do |bad|
			assert_raises(ArgumentError) { ClankerSupport.script_tag(bad) }
		end
	end

	def test_unknown_mode_and_theme_raise
		assert_raises(ArgumentError) { ClankerSupport.script_tag("pk_x", mode: "popup") }
		assert_raises(ArgumentError) { ClankerSupport.script_tag("pk_x", theme: "midnight") }
		# The documented sets stay accepted.
		ClankerSupport::MODES.each do |mode|
			ClankerSupport.script_tag("pk_x", mode: mode)
		end
		ClankerSupport::THEMES.each do |theme|
			ClankerSupport.script_tag("pk_x", theme: theme)
		end
	end

	def test_bad_escalation_threshold_raises
		[0, -1, 2.5, "3", true].each do |bad|
			assert_raises(ArgumentError) do
				ClankerSupport.script_tag("pk_x", escalation_threshold: bad)
			end
		end
	end

	def test_default_api_url_constant
		assert_equal "https://api.clankersupport.com", ClankerSupport::DEFAULT_API_URL
	end
end
