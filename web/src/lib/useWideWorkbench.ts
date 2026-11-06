import {useEffect, useState} from "react";

export const WORKBENCH_MEDIA = "(min-width: 1280px) and (min-height: 650px) and (pointer: fine)";
/** Keep tools alongside the conversation only when both columns remain useful. */
export function useWideWorkbench(): boolean {
  const [wide, setWide] = useState(() => typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia(WORKBENCH_MEDIA).matches);
  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const media = window.matchMedia(WORKBENCH_MEDIA);
    const sync = () => setWide(media.matches);
    sync(); media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, []);
  return wide;
}
