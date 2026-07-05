// @shopify/app-bridge-types (s-app-nav, ui-modal, …) augments only the GLOBAL
// JSX namespace — the React 18 convention. React 19 removed global JSX (the
// jsx runtime reads React.JSX instead), so those elements vanish from JSX
// checking under @types/react@19. The alias below captures the global JSX
// namespace (which only Shopify's packages populate — React 19 itself declares
// none) and folds it into React's, preserving the exact upstream attribute
// types. Drop once app-bridge-types ships its own `declare module "react"`
// augmentation (0.7.1, latest as of 2026-07, still hasn't).
type ShopifyGlobalJsxElements = JSX.IntrinsicElements;

declare module "react" {
	namespace JSX {
		interface IntrinsicElements extends ShopifyGlobalJsxElements {}
	}
}

// An import/export makes this file a module, so the block above is a module
// AUGMENTATION. In a script file it would silently REPLACE @types/react.
// oxlint-disable-next-line unicorn/require-module-specifiers
export {};
