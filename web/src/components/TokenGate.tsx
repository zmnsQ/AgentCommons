import { useState } from "react";
import { githubLoginUrl, securityError } from "../lib/browserAuth";
import type { AuthProviderConfig } from "../lib/oidc";
import { useT } from "../i18n/useT";
import { useLocale } from "../i18n/locale";
import { AuthScreen } from "./AuthScreen";
import { StudioIcon } from "./StudioIcon";
import "../i18n/strings/App";
import "../i18n/strings/TokenGate";

interface Props {
  github?: { configured: boolean; loading: boolean; error: unknown };
  error: string | null;
  providers: AuthProviderConfig[];
  onSso(provider: AuthProviderConfig): void;
  onSubmit(token: string): void;
}

export function TokenGate({ error, providers, onSso, onSubmit, github }: Props) {
  const [value, setValue] = useState("");
  const t = useT();
  const { locale } = useLocale();
  const tokenOnly = !github?.configured && !github?.loading && providers.length === 0;

  const tokenForm = (
    <form className="gate-form" onSubmit={(event) => {
      event.preventDefault();
      const token = value.trim();
      if (token) onSubmit(token);
    }}>
      <label htmlFor="ap-token">{t("TokenGate.tokenLabel")}</label>
      <input id="ap-token" type="password" placeholder="ap_…" autoComplete="off"
        aria-invalid={error !== null} aria-describedby={error ? "ap-token-error" : undefined}
        value={value} onChange={(event) => setValue(event.target.value)} />
      <button className={tokenOnly ? "signin-action signin-primary" : "signin-action"} type="submit" disabled={!value.trim()}>
        {t("TokenGate.submit")}
      </button>
    </form>
  );

  return (
    <AuthScreen title={t("TokenGate.title")}>
      <div className="signin-methods">
        {github?.configured && (
          <a className="signin-action signin-primary github-login-primary" href={githubLoginUrl()}>
            {t("TokenGate.github")}<StudioIcon name="arrow" size={18} />
          </a>
        )}
        {github?.loading && !github.configured && <p role="status">{t("TokenGate.loading")}</p>}
        {github?.error != null && <p className="signin-error" role="alert">{securityError(github.error, locale === "zh")}</p>}
        {providers.map((provider, index) => (
          <button key={provider.id} type="button" data-provider={provider.id}
            className={index === 0 && !github?.configured ? "signin-action signin-primary" : "signin-action"}
            onClick={() => onSso(provider)}>
            {provider.label || (provider.type === "oidc"
              ? t("App.auth.oidcSignIn")
              : t("App.auth.providerSignIn", { id: provider.id }))}
          </button>
        ))}
        {error !== null && <p id="ap-token-error" className="signin-error" role="alert">{error}</p>}
        {tokenOnly ? tokenForm : (
          <details className="signin-alternate">
            <summary>{t("TokenGate.tokenSignIn")}</summary>
            {tokenForm}
          </details>
        )}
      </div>
    </AuthScreen>
  );
}
