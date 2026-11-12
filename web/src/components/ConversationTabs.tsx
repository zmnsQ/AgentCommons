import { useEffect, useRef, useState } from "react";
import { useLocale } from "../i18n/locale";
import type { ChannelInfo } from "../lib/api";
import { ModalPortal } from "./ModalPortal";
import { StudioIcon } from "./StudioIcon";
import { useModalFocusTrap } from "./useModalFocusTrap";

interface Props {
  channels: ChannelInfo[] | null;
  active: string | null;
  onOpen(slug: string): void;
}

export function ConversationTabs({ channels, active, onOpen }: Props) {
  const { locale } = useLocale();
  const zh = locale === "zh";
  const [opened, setOpened] = useState<string[]>([]);
  const [searching, setSearching] = useState(false);
  const [query, setQuery] = useState("");
  const searchButton = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const dialog = useRef<HTMLDivElement>(null);
  const activeTab = useRef<HTMLButtonElement>(null);
  const strip = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!channels) return;
    const visible = new Set(channels.map(channel => channel.slug));
    setOpened(previous => {
      const next = previous.filter(slug => visible.has(slug));
      if (active && visible.has(active) && !next.includes(active)) next.push(active);
      return next.length === previous.length && next.every((slug, i) => slug === previous[i]) ? previous : next;
    });
  }, [channels, active]);

  useEffect(() => {
    const button = activeTab.current;
    const container = strip.current;
    if (!container || !button) return;
    const tab = button.getBoundingClientRect();
    const rail = container.getBoundingClientRect();
    if (tab.right > rail.right) container.scrollLeft += tab.right - rail.right + 32;
    else if (tab.left < rail.left) container.scrollLeft -= rail.left - tab.left;
  }, [active, opened]);

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      if (!(event.metaKey || event.ctrlKey) || event.altKey || event.isComposing || event.key.toLowerCase() !== "k") return;
      if (!searchButton.current?.getClientRects().length) return;
      const modalOpen = [...document.querySelectorAll('[aria-modal="true"]')].some(element => element.getClientRects().length > 0);
      if (modalOpen) return;
      event.preventDefault();
      setQuery("");
      setSearching(true);
    }
    if (typeof window === "undefined") return;
    window.addEventListener?.("keydown", shortcut);
    return () => window.removeEventListener?.("keydown", shortcut);
  }, []);

  useModalFocusTrap({ active: searching, containerRef: dialog, initialFocusRef: searchInput, onEscape: () => setSearching(false) });

  const available = channels ?? [];
  const bySlug = new Map(available.map(channel => [channel.slug, channel]));
  const tabs = opened.flatMap(slug => bySlug.has(slug) ? [bySlug.get(slug)!] : []);
  const search = query.trim().toLocaleLowerCase();
  const matches = available.filter(channel =>
    [channel.title, channel.slug, channel.topic].some(value => value?.toLocaleLowerCase().includes(search)));
  const searchLabel = zh ? "快速切换会话" : "Switch conversation";
  const openResult = (slug: string) => {
    setSearching(false);
    onOpen(slug);
  };

  function closeTab(slug: string) {
    const index = tabs.findIndex(tab => tab.slug === slug);
    if (index < 0 || tabs.length < 2) return;
    const next = tabs.filter(tab => tab.slug !== slug);
    setOpened(next.map(tab => tab.slug));
    if (active === slug) onOpen(next[Math.min(index, next.length - 1)]!.slug);
  }

  return <div className="studio-titlebar">
    <div className="studio-wordmark"><img src="/brand/mark.png" alt="" /><strong>AgentCommons</strong></div>
    <nav aria-label={zh ? "已打开的会话" : "Open conversations"} className="studio-tab-strip" ref={strip}>
      {tabs.map(tab => {
        const name = tab.title || tab.slug;
        return <div className="studio-tab" data-current={tab.slug === active} key={tab.slug}>
          <button type="button" ref={tab.slug === active ? activeTab : undefined} aria-current={tab.slug === active ? "page" : undefined}
            title={name} onClick={() => onOpen(tab.slug)}><StudioIcon name="message" size={15} /><span>{name}</span></button>
          {tabs.length > 1 && <button className="studio-tab-close" type="button" aria-label={zh ? "关闭标签 " + name : "Close tab " + name}
            onClick={() => closeTab(tab.slug)}><StudioIcon name="close" size={13} /></button>}
        </div>;
      })}
    </nav>
    <button ref={searchButton} className="studio-switch-trigger" type="button" aria-haspopup="dialog"
      onClick={() => { setQuery(""); setSearching(true); }}>
      <StudioIcon name="search" size={16} /><span>{searchLabel}</span>
    </button>
    {searching && <ModalPortal><div className="studio-switch-overlay" onMouseDown={event => {
      if (event.currentTarget === event.target) setSearching(false);
    }}>
      <div className="studio-switch-dialog" role="dialog" aria-modal="true" aria-label={searchLabel} ref={dialog}
        onKeyDown={event => {
          if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
          const options = [...event.currentTarget.querySelectorAll<HTMLButtonElement>(".studio-switch-result")];
          if (!options.length || event.nativeEvent.isComposing) return;
          event.preventDefault();
          const index = options.indexOf(document.activeElement as HTMLButtonElement);
          const next = event.key === "ArrowDown" ? (index + 1) % options.length : (index <= 0 ? options.length - 1 : index - 1);
          options[next]?.focus();
        }}>
        <div className="studio-switch-input">
          <StudioIcon name="search" /><input type="search" ref={searchInput} value={query} aria-label={searchLabel}
            placeholder={zh ? "搜索会话名称或主题…" : "Search names or topics…"}
            onChange={event => setQuery(event.currentTarget.value)} onKeyDown={event => {
              if (event.key === "Enter" && !event.nativeEvent.isComposing && matches[0]) openResult(matches[0].slug);
            }} />
          <button type="button" aria-label={zh ? "关闭" : "Close"} onClick={() => setSearching(false)}><StudioIcon name="close" size={16} /></button>
        </div>
        <div className="studio-switch-results">
          {matches.map(channel => <button key={channel.slug} className="studio-switch-result" type="button" onClick={() => openResult(channel.slug)}>
            <StudioIcon name={channel.archived_at !== null ? "archive" : "message"} size={17} />
            <span>{channel.title || channel.slug}</span>
            {channel.slug === active && <StudioIcon name="check" size={16} />}
          </button>)}
          {!matches.length && <p role="status">{zh ? "没有匹配的会话" : "No matching conversations"}</p>}
        </div>
      </div>
    </div></ModalPortal>}
  </div>;
}
