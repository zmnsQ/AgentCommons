import { useCallback, useEffect, useRef, useState } from "react";
import type { CollaborationSummary } from "@agentparty/shared/collaboration";
import type { GrokSubmissionSafety } from "../lib/grokSubmissionSafety";
import { collaborationApi, collaborationError } from "../lib/collaborationApi";
import { apiBase } from "../lib/base";
import { useLocale } from "../i18n/locale";
import { CloudBridges } from "./CloudBridges";
import { CloudAgentConnections } from "./CloudAgentConnections";
import { StudioIcon } from "./StudioIcon";
import type { CloudAgentChoice } from "./AgentConnectionPicker";

/** Keeps cloud platform onboarding (ChatGPT dot, Muse, Cue, Hermes, Grok)
 * inside the same Add-Agent modal instead of jumping to CollaborationHub. */
export function InlineCloudSetup({
  provider,
  token,
  slug,
  canManage,
  canRun,
  submissionSafety,
  dispatchScopeReady = true,
  onBack,
}: {
  provider: CloudAgentChoice;
  token: string;
  slug: string;
  canManage: boolean;
  canRun: boolean;
  submissionSafety?: GrokSubmissionSafety;
  dispatchScopeReady?: boolean;
  onBack: () => void;
}) {
  const { locale } = useLocale();
  const zh = locale === "zh";
  const [apiProvider, setApiProvider] = useState<"hermes" | "manus" | null>(null);
  const [apiPreset, setApiPreset] = useState<{ remoteId?: string; name?: string } | null>(null);
  const [summary, setSummary] = useState<CollaborationSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const genRef = useRef(0);
  const server = apiBase();

  const loadSummary = useCallback(async (signal?: AbortSignal) => {
    const gen = ++genRef.current;
    setLoading(true);
    setError("");
    try {
      const next = await collaborationApi.summary(token, slug, signal);
      if (!signal?.aborted && genRef.current === gen && apiBase() === server) {
        setSummary(next);
      }
    } catch (cause) {
      if (!signal?.aborted && genRef.current === gen && apiBase() === server) {
        setError(collaborationError(cause));
      }
    } finally {
      if (!signal?.aborted && genRef.current === gen && apiBase() === server) {
        setLoading(false);
      }
    }
  }, [server, slug, token]);

  useEffect(() => {
    setApiProvider(null);
    setApiPreset(null);
    setSummary(null);
    setError("");
  }, [provider, slug, token, server]);

  useEffect(() => {
    if (apiProvider === null) return;
    const controller = new AbortController();
    void loadSummary(controller.signal);
    return () => {
      controller.abort();
      genRef.current += 1;
    };
  }, [apiProvider, loadSummary]);

  if (apiProvider !== null) {
    const scopedSummary =
      summary === null
        ? null
        : {
            ...summary,
            permissions: {
              manage: canManage && summary.permissions.manage,
              run: canRun && dispatchScopeReady && summary.permissions.run,
              upload: summary.permissions.upload,
            },
          };
    return (
      <section className="coding-setup">
        <div className="coding-topbar">
          <button type="button" className="d-btn d-btn--ghost" onClick={() => setApiProvider(null)}>
            <StudioIcon name="arrow-left" />
            {zh ? "返回上一步" : "Back"}
          </button>
          <span className="ac-chip ac-chip--accent">
            {apiProvider === "hermes" ? "Hermes Agent" : "Manus / Cue"}
          </span>
        </div>
        {loading && scopedSummary === null && (
          <p role="status" className="ac-inline-status">
            {zh ? "正在加载连接配置…" : "Loading connection configuration…"}
          </p>
        )}
        {error !== "" && (
          <p role="alert" className="commons-error">
            {error}
          </p>
        )}
        {scopedSummary !== null && (
          <CloudAgentConnections
            key={`${slug}:${apiProvider}`}
            initialProvider={apiProvider}
            initialRemoteId={apiPreset?.remoteId}
            initialName={apiPreset?.name}
            token={token}
            slug={slug}
            summary={scopedSummary}
            client={collaborationApi}
            onChanged={() => loadSummary()}
          />
        )}
      </section>
    );
  }

  return (
    <CloudBridges
      focusedProvider={provider}
      onBackToPicker={onBack}
      submissionSafety={submissionSafety}
      showAuthorizationManagement={false}
      token={token}
      slug={slug}
      canManage={canManage}
      canRun={canRun && dispatchScopeReady}
      initialProvider={provider}
      onConfigureApi={(target, preset) => { setApiProvider(target); setApiPreset(preset ?? null); }}
    />
  );
}
