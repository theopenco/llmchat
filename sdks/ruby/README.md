# clankersupport

Embed the [Clanker Support](https://clankersupport.com) AI-powered support agent in any Ruby web app. One helper renders the widget `<script>` tag — escaped, validated, and framework-friendly — so visitors get streaming answers from your knowledge base, human escalation, and operator replies, with zero backend work in your app.

```sh
bundle add clankersupport
```

## Quick start

Grab your project's public key from the dashboard (Project → Embed), then render the tag into your layout:

```ruby
require "clankersupport"

tag = ClankerSupport.script_tag("pk_your_project_key")
# <script src="https://api.clankersupport.com/widget.js" data-project="pk_your_project_key" data-api="https://api.clankersupport.com" async></script>
```

The return value is a plain `String`. Plain ERB (outside Rails) doesn't autoescape, so `<%= tag %>` just works — no `raw` or `.html_safe` needed. Rails ERB *does* autoescape; use the built-in helper below, which handles that for you.

> The public key is safe to expose — it's the same key the plain `<script>` embed uses.

### Rails

The gem ships a Railtie that registers a view helper in ActionView. Set `CLANKER_PROJECT_KEY` in your environment and drop the helper into your layout:

```erb
<%# app/views/layouts/application.html.erb %>
<body>
	<%= yield %>
	<%= clanker_support_tag %>
</body>
```

Or pass the key and options explicitly:

```erb
<%= clanker_support_tag "pk_your_project_key", theme: "auto", brand_color: "#4f46e5" %>
```

`clanker_support_tag` returns an `html_safe` string, so Rails renders it as markup.

### Sinatra

```ruby
require "sinatra"
require "clankersupport"

get "/" do
	erb :index, locals: { clanker_support: ClankerSupport.script_tag("pk_your_project_key") }
end
```

```erb
<%# views/index.erb %>
<body>
	<h1>Hello</h1>
	<%= clanker_support %>
</body>
```

(If you enable Sinatra's `:escape_html`, output it with `<%== clanker_support %>` instead.)

## Options

| Option                 | Default                        | Description                                                        |
| ---------------------- | ------------------------------ | ------------------------------------------------------------------ |
| `project_key`          | required                       | The project's public widget key (dashboard → Project → Embed).     |
| `api_url:`             | `https://api.clankersupport.com` | API origin — point at your own deployment when self-hosting.     |
| `brand_color:`         | widget default                 | Launcher/header accent color, e.g. `"#4f46e5"`.                    |
| `mode:`                | `"bubble"`                     | `"bubble"` (floating launcher) or `"inline"` (mounts in place).    |
| `theme:`               | `"light"`                      | `"light"`, `"dark"`, or `"auto"` (follow the OS).                  |
| `escalation_threshold:`| project default                | Visitor messages before "Talk to a human" appears (positive Integer). |

Invalid values (empty key, unknown mode/theme, non-positive or non-Integer threshold) raise `ArgumentError` at render time, so misconfiguration fails in development instead of silently shipping a broken widget.

## Self-hosting

Clanker Support is open source ([theopenco/llmchat](https://github.com/theopenco/llmchat)). Point `api_url:` at your own deployment; the tag's `src` and `data-api` both follow it.

## Publishing (maintainers)

```sh
gem build clankersupport.gemspec
gem push clankersupport-1.0.0.gem
```

## License

MIT
