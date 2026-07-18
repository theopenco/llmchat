"""Contract tests for clankersupport.script_tag.

The emitted tag must mirror the dashboard's Embed-page snippet
(apps/dashboard/src/lib/embed-snippets.ts) and the attribute names the widget
actually reads (packages/widget/src/config.ts): data-project, data-api,
data-brand, data-mode, data-theme, data-escalation-threshold, async.
"""

import unittest

from clankersupport import (
	DEFAULT_API_URL,
	MODES,
	THEMES,
	ScriptTag,
	script_tag,
)


class TestScriptTag(unittest.TestCase):
	def test_minimal_tag_mirrors_the_dashboard_snippet(self):
		tag = script_tag("pk_abc123")
		self.assertEqual(
			tag,
			'<script src="https://api.clankersupport.com/widget.js" '
			'data-project="pk_abc123" '
			'data-api="https://api.clankersupport.com" '
			"async></script>",
		)

	def test_all_options(self):
		tag = script_tag(
			"pk_abc123",
			api_url="https://support-api.example.com",
			brand_color="#4f46e5",
			mode="inline",
			theme="auto",
			escalation_threshold=5,
		)
		self.assertIn('src="https://support-api.example.com/widget.js"', tag)
		self.assertIn('data-api="https://support-api.example.com"', tag)
		self.assertIn('data-brand="#4f46e5"', tag)
		self.assertIn('data-mode="inline"', tag)
		self.assertIn('data-theme="auto"', tag)
		self.assertIn('data-escalation-threshold="5"', tag)

	def test_optional_attributes_are_omitted_not_emptied(self):
		tag = script_tag("pk_abc123")
		for absent in ("data-brand", "data-mode", "data-theme", "data-escalation"):
			self.assertNotIn(absent, tag)

	def test_api_url_trailing_slashes_are_stripped(self):
		tag = script_tag("pk_abc123", api_url="https://api.example.com///")
		self.assertIn('src="https://api.example.com/widget.js"', tag)
		self.assertIn('data-api="https://api.example.com"', tag)

	def test_attribute_values_are_html_escaped(self):
		# A hostile key must not be able to break out of the attribute or
		# close the script element.
		tag = script_tag('pk_"><script>alert(1)</script>')
		self.assertNotIn('"><script>alert(1)', tag)
		self.assertIn("&quot;&gt;&lt;script&gt;", tag)
		# The tag still has exactly one opening and one closing script element.
		self.assertEqual(tag.count("<script "), 1)
		self.assertEqual(tag.count("</script>"), 1)

	def test_jinja2_html_protocol(self):
		tag = script_tag("pk_abc123")
		self.assertIsInstance(tag, ScriptTag)
		self.assertEqual(tag.__html__(), str(tag))

	def test_empty_project_key_raises(self):
		for bad in ("", "   "):
			with self.assertRaises(ValueError):
				script_tag(bad)

	def test_unknown_mode_and_theme_raise(self):
		with self.assertRaises(ValueError):
			script_tag("pk_x", mode="popup")
		with self.assertRaises(ValueError):
			script_tag("pk_x", theme="midnight")
		# The documented sets stay accepted.
		for mode in MODES:
			script_tag("pk_x", mode=mode)
		for theme in THEMES:
			script_tag("pk_x", theme=theme)

	def test_bad_escalation_threshold_raises(self):
		for bad in (0, -1, 2.5, "3", True):
			with self.assertRaises(ValueError):
				script_tag("pk_x", escalation_threshold=bad)

	def test_default_api_url_constant(self):
		self.assertEqual(DEFAULT_API_URL, "https://api.clankersupport.com")


if __name__ == "__main__":
	unittest.main()
