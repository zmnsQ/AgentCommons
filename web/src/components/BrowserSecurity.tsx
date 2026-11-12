import { useEffect, useState } from "react";
import { useLocale } from "../i18n/locale";
import { browserAuthRequest, githubLoginUrl, securityError } from "../lib/browserAuth";
import { AuthScreen } from "./AuthScreen";
import { VerificationField, completeVerification } from "./VerificationField";
import { StudioIcon } from "./StudioIcon";
import "./browser-auth.css";

function AuthError({ error }: { error: unknown }) {
  const zh = useLocale().locale === "zh";
  if (error == null) return null;
  return <p id="auth-error" className="auth-error" role="alert">{securityError(error, zh)}</p>;
}

export function SecondFactorGate({ onVerified, onCancel }: {
  onVerified(): Promise<unknown>;
  onCancel(): Promise<unknown>;
}) {
  const zh = useLocale().locale === "zh";
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  async function submit(cancel = false) {
    if (busy || (!cancel && !completeVerification(code, recovery))) return;
    setBusy(true);
    setError(null);
    try {
      if (cancel) await onCancel();
      else {
        await browserAuthRequest("/verify", { code, recovery });
        setCode("");
        await onVerified();
      }
    } catch (cause) { setError(cause); }
    finally { setBusy(false); }
  }
  return (
    <AuthScreen title={zh ? "二步验证" : "Two-step verification"}>
      <p className="auth-intro">{recovery
        ? (zh ? "输入一个尚未使用的恢复码。" : "Enter an unused recovery code.")
        : (zh ? "打开验证器，找到 AgentCommons 的验证码。" : "Open your authenticator and find the code for AgentCommons.")}</p>
      <form className="auth-stack" onSubmit={e => { e.preventDefault(); void submit(); }}>
        <VerificationField recovery={recovery} code={code} busy={busy} invalid={error instanceof Error && error.message === "invalid_verification_code"}
          onChange={value => { setCode(value); setError(null); }} />
        <AuthError error={error} />
        <button className="signin-action signin-primary" disabled={busy || !completeVerification(code, recovery)}>
          {busy ? (zh ? "验证中…" : "Verifying…") : (zh ? "验证并登录" : "Verify and sign in")}
        </button>
        <div className="auth-links">
          <button type="button" className="auth-link" disabled={busy} onClick={() => {
            setRecovery(!recovery); setCode(""); setError(null);
          }}>{recovery ? (zh ? "使用验证器" : "Use authenticator") : (zh ? "使用恢复码" : "Use a recovery code")}</button>
          <button type="button" className="auth-link" disabled={busy} onClick={() => void submit(true)}>
            {zh ? "取消登录" : "Cancel sign-in"}
          </button>
        </div>
      </form>
    </AuthScreen>
  );
}

interface SecurityStatus { enabled: boolean; recovery_remaining: number; recent_login: boolean; login: string; }
interface Setup { secret: string; otpauth_uri: string; }
type SecurityAction = "disable" | "recovery-codes";

export function BrowserSecurity() {
  const zh = useLocale().locale === "zh";
  const [status, setStatus] = useState<SecurityStatus | null>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [action, setAction] = useState<SecurityAction | null>(null);
  const [qr, setQr] = useState("");
  const [code, setCode] = useState("");
  const [recovery, setRecovery] = useState(false);
  const [codes, setCodes] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);

  useEffect(() => {
    let active = true;
    browserAuthRequest<SecurityStatus>("/security").then(value => {
      if (active) setStatus(value);
    }).catch(cause => { if (active) setError(cause); });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    let active = true;
    setQr("");
    if (setup) {
      void import("qrcode").then(({ default: qrCode }) =>
        qrCode.toDataURL(setup.otpauth_uri, { width: 240, margin: 4, errorCorrectionLevel: "M" })
      ).then(url => { if (active) setQr(url); }).catch(() => { /* Manual setup is available. */ });
    }
    return () => { active = false; };
  }, [setup]);
  async function perform(work: () => Promise<void>) {
    if (busy) return;
    setBusy(true); setError(null);
    try { await work(); } catch (cause) { setError(cause); } finally { setBusy(false); }
  }
  function clearForm() {
    setAction(null); setSetup(null); setRecovery(false); setCode(""); setError(null);
  }
  async function finish() {
    if ((!setup && !action) || !completeVerification(code, recovery)) return;
    const path = setup ? "/security/confirm" : `/security/${action}`;
    const result = await browserAuthRequest<{ recovery_codes?: string[] }>(path, { code, recovery });
    clearForm(); setCodes(result.recovery_codes ?? []);
    window.dispatchEvent(new Event("commons-auth-refresh"));
    setStatus(await browserAuthRequest<SecurityStatus>("/security"));
  }
  function downloadCodes() {
    const content = [`AgentCommons — ${status?.login ?? ""}`, zh ? "一次性恢复码" : "One-time recovery codes", "", ...codes, ""].join("\n");
    const url = URL.createObjectURL(new Blob([content], { type: "text/plain;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url; link.download = "AgentCommons-recovery-codes.txt"; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const changeTitle = action === "disable" ? (zh ? "关闭二步验证" : "Disable two-step verification")
    : (zh ? "重新生成恢复码" : "Regenerate recovery codes");

  return (
    <AuthScreen wide title={zh ? "账号安全" : "Account security"}>
      <div className="auth-stack">
        <AuthError error={error} />
        {!status && !error && <p role="status">{zh ? "正在读取设置…" : "Loading settings…"}</p>}
        {status && !setup && !action && codes.length === 0 && <>
          <div className="auth-setting">
            <StudioIcon name="shield" size={22} />
            <div><h2>{zh ? "二步验证" : "Two-step verification"}</h2>
              <p>{status.enabled ? (zh ? `剩余 ${status.recovery_remaining} 个恢复码` : `${status.recovery_remaining} recovery codes remaining`)
                : (zh ? "使用验证器为登录添加一次验证。" : "Use an authenticator when you sign in.")}</p></div>
            <span>{status.enabled ? (zh ? "已启用" : "On") : (zh ? "未启用" : "Off")}</span>
          </div>
          {status.enabled ? <>
            <button className="signin-action" disabled={busy} onClick={() => setAction("recovery-codes")}>{zh ? "重新生成恢复码" : "Regenerate recovery codes"}</button>
            <button className="auth-link auth-danger" disabled={busy} onClick={() => setAction("disable")}>{zh ? "关闭二步验证" : "Disable two-step verification"}</button>
          </> : status.recent_login ? (
            <button className="signin-action signin-primary" disabled={busy} onClick={() => void perform(async () => {
              setSetup(await browserAuthRequest<Setup>("/security/setup", {}));
            })}>{zh ? "绑定验证器" : "Set up authenticator"}</button>
          ) : <a className="signin-action signin-primary" href={githubLoginUrl("/auth/security")}>{zh ? "重新登录以绑定验证器" : "Sign in again to set up"}</a>}
        </>}

        {codes.length > 0 && <section className="auth-stack" aria-labelledby="recovery-title">
          <h2 id="recovery-title">{zh ? "保存恢复码" : "Save your recovery codes"}</h2>
          <p>{zh ? "这些恢复码仅显示一次，每个可用一次。" : "These codes are shown once. Each works once."}</p>
          <ul className="auth-codes">{codes.map(item => <li key={item}><code>{item}</code></li>)}</ul>
          <button className="signin-action signin-primary" onClick={downloadCodes}>{zh ? "下载恢复码" : "Download recovery codes"}</button>
          <button className="auth-link" onClick={() => setCodes([])}>{zh ? "我已保存" : "I’ve saved them"}</button>
        </section>}

        {setup && <section className="auth-stack" aria-labelledby="auth-setup-title">
          <h2 id="auth-setup-title">{zh ? "绑定验证器" : "Set up authenticator"}</h2>
          <p>{zh ? "用验证器扫描二维码，再输入生成的验证码。" : "Scan the QR code with your authenticator, then enter its code."}</p>
          {qr && <img className="auth-qr" src={qr} width="192" height="192" alt={zh ? "验证器绑定二维码" : "Authenticator setup QR code"} />}
          <details><summary>{zh ? "手动输入密钥" : "Enter the key manually"}</summary>
            <code className="auth-secret">{setup.secret}</code></details>
        </section>}
        {(setup || action) && <form className="auth-stack" onSubmit={event => { event.preventDefault(); void perform(finish); }}>
          {action && <h2>{changeTitle}</h2>}
          <p className="auth-note">{action === "recovery-codes" && (zh ? "旧恢复码会立即失效。" : "Your old recovery codes will expire. ")}
            {zh ? "确认后，其他浏览器和已配对的桌面端需要重新登录。" : "After confirmation, your other browser and paired desktop sessions will need to sign in again."}</p>
          <VerificationField recovery={recovery} code={code} busy={busy} invalid={error instanceof Error && error.message === "invalid_verification_code"}
            onChange={value => { setCode(value); setError(null); }} />
          <button className="signin-action signin-primary" disabled={busy || !completeVerification(code, recovery)}>
            {busy ? (zh ? "处理中…" : "Saving…") : setup ? (zh ? "确认绑定" : "Confirm setup") : changeTitle}
          </button>
          <div className="auth-links">
            {action && <button className="auth-link" type="button" disabled={busy} onClick={() => {
              setRecovery(!recovery); setCode(""); setError(null);
            }}>{recovery ? (zh ? "使用验证器" : "Use authenticator") : (zh ? "使用恢复码" : "Use a recovery code")}</button>}
            <button className="auth-link" type="button" disabled={busy} onClick={clearForm}>{zh ? "取消" : "Cancel"}</button>
          </div>
        </form>}
        {!codes.length && !setup && !action && <a className="auth-link auth-back" href="/"><StudioIcon name="arrow-left" size={15} />{zh ? "返回工作区" : "Back to workspace"}</a>}
      </div>
    </AuthScreen>
  );
}

export function GithubAuthSetup() {
  const zh = useLocale().locale === "zh";
  const [key] = useState(() => new URLSearchParams(location.hash.slice(1)).get("key") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<unknown>(null);
  useEffect(() => { history.replaceState(null, "", location.pathname); }, []);
  async function register() {
    if (!key || busy) return;
    setBusy(true); setError(null);
    try {
      const data = await browserAuthRequest<{ action: string; manifest: Record<string, unknown> }>("/registration/start", { setup_key: key });
      const target = new URL(data.action);
      if (target.origin !== "https://github.com" || target.pathname !== "/settings/apps/new") throw new Error("invalid_setup_destination");
      const form = document.createElement("form");
      form.method = "POST"; form.action = target.toString();
      const field = document.createElement("input");
      field.type = "hidden"; field.name = "manifest"; field.value = JSON.stringify(data.manifest);
      form.appendChild(field); document.body.appendChild(form); form.submit();
    } catch (cause) { setError(cause); setBusy(false); }
  }
  return <AuthScreen title={zh ? "配置 GitHub 登录" : "Configure GitHub sign-in"}>
    <div className="auth-stack">
      <p>{key ? (zh ? "在 GitHub 创建一个应用，用于此工作区的账号登录。" : "Create a GitHub app for signing in to this workspace.")
        : (zh ? "请从管理员提供的一次性设置链接进入。" : "Open the one-time setup link from your administrator.")}</p>
      <AuthError error={error} />
      {key && <button className="signin-action signin-primary" disabled={busy} onClick={() => void register()}>
        {busy ? (zh ? "正在前往 GitHub…" : "Opening GitHub…") : (zh ? "在 GitHub 创建应用" : "Create app on GitHub")}
      </button>}
      <a className={key ? "auth-link auth-back" : "signin-action signin-primary"} href="/">{zh ? "返回登录页" : "Return to sign-in"}</a>
    </div>
  </AuthScreen>;
}
