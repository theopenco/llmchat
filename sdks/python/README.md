# clankersupport

Embed the [Clanker Support](https://clankersupport.com) AI-powered support agent in any Python web app. One helper renders the widget `<script>` tag — escaped, validated, and framework-friendly — so visitors get streaming answers from your knowledge base, human escalation, and operator replies, with zero backend work in your app.

```sh
pip install clankersupport
```

## Quick start

Grab your project's public key from the dashboard (Project → Embed), then render the tag into your base template:

```python
from clankersupport import script_tag

tag = script_tag("pk_your_project_key")
# <script src="https://api.clankersupport.com/widget.js" data-project="pk_your_project_key" data-api="https://api.clankersupport.com" async></script>
```

The return value implements the `__html__` protocol, so Jinja2 renders it unescaped automatically — no `| safe` needed.

> The public key is safe to expose — it's the same key the plain `<script>` embed uses.

### FastAPI + Jinja2

```python
from clankersupport import script_tag
from fastapi.templating import Jinja2Templates

templates = Jinja2Templates(directory="templates")
templates.env.globals["clanker_support"] = lambda: script_tag("pk_your_project_key")
```

```html
<!-- templates/base.html -->
<body>
	{% block content %}{% endblock %}
	{{ clanker_support() }}
</body>
```

### Flask

```python
from clankersupport import script_tag

app.jinja_env.globals["clanker_support"] = lambda: script_tag("pk_your_project_key")
```

### Django

Django templates don't use the `__html__` protocol; mark the tag safe explicitly:

```python
from clankersupport import script_tag
from django.utils.safestring import mark_safe

def support_widget(request):
	return {"clanker_support": mark_safe(script_tag("pk_your_project_key"))}
```

## Options

```python
script_tag(
	"pk_your_project_key",
	api_url="https://support-api.your-domain.com",  # self-hosted API origin
	brand_color="#4f46e5",                          # launcher/header accent
	mode="bubble",                                  # "bubble" (default) | "inline"
	theme="auto",                                   # "light" (default) | "dark" | "auto"
	escalation_threshold=3,                         # messages before "Talk to a human"
)
```

Invalid values (empty key, unknown mode/theme, non-positive threshold) raise `ValueError` at render time, so misconfiguration fails in development instead of silently shipping a broken widget.

## Self-hosting

Clanker Support is open source ([theopenco/llmchat](https://github.com/theopenco/llmchat)). Point `api_url` at your own deployment; the tag's `src` and `data-api` both follow it.

## License

MIT
