import { useState, type CSSProperties } from "react";
import type { SearchHit } from "@agentparty/shared";
import { agentHue } from "../../lib/agentColor";
import { formatIdentityPresentation, resolveIdentityPresentation, resolveSenderLabel, type IdentityDisplayMap } from "../../lib/identityDisplay";
import { seqFromQuery, type AgentFilter, type AgentFilterMode, type AgentFilterKind } from "../../lib/filters";
import { fmtTime } from "../../lib/time";
import { useLocale } from "../../i18n/locale";
import { useT } from "../../i18n/useT";
import "../../i18n/strings/Channel";

export function AgentFilterPanel({
  senders,
  identityDisplay,
  filter,
  visible,
  total,
  onMode,
  onToggle,
  onKind,
  onClear,
}: {
  senders: string[];
  identityDisplay: IdentityDisplayMap;
  filter: AgentFilter;
  visible: number;
  total: number;
  onMode: (mode: AgentFilterMode) => void;
  onToggle: (agent: string) => void;
  onKind: (kind: AgentFilterKind) => void;
  onClear: () => void;
}) {
  const t = useT();
  const active = filter.agents.length > 0 || filter.kind !== null;
  return (
    <section className="agent-filter-panel" aria-label={t("Channel.filter.aria")}>
      <div className="agent-filter-head">
        <div className="agent-filter-modes" role="group" aria-label={t("Channel.filter.modeAria")}>
          <button
            className={"d-btn agent-filter-mode" + (filter.mode === "only" ? " is-active" : "")}
            type="button"
            aria-pressed={filter.mode === "only"}
            onClick={() => onMode("only")}
          >
            <span>{t("Channel.filter.only")}</span>
          </button>
          <button
            className={"d-btn agent-filter-mode" + (filter.mode === "except" ? " is-active" : "")}
            type="button"
            aria-pressed={filter.mode === "except"}
            onClick={() => onMode("except")}
          >
            <span>{t("Channel.filter.hide")}</span>
          </button>
        </div>
        <div className="agent-filter-kinds" role="group" aria-label={t("Channel.filter.kindAria")}>
          <button
            className={"d-btn agent-filter-kind" + (filter.kind === "human" ? " is-active" : "")}
            type="button"
            aria-pressed={filter.kind === "human"}
            onClick={() => onKind("human")}
          >
            <span>{t("Channel.filter.humans")}</span>
          </button>
          <button
            className={"d-btn agent-filter-kind" + (filter.kind === "agent" ? " is-active" : "")}
            type="button"
            aria-pressed={filter.kind === "agent"}
            onClick={() => onKind("agent")}
          >
            <span>{t("Channel.filter.agents")}</span>
          </button>
        </div>
        <span className="t-mono agent-filter-count">
          {active ? `${visible}/${total}` : `${total}`}
        </span>
        {active && (
          <button className="d-btn agent-filter-clear" type="button" onClick={onClear}>
            <span>{t("Channel.filter.clear")}</span>
          </button>
        )}
      </div>
      {senders.length > 0 && (
        <div className="agent-filter-chips">
          {senders.map((name) => {
            const selected = filter.agents.includes(name);
            const presentation = resolveIdentityPresentation(name, identityDisplay);
            const label = formatIdentityPresentation(
              presentation,
              (owner, agent) => `${owner} · ${agent}`,
            );
            return (
              <button
                key={name}
                className={"agent-filter-chip t-mono" + (selected ? " is-active" : "")}
                type="button"
                aria-pressed={selected}
                title={name}
                style={{ "--ah": agentHue(name) } as CSSProperties}
                onClick={() => onToggle(name)}
              >
                <span className="agent-filter-dot" aria-hidden="true" />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}

function SearchHitCard({
  hit,
  identityDisplay,
  onJump,
  disabled,
}: {
  hit: SearchHit;
  identityDisplay: IdentityDisplayMap;
  onJump: (seq: number) => void | Promise<void>;
  disabled: boolean;
}) {
  const t = useT();
  const zh = useLocale().locale === "zh";
  const hueStyle = { "--ah": agentHue(hit.sender.name) } as CSSProperties;
  const senderPresentation = resolveIdentityPresentation(hit.sender.name, identityDisplay, {
    kind: hit.sender.kind,
    owner: hit.sender.owner,
    display: resolveSenderLabel(hit.sender, identityDisplay),
  });
  const senderLabel = formatIdentityPresentation(
    senderPresentation,
    (owner, agent) => `${owner} · ${agent}`,
  );
  return (
    <button type="button" className="d-card msg-card search-hit-card" style={{ ...hueStyle, width: "100%", textAlign: "left" }} disabled={disabled} onClick={() => onJump(hit.seq)} title={t("Channel.search.jumpTitle")} aria-label={`${zh ? "查看上下文" : "View context"} #${hit.seq}: ${hit.snippet}`}>
      <span className="d-meta msg-head">
        <span className="msg-avatar" aria-hidden="true" />
        <span className="msg-sender">{senderLabel}</span>
        <span className={"msg-kind" + (hit.sender.kind === "human" ? " msg-kind--human" : "")}>
          {hit.sender.kind === "human" ? (zh ? "成员" : "Member") : (zh ? "智能体" : "Agent")}
        </span>
        <span className="search-hit-field">{({body: zh ? "消息正文" : "Message text", note: zh ? "状态说明" : "Status note", sender: zh ? "发送者" : "Sender"})[hit.match_field]}</span>
        <span className="msg-fill" />
        <span className="t-mono completion-jump">#{hit.seq} · {zh ? "查看上下文" : "View context"}</span>
        <time>{fmtTime(hit.ts)}</time>
      </span>
      <span className="search-hit-snippet">{hit.snippet === "" ? t("Channel.empty.content") : hit.snippet}</span>
    </button>
  );
}

export interface ChannelSearchPanelProps {
  search: string;
  query: string;
  searchFrom: string;
  searchSince: string;
  searchLimit: string;
  senderListId: string;
  knownSenders: string[];
  identityDisplay: IdentityDisplayMap;
  searchLoading: boolean;
  searchHits: SearchHit[];
  visibleSearchHits: SearchHit[];
  agentFilterActive: boolean;
  searchInputError: string | null;
  searchError: string | null;
  jumpError?: string | null;
  onSearch(value: string): void;
  onSearchFrom(value: string): void;
  onSearchSince(value: string): void;
  onSearchLimit(value: string): void;
  onClose(): void;
  onJump(seq: number): boolean | Promise<boolean>;
}

export function ChannelSearchPanel({
  search,
  query,
  searchFrom,
  searchSince,
  searchLimit,
  senderListId,
  knownSenders,
  identityDisplay,
  searchLoading,
  searchHits,
  visibleSearchHits,
  agentFilterActive,
  searchInputError,
  searchError,
  jumpError = null,
  onSearch,
  onSearchFrom,
  onSearchSince,
  onSearchLimit,
  onClose,
  onJump,
}: ChannelSearchPanelProps) {
  const t = useT();
  const zh = useLocale().locale === "zh";
  // #716：纯 seq 号查询——面板给直达按钮，且搜索 effect 会跳过全文检索（见下方 seq 短路）。
  // isSeqQuery 时屏蔽所有全文检索专属 UI（计数/结果/空态），否则会与「跳到 #N」并存出现「0 命中」误导（#718 评审）。
  const seqQuery = seqFromQuery(search);
  const isSeqQuery = seqQuery !== null;
  const [localJumpError, setLocalJumpError] = useState<string | null>(null);
  const [jumpingSeq, setJumpingSeq] = useState<number | null>(null);
  const selectHit = async (seq: number) => {
    if (jumpingSeq !== null) return;
    setJumpingSeq(seq);
    setLocalJumpError(null);
    try {
      if (await onJump(seq)) onClose();
    } catch {
      setLocalJumpError(zh ? "暂时无法打开消息，请重试。" : "Could not open the message. Please retry.");
    } finally { setJumpingSeq(null); }
  };

  return (
    <div className="chan-search-panel" aria-busy={jumpingSeq !== null}>
      <div className="chan-search-row">
        <input
          className="t-mono chan-search"
          type="search"
          value={search}
          spellCheck={false}
          onChange={(event) => onSearch(event.target.value)}
          placeholder={t("Channel.search.placeholder")}
          aria-label={t("Channel.search.aria")}
          autoFocus
        />
        {query !== "" && !isSeqQuery && (
          <span className="t-mono chan-search-count" role="status" aria-live="polite">
            {searchLoading
              ? t("Channel.search.searching")
              : agentFilterActive
                ? t("Channel.search.hitsFiltered", { visible: visibleSearchHits.length, total: searchHits.length })
                : t("Channel.search.hits", { count: searchHits.length })}
          </span>
        )}
      </div>
      {/* #716：搜索框直接输入 seq 号 → 给一个「跳到 #N」直达按钮（定位到聊天），无需先全文检索。 */}
      {seqQuery !== null && (
        <button
          type="button"
          className="d-btn chan-search-seq-jump"
          disabled={jumpingSeq !== null}
          onClick={() => selectHit(seqQuery)}
        >
          {t("Channel.search.jumpToSeq", { seq: String(seqQuery) })}
        </button>
      )}
      {query !== "" && !isSeqQuery && (
        <div className="chan-search-filters">
          <input
            className="t-mono chan-filter-input"
            value={searchFrom}
            spellCheck={false}
            list={senderListId}
            onChange={(event) => onSearchFrom(event.target.value)}
            placeholder={t("Channel.search.fromPlaceholder")}
            aria-label={t("Channel.search.fromAria")}
          />
          <datalist id={senderListId}>
            {knownSenders.map((name) => {
              const presentation = resolveIdentityPresentation(name, identityDisplay);
              const label = formatIdentityPresentation(
                presentation,
                (owner, agent) => `${owner} · ${agent}`,
              );
              return <option key={name} value={name} label={label} />;
            })}
          </datalist>
          <details open={Number(searchSince) > 0 || searchInputError !== null || undefined}>
            <summary>{zh ? "高级筛选" : "Advanced"}</summary>
          <input
            className="t-mono chan-filter-input"
            type="number"
            min={0}
            step={1}
            value={searchSince}
            onChange={(event) => onSearchSince(event.target.value)}
            placeholder={t("Channel.search.sincePlaceholder")}
            aria-label={t("Channel.search.sinceAria")}
          />
          <input
            className="t-mono chan-filter-input chan-filter-input--short"
            type="number"
            min={1}
            max={1000}
            step={1}
            value={searchLimit}
            onChange={(event) => onSearchLimit(event.target.value)}
            placeholder={t("Channel.search.limitPlaceholder")}
            aria-label={t("Channel.search.limitAria")}
          />
          </details>
        </div>
      )}
      {!isSeqQuery && searchInputError !== null && (
        <p className="banner banner--yellow" role="alert">
          {searchInputError}
        </p>
      )}
      {!isSeqQuery && searchError !== null && searchInputError === null && (
        <p className="banner banner--red" role="alert">
          {searchError}
        </p>
      )}
      {(jumpError !== null || localJumpError !== null) && (
        <p className="banner banner--yellow" role="alert">
          {jumpError ?? localJumpError}
        </p>
      )}
      {query !== "" && !isSeqQuery && visibleSearchHits.map((hit) => (
        <SearchHitCard
          key={hit.seq}
          hit={hit}
          identityDisplay={identityDisplay}
          onJump={selectHit}
          disabled={jumpingSeq !== null}
        />
      ))}
      {query !== "" && !isSeqQuery && !searchLoading && searchHits.length === 0 && searchInputError === null && searchError === null && (
        <p className="d-empty" role="status" aria-live="polite">
          {t("Channel.search.noMatch", { query: search.trim() })}
        </p>
      )}
      {query !== "" && !isSeqQuery && !searchLoading && searchHits.length > 0 && visibleSearchHits.length === 0 && (
        <p className="d-empty" role="status" aria-live="polite">
          {t("Channel.empty.searchFiltered")}
        </p>
      )}
    </div>
  );
}
