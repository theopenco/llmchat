import { describe, expect, it } from "vitest";

import { findUndefinedHelpers } from "../../scripts/check-bundle.mjs";

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
