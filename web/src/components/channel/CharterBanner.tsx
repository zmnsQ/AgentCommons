import type { ChannelCharter } from "../../lib/api";
import { Markdown } from "../Markdown";
import { useT } from "../../i18n/useT";
import "../../i18n/strings/Channel";

export function CharterBanner({
  charter,
  open,
  canModerate,
  updated,
  draft,
  saving,
  editing,
  error,
  lockedOpen = false,
  onToggle,
  onDraft,
  onEdit,
  onCancel,
  onSave,
  onRetry,
}: {
  charter: ChannelCharter | null;
  open: boolean;
  canModerate: boolean;
  updated: boolean;
  draft: string;
  saving: boolean;
  editing: boolean;
  error: string | null;
  lockedOpen?: boolean;
  onToggle: () => void;
  onDraft: (value: string) => void;
  onEdit: () => void;
  onCancel: () => void;
  onSave: () => void;
  onRetry?: () => void;
}) {
  const t = useT();
  const hasCharter = Boolean(charter?.charter);
  const activeDecisions = charter?.active_decisions ?? [];
  return (
    <section className={"charter-banner" + (updated ? " charter-banner--updated" : "")}>
      <header className="charter-head">
        {lockedOpen ? (
          <div className="charter-toggle charter-toggle--static">
            <span>{t("Channel.charter.label")}</span>
            {charter ? <span className="t-mono">{t("Channel.charter.rev", { rev: charter.charter_rev })}</span> : null}
            {updated ? <span className="charter-updated">{t("Channel.charter.updated")}</span> : null}
          </div>
        ) : (
          <button className="charter-toggle" type="button" onClick={onToggle} aria-expanded={open}>
            <span>{t("Channel.charter.label")}</span>
            {charter ? <span className="t-mono">{t("Channel.charter.rev", { rev: charter.charter_rev })}</span> : null}
            {updated ? <span className="charter-updated">{t("Channel.charter.updated")}</span> : null}
          </button>
        )}
        {canModerate && (
          <button className="d-btn charter-edit" type="button" disabled={charter === null} onClick={onEdit}>
            {t("Channel.charter.edit")}
          </button>
        )}
      </header>
      {open && (
        <div className="charter-body">
          {error !== null && !(canModerate && editing) && (
            <p className="banner banner--red" role="alert">{error}</p>
          )}
          {canModerate && editing ? (
            <div className="charter-editor">
              <textarea
                className="charter-textarea t-mono"
                value={draft}
                onChange={(e) => onDraft(e.target.value)}
              />
              <div className="charter-actions">
                <button className="d-btn d-btn--primary" type="button" disabled={saving} onClick={onSave}>
                  {saving ? t("Channel.charter.saving") : t("Channel.charter.save")}
                </button>
                <button className="d-btn" type="button" disabled={saving} onClick={onCancel}>
                  {t("Channel.charter.cancel")}
                </button>
              </div>
              {error !== null && <p className="banner banner--red">{error}</p>}
            </div>
          ) : hasCharter ? (
            <Markdown source={charter!.charter!} />
          ) : charter === null && error !== null ? (
            onRetry !== undefined && (
              <button className="d-btn" type="button" onClick={onRetry}>
                {t("Channel.charter.retry")}
              </button>
            )
          ) : (
            <p className="charter-empty">{t("Channel.charter.empty")}</p>
          )}
          {activeDecisions.length > 0 && (
            <section className="charter-decisions" aria-label={t("Channel.charter.decisionsLabel")}>
              <header className="charter-decisions-head">
                <strong>{t("Channel.charter.decisionsLabel")}</strong>
                <span>{t("Channel.charter.decisionsHelp")}</span>
              </header>
              <ul className="charter-decisions-list">
                {activeDecisions.map((decision) => (
                  <li key={decision.id}>
                    <span className="t-mono charter-decision-topic">{decision.topic}</span>
                    <span className="charter-decision-summary">{decision.summary}</span>
                    <span className="t-mono charter-decision-meta">
                      {decision.source_seq === null
                        ? decision.id
                        : `${t("Channel.charter.decisionSource", { seq: String(decision.source_seq) })} · ${decision.id}`}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      )}
    </section>
  );
}
