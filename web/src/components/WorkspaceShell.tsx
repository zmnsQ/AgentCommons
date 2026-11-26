import { useEffect, useState, type ReactNode } from "react";
import { useLocale } from "../i18n/locale";
import { StudioIcon } from "./StudioIcon";
import { ResponsiveSidebar } from "./ResponsiveSidebar";
import { useCompactViewport } from "../lib/useCompactViewport";

const key = "commons.navigation.collapsed";
function storedCollapsed() {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

/** Navigation state is a device preference, never an account or permission decision. */
export function WorkspaceShell({
  navigation,
  children,
  route,
  navigationError,
  requestOpen = 0,
  title,
  mobileActions,
  navigationFooter,
  onBrandClick,
}: {
  navigation: ReactNode;
  children: ReactNode;
  route: string | null;
  navigationError?: string | null;
  requestOpen?: number;
  title?: string | null;
  mobileActions?: ReactNode;
  navigationFooter?: ReactNode;
  onBrandClick?: () => void;
}) {
  const { locale } = useLocale();
  const zh = locale === "zh";
  const [collapsed, setCollapsed] = useState(storedCollapsed);
  const compact = useCompactViewport();

  useEffect(() => {
    if (requestOpen > 0) setCollapsed(false);
  }, [requestOpen]);

  const label = zh ? "工作区导航" : "Workspace navigation";
  const toggleTitle = zh
    ? collapsed
      ? "展开侧栏"
      : "收起侧栏"
    : collapsed
      ? "Expand sidebar"
      : "Collapse sidebar";

  return (
    <div className="workspace-frame">
      {navigationError && (
        <p className="banner banner--red workspace-navigation-error" role="alert">
          {navigationError}
        </p>
      )}
      <div className={`app-shell workspace-shell${collapsed ? " navigation-collapsed" : ""}`}>
        {compact ? (
          <ResponsiveSidebar
            activeSlug={route}
            title={title}
            requestOpen={requestOpen}
            mobileActions={mobileActions}
          >
            {navigation}
          </ResponsiveSidebar>
        ) : (
          <aside className="app-side workspace-navigation" aria-label={label}>
            <div className="workspace-nav-bar">
              <a
                className="workspace-nav-brand app-logo"
                href={"/" + (typeof location !== "undefined" ? location.search : "")}
                onClick={(event) => {
                  if (!onBrandClick) return;
                  event.preventDefault();
                  onBrandClick();
                }}
              >
                <img src="/brand/mark.png" width="24" height="24" alt="" />
                <span>Agent Commons</span>
              </a>
              <button
                type="button"
                className="workspace-nav-toggle workspace-nav-desktop workspace-nav-compact-toggle"
                aria-expanded={!collapsed}
                aria-controls="workspace-navigation-content"
                title={toggleTitle}
                aria-label={toggleTitle}
                onClick={() => {
                  const next = !collapsed;
                  setCollapsed(next);
                  try {
                    localStorage.setItem(key, next ? "1" : "0");
                  } catch {
                    /* In-memory state still works. */
                  }
                }}
              >
                <StudioIcon name={collapsed ? "chevron-right" : "arrow-left"} />
              </button>
            </div>
            <div className="workspace-nav-body" id="workspace-navigation-content" hidden={collapsed}>
              <div className="workspace-nav-inner">{navigation}</div>
            </div>
            {navigationFooter && (
              <div className="workspace-navigation-footer">{navigationFooter}</div>
            )}
          </aside>
        )}
        {children}
      </div>
    </div>
  );
}
