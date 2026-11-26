import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { ModalPortal } from "../ModalPortal";
import { StudioIcon } from "../StudioIcon";
import { getModalFocusableElements } from "../useModalFocusTrap";
import { useT } from "../../i18n/useT";
import "../../i18n/strings/Channel";

export function ChannelPanelModal({
  title,
  subtitle,
  onClose,
  onEscape,
  children,
  hideHeader = false,
  onBack,
  backLabel,
  closeDisabled = false,
  shouldRestoreFocus,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  onEscape?: () => void;
  children: ReactNode;
  // #504：内容自带头部（如团队面板博客风头）时隐藏 modal 默认头，避免双 header。
  hideHeader?: boolean;
  onBack?: () => void;
  backLabel?: string;
  closeDisabled?: boolean;
  /** A successful message jump deliberately leaves focus on the destination. */
  shouldRestoreFocus?: () => boolean;
}) {
  const t = useT();
  const cardRef = useRef<HTMLElement | null>(null);
  const shouldRestoreFocusRef = useRef(shouldRestoreFocus);
  shouldRestoreFocusRef.current = shouldRestoreFocus;
  const requestClose = useCallback(() => {
    if (!closeDisabled) onClose();
  }, [closeDisabled, onClose]);
  const restoreFocusRef = useRef<HTMLElement | null>(
    typeof document !== "undefined"
      && typeof HTMLElement !== "undefined"
      && document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null,
  );
  const focusableElements = useCallback(() => {
    const card = cardRef.current;
    if (card === null) return [];
    return getModalFocusableElements(card);
  }, []);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (event.defaultPrevented) return;
        if (onEscape !== undefined) onEscape();
        else requestClose();
        return;
      }
      if (event.key !== "Tab") return;
      if (typeof document === "undefined") return;
      const card = cardRef.current;
      if (card === null) return;
      const focusable = focusableElements();
      if (focusable.length === 0) {
        event.preventDefault();
        card.focus();
        return;
      }
      const first = focusable[0]!;
      const last = focusable[focusable.length - 1]!;
      const active = document.activeElement;
      if (active === null || active.isConnected === false || !card.contains(active)) {
        event.preventDefault();
        first.focus();
        return;
      }
      if (active === card) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
        return;
      }
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusableElements, onEscape, requestClose]);
  useEffect(() => {
    if (typeof document === "undefined") return;
    const card = cardRef.current;
    if (card !== null && !card.contains(document.activeElement)) {
      const focusable = focusableElements();
      const first = focusable.find((element) => element.hasAttribute("autofocus"))
        ?? focusable[0];
      (first ?? card).focus();
    }
    return () => {
      if (shouldRestoreFocusRef.current?.() === false) return;
      const previous = restoreFocusRef.current;
      if (previous?.isConnected) previous.focus();
    };
  }, [focusableElements]);

  return (
    <ModalPortal><div className="channel-panel-overlay" role="dialog" aria-modal="true" aria-label={title}>
      <button
        className="channel-panel-scrim"
        type="button"
        aria-label={t("Channel.tools.close")}
        disabled={closeDisabled}
        onClick={requestClose}
      />
      <section ref={cardRef} className="channel-panel-card" tabIndex={-1}>
        {(!hideHeader || onBack) && (
          <header className="channel-panel-head">
            {onBack && <button type="button" className="d-btn" disabled={closeDisabled} onClick={onBack}>← {backLabel}</button>}
            <div className="channel-panel-titlebox">
              <h2>{title}</h2>
              {subtitle !== undefined && subtitle !== "" && <p className="t-mono">{subtitle}</p>}
            </div>
            <button className="d-btn channel-panel-close" type="button" aria-label={t("Channel.tools.close")} title={t("Channel.tools.close")} disabled={closeDisabled} onClick={requestClose}>
              <StudioIcon name="close" />
            </button>
          </header>
        )}
        <div className="channel-panel-body">{children}</div>
      </section>
    </div></ModalPortal>
  );
}
