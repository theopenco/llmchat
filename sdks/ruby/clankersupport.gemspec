# frozen_string_literal: true

require_relative "lib/clankersupport/version"

Gem::Specification.new do |spec|
	spec.name = "clankersupport"
	spec.version = ClankerSupport::VERSION
	spec.authors = ["The Open Company"]
	spec.email = ["hello@clankersupport.com"]

	spec.summary = "Embed the Clanker Support AI-powered support agent in any Ruby web app."
	spec.description =
		"Renders the Clanker Support widget <script> tag — escaped, validated, and " \
		"framework-friendly — so visitors get streaming answers from your knowledge " \
		"base, human escalation, and operator replies, with zero backend work in " \
		"your app. Includes a Rails view helper (clanker_support_tag). Clanker " \
		"Support is open source and self-hostable."

	spec.homepage = "https://clankersupport.com"
	spec.license = "MIT"
	spec.required_ruby_version = ">= 3.0"

	spec.metadata = {
		# The gem lives in the sdks/ruby directory of the monorepo.
		"source_code_uri" => "https://github.com/theopenco/llmchat",
		"documentation_uri" => "https://docs.clankersupport.com",
	}

	spec.files = Dir["lib/**/*.rb"] + ["README.md", "LICENSE"]
	spec.require_paths = ["lib"]
end
