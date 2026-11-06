import { useState } from "react";

export type ConversationWidth = "standard" | "wide" | "full";
const STORAGE_KEY = "commons.conversation.width";

export function useConversationWidth() {
  const [width, setWidth] = useState<ConversationWidth>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved === "wide" || saved === "full" ? saved : "standard";
    } catch {
      return "standard";
    }
  });
  const changeWidth = (next: ConversationWidth) => {
    setWidth(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch { /* Keep the in-session choice when storage is unavailable. */ }
  };
  return [width, changeWidth] as const;
}
