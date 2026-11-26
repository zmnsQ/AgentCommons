import { PlatformIcon } from "./PlatformIcon";
import { StudioIcon } from "./StudioIcon";
import { useLocale } from "../i18n/locale";

export interface ConversationMember {
  name: string;
  display: string;
  kind?: "agent" | "human";
  connector_type?: string;
}

export interface ConversationHeaderProps {
  title: string;
  visibility?: "private" | "public" | "public_watch";
  members: readonly ConversationMember[];
  onDetails(): void;
  onAddAgent?: () => void;
  onOpenTasks?: () => void;
  taskOpenCount?: number;
  taskAttentionCount?: number;
  onOpenTeam?: () => void;
  onOpenCollaboration?: () => void;
  onOpenSearch?: () => void;
  searchActive?: boolean;
  attentionCount?: number;
  onAttention?: () => void;
  connectionStatus?: string;
}

export function ConversationHeader({
  title,
  visibility,
  members,
  onDetails,
  onAddAgent,
  onOpenTasks,
  taskOpenCount = 0,
  taskAttentionCount = 0,
  onOpenTeam,
  onOpenCollaboration,
  onOpenSearch,
  searchActive = false,
  attentionCount = 0,
  onAttention,
  connectionStatus = "open",
}: ConversationHeaderProps) {
  const { locale } = useLocale();
  const zh = locale === "zh";

  const hasQuickActions =
    onOpenTasks !== undefined ||
    onOpenCollaboration !== undefined ||
    onOpenSearch !== undefined;

  const visLabel =
    visibility === "public"
      ? zh
        ? "公开"
        : "Public"
      : visibility === "public_watch"
        ? zh
          ? "只读公开"
          : "Watch"
        : null;

  return (
    <header className="chat-header conversation-header">
      <div className="header-title">
        <span id="mobile-navigation-trigger-slot" />
        <button
          className="conversation-title"
          type="button"
          onClick={onDetails}
          aria-haspopup="dialog"
          title={zh ? "查看群详情与设置" : "Group details & settings"}
        >
          <h1>{title}</h1>
          <StudioIcon name="chevron-down" />
        </button>

        {visLabel !== null && <span className="conversation-vis-pill">{visLabel}</span>}

        {members.length > 0 && <span className="header-divider" aria-hidden="true" />}

        <button
          type="button"
          className="avatar-stack"
          onClick={onOpenTeam ?? onDetails}
          aria-label={zh ? `查看群成员（${members.length}）` : `View group members (${members.length})`}
          aria-haspopup="dialog"
        >
          {members.slice(0, 4).map((m, i) => (
            <span
              key={m.name}
              className={`agent-avatar conversation-avatar conversation-avatar--${m.kind ?? "unknown"} prototype-avatar-${i % 4}`}
              title={m.display}
            >
              {m.kind === "agent" ? (
                <PlatformIcon platform={m.connector_type} size={14} decorative />
              ) : (
                Array.from(m.display || m.name)[0]
              )}
            </span>
          ))}
          {members.length > 0 && (
            <span className="avatar-stack-count">{members.length}</span>
          )}
        </button>

        {connectionStatus !== "open" && (
          <span className="conversation-connection" role="status" title={connectionStatus}>
            {connectionStatus === "connecting"
              ? zh
                ? "连接中"
                : "Connecting"
              : connectionStatus === "reconnecting"
                ? zh
                  ? "重连中"
                  : "Reconnecting"
                : zh
                  ? "连接已断开"
                  : "Disconnected"}
          </span>
        )}
      </div>

      <div className="conversation-header-actions">
        {attentionCount > 0 && (
          <button
            type="button"
            className="conversation-attention"
            onClick={onAttention ?? onDetails}
            aria-label={zh ? `${attentionCount} 条提及通知` : `${attentionCount} mention notifications`}
          >
            @{attentionCount}
          </button>
        )}

        {onOpenTasks && (
          <button
            type="button"
            className="header-action-btn"
            onClick={onOpenTasks}
            aria-label={zh ? "任务台账" : "Tasks"}
            title={zh ? "任务台账" : "Tasks"}
          >
            <StudioIcon name="tasks" />
            <span className="header-action-label">{zh ? "任务" : "Tasks"}</span>
            {(taskOpenCount > 0 || taskAttentionCount > 0) && (
              <span
                className={
                  "header-action-badge" + (taskAttentionCount > 0 ? " header-action-badge--hot" : "")
                }
              >
                {taskAttentionCount > 0 ? taskAttentionCount : taskOpenCount}
              </span>
            )}
          </button>
        )}

        {onOpenCollaboration && (
          <button
            type="button"
            className="header-action-btn header-action-btn--desktop-only"
            onClick={onOpenCollaboration}
            aria-label={zh ? "文件与代码" : "Files & Code"}
            title={zh ? "协作空间：文件、仓库与云端 Agent" : "Workspace: files, repositories & cloud agents"}
          >
            <StudioIcon name="folder" />
            <span className="header-action-label">{zh ? "文件与代码" : "Workspace"}</span>
          </button>
        )}

        {onOpenSearch && (
          <button
            type="button"
            className={"header-action-btn header-action-btn--icon" + (searchActive ? " is-active" : "")}
            onClick={onOpenSearch}
            aria-label={zh ? "搜索与筛选消息" : "Search & filter messages"}
            title={zh ? "搜索与筛选消息" : "Search & filter messages"}
          >
            <StudioIcon name="search" />
          </button>
        )}

        {hasQuickActions && (
          <button
            type="button"
            className="header-action-btn header-action-btn--icon"
            onClick={onDetails}
            aria-label={zh ? "群详情与工具" : "Group details & tools"}
            title={zh ? "群详情与管理" : "Group details & admin"}
          >
            <StudioIcon name="tools" />
          </button>
        )}

        {onAddAgent && (
          <button type="button" className="invite-button" onClick={onAddAgent}>
            <StudioIcon name="plus" />
            <span>{zh ? "邀请 Agent" : "Invite Agent"}</span>
          </button>
        )}
      </div>
    </header>
  );
}
