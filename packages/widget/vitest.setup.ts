import "@testing-library/jest-dom/vitest";

import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

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
