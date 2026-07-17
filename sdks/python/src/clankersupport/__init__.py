"""Render the Clanker Support widget embed for Python web apps.

The widget itself is client-side JavaScript served by the Clanker Support API
(`/widget.js`); a backend's job is only to emit the script tag with the right
``data-*`` attributes. :func:`script_tag` does that with HTML-attribute
escaping, mirroring the snippet the dashboard's Embed page generates.

Usage::

    from clankersupport import script_tag

    tag = script_tag("pk_your_project_key")

The return value is a ``str`` subclass implementing the ``__html__`` protocol,
so Jinja2 / MarkupSafe-aware templates render it unescaped without needing
``| safe``.
"""

from __future__ import annotations

import html

__version__ = "1.0.0"

__all__ = ["DEFAULT_API_URL", "MODES", "THEMES", "ScriptTag", "script_tag"]

DEFAULT_API_URL = "https://api.clankersupport.com"

#: ``data-mode`` values the widget understands. ``bubble`` (the default) is the
#: floating launcher; ``inline`` mounts the panel in place.
MODES = ("bubble", "inline")

#: ``data-theme`` values the widget understands. Absent means ``light``.
THEMES = ("light", "dark", "auto")


class ScriptTag(str):
	"""A ``str`` that marks itself as pre-escaped HTML via ``__html__``.

	Jinja2 (and anything MarkupSafe-aware) calls ``__html__`` during
	autoescaping, so the tag renders as markup rather than escaped text —
	no ``| safe`` filter needed. Frameworks that don't know the protocol
	just see a plain string.
	"""

	def __html__(self) -> str:
		return str(self)


def _attr(value: str) -> str:
	"""HTML-attribute escaping, mirroring the dashboard snippet generator."""
	return html.escape(value, quote=True)


def script_tag(
	project_key: str,
	*,
	api_url: str = DEFAULT_API_URL,
	brand_color: str | None = None,
	mode: str | None = None,
	theme: str | None = None,
	escalation_threshold: int | None = None,
) -> ScriptTag:
	"""Build the Clanker Support widget ``<script>`` tag.

	:param project_key: The project's public widget key (dashboard → Project →
		Embed). Safe to expose — it's the same key the script embed uses.
	:param api_url: API origin. Point at your own deployment when self-hosting;
		trailing slashes are stripped.
	:param brand_color: Accent color for the launcher/header, e.g. ``"#4f46e5"``.
		Omitted → the widget default.
	:param mode: ``"bubble"`` (floating launcher, default) or ``"inline"``.
	:param theme: ``"light"`` (default), ``"dark"``, or ``"auto"`` (follow OS).
	:param escalation_threshold: Visitor messages before "Talk to a human"
		appears. Omitted → the project's configured default.
	:raises ValueError: On an empty project key, an unknown mode/theme, or a
		non-positive escalation threshold — misconfiguration should fail at
		render time in development, not silently ship a broken widget.
	"""
	if not project_key or not project_key.strip():
		raise ValueError("project_key is required")
	if mode is not None and mode not in MODES:
		raise ValueError(f"mode must be one of {MODES}, got {mode!r}")
	if theme is not None and theme not in THEMES:
		raise ValueError(f"theme must be one of {THEMES}, got {theme!r}")
	if escalation_threshold is not None:
		if (
			isinstance(escalation_threshold, bool)
			or not isinstance(escalation_threshold, int)
			or escalation_threshold < 1
		):
			raise ValueError(
				f"escalation_threshold must be a positive int, got {escalation_threshold!r}"
			)

	base = api_url.rstrip("/")
	parts = [
		f'<script src="{_attr(base)}/widget.js"',
		f'data-project="{_attr(project_key)}"',
		f'data-api="{_attr(base)}"',
	]
	if brand_color is not None:
		parts.append(f'data-brand="{_attr(brand_color)}"')
	if mode is not None:
		parts.append(f'data-mode="{_attr(mode)}"')
	if theme is not None:
		parts.append(f'data-theme="{_attr(theme)}"')
	if escalation_threshold is not None:
		parts.append(f'data-escalation-threshold="{escalation_threshold}"')
	parts.append("async></script>")
	return ScriptTag(" ".join(parts))
