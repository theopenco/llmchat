import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

import {
	findUndefinedHelpers,
	findUndefinedInlineHelpers,
} from "../../scripts/check-bundle.mjs";

describe("root layout __name shim", () => {
	// Ploy's esbuild pass injects `__name(...)` into next-themes' inlined theme
	// script *after* `pnpm build`, so the gate can't observe it locally. The shim
	// in the root layout defines `__name` before that script runs; this pins it so
	// it can't be silently removed and re-break prod sign-in.
	it("defines a global __name before the theme script can run", () => {
		// vitest runs with cwd = apps/dashboard.
		const layout = readFileSync(
			resolve(process.cwd(), "src/app/layout.tsx"),
			"utf8",
		);
		expect(layout).toContain("self.__name");
	});
});

describe("findUndefinedHelpers", () => {
	it("flags a helper that is called but defined nowhere (the prod break)", () => {
		const files = [
			{ name: "sign-in.js", code: "foo();__name(Bar,'Bar');baz();" },
		];
		const broken = findUndefinedHelpers(files);
		expect(broken).toEqual([{ helper: "__name", calledIn: ["sign-in.js"] }]);
	});

	it("passes when the helper is defined in any chunk, even a different one", () => {
		const files = [
			{ name: "runtime.js", code: "var __name=(t,n)=>t;" },
			{ name: "sign-in.js", code: "__name(Bar,'Bar');" },
		];
		expect(findUndefinedHelpers(files)).toEqual([]);
	});

	it("recognizes a `function` definition form", () => {
		const files = [
			{ name: "a.js", code: "function __publicField(o,k,v){return v}" },
			{ name: "b.js", code: "__publicField(this,'x',1);" },
		];
		expect(findUndefinedHelpers(files)).toEqual([]);
	});

	it("ignores webpack's own runtime identifiers", () => {
		const files = [
			{
				name: "a.js",
				code: "__webpack_require__(123);__webpack_exports__={};",
			},
		];
		expect(findUndefinedHelpers(files)).toEqual([]);
	});

	it("returns clean for helper-free chunks", () => {
		expect(
			findUndefinedHelpers([{ name: "a.js", code: "console.log('hi')" }]),
		).toEqual([]);
	});

	it("flags multiple distinct undefined helpers", () => {
		const files = [
			{ name: "a.js", code: "__spreadValues({},x);__objRest(y,[]);" },
		];
		const helpers = findUndefinedHelpers(files).map((b) => b.helper);
		expect(helpers).toContain("__spreadValues");
		expect(helpers).toContain("__objRest");
	});
});

describe("findUndefinedInlineHelpers (prerendered HTML)", () => {
	it("flags an inline script that calls a helper it never defines (the regression)", () => {
		const html = [
			{
				name: "sign-in.html",
				code: '<html><body><script>function c2(t){};__name(c2,"c2");c2("dark")</script></body></html>',
			},
		];
		expect(findUndefinedInlineHelpers(html)).toEqual([
			{ helper: "__name", file: "sign-in.html" },
		]);
	});

	it("passes when an earlier inline script defines the helper (the layout shim)", () => {
		const html = [
			{
				name: "sign-in.html",
				code:
					"<body><script>self.__name||(self.__name=function(t,n){return t});</script>" +
					'<script>function c2(t){};__name(c2,"c2");</script></body>',
			},
		];
		expect(findUndefinedInlineHelpers(html)).toEqual([]);
	});

	it("ignores external <script src> chunks (covered by the chunk scan)", () => {
		const html = [
			{
				name: "p.html",
				code: '<script src="/_next/static/chunks/x.js"></script>',
			},
		];
		expect(findUndefinedInlineHelpers(html)).toEqual([]);
	});

	it("returns clean for helper-free inline scripts", () => {
		const html = [
			{ name: "p.html", code: "<script>console.log('hi')</script>" },
		];
		expect(findUndefinedInlineHelpers(html)).toEqual([]);
	});
});
