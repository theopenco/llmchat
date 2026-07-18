# frozen_string_literal: true

# Rails integration. This file is only required from lib/clankersupport.rb
# when Rails::Railtie is defined, and every constant reference below is
# guarded, so the gem loads fine without Rails.

module ClankerSupport
	# View helper mixed into ActionView by the Railtie.
	#
	#   <%= clanker_support_tag %>                        <%# uses ENV["CLANKER_PROJECT_KEY"] %>
	#   <%= clanker_support_tag "pk_abc123", theme: "auto" %>
	module Helper
		# Render the widget script tag, marked +html_safe+ so Rails' ERB
		# autoescaping emits it as markup. The project key defaults to
		# +ENV["CLANKER_PROJECT_KEY"]+.
		def clanker_support_tag(project_key = nil, **options)
			key = project_key || ENV["CLANKER_PROJECT_KEY"]
			ClankerSupport.script_tag(key, **options).html_safe
		end
	end

	if defined?(Rails::Railtie)
		class Railtie < Rails::Railtie
			initializer "clankersupport.view_helper" do
				ActiveSupport.on_load(:action_view) do
					include ClankerSupport::Helper
				end
			end
		end
	end
end
