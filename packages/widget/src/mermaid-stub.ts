// Stub for the `mermaid` package, aliased in via vite.config.ts.
//
// Streamdown lazy-loads mermaid only to render ```mermaid diagram blocks, which
// support replies never contain. mermaid is a multi-hundred-KB dependency and
// the widget must ship as a single inlined IIFE (`inlineDynamicImports`), so the
// lazy chunk would otherwise be pulled straight into widget.js. Swapping it for
// this no-op keeps the embed bundle lean; if a diagram block ever shows up it
// simply renders nothing instead of dragging mermaid in.
const mermaid = {
	initialize() {},
	async render() {
		return { svg: "" };
	},
	async parse() {
		return false;
	},
	async run() {},
};

export default mermaid;
