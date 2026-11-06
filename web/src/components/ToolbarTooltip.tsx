import {Children, cloneElement, createContext, useCallback, useContext, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type ButtonHTMLAttributes, type ReactElement, type ReactNode, type RefAttributes} from "react";
import {ModalPortal} from "./ModalPortal";
import "./ToolbarTooltip.css";

type Timer = ReturnType<typeof setTimeout>;
type Visibility = (visible: boolean) => void;

/** A group is warm only after a tooltip has actually appeared. */
function createTooltipGroup() {
  let active: {id: string; setVisible: Visibility} | null = null;
  let opening: Timer | undefined;
  let resetting: Timer | undefined;
  let warm = false;
  const clearOpening = () => {clearTimeout(opening); opening = undefined;};
  const clearResetting = () => {clearTimeout(resetting); resetting = undefined;};
  return {
    enter(id: string, setVisible: Visibility, immediate: boolean) {
      clearResetting();
      if (active?.id === id && opening === undefined) return;
      clearOpening();
      if (active?.id !== id) active?.setVisible(false);
      active = {id, setVisible};
      const show = () => {
        opening = undefined;
        if (active?.id !== id) return;
        warm = true;
        active.setVisible(true);
      };
      if (immediate || warm) show();
      else opening = setTimeout(show, 500);
    },
    leave(id: string) {
      if (active?.id !== id) return;
      clearOpening();
      active.setVisible(false);
      active = null;
      clearResetting();
      if (warm) resetting = setTimeout(() => {warm = false; resetting = undefined;}, 300);
    },
    dispose() {
      clearOpening();
      clearResetting();
      active = null;
      warm = false;
    },
  };
}

const TooltipGroupContext = createContext<ReturnType<typeof createTooltipGroup> | null>(null);

/** Adds no DOM wrapper, so an existing flex/grid toolbar keeps its layout. */
export function ToolbarTooltipGroup({children}: {children: ReactNode}) {
  const group = useMemo(createTooltipGroup, []);
  useEffect(() => () => group.dispose(), [group]);
  return <TooltipGroupContext.Provider value={group}>{children}</TooltipGroupContext.Provider>;
}

type TooltipButton = ButtonHTMLAttributes<HTMLButtonElement> & RefAttributes<HTMLButtonElement>;
interface Position {left: number; top: number; maxWidth: number; side: "top" | "bottom"}

/** One native button is cloned in place. Its handlers, ref and accessible name
 * survive; native title is replaced by a single, consistently timed tooltip. */
export function ToolbarTooltip({label, children}: {label: string; children: ReactElement<TooltipButton, "button">}) {
  const child = Children.only(children);
  const shared = useContext(TooltipGroupContext);
  const local = useMemo(() => shared ?? createTooltipGroup(), [shared]);
  const id = useId();
  const trigger = useRef<HTMLButtonElement>(null);
  const bubble = useRef<HTMLDivElement>(null);
  const hovered = useRef(false);
  const focused = useRef(false);
  const pointerFocus = useRef(false);
  const dismissed = useRef(false);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const enabled = !child.props.disabled && label.trim().length > 0;
  const updateVisibility = useCallback((next: boolean) => {
    setVisible(next);
    if (!next) setPosition(null);
  }, []);
  const hide = useCallback(() => local.leave(id), [local, id]);
  const show = (immediate = false) => {
    if (enabled && !dismissed.current) local.enter(id, updateVisibility, immediate);
  };
  const childRef = child.props.ref;
  const setTrigger = useCallback((node: HTMLButtonElement | null) => {
    trigger.current = node;
    const cleanup = typeof childRef === "function" ? childRef(node) : undefined;
    if (childRef && typeof childRef !== "function") childRef.current = node;
    if (node) return () => {
      trigger.current = null;
      if (typeof cleanup === "function") cleanup();
      else if (typeof childRef === "function") childRef(null);
      else if (childRef) childRef.current = null;
    };
  }, [childRef]);

  useEffect(() => () => {local.leave(id); if (!shared) local.dispose();}, [local, shared, id]);
  useEffect(() => {if (!enabled) hide();}, [enabled, hide]);

  useLayoutEffect(() => {
    if (!visible || typeof window === "undefined") return;
    let frame: number | undefined;
    const place = () => {
      const anchor = trigger.current;
      const tip = bubble.current;
      if (!anchor || !tip || anchor.isConnected === false) {hide(); return;}
      const viewport = window.visualViewport;
      const left = viewport?.offsetLeft ?? 0;
      const top = viewport?.offsetTop ?? 0;
      const width = viewport?.width ?? window.innerWidth;
      const height = viewport?.height ?? window.innerHeight;
      const rect = anchor.getBoundingClientRect();
      if (rect.bottom < top || rect.top > top + height || rect.right < left || rect.left > left + width) {hide(); return;}
      const maxWidth = Math.max(0, Math.min(280, width - 16));
      tip.style.maxWidth = `${maxWidth}px`;
      const size = tip.getBoundingClientRect();
      const above = rect.top - size.height - 8;
      const below = rect.bottom + 8;
      const side = above >= top + 8 || (top + height - below < size.height && rect.top - top > top + height - rect.bottom) ? "top" : "bottom";
      setPosition({
        side, maxWidth,
        left: Math.max(left + 8, Math.min(rect.left + rect.width / 2 - size.width / 2, left + width - size.width - 8)),
        top: Math.max(top + 8, Math.min(side === "top" ? above : below, top + height - size.height - 8)),
      });
    };
    const schedule = () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {frame = undefined; place();});
    };
    place();
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    window.visualViewport?.addEventListener("resize", schedule);
    window.visualViewport?.addEventListener("scroll", schedule);
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
    if (trigger.current) observer?.observe(trigger.current);
    if (bubble.current) observer?.observe(bubble.current);
    return () => {
      if (frame !== undefined) window.cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      window.visualViewport?.removeEventListener("resize", schedule);
      window.visualViewport?.removeEventListener("scroll", schedule);
    };
  }, [visible, label, hide]);

  useEffect(() => {
    if (!visible || typeof document === "undefined") return;
    const escape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      dismissed.current = true;
      hide();
      event.preventDefault();
      event.stopPropagation();
    };
    // Hover can show a tooltip while keyboard focus is elsewhere.
    document.addEventListener("keydown", escape, true);
    return () => document.removeEventListener("keydown", escape, true);
  }, [visible, hide]);

  const describedBy = [child.props["aria-describedby"], visible ? id : null].filter(Boolean).join(" ") || undefined;
  return <>{cloneElement(child, {
    ref: setTrigger,
    title: undefined,
    "aria-label": child.props["aria-label"] ?? (child.props["aria-labelledby"] ? undefined : label),
    "aria-describedby": describedBy,
    onPointerEnter(event) {
      child.props.onPointerEnter?.(event);
      if (event.defaultPrevented || event.pointerType === "touch") return;
      hovered.current = true;
      dismissed.current = false;
      show(focused.current);
    },
    onPointerLeave(event) {
      child.props.onPointerLeave?.(event);
      hovered.current = false;
      if (!focused.current) hide();
    },
    onPointerDown(event) {
      child.props.onPointerDown?.(event);
      // A pointer-induced focus must not turn a tap/click into a tooltip step.
      pointerFocus.current = true;
      focused.current = false;
      dismissed.current = true;
      hide();
    },
    onFocus(event) {
      child.props.onFocus?.(event);
      if (event.defaultPrevented || pointerFocus.current) return;
      focused.current = true;
      dismissed.current = false;
      show(true);
    },
    onBlur(event) {
      child.props.onBlur?.(event);
      focused.current = false;
      pointerFocus.current = false;
      if (!hovered.current || dismissed.current) hide();
    },
    onKeyDown(event) {
      child.props.onKeyDown?.(event);
      if (event.key === "Escape" && visible) {
        dismissed.current = true;
        hide();
        event.preventDefault();
        event.stopPropagation();
      }
    },
  })}{visible && <ModalPortal><div ref={bubble} id={id} role="tooltip" className="toolbar-tooltip" data-side={position?.side} style={{left: position?.left ?? 0, top: position?.top ?? 0, maxWidth: position?.maxWidth, visibility: position ? "visible" : "hidden"}}>{label}</div></ModalPortal>}</>;
}
