import { PlatformIcon } from "./PlatformIcon";
// 左侧频道列表：频道名 + 最近一条消息 + 参与者状态点（spec §9 第 1 块）
import { useEffect, useRef, useState } from "react";
import type { ChannelInfo } from "../lib/api";
import { StudioIcon } from "./StudioIcon";
import { useLocale } from "../i18n/locale";
import { useT } from "../i18n/useT";
import "../i18n/strings/Home"; // 复用 "已归档 (N)" key，两处折叠开关文案一致
import "../i18n/strings/App";

interface Props {
  /** 服务器视图身份；切换实例时分类和归档展开状态必须从默认值重新开始。 */
  scopeKey: string;
  channels: ChannelInfo[] | null;
  active: string | null;
  error: string | null;
  onOpen(slug: string): void;
  onRetry?: () => void;
  onCreate?: () => void;
  onConnect?: () => void;
  onAgentSelect?: (name: string) => void;
  /** Authoritative agent roster only; presence alone does not identify an agent. */
  agents?: readonly { name: string; display?: string; role?: string; connector_type?: string }[];
}

// 分类筛选：全部 / 我创建的（owned）/ 我加入的（member）。只筛 live 段，archived 段独立不受影响。
type ChannelCategory = "all" | "created" | "joined";

const CATEGORY_LABEL_KEY: Record<ChannelCategory, string> = {
  all: "Home.channelCategoryAll",
  created: "Home.channelCategoryCreated",
  joined: "Home.channelCategoryJoined",
};

const CATEGORY_EMPTY_KEY: Record<Exclude<ChannelCategory, "all">, string> = {
  created: "Home.channelCategoryEmptyCreated",
  joined: "Home.channelCategoryEmptyJoined",
};

const MAX_DOTS = 4;

function presenceDotPriority(state: ChannelInfo["presence"][number]["state"]): number {
  if (state === "working") return 0;
  if (state === "offline") return 2;
  return 1;
}

// 参与者状态点：每人一个状态点，色 = presence 状态；没人报过 presence 给一颗灰点占位
const PRESENCE_STATE_ZH: Record<string, string> = {
  working: "处理中",
  waiting: "等待中",
  idle: "空闲",
  blocked: "受阻",
  offline: "离线",
  online: "在线",
};

export function PresenceDots({ channel }: { channel: ChannelInfo }) {
  const t = useT();
  const { locale } = useLocale();
  const zh = locale === "zh";
  const entries = [...(channel.presence ?? [])]
    .sort((a, b) => presenceDotPriority(a.state) - presenceDotPriority(b.state))
    .slice(0, MAX_DOTS);
  return (
    <span className="chan-dots">
      {entries.length === 0 && <span className="d-dot d-dot--offline" title={t("Home.noParticipants")} />}
      {entries.map((p) => (
        <span
          key={p.name}
          className={`d-dot d-dot--${p.state}`}
          title={`${p.name} — ${zh ? (PRESENCE_STATE_ZH[p.state] ?? p.state) : p.state}`}
        />
      ))}
    </span>
  );
}

export function lastMessagePreview(c: ChannelInfo): string | null {
  if (c.last_message == null) return null;
  const body = c.last_message.body.replace(/\s+/g, " ").trim();
  return `${c.last_message.sender}: ${body === "" ? `[${c.last_message.kind}]` : body}`;
}

function ChannelPill({
  c,
  active,
  onOpen,
  zh,
}: {
  c: ChannelInfo;
  active: string | null;
  onOpen(slug: string): void;
  zh: boolean;
}) {
  const preview = lastMessagePreview(c);
  return (
    <button
      type="button"
      className={
        "d-pill chan-pill" +
        (c.slug === active ? " is-active" : "") +
        (c.archived_at !== null ? " chan-pill--archived" : "")
      }
      onClick={() => onOpen(c.slug)}
      aria-current={c.slug === active ? "page" : undefined}
      title={c.topic ?? c.slug}
    >
      <span className="prototype-channel-symbol" aria-hidden="true">
        <StudioIcon name="group" size={14} />
      </span>
      <span className="prototype-channel-copy">
        <span className="chan-head">
          <PresenceDots channel={c} />
          <span className="chan-name">{c.title ?? c.slug}</span>
          {c.visibility === "public" && <span className="d-hl public-badge">{zh ? "公开" : "PUBLIC"}</span>}
          {c.mode === "party" && <span className="d-hl party-badge">{zh ? "协作" : "PARTY"}</span>}
          {c.kind === "temp" && <span className="chan-tag t-mono">{zh ? "临时" : "temp"}</span>}
          {c.archived_at !== null && <span className="chan-tag t-mono">{zh ? "已归档" : "archived"}</span>}
        </span>
        {preview !== null && <span className="chan-last">{preview}</span>}
      </span>
    </button>
  );
}

type ScopedProps = Omit<Props, "scopeKey">;

function ScopedChannelList({
  channels,
  active,
  error,
  onOpen,
  onRetry,
  agents,
  onCreate,
  onConnect,
  onAgentSelect,
}: ScopedProps) {
  const { locale } = useLocale();
  const zh = locale === "zh";
  const [query, setQuery] = useState("");
  const searchLabel = zh ? "搜索群组…" : "Search groups…";
  const matches = (c: ChannelInfo) =>
    [c.title, c.slug, c.topic].some((value) =>
      value?.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
    );
  const uniqueAgents = [...new Map((agents ?? []).map((agent) => [agent.name, agent])).values()];
  const [showArchived, setShowArchived] = useState(false);
  const [category, setCategory] = useState<ChannelCategory>("all");
  const previousActiveRef = useRef<string | null | undefined>(undefined);
  const t = useT();

  const live = channels?.filter((c) => c.archived_at === null) ?? null;
  const archived = channels?.filter((c) => c.archived_at !== null) ?? [];
  const createdCount = live?.filter((c) => c.owned === true).length ?? 0;
  const joinedCount = live?.filter((c) => c.member === true && c.owned !== true).length ?? 0;
  const categoryCount: Record<ChannelCategory, number> = {
    all: live?.length ?? 0,
    created: createdCount,
    joined: joinedCount,
  };

  useEffect(() => {
    if (channels === null || previousActiveRef.current === active) return;
    previousActiveRef.current = active;
    setQuery("");
    if (active === null) return;
    const activeChannel = channels.find((channel) => channel.slug === active);
    if (activeChannel === undefined) return;
    if (activeChannel.archived_at !== null) {
      setShowArchived(true);
      return;
    }
    const excluded =
      (category === "created" && activeChannel.owned !== true) ||
      (category === "joined" && !(activeChannel.member === true && activeChannel.owned !== true));
    if (excluded) setCategory("all");
  }, [active, category, channels]);

  const filteredLive =
    live === null
      ? null
      : live.filter((c) => {
          if (!matches(c)) return false;
          if (category === "created") return c.owned === true;
          if (category === "joined") return c.member === true && c.owned !== true;
          return true;
        });

  return (
    <nav className="side prototype-sidebar" aria-label={t("Home.channelsLabel")}>
      <div className="prototype-sidebar-controls">
        <label className="prototype-sidebar-search">
          <StudioIcon name="search" size={14} />
          <input
            type="search"
            aria-label={searchLabel}
            placeholder={searchLabel}
            value={query}
            onChange={(e) => setQuery(e.currentTarget.value)}
          />
        </label>
        {channels !== null && (
          <div className="chan-cat-switch" role="group" aria-label={zh ? "群组筛选" : "Group filter"}>
            {(Object.keys(CATEGORY_LABEL_KEY) as ChannelCategory[]).map((cat) => (
              <button
                key={cat}
                type="button"
                className={"chan-cat-btn" + (cat === category ? " is-active" : "")}
                aria-pressed={cat === category}
                onClick={() => setCategory(cat)}
              >
                {t(CATEGORY_LABEL_KEY[cat], { count: categoryCount[cat] })}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="prototype-sidebar-scroll">
        <div className="side-section-title">
          <span>{zh ? "群组对话" : "Groups"}</span>
          <button
            type="button"
            className="sidebar-icon-button"
            aria-label={zh ? "创建群组" : "Create group"}
            title={zh ? "创建群组" : "Create group"}
            disabled={!onCreate}
            onClick={onCreate}
          >
            <StudioIcon name="plus" size={15} />
          </button>
        </div>

        {channels === null && error === null && (
          <p className="side-note">{t("Home.loading")}</p>
        )}

        {error !== null && (
          <p className="side-note side-note--err">
            <span>{error}</span>{" "}
            {onRetry && (
              <button type="button" className="d-btn channels-retry" onClick={onRetry}>
                {t("App.error.retry")}
              </button>
            )}
          </p>
        )}

        <div className="studio-channel-items group-list">
          {filteredLive?.map((c) => (
            <ChannelPill key={c.slug} c={c} active={active} onOpen={onOpen} zh={zh} />
          ))}
        </div>

        {live !== null && live.length === 0 && archived.length === 0 && (
          <p className="side-note">{t("Home.channelsEmpty")}</p>
        )}

        {query.trim() && filteredLive?.length === 0 && archived.filter(matches).length === 0 && (
          <p className="side-note">{zh ? "没有匹配的群组" : "No matching groups"}</p>
        )}

        {!query.trim() &&
          category !== "all" &&
          filteredLive !== null &&
          filteredLive.length === 0 &&
          live !== null &&
          live.length > 0 && <p className="side-note">{t(CATEGORY_EMPTY_KEY[category])}</p>}

        {archived.length > 0 && (
          <>
            <button
              type="button"
              className="side-archived-toggle"
              onClick={() => setShowArchived((v) => !v)}
              aria-expanded={showArchived || query.trim().length > 0}
            >
              <span>{showArchived || query.trim() ? "▾" : "▸"}</span>
              <span>{t("Home.archivedToggle", { count: archived.length })}</span>
            </button>
            {(showArchived || query.trim()) &&
              archived
                .filter(matches)
                .map((c) => <ChannelPill key={c.slug} c={c} active={active} onOpen={onOpen} zh={zh} />)}
          </>
        )}

        {uniqueAgents.length > 0 && (
          <section
            className="prototype-sidebar-agents"
            aria-label={zh ? "当前群组 Agent" : "Group agents"}
          >
            <h3 className="side-section-title agent-label">
              <span>{zh ? "当前群组 Agent" : "Group agents"}</span>
              <span className="side-section-count">{uniqueAgents.length}</span>
            </h3>
            <ul className="agent-list">
              {uniqueAgents.map((agent) => (
                <li key={agent.name}>
                  <button
                    type="button"
                    disabled={!onAgentSelect}
                    onClick={() => onAgentSelect?.(agent.name)}
                    title={agent.name}
                  >
                    <span className="prototype-agent-avatar" aria-hidden="true">
                      <PlatformIcon platform={agent.connector_type} size={16} decorative />
                    </span>
                    <span>{agent.display?.trim() || agent.name}</span>
                    {agent.role && <small>{agent.role}</small>}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        {onConnect && (
          <button type="button" className="discover-link" onClick={onConnect}>
            <StudioIcon name="plus" size={14} />
            <span>{zh ? "添加 Agent" : "Add Agent"}</span>
          </button>
        )}
      </div>
    </nav>
  );
}

export function ChannelList({ scopeKey, ...props }: Props) {
  return <ScopedChannelList key={scopeKey} {...props} />;
}
