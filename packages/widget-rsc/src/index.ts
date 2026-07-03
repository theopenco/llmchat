/**
 * @clankersupport/widget-rsc — the Clanker Support widget for React Server
 * Components apps.
 *
 * Quick start (Next.js App Router, `app/layout.tsx`):
 *
 *   import { ClankerSupport } from "@clankersupport/widget-rsc";
 *
 *   export default function RootLayout({ children }) {
 *     return (
 *       <html lang="en">
 *         <body>
 *           {children}
 *           <ClankerSupport apiKey={process.env.NEXT_PUBLIC_CLANKER_KEY!} />
 *         </body>
 *       </html>
 *     );
 *   }
 *
 * Want your own UI? Import the headless primitives and hooks from
 * `@clankersupport/widget-rsc/headless`.
 */
export { ClankerSupport } from "./clanker-support";
export type { ClankerSupportProps } from "./clanker-support";
export type {
	ChatMessage,
	ChatStatus,
	MessageRating,
	MessageRole,
	VisitorIdentity,
	WidgetConfig,
	WidgetPosition,
} from "./types";
