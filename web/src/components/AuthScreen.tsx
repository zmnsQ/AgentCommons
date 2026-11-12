import type { ReactNode } from "react";
import { useT } from "../i18n/useT";
import "../i18n/strings/TokenGate";
import { Brand } from "./Brand";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { OriginalProjectCredit } from "./OriginalProjectCredit";
import "./sign-in.css";

export function AuthScreen({ title, children, wide = false }: {
  title: string;
  children: ReactNode;
  wide?: boolean;
}) {
  const t = useT();
  return (
    <main className="signin-page">
      <div className={wide ? "signin-shell signin-shell-wide" : "signin-shell"}>
        <section className="signin-panel" aria-labelledby="signin-title">
          <Brand />
          <h1 id="signin-title">{title}</h1>
          {children}
        </section>
        <footer className="signin-footer">
          <LanguageSwitcher />
          <details className="signin-credit">
            <summary>{t("TokenGate.credit")}</summary>
            <OriginalProjectCredit compact />
          </details>
        </footer>
      </div>
    </main>
  );
}
