import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import type { CloudAgentConnection, CloudAgentConnectionInput, CloudAgentRun, CollaborationSummary, DirectAgentProvider } from "@agentparty/shared/collaboration";
import { collaborationError, isActiveCloudRun, type CollaborationClient } from "../lib/collaborationApi";
import { useT } from "../i18n/useT";
import { useLocale } from "../i18n/locale";
import "../i18n/strings/CollaborationHub";

export function collaborationDate(value: number | string, locale = "en"): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : date.toLocaleString(locale === "zh" ? "zh-CN" : "en-US", { dateStyle: "short", timeStyle: "short" });
}

interface AgentProps {
  token: string;
  slug: string;
  summary: CollaborationSummary;
  client: CollaborationClient;
  onChanged(): Promise<void>;
  initialProvider?: DirectAgentProvider;
  initialSavedConnectionId?: string;
  onConnect?():void;
  onSetupDone?(savedId?:string):void;
}

function ConnectionForm({ token, slug, connection, client, onSaved, onClose, initialProvider }: {
  token: string; slug: string; connection: CloudAgentConnection | null; client: CollaborationClient;
  initialProvider?: DirectAgentProvider;
  onSaved(id: string): Promise<void>; onClose(): void;
}) {
  const t = useT();
  const {locale}=useLocale(),zh=locale==="zh";
  const [provider, setProvider] = useState<DirectAgentProvider>(connection?.provider ?? initialProvider ?? "hermes");
  const [name, setName] = useState(connection?.name ?? "");
  const [endpoint, setEndpoint] = useState(connection?.endpoint ?? "");
  const [remoteId, setRemoteId] = useState(connection?.remote_agent_id ?? "");
  const [credential, setCredential] = useState("");
  const [personalContext, setPersonalContext] = useState(connection?.personal_context_acknowledged ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestBusy = useRef(false);
  const alive = useRef(true);
  const id = useRef(connection?.id ?? `cloud-${crypto.randomUUID()}`);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (requestBusy.current) return;
    requestBusy.current = true;
    setSaving(true); setError(null);
    const input: CloudAgentConnectionInput = {
      provider, name: name.trim(),
      ...(provider === "hermes" ? { endpoint: endpoint.trim() } : { remote_agent_id: remoteId.trim(), allow_personal_context: personalContext }),
      ...(credential.trim() ? { credential: credential.trim() } : {}),
    };
    try {
      const { connection: saved } = await client.saveConnection(token, slug, id.current, input);
      if (!alive.current) return;
      setCredential("");
      await onSaved(saved.id);
    } catch (cause) {
      if (alive.current) setError(collaborationError(cause));
    } finally {
      requestBusy.current = false;
      if (alive.current) setSaving(false);
    }
  };
  return (
    <form className="commons-form" onSubmit={(event) => void save(event)} aria-label={t("Collab.addAgent")}>
      <p className="commons-note" data-connection-guide={provider}>{provider === "hermes"
        ? (zh ? "填写 Hermes API Server 地址、API 凭证和已有的 profile。服务管理员可提供这些信息。" : "Enter your Hermes API Server URL, API credential and existing profile. Your server administrator can provide these details.")
        : (zh ? "从 Manus / Cue 的账号设置中获取 Agent ID 和 API 凭证。" : "Get your Agent ID and API credentials from your Manus / Cue account settings.")}</p>
      <p className="commons-muted">{zh ? "保存连接后，即可在本群选择它并提交任务。" : "Save the connection, then select it in this group to submit tasks."}</p>
      <div className="commons-form-grid">
        <label>{t("Collab.provider")}<select value={provider} disabled={connection !== null || saving} onChange={(event) => setProvider(event.target.value as DirectAgentProvider)}>
          <option value="hermes">Hermes Agent</option><option value="manus">Manus / Cue</option>
        </select></label>
        <label>{t("Collab.name")}<input value={name} maxLength={80} required disabled={saving} onChange={(event) => setName(event.target.value)} /></label>
        {provider === "hermes" ? (
          <label className="commons-field-wide">{t("Collab.endpoint")}<input type="url" value={endpoint} placeholder="https://hermes.example.com" required disabled={saving} onChange={(event) => setEndpoint(event.target.value)} /></label>
        ) : (
          <label className="commons-field-wide">{t("Collab.remoteId")}<input value={remoteId} required disabled={saving} onChange={(event) => setRemoteId(event.target.value)} /></label>
        )}
        <label className="commons-field-wide">{t("Collab.credential")}<input type="password" value={credential} autoComplete="new-password" spellCheck={false} required={!connection?.credential_configured} disabled={saving} onChange={(event) => setCredential(event.target.value)} aria-describedby="commons-agent-credential-help" /></label>
      </div>
      <p className="commons-muted" id="commons-agent-credential-help">{t("Collab.credentialHint")}</p>
      {provider === "manus" ? (
        <label className="commons-check"><input type="checkbox" checked={personalContext} required disabled={saving} onChange={(event) => setPersonalContext(event.target.checked)} />{t("Collab.personalContext")}</label>
      ) : <p className="commons-note">{t("Collab.hermesContext")}</p>}
      {error !== null && <p className="commons-error" role="alert">{error}</p>}
      <div className="commons-actions"><button className="d-btn commons-primary" disabled={saving}>{t(saving ? "Collab.busy" : "Collab.save")}</button><button className="d-btn" type="button" disabled={saving} onClick={onClose}>{t("Collab.close")}</button></div>
    </form>
  );
}

export function CloudAgentRuns({ token, slug, connection, canRun, client }: {
  token: string; slug: string; connection: CloudAgentConnection; canRun: boolean; client: CollaborationClient;
}) {
  const t = useT();
  const { locale } = useLocale();
  const [runs, setRuns] = useState<CloudAgentRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const alive = useRef(true);
  const requestBusy = useRef(false);
  const pendingRequest = useRef<{ prompt: string; id: string } | null>(null);
  const requestGeneration = useRef(0);

  const refresh = useCallback(async (signal?: AbortSignal) => {
    const generation = ++requestGeneration.current;
    setLoading(true); setError(null);
    try {
      const result = await client.runs(token, slug, connection.id, signal);
      if (alive.current && generation === requestGeneration.current) setRuns(result.runs);
    } catch (cause) {
      if (alive.current && !signal?.aborted && generation === requestGeneration.current) setError(collaborationError(cause));
    } finally {
      if (alive.current && generation === requestGeneration.current) setLoading(false);
    }
  }, [client, connection.id, slug, token]);
  useEffect(() => {
    alive.current = true;
    const controller = new AbortController();
    void refresh(controller.signal);
    return () => { alive.current = false; controller.abort(); };
  }, [refresh]);

  const updateRun = (run: CloudAgentRun) => setRuns((current) => [run, ...current.filter((item) => item.id !== run.id)].sort((a, b) => b.created_at - a.created_at));
  const send = async (event: FormEvent) => {
    event.preventDefault();
    if (!canRun || loading || runs.some(isActiveCloudRun) || !prompt.trim() || requestBusy.current) return;
    requestBusy.current = true;
    setBusy("send"); setError(null);
    const text = prompt.trim();
    if (pendingRequest.current?.prompt !== text) pendingRequest.current = { prompt: text, id: crypto.randomUUID() };
    try {
      const { run } = await client.run(token, slug, connection.id, text, pendingRequest.current.id);
      if (alive.current) { updateRun(run); setPrompt(""); pendingRequest.current = null; }
    } catch (cause) {
      if (alive.current) setError(`${collaborationError(cause)} ${t("Collab.runFailed")}`);
    } finally {
      requestBusy.current = false;
      if (alive.current) setBusy(null);
    }
  };
  const operate = async (run: CloudAgentRun, action: "sync" | "cancel") => {
    if (!canRun || requestBusy.current) return;
    requestBusy.current = true; setBusy(run.id); setError(null);
    try {
      const result = await (action === "sync" ? client.syncRun : client.cancelRun)(token, slug, connection.id, run.id);
      if (alive.current) updateRun(result.run);
    } catch (cause) {
      if (alive.current) setError(collaborationError(cause));
    } finally { requestBusy.current = false; if (alive.current) setBusy(null); }
  };
  const hasActive = runs.some(isActiveCloudRun);
  return (
    <section className="commons-runs">
      <p className="commons-note">{t("Collab.manual")}</p>
      {canRun && <form onSubmit={(event) => void send(event)} className="commons-prompt">
        <label htmlFor="commons-agent-prompt">{t("Collab.prompt", { name: connection.name })}</label>
        <textarea id="commons-agent-prompt" rows={3} maxLength={16000} value={prompt} placeholder={t("Collab.promptHint")} disabled={busy !== null} onChange={(event) => setPrompt(event.target.value)} />
        <button className="d-btn commons-primary" disabled={loading || busy !== null || hasActive || !prompt.trim()}>{t(busy === "send" ? "Collab.busy" : "Collab.send")}</button>
      </form>}
      <div className="commons-section-head"><h3>{t("Collab.taskHistory")}</h3><button className="d-btn" type="button" disabled={loading || busy !== null} onClick={() => void refresh()}>{t(loading ? "Collab.loading" : "Collab.refresh")}</button></div>
      {error !== null && <p className="commons-error" role="alert">{error}</p>}
      {!loading && runs.length === 0 && <p className="commons-muted">{t("Collab.noRuns")}</p>}
      <div className="commons-run-list" aria-live="polite">
        {runs.map((run) => <article className="commons-run" key={run.id}>
          <header><span className={`commons-badge commons-badge--${run.state}`}>{t(`Collab.state.${run.state}`)}</span><time>{collaborationDate(run.updated_at, locale)}</time></header>
          <p className="commons-run-prompt">{run.prompt}</p>
          {run.state === "submitted" && <p className="commons-note">{t("Collab.submitted")}</p>}
          {run.state === "unknown" && <p className="commons-note">{t("Collab.unknown")}</p>}
          {run.state === "needs_input" && <p className="commons-note">{t("Collab.needsInput")}</p>}
          {run.result && <pre className="commons-result">{run.result}</pre>}
          {run.error && <p className="commons-error">{run.error}</p>}
          {run.reply_message_seq !== null && <p className="commons-success">{t("Collab.resultPosted", { seq: run.reply_message_seq })}</p>}
          {run.state === "completed" && run.result && run.reply_message_seq === null && <p className="commons-note">{t("Collab.resultPending")}</p>}
          {(isActiveCloudRun(run) || (run.state === "completed" && run.result && run.reply_message_seq === null)) && canRun && <div className="commons-actions">
            <button className="d-btn" type="button" disabled={busy !== null} onClick={() => void operate(run, "sync")}>{t(busy === run.id ? "Collab.busy" : run.state === "completed" ? "Collab.retryPost" : "Collab.sync")}</button>
            {connection.supports_cancel && isActiveCloudRun(run) && <button className="d-btn" type="button" disabled={busy !== null || run.state === "starting"} onClick={() => void operate(run, "cancel")}>{t("Collab.cancelRun")}</button>}
          </div>}
        </article>)}
      </div>
    </section>
  );
}

export function CloudAgentConnections({ token, slug, summary, client, onChanged, initialProvider, initialSavedConnectionId, onConnect, onSetupDone }: AgentProps) {
  const t = useT();
  const { locale } = useLocale();
  const [selectedId, setSelectedId] = useState<string | null>(initialSavedConnectionId ?? summary.connections[0]?.id ?? null);
  const [savedSelectionId, setSavedSelectionId] = useState<string | undefined>(initialSavedConnectionId);
  const [form, setForm] = useState<CloudAgentConnection | "new" | null>(initialProvider && summary.permissions.manage ? "new" : null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(initialSavedConnectionId ? t("Collab.saved") : null);
  const alive = useRef(true);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  // A stale summary must not silently route a newly saved connection's task to
  // an older connection. Refresh will reveal the saved record when available.
  const selected = summary.connections.find((item) => item.id === selectedId) ?? (selectedId === savedSelectionId ? null : summary.connections[0] ?? null);
  const remove = async (id: string) => {
    if (deleting) return;
    setDeleting(true); setError(null);
    try { await client.removeConnection(token, slug, id); setConfirmId(null); setSelectedId(null); await onChanged(); }
    catch (cause) { setError(collaborationError(cause)); }
    finally { setDeleting(false); }
  };
  return (
    <div className="commons-agents">
      <div className="commons-section-head"><h2>{t("Collab.agents")}</h2>{summary.permissions.manage && form === null && <button className="d-btn commons-primary" type="button" onClick={() => { if(onConnect){onConnect();return;} setForm("new"); setNotice(null); }}>{t("Collab.addAgent")}</button>}</div>
      {notice && <p className="commons-success" role="status">{notice}</p>}
      {error && <p className="commons-error" role="alert">{error}</p>}
      {form !== null && <ConnectionForm initialProvider={initialProvider} key={form === "new" ? "new" : form.id} token={token} slug={slug} connection={form === "new" ? null : form} client={client} onClose={() => {setForm(null);onSetupDone?.();}} onSaved={async (id) => { setForm(null); setSelectedId(id); setSavedSelectionId(id); setNotice(t("Collab.saved")); await onChanged(); if(alive.current)onSetupDone?.(id); }} />}
      {form === null && (summary.connections.length === 0 ? <div className="commons-empty"><span className="commons-empty-symbol" aria-hidden="true">↗</span><h3>{t("Collab.noAgents")}</h3><p>{t("Collab.noAgentsHint")}</p></div> : <div className="commons-agent-layout">
        <div className="commons-agent-list" role="group" aria-label={t("Collab.agents")}>
          {summary.connections.map((connection) => <button className={`commons-agent-card ${selected?.id === connection.id ? "is-selected" : ""}`} type="button" key={connection.id} aria-pressed={selected?.id === connection.id} onClick={() => { setSelectedId(connection.id); setConfirmId(null); }}>
            <span className={`commons-agent-monogram commons-agent-monogram--${connection.provider}`} aria-hidden="true">{connection.provider === "hermes" ? "H" : "M"}</span>
            <strong>{connection.name}</strong><span>{connection.provider === "hermes" ? "Hermes Agent" : "Manus / Cue"}</span><small>{t("Collab.verified", { date: collaborationDate(connection.verified_at, locale) })}</small>
          </button>)}
        </div>
        {selected && <div className="commons-agent-detail">
          <div className="commons-section-head"><div><h3>{selected.name}</h3><span className="commons-muted">{t("Collab.agentIdentity", { name: selected.agent_name })} · {selected.credential_configured ? t("Collab.credentialPresent") : "—"}</span></div>{summary.permissions.manage && <div className="commons-actions"><button className="d-btn" type="button" onClick={() => setForm(selected)}>{t("Collab.edit")}</button><button className="d-btn" type="button" onClick={() => setConfirmId(selected.id)}>{t("Collab.disconnect")}</button></div>}</div>
          {confirmId === selected.id && <div className="commons-confirm"><p>{t("Collab.confirmDisconnect")}</p><button className="d-btn" type="button" disabled={deleting} onClick={() => void remove(selected.id)}>{t(deleting ? "Collab.busy" : "Collab.confirm")}</button><button className="d-btn" type="button" disabled={deleting} onClick={() => setConfirmId(null)}>{t("Collab.close")}</button></div>}
          <CloudAgentRuns key={selected.id} token={token} slug={slug} connection={selected} client={client} canRun={summary.permissions.run} />
        </div>}
      </div>)}

    </div>
  );
}
