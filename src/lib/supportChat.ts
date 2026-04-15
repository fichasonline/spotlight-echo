export const SUPPORT_CHAT_OPEN_EVENT = "support-chat:open";

export function openSupportChat() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(SUPPORT_CHAT_OPEN_EVENT));
}
