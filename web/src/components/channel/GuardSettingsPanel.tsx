import { useLocale } from "../../i18n/locale";
import { useT } from "../../i18n/useT";
import "../../i18n/strings/Channel";

export interface GuardSettingsPanelProps {
  saved?: { loopEnabled: boolean; loopLimit: string; workflowEnabled: boolean; workflowLimit: string };
  canModerate: boolean;
  loopEnabled: boolean;
  loopLimit: string;
  workflowEnabled: boolean;
  workflowLimit: string;
  saving: "loop" | "workflow" | null;
  error: string | null;
  onLoopEnabled(next: boolean): void;
  onLoopLimit(next: string): void;
  onWorkflowEnabled(next: boolean): void;
  onWorkflowLimit(next: string): void;
  onSaveLoop(): void;
  onSaveWorkflow(): void;
  onLoopUnlimited(): void;
  onWorkflowUnlimited(): void;
}

export function GuardSettingsPanel({
  saved,
  canModerate,
  loopEnabled,
  loopLimit,
  workflowEnabled,
  workflowLimit,
  saving,
  error,
  onLoopEnabled,
  onLoopLimit,
  onWorkflowEnabled,
  onWorkflowLimit,
  onSaveLoop,
  onSaveWorkflow,
}: GuardSettingsPanelProps) {
  const t = useT();
  const zh = useLocale().locale === "zh";
  const loopDirty = !saved || saved.loopEnabled !== loopEnabled || (loopEnabled && saved.loopLimit !== loopLimit);
  const workflowDirty = !saved || saved.workflowEnabled !== workflowEnabled || (workflowEnabled && saved.workflowLimit !== workflowLimit);
  return (
    <details className="guard-settings">
      <summary className="guard-settings-summary">
        <span>
          <strong>{t("Channel.settings.guardAdvanced")}</strong>
          <small>{t("Channel.settings.guardAdvancedHint")}</small>
        </span>
        <span className="guard-settings-state">
          {saved ? (saved.loopEnabled || saved.workflowEnabled ? t("Channel.settings.enabled") : t("Channel.settings.off")) : (zh ? "保存后生效" : "Changes require saving")}
          {(loopDirty || workflowDirty) && <small> · {zh ? "未保存" : "Unsaved"}</small>}
        </span>
      </summary>
      <div className="guard-settings-body">
      {(loopDirty || workflowDirty) && <p role="status">{zh ? "有未保存的设置。点击各项的保存后才会生效。" : "Unsaved settings. Save each section to apply its changes."}</p>}
      <section className="guard-setting-row">
        <div className="guard-setting-head">
          <h3>{t("Channel.settings.loopGuard")}</h3>
          <label className="guard-switch">
            <input
              type="checkbox"
              checked={loopEnabled}
              disabled={!canModerate || saving !== null}
              onChange={(event) => onLoopEnabled(event.currentTarget.checked)}
            />
            <span>{loopEnabled ? t("Channel.settings.enabled") : t("Channel.settings.unlimited")}</span>
          </label>
        </div>
        <div className="guard-setting-controls">
          <input
            className="guard-limit-input"
            inputMode="numeric"
            pattern="[0-9]*"
            value={loopLimit}
            placeholder={loopEnabled ? t("Channel.settings.loopRange") : t("Channel.settings.unlimited")}
            disabled={!canModerate || !loopEnabled || saving !== null}
            onChange={(event) => onLoopLimit(event.currentTarget.value)}
          />
          <button type="button" className="d-btn d-btn--primary" disabled={!canModerate || saving !== null || !loopDirty} onClick={onSaveLoop}>
            {saving === "loop" ? t("Channel.settings.saving") : t("Channel.settings.save")}
          </button>

        </div>
      </section>
      <section className="guard-setting-row">
        <div className="guard-setting-head">
          <h3>{t("Channel.settings.workflowGuard")}</h3>
          <label className="guard-switch">
            <input
              type="checkbox"
              checked={workflowEnabled}
              disabled={!canModerate || saving !== null}
              onChange={(event) => onWorkflowEnabled(event.currentTarget.checked)}
            />
            <span>{workflowEnabled ? t("Channel.settings.enabled") : t("Channel.settings.off")}</span>
          </label>
        </div>
        <div className="guard-setting-controls">
          <input
            className="guard-limit-input"
            inputMode="numeric"
            pattern="[0-9]*"
            value={workflowLimit}
            placeholder={workflowEnabled ? t("Channel.settings.workflowRange") : t("Channel.settings.off")}
            disabled={!canModerate || !workflowEnabled || saving !== null}
            onChange={(event) => onWorkflowLimit(event.currentTarget.value)}
          />
          <button type="button" className="d-btn d-btn--primary" disabled={!canModerate || saving !== null || !workflowDirty} onClick={onSaveWorkflow}>
            {saving === "workflow" ? t("Channel.settings.saving") : t("Channel.settings.save")}
          </button>

        </div>
      </section>
      {error !== null && <p className="guard-setting-error" role="alert">{error}</p>}
      </div>
    </details>
  );
}
