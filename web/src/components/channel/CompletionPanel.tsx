import type { MsgFrame } from "@agentparty/shared";
import { useT } from "../../i18n/useT";
import "../../i18n/strings/Channel";

export function CompletionPanel({
  completions,
  visible,
  enabled,
  showItems = true,
  onToggle,
  onJump,
}: {
  completions: MsgFrame[];
  visible: number;
  enabled: boolean;
  showItems?: boolean;
  onToggle: () => void;
  onJump: (seq: number) => void;
}) {
  const t = useT();
  // The active filter must always retain its off switch. Search mode may hide
  // the completion rows, but it cannot make an already-enabled filter inert.
  if (completions.length === 0 && !enabled) return null;

  return (
    <section className="completion-panel" aria-label={t("Channel.completion.aria")}>
      <div className="completion-panel-head">
        <h2 className="completion-title">{t("Channel.heading.completions")}</h2>
        <span className="t-mono completion-count">
          {visible}/{completions.length}
        </span>
        <button className={"d-btn completion-toggle" + (enabled ? " is-active" : "")} type="button" onClick={onToggle}>
          <span>{enabled ? t("Channel.filter.all") : t("Channel.filter.only")}</span>
        </button>
      </div>
      {showItems && completions.length > 0 && <ol className="completion-list">
        {completions.slice(-6).reverse().map((message) => {
          const artifact = message.completion_artifact!;
          const meta = [
            t("Channel.completion.meta.kickoff", { seq: artifact.kickoff_seq }),
            t("Channel.completion.meta.replies", { count: artifact.replies_count }),
            artifact.timeout ? t("Channel.completion.meta.timeout") : t("Channel.completion.meta.closed"),
          ];
          return (
            <li key={message.seq} className="completion-item">
              <button className="t-mono completion-jump" type="button" onClick={() => onJump(message.seq)}>
                #{message.seq}
              </button>
              <span className="completion-item-body">{message.body === "" ? t("Channel.empty.content") : message.body}</span>
              <span className="t-mono completion-meta">{meta.join(" · ")}</span>
            </li>
          );
        })}
      </ol>}
    </section>
  );
}
