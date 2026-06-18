// Chat primitives surfaced for in-tree consumers (e.g. the dashboard's
// conversational onboarding) so a guided flow can render the exact same chat
// UI the embedded widget uses — one source of truth for the look & feel.
export { Composer } from "./components/Composer";
export { MessageList, type DisplayMessage } from "./components/MessageList";
export { WidgetFrame } from "./components/WidgetFrame";
