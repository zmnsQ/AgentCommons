import { useEffect, useState, type ReactNode } from "react";
import { useLocale } from "../i18n/locale";
import { StudioIcon } from "./StudioIcon";
import { ResponsiveSidebar } from "./ResponsiveSidebar";
import { useCompactViewport } from "../lib/useCompactViewport";
import { ToolbarTooltip, ToolbarTooltipGroup } from "./ToolbarTooltip";

export type SidebarView = "conversations" | "agents" | "all";
const key = "commons.navigation.collapsed";
function storedCollapsed() {
  try { return localStorage.getItem(key) === "1"; } catch { return false; }
}

interface Props {
  navigation: ReactNode | ((view: SidebarView) => ReactNode);
  children: ReactNode;
  route: string | null;
  navigationError?: string | null;
  requestOpen?: number;
  title?: string | null;
  mobileActions?: ReactNode;
  navigationFooter?: ReactNode;
  topBar?: ReactNode;
}

export function WorkspaceShell({ navigation, children, route, navigationError, requestOpen = 0, title, mobileActions, navigationFooter, topBar }: Props) {
  const { locale } = useLocale();
  const zh = locale === "zh";
  const [collapsed, setCollapsed] = useState(storedCollapsed);
  const [view, setView] = useState<"conversations" | "agents">("conversations");
  const compact = useCompactViewport();
  useEffect(() => {
    if (requestOpen > 0) { setCollapsed(false); setView("conversations"); }
  }, [requestOpen]);
  const content = typeof navigation === "function" ? navigation(compact ? "all" : view) : navigation;
  const label = zh ? "工作区导航" : "Workspace navigation";
  const toggleLabel = zh ? (collapsed ? "展开侧栏" : "收起侧栏") : (collapsed ? "Expand sidebar" : "Collapse sidebar");

  function changeCollapsed(value: boolean) {
    setCollapsed(value);
    try { localStorage.setItem(key, value ? "1" : "0"); } catch { /* Keep the session layout. */ }
  }

  return <div className="workspace-frame">
    {topBar && <div className="studio-desktop-tabs" hidden={compact}>{topBar}</div>}
    {navigationError && <p className="banner banner--red workspace-navigation-error" role="alert">{navigationError}</p>}
    <div className="studio-work-area">
      {!compact && <aside className="studio-rail" aria-label={label}>
        <ToolbarTooltipGroup><div className="studio-rail-nav">
          {(["conversations", "agents"] as const).map(section => {
            const name = section === "agents" ? (zh ? "本群 Agent" : "Group agents") : (zh ? "会话列表" : "Conversations");
            return <ToolbarTooltip key={section} label={name}><button type="button" data-sidebar-view={section}
              aria-pressed={view === section && !collapsed} aria-label={name} onClick={() => { setView(section); changeCollapsed(false); }}>
              <StudioIcon name={section === "agents" ? "agent" : "message"} />
            </button></ToolbarTooltip>;
          })}
          <ToolbarTooltip label={toggleLabel}><button type="button" className="workspace-nav-toggle workspace-nav-desktop workspace-nav-compact-toggle"
            aria-expanded={!collapsed} aria-controls="workspace-navigation-content" aria-label={toggleLabel}
            onClick={() => changeCollapsed(!collapsed)}><StudioIcon name={collapsed ? "chevron-right" : "arrow-left"} /></button></ToolbarTooltip>
        </div></ToolbarTooltipGroup>
        {navigationFooter}
      </aside>}
      <div className={`app-shell workspace-shell${collapsed ? " navigation-collapsed" : ""}`}>
        {compact ? <ResponsiveSidebar activeSlug={route} title={title} requestOpen={requestOpen} mobileActions={mobileActions}>{content}</ResponsiveSidebar> :
          <aside className="app-side workspace-navigation" hidden={collapsed} aria-label={view === "agents" ? (zh ? "本群 Agent" : "Group agents") : (zh ? "会话列表" : "Conversations")}>
            <div className="workspace-nav-body" id="workspace-navigation-content" hidden={collapsed}><div className="workspace-nav-inner">{content}</div></div>
          </aside>}
        {children}
      </div>
    </div>
  </div>;
}
