import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

// Node 25 ships a file-backed global `localStorage` that SHADOWS jsdom's DOM
// Storage and lacks `clear()` — which would throw in every test's afterEach and
// take the whole suite down. When we detect that broken shape, swap in a tiny
// in-memory Storage so web storage works (and clears between tests) on any
// runtime. On Node 22 (CI) jsdom's storage is intact, so this is a no-op.
function installMemoryStorage(name: "localStorage" | "sessionStorage") {
	const store = new Map<string, string>();
	const storage: Storage = {
		get length() {
			return store.size;
		},
		clear: () => store.clear(),
		getItem: (k) => (store.has(k) ? (store.get(k) as string) : null),
		key: (i) => Array.from(store.keys())[i] ?? null,
		removeItem: (k) => store.delete(k),
		setItem: (k, v) => store.set(String(k), String(v)),
	};
	Object.defineProperty(globalThis, name, {
		value: storage,
		configurable: true,
		writable: true,
	});
}

if (typeof globalThis.localStorage?.clear !== "function") {
	installMemoryStorage("localStorage");
}
if (typeof globalThis.sessionStorage?.clear !== "function") {
	installMemoryStorage("sessionStorage");
}

afterEach(() => {
	cleanup();
	// Reset web storage between tests so identity/clientId persistence (localStorage +
	// sessionStorage) can't leak across cases — e.g. a test that submits the
	// IdentifyForm now writes identity, which would otherwise skip a later mount's form.
	localStorage.clear();
	sessionStorage.clear();
});

// jsdom doesn't implement scrollIntoView (used by MessageList autoscroll).
Element.prototype.scrollIntoView = () => {};
